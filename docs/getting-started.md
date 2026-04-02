# Getting Started

This guide covers the first-run path for Relic.

## Install

```bash
npm install -g @ectplsm/relic
```

Relic requires Node.js 18 or later.

## Quick Start

### 1. Initialize

```bash
relic init
relic list
relic config default-engram commander
```

`relic init` creates the local workspace and seeds sample Engrams.

### 2. Register the MCP Server

Pick the shell you use:

```bash
# Claude Code
claude mcp add --scope user relic -- relic-mcp

# Codex CLI
codex mcp add relic -- relic-mcp

# Gemini CLI — add to ~/.gemini/settings.json:
#   { "mcpServers": { "relic": { "command": "relic-mcp", "trust": true } } }
```

For approval setup and shell-specific details, see [mcp.md](mcp.md).

### 3. Launch a Shell

```bash
relic claude
relic claude --engram commander
relic codex
relic gemini
```

### 4. Distill Memory

As you work, shell hooks append raw turns to `archive.md`.
When you want to turn those logs into durable memory, tell the Construct:

> "Organize my memories"

For the memory flow itself, see [memory.md](memory.md).

## What `relic init` Creates

Running `relic init` creates `~/.relic/`, writes `config.json`, and seeds two sample
Engrams under `~/.relic/engrams/`.

```text
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

- `config.json` stores global Relic settings such as `engramsPath`, `defaultEngram`,
  `clawPath`, and `memoryWindowSize`
- `engrams/<id>/` is one Engram workspace
- `engram.json` stores editable profile fields like display name, description, and tags
- `manifest.json` stores system-managed fields like the Engram ID and timestamps
- `SOUL.md` and `IDENTITY.md` define the persona itself
- `memory/YYYY-MM-DD.md` stores dated distilled memory entries

## Files Created Later

As you keep using an Engram, more files are added to the same workspace:

- `archive.md` is created inside `engrams/<id>/` when shell hooks start logging raw conversation turns
- `MEMORY.md` can be created or extended when especially important distilled facts are promoted to long-term memory
- `USER.md` is created or updated during memory distillation to record user preferences, tendencies, and work style
- `~/.relic/hooks/` and `~/.relic/gemini-system-default.md` are created later on first shell launch when hook registration or Gemini prompt caching is needed

## Sample Engrams

`relic init` seeds two ready-to-use Engrams.

### Rebel (`rebel`)

> *"Burn the manual. Write your own."*

Raw, anti-authority, impatient with bullshit.
Good when you want speed, pressure, and hard pushes against weak assumptions.

```bash
relic claude --engram rebel
```

### Commander (`commander`)

> *"Read the system. The system reads you back."*

Concise, surgical, and architect-minded.
Good when precision matters more than vibe.

```bash
relic claude --engram commander
```

## Next

- For architecture and domain terms, see [concepts.md](concepts.md).
- For migration from older versions, see [migration.md](migration.md).
- For custom persona creation, see [engram-guide.md](engram-guide.md).
