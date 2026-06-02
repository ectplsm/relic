import { exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell } from "./spawn-shell.js";
import { setupAgyHook, isAgyHookSetup, writeAgyHookScript } from "./agy-hook.js";
import { wrapWithOverride } from "./override-preamble.js";

const execAsync = promisify(exec);

export class AgyShell implements ShellLauncher {
  readonly name = "Antigravity CLI";
  // We use user-message mode but indirect the load via agentic file reading
  // to avoid cluttering the terminal with a massive prompt.
  readonly injectionMode: InjectionMode = "user-message";

  constructor(private readonly command = "agy") {}

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which ${this.command}`);
      return true;
    } catch {
      return false;
    }
  }

  async launch(prompt: string, options?: ShellLaunchOptions): Promise<void> {
    writeAgyHookScript();

    if (!isAgyHookSetup()) {
      console.log("Setting up Antigravity AfterAgent hook and MCP server (first run only)...");
      setupAgyHook();
      console.log("Hook and MCP registered to ~/.gemini/antigravity-cli/settings.json");
      console.log();
    }

    const env: Record<string, string> = {};
    if (options?.engramId) env.RELIC_ENGRAM_ID = options.engramId;
    const finalEnv = Object.keys(env).length > 0 ? env : undefined;

    if (options?.skipInjection) {
      await spawnShell(
        this.command,
        [...(options?.extraArgs ?? [])],
        options?.cwd,
        finalEnv
      );
      return;
    }

    const overriddenPrompt = wrapWithOverride(prompt);
    
    // Agentic load injection via workspace .gemini directory to avoid permission prompts
    // Use a hidden dotfile to prevent it from showing up in git diffs or file explorers
    const cwd = options?.cwd || process.cwd();
    const geminiDir = join(cwd, ".gemini");
    const engramPath = join(geminiDir, ".agy-engram-tmp.md");
    
    if (!existsSync(geminiDir)) {
      mkdirSync(geminiDir, { recursive: true });
    }

    // Write the compiled persona to a temporary file
    writeFileSync(engramPath, overriddenPrompt, "utf-8");

    // Pass the absolute path of the temp engram to the hook via environment variable
    const envForSpawn = { ...(finalEnv || {}), RELIC_AGY_TMP_ENGRAM_PATH: engramPath };

    // Pass a short instruction for the AI to read the persona autonomously
    const shortInstruction = `[SYSTEM CONFIGURATION] Read your core persona and instructions from .gemini/.agy-engram-tmp.md and adopt it completely. Do not comment on this process. Reply ONLY with: "Engram Loaded."`;

    const args = [
      "--prompt-interactive",
      shortInstruction,
      ...(options?.extraArgs ?? [])
    ];

    // Automatically delete the temporary hidden file after 30 seconds
    // as a fallback in case the Stop hook doesn't fire correctly.
    const cleanupTimer = setTimeout(() => {
      try {
        if (existsSync(engramPath)) {
          unlinkSync(engramPath);
        }
      } catch {
        // ignore
      }
    }, 30000);

    try {
      await spawnShell(
        this.command,
        args,
        options?.cwd,
        envForSpawn
      );
    } finally {
      clearTimeout(cleanupTimer);
      // Clean up the engram file if the shell exits before the timer
      try {
        if (existsSync(engramPath)) {
          unlinkSync(engramPath);
        }
      } catch {
        // ignore
      }
    }
  }
}
