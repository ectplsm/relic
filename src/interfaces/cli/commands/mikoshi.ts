import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { MikoshiApiClient } from "../../../adapters/mikoshi/client.js";
import {
  MikoshiStatus,
  MikoshiStatusEngramNotFoundError,
  MikoshiStatusCloudNotFoundError,
} from "../../../core/usecases/mikoshi-status.js";
import {
  MikoshiPush,
  MikoshiPushEngramNotFoundError,
  MikoshiPushPersonaHashError,
} from "../../../core/usecases/mikoshi-push.js";
import {
  MikoshiPull,
  MikoshiPullCreateFlagRequiredError,
  MikoshiPullCloudNotFoundError,
  MikoshiPullPersonaMissingError,
} from "../../../core/usecases/mikoshi-pull.js";
import {
  MikoshiMemoryPush,
  MikoshiMemoryPushEngramNotFoundError,
  MikoshiMemoryPushNoFilesError,
  MikoshiMemoryPushCloudNotFoundError,
} from "../../../core/usecases/mikoshi-memory-push.js";
import {
  MikoshiMemoryPull,
  MikoshiMemoryPullEngramNotFoundError,
  MikoshiMemoryPullCloudNotFoundError,
  MikoshiMemoryPullDecryptError,
} from "../../../core/usecases/mikoshi-memory-pull.js";
import {
  MikoshiMemorySync,
  MikoshiMemorySyncEngramNotFoundError,
  MikoshiMemorySyncCloudNotFoundError,
  MikoshiMemorySyncDecryptError,
} from "../../../core/usecases/mikoshi-memory-sync.js";
import { MikoshiApiError } from "../../../core/ports/mikoshi.js";
import { readPassphrase } from "../../../core/sync/crypto.js";
import { createInterface } from "node:readline";
import {
  ensureInitialized,
  resolveEngramsPath,
  resolveDefaultEngram,
  resolveMikoshiUrl,
  resolveMikoshiApiKey,
  resolveMikoshiPassphrase,
  loadConfig,
  saveConfig,
} from "../../../shared/config.js";

export function registerMikoshiCommand(program: Command): void {
  const mikoshi = program
    .command("mikoshi")
    .description("Manage cloud sync with Mikoshi");

  // relic mikoshi list
  mikoshi
    .command("list")
    .description("List all Engrams registered on Mikoshi")
    .action(async () => {
      await ensureInitialized();

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const mikoshiUrl = await resolveMikoshiUrl();
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);

      try {
        const engrams = await client.getEngrams();

        if (engrams.length === 0) {
          console.log("\n  No Engrams on Mikoshi.\n");
          return;
        }

        console.log();
        for (const e of engrams) {
          const mem = e.memory?.hasMemory ? "memory" : "";
          const vis = e.visibility === "PRIVATE" ? dim("private") : e.visibility.toLowerCase();
          console.log(`  ${e.name} ${dim(`(${e.sourceEngramId})`)}  ${vis}  ${mem}`);
        }
        console.log(`\n  ${engrams.length} engram(s)\n`);
      } catch (err) {
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  // relic mikoshi status [engram-id]
  mikoshi
    .command("status [engram-id]")
    .description("Show sync status between local Engram and Mikoshi cloud")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramIdArg: string | undefined, opts: { path?: string }) => {
      await ensureInitialized();

      // Engram ID 解決
      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        printError("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      // API key 必須チェック
      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiStatus(repo, client);

      try {
        const result = await usecase.execute(engramId);

        console.log(`\n  Engram: ${result.engramName} (${result.engramId})`);
        console.log(`  Cloud:  ${result.cloudEngramId}`);
        console.log();

        // Persona
        const personaIcon = statusIcon(result.persona.status);
        const personaLabel = statusLabel(result.persona.status);
        console.log(`  Persona:  ${personaIcon} ${personaLabel}`);
        if (result.persona.status === "local_differs") {
          console.log(`    local:  ${result.persona.localHash}`);
          console.log(`    remote: ${result.persona.remoteHash}`);
        }

        // Memory
        const memoryIcon = statusIcon(result.memory.status);
        const memoryLabel = statusLabel(result.memory.status);
        console.log(`  Memory:   ${memoryIcon} ${memoryLabel}`);
        if (result.memory.status === "local_differs") {
          console.log(`    local:  ${result.memory.localHash}`);
          console.log(`    remote: ${result.memory.remoteHash}`);
        }
        if (result.memory.remoteExists && result.memory.remoteSummary) {
          const s = result.memory.remoteSummary;
          console.log(`    entries: ${s.memoryEntryCount}, latest: ${s.latestMemoryDate ?? "—"}`);
        }

        console.log();
      } catch (err) {
        if (err instanceof MikoshiStatusEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiStatusCloudNotFoundError) {
          console.log(`\n  Engram "${engramId}" is not registered on Mikoshi.`);
          console.log("  Upload it with: relic mikoshi push\n");
          process.exit(0);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });
  // relic mikoshi push [engram-id]
  mikoshi
    .command("push [engram-id]")
    .description("Push local Engram persona to Mikoshi cloud")
    .option("-e, --engram <id>", "Engram ID to push")
    .option("--no-sync", "Skip automatic memory sync after push")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramIdArg: string | undefined, opts: {
      engram?: string;
      sync: boolean;
      path?: string;
    }) => {
      await ensureInitialized();

      const engramId = await resolveCommandEngramId(engramIdArg, opts.engram);
      if (!engramId) {
        printError("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiPush(repo, client);

      try {
        const result = await usecase.execute(engramId);

        switch (result.outcome) {
          case "created":
            console.log(`\n  ✅ Created "${result.engramName}" on Mikoshi.`);
            console.log(`  Cloud ID: ${result.cloudEngramId}\n`);
            break;
          case "updated":
            console.log(`\n  ✅ Persona updated for "${result.engramName}".`);
            console.log(`  Hash: ${result.newPersonaHash}\n`);
            break;
          case "already_synced":
            console.log(`\n  ✅ "${result.engramName}" is already synced.\n`);
            break;
          case "conflict":
            console.error(`\n  ⚠️  Persona conflict for "${result.engramName}".`);
            console.error("  The remote persona was updated since you last checked.");
            if (result.conflictRemoteHash) {
              console.error(`  Remote hash: ${result.conflictRemoteHash}`);
            }
            console.error("  Re-run 'relic mikoshi status' to review the current state.\n");
            process.exit(1);
            break;
        }
      } catch (err) {
        if (err instanceof MikoshiPushEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPushPersonaHashError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }

      if (!opts.sync) return;

      const passphrase = await resolvePassphraseForSync();
      const syncUsecase = new MikoshiMemorySync(repo, client);
      await runSingleMikoshiSync(syncUsecase, engramId, passphrase, { prefix: "  " });
    });

  // relic mikoshi pull [engram-id]
  mikoshi
    .command("pull [engram-id]")
    .description("Pull remote persona files from Mikoshi to local Engram")
    .option("-e, --engram <id>", "Engram ID to pull")
    .option("-p, --path <dir>", "Override engrams directory path")
    .option("-c, --create", "Create the local Engram if it does not exist")
    .option("-y, --yes", "Skip overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after pull")
    .action(async (engramIdArg: string | undefined, opts: {
      engram?: string;
      path?: string;
      create?: boolean;
      yes?: boolean;
      sync: boolean;
    }) => {
      await ensureInitialized();

      const engramId = await resolveCommandEngramId(engramIdArg, opts.engram);
      if (!engramId) {
        printError("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiPull(repo, client);

      try {
        const { result, apply } = await usecase.check(engramId, {
          allowCreate: opts.create,
        });

        if (result.outcome === "already_synced") {
          console.log(`\n  ✅ "${result.engramName}" is already synced.`);
          if (opts.sync) {
            const passphrase = await resolvePassphraseForSync();
            const syncUsecase = new MikoshiMemorySync(repo, client);
            await runSingleMikoshiSync(syncUsecase, engramId, passphrase, { prefix: "  " });
          } else {
            console.log();
          }
          return;
        }

        const localBefore = await repo.get(engramId);
        if (!localBefore) {
          await apply!();
          console.log(`\n  ✅ Created local Engram "${result.engramName}" from Mikoshi.`);
          if (opts.sync) {
            const passphrase = await resolvePassphraseForSync();
            const syncUsecase = new MikoshiMemorySync(repo, client);
            await runSingleMikoshiSync(syncUsecase, engramId, passphrase, { prefix: "  " });
          } else {
            console.log();
          }
          return;
        }

        // 差分表示
        const diff = result.diff!;
        console.log(`\n  Engram: ${result.engramName} (${result.engramId})`);
        console.log(`  Cloud:  ${result.cloudEngramId}`);
        console.log();
        if (diff.soulDiffers) console.log("  SOUL.md     — differs");
        if (diff.identityDiffers) console.log("  IDENTITY.md — differs");
        console.log();

        // 確認プロンプト
        if (!opts.yes) {
          const confirmed = await confirm("  Overwrite local persona files? [y/N] ");
          if (!confirmed) {
            console.log("  Skipped.\n");
            return;
          }
        }

        await apply!();
        console.log(`  ✅ Local persona updated from Mikoshi.`);
        if (opts.sync) {
          const passphrase = await resolvePassphraseForSync();
          const syncUsecase = new MikoshiMemorySync(repo, client);
          await runSingleMikoshiSync(syncUsecase, engramId, passphrase, { prefix: "  " });
        } else {
          console.log();
        }
      } catch (err) {
        if (err instanceof MikoshiPullCreateFlagRequiredError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPullCloudNotFoundError) {
          printError(`Error: Engram "${engramId}" not found on Mikoshi.`);
          process.exit(1);
        }
        if (err instanceof MikoshiPullPersonaMissingError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  mikoshi
    .command("sync")
    .description("Bidirectional memory sync between local Engrams and Mikoshi")
    .option("-t, --target <id>", "Sync one target only by Engram ID")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: { target?: string; path?: string }) => {
      await ensureInitialized();

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const passphrase = await resolvePassphraseForSync();
      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiMemorySync(repo, client);

      try {
        if (opts.target) {
          const targetId = opts.target.trim();
          if (!targetId) {
            printError(`Error: Invalid sync target "${opts.target}".`);
            process.exit(1);
          }

          await runSingleMikoshiSync(usecase, targetId, passphrase);
          return;
        }

        const localEngrams = await repo.list();
        if (localEngrams.length === 0) {
          console.log("No local Engrams found.");
          return;
        }

        const cloudEngrams = await client.getEngrams();
        const cloudIds = new Set(cloudEngrams.map((engram) => engram.sourceEngramId));
        const syncableIds = localEngrams
          .map((engram) => engram.id)
          .filter((id) => cloudIds.has(id));
        const skippedIds = localEngrams
          .map((engram) => engram.id)
          .filter((id) => !cloudIds.has(id));

        if (syncableIds.length === 0) {
          console.log("No matching Mikoshi targets found.");
          if (skippedIds.length > 0) {
            console.log(`  Skipped (not on Mikoshi): ${skippedIds.join(", ")}`);
          }
          return;
        }

        for (const engramId of syncableIds) {
          await runSingleMikoshiSync(usecase, engramId, passphrase);
        }

        if (skippedIds.length > 0) {
          console.log(`  Skipped (not on Mikoshi): ${skippedIds.join(", ")}`);
        }
      } catch (err) {
        if (err instanceof MikoshiMemorySyncEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemorySyncCloudNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemorySyncDecryptError) {
          printError("Error: Failed to decrypt memory. Wrong passphrase or corrupted data.");
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  // relic mikoshi memory push [engram-id]
  const memory = mikoshi
    .command("memory")
    .description("Manage encrypted memory sync with Mikoshi");

  memory
    .command("sync [engram-id]")
    .description("Merge local and remote memory, then synchronize both sides")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramIdArg: string | undefined, opts: { path?: string }) => {
      await ensureInitialized();

      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        printError("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const passphrase = await resolvePassphraseForSync();

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiMemorySync(repo, client);

      try {
        await runSingleMikoshiSync(usecase, engramId, passphrase);
      } catch (err) {
        if (err instanceof MikoshiMemorySyncEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemorySyncCloudNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemorySyncDecryptError) {
          printError("Error: Failed to decrypt memory. Wrong passphrase or corrupted data.");
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  memory
    .command("push [engram-id]")
    .description("Encrypt and upload local memory to Mikoshi")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramIdArg: string | undefined, opts: { path?: string }) => {
      await ensureInitialized();

      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        printError("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      // パスフレーズ解決: config 優先 → 対話入力
      const passphrase = await resolvePassphraseForEncrypt();

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiMemoryPush(repo, client);

      try {
        const result = await usecase.execute(engramId, passphrase);

        switch (result.outcome) {
          case "uploaded":
            console.log(`\n  ✅ Memory uploaded for "${result.engramName}".`);
            console.log(`  Version: ${result.version}`);
            console.log(`  Content hash: ${result.memoryContentHash}`);
            console.log(`  Bundle hash:  ${result.bundleHash}\n`);
            break;
          case "conflict":
            console.error(`\n  ⚠️  Memory conflict for "${result.engramName}".`);
            console.error("  The remote memory was updated since you last checked.");
            if (result.conflictRemoteHash) {
              console.error(`  Remote hash:    ${result.conflictRemoteHash}`);
            }
            if (result.conflictRemoteVersion) {
              console.error(`  Remote version: ${result.conflictRemoteVersion}`);
            }
            console.error("  Re-run 'relic mikoshi status' to review the current state.\n");
            process.exit(1);
            break;
        }
      } catch (err) {
        if (err instanceof MikoshiMemoryPushEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemoryPushNoFilesError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemoryPushCloudNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  // relic mikoshi memory pull [engram-id]
  memory
    .command("pull [engram-id]")
    .description("Download and decrypt remote memory from Mikoshi")
    .option("-p, --path <dir>", "Override engrams directory path")
    .option("-y, --yes", "Skip overwrite confirmation")
    .action(async (engramIdArg: string | undefined, opts: { path?: string; yes?: boolean }) => {
      await ensureInitialized();

      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        printError("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      // パスフレーズ解決: config 優先 → 対話入力
      const passphrase = await resolvePassphraseForDecrypt();

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiMemoryPull(repo, client);

      try {
        const { result, apply } = await usecase.check(engramId, passphrase);

        switch (result.outcome) {
          case "no_remote_memory":
            console.log(`\n  Engram "${result.engramName}" has no memory on Mikoshi.\n`);
            return;
          case "already_synced":
            console.log(`\n  ✅ "${result.engramName}" memory is already synced.\n`);
            return;
          case "pulled": {
            const diff = result.diff!;
            console.log(`\n  Engram: ${result.engramName} (${result.engramId})`);
            console.log(`  Cloud:  ${result.cloudEngramId}`);
            console.log();
            if (diff.added.length > 0) {
              console.log(`  ${dim("Added (remote has, local doesn't):")}`);
              for (const p of diff.added)   console.log(`    \x1b[32m+ ${p}\x1b[0m`);
            }
            if (diff.changed.length > 0) {
              console.log(`  ${dim("Changed (content differs):")}`);
              for (const p of diff.changed) console.log(`    ${yellow(`~ ${p}`)}`);
            }
            if (diff.removed.length > 0) {
              console.log(`  ${dim("Removed (local has, remote doesn't):")}`);
              for (const p of diff.removed) console.log(`    ${red(`- ${p}`)}`);
            }
            console.log();

            if (!opts.yes) {
              const confirmed = await confirm("  Overwrite local memory files? [y/N] ");
              if (!confirmed) {
                console.log("  Skipped.\n");
                return;
              }
            }

            await apply!();
            console.log(`  ✅ Local memory updated from Mikoshi.\n`);
            break;
          }
        }
      } catch (err) {
        if (err instanceof MikoshiMemoryPullEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemoryPullCloudNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemoryPullDecryptError) {
          printError("Error: Failed to decrypt memory. Wrong passphrase or corrupted data.");
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });
}

// ---------------------------------------------------------------------------
// Shared error handler
// ---------------------------------------------------------------------------

function handleMikoshiApiError(err: MikoshiApiError): never {
  if (err.isUnauthorized) {
    console.error(red("Error: Mikoshi API key is invalid or expired."));
    console.error("  Update with: relic config mikoshi-api-key <key>");
  } else if (err.isRateLimited) {
    console.error(red("Error: Mikoshi rate limit exceeded. Try again later."));
  } else {
    console.error(red(`Error: Mikoshi API returned ${err.status}: ${err.message}`));
  }
  process.exit(1);
}

function printError(msg: string): void {
  console.error(red(msg));
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function statusIcon(status: string): string {
  switch (status) {
    case "synced":        return "✅";
    case "local_differs": return "⚠️";
    case "remote_only":   return "⚠️";
    case "not_uploaded":  return "—";
    case "local_empty":   return "—";
    default:              return "?";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "synced":        return "synced";
    case "local_differs": return "local differs";
    case "remote_only":   return "remote only (no local persona hash)";
    case "not_uploaded":  return "not uploaded";
    case "local_empty":   return "local empty";
    default:              return status;
  }
}

function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Passphrase helpers
// ---------------------------------------------------------------------------

/**
 * 暗号化用パスフレーズを解決する。
 * config に保存済みならそれを使い、なければ対話入力 + 確認 + config 保存を提案。
 */
async function resolvePassphraseForEncrypt(): Promise<string> {
  const saved = await resolveMikoshiPassphrase();
  if (saved) {
    console.log(dim("  Using saved passphrase from config."));
    return saved;
  }

  console.log();
  console.log(yellow("  ⚠ This passphrase encrypts your memory data."));
  console.log(yellow("    If you lose it, your uploaded memory CANNOT be recovered."));
  console.log();

  let passphrase: string;
  try {
    passphrase = await readPassphrase("Passphrase: ");
  } catch {
    console.error("Cancelled.");
    process.exit(1);
  }

  if (!passphrase) {
    printError("Error: Passphrase cannot be empty.");
    process.exit(1);
  }

  // 確認入力
  let confirm2: string;
  try {
    confirm2 = await readPassphrase("Confirm passphrase: ");
  } catch {
    console.error("Cancelled.");
    process.exit(1);
  }

  if (passphrase !== confirm2) {
    printError("Error: Passphrases do not match.");
    process.exit(1);
  }

  // config に保存するか聞く
  const shouldSave = await confirm("  Save passphrase to config for future use? [y/N] ");
  if (shouldSave) {
    const cfg = await loadConfig();
    cfg.mikoshiPassphrase = passphrase;
    await saveConfig(cfg);
    console.log(dim("  Passphrase saved to config."));
  }

  return passphrase;
}

/**
 * 復号用パスフレーズを解決する。
 * config に保存済みならそれを使い、なければ対話入力。
 */
async function resolvePassphraseForDecrypt(): Promise<string> {
  const saved = await resolveMikoshiPassphrase();
  if (saved) {
    console.log(dim("  Using saved passphrase from config."));
    return saved;
  }

  let passphrase: string;
  try {
    passphrase = await readPassphrase("Passphrase for memory decryption: ");
  } catch {
    console.error("Cancelled.");
    process.exit(1);
  }

  if (!passphrase) {
    printError("Error: Passphrase cannot be empty.");
    process.exit(1);
  }

  return passphrase;
}

async function resolvePassphraseForSync(): Promise<string> {
  const saved = await resolveMikoshiPassphrase();
  if (saved) {
    console.log(dim("  Using saved passphrase from config."));
    return saved;
  }

  let passphrase: string;
  try {
    passphrase = await readPassphrase("Passphrase for memory sync: ");
  } catch {
    console.error("Cancelled.");
    process.exit(1);
  }

  if (!passphrase) {
    printError("Error: Passphrase cannot be empty.");
    process.exit(1);
  }

  let confirm2: string;
  try {
    confirm2 = await readPassphrase("Confirm passphrase: ");
  } catch {
    console.error("Cancelled.");
    process.exit(1);
  }

  if (passphrase !== confirm2) {
    printError("Error: Passphrases do not match.");
    process.exit(1);
  }

  return passphrase;
}

async function resolveCommandEngramId(
  positionalEngramId: string | undefined,
  optionEngramId: string | undefined,
): Promise<string | undefined> {
  const positional = positionalEngramId?.trim();
  const option = optionEngramId?.trim();

  if (positional && option && positional !== option) {
    printError(`Error: Conflicting Engram IDs: "${positional}" and "${option}".`);
    process.exit(1);
  }

  return positional ?? option ?? await resolveDefaultEngram();
}

async function runSingleMikoshiSync(
  usecase: MikoshiMemorySync,
  engramId: string,
  passphrase: string,
  options?: { prefix?: string },
): Promise<void> {
  const prefix = options?.prefix ?? "  ";
  const result = await usecase.execute(engramId, passphrase);

  switch (result.outcome) {
    case "already_synced":
      console.log(`${prefix}Already in sync (${engramId})`);
      if (!options?.prefix) {
        console.log();
      }
      return;
    case "synced": {
      const details = summarizeMergedMemory(result.mergedPaths ?? []);
      if (details.length > 0) {
        console.log(`${prefix}${engramId}: merged ${details.join(", ")}`);
      } else {
        console.log(`${prefix}Memory synced (${engramId})`);
      }
      if (!options?.prefix) {
        console.log();
      }
      return;
    }
    case "conflict":
      console.error(`\n  ⚠️  Memory sync conflict for "${result.engramName}".`);
      console.error("  The remote memory changed during sync.");
      if (result.conflictRemoteHash) {
        console.error(`  Remote hash:    ${result.conflictRemoteHash}`);
      }
      if (result.conflictRemoteVersion) {
        console.error(`  Remote version: ${result.conflictRemoteVersion}`);
      }
      console.error("  Re-run 'relic mikoshi sync' to merge again.\n");
      process.exit(1);
  }
}

function summarizeMergedMemory(paths: string[]): string[] {
  const details: string[] = [];
  const memoryEntries = paths.filter(
    (path) => path.startsWith("memory/") && path.endsWith(".md"),
  );

  if (memoryEntries.length > 0) {
    details.push(`${memoryEntries.length} memory file(s)`);
  }
  if (paths.includes("MEMORY.md")) {
    details.push("MEMORY.md");
  }
  if (paths.includes("USER.md")) {
    details.push("USER.md");
  }

  return details;
}
