import { isCodexResumeArgs } from "./codex-args.js";
import type { ShellKind } from "../../core/ports/shell-launcher.js";

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

/**
 * extraArgs が resume 系の操作を含むかを判定する。
 *
 * @param shellKind - Shell の安定した内部識別子
 * @param extraArgs - Shell に渡される追加引数
 * @returns resume 系操作が検出された場合 true
 */
export function isResumeArgs(shellKind: ShellKind, extraArgs: string[]): boolean {
  if (extraArgs.length === 0) return false;

  switch (shellKind) {
    case "claude":
      return extraArgs.some((arg) => CLAUDE_RESUME_FLAGS.has(arg));

    case "codex":
      return isCodexResumeArgs(extraArgs);

    case "gemini":
      return extraArgs.some((arg) => GEMINI_RESUME_FLAGS.has(arg));
  }
}
