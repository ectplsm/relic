#!/usr/bin/env node

import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";
import { registerSummonCommand } from "./commands/summon.js";

const program = new Command();

program
  .name("relic")
  .description("PROJECT RELIC — Engram injection system for AI constructs")
  .version("0.1.0");

registerInitCommand(program);
registerListCommand(program);
registerSummonCommand(program);

program.parse();
