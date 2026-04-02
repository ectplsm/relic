# Memory

This guide covers how Relic stores, recalls, and distills memory.

Relic uses a sliding window for memory entries, matching OpenClaw's approach.

## Prompt Inclusion

- `MEMORY.md` — Always included in the prompt
  - curated long-term memory
  - objective facts and rules
- `USER.md` — Always included in the prompt
  - user profile
  - preferences, tendencies, and work style
- `memory/today.md` + `memory/yesterday.md` — Always included by default
  - the window size is configurable
- Older entries — Not included in the prompt
  - still searchable via MCP

This keeps prompts compact while preserving full history.

## Archive vs Distilled Memory

- `archive.md` is the primary raw log store
- `memory/*.md` holds distilled memory extracted from the archive
- `MEMORY.md` holds especially important long-term facts
- `USER.md` holds user-specific preferences and work style

Raw logs are appended by background hooks.
Distilled memory is written later when the user triggers memory organization.

## Distillation Tools

The Construct can recall and distill past context using MCP tools:

```text
relic_archive_search   → keyword search across the full raw archive
relic_archive_pending  → get un-distilled entries for memory distillation
relic_memory_write     → write distilled memory and advance the cursor
```

## Distillation Flow

1. Background hooks append raw turns to `archive.md`
2. The user asks the Construct to organize memories
3. The Construct fetches pending archive entries via MCP
4. Key insights are distilled into `memory/*.md`
5. Especially important facts can be promoted to `MEMORY.md`
6. User tendencies can be updated in `USER.md`

These distilled memory files are then included in future system prompts according to the configured memory window.
