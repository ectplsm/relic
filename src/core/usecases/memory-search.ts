import type { EngramRepository } from "../ports/engram-repository.js";

export interface MemorySearchResult {
  date: string;
  content: string;
  /** Matched lines (for keyword search) */
  matchedLines: string[];
}

/**
 * MemorySearch — Engramのメモリエントリをキーワード検索する
 */
export class MemorySearch {
  constructor(private readonly repository: EngramRepository) {}

  async search(
    engramId: string,
    query: string,
    limit: number = 5
  ): Promise<MemorySearchResult[]> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new MemoryEngramNotFoundError(engramId);
    }

    if (!engram.files.memoryEntries) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const results: MemorySearchResult[] = [];

    // Search entries from newest to oldest
    const entries = Object.entries(engram.files.memoryEntries).sort(
      ([a], [b]) => b.localeCompare(a)
    );

    for (const [date, content] of entries) {
      const lines = content.split("\n");
      const matchedLines = lines.filter((line) =>
        line.toLowerCase().includes(queryLower)
      );

      if (matchedLines.length > 0) {
        results.push({ date, content, matchedLines });
      }

      if (results.length >= limit) break;
    }

    return results;
  }

  async get(
    engramId: string,
    date: string
  ): Promise<{ date: string; content: string } | null> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new MemoryEngramNotFoundError(engramId);
    }

    const content = engram.files.memoryEntries?.[date];
    if (!content) {
      return null;
    }

    return { date, content };
  }

  async listDates(engramId: string): Promise<string[]> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new MemoryEngramNotFoundError(engramId);
    }

    if (!engram.files.memoryEntries) {
      return [];
    }

    return Object.keys(engram.files.memoryEntries).sort(
      (a, b) => b.localeCompare(a)
    );
  }
}

export class MemoryEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" not found`);
    this.name = "MemoryEngramNotFoundError";
  }
}
