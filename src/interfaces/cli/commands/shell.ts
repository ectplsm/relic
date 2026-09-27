import { join, resolve } from "node:path";
import type { Command } from "commander";
import type { ShellKind, ShellLauncher } from "../../../core/ports/shell-launcher.js";
import { LocalEngramRepository } from "../../../adapters/local/index.js";
import { Summon, EngramNotFoundError } from "../../../core/usecases/index.js";
import {
  resolveEngramsPath,
  resolveDefaultEngram,
  resolveMemoryWindowSize,
  resolveDistillationBatchSize,
} from "../../../shared/config.js";
import { ClaudeShell } from "../../../adapters/shells/claude-shell.js";
import { GeminiShell } from "../../../adapters/shells/gemini-shell.js";
import { CodexShell } from "../../../adapters/shells/codex-shell.js";
import { CodexArgsError, parseCodexArgs } from "../../../adapters/shells/codex-args.js";
import { isResumeArgs } from "../../../adapters/shells/resume-detect.js";


interface ShellDef {
  kind: ShellKind;
  description: string;
  create: () => ShellLauncher;
}

const SHELLS: ShellDef[] = [
  {
    kind: "claude",
    description: "Summon an Engram into Claude Code CLI",
    create: () => new ClaudeShell(),
  },
  {
    kind: "gemini",
    description: "Summon an Engram into Gemini CLI",
    create: () => new GeminiShell(),
  },
  {
    kind: "codex",
    description: "Summon an Engram into Codex CLI",
    create: () => new CodexShell(),
  },
];

export function registerShellCommands(program: Command): void {
  for (const shell of SHELLS) {
    const command = program
      .command(shell.kind)
      .description(shell.description)
      .option("-e, --engram <id>", "Engram ID to summon (default: config.defaultEngram)")
      .option("--cwd <dir>", "Working directory for the Shell (default: current directory)")
      .allowUnknownOption(true)
      .allowExcessArguments(true);

    if (shell.kind === "codex") {
      command.option("--path <dir>", "Override engrams directory path");
    } else {
      command.option("-p, --path <dir>", "Override engrams directory path");
    }

    command
      .action(async (opts: { engram?: string; path?: string; cwd?: string }, cmd: Command) => {
        const launcher = shell.create();

        // Shell利用可能チェック
        const available = await launcher.isAvailable();
        if (!available) {
          console.error(`Error: ${launcher.name} is not installed or not in PATH.`);
          process.exit(1);
        }

        // Engram ID解決: --engram > config.defaultEngram > エラー
        const engramId = await resolveDefaultEngram(opts.engram);
        if (!engramId) {
          console.error("Error: No Engram specified. Use --engram <id> or set a default with: relic config default-engram <id>");
          process.exit(1);
        }

        // Engram取得 & プロンプト生成
        const engramsPath = await resolveEngramsPath(opts.path);
        const repo = new LocalEngramRepository(engramsPath);
        const summon = new Summon(repo);

        const memoryWindowSize = await resolveMemoryWindowSize();
        const distillationBatchSize = await resolveDistillationBatchSize();

        try {
          const result = await summon.execute(engramId, {
            memoryWindowSize,
            distillationBatchSize,
          });

          // --engram, --path, --cwd 以外の引数をShellにパススルー
          let extraArgs = cmd.args;
          let selectedProfile: string | undefined;
          if (shell.kind === "codex") {
            const parsed = parseCodexArgs(extraArgs);
            extraArgs = parsed.argsWithoutProfile;
            selectedProfile = parsed.profile;
          }
          const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd();

          // resume 系操作の検出
          const skipInjection = isResumeArgs(shell.kind, extraArgs);

          if (skipInjection) {
            console.log(`Resuming ${launcher.name} session (${result.engramName})...`);
          } else {
            console.log(`Summoning "${result.engramName}" into ${launcher.name}...`);
          }
          console.log();

          await launcher.launch(result.prompt, {
            extraArgs,
            cwd,
            engramId: result.engramId,
            archivePath: join(engramsPath, result.engramId, "archive.md"),
            selectedProfile,
            skipInjection,
          });
        } catch (err) {
          if (err instanceof CodexArgsError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          if (err instanceof EngramNotFoundError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
          }
          throw err;
        }
      });
  }
}
