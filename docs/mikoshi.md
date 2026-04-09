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
relic mikoshi status -e rebel
relic mikoshi push -e rebel
relic mikoshi status -e rebel
```

What each step does:

- `relic mikoshi list` lists cloud Engrams visible to your API key
- `relic mikoshi status -e <id>` compares local persona and memory hashes against cloud state
- `relic mikoshi push -e <id>` creates or updates plaintext persona files on Mikoshi, then auto-syncs memory

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic mikoshi status -e <id>` | — | Show sync status between local and cloud |
| `relic mikoshi push -e <id>` | Relic → Mikoshi | Push persona + auto-sync (`--no-sync` skips sync) |
| `relic mikoshi pull -e <id>` | Mikoshi → Relic | New import or persona-only overwrite (`--force` to overwrite existing, `--yes`, `--no-sync`) |
| `relic mikoshi sync -e <id>` | Relic ↔ Mikoshi | Bidirectional memory merge (`memory/*.md`, `MEMORY.md`, `USER.md`; `-e` = one target, `--all` = all targets) |

## Persona Commands

Push local persona files:

```bash
relic mikoshi push --engram <engram-id>
```

Pull a remote Engram from Mikoshi (creates a new local Engram if it does not exist):

```bash
relic mikoshi pull --engram <engram-id>
```

Overwrite existing local persona files from Mikoshi:

```bash
relic mikoshi pull --engram <engram-id> --force
```

Notes:

- persona sync handles `SOUL.md` and `IDENTITY.md`
- successful `push` and `pull` run memory sync automatically unless you pass `--no-sync`
- if the local Engram does not exist, `pull` creates it from remote persona data
- if the local Engram already exists, `pull` fails unless you pass `--force`
- `--force` shows a diff and asks for confirmation before overwriting (skip with `--yes`)
- persona drift is explicit and safety-sensitive
- if the remote changed since your last check, Mikoshi rejects the overwrite with `409 Conflict`

## Sync

One target:

```bash
relic mikoshi sync --engram <engram-id>
```

All matching targets:

```bash
relic mikoshi sync --all
```

Either `--engram` or `--all` is required.

Notes:

- memory is treated as monotonically growing data and `sync` is the default workflow
- `sync` merges local and remote memory first, then updates whichever side is behind
- `sync` handles `USER.md`, `MEMORY.md`, and `memory/*.md`
- `sync --all` scans all local Engrams that also exist on Mikoshi
- `archive.md` is never uploaded
- memory overwrite also uses optimistic concurrency and can fail with `409 Conflict`
- if `sync` fails with `409 Conflict`, re-run `relic mikoshi sync` to fetch the newer remote state and merge again

## Status Meanings

`relic mikoshi status -e <engram-id>` reports persona and memory separately.

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
- push or pull persona first, then let `relic mikoshi sync` handle memory
- run `relic mikoshi status` before overwriting remote state
- keep your memory passphrase somewhere safe
