# Mikoshi

This guide covers how Relic stores Engrams in [Mikoshi](https://mikoshi.ectplsm.com) for cloud backup, sharing, and cross-machine transfer.

Personas are authored locally in Relic, not in Mikoshi.
Local Relic Engrams still own persona authoring and local archive logging.
Mikoshi stores:

- plaintext persona files: `SOUL.md`, `IDENTITY.md`
- encrypted memory files: `USER.md`, `MEMORY.md`, `memory/*.md`

Memory data is end-to-end encrypted before upload. Mikoshi stores only the encrypted payload, not the plaintext.

Mikoshi does not currently store:

- `archive.md`

Reason:

- it may contain extremely private information

For the sync contract itself, see the shared contract repository:
[`ectplsm/engram-sync-contracts`](https://github.com/ectplsm/engram-sync-contracts).

## Before You Start

- signed in to Mikoshi (currently Google sign-in only)
- a local Engram already created with Relic

If `mikoshiUrl` is not set in `~/.relic/config.json`, Relic uses `https://mikoshi.ectplsm.com` by default.
Only set `mikoshiUrl` when you need to point at a non-default deployment.

## Create and Configure an API Key

Create an API key in Mikoshi Settings, then save it into Relic:

1. Open [Mikoshi Settings](https://mikoshi.ectplsm.com/settings).
2. Sign in if needed.
3. Go to the API key section.
4. Create a new API key and copy the generated value. **Important: this value is shown only once.**
5. Save it into Relic:

```bash
relic config mikoshi-api-key <key>
```

Optional, but recommended: store a passphrase for memory encryption so you are not prompted every time:

```bash
relic config mikoshi-passphrase <passphrase>
```

This passphrase encrypts your memory bundle locally before upload.
Mikoshi never receives the plaintext memory contents.
**Lose it, and your uploaded memory is unrecoverable.** Keep it somewhere safe.

Developer use only: override the base URL for a staging or local deployment:

```bash
relic config mikoshi-url http://localhost:3000
```

## Command Flow

Push your first Engram:

```bash
relic mikoshi push -e rebel
relic mikoshi status -e rebel
```

On another machine, pull it:

```bash
relic mikoshi list
relic mikoshi pull -e rebel
```

What each command does:

- `relic mikoshi push -e <id>` creates or updates persona files on Mikoshi and auto-syncs memory
- `relic mikoshi status -e <id>` compares local persona and memory hashes against cloud state
- `relic mikoshi list` lists cloud Engrams visible to your API key
- `relic mikoshi pull -e <id>` creates or updates the local Engram from Mikoshi

Avatar behavior:

- avatar references are configured in the OpenClaw-compatible `IDENTITY.md` field: `- **Avatar:** <value>`
- if `IDENTITY.md` contains `- **Avatar:** ./avatar.png` or an absolute image path, `push` uploads that local image to Mikoshi
- if `IDENTITY.md` contains `- **Avatar:** https://...`, `push` fetches the image client-side and then uploads the fetched bytes to Mikoshi
- `http://` avatar URLs are rejected
- if `pull` sees a remote `avatarUrl` but no valid local avatar file, it rewrites the local `Avatar` line to the Mikoshi-hosted URL
- successful avatar uploads are snapshotted into Mikoshi-managed storage; the external origin URL is not exposed as the served avatar

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic mikoshi status -e <id>` | — | Show sync status between local and cloud |
| `relic mikoshi push -e <id>` | Relic → Mikoshi | Create or update remote persona + auto-sync (`--yes`, `--no-sync`) |
| `relic mikoshi pull -e <id>` | Mikoshi → Relic | Create or update local persona + auto-sync (`--yes`, `--no-sync`) |
| `relic mikoshi sync -e <id>` | Relic ↔ Mikoshi | Bidirectional memory merge (`memory/*.md`, `MEMORY.md`, `USER.md`; `-e` = one target, `--all` = all targets) |

## Persona Commands

Push local persona files to Mikoshi:

```bash
relic mikoshi push --engram <engram-id>
```

Pull persona files from Mikoshi into Relic:

```bash
relic mikoshi pull --engram <engram-id>
```

Notes:

- persona commands handle `SOUL.md` and `IDENTITY.md`
- successful `push` and `pull` run memory sync automatically unless you pass `--no-sync`
- `push` creates the remote Engram if it does not exist, and asks before creating or overwriting unless you pass `--yes`
- `pull` creates the local Engram if it does not exist, and asks before creating or overwriting unless you pass `--yes`
- `pull` shows persona drift before overwriting existing local files
- avatar changes are handled as part of persona `push` / `pull`
- `push` shows avatar-specific confirmation, skip reasons, and URL fetch/upload progress when applicable
- persona drift is explicit and safety-sensitive
- if the remote changed since your last `push` check, Mikoshi rejects the overwrite with `409 Conflict`

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
- use `push` when Relic should win, `pull` when Mikoshi should win
- run `relic mikoshi status` before overwriting remote state
- keep your memory passphrase somewhere safe
