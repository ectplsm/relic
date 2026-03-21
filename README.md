# PROJECT RELIC

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
┌─────────┐     ┌──────────┐     ┌───────────┐
│  Engram  │────▶│   Relic   │────▶│   Shell   │
│ (persona)│     │(injector) │     │  (AI CLI)  │
└─────────┘     └──────────┘     └───────────┘
  SOUL.md         compose &        claude
  IDENTITY.md     inject            gemini
  MEMORY.md                         codex
  ...                               copilot
```

1. **Engram** — A persona defined as a set of Markdown files (OpenClaw-compatible)
2. **Relic** — Reads the Engram, composes it into a prompt, and injects it into...
3. **Shell** — Any AI coding CLI. The persona takes over the session.

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
│   └── mcp/         # MCP Server (coming soon)
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
- [ ] MCP Server interface
- [ ] Mikoshi cloud backend (`mikoshi.ectplsm.com`)
- [ ] `relic create` — interactive Engram creation wizard
- [ ] `relic sync` — sync Engrams between local and Mikoshi

## License

MIT
