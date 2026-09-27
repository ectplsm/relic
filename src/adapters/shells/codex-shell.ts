import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell } from "./spawn-shell.js";
import { wrapWithOverride } from "./override-preamble.js";
import { setupCodexHook, isCodexHookSetup, writeCodexHookScript } from "./codex-hook.js";
import { resolveCodexHome, resolveCodexHooksPath } from "./codex-home.js";
import { createCodexRuntimeProfile } from "./codex-profile.js";
import { createCodexRoute, formatCodexRouteMarker } from "./codex-route.js";

const execAsync = promisify(exec);

/**
 * Codex CLI アダプター
 * 一時profileの developer_instructions でEngramをdeveloperロールとして注入する。
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
    if (!options) {
      throw new Error("Codex launch options are required.");
    }
    const injection = resolveCodexInjection(options);

    // フックスクリプトを毎回最新に更新
    writeCodexHookScript();

    // hooks.json への登録は初回のみ
    if (!isCodexHookSetup()) {
      console.log("Setting up Codex CLI Stop hook (first run only)...");
      setupCodexHook();
      console.log(`Hook registered to ${resolveCodexHooksPath()}`);
      console.log();
    }

    const codexHome = resolveCodexHome();
    const env = { CODEX_HOME: codexHome };

    // resume/fork は保存済みdeveloper instructionsを使い、再注入しない。
    if (!injection) {
      const args = [
        ...(options.extraArgs ?? []),
        ...(options.selectedProfile ? ["--profile", options.selectedProfile] : []),
      ];
      await spawnShell(this.command, args, options.cwd, env);
      return;
    }

    const route = createCodexRoute(injection.engramId, injection.archivePath);
    const developerInstructions = [
      formatCodexRouteMarker(route.id),
      wrapWithOverride(prompt),
    ].join("\n\n");
    const runtimeProfile = createCodexRuntimeProfile({
      codexHome,
      selectedProfile: options.selectedProfile,
      developerInstructions,
    });

    try {
      await spawnShell(
        this.command,
        ["--profile", runtimeProfile.name, ...(options.extraArgs ?? [])],
        options.cwd,
        env,
      );
    } finally {
      runtimeProfile.cleanup();
    }
  }
}

function resolveCodexInjection(
  options: ShellLaunchOptions,
): { engramId: string; archivePath: string } | undefined {
  if (options.skipInjection) return undefined;
  if (!options.engramId || !options.archivePath) {
    throw new Error("Codex launch requires an Engram ID and archive path.");
  }
  return { engramId: options.engramId, archivePath: options.archivePath };
}
