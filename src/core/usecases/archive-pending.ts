import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const ENTRY_SEPARATOR = /\n---\n/;
const DEFAULT_LIMIT = 30;

export interface ArchivePendingResult {
  /** 未蒸留エントリ（cursor以降） */
  entries: string[];
  /** 現在のcursor位置 */
  cursor: number;
  /** archive内の総エントリ数 */
  total: number;
  /** 今回返さなかった残りの未蒸留エントリ数 */
  remaining: number;
}

/**
 * ArchivePending — archive.md の未蒸留エントリを取得する
 *
 * archive.cursor に記録された位置以降のエントリを返す。
 * 読み取り専用 — cursorの更新は ArchiveCursorUpdate が担う。
 */
export class ArchivePending {
  constructor(private readonly engramsPath: string) {}

  async execute(
    engramId: string,
    limit?: number
  ): Promise<ArchivePendingResult> {
    const engramDir = join(this.engramsPath, engramId);
    const archivePath = join(engramDir, "archive.md");

    if (!existsSync(archivePath)) {
      throw new ArchivePendingEngramNotFoundError(engramId);
    }

    const raw = await readFile(archivePath, "utf-8");
    if (!raw.trim()) {
      return { entries: [], cursor: 0, total: 0, remaining: 0 };
    }

    const allEntries = raw
      .split(ENTRY_SEPARATOR)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const cursor = await this.readCursor(engramDir);
    const pendingEntries = allEntries.slice(cursor);

    const effectiveLimit = limit ?? DEFAULT_LIMIT;
    const returned = pendingEntries.slice(0, effectiveLimit);

    return {
      entries: returned,
      cursor,
      total: allEntries.length,
      remaining: pendingEntries.length - returned.length,
    };
  }

  private async readCursor(engramDir: string): Promise<number> {
    const cursorPath = join(engramDir, "archive.cursor");
    if (!existsSync(cursorPath)) return 0;

    try {
      const raw = await readFile(cursorPath, "utf-8");
      const value = parseInt(raw.trim(), 10);
      return Number.isNaN(value) ? 0 : value;
    } catch {
      return 0;
    }
  }
}

export class ArchivePendingEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" archive not found`);
    this.name = "ArchivePendingEngramNotFoundError";
  }
}
