#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LocalEngramRepository } from "../../adapters/local/index.js";
import {
  Init,
  ListEngrams,
  Summon,
  EngramNotFoundError,
  Inject,
  InjectEngramNotFoundError,
  InjectAgentNotFoundError,
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
  EngramAlreadyExistsError,
  ExtractNameRequiredError,
  MemorySearch,
  MemoryEngramNotFoundError,
  MemoryWrite,
  MemoryWriteEngramNotFoundError,
  InboxWrite,
  InboxWriteEngramNotFoundError,
} from "../../core/usecases/index.js";
import { resolveEngramsPath } from "../../shared/config.js";

const server = new McpServer({
  name: "relic",
  version: "0.1.0",
});

// --- relic_init ---
server.tool(
  "relic_init",
  "Initialize ~/.relic/ directory with config and sample Engrams",
  async () => {
    const init = new Init();
    const result = await init.execute();

    if (result.created) {
      return {
        content: [
          {
            type: "text" as const,
            text: [
              "Relic initialized successfully.",
              `  Config: ${result.configPath}`,
              `  Engrams: ${result.engramsPath}`,
              "Sample Engrams created: motoko, johnny",
            ].join("\n"),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Relic already initialized at ${result.relicDir}`,
        },
      ],
    };
  }
);

// --- relic_list ---
server.tool(
  "relic_list",
  "List all available Engrams",
  {
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const listEngrams = new ListEngrams(repo);
    const engrams = await listEngrams.execute();

    if (engrams.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No Engrams found. Run relic_init to create sample Engrams.",
          },
        ],
      };
    }

    const lines = engrams.map(
      (e) => `- ${e.id}: ${e.name} — ${e.description}`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: lines.join("\n"),
        },
      ],
    };
  }
);

// --- relic_show ---
server.tool(
  "relic_show",
  "Show the composed prompt for an Engram (preview without launching a Shell)",
  {
    id: z.string().describe("Engram ID to show"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const summon = new Summon(repo);

    try {
      const result = await summon.execute(args.id);
      return {
        content: [
          {
            type: "text" as const,
            text: result.prompt,
          },
        ],
      };
    } catch (err) {
      if (err instanceof EngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_summon ---
server.tool(
  "relic_summon",
  "Summon an Engram — returns the persona prompt ready for injection into a Shell",
  {
    id: z.string().describe("Engram ID to summon"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const summon = new Summon(repo);

    try {
      const result = await summon.execute(args.id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                engramId: result.engramId,
                engramName: result.engramName,
                prompt: result.prompt,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      if (err instanceof EngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_inject ---
server.tool(
  "relic_inject",
  "Inject an Engram into an OpenClaw workspace (agent name = Engram ID)",
  {
    id: z.string().describe("Engram ID to inject (= OpenClaw agent name)"),
    to: z
      .string()
      .optional()
      .describe("Inject into a different agent name (default: same as Engram ID)"),
    openclaw: z
      .string()
      .optional()
      .describe("Override OpenClaw directory path (default: ~/.openclaw)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const inject = new Inject(repo);

    try {
      const result = await inject.execute(args.id, {
        to: args.to,
        openclawDir: args.openclaw,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Injected "${result.engramName}" into ${result.targetPath}`,
              `Files written: ${result.filesWritten.join(", ")}`,
            ].join("\n"),
          },
        ],
      };
    } catch (err) {
      if (
        err instanceof InjectEngramNotFoundError ||
        err instanceof InjectAgentNotFoundError
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

// --- relic_extract ---
server.tool(
  "relic_extract",
  "Extract an Engram from an OpenClaw workspace (agent name = Engram ID)",
  {
    id: z.string().describe("Engram ID (= OpenClaw agent name)"),
    name: z
      .string()
      .optional()
      .describe("Engram display name (required for new Engrams)"),
    openclaw: z
      .string()
      .optional()
      .describe("Override OpenClaw directory path (default: ~/.openclaw)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
    force: z
      .boolean()
      .optional()
      .describe("Overwrite existing Engram persona files"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const extract = new Extract(repo);

    try {
      const result = await extract.execute(args.id, {
        name: args.name,
        openclawDir: args.openclaw,
        force: args.force,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Extracted "${result.engramName}" from ${result.sourcePath}`,
              `Files read: ${result.filesRead.join(", ")}`,
              `Saved as Engram: ${result.engramId}`,
              ...(result.memoryMerged
                ? ["Memory entries merged into existing Engram"]
                : []),
            ].join("\n"),
          },
        ],
      };
    } catch (err) {
      if (
        err instanceof WorkspaceNotFoundError ||
        err instanceof WorkspaceEmptyError ||
        err instanceof EngramAlreadyExistsError ||
        err instanceof ExtractNameRequiredError
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

// --- relic_memory_search ---
server.tool(
  "relic_memory_search",
  "Search an Engram's memory entries by keyword",
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
    const repo = new LocalEngramRepository(engramsPath);
    const memorySearch = new MemorySearch(repo);

    try {
      const results = await memorySearch.search(
        args.id,
        args.query,
        args.limit ?? 5
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No memory entries matching "${args.query}" found.`,
            },
          ],
        };
      }

      const text = results
        .map(
          (r) =>
            `## ${r.date}\n${r.matchedLines.join("\n")}\n\n---\n\n${r.content}`
        )
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      if (err instanceof MemoryEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_memory_get ---
server.tool(
  "relic_memory_get",
  "Get a specific memory entry by date",
  {
    id: z.string().describe("Engram ID"),
    date: z
      .string()
      .describe("Date of the memory entry (YYYY-MM-DD)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const memorySearch = new MemorySearch(repo);

    try {
      const result = await memorySearch.get(args.id, args.date);

      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No memory entry found for ${args.date}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `## ${result.date}\n\n${result.content}`,
          },
        ],
      };
    } catch (err) {
      if (err instanceof MemoryEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

// --- relic_memory_list ---
server.tool(
  "relic_memory_list",
  "List all memory entry dates for an Engram",
  {
    id: z.string().describe("Engram ID"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const repo = new LocalEngramRepository(engramsPath);
    const memorySearch = new MemorySearch(repo);

    try {
      const dates = await memorySearch.listDates(args.id);

      if (dates.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No memory entries found." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `${dates.length} entries:\n${dates.join("\n")}`,
          },
        ],
      };
    } catch (err) {
      if (err instanceof MemoryEngramNotFoundError) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
      throw err;
    }
  }
);

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

// --- relic_memory_write ---
server.tool(
  "relic_memory_write",
  "Write a memory entry to an Engram (appends to the day's log)",
  {
    id: z.string().describe("Engram ID"),
    content: z.string().describe("Memory content to append"),
    date: z
      .string()
      .optional()
      .describe("Date for the entry (YYYY-MM-DD, default: today)"),
    path: z
      .string()
      .optional()
      .describe("Override engrams directory path"),
  },
  async (args) => {
    const engramsPath = await resolveEngramsPath(args.path);
    const memoryWrite = new MemoryWrite(engramsPath);

    try {
      const result = await memoryWrite.execute(
        args.id,
        args.content,
        args.date
      );

      const action = result.appended ? "Appended to" : "Created";
      return {
        content: [
          {
            type: "text" as const,
            text: `${action} memory entry for ${result.date} (${result.engramId})`,
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
