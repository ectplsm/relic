import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
  AlreadyExtractedError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath, resolveOpenclawPath } from "../../../shared/config.js";

export function registerExtractCommand(program: Command): void {
  program
    .command("extract")
    .description("Create a new Engram from an OpenClaw agent workspace")
    .option("-a, --agent <name>", "OpenClaw agent name to extract from (default: main)")
    .option("--name <name>", "Engram display name (defaults to agent name)")
    .option(
      "--openclaw <dir>",
      "Override OpenClaw directory path (default: ~/.openclaw)"
    )
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        agent?: string;
        name?: string;
        openclaw?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const openclawDir = await resolveOpenclawPath(opts.openclaw);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);

        try {
          const agentName = opts.agent ?? "main";
          const result = await extract.execute(agentName, {
            name: opts.name,
            openclawDir,
          });

          console.log(
            `Extracted "${result.engramName}" from ${result.sourcePath}`
          );
          console.log(`  Files read: ${result.filesRead.join(", ")}`);
          console.log(`  Saved as Engram: ${result.engramId}`);
        } catch (err) {
          if (
            err instanceof WorkspaceNotFoundError ||
            err instanceof WorkspaceEmptyError ||
            err instanceof AlreadyExtractedError
          ) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );
}
