import type { Command } from "commander";
import { Init } from "../../../core/usecases/init.js";

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
      } else {
        console.log("Already initialized.");
        console.log(`  Config:  ${result.configPath}`);
      }
    });
}
