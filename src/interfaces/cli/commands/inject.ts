import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Inject,
  InjectEngramNotFoundError,
  AgentNotFoundError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";

export function registerInjectCommand(program: Command): void {
  program
    .command("inject")
    .description("Inject an Engram into an OpenClaw workspace")
    .requiredOption("-e, --engram <id>", "Engram ID to inject")
    .option("-a, --agent <name>", "Target agent name (default: auto-detect)")
    .option(
      "--openclaw <dir>",
      "Override OpenClaw directory path (default: ~/.openclaw)"
    )
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        engram: string;
        agent?: string;
        openclaw?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const repo = new LocalEngramRepository(engramsPath);
        const inject = new Inject(repo);

        try {
          const result = await inject.execute(
            opts.engram,
            opts.agent,
            opts.openclaw
          );

          console.log(
            `Injected "${result.engramName}" into ${result.targetPath}`
          );
          console.log(`  Mode: ${result.mode}-agent (${result.agent})`);
          console.log(`  Files written: ${result.filesWritten.join(", ")}`);
        } catch (err) {
          if (
            err instanceof InjectEngramNotFoundError ||
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
