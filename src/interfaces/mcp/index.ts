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
  ArchiveCursorCorruptedError,
  ArchivePendingEngramNotFoundError,
} from "../../core/usecases/archive-pending.js";
import {
  ArchiveCursorUpdate,
  ArchiveCursorAdvanceOverflowError,
} from "../../core/usecases/archive-cursor-update.js";
import {
  MemoryWrite,
  MemoryWriteEngramNotFoundError,
} from "../../core/usecases/memory-write.js";
import {
  CreateEngram,
  EngramAlreadyExistsError,
  InvalidEngramIdError,
} from "../../core/usecases/create-engram.js";
import { DEFAULT_SOUL, DEFAULT_IDENTITY } from "../../shared/templates.js";
import { LocalEngramRepository } from "../../adapters/local/index.js";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  resolveDistillationBatchSize,
  resolveEngramsPath,
} from "../../shared/config.js";

type DailyWriteInput = {
  date: string;
  content: string;
};

async function appendLongTermAndUserProfile(
  engramsPath: string,
  id: string,
  long_term?: string,
  user_profile?: string
): Promise<{ longTermWritten: boolean; userProfileWritten: boolean }> {
  let longTermWritten = false;
  if (long_term) {
    const memoryMdPath = join(engramsPath, id, "MEMORY.md");
    if (existsSync(memoryMdPath)) {
      const existing = await readFile(memoryMdPath, "utf-8");
      const separator = existing.endsWith("\n") ? "\n" : "\n\n";
      await writeFile(memoryMdPath, existing + separator + long_term + "\n", "utf-8");
    } else {
      await writeFile(memoryMdPath, long_term + "\n", "utf-8");
    }
    longTermWritten = true;
  }

  let userProfileWritten = false;
  if (user_profile) {
    const userMdPath = join(engramsPath, id, "USER.md");
    await writeFile(userMdPath, user_profile + "\n", "utf-8");
    userProfileWritten = true;
  }

  return { longTermWritten, userProfileWritten };
}

function assertDateCoverage(
  writes: DailyWriteInput[],
  expectedDates: string[],
  skippedDates: string[]
): void {
  const writeDates = writes.map((write) => write.date);
  const duplicateWriteDates = findDuplicates(writeDates);
  if (duplicateWriteDates.length > 0) {
    throw new Error(`Duplicate write dates are not allowed: ${duplicateWriteDates.join(", ")}`);
  }

  const duplicateSkippedDates = findDuplicates(skippedDates);
  if (duplicateSkippedDates.length > 0) {
    throw new Error(`Duplicate skipped_dates are not allowed: ${duplicateSkippedDates.join(", ")}`);
  }

  const overlappedDates = writeDates.filter((date) => skippedDates.includes(date));
  if (overlappedDates.length > 0) {
    throw new Error(`Dates cannot appear in both writes and skipped_dates: ${[...new Set(overlappedDates)].join(", ")}`);
  }

  const expectedSet = new Set(expectedDates);
  const coveredDates = [...writeDates, ...skippedDates];
  const unexpectedDates = coveredDates.filter((date) => !expectedSet.has(date));
  if (unexpectedDates.length > 0) {
    throw new Error(`Unexpected dates: ${[...new Set(unexpectedDates)].join(", ")}`);
  }

  const coveredSet = new Set(coveredDates);
  const missingDates = expectedDates.filter((date) => !coveredSet.has(date));
  if (missingDates.length > 0) {
    throw new Error(`Missing dates: ${missingDates.join(", ")}`);
  }
}

function findDuplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

const server = new McpServer({
  name: "relic",
  version: "0.1.0",
});

// --- relic_engram_create ---
server.tool(
  "relic_engram_create",
  "Create a new Engram (AI persona). Use this after gathering enough context about the desired persona through conversation. Ask the user about personality, voice, principles, and identity before calling this tool.",
  {
    id: z
      .string()
      .describe(
        "Unique Engram ID (lowercase alphanumeric + hyphens, e.g. 'my-agent')"
      ),
    name: z.string().describe("Display name for the Engram"),
    description: z
      .string()
      .optional()
      .describe("Short description of the Engram"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for categorization"),
    soul: z
      .string()
      .optional()
      .describe(
        "SOUL.md content — core principles, behavior rules, voice discipline, and boundaries. If omitted, a sensible default template is used."
      ),
    identity: z
      .string()
      .optional()
      .describe(
        "IDENTITY.md content — name, creature type, vibe, emoji, avatar, and background. If omitted, a blank template is used for the user to fill in."
      ),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const usecase = new CreateEngram(repo);

    try {
      const result = await usecase.execute({
        id: args.id,
        name: args.name,
        description: args.description,
        tags: args.tags,
        soul: args.soul ?? DEFAULT_SOUL,
        identity: args.identity ?? DEFAULT_IDENTITY,
      });

      const engramDir = join(engramsPath, result.engram.meta.id);
      const lines = [
        `Created Engram "${result.engram.meta.name}" (${result.engram.meta.id})`,
        `Directory: ${engramDir}/`,
        "",
        "Files created:",
        "  engram.json    — metadata (name, description, tags)",
        "  manifest.json  — system metadata (id, timestamps)",
        "  SOUL.md        — core principles and behavior",
        "  IDENTITY.md    — persona identity",
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      if (
        err instanceof EngramAlreadyExistsError ||
        err instanceof InvalidEngramIdError
      ) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

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
      .describe("Max entries to return (default: config.distillationBatchSize)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const archivePending = new ArchivePending(engramsPath);
    const defaultLimit = await resolveDistillationBatchSize();

    try {
      const result = await archivePending.execute(args.id, args.limit ?? defaultLimit);

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

      const dates = [...new Set(result.entries.map((entry) => entry.date).filter(Boolean))];
      const header = [
        `cursor: ${result.cursor}`,
        `total: ${result.total}`,
        `returned: ${result.entries.length}`,
        `remaining: ${result.remaining}`,
        `dates: ${dates.length > 0 ? dates.join(", ") : "unknown"}`,
      ].join(" | ");
      const body = result.entries
        .map((entry, i) => {
          const lines = [`[entry ${result.cursor + i + 1}]`];
          if (entry.date) {
            lines.push(`date: ${entry.date}`);
          }
          if (entry.summary) {
            lines.push(`summary: ${entry.summary}`);
          }
          lines.push(entry.raw);
          return lines.join("\n");
        })
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: `${header}\n\n${body}` }],
      };
    } catch (err) {
      if (
        err instanceof ArchivePendingEngramNotFoundError ||
        err instanceof ArchiveCursorCorruptedError
      ) {
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
    writes: z
      .array(
        z.object({
          date: z.string().describe("Archive entry date for this memory file (YYYY-MM-DD)"),
          content: z.string().describe("Distilled memory content for memory/YYYY-MM-DD.md"),
        })
      )
      .min(0)
      .describe("Distilled memory writes grouped by actual archive dates"),
    expected_dates: z
      .array(z.string())
      .describe("All archive dates that must be explicitly covered by writes or skipped_dates"),
    skipped_dates: z
      .array(z.string())
      .describe("Archive dates intentionally skipped because they produced no durable memory"),
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
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);

    try {
      const memoryWrite = new MemoryWrite(engramsPath);
      assertDateCoverage(args.writes, args.expected_dates, args.skipped_dates);

      const writeResults = await memoryWrite.executeBatch(args.id, args.writes);
      const writeSummary =
        writeResults.length > 0
          ? writeResults
              .map((result) => `${result.date} (${result.appended ? "appended" : "created"})`)
              .join(", ")
          : "no files";

      const { longTermWritten, userProfileWritten } = await appendLongTermAndUserProfile(
        engramsPath,
        args.id,
        args.long_term,
        args.user_profile
      );

      const cursorUpdate = new ArchiveCursorUpdate(engramsPath);
      const cursorResult = await cursorUpdate.execute(args.id, args.count);

      const parts = [`Memory written to ${writeSummary}.`];
      if (args.skipped_dates.length > 0) {
        parts.push(`Skipped dates: ${args.skipped_dates.join(", ")}.`);
      }
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
      if (
        err instanceof MemoryWriteEngramNotFoundError ||
        err instanceof ArchiveCursorAdvanceOverflowError ||
        err instanceof ArchiveCursorCorruptedError ||
        err instanceof Error
      ) {
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
