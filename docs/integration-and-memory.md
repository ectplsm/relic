# Shell Integration and Memory

This guide covers how Relic connects to shells, records raw logs, and turns them into reusable memory.

## Supported Shells

| Shell | Command | Injection Method |
|-------|---------|-----------------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` (direct override) |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions` (developer-role message) |
| [Antigravity CLI](https://github.com/google-gemini/antigravity-cli) | `relic agy` | Agentic File Load (`--prompt-interactive`) |

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
| [Antigravity CLI](https://github.com/google-gemini/antigravity-cli) | Stop hook |

### Claude Code

On the first run of `relic claude`, Relic registers `~/.relic/hooks/claude-stop.js` in `~/.claude/settings.json`.

### Codex CLI

On the first run of `relic codex`, Relic registers `~/.relic/hooks/codex-stop.js` in `~/.codex/hooks.json`.

> Codex hooks require `features.hooks=true`.
> `relic codex` enables that automatically on every launch via `-c features.hooks=true`.
> You can also enable hooks globally in `~/.codex/config.toml`:
>
> ```toml
> [features]
> hooks = true
> ```

### Antigravity CLI

On the first run of `relic agy`, Relic sets up:

1. `~/.relic/hooks/agy-stop.js` in `~/.gemini/config/hooks.json`
2. The Relic MCP server in `~/.gemini/antigravity-cli/mcp_config.json`
3. `mcp(relic/*)` in `~/.gemini/antigravity-cli/settings.json` permissions

Relic writes the compiled persona to a hidden temporary file (`.gemini/.agy-engram-tmp.md`) and instructs the AI to read it via `--prompt-interactive`. The `Stop` hook then parses `transcript.jsonl` to record the conversation into `archive.md` and deletes the temporary file.

> Known issue: Antigravity CLI 2.0 may load MCP configuration without exposing the MCP tools to the agent. When that happens, memory distillation commands such as "Organize my memories" cannot run in that session. Relic intentionally instructs the agent not to create temporary scripts or manual JSON-RPC clients as a workaround. Restart Antigravity and check `/mcp`; if the `relic` server is not active or its tools are not exposed, use Claude Code or Codex CLI for memory distillation until Antigravity's MCP tool injection stabilizes.

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

### Antigravity CLI

Add this to `~/.gemini/antigravity-cli/mcp_config.json`:

```json
{
  "mcpServers": {
    "relic": {
      "command": "/path/to/node",
      "args": [
        "/path/to/relic-mcp"
      ],
      "trust": true
    }
  }
}
```

To suppress confirmation dialogs for Relic tools, allow the Relic MCP server in `~/.gemini/antigravity-cli/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp(relic/*)"
    ]
  }
}
```

`relic agy` adds this permission automatically.

If `/mcp` does not show the `relic` server as active, or if the agent still cannot see `relic_archive_pending` and `relic_memory_write`, treat memory distillation in Antigravity as unavailable for that session. Do not work around it by asking the agent to write temporary MCP scripts into the project.
