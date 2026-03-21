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

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Relic MCP Server fatal error:", err);
  process.exit(1);
});
