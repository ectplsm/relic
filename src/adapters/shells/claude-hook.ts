import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const CLAUDE_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "claude-stop.js");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const RELIC_HOOK_COMMAND = `node ${join(HOOKS_DIR, "claude-stop.js")}`;

/**
 * Stop hook スクリプトの内容。
 * Claude Code の各ターン終了後に発火し、会話ログを Engram archive に追記する。
 * RELIC_ENGRAM_ID 環境変数で対象 Engram ID を受け取る。
 * stdin には { session_id, transcript_path, cwd, hook_event_name } が渡される。
 */
const HOOK_SCRIPT = `#!/usr/bin/env node
// Relic Stop hook for Claude Code
// Automatically logs each conversation turn to the Engram archive.
// Receives Stop hook JSON on stdin.
const { appendFileSync, existsSync, mkdirSync, readFileSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { homedir } = require("node:os");

let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  // transcript への書き込みが完了するのを待つ
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  try {
    const input = JSON.parse(raw);
    const engramId = process.env.RELIC_ENGRAM_ID;
    if (!engramId) process.exit(0);

    const transcriptPath = input.transcript_path;
    if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

    const archivePath = join(homedir(), ".relic", "engrams", engramId, "archive.md");
    mkdirSync(dirname(archivePath), { recursive: true });

    // transcript.jsonl を読んで最後のユーザー入力とアシスタント応答を取り出す
    const lines = readFileSync(transcriptPath, "utf-8")
      .split("\\n")
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    // 最後のアシスタントテキスト応答のインデックスを探す
    let lastAssistantIdx = -1;
    let lastResponse = "";
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = lines[i];
      const msg = entry.message;
      if (msg && msg.role === "assistant" && Array.isArray(msg.content)) {
        const texts = msg.content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text.trim());
        if (texts.length > 0) {
          lastResponse = texts.join("\\n").trim();
          lastAssistantIdx = i;
          break;
        }
      }
    }

    // そのアシスタント応答より前にある最後のユーザーtextメッセージを取得
    let lastPrompt = "";
    const searchEnd = lastAssistantIdx >= 0 ? lastAssistantIdx : lines.length;
    for (let i = searchEnd - 1; i >= 0; i--) {
      const entry = lines[i];
      const msg = entry.message;
      if (msg && msg.role === "user") {
        const content = msg.content;
        if (typeof content === "string" && content.trim()) {
          lastPrompt = content.trim();
          break;
        }
        if (Array.isArray(content)) {
          const texts = content
            .filter((c) => c.type === "text" && c.text)
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
    appendFileSync(archivePath, entry, "utf-8");
  } catch {
    // silently ignore
  }
  process.exit(0);
});
`;

/**
 * フックスクリプトを最新の内容で書き出す。
 * 毎回呼ばれ、ソース変更がデプロイされることを保証する。
 */
export function writeClaudeHookScript(): void {
  mkdirSync(HOOKS_DIR, { recursive: true });
  writeFileSync(CLAUDE_HOOK_SCRIPT_PATH, HOOK_SCRIPT, { encoding: "utf-8", mode: 0o755 });
}

/**
 * Claude Code の Stop フックを settings.json に登録する。
 * 既にセットアップ済みの場合はスキップ。
 */
export function setupClaudeHook(): void {
  // ~/.claude/settings.json に Stop フックを登録
  const claudeDir = join(homedir(), ".claude");
  mkdirSync(claudeDir, { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf-8"));
    } catch {
      settings = {};
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
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
          timeout: 5000,
        },
      ],
    },
  ];
  settings.hooks = hooks;
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Stop フックがセットアップ済みか確認する。
 */
export function isClaudeHookSetup(): boolean {
  if (!existsSync(CLAUDE_HOOK_SCRIPT_PATH)) return false;
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;
  try {
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf-8"));
    const stopHooks: Array<{ hooks?: Array<{ command?: string }> }> =
      settings.hooks?.Stop ?? [];
    return stopHooks.some((group) =>
      group.hooks?.some((h) => h.command === RELIC_HOOK_COMMAND)
    );
  } catch {
    return false;
  }
}
