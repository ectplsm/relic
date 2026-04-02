# MCP

This guide covers Relic's MCP server and shell integration details.

Relic uses two separate mechanisms around memory:

- background hooks append raw conversation logs to `archive.md`
- the MCP server lets the LLM search archives and distill memory on demand

Keep those responsibilities separate.
Logging should happen outside the LLM.
Recall and distillation should happen through MCP tools.

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

Using each shell's hook mechanism, conversation content is appended to `archive.md`
after every prompt and response.

The following hooks are used:

| Shell | Hook |
|-------|------|
| [Claude Code](https://github.com/anthropics/claude-code) | Stop hook |
| [Codex CLI](https://github.com/openai/codex) | Stop hook |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | AfterAgent hook |

### Claude Code

On the first run of `relic claude`, a one-time setup happens automatically:

- Stop hook — registers `~/.relic/hooks/claude-stop.js` in `~/.claude/settings.json`

### Codex CLI

On the first run of `relic codex`, a one-time setup happens automatically:

- Stop hook — registers `~/.relic/hooks/codex-stop.js` in `~/.codex/hooks.json`

> Codex hooks require the experimental feature flag `features.codex_hooks=true`.
> `relic codex` enables this automatically on every launch via
> `-c features.codex_hooks=true`.
> If you want to suppress the unstable feature warning, add this to
> `~/.codex/config.toml`:
>
> ```toml
> suppress_unstable_features_warning = true
> ```

### Gemini CLI

On the first run of `relic gemini`, two one-time setups happen automatically:

1. AfterAgent hook — registers `~/.relic/hooks/gemini-after-agent.js` in `~/.gemini/settings.json`
2. Default system prompt cache — captures Gemini CLI's built-in system prompt to `~/.relic/gemini-system-default.md` via `GEMINI_WRITE_SYSTEM_MD`

The Engram persona is then appended to the cached default prompt and injected via
`GEMINI_SYSTEM_MD` on every launch.

## MCP Server

Relic's [MCP](https://modelcontextprotocol.io/) server is paired with CLI injection
to handle memory recall and distillation.

Session logs and memory entries are written automatically by background hooks,
without going through the LLM.
Memory distillation and recall are performed via the MCP server.

## Available Tools

| Tool | Description |
|------|-------------|
| `relic_engram_create` | Create a new Engram with optional LLM-generated SOUL.md and IDENTITY.md |
| `relic_archive_search` | Search the Engram's raw archive by keyword (newest-first) |
| `relic_archive_pending` | Get un-distilled archive entries since the last distillation (up to 30) |
| `relic_memory_write` | Write distilled memory to `memory/*.md`, optionally append to `MEMORY.md`, optionally update `USER.md`, and advance the archive cursor |

Session logs are written automatically by background hooks.
Memory distillation is triggered by the user.
Ask the Construct to "organize memories" and it will fetch pending entries,
distill key insights, and write them to `memory/*.md`.
Especially important facts can be promoted to `MEMORY.md` via `long_term`.
User tendencies and preferences can be updated in `USER.md` via `user_profile`.

## Setup

### Claude Code

```bash
claude mcp add --scope user relic -- relic-mcp
```

To suppress confirmation dialogs and auto-approve Relic tools across all projects,
add the following to `~/.claude/settings.json`:

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

> The "Always allow" option in the confirmation dialog saves to `~/.claude.json`
> as a project-scoped cache.
> For global auto-approval, `~/.claude/settings.json` is the right place.

### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

To suppress confirmation dialogs and auto-approve Relic tools, add the following to
`~/.codex/config.toml`:

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

> `trust_level = "trusted"` does not cover MCP tool approvals in Codex CLI.
> Per-tool `approval_mode` is the reliable way to auto-approve MCP tools.

### Gemini CLI

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

> `trust: true` is required to suppress confirmation dialogs for Relic tools.
> Without it, Gemini CLI can keep showing dialogs because saved rules may not match correctly.
