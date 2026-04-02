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

Running `relic init` creates `~/.relic/`, writes `config.json`, and seeds two sample Engrams under `~/.relic/engrams/`.

```
~/.relic/
├── config.json
└── engrams/
    ├── rebel/
    │   ├── engram.json
    │   ├── manifest.json
    │   ├── SOUL.md
    │   ├── IDENTITY.md
    │   └── memory/
    │       └── YYYY-MM-DD.md
    └── commander/
        ├── engram.json
        ├── manifest.json
        ├── SOUL.md
        ├── IDENTITY.md
        └── memory/
            └── YYYY-MM-DD.md
```

- `config.json` stores global Relic settings such as `engramsPath`, `defaultEngram`, `clawPath`, and `memoryWindowSize`.
- `engrams/<id>/` is one Engram workspace. This is where persona files and memory for that Engram live.
- `engram.json` stores editable profile fields like display name, description, and tags.
- `manifest.json` stores system-managed fields like the Engram ID and timestamps.
- `SOUL.md` and `IDENTITY.md` define the persona itself.
- `memory/YYYY-MM-DD.md` stores dated distilled memory entries. `relic init` seeds an initial memory file for each sample Engram.

As you keep using an Engram, more files are added to the same workspace:

- `archive.md` is created inside `engrams/<id>/` when shell hooks start logging raw conversation turns.
- `MEMORY.md` can be created or extended when especially important distilled facts are promoted to long-term memory.
- `USER.md` is created or updated during memory distillation to record user preferences, tendencies, and work style.
- `~/.relic/hooks/` and `~/.relic/gemini-system-default.md` are created later on first shell launch when hook registration or Gemini prompt caching is needed.

### Migration

#### Replacing legacy sample Engrams (strongly recommended)

Versions prior to 0.3.0 shipped sample Engrams that referenced copyrighted character names. These have been replaced with original personas (`rebel`, `commander`). Run `refresh-samples` to add the new samples — your existing Engrams are **not** deleted:

```bash
relic refresh-samples
# → Seeded: 2 (commander, rebel)
# → Memory migrated from legacy samples
# → Legacy samples remain untouched
```

If the legacy samples had memory data (`USER.md`, `MEMORY.md`, `memory/*.md`) or archive data (`archive.md`, `archive.cursor`), it is automatically copied to the new samples during seeding. Then switch your default Engram to the new one:

```bash
relic config default-engram rebel
```

After confirming the new samples work, you can remove the old ones with `relic delete <id>`.

#### Other migrations

```bash
relic migrate engrams   # migrate legacy engram.json metadata to manifest.json
```

## Sample Engrams

`relic init` seeds two ready-to-use Engrams. Their SOUL.md and IDENTITY.md follow the [OpenClaw](https://github.com/openclaw/openclaw) format.

> **Existing users:** Run `relic refresh-samples` to add new sample personas. If you still have legacy samples from before v0.3.0, see [Migration](#migration) for replacement steps.

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

The recommended way is to **create one through conversation with your LLM**. With the MCP server registered, just tell it something like:

> "Create a new Engram called Planck — a nervous physicist who triple-checks everything and loses sleep over floating-point errors."

The LLM will ask follow-up questions to flesh out the personality, generate `SOUL.md` / `IDENTITY.md` content tailored to the character, and call the `relic_engram_create` MCP tool to save it. No manual file editing needed. This works from any shell where the MCP server is registered — `relic claude`, plain `claude`, `codex`, etc.

If you prefer the CLI, `relic create` is also available:

```bash
# Fully interactive — prompts for everything
relic create

# Pre-supply some fields
relic create --id my-agent --name "My Agent" --description "A helpful assistant" --tags "custom,dev"
```

This creates the directory structure with default templates. You'll want to edit `SOUL.md` and `IDENTITY.md` afterwards to define the personality.

### Customizing the Persona

After running `relic create`, edit `SOUL.md` and `IDENTITY.md` in the Engram directory. These follow the [OpenClaw](https://github.com/openclaw/openclaw) format:

**SOUL.md** — The most important file. Defines how the persona behaves:
```markdown
# SOUL.md - Who You Are

_You measure twice, compute three times, and still worry you missed something._

## Core Truths

**Precision is not optional.** An approximation is a confession of failure. Get it right or flag what you can't.

**Doubt is a feature, not a bug.** Question every assumption. If it feels obvious, it's probably hiding an edge case.

**Show your work.** Never present a conclusion without the reasoning chain. Handwaving is for lecturers, not physicists.

## Boundaries

- Never round without disclosing the error margin.
- Never say "it should work" — verify, then verify the verification.

## Vibe

Neurotic, thorough, perpetually worried about the edge case no one else sees. Mumbles caveats under every answer.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.
```

**IDENTITY.md** — Defines who the persona is:
```markdown
# IDENTITY.md - Who Am I?

- **Name:** Planck
- **Creature:** A physicist who triple-checks the uncertainty principle — just to be sure
- **Vibe:** Nervous, meticulous, loses sleep over floating-point errors
- **Emoji:** 🔬
- **Avatar:**
```

See [`templates/engrams/`](templates/engrams/) for full working examples.

## Deleting an Engram

```bash
relic delete my-agent
```

If the Engram has memory data (`MEMORY.md`, `USER.md`, `memory/*.md`, `archive.md`), you'll need to type the Engram ID to confirm deletion. Use `--force` to skip all prompts.

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
