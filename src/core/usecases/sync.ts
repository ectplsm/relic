import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { EngramRepository } from "../ports/engram-repository.js";
import { mergeMemoryRecords } from "../sync/memory-merge.js";
import { extractAgentName, MEMORY_DIR } from "../../shared/openclaw.js";

const DEFAULT_OPENCLAW_DIR = join(homedir(), ".openclaw");
const MEMORY_INDEX = "MEMORY.md";

export interface SyncTarget {
  engramId: string;
  workspacePath: string;
}

export interface SyncResult {
  engramId: string;
  memoryFilesMerged: number;
  memoryIndexMerged: boolean;
  userMerged: boolean;
}

export interface SyncInitialResult {
  synced: SyncResult[];
  skipped: string[];
}

/**
 * Sync — Relic Engram と OpenClaw workspace 間で memory を双方向マージする。
 *
 * 対象: 同名の engram/agent が両方に存在するペアのみ。
 * マージ対象: memory/*.md と MEMORY.md
 * マージ結果は両方に書き戻される。
 */
export class Sync {
  constructor(
    private readonly repository: EngramRepository,
    private readonly engramsPath: string
  ) {}

  async execute(openclawDir?: string): Promise<SyncInitialResult> {
    const baseDir = openclawDir ?? DEFAULT_OPENCLAW_DIR;

    if (!existsSync(baseDir)) {
      throw new SyncOpenclawDirNotFoundError(baseDir);
    }

    const targets = await this.scanMatchingPairs(baseDir);
    const synced: SyncResult[] = [];
    const skipped: string[] = [];

    for (const target of targets) {
      try {
        const result = await this.syncPair(target);
        synced.push(result);
      } catch {
        skipped.push(target.engramId);
      }
    }

    // workspace に対応する engram ��ないものを skipped に追加
    const allWorkspaces = await this.scanAllWorkspaces(baseDir);
    for (const ws of allWorkspaces) {
      const matched = targets.some((t) => t.engramId === ws);
      if (!matched) {
        skipped.push(ws);
      }
    }

    return { synced, skipped };
  }

  /**
   * 1ペア分の memory マージ（inject 後の自動 sync 等でも使用）
   */
  async syncPair(target: SyncTarget): Promise<SyncResult> {
    const relicDir = join(this.engramsPath, target.engramId);
    const openclawDir = target.workspacePath;

    // memory/*.md のマージ
    const memoryFilesMerged = await this.mergeMemoryEntries(relicDir, openclawDir);

    // MEMORY.md のマージ
    const memoryIndexMerged = await this.mergeMemoryIndex(relicDir, openclawDir);

    // USER.md のマージ
    const userMerged = await this.mergeSingleFile(relicDir, openclawDir, "USER.md");

    return {
      engramId: target.engramId,
      memoryFilesMerged,
      memoryIndexMerged,
      userMerged,
    };
  }

  /**
   * memory/*.md を双方向マージ
   */
  private async mergeMemoryEntries(
    relicDir: string,
    openclawDir: string
  ): Promise<number> {
    const relicMemDir = join(relicDir, MEMORY_DIR);
    const openclawMemDir = join(openclawDir, MEMORY_DIR);

    const relicEntries = await this.readMemoryDir(relicMemDir);
    const openclawEntries = await this.readMemoryDir(openclawMemDir);

    const relicRecord = Object.fromEntries(
      Object.entries(relicEntries).map(([date, content]) => [`memory/${date}.md`, content]),
    );
    const openclawRecord = Object.fromEntries(
      Object.entries(openclawEntries).map(([date, content]) => [`memory/${date}.md`, content]),
    );
    const { merged, changedPaths } = mergeMemoryRecords(relicRecord, openclawRecord);

    if (changedPaths.length === 0) {
      return 0;
    }

    await mkdir(relicMemDir, { recursive: true });
    await mkdir(openclawMemDir, { recursive: true });

    for (const [path, content] of Object.entries(merged)) {
      const date = path.replace("memory/", "").replace(".md", "");
      await writeFile(join(relicMemDir, `${date}.md`), content, "utf-8");
      await writeFile(join(openclawMemDir, `${date}.md`), content, "utf-8");
    }

    return changedPaths.length;
  }

  /**
   * MEMORY.md を双方向マージ
   */
  private async mergeMemoryIndex(
    relicDir: string,
    openclawDir: string
  ): Promise<boolean> {
    return this.mergeSingleFile(relicDir, openclawDir, MEMORY_INDEX);
  }

  /**
   * 単一ファイルの双方向マージ（MEMORY.md, USER.md 等）
   */
  private async mergeSingleFile(
    relicDir: string,
    openclawDir: string,
    filename: string
  ): Promise<boolean> {
    const relicPath = join(relicDir, filename);
    const openclawPath = join(openclawDir, filename);

    const relicContent = existsSync(relicPath)
      ? await readFile(relicPath, "utf-8")
      : null;
    const openclawContent = existsSync(openclawPath)
      ? await readFile(openclawPath, "utf-8")
      : null;

    const relicRecord = relicContent ? { [filename]: relicContent } : {};
    const openclawRecord = openclawContent ? { [filename]: openclawContent } : {};
    const { merged, changedPaths } = mergeMemoryRecords(relicRecord, openclawRecord);

    if (changedPaths.length > 0) {
      const mergedContent = merged[filename];
      if (mergedContent !== undefined) {
        await writeFile(relicPath, mergedContent, "utf-8");
        await writeFile(openclawPath, mergedContent, "utf-8");
      }
      return true;
    }

    return false;
  }

  /**
   * memory/ ディレクトリから日付 → 内容のマップを読む
   */
  private async readMemoryDir(
    memDir: string
  ): Promise<Record<string, string>> {
    const entries: Record<string, string> = {};
    if (!existsSync(memDir)) return entries;

    const files = await readdir(memDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const date = file.replace(/\.md$/, "");
      entries[date] = await readFile(join(memDir, file), "utf-8");
    }
    return entries;
  }

  /**
   * 同名の engram/agent が両方に存在するペアを返す
   */
  private async scanMatchingPairs(baseDir: string): Promise<SyncTarget[]> {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const targets: SyncTarget[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const agentName = extractAgentName(entry.name);
      if (!agentName) continue;

      const engram = await this.repository.get(agentName);
      if (!engram) continue;

      targets.push({
        engramId: agentName,
        workspacePath: join(baseDir, entry.name),
      });
    }

    return targets;
  }

  /**
   * 全 workspace のエージェント名一覧
   */
  private async scanAllWorkspaces(baseDir: string): Promise<string[]> {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const names: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentName = extractAgentName(entry.name);
      if (agentName) names.push(agentName);
    }

    return names;
  }
}

export class SyncOpenclawDirNotFoundError extends Error {
  constructor(path: string) {
    super(`OpenClaw directory not found at ${path}`);
    this.name = "SyncOpenclawDirNotFoundError";
  }
}
