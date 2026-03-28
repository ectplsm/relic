import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Sync,
  SyncOpenclawDirNotFoundError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description(
      "Bidirectional memory sync between Relic Engrams and OpenClaw workspaces"
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
        const sync = new Sync(repo, engramsPath);

        try {
          const result = await sync.execute(opts.openclaw);

          if (result.synced.length === 0 && result.skipped.length === 0) {
            console.log("No OpenClaw workspaces found.");
            return;
          }

          for (const s of result.synced) {
            const details: string[] = [];
            if (s.memoryFilesMerged > 0) {
              details.push(`${s.memoryFilesMerged} memory file(s)`);
            }
            if (s.memoryIndexMerged) {
              details.push("MEMORY.md");
            }
            if (details.length > 0) {
              console.log(`  ${s.engramId}: merged ${details.join(", ")}`);
            } else {
              console.log(`  ${s.engramId}: already in sync`);
            }
          }

          if (result.skipped.length > 0) {
            console.log(
              `  Skipped (no matching Engram): ${result.skipped.join(", ")}`
            );
          }
        } catch (err) {
          if (err instanceof SyncOpenclawDirNotFoundError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );
}
