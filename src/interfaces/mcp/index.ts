#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ArchiveSearch,
  ArchiveSearchEngramNotFoundError,
} from "../../core/usecases/archive-search.js";
import {
  ArchivePending,
  ArchivePendingEngramNotFoundError,
} from "../../core/usecases/archive-pending.js";
import {
  ArchiveCursorUpdate,
} from "../../core/usecases/archive-cursor-update.js";
import {
  MemoryWrite,
  MemoryWriteEngramNotFoundError,
} from "../../core/usecases/memory-write.js";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolveEngramsPath } from "../../shared/config.js";

const server = new McpServer({
  name: "relic",
  version: "0.1.0",
});

// --- relic_archive_search ---
server.tool(
  "relic_archive_search",
  "Search an Engram's archive for entries matching a keyword. Searches raw session logs — more complete than memory/*.md.",
  {
    id: z.string().describe("Engram ID"),
    query: z.string().describe("Search keyword"),
    limit: z
      .number()
      .optional()
      .describe("Max results to return (default: 5)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const archiveSearch = new ArchiveSearch(engramsPath);

    try {
      const results = await archiveSearch.search(
        args.id,
        args.query,
        args.limit ?? 5
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No archive entries matching "${args.query}" found.`,
            },
          ],
        };
      }

      const text = results
        .map((r) => `[entry -${r.index}]\n${r.entry}`)
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      if (err instanceof ArchiveSearchEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_archive_pending ---
server.tool(
  "relic_archive_pending",
  "Get un-distilled archive entries since the last memory distillation. Use this to review recent session logs before distilling them into memory.",
  {
    id: z.string().describe("Engram ID"),
    limit: z
      .number()
      .optional()
      .describe("Max entries to return (default: 30)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const archivePending = new ArchivePending(engramsPath);

    try {
      const result = await archivePending.execute(args.id, args.limit);

      if (result.entries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No pending archive entries. All entries have been distilled.",
            },
          ],
        };
      }

      const header = `cursor: ${result.cursor} | total: ${result.total} | returned: ${result.entries.length} | remaining: ${result.remaining}`;
      const body = result.entries
        .map((e, i) => `[entry ${result.cursor + i + 1}]\n${e}`)
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: `${header}\n\n${body}` }],
      };
    } catch (err) {
      if (err instanceof ArchivePendingEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_memory_write ---
server.tool(
  "relic_memory_write",
  "Write distilled memory to an Engram's memory file and advance the archive cursor. Call this after reviewing pending archive entries and distilling them into key insights.",
  {
    id: z.string().describe("Engram ID"),
    content: z.string().describe("Distilled memory content to write to memory/YYYY-MM-DD.md"),
    count: z
      .number()
      .describe("Number of archive entries distilled (from relic_archive_pending returned count)"),
    long_term: z
      .string()
      .optional()
      .describe("Especially important facts to append to MEMORY.md (long-term memory that persists across all sessions)"),
    user_profile: z
      .string()
      .optional()
      .describe("User profile updates to write to USER.md (preferences, tendencies, work style — about the human, not the project)"),
    date: z
      .string()
      .optional()
      .describe("Date for memory file (YYYY-MM-DD, default: today)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);

    try {
      // Step 1: Write daily memory
      const memoryWrite = new MemoryWrite(engramsPath);
      const writeResult = await memoryWrite.execute(
        args.id,
        args.content,
        args.date
      );

      // Step 2: Append to MEMORY.md if long_term is provided
      let longTermWritten = false;
      if (args.long_term) {
        const memoryMdPath = join(engramsPath, args.id, "MEMORY.md");
        if (existsSync(memoryMdPath)) {
          const existing = await readFile(memoryMdPath, "utf-8");
          const separator = existing.endsWith("\n") ? "\n" : "\n\n";
          await writeFile(memoryMdPath, existing + separator + args.long_term + "\n", "utf-8");
        } else {
          await writeFile(memoryMdPath, args.long_term + "\n", "utf-8");
        }
        longTermWritten = true;
      }

      // Step 2.5: Write USER.md if user_profile is provided
      let userProfileWritten = false;
      if (args.user_profile) {
        const userMdPath = join(engramsPath, args.id, "USER.md");
        await writeFile(userMdPath, args.user_profile + "\n", "utf-8");
        userProfileWritten = true;
      }

      // Step 3: Advance cursor by the number of distilled entries
      const cursorUpdate = new ArchiveCursorUpdate(engramsPath);
      const cursorResult = await cursorUpdate.execute(args.id, args.count);

      const parts = [
        `Memory written to ${writeResult.date} (${writeResult.appended ? "appended" : "created"}).`,
      ];
      if (longTermWritten) {
        parts.push("Long-term memory (MEMORY.md) updated.");
      }
      if (userProfileWritten) {
        parts.push("User profile (USER.md) updated.");
      }
      parts.push(`Archive cursor advanced: ${cursorResult.previousCursor} → ${cursorResult.newCursor}.`);

      return {
        content: [
          {
            type: "text" as const,
            text: parts.join(" "),
          },
        ],
      };
    } catch (err) {
      if (err instanceof MemoryWriteEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Relic MCP Server fatal error:", err);
  process.exit(1);
});
