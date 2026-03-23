import { exec } from "node:child_process";
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
 * inboxへの書き込みはMCPサーバー(relic_inbox_write)が担う。
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
    const args: string[] = [
      ...(options?.extraArgs ?? []),
      wrapWithOverride(prompt),
    ];
    await spawnShell(this.command, args, options?.cwd);
  }
}
