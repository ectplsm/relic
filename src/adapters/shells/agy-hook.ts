import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const AGY_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "agy-stop.js");
const AGY_SETTINGS_PATH = join(homedir(), ".gemini", "antigravity-cli", "settings.json");
const RELIC_HOOK_NAME = "relic-archive-log";

/**
 * Stop hook スクリプトの内容。
 * Antigravity CLI の各ターン(execution loop)終了後に発火し、会話ログを Engram archive に追記する。
 * RELIC_ENGRAM_ID 環境変数で対象 Engram ID を受け取る。
 */
const HOOK_SCRIPT = `#!/usr/bin/env node
const { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { homedir } = require("node:os");

let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    
    // Stop event needs to return JSON to stdout
    const exitWithOk = () => {
      console.log(JSON.stringify({}));
      process.exit(0);
    };

    if (input.terminationReason !== "model_stop" || !input.fullyIdle) {
      exitWithOk();
    }

    // Reliable cleanup: immediately delete the temp engram file using absolute path from env
    const tmpEngramPath = process.env.RELIC_AGY_TMP_ENGRAM_PATH;
    if (tmpEngramPath) {
      try {
        if (existsSync(tmpEngramPath)) unlinkSync(tmpEngramPath);
      } catch {
        // silently ignore cleanup errors
      }
    }

    const engramId = process.env.RELIC_ENGRAM_ID;
    if (!engramId) exitWithOk();

    let prompt = "";
    let response = "";

    // Parse transcript.jsonl
    if (input.transcriptPath && existsSync(input.transcriptPath)) {
      const lines = readFileSync(input.transcriptPath, "utf-8").split("\\n").filter(Boolean);
      let lastUserIndex = -1;
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === "USER_INPUT") {
             lastUserIndex = entry.step_index;
             prompt = entry.content || "";
             response = ""; // reset response for the new turn
          }
          if (entry.type === "PLANNER_RESPONSE" && entry.content && entry.step_index >= lastUserIndex) {
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
      appendFileSync(archivePath, entry, "utf-8");
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

export function setupAgyHook(): void {
  const agyDir = join(homedir(), ".gemini", "antigravity-cli");
  mkdirSync(agyDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(AGY_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(AGY_SETTINGS_PATH, "utf-8"));
    } catch {
      settings = {};
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, any>;
  
  hooks[RELIC_HOOK_NAME] = {
    Stop: [
      {
        type: "command",
        command: `node ${AGY_HOOK_SCRIPT_PATH}`,
        timeout: 5000,
      },
    ],
  };
  
  settings.hooks = hooks;
  
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
}

export function isAgyHookSetup(): boolean {
  if (!existsSync(AGY_HOOK_SCRIPT_PATH)) return false;
  if (!existsSync(AGY_SETTINGS_PATH)) return false;
  try {
    const settings = JSON.parse(readFileSync(AGY_SETTINGS_PATH, "utf-8"));
    
    // フックの確認
    const hooks = (settings.hooks ?? {}) as Record<string, any>;
    const hasHook = Array.isArray(hooks[RELIC_HOOK_NAME]?.Stop) && hooks[RELIC_HOOK_NAME].Stop.length > 0;
    
    // MCPサーバーの確認
    const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
    const hasMcp = !!mcpServers["relic"];
    
    return hasHook && hasMcp;
  } catch {
    return false;
  }
}
