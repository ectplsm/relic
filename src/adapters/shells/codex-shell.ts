import { exec } from "node:child_process";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell } from "./spawn-shell.js";
import { wrapWithOverride } from "./override-preamble.js";

const execAsync = promisify(exec);

/**
 * Codex CLI アダプター
 * [PROMPT] 引数でEngramを初回メッセージとして注入し、
 * インタラクティブモードを継続する。
 *
 * inbox.md への書き込み許可は二段構え:
 *   1. `relic init` で ~/.codex/config.toml に永続登録（sandbox層）
 *   2. 起動時 --add-dir でセッション単位のツール承認をバイパス
 */
export class CodexShell implements ShellLauncher {
  readonly name = "Codex CLI";
  readonly injectionMode: InjectionMode = "user-message";

  constructor(private readonly command = "codex") {}

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which ${this.command}`);
      return true;
    } catch {
      return false;
    }
  }

  async launch(prompt: string, options?: ShellLaunchOptions): Promise<void> {
    const args: string[] = [];

    if (options?.inboxPath) {
      args.push("--add-dir", dirname(options.inboxPath));
    }

    args.push(...(options?.extraArgs ?? []), wrapWithOverride(prompt));
    await spawnShell(this.command, args, options?.cwd);
  }
}
