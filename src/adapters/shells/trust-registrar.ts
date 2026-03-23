import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

/**
 * TrustRegistrar — 各Shell CLIに ~/.relic/ ディレクトリの信頼設定を登録する
 *
 * `relic init` 時に一度だけ呼ばれ、以降のセッションで
 * inbox.md 等への書き込みが確認なしで通るようになる。
 *
 * 対応Shell:
 *   - Claude Code:  ~/.claude/settings.json    (sandbox.filesystem.allowWrite)
 *   - Codex CLI:    ~/.codex/config.toml       ([sandbox] writable_roots)
 *   - Gemini CLI:   ~/.gemini/trustedFolders.json (TRUST_FOLDER)
 */

interface TrustResult {
  /** 設定を追加したShell名の一覧 */
  registered: string[];
  /** 既に設定済みでスキップしたShell名の一覧 */
  skipped: string[];
}

export async function registerTrustedFolders(
  relicEngramsPath: string
): Promise<TrustResult> {
  const result: TrustResult = { registered: [], skipped: [] };

  await Promise.all([
    registerClaude(relicEngramsPath, result),
    registerCodex(relicEngramsPath, result),
registerGemini(relicEngramsPath, result),
  ]);

  return result;
}

// ---------------------------------------------------------------------------
// Claude Code — ~/.claude/settings.json
// { "sandbox": { "filesystem": { "allowWrite": ["~/.relic/engrams"] } } }
// ---------------------------------------------------------------------------
async function registerClaude(
  engramsPath: string,
  result: TrustResult
): Promise<void> {
  const claudeDir = join(homedir(), ".claude");
  const configPath = join(claudeDir, "settings.json");

  if (!existsSync(claudeDir)) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let settings: any = {};

    if (existsSync(configPath)) {
      const raw = await readFile(configPath, "utf-8");
      settings = JSON.parse(raw);
    }

    // sandbox.filesystem.allowWrite を確保
    settings.sandbox ??= {};
    settings.sandbox.filesystem ??= {};
    settings.sandbox.filesystem.allowWrite ??= [];

    const allowWrite: string[] = settings.sandbox.filesystem.allowWrite;

    // permissions.allow — ツール承認の自動化
    settings.permissions ??= {};
    settings.permissions.allow ??= [];

    const allow: string[] = settings.permissions.allow;
    const tildeForm = engramsPath.replace(homedir(), "~");

    // sandbox: allowWrite
    const sandboxNeeded = !allowWrite.includes(engramsPath) && !allowWrite.includes(tildeForm);
    if (sandboxNeeded) {
      allowWrite.push(tildeForm);
    }

    // permissions: Edit allow
    const editRule = `Edit(${tildeForm}/**)`;
    const permNeeded = !allow.includes(editRule);
    if (permNeeded) {
      allow.push(editRule);
    }

    if (!sandboxNeeded && !permNeeded) {
      result.skipped.push("Claude Code");
      return;
    }

    await writeFile(configPath, JSON.stringify(settings, null, 2), "utf-8");
    result.registered.push("Claude Code");
  } catch {
    // best effort
  }
}

// ---------------------------------------------------------------------------
// Codex CLI — ~/.codex/config.toml
// [sandbox]
// writable_roots = ["~/.relic/engrams"]
// ---------------------------------------------------------------------------
async function registerCodex(
  engramsPath: string,
  result: TrustResult
): Promise<void> {
  const codexDir = join(homedir(), ".codex");
  const configPath = join(codexDir, "config.toml");

  if (!existsSync(codexDir)) {
    return;
  }

  try {
    let content = "";
    if (existsSync(configPath)) {
      content = await readFile(configPath, "utf-8");
    }

    const tildeForm = engramsPath.replace(homedir(), "~");

    // 既に writable_roots に含まれているかチェック
    if (content.includes(engramsPath) || content.includes(tildeForm)) {
      result.skipped.push("Codex CLI");
      return;
    }

    // [sandbox] セクションが存在するか
    const sandboxMatch = content.match(/^\[sandbox\]\s*$/m);

    if (sandboxMatch) {
      // [sandbox] セクション内の writable_roots を探す
      const writableMatch = content.match(
        /^(writable_roots\s*=\s*\[)(.*?)(\])/m
      );

      if (writableMatch) {
        // 既存の writable_roots に追加
        const existing = writableMatch[2].trim();
        const newValue = existing
          ? `${existing}, "${tildeForm}"`
          : `"${tildeForm}"`;
        content = content.replace(
          /^(writable_roots\s*=\s*\[)(.*?)(\])/m,
          `$1${newValue}$3`
        );
      } else {
        // [sandbox] セクションに writable_roots を追加
        content = content.replace(
          /^\[sandbox\]\s*$/m,
          `[sandbox]\nwritable_roots = ["${tildeForm}"]`
        );
      }
    } else {
      // [sandbox] セクションごと追加
      content =
        content.trimEnd() + `\n\n[sandbox]\nwritable_roots = ["${tildeForm}"]\n`;
    }

    await writeFile(configPath, content, "utf-8");
    result.registered.push("Codex CLI");
  } catch {
    // best effort
  }
}

// ---------------------------------------------------------------------------
// Gemini CLI — ~/.gemini/trustedFolders.json
// { "/path/to/engrams": "TRUST_FOLDER" }
// ---------------------------------------------------------------------------
async function registerGemini(
  engramsPath: string,
  result: TrustResult
): Promise<void> {
  const configPath = join(homedir(), ".gemini", "trustedFolders.json");

  if (!existsSync(join(homedir(), ".gemini"))) {
    return;
  }

  try {
    let folders: Record<string, string> = {};

    if (existsSync(configPath)) {
      const raw = await readFile(configPath, "utf-8");
      folders = JSON.parse(raw);
    }

    if (folders[engramsPath]) {
      result.skipped.push("Gemini CLI");
      return;
    }

    folders[engramsPath] = "TRUST_FOLDER";
    await writeFile(configPath, JSON.stringify(folders, null, 2), "utf-8");
    result.registered.push("Gemini CLI");
  } catch {
    // best effort
  }
}
