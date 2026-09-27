import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolveCodexHome, resolveCodexHooksPath } from "./codex-home.js";

const RELIC_DIR = join(homedir(), ".relic");
const HOOKS_DIR = join(RELIC_DIR, "hooks");
export const CODEX_HOOK_SCRIPT_PATH = join(HOOKS_DIR, "codex-stop.js");
const RELIC_HOOK_COMMAND = `node ${join(HOOKS_DIR, "codex-stop.js")}`;

/**
 * Stop hook スクリプトの内容。
 * Codex CLI の各ターン終了後に発火し、会話ログを Engram archive に追記する。
 * developer instructions内のroute markerから対象archiveを解決する。
 * stdin には { last_assistant_message, transcript_path, session_id, ... } が渡される。
 * Claude の Stop hook と異なり last_assistant_message が直接取得できるため wait 不要。
 */
export const CODEX_HOOK_SCRIPT = `#!/usr/bin/env node
// Relic Stop hook for Codex CLI
// Automatically logs each conversation turn to the Engram archive.
// Receives Stop hook JSON on stdin.
const { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join, dirname, isAbsolute, resolve } = require("node:path");
const { homedir } = require("node:os");

const ROUTE_ID_PATTERN = /^[a-f0-9]{64}$/;
const ROUTE_MARKER_PATTERN = /<!-- relic-route:([a-f0-9]{64}) -->/g;
const ROUTES_DIR = join(homedir(), ".relic", "runtime", "codex", "routes");

function collectRouteIds(entry, routeIds) {
  const texts = [];
  if (entry?.type === "turn_context" && typeof entry.payload?.developer_instructions === "string") {
    texts.push(entry.payload.developer_instructions);
  }

  const payload = entry?.payload;
  if (entry?.type === "response_item" && payload?.type === "message" && payload.role === "developer") {
    if (typeof payload.content === "string") texts.push(payload.content);
    if (Array.isArray(payload.content)) {
      for (const item of payload.content) {
        if (typeof item === "string") texts.push(item);
        else if (item && typeof item.text === "string") texts.push(item.text);
      }
    }
  }

  for (const text of texts) {
    for (const match of text.matchAll(ROUTE_MARKER_PATTERN)) routeIds.add(match[1]);
  }
}

function readRoute(routeId) {
  if (!ROUTE_ID_PATTERN.test(routeId)) return null;
  const routePath = join(ROUTES_DIR, routeId + ".json");

  try {
    const stat = lstatSync(routePath);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) return null;

    const route = JSON.parse(readFileSync(routePath, "utf-8"));
    if (!route || typeof route !== "object" || Array.isArray(route)) return null;
    if (Object.keys(route).sort().join(",") !== "archivePath,engramId,version") return null;
    if (route.version !== 1) return null;
    if (typeof route.engramId !== "string" || !route.engramId || route.engramId.includes("\\0")) return null;
    if (typeof route.archivePath !== "string" || !isAbsolute(route.archivePath)) return null;
    if (resolve(route.archivePath) !== route.archivePath) return null;

    const canonical = JSON.stringify([route.version, route.engramId, route.archivePath]);
    const expectedId = createHash("sha256").update(canonical).digest("hex");
    return expectedId === routeId ? route : null;
  } catch {
    return null;
  }
}

let raw = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);

    // Codex Stop hook は last_assistant_message を直接提供する
    const lastResponse = (input.last_assistant_message || "").trim();

    // transcript からroute markerと最後のユーザー入力を取得
    // Codex transcript format:
    //   { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "..." }] } }
    // <environment_context> で始まるエントリはシステム注入なのでスキップする
    let lastPrompt = "";
    const routeIds = new Set();
    const transcriptPath = input.transcript_path;
    if (transcriptPath && existsSync(transcriptPath)) {
      const lines = readFileSync(transcriptPath, "utf-8")
        .split("\\n")
        .filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);

      for (const entry of lines) collectRouteIds(entry, routeIds);

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

    // marker欠落・複数route・route改ざん時は何も書かない。
    if (routeIds.size !== 1) process.exit(0);
    const route = readRoute([...routeIds][0]);
    if (!route) process.exit(0);

    if (!lastPrompt && !lastResponse) process.exit(0);

    const archivePath = route.archivePath;
    mkdirSync(dirname(archivePath), { recursive: true });
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
export function writeCodexHookScript(): void {
  mkdirSync(HOOKS_DIR, { recursive: true });
  writeFileSync(CODEX_HOOK_SCRIPT_PATH, CODEX_HOOK_SCRIPT, { encoding: "utf-8", mode: 0o755 });
}

/**
 * Codex CLI の Stop フックを settings.json に登録する。
 * 既にセットアップ済みの場合はスキップ。
 */
export function setupCodexHook(): void {
  const codexDir = resolveCodexHome();
  const codexHooksPath = resolveCodexHooksPath();
  mkdirSync(codexDir, { recursive: true });

  let hooksConfig: Record<string, unknown> = {};
  if (existsSync(codexHooksPath)) {
    try {
      hooksConfig = JSON.parse(readFileSync(codexHooksPath, "utf-8"));
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
  writeFileSync(codexHooksPath, JSON.stringify(hooksConfig, null, 2), "utf-8");
}

/**
 * Stop フックがセットアップ済みか確認する。
 */
export function isCodexHookSetup(): boolean {
  const codexHooksPath = resolveCodexHooksPath();
  if (!existsSync(CODEX_HOOK_SCRIPT_PATH)) return false;
  if (!existsSync(codexHooksPath)) return false;
  try {
    const hooksConfig = JSON.parse(readFileSync(codexHooksPath, "utf-8"));
    const stopHooks: Array<{ hooks?: Array<{ command?: string }> }> =
      hooksConfig.hooks?.Stop ?? [];
    return stopHooks.some((group) =>
      group.hooks?.some((h) => h.command === RELIC_HOOK_COMMAND)
    );
  } catch {
    return false;
  }
}
