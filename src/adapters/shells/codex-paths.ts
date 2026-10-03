import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const DEFAULT_CODEX_HOME = join(homedir(), ".codex");

/**
 * Codex の state root を解決する。
 *
 * CODEX_HOME が未設定または空文字の場合は ~/.codex を使う。
 * 相対パスは、実際に Codex を起動する作業ディレクトリを基準に解決する。
 */
export function resolveCodexHome(cwd = process.cwd()): string {
  const configuredHome = process.env.CODEX_HOME;
  if (!configuredHome) return DEFAULT_CODEX_HOME;

  return isAbsolute(configuredHome)
    ? resolve(configuredHome)
    : resolve(cwd, configuredHome);
}

/**
 * Codex の user-level hooks.json の絶対パスを返す。
 */
export function resolveCodexHooksPath(cwd = process.cwd()): string {
  return join(resolveCodexHome(cwd), "hooks.json");
}
