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

Relic manages AI personalities (called **Engrams**) and injects them into coding assistants like Claude Code, Gemini CLI, Codex CLI, and GitHub Copilot CLI. One persona, any shell.

```bash
# Initialize Relic (creates ~/.relic/ with sample Engrams)
relic init

# Set a default Engram once
relic config default-engram johnny

# Launch Claude Code as Johnny — no flags needed
relic claude

# Or specify explicitly
relic claude --engram motoko
```

## How It Works

```
+--------------+     +--------------+     +--------------+
|   Mikoshi    |     |    Relic     |     |    Shell     |
|  (backend)   |     |  (injector)  |     |   (AI CLI)   |
+--------------+     +--------------+     +--------------+
       |                   |                    |
   +---------+        compose &            +---------+
   | Engram  |------> inject ------------->|Construct|
   |(persona)|                             | (live)  |
   +---------+                             +---------+
   SOUL.md                                  claude
   IDENTITY.md                              gemini
   MEMORY.md                                codex
   ...                                      copilot
```

1. **Engram** — A persona defined as a set of Markdown files (OpenClaw-compatible)
2. **Relic** — Reads the Engram, composes it into a prompt, and injects it into...
3. **Shell** — Any AI coding CLI. The persona takes over the session.
4. **Construct** — A live process where an Engram is loaded into a Shell. The running instance of a persona.
5. **Mikoshi** — Cloud backend where Engrams are stored and synced (planned).

## Installation

```bash
npm install -g @ectplsm/relic
```

## Quick Start

```bash
# Initialize — creates config and sample Engrams
relic init
# → Prompts: "Set a default Engram? (Enter ID, or press Enter to skip):"

# List available Engrams
relic list

# Preview an Engram's composed prompt
relic show motoko

# Launch a Shell (uses default Engram if --engram is omitted)
relic claude
relic gemini
relic codex

# Or specify explicitly
relic claude --engram motoko
relic gemini --engram johnny
```

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

## Supported Shells

| Shell | Command | Injection Method |
|-------|---------|-----------------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` (direct override) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `--prompt-interactive` (first message) |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `PROMPT` argument (first message) |
| [Copilot CLI](https://github.com/github/copilot-cli) | `relic copilot` | `--interactive` (first message) |

All shell commands support:
- `--engram <id>` — Engram to inject (optional if `defaultEngram` is configured)
- `--path <dir>` — Override Engrams directory
- `--cwd <dir>` — Working directory for the Shell (default: current directory)

Extra arguments are passed through to the underlying CLI.

## MCP Server

Relic runs as an [MCP](https://modelcontextprotocol.io/) server that pairs with CLI injection. The CLI injects the Engram persona at session start; the MCP server gives the running Construct tools for memory management.

```
relic claude --engram johnny   →  injects persona into Claude Code
relic-mcp (MCP server)        →  gives the Construct relic_inbox_write + relic_inbox_search
```

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
      "mcp__relic__relic_inbox_write",
      "mcp__relic__relic_inbox_search"
    ]
  }
}
```

> **Note:** The "Always allow" option in the confirmation dialog saves to `~/.claude.json` (project-scoped cache) — it does **not** persist globally. For global auto-approval, `~/.claude/settings.json` is the right place.

#### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "relic": {
      "command": "relic-mcp"
    }
  }
}
```

#### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

### Available Tools

| Tool | Description |
|------|-------------|
| `relic_inbox_write` | Write session logs and `[memory]` entries to the Engram's inbox |
| `relic_inbox_search` | Search the Engram's raw inbox by keyword (newest-first) |

The Construct calls these tools automatically during the session — `relic_inbox_write` after every response, `relic_inbox_search` when it needs to recall past context.

## OpenClaw Integration

Relic is fully compatible with [OpenClaw](https://github.com/openclaw/openclaw) workspaces. **Agent name = Engram ID** — this simple convention eliminates the need for mapping configuration.

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

This keeps prompts compact while preserving full history. The Construct can search past context on demand using the MCP tool:

```
relic_inbox_search  → keyword search across the full raw inbox (all sessions)
```

The inbox (`inbox.md`) is the primary data store — it contains all session logs and memory entries as written. The `memory/*.md` files are a distilled subset (only `[memory]`-tagged entries), used for cloud sync with Mikoshi.

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

## Architecture

Clean Architecture with dependency inversion:

```
src/
├── core/            # Business logic (no external deps except Zod)
│   ├── entities/    # Engram, Construct domain models
│   ├── usecases/    # Summon, ListEngrams, Init
│   └── ports/       # Abstract interfaces (EngramRepository, ShellLauncher)
├── adapters/        # Concrete implementations
│   ├── local/       # Local filesystem EngramRepository
│   └── shells/      # Claude, Gemini, Codex, Copilot launchers
├── interfaces/      # Entry points
│   ├── cli/         # Commander-based CLI
│   └── mcp/         # MCP Server (stdio transport)
└── shared/          # Engram composer, config management
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
- [x] Shell injection: Claude Code, Gemini CLI, Codex CLI, Copilot CLI
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
