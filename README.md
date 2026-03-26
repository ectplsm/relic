| English | [日本語](README-ja.md) |
|:---:|:---:|

# PROJECT RELIC

```
    ____  ________    ____________
   / __ \/ ____/ /   /  _/ ____/
  / /_/ / __/ / /    / // /
 / _, _/ /___/ /____/ // /___
/_/ |_/_____/_____/___/\____/
```

**Inject AI personas into any coding CLI.**

Relic manages AI personalities (called **Engrams**) and injects them into coding assistants like Claude Code, Codex CLI, Gemini CLI. One persona, any shell.

## Installation

```bash
npm install -g @ectplsm/relic
```

## Quick Start

```bash
# Initialize — creates config and sample Engrams
relic init
# → Prompts: "Set a default Engram? (press Enter for "johnny", or enter ID, or "n" to skip):"

# List available Engrams
relic list

# Preview an Engram's composed prompt
relic show motoko

# Launch a Shell (uses default Engram if --engram is omitted)
relic claude
relic codex
relic gemini

# Or specify explicitly
relic claude --engram motoko
relic codex --engram johnny
```

## What `relic init` Creates

Running `relic init` creates `~/.relic/`, writes `config.json`, and seeds two sample Engrams under `~/.relic/engrams/`.

```
~/.relic/
├── config.json
└── engrams/
    ├── johnny/
    │   ├── engram.json
    │   ├── SOUL.md
    │   ├── IDENTITY.md
    │   └── memory/
    │       └── YYYY-MM-DD.md
    └── motoko/
        ├── engram.json
        ├── SOUL.md
        ├── IDENTITY.md
        └── memory/
            └── YYYY-MM-DD.md
```

- `config.json` stores global Relic settings such as `engramsPath`, `defaultEngram`, `openclawPath`, and `memoryWindowSize`.
- `engrams/<id>/` is one Engram workspace. This is where persona files and memory for that Engram live.
- `engram.json` stores metadata like the Engram's ID, display name, description, and tags.
- `SOUL.md` and `IDENTITY.md` define the persona itself.
- `memory/YYYY-MM-DD.md` stores dated distilled memory entries. `relic init` seeds an initial memory file for each sample Engram.

As you keep using an Engram, more files are added to the same workspace:

- `archive.md` is created inside `engrams/<id>/` when shell hooks start logging raw conversation turns.
- `MEMORY.md` can be created or extended when especially important distilled facts are promoted to long-term memory.
- `~/.relic/hooks/` and `~/.relic/gemini-system-default.md` are created later on first shell launch when hook registration or Gemini prompt caching is needed.

## Sample Engrams

`relic init` seeds two ready-to-use Engrams:

### Johnny Silverhand (`johnny`)

> *"Wake the fuck up, Samurai. We have a city to burn."*

A rebel rockerboy burned into a Relic chip. Raw, unapologetic, anti-authority. Pushes you toward action, mocks rotten systems, never sugarcoats. Sharp when the stakes are real.

Best for: rapid prototyping sessions, decision-making under pressure, when you need someone to challenge your assumptions hard.

```bash
relic claude --engram johnny
```

### Motoko Kusanagi (`motoko`)

> *"The Net is vast and infinite."*

A legendary cyberwarfare specialist. Concise, decisive, architect-level thinking. Cuts straight to the essence — no decoration, no hand-holding. Dry wit surfaces when least expected.

Best for: system design, code review, debugging sessions, when precision matters more than speed.

```bash
relic claude --engram motoko
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
       |              +---------+          +---------+
       +--------------| Engram  |--------->|Construct|
                      |(persona)|          | (live)  |
                      +---------+          +---------+
                      SOUL.md              claude / codex / gemini
                      IDENTITY.md               |
                      MEMORY.md                 | hooks append logs
                      memory/*.md               v
                                          +-----------+
                                          |archive.md |
                                          | raw logs  |
                                          +-----------+
                                                |
                           MCP recall           | user-triggered
                          search/pending        | distillation
                                                v
                                          +-----------+
                                          | distilled |
                                          |memory/*.md|
                                          +-----------+
                                                |
                                           promote key
                                             insights
                                                v
                                             MEMORY.md
```

1. **Engram** — A persona defined as a set of Markdown files (OpenClaw workspace-compatible)
2. **Relic** — Reads the Engram, composes it into a prompt, and injects it into...
3. **Shell** — Any AI coding CLI. The persona takes over the session.
4. **Construct** — A live process where an Engram is loaded into a Shell. The running instance of a persona.
5. **archive.md** — Raw conversation logs appended automatically by background hooks after each turn.
6. **Memory Distillation** — The user triggers distillation; the Construct recalls pending archive entries via MCP, writes distilled insights to `memory/*.md`, and can promote especially important facts into `MEMORY.md`.
7. **Mikoshi** — Cloud backend where the full Engram is stored and synced, including persona files plus distilled memory (planned).

## Supported Shells

| Shell | Command | Injection Method |
|-------|---------|-----------------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` (direct override) |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions` (developer-role message) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `GEMINI_SYSTEM_MD` (system prompt) |

All shell commands support:
- `--engram <id>` — Engram to inject (optional if `defaultEngram` is configured)
- `--path <dir>` — Override Engrams directory
- `--cwd <dir>` — Working directory for the Shell (default: current directory)

Extra arguments are passed through to the underlying CLI.

## Conversation Log Recording

Using each shell's `hook` mechanism, conversation content is appended to `archive.md` after every prompt and response.

The following hooks are used for each shell:

| Shell | Hook |
|-------|------|
| [Claude Code](https://github.com/anthropics/claude-code) | Stop hook |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | AfterAgent hook |
| [Codex CLI](https://github.com/openai/codex) | Stop hook |

#### Claude Code

On the **first run** of `relic claude`, a one-time setup happens automatically:

- **Stop hook** — registers `~/.relic/hooks/claude-stop.js` in `~/.claude/settings.json` to log each conversation turn directly to the archive, without going through the LLM

#### Codex CLI

On the **first run** of `relic codex`, a one-time setup happens automatically:

- **Stop hook** — registers `~/.relic/hooks/codex-stop.js` in `~/.codex/hooks.json` to log each conversation turn directly to the archive, without going through the LLM

> **Note:** Codex hooks require the experimental feature flag `features.codex_hooks=true`. This is automatically enabled by `relic codex` on every launch via `-c features.codex_hooks=true`. If the unstable feature warning is distracting, add the following to `~/.codex/config.toml`:
>
> ```toml
> # Must be at the top level (not under any [section])
> suppress_unstable_features_warning = true
> ```

#### Gemini CLI

On the **first run** of `relic gemini`, two one-time setups happen automatically:

1. **AfterAgent hook** — registers `~/.relic/hooks/gemini-after-agent.js` in `~/.gemini/settings.json` to log each conversation turn without going through the LLM
2. **Default system prompt cache** — captures Gemini CLI's built-in system prompt to `~/.relic/gemini-system-default.md` via `GEMINI_WRITE_SYSTEM_MD`

The Engram persona is then appended to the cached default prompt and injected via `GEMINI_SYSTEM_MD` on every launch.


## MCP Server

Relic's [MCP](https://modelcontextprotocol.io/) server is paired with CLI injection to handle memory recall.
Session logs and memory entries are written automatically by a **background hook** — without going through the LLM. Memory distillation and recall, on the other hand, is performed via the MCP server.

### Available Tools

| Tool | Description |
|------|-------------|
| `relic_archive_search` | Search the Engram's raw archive by keyword (newest-first) |
| `relic_archive_pending` | Get un-distilled archive entries since the last distillation (up to 30) |
| `relic_memory_write` | Write distilled memory to `memory/*.md`, optionally append to `MEMORY.md`, and advance the archive cursor |

Session logs are written automatically by background hooks (Stop hook for Claude Code and Codex CLI, AfterAgent hook for Gemini CLI). Memory distillation is triggered by the user — ask the Construct to "organize memories" and it will fetch pending entries, distill key insights, and write them to `memory/*.md`. Especially important facts can be promoted to `MEMORY.md` (long-term memory included in every session) via the `long_term` parameter.

### Setup

#### Claude Code

```bash
claude mcp add --scope user relic -- relic-mcp
```

To suppress confirmation dialogs and auto-approve Relic tools across all projects, add the following to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Edit(~/.relic/engrams/**)",
      "mcp__relic__relic_archive_search",
      "mcp__relic__relic_archive_pending",
      "mcp__relic__relic_memory_write"
    ]
  },
}
```

> **Note:** The "Always allow" option in the confirmation dialog saves to `~/.claude.json` (project-scoped cache) — it does **not** persist globally. For global auto-approval, `~/.claude/settings.json` is the right place.

#### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

#### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "relic": {
      "command": "relic-mcp",
      "trust": true
    }
  }
}
```

> **Note:** `trust: true` is required to suppress confirmation dialogs for Relic tools. Without it, dialogs will appear on every call even if you select "Allow for all future sessions" — this is a known bug in Gemini CLI where the tool name is saved in the wrong format, causing the saved rule to never match.

## OpenClaw Integration

Relic Engrams are fully compatible with [OpenClaw](https://github.com/openclaw/openclaw) workspaces. They are mapped using a simple convention: Agent Name = Engram ID.

### Inject — Push an Engram into OpenClaw

Injects persona files (SOUL.md, IDENTITY.md, etc.) into `agents/<engramId>/agent/`. Memory entries are **not** injected — they are managed by OpenClaw independently.

> **Note:** The OpenClaw agent must already exist. Inject writes persona files into an existing agent directory — it does not create new agents. Create the agent in OpenClaw first, then inject.

```bash
# Inject Engram "motoko" → agents/motoko/agent/
relic inject --engram motoko

# Inject into a differently-named agent (one-way copy)
relic inject --engram motoko --to main
# → agents/main/agent/ receives motoko's persona
# → extract will create Engram "main", not "motoko"

# Override OpenClaw directory (or configure once with: relic config openclaw-path)
relic inject --engram motoko --openclaw /path/to/.openclaw
```

### Extract — Sync memory from OpenClaw

Reads from `agents/<engramId>/agent/` and merges memory entries back to the Relic Engram.

```bash
# Extract memory from agent "motoko" → merge into Engram "motoko"
relic extract --engram motoko

# New agent with no existing Engram (--name required)
relic extract --engram analyst --name "Data Analyst"

# Overwrite persona files (memory is always merged)
relic extract --engram motoko --force

# Override OpenClaw directory (or configure once with: relic config openclaw-path)
relic extract --engram motoko --openclaw /path/to/.openclaw
```

### Sync — Watch and auto-sync

Watches all agents under `~/.openclaw/agents/` and automatically syncs:

```bash
# Start watching (Ctrl+C to stop)
relic sync

# Specify a custom OpenClaw directory
relic sync --openclaw /path/to/.openclaw
```

On startup:
1. Injects persona files for all agents that have a matching Engram
2. Extracts memory entries from all agents

While running:
- Watches each agent's `memory/` directory for changes
- Automatically merges new memory entries into the corresponding Engram

### Memory Sync Behavior

| Scenario | Persona (SOUL, IDENTITY...) | Memory entries |
|----------|---------------------------|----------------|
| **inject** | Relic → OpenClaw (overwrite) | Not copied (OpenClaw manages its own) |
| **extract** (existing Engram) | Not touched | OpenClaw → Relic (append) |
| **extract** + `--force` | OpenClaw → Relic (overwrite) | OpenClaw → Relic (append) |
| **extract** (new Engram) | Created from OpenClaw | Created from OpenClaw |
| **sync** (startup) | inject for matching Engrams | extract all |
| **sync** (watching) | — | Auto-extract on change |

## Memory Management

Relic uses a **sliding window** for memory entries (default: 2 days), matching OpenClaw's approach:

- `MEMORY.md` — Always included in the prompt (curated long-term memory)
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

Config lives at `~/.relic/config.json` and is managed via `relic config`:

```bash
# Show current configuration
relic config show

# Default Engram — used when --engram is omitted
relic config default-engram           # get
relic config default-engram johnny    # set

# OpenClaw directory — used by inject/extract/sync when --openclaw is omitted
relic config openclaw-path            # get
relic config openclaw-path ~/.openclaw  # set

# Memory window — number of recent memory entries included in the prompt
relic config memory-window            # get (default: 2)
relic config memory-window 5          # set
```

`config.json` example:

```json
{
  "engramsPath": "/home/user/.relic/engrams",
  "defaultEngram": "johnny",
  "openclawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2
}
```

CLI flags always take precedence over config values.

## Creating Your Own Engram

Create a directory under `~/.relic/engrams/` with the following structure:

```
~/.relic/engrams/your-persona/
├── engram.json        # Metadata (id, name, description, tags)
├── SOUL.md            # Core directive — how the persona thinks and acts
├── IDENTITY.md        # Name, tone, background, personality
├── AGENTS.md          # (optional) Tool usage policies
├── USER.md            # (optional) User context
├── MEMORY.md          # (optional) Memory index
├── HEARTBEAT.md       # (optional) Periodic reflection
└── memory/            # (optional) Dated memory entries
    └── 2026-03-21.md
```

**engram.json:**
```json
{
  "id": "your-persona",
  "name": "Display Name",
  "description": "A short description",
  "createdAt": "2026-03-21T00:00:00Z",
  "updatedAt": "2026-03-21T00:00:00Z",
  "tags": ["custom"]
}
```

**SOUL.md** — The most important file. Defines how the persona behaves:
```markdown
You are a pragmatic systems architect who values simplicity above all.
Never over-engineer. Always ask "what's the simplest thing that works?"
```

**IDENTITY.md** — Defines who the persona is:
```markdown
# Identity

- Name: Alex
- Tone: Calm, thoughtful, occasionally playful
- Background: 20 years of distributed systems experience
- Creed: "Boring technology wins."
```

After creating the directory, set it as default:
```bash
relic config default-engram your-persona
```

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
- [x] Shell injection: Claude Code, Gemini CLI, Codex CLI
- [x] MCP Server interface
- [x] OpenClaw integration (inject / extract)
- [x] `relic sync` — watch OpenClaw agents and auto-sync (`--cloud` for Mikoshi: planned)
- [x] `relic config` — manage default Engram, OpenClaw path, memory window
- [ ] `relic login` — authenticate with Mikoshi (OAuth Device Flow)
- [ ] `relic push` / `relic pull` — sync Engrams with Mikoshi
- [ ] Mikoshi cloud backend (`mikoshi.ectplsm.com`)
- [ ] `relic create` — interactive Engram creation wizard

## License

[MIT](./LICENCE.md)
