import { createInterface } from "node:readline";
import type { Command } from "commander";
import { Init } from "../../../core/usecases/init.js";
import { setDefaultEngram, loadConfig } from "../../../shared/config.js";
import { LocalEngramRepository } from "../../../adapters/local/index.js";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize ~/.relic/ directory and config")
    .action(async () => {
      const init = new Init();
      const result = await init.execute();

      if (result.created) {
        console.log("Initialized RELIC:");
        console.log(`  Config:  ${result.configPath}`);
        console.log(`  Engrams: ${result.engramsPath}`);
        console.log();

        // 利用可能なEngramを表示してデフォルト選択を促す
        const cfg = await loadConfig();
        const repo = new LocalEngramRepository(cfg.engramsPath);
        const engrams = await repo.list();

        if (engrams.length > 0) {
          console.log("Available Engrams:");
          console.log(`  ${"ID".padEnd(12)} Name`);
          for (const e of engrams) {
            console.log(`  ${e.id.padEnd(12)} ${e.name}`);
          }
          console.log();

          const johnny = engrams.find((e) => e.id === "johnny");
          const prompt = johnny
            ? `Set a default Engram? (press Enter for "${johnny.id}", or enter ID, or "n" to skip): `
            : "Set a default Engram? (Enter ID, or press Enter to skip): ";
          const answer = await ask(prompt);

          if (answer === "" && johnny) {
            await setDefaultEngram(johnny.id);
            console.log(`Default Engram set to: ${johnny.name} (${johnny.id})`);
          } else if (answer === "" || answer.toLowerCase() === "n") {
            console.log(`Skipped. Run: relic config default-engram <id> to configure later.`);
          } else {
            const match = engrams.find((e) => e.id === answer);
            if (match) {
              await setDefaultEngram(match.id);
              console.log(`Default Engram set to: ${match.name} (${match.id})`);
            } else {
              console.log(`Unknown Engram "${answer}". Skipped. Run: relic config default-engram <id>`);
            }
          }
        }
      } else {
        console.log("Already initialized.");
        console.log(`  Config:  ${result.configPath}`);
      }
    });
}
