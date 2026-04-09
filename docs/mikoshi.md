# Mikoshi

This guide covers how Relic stores Engrams in [Mikoshi](https://mikoshi.ectplsm.com) for cloud backup, sharing, and cross-machine transfer.

Mikoshi is not the authoring source of truth.
Local Relic Engrams still own persona authoring and local archive logging.
Mikoshi stores:

- plaintext persona files: `SOUL.md`, `IDENTITY.md`
- encrypted memory files: `USER.md`, `MEMORY.md`, `memory/*.md`

Mikoshi does not currently store:

- `archive.md`

Reason:

- it may contain extremely private information

For the sync contract itself, see the shared contract repository:
[`ectplsm/engram-sync-contracts`](https://github.com/ectplsm/engram-sync-contracts).

## Prerequisites

- signed in to Mikoshi (currently Google sign-in only)
- an API key already issued from Mikoshi Settings
- a local Engram already created with Relic

If `mikoshiUrl` is not set in `~/.relic/config.json`, Relic uses `https://mikoshi.ectplsm.com` by default.
Only set `mikoshiUrl` when you need to point at a non-default deployment.

## Configure Access

Set the API key you issued from Mikoshi Settings:

```bash
relic config mikoshi-api-key <key>
```

Optional: override the base URL for a staging or local deployment:

```bash
relic config mikoshi-url http://localhost:3000
```

Optional: store a passphrase for memory encryption so you are not prompted every time:

```bash
relic config mikoshi-passphrase <passphrase>
```

That passphrase encrypts your memory bundle before upload.
Lose it, and your uploaded memory is unrecoverable.

## Command Flow

Recommended first-run flow:

```bash
relic mikoshi list
relic mikoshi status rebel
relic mikoshi push --engram rebel
relic mikoshi status rebel
```

What each step does:

- `relic mikoshi list` lists cloud Engrams visible to your API key
- `relic mikoshi status <id>` compares local persona and memory hashes against cloud state
- `relic mikoshi push <id>` creates or updates plaintext persona files on Mikoshi, then auto-syncs memory

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic mikoshi push -e <id>` | Relic → Mikoshi | Push persona + auto-sync (`--no-sync` skips sync) |
| `relic mikoshi pull -e <id>` | Mikoshi → Relic | New import or persona-only overwrite, then auto-sync that target (`--create`, `--yes`, `--no-sync`) |
| `relic mikoshi sync` | Relic ↔ Mikoshi | Bidirectional memory merge (`memory/*.md`, `MEMORY.md`, `USER.md`; `--target` limits sync to one target) |

## Persona Commands

Push local persona files:

```bash
relic mikoshi push --engram <engram-id>
```

Pull remote persona files into the local Engram:

```bash
relic mikoshi pull --engram <engram-id>
```

Create a new local Engram from Mikoshi if it does not exist yet:

```bash
relic mikoshi pull --engram <engram-id> --create
```

Notes:

- persona sync handles `SOUL.md` and `IDENTITY.md`
- successful `push` and `pull` run memory sync automatically unless you pass `--no-sync`
- `--create` creates a new local Engram from remote persona data when the local Engram does not exist yet
- `--create` uses remote `name`, `description`, and `tags`, but keeps memory sync as a separate step
- persona drift is explicit and safety-sensitive
- if the remote changed since your last check, Mikoshi rejects the overwrite with `409 Conflict`

## Sync

Normal operation:

```bash
relic mikoshi sync
```

One target only:

```bash
relic mikoshi sync --target <engram-id>
```

Notes:

- memory is treated as monotonically growing data and `sync` is the default workflow
- `sync` merges local and remote memory first, then updates whichever side is behind
- `sync` handles `USER.md`, `MEMORY.md`, and `memory/*.md`
- `sync` scans all local Engrams that also exist on Mikoshi unless you pass `--target`
- `archive.md` is never uploaded
- memory overwrite also uses optimistic concurrency and can fail with `409 Conflict`

## Advanced Memory Commands

Manual sync of one target through the legacy subcommand:

```bash
relic mikoshi memory sync <engram-id>
```

Manual upload only:

```bash
relic mikoshi memory push <engram-id>
```

Manual download only:

```bash
relic mikoshi memory pull <engram-id>
```

Notes:

- `relic mikoshi memory sync` remains for compatibility, but `relic mikoshi sync` is the main path now
- `memory push` and `memory pull` are manual fallback commands

## Status Meanings

`relic mikoshi status <engram-id>` reports persona and memory separately.

Possible states include:

- `synced`: local and remote hashes match
- `local_differs`: local and remote differ
- `remote_only`: remote persona exists but local comparison is unavailable
- `not_uploaded`: remote memory does not exist yet
- `local_empty`: no local memory files exist to compare

This split matters because Relic treats persona drift and memory drift as different problems.

## Recommended Practice

- author and edit personas locally in Relic
- use Mikoshi as cloud storage and sync backend
- push persona first, then encrypted memory
- run `relic mikoshi status` before overwriting remote state
- keep your memory passphrase somewhere safe
