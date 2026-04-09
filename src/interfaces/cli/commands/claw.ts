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
  ClawPull,
  ClawPullEngramNotFoundError,
  ClawPullWorkspaceNotFoundError,
  ClawPullPersonaMissingError,
  Sync,
  SyncOpenclawDirNotFoundError,
} from "../../../core/usecases/index.js";
import {
  resolveEngramsPath,
  resolveClawPath,
} from "../../../shared/config.js";
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
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("--merge-identity", "Merge IDENTITY.md into SOUL.md (for non-OpenClaw Claw frameworks)")
    .option("-y, --yes", "Skip persona overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after inject")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        engram: string;
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
          const workspacePath = resolveWorkspacePath(opts.engram, clawDir);
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
    .description("Create a new Engram from a Claw agent workspace (first-time import)")
    .requiredOption("-a, --agent <name>", "Agent name to extract from")
    .option("--name <name>", "Engram display name (defaults to agent name)")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("--no-sync", "Skip automatic memory sync after extract")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        agent: string;
        name?: string;
        dir?: string;
        sync: boolean;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);
        const sync = new Sync(repo, engramsPath);

        try {
          const agentName = opts.agent.trim();
          const result = await extract.execute(agentName, {
            name: opts.name,
            openclawDir: clawDir,
          });

          console.log(
            `Extracted "${result.engramName}" from ${result.sourcePath}`
          );
          console.log(`  Files extracted: ${result.filesRead.join(", ")}`);
          console.log(`  Saved as Engram: ${result.engramId}`);

          if (!opts.sync) return;

          const syncResult = await sync.syncPair({
            engramId: agentName,
            workspacePath: result.sourcePath,
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

  // --- claw pull ---
  claw
    .command("pull")
    .description("Update local Engram persona from a Claw agent workspace")
    .requiredOption("-a, --agent <name>", "Agent name to pull from")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("-y, --yes", "Skip persona overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after pull")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        agent: string;
        dir?: string;
        yes?: boolean;
        sync: boolean;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const pull = new ClawPull(repo);
        const sync = new Sync(repo, engramsPath);

        try {
          const agentName = opts.agent.trim();
          const { result, apply } = await pull.check(agentName, {
            openclawDir: clawDir,
          });

          if (result.outcome === "already_synced") {
            console.log(`  Already in sync (${agentName})`);
            return;
          }

          // Show diff summary
          const diff = result.diff!;
          if (diff.soulDiff === "different") {
            console.log("  SOUL.md: differs");
          }
          if (diff.identityDiff === "different") {
            console.log("  IDENTITY.md: differs");
          }

          // Confirm overwrite
          if (
            !opts.yes &&
            !(await confirmOverwrite(
              `Overwrite local Engram "${agentName}" persona with Claw workspace version? [y/N] `
            ))
          ) {
            console.error("Aborted.");
            process.exit(1);
          }

          await apply!();
          console.log(`Pulled "${result.engramName}" from ${diff.sourcePath}`);

          if (!opts.sync) return;

          const workspacePath = resolveWorkspacePath(agentName, clawDir);
          const syncResult = await sync.syncPair({
            engramId: agentName,
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
            err instanceof ClawPullEngramNotFoundError ||
            err instanceof ClawPullWorkspaceNotFoundError ||
            err instanceof ClawPullPersonaMissingError
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
    .option("-e, --engram <id>", "Engram ID to sync")
    .option("--all", "Sync all matching targets")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        engram?: string;
        all?: boolean;
        dir?: string;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const sync = new Sync(repo, engramsPath);

        try {
          if (opts.engram && opts.all) {
            console.error("Error: --engram and --all cannot be used together.");
            process.exit(1);
          }

          if (!opts.engram && !opts.all) {
            console.error("Error: Specify --engram <id> or --all.");
            process.exit(1);
          }

          if (opts.engram) {
            const engramId = opts.engram.trim();
            if (!engramId) {
              console.error(`Error: Invalid Engram ID "${opts.engram}".`);
              process.exit(1);
            }
            const engram = await repo.get(engramId);
            if (!engram) {
              console.error(`Error: Engram "${engramId}" not found.`);
              process.exit(1);
            }

            const workspacePath = resolveWorkspacePath(engramId, clawDir);
            if (!existsSync(workspacePath)) {
              console.error(`Error: Claw agent "${engramId}" workspace not found.`);
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
              console.log(`  Already in sync (${engramId})`);
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
              console.log(`  Already in sync (${s.engramId})`);
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
