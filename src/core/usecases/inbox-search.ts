import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const ENTRY_SEPARATOR = /\n---\n/;

export interface InboxSearchResult {
  /** マッチしたエントリの内容 */
  entry: string;
  /** エントリのインデックス（新しい順: 0が最新） */
  index: number;
}

/**
 * InboxSearch — inbox.md をキーワード検索する
 *
 * inbox.md は全セッションログ + [memory] エントリを含む生データ。
 * memory/*.md（蒸留済み）より情報量が多いため、検索先として優れている。
 */
export class InboxSearch {
  constructor(private readonly engramsPath: string) {}

  async search(
    engramId: string,
    query: string,
    limit: number = 5
  ): Promise<InboxSearchResult[]> {
    const inboxPath = join(this.engramsPath, engramId, "inbox.md");

    if (!existsSync(inboxPath)) {
      throw new InboxSearchEngramNotFoundError(engramId);
    }

    const raw = await readFile(inboxPath, "utf-8");
    if (!raw.trim()) return [];

    const entries = raw
      .split(ENTRY_SEPARATOR)
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .reverse(); // 新しい順

    const queryLower = query.toLowerCase();
    const results: InboxSearchResult[] = [];

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].toLowerCase().includes(queryLower)) {
        results.push({ entry: entries[i], index: i });
      }
      if (results.length >= limit) break;
    }

    return results;
  }
}

export class InboxSearchEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" inbox not found`);
    this.name = "InboxSearchEngramNotFoundError";
  }
}
