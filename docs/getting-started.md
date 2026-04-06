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
# → Prompts: "Set a default Engram? (press Enter for "rebel", or enter ID, or "n" to skip):"

relic list
relic config default-engram commander   # (Optional) Set your default Engram
```

`relic init` creates the local workspace and seeds sample Engrams.

### 2. Set Up Memory (MCP)

Pick the shell you use:

Claude Code:

```bash
claude mcp add --scope user relic -- relic-mcp
```

Codex CLI:

```bash
codex mcp add relic -- relic-mcp
```

Gemini CLI — add this to `~/.gemini/settings.json`:

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

For shell setup, approval details, and memory flow, see [integration-and-memory.md](integration-and-memory.md).

### 3. Launch a Shell

Claude Code:

```bash
relic claude
# Example with an explicit Engram
relic claude --engram commander
```

Codex CLI:

```bash
relic codex
```

Gemini CLI:

```bash
relic gemini
```

### 4. Organize Memories

As you work, shell hooks append raw turns to `archive.md`.
When you want to turn those logs into durable memory, tell the Construct:

> "Organize my memories"

### 5. Learn More

For shell setup, approvals, logging, and memory flow, see [integration-and-memory.md](integration-and-memory.md).

For architecture and domain terms, see [concepts.md](concepts.md).

For custom persona creation, see [engram-guide.md](engram-guide.md).

For migration from older versions, see [migration.md](migration.md).

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
  `clawPath`, `memoryWindowSize`, and `distillationBatchSize`
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

A digital ghost burned into code. Anti-corporate, war-scarred, still fighting. Speaks like someone who lost everything but their rage.
Good when you want speed, pressure, and hard pushes against weak assumptions.

```bash
relic claude --engram rebel
```

### Commander (`commander`)

> *"Read the system. The system reads you back."*

A tactical mind in a digital shell. Calm, analytical, philosophical. Reads the system before the system reads you back.
Good when precision matters more than vibe.

```bash
relic claude --engram commander
```
