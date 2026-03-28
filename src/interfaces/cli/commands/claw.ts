import { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Inject,
  InjectEngramNotFoundError,
  InjectWorkspaceNotFoundError,
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
  AlreadyExtractedError,
  Sync,
  SyncOpenclawDirNotFoundError,
} from "../../../core/usecases/index.js";
import { resolveEngramsPath, resolveClawPath } from "../../../shared/config.js";
import { resolveWorkspacePath } from "../../../shared/openclaw.js";

export function registerClawCommand(program: Command): void {
  const claw = program
    .command("claw")
    .description("Manage Claw agent workspaces (OpenClaw and compatible)");

  // --- claw inject ---
  claw
    .command("inject")
    .description("Push an Engram into a Claw workspace")
    .requiredOption("-e, --engram <id>", "Engram ID to inject")
    .option("--to <agent>", "Inject into a different agent name")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("--merge-identity", "Merge IDENTITY.md into SOUL.md (for non-OpenClaw Claw frameworks)")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        engram: string;
        to?: string;
        dir?: string;
        mergeIdentity?: boolean;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const inject = new Inject(repo);

        try {
          const result = await inject.execute(opts.engram, {
            to: opts.to,
            openclawDir: clawDir,
            mergeIdentity: opts.mergeIdentity,
          });

          console.log(
            `Injected "${result.engramName}" into ${result.targetPath}`
          );
          console.log(`  Files written: ${result.filesWritten.join(", ")}`);

          // Auto-sync memory after inject
          const sync = new Sync(repo, engramsPath);
          const agentName = opts.to ?? opts.engram;
          const workspacePath = resolveWorkspacePath(agentName, clawDir);
          const syncResult = await sync.syncPair({
            engramId: opts.engram,
            workspacePath,
          });

          const details: string[] = [];
          if (syncResult.memoryFilesMerged > 0) {
            details.push(`${syncResult.memoryFilesMerged} memory file(s)`);
          }
          if (syncResult.memoryIndexMerged) {
            details.push("MEMORY.md");
          }
          if (details.length > 0) {
            console.log(`  Memory synced: ${details.join(", ")}`);
          } else {
            console.log(`  Memory: already in sync`);
          }
        } catch (err) {
          if (
            err instanceof InjectEngramNotFoundError ||
            err instanceof InjectWorkspaceNotFoundError
          ) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );

  // --- claw extract ---
  claw
    .command("extract")
    .description("Create a new Engram from a Claw agent workspace")
    .option("-a, --agent <name>", "Agent name to extract from (default: main)")
    .option("--name <name>", "Engram display name (defaults to agent name)")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        agent?: string;
        name?: string;
        dir?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);

        try {
          const agentName = opts.agent ?? "main";
          const result = await extract.execute(agentName, {
            name: opts.name,
            openclawDir: clawDir,
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

  // --- claw sync ---
  claw
    .command("sync")
    .description("Bidirectional memory sync between Engrams and Claw workspaces")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        dir?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const sync = new Sync(repo, engramsPath);

        try {
          const result = await sync.execute(clawDir);

          if (result.synced.length === 0 && result.skipped.length === 0) {
            console.log("No Claw workspaces found.");
            return;
          }

          for (const s of result.synced) {
            const details: string[] = [];
            if (s.memoryFilesMerged > 0) {
              details.push(`${s.memoryFilesMerged} memory file(s)`);
            }
            if (s.memoryIndexMerged) {
              details.push("MEMORY.md");
            }
            if (details.length > 0) {
              console.log(`  ${s.engramId}: merged ${details.join(", ")}`);
            } else {
              console.log(`  ${s.engramId}: already in sync`);
            }
          }

          if (result.skipped.length > 0) {
            console.log(
              `  Skipped (no matching Engram): ${result.skipped.join(", ")}`
            );
          }
        } catch (err) {
          if (err instanceof SyncOpenclawDirNotFoundError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );
}
