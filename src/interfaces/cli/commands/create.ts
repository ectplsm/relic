import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Command } from "commander";
import { loadConfig, ensureInitialized } from "../../../shared/config.js";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { DEFAULT_SOUL, DEFAULT_IDENTITY } from "../../../shared/templates.js";
import { printBlank, printDetail, printLine } from "../output.js";
import {
  CreateEngram,
  EngramAlreadyExistsError,
  InvalidEngramIdError,
  ENGRAM_ID_PATTERN,
} from "../../../core/usecases/create-engram.js";

// ============================================================
// Interactive prompt helpers
// ============================================================

async function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askRequired(
  rl: ReturnType<typeof createInterface>,
  question: string,
  errorMsg: string
): Promise<string> {
  while (true) {
    const answer = await ask(rl, question);
    if (answer) return answer;
    printLine(errorMsg);
  }
}

/**
 * Ask for a valid, non-duplicate Engram ID. Retries on bad format or collision.
 */
async function askValidId(
  rl: ReturnType<typeof createInterface>,
  repo: import("../../../adapters/local/index.js").LocalEngramRepository
): Promise<string> {
  while (true) {
    const id = await askRequired(
      rl,
      "Engram ID (e.g. my-agent): ",
      "ID is required. Use lowercase letters, numbers, and hyphens."
    );
    if (!ENGRAM_ID_PATTERN.test(id)) {
      printLine("Invalid ID. Use lowercase letters, numbers, and hyphens (e.g. my-agent).");
      continue;
    }
    const existing = await repo.get(id);
    if (existing) {
      printLine(`Engram "${id}" already exists. Choose a different ID.`);
      continue;
    }
    return id;
  }
}

// ============================================================
// Command
// ============================================================

export function registerCreateCommand(program: Command): void {
  program
    .command("create")
    .description("Create a new Engram interactively")
    .option("-i, --id <id>", "Engram ID (lowercase alphanumeric + hyphens)")
    .option("-n, --name <name>", "Display name")
    .option("-d, --description <desc>", "Description")
    .option("-t, --tags <tags>", "Comma-separated tags")
    .action(async (opts) => {
      await ensureInitialized();
      const config = await loadConfig();
      const repo = new LocalEngramRepository(config.engramsPath);
      const usecase = new CreateEngram(repo);

      const isTTY = input.isTTY && output.isTTY;

      // If non-interactive, require at least id and name
      if (!isTTY) {
        if (!opts.id || !opts.name) {
          console.error("Error: --id and --name are required in non-interactive mode.");
          process.exitCode = 1;
          return;
        }
      }

      let id = opts.id as string | undefined;
      let name = opts.name as string | undefined;
      let description = opts.description as string | undefined;
      let tags: string[] | undefined;

      if (opts.tags) {
        tags = (opts.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean);
      }

      // Early validation for pre-supplied ID (before interactive flow)
      if (id) {
        if (!ENGRAM_ID_PATTERN.test(id)) {
          console.error(
            `Error: Invalid Engram ID "${id}". Use lowercase letters, numbers, and hyphens only (e.g. "my-agent").`
          );
          process.exitCode = 1;
          return;
        }
        const existing = await repo.get(id);
        if (existing) {
          console.error(
            `Error: Engram "${id}" already exists. Delete it first or choose a different ID.`
          );
          process.exitCode = 1;
          return;
        }
      }

      // Interactive flow for missing fields
      if (isTTY && (!id || !name)) {
        const rl = createInterface({ input, output });
        try {
          if (!id) {
            id = await askValidId(rl, repo);
          }

          if (!name) {
            name = await askRequired(
              rl,
              "Name: ",
              "Name is required."
            );
          }

          if (description === undefined) {
            description = await ask(rl, "Description (optional): ") || undefined;
          }

          if (tags === undefined) {
            const tagsInput = await ask(rl, "Tags (comma-separated, optional): ");
            if (tagsInput) {
              tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
            }
          }
        } finally {
          rl.close();
        }
      }

      // Execute
      try {
        const result = await usecase.execute({
          id: id!,
          name: name!,
          description,
          tags,
          soul: DEFAULT_SOUL,
          identity: DEFAULT_IDENTITY,
        });

        const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
        const engramDir = `${config.engramsPath}/${result.engram.meta.id}`;
        printBlank();
        printLine(green(`Created Engram "${result.engram.meta.name}" (${result.engram.meta.id})`));
        printDetail(`→ ${engramDir}/`);
        printBlank();
        printLine("Files:");
        printDetail("engram.json    — metadata (name, description, tags)");
        printDetail("manifest.json  — system metadata (id, timestamps)");
        printDetail("SOUL.md        — core principles and behavior");
        printDetail("IDENTITY.md    — persona identity (fill in during first conversation)");
        printBlank();
        printLine(`Customize SOUL.md and IDENTITY.md, then run: relic claude ${result.engram.meta.id}`);
      } catch (err) {
        if (err instanceof InvalidEngramIdError || err instanceof EngramAlreadyExistsError) {
          console.error(`Error: ${err.message}`);
          process.exitCode = 1;
          return;
        }
        throw err;
      }
    });
}
