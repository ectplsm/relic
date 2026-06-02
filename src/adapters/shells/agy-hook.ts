import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const AGY_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "agy-after-agent.js");
const AGY_SETTINGS_PATH = join(homedir(), ".gemini", "antigravity-cli", "settings.json");
const RELIC_HOOK_NAME = "relic-archive-log";

/**
 * AfterAgent hook スクリプトの内容。
 * Antigravity CLI の各ターン終了後に発火し、会話ログを Engram archive に追記する。
 * RELIC_ENGRAM_ID 環境変数で対象 Engram ID を受け取る。
 */
const HOOK_SCRIPT = `#!/usr/bin/env node
// Relic AfterAgent hook for Antigravity CLI
// Automatically logs each conversation turn to the Engram archive.
// Receives AfterAgentInput JSON on stdin.
const { appendFileSync, existsSync, mkdirSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { homedir } = require("node:os");

let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const engramId = process.env.RELIC_ENGRAM_ID;
    if (!engramId) process.exit(0);

    const prompt = (input.prompt || "").trim();
    const response = (input.prompt_response || "").trim();
    if (!prompt && !response) process.exit(0);

    const archivePath = join(homedir(), ".relic", "engrams", engramId, "archive.md");
    mkdirSync(dirname(archivePath), { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const summary = prompt.slice(0, 80).replace(/\\n/g, " ");
    const entry = \`\\n---\\n\${date} | \${summary}\\n\${response}\\n\`;
    appendFileSync(archivePath, entry, "utf-8");
  } catch {
    // silently ignore
  }
  process.exit(0);
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

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const afterAgentHooks = (hooks.AfterAgent ?? []) as Array<{ hooks: Array<{ name?: string }> }>;

  const alreadyRegistered = afterAgentHooks.some((group) =>
    group.hooks?.some((h) => h.name === RELIC_HOOK_NAME)
  );
  
  if (!alreadyRegistered) {
    hooks.AfterAgent = [
      ...afterAgentHooks,
      {
        hooks: [
          {
            type: "command",
            command: `node ${AGY_HOOK_SCRIPT_PATH}`,
            name: RELIC_HOOK_NAME,
            timeout: 5000,
          },
        ],
      },
    ];
    settings.hooks = hooks;
  }
  
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
    const afterAgentHooks: Array<{ hooks?: Array<{ name?: string }> }> = settings.hooks?.AfterAgent ?? [];
    const hasHook = afterAgentHooks.some((group) =>
      group.hooks?.some((h) => h.name === RELIC_HOOK_NAME)
    );
    
    // MCPサーバーの確認
    const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
    const hasMcp = !!mcpServers["relic"];
    
    return hasHook && hasMcp;
  } catch {
    return false;
  }
}
