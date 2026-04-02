| English | [日本語](README-ja.md) |
|:---:|:---:|

# PROJECT RELIC
![NPM Downloads](https://img.shields.io/npm/dt/%40ectplsm%2Frelic)

```
    ____  ________    ____________
   / __ \/ ____/ /   /  _/ ____/
  / /_/ / __/ / /    / // /
 / _, _/ /___/ /____/ // /___
/_/ |_/_____/_____/___/\____/
```

**Inject a unified AI persona with persistent memory into any coding CLI.**

Relic manages AI **Engrams** (memory + personality) and injects them across coding assistants like Claude Code, Codex CLI, and Gemini CLI. It also integrates with OpenClaw and other Claw-based agent frameworks. One persona, shared across any shell.

## Table of Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick Start](#quick-start)
- [Concepts](#concepts)
- [Shell Integration and Memory](#shell-integration-and-memory)
- [Claw Integration](#claw-integration)
- [Engram Management](#engram-management)
- [Configuration](#configuration)
- [TODO](#todo)

## Requirements

- Node.js 18 or later

## Install

<img alt="version badge" src="https://img.shields.io/github/v/release/ectplsm/relic?filter=*.*.*">

```bash
npm install -g @ectplsm/relic
```

## Quick Start

### 1. Initialize

```bash
relic init
# → Prompts: "Set a default Engram? (press Enter for "rebel", or enter ID, or "n" to skip):"

relic list                            # List available Engrams
relic config default-engram commander   # (Optional) Set your default Engram
```

### 2. Set Up Memory (MCP)

Register the MCP server so the Construct can search past conversations and distill memories. Pick your shell:

```bash
# Claude Code
claude mcp add --scope user relic -- relic-mcp

# Codex CLI
codex mcp add relic -- relic-mcp

# Gemini CLI — add to ~/.gemini/settings.json:
#   { "mcpServers": { "relic": { "command": "relic-mcp", "trust": true } } }
```

> For shell setup, approvals, and memory flow, see [Shell Integration and Memory](#shell-integration-and-memory).

### 3. Launch a Shell

```bash
relic claude                      # Uses default Engram
relic claude --engram commander   # Specify explicitly
relic codex
relic gemini
```

### 4. Organize Memories

As you use a Construct, conversation logs are automatically saved to `archive.md` by background hooks. To distill these into lasting memory, periodically tell the Construct:

> **"Organize my memories"**

The Construct will review recent conversations, extract key facts and decisions into `memory/*.md`, promote important long-term insights to `MEMORY.md`, and update your preferences in `USER.md`. These distilled memories are then loaded into future sessions automatically.

> For details on logging and memory flow, see [Shell Integration and Memory](#shell-integration-and-memory).

For install, expanded quick start, workspace layout, and sample Engrams, see [docs/getting-started.md](docs/getting-started.md).

If you are upgrading from an older Relic version, see [docs/migration.md](docs/migration.md) for sample replacement, metadata migration, and cleanup steps.

## Concepts

```text
+--------------+     +--------------+     +--------------+
|   Mikoshi    |     |    Relic     |     |    Shell     |
|  (backend)   |     |  (injector)  |     |   (AI CLI)   |
+--------------+     +--------------+     +--------------+
       ^                   |                    |
       |            sync full Engram            |
       |                   |                    |
       |             compose & inject           |
       |                   v                    v
       |            ╔═══════════╗          +---------+
       +------------║  Engram   ║--------->|Construct|
       |            ║ (persona) ║          | (live)  |
       |            ╚═══════════╝          +---------+
       |            SOUL.md              claude / codex / gemini
       |            IDENTITY.md               |
       |            USER.md                   | hooks append logs
       |            MEMORY.md                 |
       |            memory/*.md               v
       |                                +-----------+
  inject /                              |archive.md |
 extract /                              | raw logs  |
    sync                                +-----------+
       |                                      |
       v                     MCP recall       | user-triggered
 +-----------+              search/pending    | distillation
 |  OpenClaw |                                v
 |  & Claws  |                          +-----------+
 +-----------+                          | distilled |
                                        |memory/*.md|
                                        +-----------+
                                              |
                                         promote key
                                           insights
                                              v
                                       MEMORY.md / USER.md
```

For the full system model and domain terms, see [docs/concepts.md](docs/concepts.md).

## Shell Integration and Memory

Relic supports Claude Code, Codex CLI, and Gemini CLI.
Background hooks append raw conversation logs to `archive.md`, and the MCP server handles archive search and memory distillation.

For shell compatibility, hook behavior, setup, approvals, prompt inclusion, and distillation flow, see [docs/integration-and-memory.md](docs/integration-and-memory.md).

## Claw Integration

Relic can inject, extract, and sync Engrams with OpenClaw and other Claw-based frameworks.
The default rule is `Agent Name = Engram ID`, and `relic claw` handles persona transfer plus memory sync.

For command details, overwrite behavior, and the behavior matrix, see [docs/claw-integration.md](docs/claw-integration.md).

## Engram Management

For Engram creation, the smoothest path is to use your LLM with the `relic_engram_create` MCP tool. If you prefer the CLI, use `relic create`.

For LLM-assisted creation, persona authoring, template examples, and deletion rules, see [docs/engram-guide.md](docs/engram-guide.md).

## Configuration

Relic stores its runtime defaults in `~/.relic/config.json`.
Use `relic config` to manage the default Engram, Claw path, and memory window.

For command examples and precedence rules, see [docs/configuration.md](docs/configuration.md).

## TODO

- [ ] Mikoshi cloud backend (`mikoshi.ectplsm.com`)
- [ ] `relic mikoshi login` — authenticate with Mikoshi (OAuth Device Flow)
- [ ] `relic mikoshi upload` / `relic mikoshi download` / `relic mikoshi sync` — sync Engrams with Mikoshi

## License

[MIT](./LICENCE.md)
