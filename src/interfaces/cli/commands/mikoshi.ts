import type { Command } from "commander";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { MikoshiApiClient } from "../../../adapters/mikoshi/client.js";
import {
  MikoshiStatus,
  MikoshiStatusEngramNotFoundError,
  MikoshiStatusCloudNotFoundError,
} from "../../../core/usecases/mikoshi-status.js";
import { MikoshiApiError } from "../../../core/ports/mikoshi.js";
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
          console.log("  Upload it first with: relic mikoshi push (coming soon)\n");
          process.exit(0);
        }
        if (err instanceof MikoshiApiError) {
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
        throw err;
      }
    });
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
    case "unavailable":   return "?";
    default:              return "?";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "synced":        return "synced";
    case "local_differs": return "local differs";
    case "remote_only":   return "remote only (no local persona hash)";
    case "not_uploaded":  return "not uploaded";
    case "unavailable":   return "comparison unavailable";
    default:              return status;
  }
}
