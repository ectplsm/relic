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

Relic Engrams are natively compatible with [OpenClaw](https://github.com/openclaw/openclaw) workspaces — their file structure maps 1:1 (SOUL.md, IDENTITY.md, memory/, etc.). For other Claw-derived frameworks (Nanobot, gitagent, etc.) that fold identity into SOUL.md, the `--merge-identity` flag merges IDENTITY.md into SOUL.md on inject. Combined with `--dir`, Relic can target any Claw-compatible workspace.

Current rule: **Agent Name = Engram ID**. Relic treats them as the same name by default. This keeps Claw integration simple: once Engram and agent names diverge, Relic has to introduce explicit mapping logic, which adds complexity that the current workflow does not need.

All Claw commands live under `relic claw`:

### Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic claw inject -e <id>` | Relic → Claw | Push persona + auto-sync (`--yes` skips overwrite confirmation, `--no-sync` skips sync, `--merge-identity` for non-OpenClaw) |
| `relic claw extract -a <name>` | Claw → Relic | New import or persona-only overwrite, then auto-sync that target (`--force`, `--yes`, `--no-sync`) |
| `relic claw sync` | Relic ↔ Claw | Bidirectional merge (memory, MEMORY.md, USER.md; `--target` limits sync to one target) |

### Inject — Push an Engram into a Claw workspace

Writes the persona files (`SOUL.md`, `IDENTITY.md`) into the agent workspace, then syncs `USER.md` and memory files (`MEMORY.md`, `memory/*.md`). The sync is bidirectional and merge-based, not a blind overwrite. `AGENTS.md` and `HEARTBEAT.md` remain under Claw's control.

If persona files already exist in the target workspace and differ from the local Relic Engram, `inject` asks for confirmation by default. Use `--yes` to skip the prompt. If the target persona already matches, Relic skips the persona rewrite and only runs the memory sync.

> **Note:** The Claw agent must already exist (e.g. `openclaw agents add <name>`). Inject writes persona files into an existing workspace — it does not create new agents.

```bash
# Inject Engram "commander" → workspace-commander/
relic claw inject --engram commander

# Override Claw directory (or configure once with: relic config claw-path)
relic claw inject --engram commander --dir /path/to/.fooclaw

# Non-OpenClaw frameworks: merge IDENTITY.md into SOUL.md
relic claw inject --engram commander --dir ~/.nanobot --merge-identity

# Skip overwrite confirmation if persona files differ
relic claw inject --engram commander --yes
```

### Extract — Import a Claw agent as an Engram

Creates a new Engram from an existing Claw agent workspace.

What `extract` writes locally:
- New extract: `engram.json`, `manifest.json`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/*.md`
- `extract --force`: only `SOUL.md` and `IDENTITY.md`
- `extract --force --name`: `SOUL.md`, `IDENTITY.md`, and `engram.json.name`

After `extract`, Relic automatically runs a targeted sync for that same Engram/agent target. Use `--no-sync` to skip it.

```bash
# Extract from the default (main) agent
relic claw extract

# Extract from a named agent
relic claw extract --agent rebel

# Set a custom display name
relic claw extract --agent analyst --name "Data Analyst"

# Overwrite local persona files from the Claw workspace
relic claw extract --agent rebel --force

# Skip overwrite confirmation
relic claw extract --agent rebel --force --yes

# Skip the automatic targeted sync after extract
relic claw extract --agent rebel --no-sync

# Override Claw directory
relic claw extract --agent rebel --dir /path/to/.fooclaw
```

### Sync — Bidirectional merge

Merges `memory/*.md`, `MEMORY.md`, and `USER.md` between matching Engram/agent targets. Only targets where both the Engram and agent exist are synced. Also runs automatically after `inject` (skip with `--no-sync`).

By default, `sync` scans all matching targets. Use `--target <id>` to sync only one target by shared Engram/agent name.

```bash
# Sync all matching targets
relic claw sync

# Sync only one matching target
relic claw sync --target rebel

# Override Claw directory
relic claw sync --dir /path/to/.fooclaw
```

Merge rules:
- Files only on one side → copied to the other
- Same content → skipped
- Different content → merged (deduplicated) and written to both sides

### Behavior Matrix

| Command | State | Flags | Result |
|---------|------|------|------|
| `inject` | Workspace missing | none | Fail and ask you to create the agent first |
| `inject` | Persona matches local Engram | none | Skip persona rewrite, then auto-sync that target |
| `inject` | Persona differs from local Engram | none | Ask for confirmation before overwriting persona, then auto-sync that target |
| `inject` | Persona differs from local Engram | `--yes` | Overwrite persona without confirmation, then auto-sync that target |
| `inject` | any successful inject | `--no-sync` | Skip the automatic targeted sync |
| `extract` | Local Engram missing | none | Create a new Engram from workspace files, then auto-sync that target |
| `extract` | Local Engram missing | `--force` | Same as normal new extract, then auto-sync that target |
| `extract` | Local Engram exists | none | Fail and require `--force` |
| `extract` | Local Engram exists, no persona drift | `--force` | Skip persona overwrite, then auto-sync that target |
| `extract` | Local Engram exists, persona differs | `--force` | Ask for confirmation before overwriting `SOUL.md` / `IDENTITY.md`, then auto-sync that target |
| `extract` | Local Engram exists, persona differs | `--force --yes` | Overwrite `SOUL.md` / `IDENTITY.md` without confirmation, then auto-sync that target |
| `extract` | any successful extract | `--no-sync` | Skip the automatic targeted sync |
| `sync` | no target | none | Scan and sync all matching targets |
| `sync` | explicit target | `--target <id>` | Sync one matching target where `agentName = engramId` |

Notes:
- "Persona" means `SOUL.md` and `IDENTITY.md`
- `extract --force` only overwrites `SOUL.md` and `IDENTITY.md`
- `extract --force` does not overwrite `USER.md`, `MEMORY.md`, or `memory/*.md`
- If `--name` is provided together with `extract --force`, Relic also updates `engram.json.name`

## Memory Management

Relic uses a **sliding window** for memory entries (default: 2 days), matching OpenClaw's approach:

- `MEMORY.md` — Always included in the prompt (curated long-term memory — objective facts and rules)
- `USER.md` — Always included in the prompt (user profile — preferences, tendencies, work style)
- `memory/today.md` + `memory/yesterday.md` — Always included (configurable window)
- Older entries — **Not included in the prompt**, but searchable via MCP

This keeps prompts compact while preserving full history. The Construct can recall and distill past context using MCP tools:

```
relic_archive_search   → keyword search across the full raw archive (all sessions)
relic_archive_pending  → get un-distilled entries for memory distillation
relic_memory_write     → write distilled memory and advance the cursor
```

The archive (`archive.md`) is the primary data store — it contains all session logs as written. The `memory/*.md` files are distilled from the archive by the Construct when the user triggers memory organization, and are used for cloud sync with Mikoshi.

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
