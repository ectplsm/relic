import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const GEMINI_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "gemini-after-agent.js");
const GEMINI_SETTINGS_PATH = join(homedir(), ".gemini", "settings.json");
const RELIC_HOOK_NAME = "relic-inbox-log";

/**
 * AfterAgent hook スクリプトの内容。
 * Gemini CLI の各ターン終了後に発火し、会話ログを Engram inbox に追記する。
 * RELIC_ENGRAM_ID 環境変数で対象 Engram ID を受け取る。
 */
const HOOK_SCRIPT = `#!/usr/bin/env node
// Relic AfterAgent hook for Gemini CLI
// Automatically logs each conversation turn to the Engram inbox.
// Receives AfterAgentInput JSON on stdin.
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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

    const inboxPath = join(homedir(), ".relic", "engrams", engramId, "inbox.md");
    if (!existsSync(inboxPath)) process.exit(0);

    const date = new Date().toISOString().split("T")[0];
    const summary = prompt.slice(0, 80).replace(/\\n/g, " ");
    const entry = \`\\n---\\n\${date} | \${summary}\\n\${response}\\n\`;
    appendFileSync(inboxPath, entry, "utf-8");
  } catch {
    // silently ignore
  }
  process.exit(0);
});
`;

/**
 * Gemini CLI の AfterAgent フックをセットアップする。
 * - ~/.relic/hooks/gemini-after-agent.js を生成
 * - ~/.gemini/settings.json に AfterAgent フックを登録
 * 既にセットアップ済みの場合はスキップ。
 */
export function setupGeminiHook(): void {
  // 1. フックスクリプトを生成
  mkdirSync(HOOKS_DIR, { recursive: true });
  writeFileSync(GEMINI_HOOK_SCRIPT_PATH, HOOK_SCRIPT, { encoding: "utf-8", mode: 0o755 });

  // 2. ~/.gemini/settings.json にフックを登録
  const geminiDir = join(homedir(), ".gemini");
  mkdirSync(geminiDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(GEMINI_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(GEMINI_SETTINGS_PATH, "utf-8"));
    } catch {
      settings = {};
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const afterAgentHooks = (hooks.AfterAgent ?? []) as Array<{ hooks: Array<{ name?: string }> }>;

  // 既に登録済みならスキップ
  const alreadyRegistered = afterAgentHooks.some((group) =>
    group.hooks?.some((h) => h.name === RELIC_HOOK_NAME)
  );
  if (alreadyRegistered) return;

  hooks.AfterAgent = [
    ...afterAgentHooks,
    {
      hooks: [
        {
          type: "command",
          command: `node ${GEMINI_HOOK_SCRIPT_PATH}`,
          name: RELIC_HOOK_NAME,
          timeout: 5000,
        },
      ],
    },
  ];
  settings.hooks = hooks;
  writeFileSync(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * AfterAgent フックがセットアップ済みか確認する。
 */
export function isGeminiHookSetup(): boolean {
  if (!existsSync(GEMINI_HOOK_SCRIPT_PATH)) return false;
  if (!existsSync(GEMINI_SETTINGS_PATH)) return false;
  try {
    const settings = JSON.parse(readFileSync(GEMINI_SETTINGS_PATH, "utf-8"));
    const afterAgentHooks: Array<{ hooks?: Array<{ name?: string }> }> =
      settings.hooks?.AfterAgent ?? [];
    return afterAgentHooks.some((group) =>
      group.hooks?.some((h) => h.name === RELIC_HOOK_NAME)
    );
  } catch {
    return false;
  }
}
