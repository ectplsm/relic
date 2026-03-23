import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { MemoryWrite } from "./memory-write.js";

const ENTRY_SEPARATOR = /\n---\n/;
const MEMORY_TAG = /^\[memory\]\s*/i;

export interface InboxWriteResult {
  engramId: string;
  /** inbox.md に追記されたエントリ数 */
  totalEntries: number;
  /** memory/*.md に永続化されたメモリ数 */
  memoriesSaved: number;
  /** ログとして記録されたエントリ数 */
  logsRecorded: number;
}

/**
 * InboxWrite — MCP経由で inbox.md にエントリを追記する
 *
 * CLI の MemoryInbox (fs.watch) と同じフォーマットで inbox.md に書き込む。
 * `[memory]` タグ付きエントリは即座に memory/*.md にも永続化する。
 *
 * これにより CLI Shell と MCP Desktop で同一の inbox.md フォーマットを共有し、
 * セッションログ + メモリ永続化の二重の役割を果たす。
 */
export class InboxWrite {
  constructor(private readonly engramsPath: string) {}

  async execute(
    engramId: string,
    content: string
  ): Promise<InboxWriteResult> {
    const engramDir = join(this.engramsPath, engramId);

    if (!existsSync(engramDir)) {
      throw new InboxWriteEngramNotFoundError(engramId);
    }

    // inbox.md に追記
    const inboxPath = join(engramDir, "inbox.md");
    await this.appendToInbox(inboxPath, content);

    // エントリをパースして [memory] タグ付きを永続化
    const entries = content
      .split(ENTRY_SEPARATOR)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const writer = new MemoryWrite(this.engramsPath);
    let memoriesSaved = 0;
    let logsRecorded = 0;

    for (const entry of entries) {
      if (MEMORY_TAG.test(entry)) {
        const memContent = entry.replace(MEMORY_TAG, "").trim();
        await writer.execute(engramId, memContent);
        memoriesSaved++;
      } else {
        logsRecorded++;
      }
    }

    return {
      engramId,
      totalEntries: entries.length,
      memoriesSaved,
      logsRecorded,
    };
  }

  private async appendToInbox(
    inboxPath: string,
    content: string
  ): Promise<void> {
    await mkdir(join(inboxPath, ".."), { recursive: true });

    let existing = "";
    if (existsSync(inboxPath)) {
      existing = await readFile(inboxPath, "utf-8");
    }

    // 既存内容があれば --- で区切って追記
    const separator = existing.length > 0 && !existing.endsWith("\n---\n")
      ? "\n---\n"
      : "";

    await writeFile(inboxPath, existing + separator + content + "\n", "utf-8");
  }
}

export class InboxWriteEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" not found`);
    this.name = "InboxWriteEngramNotFoundError";
  }
}
