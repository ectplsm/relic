import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const CODEX_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "codex-stop.js");
const CODEX_HOOKS_PATH = join(homedir(), ".codex", "hooks.json");
const RELIC_HOOK_COMMAND = `node ${join(HOOKS_DIR, "codex-stop.js")}`;

/**
 * Stop hook スクリプトの内容。
 * Codex CLI の各ターン終了後に発火し、会話ログを Engram inbox に追記する。
 * RELIC_ENGRAM_ID 環境変数で対象 Engram ID を受け取る。
 * stdin には { last_assistant_message, transcript_path, session_id, ... } が渡される。
 * Claude の Stop hook と異なり last_assistant_message が直接取得できるため wait 不要。
 */
const HOOK_SCRIPT = `#!/usr/bin/env node
// Relic Stop hook for Codex CLI
// Automatically logs each conversation turn to the Engram inbox.
// Receives Stop hook JSON on stdin.
const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");

let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const engramId = process.env.RELIC_ENGRAM_ID;
    if (!engramId) process.exit(0);

    const inboxPath = join(homedir(), ".relic", "engrams", engramId, "inbox.md");
    if (!existsSync(inboxPath)) process.exit(0);

    // Codex Stop hook は last_assistant_message を直接提供する
    const lastResponse = (input.last_assistant_message || "").trim();

    // transcript から最後のユーザー入力を取得
    // Codex transcript format:
    //   { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "..." }] } }
    // <environment_context> で始まるエントリはシステム注入なのでスキップする
    let lastPrompt = "";
    const transcriptPath = input.transcript_path;
    if (transcriptPath && existsSync(transcriptPath)) {
      const lines = readFileSync(transcriptPath, "utf-8")
        .split("\\n")
        .filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        const entry = lines[i];
        if (entry.type !== "response_item") continue;
        const p = entry.payload;
        if (!p || p.role !== "user" || p.type !== "message") continue;
        const content = p.content;
        if (Array.isArray(content)) {
          const texts = content
            .filter((c) => c.type === "input_text" && c.text && !c.text.trimStart().startsWith("<environment_context>"))
            .map((c) => c.text.trim());
          if (texts.length > 0) {
            lastPrompt = texts.join("\\n").trim();
            break;
          }
        }
      }
    }

    if (!lastPrompt && !lastResponse) process.exit(0);

    const date = new Date().toISOString().split("T")[0];
    const summary = lastPrompt.slice(0, 80).replace(/\\n/g, " ");
    const entry = \`\\n---\\n\${date} | \${summary}\\n\${lastResponse}\\n\`;
    appendFileSync(inboxPath, entry, "utf-8");
  } catch {
    // silently ignore
  }
  process.exit(0);
});
`;

/**
 * Codex CLI の Stop フックをセットアップする。
 * - ~/.relic/hooks/codex-stop.js を生成
 * - ~/.codex/hooks.json に Stop フックを登録
 * 既にセットアップ済みの場合はスキップ。
 */
export function setupCodexHook(): void {
  // 1. フックスクリプトを生成
  mkdirSync(HOOKS_DIR, { recursive: true });
  writeFileSync(CODEX_HOOK_SCRIPT_PATH, HOOK_SCRIPT, { encoding: "utf-8", mode: 0o755 });

  // 2. ~/.codex/hooks.json に Stop フックを登録
  const codexDir = join(homedir(), ".codex");
  mkdirSync(codexDir, { recursive: true });

  let hooksConfig: Record<string, unknown> = {};
  if (existsSync(CODEX_HOOKS_PATH)) {
    try {
      hooksConfig = JSON.parse(readFileSync(CODEX_HOOKS_PATH, "utf-8"));
    } catch {
      hooksConfig = {};
    }
  }

  const hooks = (hooksConfig.hooks ?? {}) as Record<string, unknown[]>;
  const stopHooks = (hooks.Stop ?? []) as Array<{ hooks: Array<{ command?: string }> }>;

  // 既に登録済みならスキップ
  const alreadyRegistered = stopHooks.some((group) =>
    group.hooks?.some((h) => h.command === RELIC_HOOK_COMMAND)
  );
  if (alreadyRegistered) return;

  hooks.Stop = [
    ...stopHooks,
    {
      hooks: [
        {
          type: "command",
          command: RELIC_HOOK_COMMAND,
          timeout: 5,
        },
      ],
    },
  ];
  hooksConfig.hooks = hooks;
  writeFileSync(CODEX_HOOKS_PATH, JSON.stringify(hooksConfig, null, 2), "utf-8");
}

/**
 * Stop フックがセットアップ済みか確認する。
 */
export function isCodexHookSetup(): boolean {
  if (!existsSync(CODEX_HOOK_SCRIPT_PATH)) return false;
  if (!existsSync(CODEX_HOOKS_PATH)) return false;
  try {
    const hooksConfig = JSON.parse(readFileSync(CODEX_HOOKS_PATH, "utf-8"));
    const stopHooks: Array<{ hooks?: Array<{ command?: string }> }> =
      hooksConfig.hooks?.Stop ?? [];
    return stopHooks.some((group) =>
      group.hooks?.some((h) => h.command === RELIC_HOOK_COMMAND)
    );
  } catch {
    return false;
  }
}
