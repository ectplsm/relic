import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { Engram, EngramFiles } from "../entities/engram.js";
import { FILE_MAP, MEMORY_DIR, resolveAgentPath } from "../../shared/openclaw.js";

export interface ExtractResult {
  engramId: string;
  engramName: string;
  sourcePath: string;
  filesRead: string[];
  memoryMerged: boolean;
}

/**
 * Extract — OpenClawワークスペースからEngramを作成する
 *
 * agent名 = Engram ID の規約に基づき、agents/<engramId>/agent/ から読み取る。
 *
 * 既存Engramがある場合:
 *   - --force なし → memoryエントリのみマージ（persona部分は変更しない）
 *   - --force あり → persona部分を上書き + memoryをマージ
 * 既存Engramがない場合:
 *   - 新規作成（全ファイル含む）
 */
export class Extract {
  constructor(private readonly repository: EngramRepository) {}

  async execute(
    engramId: string,
    options?: {
      name?: string;
      openclawDir?: string;
      force?: boolean;
    }
  ): Promise<ExtractResult> {
    const sourcePath = resolveAgentPath(engramId, options?.openclawDir);

    if (!existsSync(sourcePath)) {
      throw new WorkspaceNotFoundError(sourcePath);
    }

    const { files, filesRead } = await this.readFiles(sourcePath);

    if (filesRead.length === 0) {
      throw new WorkspaceEmptyError(sourcePath);
    }

    const existing = await this.repository.get(engramId);

    if (existing) {
      if (options?.force) {
        // --force: persona上書き + memoryマージ
        const merged = await this.mergeAndSave(
          existing,
          files,
          options.name ?? existing.meta.name
        );
        return {
          engramId,
          engramName: options.name ?? existing.meta.name,
          sourcePath,
          filesRead,
          memoryMerged: merged,
        };
      }

      // --forceなし: memoryのみマージ
      if (!files.memoryEntries || Object.keys(files.memoryEntries).length === 0) {
        throw new EngramAlreadyExistsError(engramId);
      }

      const merged = await this.mergeMemoryOnly(engramId, files.memoryEntries);
      return {
        engramId,
        engramName: existing.meta.name,
        sourcePath,
        filesRead,
        memoryMerged: merged,
      };
    }

    // 新規作成 — nameは必須
    const engramName = options?.name;
    if (!engramName) {
      throw new ExtractNameRequiredError(engramId);
    }

    const now = new Date().toISOString();
    const engram: Engram = {
      meta: {
        id: engramId,
        name: engramName,
        description: `Extracted from OpenClaw agent (${engramId})`,
        createdAt: now,
        updatedAt: now,
        tags: ["extracted", "openclaw"],
      },
      files,
    };

    await this.repository.save(engram);

    return {
      engramId,
      engramName,
      sourcePath,
      filesRead,
      memoryMerged: false,
    };
  }

  /**
   * --force時: persona上書き + memoryマージ
   */
  private async mergeAndSave(
    existing: Engram,
    newFiles: EngramFiles,
    engramName: string
  ): Promise<boolean> {
    const mergedFiles: EngramFiles = { ...newFiles };

    // memoryEntriesをマージ
    let memoryMerged = false;
    if (newFiles.memoryEntries) {
      mergedFiles.memoryEntries = { ...existing.files.memoryEntries };
      for (const [date, content] of Object.entries(newFiles.memoryEntries)) {
        const existingContent = mergedFiles.memoryEntries?.[date];
        if (existingContent) {
          const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
          mergedFiles.memoryEntries[date] = existingContent + separator + content;
        } else {
          mergedFiles.memoryEntries = mergedFiles.memoryEntries ?? {};
          mergedFiles.memoryEntries[date] = content;
        }
        memoryMerged = true;
      }
    }

    const updatedEngram: Engram = {
      meta: {
        ...existing.meta,
        name: engramName,
        updatedAt: new Date().toISOString(),
      },
      files: mergedFiles,
    };

    await this.repository.save(updatedEngram);
    return memoryMerged;
  }

  /**
   * --forceなし時: memoryエントリのみ追記（repositoryのAPIを使用）
   */
  private async mergeMemoryOnly(
    engramId: string,
    newEntries: Record<string, string>
  ): Promise<boolean> {
    const existing = await this.repository.get(engramId);
    if (!existing) return false;

    const mergedEntries = { ...existing.files.memoryEntries };
    for (const [date, content] of Object.entries(newEntries)) {
      const existingContent = mergedEntries[date];
      if (existingContent) {
        const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
        mergedEntries[date] = existingContent + separator + content;
      } else {
        mergedEntries[date] = content;
      }
    }

    const updatedEngram: Engram = {
      ...existing,
      meta: { ...existing.meta, updatedAt: new Date().toISOString() },
      files: { ...existing.files, memoryEntries: mergedEntries },
    };

    await this.repository.save(updatedEngram);
    return true;
  }

  private async readFiles(
    sourcePath: string
  ): Promise<{ files: EngramFiles; filesRead: string[] }> {
    const files: Partial<EngramFiles> = {};
    const filesRead: string[] = [];

    for (const [key, filename] of Object.entries(FILE_MAP)) {
      const filePath = join(sourcePath, filename);
      if (existsSync(filePath)) {
        (files as Record<string, string>)[key] = await readFile(
          filePath,
          "utf-8"
        );
        filesRead.push(filename);
      }
    }

    const memoryDir = join(sourcePath, MEMORY_DIR);
    if (existsSync(memoryDir)) {
      const entries = await readdir(memoryDir);
      const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
      if (mdFiles.length > 0) {
        files.memoryEntries = {};
        for (const mdFile of mdFiles) {
          const date = mdFile.replace(/\.md$/, "");
          files.memoryEntries[date] = await readFile(
            join(memoryDir, mdFile),
            "utf-8"
          );
          filesRead.push(`${MEMORY_DIR}/${mdFile}`);
        }
      }
    }

    return { files: files as EngramFiles, filesRead };
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor(path: string) {
    super(`OpenClaw workspace not found at ${path}`);
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspaceEmptyError extends Error {
  constructor(path: string) {
    super(`No workspace files found at ${path}`);
    this.name = "WorkspaceEmptyError";
  }
}

export class EngramAlreadyExistsError extends Error {
  constructor(id: string) {
    super(
      `Engram "${id}" already exists. Use --force to overwrite.`
    );
    this.name = "EngramAlreadyExistsError";
  }
}

export class ExtractNameRequiredError extends Error {
  constructor(id: string) {
    super(
      `No existing Engram "${id}" found. --name is required for new Engrams.`
    );
    this.name = "ExtractNameRequiredError";
  }
}
