import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
  EngramAlreadyExistsError,
  ExtractNameRequiredError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath, resolveOpenclawPath } from "../../../shared/config.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("Extract an Engram from an OpenClaw workspace")
    .requiredOption("-e, --engram <id>", "Engram ID (= agent name)")
    .option("--name <name>", "Engram display name (required for new Engrams)")
    .option(
      "--openclaw <dir>",
      "Override OpenClaw directory path (default: ~/.openclaw)"
    )
    .option("-p, --path <dir>", "Override engrams directory path")
    .option("-f, --force", "Overwrite existing Engram persona files")
    .action(
      async (opts: {
        engram: string;
        name?: string;
        openclaw?: string;
        path?: string;
        force?: boolean;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const openclawDir = await resolveOpenclawPath(opts.openclaw);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);

        try {
          const result = await extract.execute(opts.engram, {
            name: opts.name,
            openclawDir,
            force: opts.force,
          });

          console.log(
            `Extracted "${result.engramName}" from ${result.sourcePath}`
          );
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
            err instanceof ExtractNameRequiredError
          ) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );
}
