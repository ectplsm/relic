# Configuration

This guide covers Relic configuration and runtime defaults.

Config lives at `~/.relic/config.json` and is managed via `relic config`.

## Commands

```bash
# Show current configuration
relic config show

# Default Engram — used when --engram is omitted
relic config default-engram           # get
relic config default-engram rebel     # set

# Claw directory — used by claw inject/extract/sync when --dir is omitted
relic config claw-path                # get
relic config claw-path ~/.openclaw    # set

# Memory window — number of recent memory entries included in the prompt
relic config memory-window            # get (default: 2)
relic config memory-window 5          # set
```

## `config.json` Example

```json
{
  "engramsPath": "/home/user/.relic/engrams",
  "defaultEngram": "rebel",
  "clawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2
}
```

## Precedence

CLI flags always take precedence over config values.
