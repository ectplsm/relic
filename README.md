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

Relic manages AI **Engrams** (memory + personality) and injects them into coding assistants like Claude Code, Codex CLI, Gemini CLI. Also integrates with OpenClaw and other Claw-based agent frameworks. One persona, any shell.

## Table of Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick Start](#quick-start)
- [Docs](#docs)
- [What `relic init` Creates](#what-relic-init-creates)
- [Sample Engrams](#sample-engrams)
- [How It Works](#how-it-works)
- [Supported Shells](#supported-shells)
- [Conversation Log Recording](#conversation-log-recording)
- [MCP Server](#mcp-server)
- [Claw Integration](#claw-integration)
- [Memory Management](#memory-management)
- [Configuration](#configuration)
- [Creating Your Own Engram](#creating-your-own-engram)
- [Deleting an Engram](#deleting-an-engram)
- [Domain Glossary](#domain-glossary)
- [Roadmap](#roadmap)

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

> For auto-approval setup and per-shell details, see [MCP Server](#mcp-server).

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

> For details on the memory system, see [Memory Management](#memory-management).

## Docs

Detailed guides are being split out of this README into focused documents:

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Engram Guide](docs/engram-guide.md)
- [Migration](docs/migration.md)
- [Memory](docs/memory.md)
- [MCP](docs/mcp.md)
- [Claw Integration](docs/claw-integration.md)
- [Glossary](docs/glossary.md)

Japanese versions live under [docs/ja/](docs/ja/).

## What `relic init` Creates

`relic init` creates the local Relic workspace, writes `config.json`, and seeds the sample Engrams.

For the file layout and what gets created later, see [docs/getting-started.md](docs/getting-started.md).

### Migration

If you are upgrading from an older Relic version, see [docs/migration.md](docs/migration.md) for sample replacement, metadata migration, and cleanup steps.

## Sample Engrams

`relic init` seeds two ready-to-use Engrams. Their SOUL.md and IDENTITY.md follow the [OpenClaw](https://github.com/openclaw/openclaw) format.

> **Existing users:** Run `relic refresh-samples` to add new sample personas. If you still have legacy samples from before v0.3.0, see [docs/migration.md](docs/migration.md) for replacement steps.

### Rebel (`rebel`)

> *"Burn the manual. Write your own."*

A digital dissident who fights the system with code. Raw, unapologetic, anti-authority. Pushes you toward action, mocks rotten systems, never sugarcoats. Sharp when the stakes are real.

Best for: rapid prototyping sessions, decision-making under pressure, when you need someone to challenge your assumptions hard.

```bash
relic claude --engram rebel
```

### Commander (`commander`)

> *"Read the system. The system reads you back."*

A cyber operations specialist with architect-level thinking. Concise, decisive, surgically precise. Cuts straight to the essence — no decoration, no hand-holding. Dry wit surfaces when least expected.

Best for: system design, code review, debugging sessions, when precision matters more than speed.

```bash
relic claude --engram commander
```

## How It Works

```
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

1. **Engram** — A persona defined as a set of Markdown files (OpenClaw workspace-compatible). The central data that everything else revolves around.
2. **Relic** — Reads the Engram, composes it into a prompt, and injects it into...
3. **Shell** — Any AI coding CLI. The persona takes over the session.
4. **Construct** — A live process where an Engram is loaded into a Shell. The running instance of a persona.
5. **archive.md** — Raw conversation logs appended automatically by background hooks after each turn.
6. **Memory Distillation** — The user triggers distillation; the Construct recalls pending archive entries via MCP, writes distilled insights to `memory/*.md`, and can promote especially important facts to `MEMORY.md` or update user preferences in `USER.md`.
7. **OpenClaw & Claws** — Engrams can be injected into, extracted from, and synced with OpenClaw and other Claw-based agent frameworks via `relic claw`.
8. **Mikoshi** — Cloud backend where the full Engram is stored and synced, including persona files plus distilled memory (planned).

## MCP and Shell Integration

Relic supports Claude Code, Codex CLI, and Gemini CLI.
Background hooks append raw conversation logs to `archive.md`, while the MCP server handles archive search and memory distillation.

For shell compatibility, hook behavior, MCP tools, setup, and approval details, see [docs/mcp.md](docs/mcp.md).

## Claw Integration

Relic can inject, extract, and sync Engrams with OpenClaw and other Claw-based frameworks.
The default rule is `Agent Name = Engram ID`, and `relic claw` handles persona transfer plus memory sync.

For command details, overwrite behavior, and the behavior matrix, see [docs/claw-integration.md](docs/claw-integration.md).

## Memory Management

Relic keeps raw session logs in `archive.md` and distilled memory in `memory/*.md`,
with `MEMORY.md` and `USER.md` always included in future sessions.

For sliding window behavior, distillation flow, and MCP memory tools, see [docs/memory.md](docs/memory.md).

## Configuration

Relic stores its runtime defaults in `~/.relic/config.json`.
Use `relic config` to manage the default Engram, Claw path, and memory window.

For command examples and precedence rules, see [docs/configuration.md](docs/configuration.md).

## Creating Your Own Engram

Use your LLM plus the `relic_engram_create` MCP tool for the smoothest flow, or `relic create` if you prefer the CLI.

For LLM-assisted creation, persona authoring, template examples, and deletion rules, see [docs/engram-guide.md](docs/engram-guide.md).

## Deleting an Engram

See [docs/engram-guide.md](docs/engram-guide.md).

## Domain Glossary

| Term | Role | Description |
|------|------|-------------|
| **Relic** | Injector | The core system. Adapts personas to any AI interface. |
| **Mikoshi** | Backend | Cloud fortress where all Engrams are stored (planned). |
| **Engram** | Data | A persona dataset — a set of Markdown files. |
| **Shell** | LLM | An AI CLI (Claude, Gemini, etc). A vessel with pure compute. |
| **Construct** | Process | A live process where an Engram is loaded into a Shell. |

## Roadmap

- [x] CLI with init, list, show commands
- [x] Shell injection: Claude Code, Codex CLI, Gemini CLI
- [x] MCP Server interface
- [x] Claw integration (inject / extract / sync)
- [x] `relic claw sync` — bidirectional memory sync with Claw workspaces
- [x] `relic config` — manage default Engram, Claw path, memory window
- [x] `relic create` — interactive Engram creation wizard + MCP tool
- [x] `relic delete` — safe Engram deletion with memory-aware confirmation
- [ ] Mikoshi cloud backend (`mikoshi.ectplsm.com`)
- [ ] `relic mikoshi login` — authenticate with Mikoshi (OAuth Device Flow)
- [ ] `relic mikoshi upload` / `relic mikoshi download` / `relic mikoshi sync` — sync Engrams with Mikoshi

## License

[MIT](./LICENCE.md)
