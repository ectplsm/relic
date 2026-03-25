import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell } from "./spawn-shell.js";
import { setupClaudeHook, isClaudeHookSetup } from "./claude-hook.js";

const execAsync = promisify(exec);

/**
 * Claude Code CLI アダプター
 * --system-prompt フラグでEngramを直接注入する。
 *
 * 初回起動時に Stop フックを ~/.claude/settings.json に登録し、
 * 各ターン終了後に会話ログを Engram inbox に自動記録する。
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

  async launch(prompt: string, options?: ShellLaunchOptions): Promise<void> {
    // Stop フックを初回のみセットアップ
    if (!isClaudeHookSetup()) {
      console.log("Setting up Claude Code Stop hook (first run only)...");
      setupClaudeHook();
      console.log("Hook registered to ~/.claude/settings.json");
      console.log();
    }

    const args = [
      "--system-prompt",
      prompt,
      ...(options?.extraArgs ?? []),
    ];

    const env: Record<string, string> = {};
    if (options?.engramId) env.RELIC_ENGRAM_ID = options.engramId;

    await spawnShell(this.command, args, options?.cwd, Object.keys(env).length > 0 ? env : undefined);
  }
}
