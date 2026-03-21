import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import type { ShellLauncher, InjectionMode } from "../../core/ports/shell-launcher.js";
import { spawnShell, writeTempPrompt } from "./spawn-shell.js";
import { wrapWithOverride } from "./override-preamble.js";

const execAsync = promisify(exec);

/**
 * GitHub Copilot CLI アダプター (copilot コマンド)
 * --interactive フラグでEngramを初回プロンプトとして注入し、
 * インタラクティブモードを継続する。
 */
export class CopilotShell implements ShellLauncher {
  readonly name = "GitHub Copilot CLI";
  readonly injectionMode: InjectionMode = "user-message";

  constructor(private readonly command = "copilot") {}

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which ${this.command}`);
      return true;
    } catch {
      return false;
    }
  }

  async launch(prompt: string, extraArgs: string[] = [], cwd?: string): Promise<void> {
    const tmp = writeTempPrompt(wrapWithOverride(prompt));

    try {
      const fileContent = readFileSync(tmp.path, "utf-8");
      const args = [
        "--interactive",
        fileContent,
        ...extraArgs,
      ];
      await spawnShell(this.command, args, cwd);
    } finally {
      tmp.cleanup();
    }
  }
}
