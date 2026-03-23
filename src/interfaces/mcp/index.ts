#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  InboxWrite,
  InboxWriteEngramNotFoundError,
} from "../../core/usecases/index.js";
import {
  InboxSearch,
  InboxSearchEngramNotFoundError,
} from "../../core/usecases/inbox-search.js";
import { resolveEngramsPath } from "../../shared/config.js";

const server = new McpServer({
  name: "relic",
  version: "0.1.0",
});

// --- relic_inbox_write ---
server.tool(
  "relic_inbox_write",
  "Write session log and memory entries to an Engram's inbox. Call after EVERY response.",
  {
    id: z.string().describe("Engram ID"),
    content: z
      .string()
      .describe(
        "Entries separated by '---'. Tag with [memory] to persist to long-term memory."
      ),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const inboxWrite = new InboxWrite(engramsPath);

    try {
      const result = await inboxWrite.execute(args.id, args.content);

      const parts: string[] = [];
      if (result.memoriesSaved > 0) {
        parts.push(
          `${result.memoriesSaved} memor${result.memoriesSaved === 1 ? "y" : "ies"} saved`
        );
      }
      if (result.logsRecorded > 0) {
        parts.push(
          `${result.logsRecorded} log${result.logsRecorded === 1 ? "" : "s"} recorded`
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Inbox updated (${result.engramId}): ${parts.join(", ")}.`,
          },
        ],
      };
    } catch (err) {
      if (err instanceof InboxWriteEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_inbox_search ---
server.tool(
  "relic_inbox_search",
  "Search an Engram's inbox for entries matching a keyword. Searches raw session logs — more complete than memory/*.md.",
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
    const inboxSearch = new InboxSearch(engramsPath);

    try {
      const results = await inboxSearch.search(
        args.id,
        args.query,
        args.limit ?? 5
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No inbox entries matching "${args.query}" found.`,
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
      if (err instanceof InboxSearchEngramNotFoundError) {
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
