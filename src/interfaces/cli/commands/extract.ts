import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
  EngramAlreadyExistsError,
  AgentNotFoundError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("Extract an Engram from an OpenClaw workspace")
    .requiredOption("--name <name>", "Engram display name")
    .option("--id <id>", "Engram ID (default: agent name or 'main')")
    .option("-a, --agent <name>", "Source agent name (default: auto-detect)")
    .option(
      "--openclaw <dir>",
      "Override OpenClaw directory path (default: ~/.openclaw)"
    )
    .option("-p, --path <dir>", "Override engrams directory path")
    .option("-f, --force", "Overwrite existing Engram")
    .action(
      async (opts: {
        name: string;
        id?: string;
        agent?: string;
        openclaw?: string;
        path?: string;
        force?: boolean;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);

        try {
          const result = await extract.execute(opts.name, {
            id: opts.id,
            agent: opts.agent,
            openclawDir: opts.openclaw,
            force: opts.force,
          });

          console.log(
            `Extracted "${result.engramName}" from ${result.sourcePath}`
          );
          console.log(`  Mode: ${result.mode}-agent (${result.agent})`);
          console.log(`  Files read: ${result.filesRead.join(", ")}`);
          console.log(`  Saved as Engram: ${result.engramId}`);
          if (result.memoryMerged) {
            console.log(`  Memory entries merged into existing Engram`);
          }
        } catch (err) {
          if (
            err instanceof WorkspaceNotFoundError ||
            err instanceof WorkspaceEmptyError ||
            err instanceof EngramAlreadyExistsError ||
            err instanceof AgentNotFoundError
          ) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );
}
