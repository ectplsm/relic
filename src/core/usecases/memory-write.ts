import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";

export interface MemoryWriteResult {
  engramId: string;
  date: string;
  appended: boolean;
  path: string;
}

export interface MemoryWriteBatchItem {
  date: string;
  content: string;
}

/**
 * MemoryWrite — Engramのメモリエントリに追記する
 *
 * 指定日付の memory/YYYY-MM-DD.md に内容を append する。
 * ファイルが存在しない場合は新規作成する。
 */
export class MemoryWrite {
  constructor(private readonly engramsPath: string) {}

  async execute(
    engramId: string,
    content: string,
    date?: string
  ): Promise<MemoryWriteResult> {
    const resolvedDate = date ?? new Date().toISOString().split("T")[0];
    const [result] = await this.executeBatch(engramId, [
      { date: resolvedDate, content },
    ]);
    return result;
  }

  async executeBatch(
    engramId: string,
    writes: MemoryWriteBatchItem[]
  ): Promise<MemoryWriteResult[]> {
    const engramDir = join(this.engramsPath, engramId);

    if (!existsSync(engramDir)) {
      throw new MemoryWriteEngramNotFoundError(engramId);
    }

    const memoryDir = join(engramDir, "memory");
    await mkdir(memoryDir, { recursive: true });

    const results: MemoryWriteResult[] = [];

    for (const write of writes) {
      const filePath = join(memoryDir, `${write.date}.md`);
      let appended = false;

      if (existsSync(filePath)) {
        const existing = await readFile(filePath, "utf-8");
        const separator = existing.endsWith("\n") ? "\n" : "\n\n";
        await writeFile(filePath, existing + separator + write.content + "\n", "utf-8");
        appended = true;
      } else {
        await writeFile(filePath, write.content + "\n", "utf-8");
      }

      results.push({
        engramId,
        date: write.date,
        appended,
        path: filePath,
      });
    }

    return results;
  }
}

export class MemoryWriteEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" not found`);
    this.name = "MemoryWriteEngramNotFoundError";
  }
}
