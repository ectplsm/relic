import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Inject,
  InjectEngramNotFoundError,
  InjectClawDirNotFoundError,
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
    .option("-y, --yes", "Skip persona overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after inject")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        engram: string;
        to?: string;
        dir?: string;
        mergeIdentity?: boolean;
        yes?: boolean;
        sync: boolean;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const inject = new Inject(repo);

        try {
          const diff = await inject.inspectPersona(opts.engram, {
            to: opts.to,
            openclawDir: clawDir,
            mergeIdentity: opts.mergeIdentity,
          });
          const alreadyInjected =
            diff.soul === "same" &&
            (diff.identity === "same" || diff.identity === "skipped");

          if (
            diff.overwriteRequired &&
            !opts.yes &&
            !(await confirmOverwrite(
              `SOUL.md and/or IDENTITY.md already exist and differ in ${diff.targetPath}. Overwrite with local Relic version? [y/N] `
            ))
          ) {
            console.error(
              "Error: Persona files already exist and differ. Re-run with --yes to overwrite from local Relic Engram."
            );
            process.exit(1);
          }

          if (alreadyInjected) {
            console.log(`  Already injected (${diff.targetPath})`);
          } else {
            const result = await inject.execute(opts.engram, {
              to: opts.to,
              openclawDir: clawDir,
              mergeIdentity: opts.mergeIdentity,
            });

            console.log(
              `Injected "${result.engramName}" into ${result.targetPath}`
            );
            console.log(`  Files written: ${result.filesWritten.join(", ")}`);
          }

          if (!opts.sync) return;

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
          if (syncResult.userMerged) {
            details.push("USER.md");
          }
          if (details.length > 0) {
            console.log(`  Synced: ${details.join(", ")}`);
          } else {
            console.log(`  Already in sync`);
          }
        } catch (err) {
          if (
            err instanceof InjectEngramNotFoundError ||
            err instanceof InjectClawDirNotFoundError ||
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
    .option("-f, --force", "Allow overwriting local persona files from the Claw workspace")
    .option("-y, --yes", "Skip persona overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after extract")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        agent?: string;
        name?: string;
        dir?: string;
        force?: boolean;
        yes?: boolean;
        sync: boolean;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);
        const sync = new Sync(repo, engramsPath);

        try {
          const agentName = opts.agent ?? "main";
          const diff = await extract.inspectPersona(agentName, {
            name: opts.name,
            openclawDir: clawDir,
          });

          if (diff.existing && !opts.force) {
            throw new AlreadyExtractedError(agentName);
          }

          const alreadyExtracted =
            diff.existing &&
            diff.name === "same" &&
            diff.soul === "same" &&
            diff.identity === "same";

          if (
            diff.existing &&
            diff.overwriteRequired &&
            !opts.yes &&
            !(await confirmOverwrite(
              `SOUL.md and/or IDENTITY.md already exist in local Engram "${agentName}" and differ from ${diff.sourcePath}. Overwrite with the Claw version? [y/N] `
            ))
          ) {
            console.error(
              "Error: Persona files already exist and differ. Re-run with --yes to overwrite from the Claw workspace."
            );
            process.exit(1);
          }

          if (alreadyExtracted) {
            console.log(
              opts.force
                ? `  Already extracted and updated (${agentName})`
                : `  Already extracted (${agentName})`
            );
          } else {
            const result = await extract.execute(agentName, {
              name: opts.name,
              openclawDir: clawDir,
              force: opts.force,
            });

            console.log(
              `Extracted "${result.engramName}" from ${result.sourcePath}`
            );
            if (diff.existing) {
              console.log(`  Files overwritten: SOUL.md, IDENTITY.md`);
              if (diff.name === "different") {
                console.log(`  Metadata updated: engram.json (name)`);
              }
              console.log(`  Saved as Engram: ${result.engramId}`);
            } else {
              console.log(`  Files extracted: ${result.filesRead.join(", ")}`);
              console.log(`  Saved as Engram: ${result.engramId}`);
            }
          }

          if (!opts.sync) return;

          const syncResult = await sync.syncPair({
            engramId: agentName,
            workspacePath: diff.sourcePath,
          });

          const details: string[] = [];
          if (syncResult.memoryFilesMerged > 0) {
            details.push(`${syncResult.memoryFilesMerged} memory file(s)`);
          }
          if (syncResult.memoryIndexMerged) {
            details.push("MEMORY.md");
          }
          if (syncResult.userMerged) {
            details.push("USER.md");
          }
          if (details.length > 0) {
            console.log(`  Synced: ${details.join(", ")}`);
          } else {
            console.log(`  Already in sync`);
          }
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
    .option("-t, --target <pair>", "Sync one pair only: <id> or <engram>:<agent>")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        target?: string;
        dir?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const sync = new Sync(repo, engramsPath);

        try {
          if (opts.target) {
            const { engramId, agentName } = parseSyncTarget(opts.target);
            const engram = await repo.get(engramId);
            if (!engram) {
              console.error(`Error: Engram "${engramId}" not found.`);
              process.exit(1);
            }

            const workspacePath = resolveWorkspacePath(agentName, clawDir);
            if (!existsSync(workspacePath)) {
              console.error(`Error: Claw agent "${agentName}" workspace not found.`);
              process.exit(1);
            }

            const result = await sync.syncPair({
              engramId,
              workspacePath,
            });

            const details: string[] = [];
            if (result.memoryFilesMerged > 0) {
              details.push(`${result.memoryFilesMerged} memory file(s)`);
            }
            if (result.memoryIndexMerged) {
              details.push("MEMORY.md");
            }
            if (result.userMerged) {
              details.push("USER.md");
            }
            if (details.length > 0) {
              console.log(`  ${engramId}: merged ${details.join(", ")}`);
            } else {
              console.log(`  ${engramId}: already in sync`);
            }
            return;
          }

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
            if (s.userMerged) {
              details.push("USER.md");
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

function parseSyncTarget(target: string): { engramId: string; agentName: string } {
  const trimmed = target.trim();
  const [engramId, agentName] = trimmed.split(":");

  if (!engramId) {
    throw new Error(`Invalid sync target "${target}"`);
  }

  return {
    engramId,
    agentName: agentName || engramId,
  };
}

async function confirmOverwrite(message: string): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) {
    return false;
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(message);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
