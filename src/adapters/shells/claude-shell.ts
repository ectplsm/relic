import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ShellLauncher, InjectionMode } from "../../core/ports/shell-launcher.js";
import { spawnShell } from "./spawn-shell.js";

const execAsync = promisify(exec);

/**
 * Claude Code CLI アダプター
 * --system-prompt フラグでEngramを直接注入する。
 */
export class ClaudeShell implements ShellLauncher {
  readonly name = "Claude Code";
  readonly injectionMode: InjectionMode = "system-prompt";

  constructor(private readonly command = "claude") {}

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which ${this.command}`);
      return true;
    } catch {
      return false;
    }
  }

  async launch(prompt: string, extraArgs: string[] = [], cwd?: string): Promise<void> {
    const args = [
      "--system-prompt",
      prompt,
      ...extraArgs,
    ];
    await spawnShell(this.command, args, cwd);
  }
}
