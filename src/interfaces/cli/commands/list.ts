import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { ListEngrams } from "../../../core/usecases/index.js";
import { printBlank, printDetail, printLine } from "../output.js";
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
        printLine("No Engrams found.");
        printDetail(`Path: ${engramsPath}`);
        return;
      }

      printLine(`Engrams (${engrams.length}):`);
      printBlank();
      for (const e of engrams) {
        const tags = e.tags?.length ? ` [${e.tags.join(", ")}]` : "";
        printLine(e.id);
        printDetail(`${e.name}${tags}`);
        if (e.description) {
          printDetail(e.description);
        }
        printBlank();
      }
    });
}
