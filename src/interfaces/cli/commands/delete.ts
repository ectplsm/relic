import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { loadConfig, ensureInitialized } from "../../../shared/config.js";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import {
  DeleteEngram,
  DeleteEngramNotFoundError,
} from "../../../core/usecases/delete-engram.js";

// ============================================================
// Helpers
// ============================================================

async function confirm(message: string): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) return false;
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(message);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function confirmWithId(message: string, expectedId: string): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) return false;
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(message);
    return answer.trim() === expectedId;
  } finally {
    rl.close();
  }
}

// ============================================================
// Command
// ============================================================

export function registerDeleteCommand(program: Command): void {
  program
    .command("delete")
    .description("Delete an Engram permanently")
    .argument("<id>", "Engram ID to delete")
    .option("-f, --force", "Skip confirmation prompts")
    .action(async (id: string, opts) => {
      await ensureInitialized();
      const config = await loadConfig();
      const repo = new LocalEngramRepository(config.engramsPath);
      const usecase = new DeleteEngram(repo);

      const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

      // Inspect
      let info;
      try {
        info = await usecase.inspect(id);
      } catch (err) {
        if (err instanceof DeleteEngramNotFoundError) {
          console.error(`Error: ${err.message}`);
          process.exitCode = 1;
          return;
        }
        throw err;
      }

      // Check for archive.md separately (not in EngramFiles)
      const archivePath = join(config.engramsPath, id, "archive.md");
      const hasArchive = existsSync(archivePath);

      const hasData = info.hasMemory || info.hasUser || hasArchive || info.memoryEntryCount > 0;
      const displayName = `"${info.engram.meta.name}" (${id})`;

      if (!opts.force) {
        if (hasData) {
          // Dangerous: has memory data — require ID confirmation
          console.log();
          console.log(yellow(`⚠ Engram ${displayName} has memory data:`));

          const items: string[] = [];
          if (info.hasMemory) items.push("MEMORY.md");
          if (info.hasUser) items.push("USER.md");
          if (info.memoryEntryCount > 0) items.push(`${info.memoryEntryCount} memory entries`);
          if (hasArchive) items.push("archive.md");
          console.log(`  ${items.join(", ")}`);
          console.log();

          const confirmed = await confirmWithId(
            `Delete permanently? This cannot be undone. (type "${id}" to confirm): `,
            id
          );
          if (!confirmed) {
            console.log("Cancelled.");
            return;
          }
        } else {
          // Simple: no memory data — y/N is enough
          const confirmed = await confirm(
            `Delete Engram ${displayName}? (y/N): `
          );
          if (!confirmed) {
            console.log("Cancelled.");
            return;
          }
        }
      }

      // Execute deletion
      try {
        await usecase.execute(id);
        console.log(`Deleted Engram ${displayName}`);
      } catch (err) {
        if (err instanceof DeleteEngramNotFoundError) {
          console.error(`Error: ${err.message}`);
          process.exitCode = 1;
          return;
        }
        throw err;
      }
    });
}
