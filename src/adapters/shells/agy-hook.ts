import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const AGY_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "agy-stop.js");
const AGY_SETTINGS_PATH = join(homedir(), ".gemini", "antigravity-cli", "settings.json");
const AGY_HOOKS_PATH = join(homedir(), ".gemini", "config", "hooks.json");
const RELIC_HOOK_NAME = "relic-archive-log";
const RELIC_HOOK_BASE_COMMAND = `node ${shellQuote(AGY_HOOK_SCRIPT_PATH)}`;

interface AgyHookRuntime {
  engramId?: string;
  tmpEngramPath?: string;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildAgyHookCommand(runtime?: AgyHookRuntime): string {
  const env: string[] = [];
  if (runtime?.engramId) {
    env.push(`RELIC_ENGRAM_ID=${shellQuote(runtime.engramId)}`);
  }
  if (runtime?.tmpEngramPath) {
    env.push(`RELIC_AGY_TMP_ENGRAM_PATH=${shellQuote(runtime.tmpEngramPath)}`);
  }
  return env.length > 0
    ? `env ${env.join(" ")} ${RELIC_HOOK_BASE_COMMAND}`
    : RELIC_HOOK_BASE_COMMAND;
}

/**
 * Stop hook スクリプトの内容。
 * Antigravity CLI の各ターン(execution loop)終了後に発火し、会話ログを Engram archive に追記する。
 * 対象 Engram ID は hook command に埋め込んだ RELIC_ENGRAM_ID 環境変数で受け取る。
 */
const HOOK_SCRIPT = `#!/usr/bin/env node
const { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { homedir } = require("node:os");

function extractUserRequest(content) {
  const match = content.match(/<USER_REQUEST>\\n?([\\s\\S]*?)\\n?<\\/USER_REQUEST>/);
  return (match ? match[1] : content).trim();
}

let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    
    // Stop event needs to return JSON to stdout.
    const exitWithOk = () => {
      console.log(JSON.stringify({}));
      process.exit(0);
    };

    // Reliable cleanup: immediately delete the temp engram file using absolute path from env.
    const tmpEngramPath = process.env.RELIC_AGY_TMP_ENGRAM_PATH;
    if (tmpEngramPath) {
      try {
        if (existsSync(tmpEngramPath)) unlinkSync(tmpEngramPath);
      } catch {
        // silently ignore cleanup errors
      }
    }

    // Some Antigravity builds do not report terminationReason consistently.
    // Stop is already the final-loop hook; only skip explicitly non-idle events.
    if (input.fullyIdle === false) {
      exitWithOk();
    }

    const engramId = process.env.RELIC_ENGRAM_ID;
    if (!engramId) exitWithOk();

    let prompt = "";
    let response = "";

    // Parse transcript.jsonl
    const transcriptPath = input.transcriptPath || input.transcript_path;
    if (transcriptPath && existsSync(transcriptPath)) {
      const lines = readFileSync(transcriptPath, "utf-8").split("\\n").filter(Boolean);
      let lastUserIndex = -1;
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === "USER_INPUT" && entry.status === "DONE") {
             lastUserIndex = entry.step_index;
             prompt = extractUserRequest(entry.content || "");
             response = ""; // reset response for the new turn
          }
          if (
            entry.type === "PLANNER_RESPONSE" &&
            entry.status === "DONE" &&
            entry.content &&
            entry.step_index >= lastUserIndex
          ) {
             response += (response ? "\\n\\n" : "") + entry.content;
          }
        } catch {}
      }
    }

    prompt = prompt.trim();
    response = response.trim();

    // Prevent logging the initial automated persona injection
    if (prompt.includes("[SYSTEM CONFIGURATION] Read your core persona")) {
      prompt = "";
      response = "";
    }

    if (prompt || response) {
      const archivePath = join(homedir(), ".relic", "engrams", engramId, "archive.md");
      mkdirSync(dirname(archivePath), { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const summary = prompt.slice(0, 80).replace(/\\n/g, " ");
      const entry = \`\\n---\\n\${date} | \${summary}\\n\${response}\\n\`;
      const existing = existsSync(archivePath) ? readFileSync(archivePath, "utf-8") : "";
      if (!existing.endsWith(entry)) {
        appendFileSync(archivePath, entry, "utf-8");
      }
    }

    exitWithOk();
  } catch (err) {
    console.log(JSON.stringify({}));
    process.exit(0);
  }
});
`;

export function writeAgyHookScript(): void {
  mkdirSync(HOOKS_DIR, { recursive: true });
  writeFileSync(AGY_HOOK_SCRIPT_PATH, HOOK_SCRIPT, { encoding: "utf-8", mode: 0o755 });
}

export function setupAgyHook(runtime?: AgyHookRuntime): void {
  const agyDir = join(homedir(), ".gemini", "antigravity-cli");
  const agyConfigDir = join(homedir(), ".gemini", "config");
  mkdirSync(agyDir, { recursive: true });
  mkdirSync(agyConfigDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(AGY_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(AGY_SETTINGS_PATH, "utf-8"));
    } catch {
      settings = {};
    }
  }

  // Remove the old experimental location. Antigravity hooks are loaded from
  // hooks.json, while settings.json remains the MCP configuration file.
  const legacyHooks = (settings.hooks ?? {}) as Record<string, unknown>;
  if (legacyHooks[RELIC_HOOK_NAME]) {
    delete legacyHooks[RELIC_HOOK_NAME];
    if (Object.keys(legacyHooks).length === 0) {
      delete settings.hooks;
    } else {
      settings.hooks = legacyHooks;
    }
  }

  let hooksConfig: Record<string, unknown> = {};
  if (existsSync(AGY_HOOKS_PATH)) {
    try {
      hooksConfig = JSON.parse(readFileSync(AGY_HOOKS_PATH, "utf-8"));
    } catch {
      hooksConfig = {};
    }
  }

  hooksConfig[RELIC_HOOK_NAME] = {
    Stop: [
      {
        type: "command",
        command: buildAgyHookCommand(runtime),
        timeout: 5,
      },
    ],
  };

  // 自動で mcpServers に relic-mcp を追加する
  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  if (!mcpServers["relic"]) {
    mcpServers["relic"] = {
      command: "relic-mcp",
      trust: true
    };
    settings.mcpServers = mcpServers;
  }

  writeFileSync(AGY_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  writeFileSync(AGY_HOOKS_PATH, JSON.stringify(hooksConfig, null, 2), "utf-8");
}

export function isAgyHookSetup(): boolean {
  if (!existsSync(AGY_HOOK_SCRIPT_PATH)) return false;
  if (!existsSync(AGY_SETTINGS_PATH)) return false;
  if (!existsSync(AGY_HOOKS_PATH)) return false;
  try {
    const settings = JSON.parse(readFileSync(AGY_SETTINGS_PATH, "utf-8"));
    const hooksConfig = JSON.parse(readFileSync(AGY_HOOKS_PATH, "utf-8"));

    const relicHook = hooksConfig[RELIC_HOOK_NAME] as { Stop?: Array<{ command?: string }> } | undefined;
    const hasHook = Array.isArray(relicHook?.Stop) &&
      relicHook.Stop.some((hook) => typeof hook.command === "string" && hook.command.includes(AGY_HOOK_SCRIPT_PATH));
    
    // MCPサーバーの確認
    const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
    const hasMcp = !!mcpServers["relic"];
    
    return hasHook && hasMcp;
  } catch {
    return false;
  }
}
