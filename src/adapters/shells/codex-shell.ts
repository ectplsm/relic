import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell } from "./spawn-shell.js";
import { wrapWithOverride } from "./override-preamble.js";
import { setupCodexHook, isCodexHookSetup, writeCodexHookScript } from "./codex-hook.js";

const execAsync = promisify(exec);

/**
 * Codex CLI アダプター
 * `-c developer_instructions=<prompt>` でEngramをdeveloperロールとして注入する。
 * user-messageよりシステムプロンプトに近い強度で注入できる。
 *
 * 初回起動時に Stop フックを ~/.codex/hooks.json に登録し、
 * 各ターン終了後に会話ログを Engram archive に自動記録する。
 */
export class CodexShell implements ShellLauncher {
  readonly name = "Codex CLI";
  readonly injectionMode: InjectionMode = "developer-message";

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
    // フックスクリプトを毎回最新に更新
    writeCodexHookScript();

    // hooks.json への登録は初回のみ
    if (!isCodexHookSetup()) {
      console.log("Setting up Codex CLI Stop hook (first run only)...");
      setupCodexHook();
      console.log("Hook registered to ~/.codex/hooks.json");
      console.log();
    }

    const args: string[] = [
      "-c", `developer_instructions=${JSON.stringify(wrapWithOverride(prompt))}`,
      "-c", "features.codex_hooks=true",
      ...(options?.extraArgs ?? []),
    ];

    const env: Record<string, string> = {};
    if (options?.engramId) env.RELIC_ENGRAM_ID = options.engramId;

    await spawnShell(this.command, args, options?.cwd, Object.keys(env).length > 0 ? env : undefined);
  }
}
