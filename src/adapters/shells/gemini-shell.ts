import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell, writeTempPrompt } from "./spawn-shell.js";
import { wrapWithOverride } from "./override-preamble.js";

const execAsync = promisify(exec);

/**
 * Gemini CLI アダプター
 * プロンプトをtempファイルに書き出し、
 * --prompt-interactive で読み込んで注入する。
 */
export class GeminiShell implements ShellLauncher {
  readonly name = "Gemini CLI";
  readonly injectionMode: InjectionMode = "user-message";

  constructor(private readonly command = "gemini") {}

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which ${this.command}`);
      return true;
    } catch {
      return false;
    }
  }

  async launch(prompt: string, options?: ShellLaunchOptions): Promise<void> {
    const tmp = writeTempPrompt(wrapWithOverride(prompt));

    try {
      const fileContent = readFileSync(tmp.path, "utf-8");
      const args = [
        "--prompt-interactive",
        fileContent,
        ...(options?.extraArgs ?? []),
      ];
      await spawnShell(this.command, args, options?.cwd);
    } finally {
      tmp.cleanup();
    }
  }
}
