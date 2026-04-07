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
  MikoshiPullEngramNotFoundError,
  MikoshiPullCloudNotFoundError,
  MikoshiPullPersonaMissingError,
} from "../../../core/usecases/mikoshi-pull.js";
import {
  MikoshiMemoryPush,
  MikoshiMemoryPushEngramNotFoundError,
  MikoshiMemoryPushNoFilesError,
  MikoshiMemoryPushCloudNotFoundError,
} from "../../../core/usecases/mikoshi-memory-push.js";
import { MikoshiApiError } from "../../../core/ports/mikoshi.js";
import { readPassphrase } from "../../../core/sync/crypto.js";
import { createInterface } from "node:readline";
import {
  ensureInitialized,
  resolveEngramsPath,
  resolveDefaultEngram,
  resolveMikoshiUrl,
  resolveMikoshiApiKey,
} from "../../../shared/config.js";

export function registerMikoshiCommand(program: Command): void {
  const mikoshi = program
    .command("mikoshi")
    .description("Manage cloud sync with Mikoshi");

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
        console.error("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      // API key 必須チェック
      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        console.error("Error: Mikoshi API key is not configured.");
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
          console.error(`Error: ${err.message}`);
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
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramIdArg: string | undefined, opts: { path?: string }) => {
      await ensureInitialized();

      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        console.error("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        console.error("Error: Mikoshi API key is not configured.");
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
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPushPersonaHashError) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  // relic mikoshi pull [engram-id]
  mikoshi
    .command("pull [engram-id]")
    .description("Pull remote persona files from Mikoshi to local Engram")
    .option("-p, --path <dir>", "Override engrams directory path")
    .option("-y, --yes", "Skip overwrite confirmation")
    .action(async (engramIdArg: string | undefined, opts: { path?: string; yes?: boolean }) => {
      await ensureInitialized();

      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        console.error("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        console.error("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiPull(repo, client);

      try {
        const { result, apply } = await usecase.check(engramId);

        if (result.outcome === "already_synced") {
          console.log(`\n  ✅ "${result.engramName}" is already synced.\n`);
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
        console.log(`  ✅ Local persona updated from Mikoshi.\n`);
      } catch (err) {
        if (err instanceof MikoshiPullEngramNotFoundError) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPullCloudNotFoundError) {
          console.error(`Error: Engram "${engramId}" not found on Mikoshi.`);
          process.exit(1);
        }
        if (err instanceof MikoshiPullPersonaMissingError) {
          console.error(`Error: ${err.message}`);
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
    .command("push [engram-id]")
    .description("Encrypt and upload local memory to Mikoshi")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramIdArg: string | undefined, opts: { path?: string }) => {
      await ensureInitialized();

      const engramId = engramIdArg ?? await resolveDefaultEngram();
      if (!engramId) {
        console.error("Error: No engram-id specified and no default Engram configured.");
        console.error("  Set one with: relic config default-engram <id>");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        console.error("Error: Mikoshi API key is not configured.");
        console.error("  Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      // パスフレーズ入力
      let passphrase: string;
      try {
        passphrase = await readPassphrase("Passphrase for memory encryption: ");
      } catch {
        console.error("Cancelled.");
        process.exit(1);
        return; // unreachable but satisfies TS
      }

      if (!passphrase) {
        console.error("Error: Passphrase cannot be empty.");
        process.exit(1);
      }

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
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemoryPushNoFilesError) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiMemoryPushCloudNotFoundError) {
          console.error(`Error: ${err.message}`);
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
    console.error("Error: Mikoshi API key is invalid or expired.");
    console.error("  Update with: relic config mikoshi-api-key <key>");
  } else if (err.isRateLimited) {
    console.error("Error: Mikoshi rate limit exceeded. Try again later.");
  } else {
    console.error(`Error: Mikoshi API returned ${err.status}: ${err.message}`);
  }
  process.exit(1);
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
