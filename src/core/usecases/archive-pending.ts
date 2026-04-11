import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const ENTRY_SEPARATOR = /\n---\n/;
const DEFAULT_LIMIT = 100;
const ENTRY_HEADER_PATTERN = /^(\d{4}-\d{2}-\d{2}) \| ?(.*)$/;

export interface ArchivePendingEntry {
  /** archive.md 先頭行から抽出した日付 */
  date: string | null;
  /** archive.md 先頭行の summary 部分 */
  summary: string | null;
  /** エントリ全文 */
  raw: string;
  /** 先頭行を除いた本文 */
  body: string;
}

export interface ArchivePendingResult {
  /** 未蒸留エントリ（cursor以降） */
  entries: ArchivePendingEntry[];
  /** 現在のcursor位置 */
  cursor: number;
  /** archive内の総エントリ数 */
  total: number;
  /** 今回返さなかった残りの未蒸留エントリ数 */
  remaining: number;
}

export class ArchiveCursorCorruptedError extends Error {
  constructor(
    public readonly id: string,
    public readonly cursor: number,
    public readonly total: number
  ) {
    super(
      `Engram "${id}" archive cursor is invalid (${cursor} > ${total}). Repair archive.cursor before distilling.`
    );
    this.name = "ArchiveCursorCorruptedError";
  }
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
    if (cursor > allEntries.length) {
      throw new ArchiveCursorCorruptedError(engramId, cursor, allEntries.length);
    }
    const pendingEntries = allEntries.slice(cursor);

    const effectiveLimit = limit ?? DEFAULT_LIMIT;
    const returned = pendingEntries.slice(0, effectiveLimit);

    return {
      entries: returned.map(parseArchiveEntry),
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

export function parseArchiveEntry(raw: string): ArchivePendingEntry {
  const trimmed = raw.trim();
  const [header = "", ...rest] = trimmed.split("\n");
  const match = header.match(ENTRY_HEADER_PATTERN);

  if (!match) {
    return {
      date: null,
      summary: null,
      raw: trimmed,
      body: trimmed,
    };
  }

  return {
    date: match[1],
    summary: match[2] || null,
    raw: trimmed,
    body: rest.join("\n").trim(),
  };
}

export class ArchivePendingEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" archive not found`);
    this.name = "ArchivePendingEngramNotFoundError";
  }
}
