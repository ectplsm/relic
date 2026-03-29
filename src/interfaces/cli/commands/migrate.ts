import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { MigrateEngrams } from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerMigrateCommand(program: Command): void {
  const migrate = program
    .command("migrate")
    .description("Run one-off migrations for local Relic data");

  migrate
    .command("engrams")
    .description("Migrate Engram metadata from legacy engram.json to manifest.json")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: { path?: string }) => {
      const engramsPath = await resolveEngramsPath(opts.path);
      const repo = new LocalEngramRepository(engramsPath);
      const migrateEngrams = new MigrateEngrams(repo, engramsPath);
      const result = await migrateEngrams.execute();

      console.log(`Scanned Engrams: ${result.migrated.length + result.alreadyUpToDate.length + result.skipped.length}`);
      console.log(`  Migrated: ${result.migrated.length}`);
      console.log(`  Already up to date: ${result.alreadyUpToDate.length}`);
      console.log(`  Skipped: ${result.skipped.length}`);

      if (result.migrated.length > 0) {
        console.log(`  Migrated IDs: ${result.migrated.join(", ")}`);
      }
      if (result.alreadyUpToDate.length > 0) {
        console.log(`  Up-to-date IDs: ${result.alreadyUpToDate.join(", ")}`);
      }
      for (const skipped of result.skipped) {
        console.log(`  Skipped ${skipped.id}: ${skipped.reason}`);
      }
    });
}
