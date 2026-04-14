import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { MikoshiApiClient } from "../../../adapters/mikoshi/client.js";
import { printBlank, printDetail, printErrorDetail, printErrorLine, printLine } from "../output.js";
import { startSpinner } from "../spinner.js";
import {
  MikoshiStatus,
  MikoshiStatusEngramNotFoundError,
  MikoshiStatusCloudNotFoundError,
} from "../../../core/usecases/mikoshi-status.js";
import {
  MikoshiPush,
  MikoshiPushEngramNotFoundError,
  MikoshiPushPersonaConflictError,
  MikoshiPushPersonaHashError,
  MikoshiPushAvatarInvalidMimeError,
  MikoshiPushAvatarReadError,
  MikoshiPushAvatarTooLargeError,
} from "../../../core/usecases/mikoshi-push.js";
import {
  MikoshiDownload,
  MikoshiDownloadAlreadyExistsError,
  MikoshiDownloadCloudNotFoundError,
  MikoshiDownloadPersonaMissingError,
} from "../../../core/usecases/mikoshi-download.js";
import {
  MikoshiPull,
  MikoshiPullEngramNotFoundError,
  MikoshiPullCloudNotFoundError,
  MikoshiPullPersonaMissingError,
} from "../../../core/usecases/mikoshi-pull.js";
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
  resolveMikoshiUrl,
  resolveMikoshiApiKey,
  resolveMikoshiPassphrase,
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
        printErrorDetail("Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const mikoshiUrl = await resolveMikoshiUrl();
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);

      try {
        const engrams = await client.getEngrams();

        if (engrams.length === 0) {
          printBlank();
          printLine("No Engrams on Mikoshi.");
          printBlank();
          return;
        }

        printBlank();
        for (const e of engrams) {
          const mem = e.memory?.hasMemory ? "memory" : "";
          const vis = e.visibility === "PRIVATE" ? dim("private") : e.visibility.toLowerCase();
          printLine(`${e.name} ${dim(`(${e.sourceEngramId})`)}  ${vis}  ${mem}`);
        }
        printBlank();
        printLine(`${engrams.length} engram(s)`);
        printBlank();
      } catch (err) {
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });

  // relic mikoshi status -e <id>
  mikoshi
    .command("status")
    .description("Show sync status between local Engram and Mikoshi cloud")
    .requiredOption("-e, --engram <id>", "Engram ID to check")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: { engram: string; path?: string }) => {
      await ensureInitialized();

      const engramId = opts.engram.trim();

      // API key 必須チェック
      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        printErrorDetail("Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiStatus(repo, client);

      try {
        const spinner = startSpinner("Checking status…");
        const result = await usecase.execute(engramId);
        spinner.stop();

        printBlank();
        printLine(`Engram: ${result.engramName} (${result.engramId})`);
        printLine(`Cloud:  ${result.cloudEngramId}`);
        printBlank();

        // Persona
        const personaIcon = statusIcon(result.persona.status);
        const personaLabel = statusLabel(result.persona.status);
        printLine(`Persona:  ${personaIcon} ${personaLabel}`);
        if (result.persona.status === "local_differs") {
          printDetail(`local:  ${result.persona.localHash}`);
          printDetail(`remote: ${result.persona.remoteHash}`);
        }

        // Memory
        const memoryIcon = statusIcon(result.memory.status);
        const memoryLabel = statusLabel(result.memory.status);
        printLine(`Memory:   ${memoryIcon} ${memoryLabel}`);
        if (result.memory.status === "local_differs") {
          printDetail(`local:  ${result.memory.localHash}`);
          printDetail(`remote: ${result.memory.remoteHash}`);
        }
        if (result.memory.remoteExists && result.memory.remoteSummary) {
          const s = result.memory.remoteSummary;
          printDetail(`entries: ${s.memoryEntryCount}, latest: ${s.latestMemoryDate ?? "—"}`);
        }

        printBlank();
      } catch (err) {
        if (err instanceof MikoshiStatusEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiStatusCloudNotFoundError) {
          printBlank();
          printLine(`Engram "${engramId}" is not registered on Mikoshi.`);
          printDetail("Upload it with: relic mikoshi push");
          printBlank();
          process.exit(0);
        }
        if (err instanceof MikoshiApiError) {
          handleMikoshiApiError(err);
        }
        throw err;
      }
    });
  // relic mikoshi push -e <id>
  mikoshi
    .command("push")
    .description("Push local Engram persona to Mikoshi cloud")
    .requiredOption("-e, --engram <id>", "Engram ID to push")
    .option("-y, --yes", "Skip create/overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after push")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: {
      engram: string;
      yes?: boolean;
      sync: boolean;
      path?: string;
    }) => {
      await ensureInitialized();

      const engramId = opts.engram.trim();

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        printErrorDetail("Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiPush(repo, client);
      let checkSpinner: ReturnType<typeof startSpinner> | undefined;
      let applySpinner: ReturnType<typeof startSpinner> | undefined;

      try {
        checkSpinner = startSpinner("Checking remote persona...");
        const { result, apply } = await usecase.check(engramId);
        checkSpinner.stop();
        checkSpinner = undefined;

        const needsAvatarUpload = result.avatar?.outcome === "upload_required";

        if (!apply) {
          // already_synced と avatar 変更なし
          printLine(`✅ Persona already in sync (${result.engramName})`);
        } else {
          // Persona 確認 (already_synced のときは avatar-only なので persona 確認はスキップ)
          if (result.outcome !== "already_synced" && !opts.yes) {
            const prompt =
              result.outcome === "create_required"
                ? `Engram "${engramId}" does not exist on Mikoshi. Create it? [y/N] `
                : `Overwrite Mikoshi persona with the local Relic version for "${engramId}"? [y/N] `;
            if (!(await confirm(prompt))) {
              printLine("Skipped.");
              return;
            }
          }

          // Avatar 確認
          if (needsAvatarUpload && !opts.yes) {
            const av = result.avatar!;
            printLine(`Avatar to upload for "${engramId}":`);
            if (av.localPath) printDetail(`path: ${av.localPath}`);
            if (av.localMimeType) printDetail(`mime: ${av.localMimeType}`);
            if (av.localSize !== undefined) printDetail(`size: ${formatBytes(av.localSize)}`);
            if (av.localHash) printDetail(`hash: ${av.localHash}`);
            if (!(await confirm(`Upload this avatar? [y/N] `))) {
              printLine("Skipped.");
              return;
            }
          }

          const spinnerMessage =
            result.outcome === "already_synced"
              ? "Uploading avatar to Mikoshi..."
              : "Pushing persona to Mikoshi...";
          applySpinner = startSpinner(spinnerMessage);
          const applied = await apply();

          if (applied.action === "created") {
            applySpinner.stop(`✅ Created "${result.engramName}" on Mikoshi.`);
            applySpinner = undefined;
            printLine(`Cloud ID: ${applied.cloudEngramId}`);
          } else if (applied.action === "updated") {
            applySpinner.stop(`✅ Persona updated for "${result.engramName}".`);
            applySpinner = undefined;
            if (applied.newPersonaHash) printLine(`Hash: ${applied.newPersonaHash}`);
          } else {
            // avatar_only
            applySpinner.stop(`✅ Avatar updated for "${result.engramName}".`);
            applySpinner = undefined;
          }

          // Avatar の結果を最後に報告
          if (applied.avatarAction === "uploaded" && applied.newAvatarUrl) {
            printLine(`Avatar: ${applied.newAvatarUrl}`);
          } else if (applied.avatarAction === "failed") {
            printErrorLine(
              `⚠ Avatar upload failed: ${applied.avatarError?.message ?? "unknown error"}`,
            );
            printErrorLine(
              "  The persona change was saved. Retry with 'relic mikoshi push' to upload the avatar.",
            );
          }
        }
      } catch (err) {
        checkSpinner?.stop();
        applySpinner?.stop();
        if (err instanceof MikoshiPushEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPushPersonaHashError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPushPersonaConflictError) {
          printErrorLine(`⚠ Persona conflict for "${engramId}".`);
          printErrorLine("The remote persona was updated since you last checked.");
          if (err.conflictRemoteHash) {
            printErrorDetail(`Remote hash: ${err.conflictRemoteHash}`);
          }
          printErrorLine("Re-run 'relic mikoshi status' to review the current state.");
          process.exit(1);
        }
        if (err instanceof MikoshiPushAvatarInvalidMimeError) {
          printError(`Error: Avatar format is not supported.`);
          printErrorDetail(`Path: ${err.avatarPath}`);
          printErrorDetail("Allowed: JPEG, PNG, WebP");
          process.exit(1);
        }
        if (err instanceof MikoshiPushAvatarTooLargeError) {
          printError(
            `Error: Avatar exceeds ${formatBytes(err.maxBytes)} (actual: ${formatBytes(err.actualBytes)}).`,
          );
          printErrorDetail(`Path: ${err.avatarPath}`);
          process.exit(1);
        }
        if (err instanceof MikoshiPushAvatarReadError) {
          printError(`Error: Failed to read avatar file.`);
          printErrorDetail(`Path: ${err.avatarPath}`);
          if (err.cause instanceof Error) {
            printErrorDetail(err.cause.message);
          }
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
      await runSingleMikoshiSync(syncUsecase, engramId, passphrase);
    });

  // relic mikoshi pull -e <id>
  mikoshi
    .command("pull")
    .description("Pull persona from Mikoshi into local Relic")
    .requiredOption("-e, --engram <id>", "Engram ID to pull")
    .option("-y, --yes", "Skip create/overwrite confirmation")
    .option("--no-sync", "Skip automatic memory sync after pull")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: {
      engram: string;
      yes?: boolean;
      sync: boolean;
      path?: string;
    }) => {
      await ensureInitialized();

      const engramId = opts.engram.trim();

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        printErrorDetail("Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const download = new MikoshiDownload(repo, client);
      const usecase = new MikoshiPull(repo, client);
      let checkSpinner: ReturnType<typeof startSpinner> | undefined;
      let applySpinner: ReturnType<typeof startSpinner> | undefined;

      try {
        const local = await repo.get(engramId);

        if (!local) {
          if (
            !opts.yes &&
            !(await confirm(`Local Engram "${engramId}" does not exist. Create it from Mikoshi? [y/N] `))
          ) {
            printLine("Skipped.");
            return;
          }

          applySpinner = startSpinner("Pulling persona from Mikoshi...");
          const result = await download.execute(engramId);
          applySpinner.stop(`✅ Pulled "${result.engramName}" from Mikoshi.`);
          applySpinner = undefined;

          if (result.rewrittenAvatarUrl) {
            printDetail(
              `Avatar line rewritten to Mikoshi URL: ${result.rewrittenAvatarUrl}`,
            );
          }

          if (opts.sync) {
            const passphrase = await resolvePassphraseForSync();
            const syncUsecase = new MikoshiMemorySync(repo, client);
            await runSingleMikoshiSync(syncUsecase, engramId, passphrase);
          }
          return;
        }

        checkSpinner = startSpinner("Checking remote persona...");
        const { result, apply } = await usecase.check(engramId);
        checkSpinner.stop();
        checkSpinner = undefined;

        if (result.outcome === "already_synced") {
          printLine(`✅ Persona already in sync (${result.engramName})`);
          if (opts.sync) {
            const passphrase = await resolvePassphraseForSync();
            const syncUsecase = new MikoshiMemorySync(repo, client);
            await runSingleMikoshiSync(syncUsecase, engramId, passphrase);
          }
          return;
        }

        const diff = result.diff!;
        printLine(`Engram: ${result.engramName} (${result.engramId})`);
        printLine(`Cloud:  ${result.cloudEngramId}`);
        printBlank();
        if (diff.soulDiffers) printDetail("SOUL.md     — differs");
        if (diff.identityDiffers) printDetail("IDENTITY.md — differs");
        printBlank();

        // 確認プロンプト
        if (!opts.yes) {
          const confirmed = await confirm("Overwrite local persona files? [y/N] ");
          if (!confirmed) {
            printLine("Skipped.");
            return;
          }
        }

        applySpinner = startSpinner("Pulling persona from Mikoshi...");
        await apply!();
        applySpinner.stop(`✅ Local persona updated from Mikoshi.`);
        applySpinner = undefined;
        if (opts.sync) {
          const passphrase = await resolvePassphraseForSync();
          const syncUsecase = new MikoshiMemorySync(repo, client);
          await runSingleMikoshiSync(syncUsecase, engramId, passphrase);
        }
      } catch (err) {
        checkSpinner?.stop();
        applySpinner?.stop();
        if (err instanceof MikoshiPullEngramNotFoundError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiDownloadAlreadyExistsError) {
          printError(`Error: ${err.message}`);
          process.exit(1);
        }
        if (err instanceof MikoshiDownloadCloudNotFoundError) {
          printError(`Error: Engram "${engramId}" not found on Mikoshi.`);
          process.exit(1);
        }
        if (err instanceof MikoshiDownloadPersonaMissingError) {
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
    .option("-e, --engram <id>", "Engram ID to sync")
    .option("--all", "Sync all matching targets")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (opts: { engram?: string; all?: boolean; path?: string }) => {
      await ensureInitialized();

      if (opts.engram && opts.all) {
        printError("Error: --engram and --all cannot be used together.");
        process.exit(1);
      }
      if (!opts.engram && !opts.all) {
        printError("Error: Specify --engram <id> or --all.");
        process.exit(1);
      }

      const apiKey = await resolveMikoshiApiKey();
      if (!apiKey) {
        printError("Error: Mikoshi API key is not configured.");
        printErrorDetail("Set one with: relic config mikoshi-api-key <key>");
        process.exit(1);
      }

      const passphrase = await resolvePassphraseForSync();
      const engramsPath = await resolveEngramsPath(opts.path);
      const mikoshiUrl = await resolveMikoshiUrl();
      const repo = new LocalEngramRepository(engramsPath);
      const client = new MikoshiApiClient(mikoshiUrl, apiKey);
      const usecase = new MikoshiMemorySync(repo, client);

      try {
        if (opts.engram) {
          const engramId = opts.engram.trim();
          if (!engramId) {
            printError(`Error: Invalid Engram ID "${opts.engram}".`);
            process.exit(1);
          }

          await runSingleMikoshiSync(usecase, engramId, passphrase);
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
            printLine(`Skipped (not on Mikoshi): ${skippedIds.join(", ")}`);
          }
          return;
        }

        for (const engramId of syncableIds) {
          await runSingleMikoshiSync(usecase, engramId, passphrase);
        }

        if (skippedIds.length > 0) {
          printLine(`Skipped (not on Mikoshi): ${skippedIds.join(", ")}`);
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

}

// ---------------------------------------------------------------------------
// Shared error handler
// ---------------------------------------------------------------------------

function handleMikoshiApiError(err: MikoshiApiError): never {
  if (err.isUnauthorized) {
    printError("Error: Mikoshi API key is invalid or expired.");
    printErrorDetail("Update with: relic config mikoshi-api-key <key>");
  } else if (err.isRateLimited) {
    printError("Error: Mikoshi rate limit exceeded. Try again later.");
  } else {
    printError(`Error: Mikoshi API returned ${err.status}: ${err.message}`);
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Passphrase helpers
// ---------------------------------------------------------------------------

async function resolvePassphraseForSync(): Promise<string> {
  const saved = await resolveMikoshiPassphrase();
  if (saved) {
    console.log(dim("Using saved passphrase from config."));
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

async function runSingleMikoshiSync(
  usecase: MikoshiMemorySync,
  engramId: string,
  passphrase: string,
  options?: { prefix?: string },
): Promise<void> {
  const prefix = options?.prefix ?? "";
  const spinner = startSpinner(`Syncing memory (${engramId})...`);
  let stopped = false;

  try {
    const result = await usecase.execute(engramId, passphrase);

    switch (result.outcome) {
      case "already_synced":
        spinner.stop(`${prefix}✅ Memory already in sync (${engramId})`);
        stopped = true;
        return;
      case "synced": {
        const details = summarizeMergedMemory(result.mergedPaths ?? []);
        if (details.length > 0) {
          spinner.stop(`${prefix}✅ Memory synced: ${details.join(", ")} (${engramId})`);
        } else {
          spinner.stop(`${prefix}✅ Memory synced (${engramId})`);
        }
        stopped = true;
        return;
      }
      case "conflict":
        spinner.stop();
        stopped = true;
        printErrorLine(`⚠ Memory sync conflict for "${result.engramName}".`);
        printErrorLine("The remote memory changed during sync.");
        if (result.conflictRemoteHash) {
          printErrorDetail(`Remote hash:    ${result.conflictRemoteHash}`);
        }
        if (result.conflictRemoteVersion) {
          printErrorDetail(`Remote version: ${result.conflictRemoteVersion}`);
        }
        printErrorLine("Re-run 'relic mikoshi sync' to merge again.");
        process.exit(1);
      }
  } finally {
    if (!stopped) {
      spinner.stop();
    }
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
