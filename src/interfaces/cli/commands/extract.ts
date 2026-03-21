import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
  AgentNotFoundError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("Extract an Engram from an OpenClaw workspace")
    .requiredOption("--id <id>", "Engram ID to create")
    .requiredOption("--name <name>", "Engram display name")
    .option("-a, --agent <name>", "Source agent name (default: auto-detect)")
    .option(
      "--openclaw <dir>",
      "Override OpenClaw directory path (default: ~/.openclaw)"
    )
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        id: string;
        name: string;
        agent?: string;
        openclaw?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);

        try {
          const result = await extract.execute(
            opts.id,
            opts.name,
            opts.agent,
            opts.openclaw
          );

          console.log(
            `Extracted "${result.engramName}" from ${result.sourcePath}`
          );
          console.log(`  Mode: ${result.mode}-agent (${result.agent})`);
          console.log(`  Files read: ${result.filesRead.join(", ")}`);
          console.log(`  Saved as Engram: ${result.engramId}`);
        } catch (err) {
          if (
            err instanceof WorkspaceNotFoundError ||
            err instanceof WorkspaceEmptyError ||
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
