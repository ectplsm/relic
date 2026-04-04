/**
 * Resume Detection — Shell の extraArgs から resume 系操作を検出する
 *
 * resume 時は Engram injection をスキップし、Shell をそのまま起動する。
 * 各 CLI の resume 引数仕様:
 *   - Claude: --resume, -r, --continue, -c, --from-pr (options)
 *   - Codex:  resume, fork (subcommands)
 *   - Gemini: --resume, -r (options)
 *
 * 注意: Claude の -c は --continue の短縮。Codex の -c は --config の短縮。
 */

/** Claude Code の resume 系オプション */
const CLAUDE_RESUME_FLAGS = new Set([
  "--resume",
  "-r",
  "--continue",
  "-c",
  "--from-pr",
]);

/** Gemini CLI の resume 系オプション */
const GEMINI_RESUME_FLAGS = new Set([
  "--resume",
  "-r",
]);

/** Codex CLI の resume 系サブコマンド */
const CODEX_RESUME_SUBCOMMANDS = new Set([
  "resume",
  "fork",
]);

/**
 * extraArgs が resume 系の操作を含むかを判定する。
 *
 * @param shellName - Shell の表示名 ("Claude Code", "Codex CLI", "Gemini CLI")
 * @param extraArgs - Shell に渡される追加引数
 * @returns resume 系操作が検出された場合 true
 */
export function isResumeArgs(shellName: string, extraArgs: string[]): boolean {
  if (extraArgs.length === 0) return false;

  switch (shellName) {
    case "Claude Code":
      return extraArgs.some((arg) => CLAUDE_RESUME_FLAGS.has(arg));

    case "Codex CLI":
      // Codex は resume/fork がサブコマンド（先頭引数）
      return CODEX_RESUME_SUBCOMMANDS.has(extraArgs[0]);

    case "Gemini CLI":
      return extraArgs.some((arg) => GEMINI_RESUME_FLAGS.has(arg));

    default:
      return false;
  }
}
