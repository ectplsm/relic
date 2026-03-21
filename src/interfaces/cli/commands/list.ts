import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { ListEngrams } from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List all Engrams in Mikoshi")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: { path?: string }) => {
      const engramsPath = await resolveEngramsPath(opts.path);
      const repo = new LocalEngramRepository(engramsPath);
      const listEngrams = new ListEngrams(repo);
      const engrams = await listEngrams.execute();

      if (engrams.length === 0) {
        console.log("No Engrams found.");
        console.log(`  Path: ${engramsPath}`);
        return;
      }

      console.log(`Engrams (${engrams.length}):\n`);
      for (const e of engrams) {
        const tags = e.tags?.length ? ` [${e.tags.join(", ")}]` : "";
        console.log(`  ${e.id}`);
        console.log(`    ${e.name}${tags}`);
        if (e.description) {
          console.log(`    ${e.description}`);
        }
        console.log();
      }
    });
}
