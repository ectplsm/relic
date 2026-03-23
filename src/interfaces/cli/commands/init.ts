import type { Command } from "commander";
import { Init } from "../../../core/usecases/init.js";
import { registerTrustedFolders } from "../../../adapters/shells/trust-registrar.js";

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

      // 各Shell CLIに ~/.relic/engrams の信頼設定を登録
      const trust = await registerTrustedFolders(result.engramsPath);
      if (trust.registered.length > 0) {
        console.log(`  Trusted: ${trust.registered.join(", ")}`);
      }
    });
}
