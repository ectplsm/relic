#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";
import { registerShowCommand } from "./commands/show.js";
import { registerShellCommands } from "./commands/shell.js";
import { registerClawCommand } from "./commands/claw.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerRefreshSamplesCommand } from "./commands/refresh-samples.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../../package.json"), "utf-8"));

const program = new Command();

program
  .name("relic")
  .description("PROJECT RELIC — Engram injection system for AI constructs")
  .version(pkg.version);

registerInitCommand(program);
registerListCommand(program);
registerShowCommand(program);
registerShellCommands(program);
registerClawCommand(program);
registerConfigCommand(program);
registerMigrateCommand(program);
registerRefreshSamplesCommand(program);

program.parse();
