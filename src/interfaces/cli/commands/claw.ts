import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  Inject,
  InjectEngramNotFoundError,
  InjectClawDirNotFoundError,
  Extract,
  WorkspaceNotFoundError,
  WorkspaceEmptyError,
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
import { printDetail, printLine } from "../output.js";
import { resolveWorkspacePath } from "../../../shared/openclaw.js";

export function registerClawCommand(program: Command): void {
  const claw = program
    .command("claw")
    .description("Manage Claw agent workspaces (OpenClaw and compatible)");

  // --- claw push ---
  claw
    .command("push")
    .description("Push local Engram persona into a Claw workspace")
    .requiredOption("-e, --engram <id>", "Engram ID to push")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("--merge-identity", "Merge IDENTITY.md into SOUL.md (for non-OpenClaw Claw frameworks)")
    .option("-y, --yes", "Skip create/overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after push")
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
          const needsCreate =
            !diff.targetExists ||
            diff.soul === "missing" ||
            diff.identity === "missing";

          if (needsCreate && !opts.yes) {
            const confirmed = await confirmOverwrite(
              `Claw workspace "${opts.engram}" does not have persona files yet. Create them from the local Relic Engram? [y/N] `
            );
            if (!confirmed) {
              printLine("Skipped.");
              return;
            }
          }

          if (
            diff.overwriteRequired &&
            !opts.yes &&
            !(await confirmOverwrite(
              `Overwrite Claw workspace "${opts.engram}" persona with the local Relic version? [y/N] `
            ))
          ) {
            printLine("Skipped.");
            return;
          }

          if (alreadyInjected) {
            console.log(`✅ Persona already in sync (${diff.targetPath})`);
          } else {
            const result = await inject.execute(opts.engram, {
              openclawDir: clawDir,
              mergeIdentity: opts.mergeIdentity,
            });

            console.log(
              `✅ Pushed "${result.engramName}" into ${result.targetPath}`
            );
            printDetail(`Files written: ${result.filesWritten.join(", ")}`);
          }

          if (!opts.sync) return;

          // Auto-sync memory after push
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
            console.log(`✅ Memory synced: ${details.join(", ")} (${opts.engram})`);
          } else {
            console.log(`✅ Memory already in sync (${opts.engram})`);
          }
        } catch (err) {
          if (
            err instanceof InjectEngramNotFoundError ||
            err instanceof InjectClawDirNotFoundError
          ) {
            printError(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      }
    );

  // --- claw pull ---
  claw
    .command("pull")
    .description("Pull persona from a Claw workspace into local Relic")
    .requiredOption("-e, --engram <id>", "Engram ID to pull")
    .option("--name <name>", "Display name to use if a new local Engram is created")
    .option("--dir <dir>", "Override Claw directory path (default: ~/.openclaw)")
    .option("-y, --yes", "Skip create/overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after pull")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(
      async (opts: {
        engram: string;
        name?: string;
        dir?: string;
        yes?: boolean;
        sync: boolean;
        path?: string;
      }) => {
        const engramsPath = await resolveEngramsPath(opts.path);
        const clawDir = await resolveClawPath(opts.dir);
        const repo = new LocalEngramRepository(engramsPath);
        const extract = new Extract(repo);
        const pull = new ClawPull(repo);
        const sync = new Sync(repo, engramsPath);

        try {
          const engramId = opts.engram.trim();
          const local = await repo.get(engramId);

          if (!local) {
            if (
              !opts.yes &&
              !(await confirmOverwrite(
                `Local Engram "${engramId}" does not exist. Create it from the Claw workspace? [y/N] `
              ))
            ) {
              printLine("Skipped.");
              return;
            }

            const result = await extract.execute(engramId, {
              name: opts.name,
              openclawDir: clawDir,
            });

            console.log(`✅ Pulled "${result.engramName}" from ${result.sourcePath}`);
            printDetail(`Files imported: ${result.filesRead.join(", ")}`);
            printDetail(`Saved as Engram: ${result.engramId}`);

            if (!opts.sync) return;

            const syncResult = await sync.syncPair({
              engramId,
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
              console.log(`✅ Memory synced: ${details.join(", ")} (${engramId})`);
            } else {
              console.log(`✅ Memory already in sync (${engramId})`);
            }
            return;
          }

          const { result, apply } = await pull.check(engramId, {
            openclawDir: clawDir,
          });

          if (result.outcome === "already_synced") {
            console.log(`✅ Persona already in sync (${engramId})`);
          } else {
            const diff = result.diff!;
            if (diff.soulDiff === "different") {
              printDetail("SOUL.md: differs");
            }
            if (diff.identityDiff === "different") {
              printDetail("IDENTITY.md: differs");
            }

            // Confirm overwrite
            if (
              !opts.yes &&
              !(await confirmOverwrite(
                `Overwrite local Engram "${engramId}" persona with the Claw workspace version? [y/N] `
              ))
            ) {
              printLine("Skipped.");
              return;
            }

            await apply!();
            console.log(`✅ Pulled "${result.engramName}" from ${result.diff!.sourcePath}`);
          }

          if (!opts.sync) return;

          const workspacePath = resolveWorkspacePath(engramId, clawDir);
          const syncResult = await sync.syncPair({
            engramId,
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
            console.log(`✅ Memory synced: ${details.join(", ")} (${engramId})`);
          } else {
            console.log(`✅ Memory already in sync (${engramId})`);
          }
        } catch (err) {
          if (
            err instanceof WorkspaceNotFoundError ||
            err instanceof WorkspaceEmptyError ||
            err instanceof ClawPullEngramNotFoundError ||
            err instanceof ClawPullWorkspaceNotFoundError ||
            err instanceof ClawPullPersonaMissingError
          ) {
            printError(`Error: ${err.message}`);
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
            printError("Error: --engram and --all cannot be used together.");
            process.exit(1);
          }

          if (!opts.engram && !opts.all) {
            printError("Error: Specify --engram <id> or --all.");
            process.exit(1);
          }

          if (opts.engram) {
            const engramId = opts.engram.trim();
            if (!engramId) {
              printError(`Error: Invalid Engram ID "${opts.engram}".`);
              process.exit(1);
            }
            const engram = await repo.get(engramId);
            if (!engram) {
              printError(`Error: Engram "${engramId}" not found.`);
              process.exit(1);
            }

            const workspacePath = resolveWorkspacePath(engramId, clawDir);
            if (!existsSync(workspacePath)) {
              printError(`Error: Claw agent "${engramId}" workspace not found.`);
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
              console.log(`✅ ${engramId}: merged ${details.join(", ")}`);
            } else {
              console.log(`✅ Already in sync (${engramId})`);
            }
            return;
          }

          const result = await sync.execute(clawDir);

          if (result.synced.length === 0 && result.skipped.length === 0) {
            printLine("No Claw workspaces found.");
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
              console.log(`✅ ${s.engramId}: merged ${details.join(", ")}`);
            } else {
              console.log(`✅ Already in sync (${s.engramId})`);
            }
          }

          if (result.skipped.length > 0) {
            console.log(
              `Skipped (no matching Engram): ${result.skipped.join(", ")}`
            );
          }
        } catch (err) {
          if (err instanceof SyncOpenclawDirNotFoundError) {
            printError(`Error: ${err.message}`);
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

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

function printError(msg: string): void {
  console.error(red(msg));
}
