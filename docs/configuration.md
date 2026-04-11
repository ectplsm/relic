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

# Claw directory — used by claw push/pull/sync when --dir is omitted
relic config claw-path                # get
relic config claw-path ~/.openclaw    # set

# Memory window — number of recent memory entries included in the prompt
relic config memory-window            # get (default: 2)
relic config memory-window 5          # set

# Distillation batch size — number of archive entries distilled at once
relic config distillation-batch-size      # get (default: 100)
relic config distillation-batch-size 50   # set

# Mikoshi API key — required for Mikoshi access
relic config mikoshi-api-key                  # get
relic config mikoshi-api-key <key>            # set

# Mikoshi passphrase — optional, but recommended, for memory encryption
relic config mikoshi-passphrase               # get
relic config mikoshi-passphrase <passphrase>  # set

# Mikoshi URL — developer use only, for staging or local deployments
relic config mikoshi-url                      # get
relic config mikoshi-url http://localhost:3000 # set
```

## `config.json` Example

```json
{
  "engramsPath": "/home/user/.relic/engrams",
  "defaultEngram": "rebel",
  "clawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2,
  "distillationBatchSize": 100,
  "mikoshiApiKey": "<your-api-key>",
  "mikoshiPassphrase": "<your-passphrase>",
  "mikoshiUrl": "https://mikoshi.ectplsm.com"
}
```

## Mikoshi Notes

- `mikoshiApiKey` is required to use Mikoshi commands.
- `mikoshiPassphrase` is optional, but recommended if you do not want to enter it every time.
- Memory data is encrypted locally before upload. Mikoshi stores only the encrypted payload, not the plaintext.
- `mikoshiUrl` usually does not need to be changed unless you are targeting staging or local development.

## Precedence

CLI flags always take precedence over config values.
