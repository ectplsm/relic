import { watch } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Sync,
  SyncAgentsDirNotFoundError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description(
      "Watch OpenClaw agents and auto-sync with Engrams"
    )
    .option(
      "--openclaw <dir>",
      "Override OpenClaw directory path (default: ~/.openclaw)"
    )
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        openclaw?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const repo = new LocalEngramRepository(engramsPath);
        const sync = new Sync(repo);

        try {
          console.log("Starting Relic sync...");

          // 初回同期
          const result = await sync.initialSync(opts.openclaw);

          if (result.injected.length > 0) {
            console.log(
              `  Injected: ${result.injected.join(", ")}`
            );
          }
          if (result.extracted.length > 0) {
            console.log(
              `  Extracted memory: ${result.extracted.join(", ")}`
            );
          }
          if (result.targets.length === 0) {
            console.log("  No agents found.");
            return;
          }

          // ファイル監視を開始
          const watchers = startWatching(
            result.targets,
            sync,
            opts.openclaw
          );

          console.log(
            `\nWatching ${result.targets.length} agent(s) for memory changes...`
          );
          console.log("Press Ctrl+C to stop.\n");

          // Ctrl+C でクリーンアップ
          const cleanup = () => {
            console.log("\nStopping sync...");
            for (const w of watchers) {
              w.close();
            }
            process.exit(0);
          };

          process.on("SIGINT", cleanup);
          process.on("SIGTERM", cleanup);

          // プロセスを維持
          await new Promise(() => {});
        } catch (err) {
          if (err instanceof SyncAgentsDirNotFoundError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );
}

function startWatching(
  targets: { engramId: string; agentPath: string }[],
  sync: Sync,
  openclawDir?: string
) {
  const watchers: ReturnType<typeof watch>[] = [];
  // デバウンス用タイマー
  const debounceTimers = new Map<string, NodeJS.Timeout>();

  for (const target of targets) {
    const memoryDir = join(target.agentPath, "memory");

    try {
      const watcher = watch(
        memoryDir,
        { recursive: true },
        (_event, filename) => {
          if (!filename?.endsWith(".md")) return;

          // デバウンス（同一agentの連続変更を500msでまとめる）
          const existing = debounceTimers.get(target.engramId);
          if (existing) clearTimeout(existing);

          debounceTimers.set(
            target.engramId,
            setTimeout(async () => {
              debounceTimers.delete(target.engramId);
              try {
                await sync.syncMemory(target.engramId, openclawDir);
                const now = new Date().toLocaleTimeString();
                console.log(
                  `[${now}] Synced memory: ${target.engramId} (${filename})`
                );
              } catch {
                // sync失敗は警告のみ
                console.error(
                  `[warn] Failed to sync memory for ${target.engramId}`
                );
              }
            }, 500)
          );
        }
      );

      watchers.push(watcher);
    } catch {
      // memory/ ディレクトリが存在しない場合はスキップ
      // （エージェントにまだメモリがない）
    }
  }

  return watchers;
}
