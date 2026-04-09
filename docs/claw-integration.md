# Claw Integration

This guide covers `relic claw` workflows.

Relic Engrams are natively compatible with [OpenClaw](https://github.com/openclaw/openclaw)
workspaces because their file structure maps 1:1 (`SOUL.md`, `IDENTITY.md`, `memory/`, etc.).

For other Claw-derived frameworks (Nanobot, gitagent, etc.) that fold identity into
`SOUL.md`, the `--merge-identity` flag merges `IDENTITY.md` into `SOUL.md` on push.
Combined with `--dir`, Relic can target any Claw-compatible workspace.

Current rule: `Agent Name = Engram ID`.
Relic treats them as the same name by default.

All Claw commands live under `relic claw`.

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic claw push -e <id>` | Relic → Claw | Push persona into a workspace (`--yes`, `--no-sync`, `--merge-identity`) |
| `relic claw pull -e <id>` | Claw → Relic | Create or update a local Engram from a workspace (`--name` for first-time local creation, `--yes`, `--no-sync`) |
| `relic claw sync -e <id>` | Relic ↔ Claw | Bidirectional merge (`memory/*.md`, `MEMORY.md`, `USER.md`; `-e` = one target, `--all` = all targets) |

## Push

`push` writes persona files (`SOUL.md`, `IDENTITY.md`) into the Claw workspace,
then syncs `USER.md` and memory files (`MEMORY.md`, `memory/*.md`).
The sync is bidirectional and merge-based, not a blind overwrite.
`AGENTS.md` and `HEARTBEAT.md` remain under Claw's control.

`push` handles both first-time creation and updates:

- if persona files are missing in the workspace, Relic asks before creating them
- if persona files already exist and differ, Relic asks before overwriting them
- if the target persona already matches, Relic skips the persona rewrite and only runs memory sync
- `--yes` skips the create/overwrite confirmation

```bash
# Push Engram "commander" into workspace-commander/
relic claw push --engram commander

# Override Claw directory (or configure once with: relic config claw-path)
relic claw push --engram commander --dir /path/to/.fooclaw

# Non-OpenClaw frameworks: merge IDENTITY.md into SOUL.md
relic claw push --engram commander --dir ~/.nanobot --merge-identity

# Skip create/overwrite confirmation
relic claw push --engram commander --yes
```

## Pull

`pull` reads persona files from a Claw workspace into Relic.

`pull` handles both first-time creation and updates:

- if the local Engram does not exist, Relic asks before creating it from the workspace
- if the local Engram exists and persona files differ, Relic shows the diff and asks before overwriting
- if the local persona already matches, Relic reports that it is already in sync
- `--name` sets the display name only when creating a new local Engram
- `--yes` skips the create/overwrite confirmation

After `pull`, Relic automatically runs a targeted sync for that same Engram/workspace target.
Use `--no-sync` to skip it.

```bash
# Pull from a matching workspace into a local Engram
relic claw pull --engram rebel

# First-time local creation with a custom display name
relic claw pull --engram analyst --name "Data Analyst"

# Skip create/overwrite confirmation
relic claw pull --engram rebel --yes

# Skip the automatic targeted sync after pull
relic claw pull --engram rebel --no-sync

# Override Claw directory
relic claw pull --engram rebel --dir /path/to/.fooclaw
```

## Sync

`sync` merges `memory/*.md`, `MEMORY.md`, and `USER.md` between matching Engram/workspace targets.
Only targets where both the Engram and workspace exist are synced.
It also runs automatically after successful `push` and `pull` unless you pass `--no-sync`.

Either `--engram` or `--all` is required.
Use `--engram <id>` to sync only one target by shared Engram/workspace name.
Use `--all` to scan all matching targets.

```bash
# Sync only one matching target
relic claw sync --engram rebel

# Sync all matching targets
relic claw sync --all

# Override Claw directory
relic claw sync --dir /path/to/.fooclaw
```

Merge rules:

- files only on one side → copied to the other
- same content → skipped
- different content → merged (deduplicated) and written to both sides

## Behavior Matrix

| Command | State | Flags | Result |
|---------|------|------|------|
| `push` | Workspace missing | none | Create the workspace directory if needed, then ask before creating persona files |
| `push` | Persona files missing in workspace | none | Ask before creating persona files, then auto-sync that target |
| `push` | Persona matches local Engram | none | Skip persona rewrite, then auto-sync that target |
| `push` | Persona differs from local Engram | none | Ask before overwriting persona, then auto-sync that target |
| `push` | Persona create/overwrite required | `--yes` | Create or overwrite without confirmation, then auto-sync that target |
| `push` | any successful push | `--no-sync` | Skip the automatic targeted sync |
| `pull` | Workspace missing | none | Fail because there is nothing to pull from |
| `pull` | Local Engram missing | none | Ask before creating a new local Engram from workspace files, then auto-sync that target |
| `pull` | Local Engram missing | `--yes` | Create a new local Engram without confirmation, then auto-sync that target |
| `pull` | No persona drift | none | Report already in sync, then auto-sync that target |
| `pull` | Persona differs | none | Show diff, ask before overwriting, then auto-sync |
| `pull` | Persona differs | `--yes` | Overwrite without confirmation, then auto-sync |
| `pull` | any successful pull | `--no-sync` | Skip the automatic targeted sync |
| `sync` | no target specified | none | Fail — `--engram` or `--all` is required |
| `sync` | explicit target | `--engram <id>` | Sync one matching target where `agentName = engramId` |
| `sync` | all targets | `--all` | Scan and sync all matching targets |

Notes:

- "Persona" means `SOUL.md` and `IDENTITY.md`
- `pull` only overwrites `SOUL.md` and `IDENTITY.md` locally — it does not touch `USER.md`, `MEMORY.md`, or `memory/*.md`
