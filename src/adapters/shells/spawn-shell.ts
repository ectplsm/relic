import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * AI CLIをフォアグラウンドで起動し、stdin/stdout/stderrを引き継ぐ。
 * ユーザーが終了するまでブロックする。
 *
 * shell: false で起動し、引数をそのまま渡す。
 * これにより長いプロンプト文字列がシェルに壊されない。
 */
export function spawnShell(
  command: string,
  args: string[],
  cwd?: string,
  env?: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd,
      env: env ? { ...process.env, ...env } : undefined,
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to launch ${command}: ${err.message}`));
    });

    child.on("close", (code, signal) => {
      // code 0 = 正常終了
      // code null = シグナルで終了
      // signal SIGINT/SIGTERM = ユーザーによる中断（正常扱い）
      if (
        code === 0 ||
        code === null ||
        signal === "SIGINT" ||
        signal === "SIGTERM"
      ) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

/**
 * プロンプトをtempファイルに書き出し、パスを返す。
 * Shell終了後にcleanup()を呼んで削除する。
 */
export function writeTempPrompt(prompt: string): { path: string; cleanup: () => void } {
  const path = join(tmpdir(), `relic-engram-${Date.now()}.md`);
  writeFileSync(path, prompt, "utf-8");
  return {
    path,
    cleanup: () => {
      try { unlinkSync(path); } catch { /* ignore */ }
    },
  };
}
