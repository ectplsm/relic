import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { EngramRepository } from "../ports/engram-repository.js";
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

    return {
      engramId: target.engramId,
      memoryFilesMerged,
      memoryIndexMerged,
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

    // 全日付の union
    const allDates = new Set([
      ...Object.keys(relicEntries),
      ...Object.keys(openclawEntries),
    ]);

    let mergedCount = 0;

    for (const date of allDates) {
      const relicContent = relicEntries[date];
      const openclawContent = openclawEntries[date];

      if (relicContent && !openclawContent) {
        // RELIC にだけある → OpenClaw にコピー
        await mkdir(openclawMemDir, { recursive: true });
        await writeFile(join(openclawMemDir, `${date}.md`), relicContent, "utf-8");
        mergedCount++;
      } else if (!relicContent && openclawContent) {
        // OpenClaw にだけある → RELIC にコピー
        await mkdir(relicMemDir, { recursive: true });
        await writeFile(join(relicMemDir, `${date}.md`), openclawContent, "utf-8");
        mergedCount++;
      } else if (relicContent && openclawContent && relicContent !== openclawContent) {
        // 両方にあるが内容が違う → マージして両方に書き込み
        const merged = this.mergeContents(relicContent, openclawContent);
        await writeFile(join(relicMemDir, `${date}.md`), merged, "utf-8");
        await writeFile(join(openclawMemDir, `${date}.md`), merged, "utf-8");
        mergedCount++;
      }
      // 内容が同じ → 何もしない
    }

    return mergedCount;
  }

  /**
   * MEMORY.md を双方向マージ
   */
  private async mergeMemoryIndex(
    relicDir: string,
    openclawDir: string
  ): Promise<boolean> {
    const relicPath = join(relicDir, MEMORY_INDEX);
    const openclawPath = join(openclawDir, MEMORY_INDEX);

    const relicContent = existsSync(relicPath)
      ? await readFile(relicPath, "utf-8")
      : null;
    const openclawContent = existsSync(openclawPath)
      ? await readFile(openclawPath, "utf-8")
      : null;

    if (relicContent && !openclawContent) {
      await writeFile(openclawPath, relicContent, "utf-8");
      return true;
    } else if (!relicContent && openclawContent) {
      await writeFile(relicPath, openclawContent, "utf-8");
      return true;
    } else if (relicContent && openclawContent && relicContent !== openclawContent) {
      const merged = this.mergeContents(relicContent, openclawContent);
      await writeFile(relicPath, merged, "utf-8");
      await writeFile(openclawPath, merged, "utf-8");
      return true;
    }

    return false;
  }

  /**
   * 2つのテキスト内容をマージする。
   * 重複行を除外しつつ、両方の内容を結合する。
   */
  private mergeContents(a: string, b: string): string {
    const aLines = a.trimEnd();
    const bLines = b.trimEnd();

    // 完全一致チェック（ここには来ないはずだが安全策）
    if (aLines === bLines) return a;

    // b の中で a に含まれない部分を抽出して追記
    const aSet = new Set(aLines.split("\n"));
    const uniqueB = bLines
      .split("\n")
      .filter((line) => !aSet.has(line));

    if (uniqueB.length === 0) return a;

    return aLines + "\n\n" + uniqueB.join("\n") + "\n";
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
