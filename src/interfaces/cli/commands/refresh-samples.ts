import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { RefreshSamples } from "../../../core/usecases/index.js";
import { resolveEngramsPath, TEMPLATES_DIR } from "../../../shared/config.js";

export function registerRefreshSamplesCommand(program: Command): void {
  program
    .command("refresh-samples")
    .description("Refresh sample Engrams from the latest bundled templates")
    .option("-e, --engram <id>", "Refresh one sample Engram only")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: { engram?: string; path?: string }) => {
      const engramsPath = await resolveEngramsPath(opts.path);
      const repo = new LocalEngramRepository(engramsPath);
      const refreshSamples = new RefreshSamples(repo, TEMPLATES_DIR);
      const result = await refreshSamples.execute(
        opts.engram ? [opts.engram] : undefined
      );

      if (result.refreshed.length > 0) {
        console.log(`Refreshed: ${result.refreshed.length}`);
        console.log(`  IDs: ${result.refreshed.join(", ")}`);
      }

      if (result.seeded.length > 0) {
        console.log(`Seeded: ${result.seeded.length}`);
        console.log(`  IDs: ${result.seeded.join(", ")}`);
      }

      if (result.skipped.length > 0) {
        console.log(`Skipped: ${result.skipped.length}`);
        for (const skipped of result.skipped) {
          console.log(`  ${skipped.id}: ${skipped.reason}`);
        }
      }

      if (result.refreshed.length === 0 && result.seeded.length === 0 && result.skipped.length === 0) {
        console.log("No sample templates found.");
      }
    });
}
