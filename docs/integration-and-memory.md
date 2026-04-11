# Shell Integration and Memory

This guide covers how Relic connects to shells, records raw logs, and turns them into reusable memory.

## Supported Shells

| Shell | Command | Injection Method |
|-------|---------|-----------------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` (direct override) |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions` (developer-role message) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `GEMINI_SYSTEM_MD` (system prompt) |

All shell commands support:

- `--engram <id>` — Engram to inject (optional if `defaultEngram` is configured)
- `--path <dir>` — Override Engrams directory
- `--cwd <dir>` — Working directory for the shell (default: current directory)

Extra arguments are passed through to the underlying CLI.

## Raw Log Recording

Relic uses each shell's hook mechanism to append prompt and response pairs to `archive.md`.

| Shell | Hook |
|-------|------|
| [Claude Code](https://github.com/anthropics/claude-code) | Stop hook |
| [Codex CLI](https://github.com/openai/codex) | Stop hook |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | AfterAgent hook |

### Claude Code

On the first run of `relic claude`, Relic registers `~/.relic/hooks/claude-stop.js` in `~/.claude/settings.json`.

### Codex CLI

On the first run of `relic codex`, Relic registers `~/.relic/hooks/codex-stop.js` in `~/.codex/hooks.json`.

> Codex hooks require `features.codex_hooks=true`.
> `relic codex` enables that automatically on every launch via `-c features.codex_hooks=true`.
> If you want to suppress the unstable feature warning, add this to `~/.codex/config.toml`:
>
> ```toml
> suppress_unstable_features_warning = true
> ```

### Gemini CLI

On the first run of `relic gemini`, Relic sets up:

1. `~/.relic/hooks/gemini-after-agent.js` in `~/.gemini/settings.json`
2. `~/.relic/gemini-system-default.md` as a cache of Gemini CLI's built-in system prompt

After that, Relic appends the Engram persona to the cached prompt and injects it through `GEMINI_SYSTEM_MD`.

## MCP Server

Relic's [MCP](https://modelcontextprotocol.io/) server handles archive recall and memory distillation.

The split is deliberate:

- background hooks write raw logs without involving the LLM
- MCP tools let the LLM search archives and distill memory on demand

## Available Tools

| Tool | Description |
|------|-------------|
| `relic_engram_create` | Create a new Engram with optional LLM-generated SOUL.md and IDENTITY.md |
| `relic_archive_search` | Search the Engram's raw archive by keyword |
| `relic_archive_pending` | Get un-distilled archive entries since the last distillation |
| `relic_memory_write` | Write distilled memory, including multi-date writes with explicit skipped dates, update `MEMORY.md` or `USER.md`, and advance the archive cursor |

## Memory Model

Relic uses a sliding window for memory entries, matching OpenClaw's approach.

### Prompt Inclusion

- `MEMORY.md` — Always included
- `USER.md` — Always included
- recent `memory/*.md` entries — Included according to the configured memory window
- older entries — Not included in prompts, but still searchable via MCP

This keeps prompts compact while preserving full history.

### Archive vs Distilled Memory

- `archive.md` is the primary raw log store
- `memory/*.md` holds distilled memory extracted from the archive
- `MEMORY.md` holds especially important long-term facts
- `USER.md` holds user-specific preferences and work style

## Distillation Flow

1. Hooks append raw turns to `archive.md`
2. The user asks the Construct to organize memories
3. The Construct fetches pending archive entries via MCP
4. Key insights are grouped by the actual dates recorded in `archive.md` and distilled into the matching `memory/*.md`
5. Especially important facts can be promoted to `MEMORY.md`
6. User tendencies can be updated in `USER.md`

These distilled files are then included in future system prompts according to the configured memory window.

## Setup MCP

### Claude Code

```bash
claude mcp add --scope user relic -- relic-mcp
```

To suppress confirmation dialogs and auto-approve Relic tools across all projects, add this to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Edit(~/.relic/engrams/**)",
      "mcp__relic__relic_engram_create",
      "mcp__relic__relic_archive_search",
      "mcp__relic__relic_archive_pending",
      "mcp__relic__relic_memory_write"
    ]
  }
}
```

### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

To auto-approve Relic tools, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.relic.tools.relic_engram_create]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_archive_search]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_archive_pending]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_memory_write]
approval_mode = "approve"
```

> `trust_level = "trusted"` does not cover MCP approvals in Codex CLI.
> Per-tool `approval_mode` is the reliable path.

### Gemini CLI

Add this to `~/.gemini/settings.json`:

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

> `trust: true` is required if you want to suppress confirmation dialogs for Relic tools.
