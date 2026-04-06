import type { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  ensureInitialized,
} from "../../../shared/config.js";
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

  // relic config default-engram [id]
  config
    .command("default-engram [id]")
    .description("Get or set the default Engram ID (used when --engram is omitted)")
    .option("-p, --path <dir>", "Override engrams directory path")
    .action(async (id: string | undefined, opts: { path?: string }) => {
      await ensureInitialized();
      const cfg = await loadConfig();

      if (!id) {
        // getter
        if (cfg.defaultEngram) {
          console.log(cfg.defaultEngram);
        } else {
          console.log("(not set)");
        }
        return;
      }

      // setter — Engram 存在確認
      const engramsPath = opts.path ?? cfg.engramsPath;
      const repo = new LocalEngramRepository(engramsPath);
      const engram = await repo.get(id);
      if (!engram) {
        console.error(`Error: Engram "${id}" not found in ${engramsPath}`);
        process.exit(1);
      }

      cfg.defaultEngram = id;
      await saveConfig(cfg);
      console.log(`Default Engram set to: ${engram.meta.name} (${id})`);
    });

  // relic config claw-path [path]
  config
    .command("claw-path [path]")
    .description("Get or set the Claw directory path (default: ~/.openclaw)")
    .action(async (path: string | undefined) => {
      await ensureInitialized();
      const cfg = await loadConfig();

      if (!path) {
        // getter
        console.log(cfg.clawPath ?? "(not set — using ~/.openclaw)");
        return;
      }

      cfg.clawPath = path;
      await saveConfig(cfg);
      console.log(`Claw path set to: ${path}`);
    });

  // relic config memory-window [n]
  config
    .command("memory-window [n]")
    .description("Get or set the number of recent memory entries to include in prompts (default: 2)")
    .action(async (n: string | undefined) => {
      await ensureInitialized();
      const cfg = await loadConfig();

      if (n === undefined) {
        // getter
        console.log(String(cfg.memoryWindowSize));
        return;
      }

      const parsed = parseInt(n, 10);
      if (isNaN(parsed) || parsed < 1) {
        console.error("Error: memory-window must be a positive integer");
        process.exit(1);
      }

      cfg.memoryWindowSize = parsed;
      await saveConfig(cfg);
      console.log(`Memory window set to: ${parsed}`);
    });

  // relic config mikoshi-url [url]
  config
    .command("mikoshi-url [url]")
    .description("Get or set the Mikoshi API base URL (default: https://mikoshi.ectplsm.com)")
    .action(async (url: string | undefined) => {
      await ensureInitialized();
      const cfg = await loadConfig();

      if (!url) {
        console.log(cfg.mikoshiUrl);
        return;
      }

      cfg.mikoshiUrl = url;
      await saveConfig(cfg);
      console.log(`Mikoshi URL set to: ${url}`);
    });

  // relic config mikoshi-api-key [key]
  config
    .command("mikoshi-api-key [key]")
    .description("Get or set the Mikoshi API key")
    .action(async (key: string | undefined) => {
      await ensureInitialized();
      const cfg = await loadConfig();

      if (!key) {
        if (cfg.mikoshiApiKey) {
          // マスク表示 — 先頭10文字だけ見せる
          const masked = cfg.mikoshiApiKey.length > 10
            ? cfg.mikoshiApiKey.slice(0, 10) + "…"
            : cfg.mikoshiApiKey;
          console.log(masked);
        } else {
          console.log("(not set)");
        }
        return;
      }

      cfg.mikoshiApiKey = key;
      await saveConfig(cfg);
      console.log("Mikoshi API key saved.");
    });

  // relic config distillation-batch-size [n]
  config
    .command("distillation-batch-size [n]")
    .description("Get or set the number of archive entries to distill at once (default: 30)")
    .action(async (n: string | undefined) => {
      await ensureInitialized();
      const cfg = await loadConfig();

      if (n === undefined) {
        console.log(String(cfg.distillationBatchSize));
        return;
      }

      const parsed = parseInt(n, 10);
      if (isNaN(parsed) || parsed < 1) {
        console.error("Error: distillation-batch-size must be a positive integer");
        process.exit(1);
      }

      cfg.distillationBatchSize = parsed;
      await saveConfig(cfg);
      console.log(`Distillation batch size set to: ${parsed}`);
    });
}
