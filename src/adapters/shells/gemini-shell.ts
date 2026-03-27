import { spawn } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import type { ShellLauncher, InjectionMode, ShellLaunchOptions } from "../../core/ports/shell-launcher.js";
import { spawnShell, writeTempPrompt } from "./spawn-shell.js";
import { setupGeminiHook, isGeminiHookSetup, writeGeminiHookScript } from "./gemini-hook.js";

const execAsync = promisify(exec);

const RELIC_DIR = join(homedir(), ".relic");
const GEMINI_DEFAULT_CACHE = join(RELIC_DIR, "gemini-system-default.md");

const RELIC_ENGRAM_START = "<!-- RELIC ENGRAM START -->";
const RELIC_ENGRAM_END = "<!-- RELIC ENGRAM END -->";

/**
 * GEMINI_WRITE_SYSTEM_MD=true で gemini を一時起動し、
 * 組み込みシステムプロンプトをキャプチャして返す。
 * キャプチャ結果は ~/.relic/gemini-system-default.md にキャッシュされる。
 */
async function captureDefaultSystemPrompt(command: string): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), "relic-gemini-capture-"));
  const geminiDir = join(tempDir, ".gemini");
  mkdirSync(geminiDir, { recursive: true });

  try {
    await new Promise<void>((resolve) => {
      const child = spawn(command, [], {
        cwd: tempDir,
        env: { ...process.env, GEMINI_WRITE_SYSTEM_MD: "true" },
        // stdin を /dev/null 相当にして TTY なしで起動
        stdio: ["ignore", "pipe", "pipe"],
      });

      // ファイル書き出し猶予として5秒後に強制終了
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
        "Failed to capture Gemini default system prompt.\n" +
        "Run manually: GEMINI_WRITE_SYSTEM_MD=true gemini\n" +
        `Then copy .gemini/system.md to ${GEMINI_DEFAULT_CACHE}`
      );
    }

    const content = readFileSync(systemMdPath, "utf-8");
    mkdirSync(RELIC_DIR, { recursive: true });
    writeFileSync(GEMINI_DEFAULT_CACHE, content, "utf-8");
    return content;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * デフォルトプロンプトにEngramセクションを追記 or 置換する（冪等）。
 * <!-- RELIC ENGRAM START/END --> デリミタで管理する。
 */
function composeSystemPrompt(defaultPrompt: string, engramPrompt: string): string {
  const engramSection = [
    RELIC_ENGRAM_START,
    engramPrompt,
    RELIC_ENGRAM_END,
  ].join("\n");

  if (defaultPrompt.includes(RELIC_ENGRAM_START)) {
    // 既存のRELICセクションを置換
    return defaultPrompt.replace(
      new RegExp(`${RELIC_ENGRAM_START}[\\s\\S]*?${RELIC_ENGRAM_END}`),
      engramSection
    );
  }

  // 末尾に追記
  return `${defaultPrompt}\n\n${engramSection}`;
}

/**
 * Gemini CLI アダプター
 * GEMINI_SYSTEM_MD 環境変数でシステムプロンプトを完全上書きし、
 * Engramを組み込みプロンプトと合成して注入する。
 *
 * 初回起動時のみ GEMINI_WRITE_SYSTEM_MD でデフォルトプロンプトをキャプチャ・キャッシュする。
 */
export class GeminiShell implements ShellLauncher {
  readonly name = "Gemini CLI";
  readonly injectionMode: InjectionMode = "system-prompt";

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
    // 1. フックスクリプトを毎回最新に更新
    writeGeminiHookScript();

    // settings.json への登録は初回のみ
    if (!isGeminiHookSetup()) {
      console.log("Setting up Gemini AfterAgent hook (first run only)...");
      setupGeminiHook();
      console.log("Hook registered to ~/.gemini/settings.json");
      console.log();
    }

    // 2. デフォルトシステムプロンプトをキャッシュから読む、なければキャプチャ
    let defaultPrompt: string;
    if (existsSync(GEMINI_DEFAULT_CACHE)) {
      defaultPrompt = readFileSync(GEMINI_DEFAULT_CACHE, "utf-8");
    } else {
      console.log("Capturing Gemini default system prompt (first run only)...");
      defaultPrompt = await captureDefaultSystemPrompt(this.command);
      console.log(`Cached to: ${GEMINI_DEFAULT_CACHE}`);
      console.log();
    }

    // 3. デフォルト + Engram を合成してtempファイルに書き出す
    const combined = composeSystemPrompt(defaultPrompt, prompt);
    const tmp = writeTempPrompt(combined);

    try {
      // 4. GEMINI_SYSTEM_MD + RELIC_ENGRAM_ID でシステムプロンプトを差し替えて起動
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
