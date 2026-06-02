import { spawn } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell, writeTempPrompt } from "./spawn-shell.js";
import { setupAgyHook, isAgyHookSetup, writeAgyHookScript } from "./agy-hook.js";

const execAsync = promisify(exec);

const RELIC_DIR = join(homedir(), ".relic");
const AGY_DEFAULT_CACHE = join(RELIC_DIR, "agy-system-default.md");

const RELIC_ENGRAM_START = "<!-- RELIC ENGRAM START -->";
const RELIC_ENGRAM_END = "<!-- RELIC ENGRAM END -->";

async function captureDefaultSystemPrompt(command: string, cwd = process.cwd()): Promise<string> {
  const geminiDir = join(cwd, ".gemini");
  mkdirSync(geminiDir, { recursive: true });

  await new Promise<void>((resolve) => {
    const child = spawn(command, [], {
      cwd,
      env: { ...process.env, GEMINI_WRITE_SYSTEM_MD: "true" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, 5000);

    child.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.on("error", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  const systemMdPath = join(geminiDir, "system.md");
  if (!existsSync(systemMdPath)) {
    throw new Error(
      "Failed to capture Antigravity default system prompt.\n" +
      `Run manually from ${cwd}: GEMINI_WRITE_SYSTEM_MD=true agy\n` +
      `Then copy ${systemMdPath} to ${AGY_DEFAULT_CACHE}`
    );
  }

  const content = readFileSync(systemMdPath, "utf-8");
  mkdirSync(RELIC_DIR, { recursive: true });
  writeFileSync(AGY_DEFAULT_CACHE, content, "utf-8");
  try {
    unlinkSync(systemMdPath);
  } catch {
    // Cache creation succeeded; cleanup failure should not block launch.
  }
  return content;
}

function composeSystemPrompt(defaultPrompt: string, engramPrompt: string): string {
  const engramSection = [
    RELIC_ENGRAM_START,
    engramPrompt,
    RELIC_ENGRAM_END,
  ].join("\n");

  if (defaultPrompt.includes(RELIC_ENGRAM_START)) {
    return defaultPrompt.replace(
      new RegExp(`${RELIC_ENGRAM_START}[\\s\\S]*?${RELIC_ENGRAM_END}`),
      engramSection
    );
  }

  return `${defaultPrompt}\n\n${engramSection}`;
}

export class AgyShell implements ShellLauncher {
  readonly name = "Antigravity CLI";
  readonly injectionMode: InjectionMode = "system-prompt";

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

    if (options?.skipInjection) {
      const env: Record<string, string> = {};
      if (options?.engramId) env.RELIC_ENGRAM_ID = options.engramId;
      await spawnShell(
        this.command,
        [...(options?.extraArgs ?? [])],
        options?.cwd,
        Object.keys(env).length > 0 ? env : undefined,
      );
      return;
    }

    let defaultPrompt: string;
    if (existsSync(AGY_DEFAULT_CACHE)) {
      defaultPrompt = readFileSync(AGY_DEFAULT_CACHE, "utf-8");
    } else {
      console.log("Capturing Antigravity default system prompt (first run only)...");
      defaultPrompt = await captureDefaultSystemPrompt(this.command, options?.cwd);
      console.log(`Cached to: ${AGY_DEFAULT_CACHE}`);
      console.log();
    }

    const combined = composeSystemPrompt(defaultPrompt, prompt);
    const tmp = writeTempPrompt(combined);

    try {
      // Assuming GEMINI_SYSTEM_MD still works for AGY
      const env: Record<string, string> = { GEMINI_SYSTEM_MD: tmp.path };
      if (options?.engramId) env.RELIC_ENGRAM_ID = options.engramId;
      await spawnShell(
        this.command,
        [...(options?.extraArgs ?? [])],
        options?.cwd,
        env
      );
    } finally {
      tmp.cleanup();
    }
  }
}
