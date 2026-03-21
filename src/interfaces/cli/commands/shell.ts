import { resolve } from "node:path";
import type { Command } from "commander";
import type { ShellLauncher } from "../../../core/ports/shell-launcher.js";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { Summon, EngramNotFoundError } from "../../../core/usecases/index.js";
import { resolveEngramsPath } from "../../../shared/config.js";
import { ClaudeShell } from "../../../adapters/shells/claude-shell.js";
import { GeminiShell } from "../../../adapters/shells/gemini-shell.js";
import { CodexShell } from "../../../adapters/shells/codex-shell.js";
import { CopilotShell } from "../../../adapters/shells/copilot-shell.js";

interface ShellDef {
  name: string;
  description: string;
  create: () => ShellLauncher;
}

const SHELLS: ShellDef[] = [
  {
    name: "claude",
    description: "Summon an Engram into Claude Code CLI",
    create: () => new ClaudeShell(),
  },
  {
    name: "gemini",
    description: "Summon an Engram into Gemini CLI",
    create: () => new GeminiShell(),
  },
  {
    name: "codex",
    description: "Summon an Engram into Codex CLI",
    create: () => new CodexShell(),
  },
  {
    name: "copilot",
    description: "Summon an Engram into GitHub Copilot CLI",
    create: () => new CopilotShell(),
  },
];

export function registerShellCommands(program: Command): void {
  for (const shell of SHELLS) {
    program
      .command(shell.name)
      .description(shell.description)
      .requiredOption("-e, --engram <id>", "Engram ID to summon")
      .option("-p, --path <dir>", "Override engrams directory path")
      .option("--cwd <dir>", "Working directory for the Shell (default: current directory)")
      .allowUnknownOption(true)
      .action(async (opts: { engram: string; path?: string; cwd?: string }, cmd: Command) => {
        const launcher = shell.create();

        // Shell利用可能チェック
        const available = await launcher.isAvailable();
        if (!available) {
          console.error(`Error: ${launcher.name} is not installed or not in PATH.`);
          process.exit(1);
        }

        // Engram取得 & プロンプト生成
        const engramsPath = await resolveEngramsPath(opts.path);
        const repo = new LocalEngramRepository(engramsPath);
        const summon = new Summon(repo);

        try {
          const result = await summon.execute(opts.engram);
          console.log(`Summoning "${result.engramName}" into ${launcher.name}...\n`);

          // --engram, --path, --cwd 以外の引数をShellにパススルー
          const extraArgs = cmd.args;
          const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd();
          await launcher.launch(result.prompt, extraArgs, cwd);
        } catch (err) {
          if (err instanceof EngramNotFoundError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      });
  }
}
