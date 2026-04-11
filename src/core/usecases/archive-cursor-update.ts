import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { ArchivePending } from "./archive-pending.js";

export interface ArchiveCursorUpdateResult {
  /** 更新前のcursor位置 */
  previousCursor: number;
  /** 更新後のcursor位置 */
  newCursor: number;
}

/**
 * ArchiveCursorUpdate — archive.cursor を指定件数分だけ進める
 *
 * relic_memory_write 時に呼ばれ、蒸留済みエントリ数だけcursorを前進させる。
 * 実際に蒸留した件数（= relic_archive_pending で返した件数）を受け取る。
 */
export class ArchiveCursorUpdate {
  constructor(private readonly engramsPath: string) {}

  async execute(engramId: string, count: number): Promise<ArchiveCursorUpdateResult> {
    const engramDir = join(this.engramsPath, engramId);

    if (!existsSync(engramDir)) {
      throw new ArchiveCursorUpdateEngramNotFoundError(engramId);
    }

    const cursorPath = join(engramDir, "archive.cursor");
    const previousCursor = await this.readCursor(cursorPath);
    const archivePending = new ArchivePending(this.engramsPath);
    const pending = await archivePending.execute(engramId, Number.MAX_SAFE_INTEGER);

    if (count > pending.entries.length) {
      throw new ArchiveCursorAdvanceOverflowError(engramId, count, pending.entries.length);
    }

    const newCursor = previousCursor + count;

    await writeFile(cursorPath, String(newCursor), "utf-8");

    return { previousCursor, newCursor };
  }

  private async readCursor(cursorPath: string): Promise<number> {
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

export class ArchiveCursorAdvanceOverflowError extends Error {
  constructor(
    public readonly id: string,
    public readonly requestedCount: number,
    public readonly availablePending: number
  ) {
    super(
      `Engram "${id}" cursor advance overflow (${requestedCount} > ${availablePending}). Refusing to move archive.cursor.`
    );
    this.name = "ArchiveCursorAdvanceOverflowError";
  }
}

export class ArchiveCursorUpdateEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" archive not found`);
    this.name = "ArchiveCursorUpdateEngramNotFoundError";
  }
}
