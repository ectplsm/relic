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

# Launch Claude Code as Johnny Silverhand
relic claude --engram johnny

# Launch Gemini CLI as Motoko Kusanagi
relic gemini --engram motoko
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
git clone https://github.com/ectplsm/relic.git
cd relic
npm install
npm link
```

## Quick Start

```bash
# Initialize — creates config and sample Engrams
relic init

# List available Engrams
relic list

# Preview an Engram's composed prompt
relic show motoko

# Launch a Shell with an Engram injected
relic claude --engram motoko
relic gemini --engram johnny
relic codex --engram motoko
relic copilot --engram johnny
```

## Supported Shells

| Shell | Command | Injection Method |
|-------|---------|-----------------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` (direct override) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `--prompt-interactive` (first message) |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `PROMPT` argument (first message) |
| [Copilot CLI](https://github.com/github/copilot-cli) | `relic copilot` | `--interactive` (first message) |

All shell commands support:
- `--engram <id>` (required) — Engram to inject
- `--path <dir>` — Override Engrams directory
- `--cwd <dir>` — Working directory for the Shell (default: current directory)

Extra arguments are passed through to the underlying CLI.

## MCP Server

Relic also runs as an [MCP](https://modelcontextprotocol.io/) server, allowing any MCP-compatible client (like Claude Desktop) to access Engrams directly.

### Setup (Claude Desktop)

1. Build the project:
   ```bash
   npm run build
   ```

2. Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
   ```json
   {
     "mcpServers": {
       "relic": {
         "command": "node",
         "args": ["/path/to/relic/dist/interfaces/mcp/index.js"]
       }
     }
   }
   ```

3. Restart Claude Desktop.

### Available Tools

| Tool | Description |
|------|-------------|
| `relic_init` | Initialize `~/.relic/` with config and sample Engrams |
| `relic_list` | List all available Engrams |
| `relic_show` | Preview an Engram's composed prompt |
| `relic_summon` | Summon an Engram and return the persona prompt for injection |
| `relic_inject` | Inject an Engram into an OpenClaw workspace |
| `relic_extract` | Extract an Engram from an OpenClaw workspace |
| `relic_memory_search` | Search an Engram's memory entries by keyword |
| `relic_memory_get` | Get a specific memory entry by date |
| `relic_memory_list` | List all memory entry dates for an Engram |

## OpenClaw Integration

Relic is fully compatible with [OpenClaw](https://github.com/openclaw/openclaw) workspaces. **Agent name = Engram ID** — this simple convention eliminates the need for mapping configuration.

### Inject — Push an Engram into OpenClaw

Injects persona files (SOUL.md, IDENTITY.md, etc.) into `agents/<engramId>/agent/`. Memory entries are **not** injected — they are managed by OpenClaw independently.

```bash
# Inject Engram "motoko" → agents/motoko/agent/
relic inject --engram motoko

# Specify a custom OpenClaw directory
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

# Extract from a custom OpenClaw directory
relic extract --engram motoko --openclaw /path/to/.openclaw
```

### Memory Sync Behavior

| Scenario | Persona (SOUL, IDENTITY...) | Memory entries |
|----------|---------------------------|----------------|
| **inject** | Relic → OpenClaw (overwrite) | Not copied (OpenClaw manages its own) |
| **extract** (existing Engram) | Not touched | OpenClaw → Relic (append) |
| **extract** + `--force` | OpenClaw → Relic (overwrite) | OpenClaw → Relic (append) |
| **extract** (new Engram) | Created from OpenClaw | Created from OpenClaw |

## Memory Management

Relic uses a **2-day sliding window** for memory entries, matching OpenClaw's approach:

- `MEMORY.md` — Always included in the prompt (curated long-term memory)
- `memory/today.md` + `memory/yesterday.md` — Always included
- Older entries — **Not included in the prompt**, but accessible via MCP tools

This keeps prompts compact while preserving full history. AI clients (like Claude Desktop) can use the memory tools to search or retrieve older entries on demand:

```
relic_memory_search  → keyword search across all entries
relic_memory_get     → fetch a specific date's entry
relic_memory_list    → list all available dates
```

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

## Configuration

Config lives at `~/.relic/config.json`:

```json
{
  "engramsPath": "/home/user/.relic/engrams"
}
```

Priority: CLI `--path` flag > config file > default (`~/.relic/engrams`)

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
- [ ] Mikoshi cloud backend (`mikoshi.ectplsm.com`)
- [ ] `relic create` — interactive Engram creation wizard
- [ ] `relic sync` — bidirectional sync between Relic and OpenClaw / Mikoshi

## License

[MIT](./LICENCE.md)
