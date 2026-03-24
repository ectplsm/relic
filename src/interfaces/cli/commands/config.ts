import type { Command } from "commander";
import { loadConfig, setDefaultEngram, ensureInitialized } from "../../../shared/config.js";
import { LocalEngramRepository } from "../../../adapters/local/index.js";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage RELIC configuration");

  // relic config show
  config
    .command("show")
    .description("Show current configuration")
    .action(async () => {
      await ensureInitialized();
      const cfg = await loadConfig();
      console.log(JSON.stringify(cfg, null, 2));
    });

  // relic config set-default <engramId>
  config
    .command("set-default <engramId>")
    .description("Set the default Engram to summon when --engram is not specified")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (engramId: string, opts: { path?: string }) => {
      await ensureInitialized();
      const cfg = await loadConfig();
      const engramsPath = opts.path ?? cfg.engramsPath;

      // Engram存在確認
      const repo = new LocalEngramRepository(engramsPath);
      const engram = await repo.get(engramId);
      if (!engram) {
        console.error(`Error: Engram "${engramId}" not found in ${engramsPath}`);
        process.exit(1);
      }

      await setDefaultEngram(engramId);
      console.log(`Default Engram set to: ${engram.meta.name} (${engramId})`);
    });
}
