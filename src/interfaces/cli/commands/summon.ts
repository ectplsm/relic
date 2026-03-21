import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { Summon, EngramNotFoundError } from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerSummonCommand(program: Command): void {
  program
    .command("summon")
    .description("Summon an Engram — compose its prompt for Shell injection")
    .argument("<id>", "Engram ID to summon")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (id: string, opts: { path?: string }) => {
      const engramsPath = await resolveEngramsPath(opts.path);
      const repo = new LocalEngramRepository(engramsPath);
      const summon = new Summon(repo);

      try {
        const result = await summon.execute(id);
        console.log(result.prompt);
      } catch (err) {
        if (err instanceof EngramNotFoundError) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        throw err;
      }
    });
}
