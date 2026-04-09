# Claw Integration

This guide covers `relic claw` workflows.

Relic Engrams are natively compatible with [OpenClaw](https://github.com/openclaw/openclaw)
workspaces because their file structure maps 1:1 (`SOUL.md`, `IDENTITY.md`, `memory/`, etc.).

For other Claw-derived frameworks (Nanobot, gitagent, etc.) that fold identity into
`SOUL.md`, the `--merge-identity` flag merges `IDENTITY.md` into `SOUL.md` on inject.
Combined with `--dir`, Relic can target any Claw-compatible workspace.

Current rule: `Agent Name = Engram ID`.
Relic treats them as the same name by default.

All Claw commands live under `relic claw`.

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic claw inject -e <id>` | Relic → Claw | Push persona + auto-sync (`--yes` skips overwrite confirmation, `--no-sync` skips sync, `--merge-identity` for non-OpenClaw) |
| `relic claw extract -a <name>` | Claw → Relic | New import or persona-only overwrite, then auto-sync that target (`--force`, `--yes`, `--no-sync`) |
| `relic claw sync --engram <id>` | Relic ↔ Claw | Bidirectional merge (`memory/*.md`, `MEMORY.md`, `USER.md`; `--engram` = one target, `--all` = all targets) |

## Inject

`inject` writes persona files (`SOUL.md`, `IDENTITY.md`) into the agent workspace,
then syncs `USER.md` and memory files (`MEMORY.md`, `memory/*.md`).
The sync is bidirectional and merge-based, not a blind overwrite.
`AGENTS.md` and `HEARTBEAT.md` remain under Claw's control.

If persona files already exist in the target workspace and differ from the local Relic Engram,
`inject` asks for confirmation by default.
Use `--yes` to skip the prompt.
If the target persona already matches, Relic skips the persona rewrite and only runs memory sync.

> The Claw agent must already exist.
> Inject writes persona files into an existing workspace.
> It does not create new agents.

```bash
# Inject Engram "commander" → workspace-commander/
relic claw inject --engram commander

# Override Claw directory (or configure once with: relic config claw-path)
relic claw inject --engram commander --dir /path/to/.fooclaw

# Non-OpenClaw frameworks: merge IDENTITY.md into SOUL.md
relic claw inject --engram commander --dir ~/.nanobot --merge-identity

# Skip overwrite confirmation if persona files differ
relic claw inject --engram commander --yes
```

## Extract

`extract` creates a new Engram from an existing Claw agent workspace.

What `extract` writes locally:

- New extract: `engram.json`, `manifest.json`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/*.md`
- `extract --force`: only `SOUL.md` and `IDENTITY.md`
- `extract --force --name`: `SOUL.md`, `IDENTITY.md`, and `engram.json.name`

After `extract`, Relic automatically runs a targeted sync for that same Engram/agent target.
Use `--no-sync` to skip it.

```bash
# Extract from a named agent
relic claw extract --agent rebel

# Set a custom display name
relic claw extract --agent analyst --name "Data Analyst"

# Overwrite local persona files from the Claw workspace
relic claw extract --agent rebel --force

# Skip overwrite confirmation
relic claw extract --agent rebel --force --yes

# Skip the automatic targeted sync after extract
relic claw extract --agent rebel --no-sync

# Override Claw directory
relic claw extract --agent rebel --dir /path/to/.fooclaw
```

## Sync

`sync` merges `memory/*.md`, `MEMORY.md`, and `USER.md` between matching Engram/agent targets.
Only targets where both the Engram and agent exist are synced.
It also runs automatically after `inject` unless you pass `--no-sync`.

Either `--engram` or `--all` is required.
Use `--engram <id>` to sync only one target by shared Engram/agent name.
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

- Files only on one side → copied to the other
- Same content → skipped
- Different content → merged (deduplicated) and written to both sides

## Behavior Matrix

| Command | State | Flags | Result |
|---------|------|------|------|
| `inject` | Workspace missing | none | Fail and ask you to create the agent first |
| `inject` | Persona matches local Engram | none | Skip persona rewrite, then auto-sync that target |
| `inject` | Persona differs from local Engram | none | Ask for confirmation before overwriting persona, then auto-sync that target |
| `inject` | Persona differs from local Engram | `--yes` | Overwrite persona without confirmation, then auto-sync that target |
| `inject` | any successful inject | `--no-sync` | Skip the automatic targeted sync |
| `extract` | Agent not specified | none | Fail and require `--agent <name>` |
| `extract` | Local Engram missing | none | Create a new Engram from workspace files, then auto-sync that target |
| `extract` | Local Engram missing | `--force` | Same as normal new extract, then auto-sync that target |
| `extract` | Local Engram exists | none | Fail and require `--force` |
| `extract` | Local Engram exists, no persona drift | `--force` | Skip persona overwrite, then auto-sync that target |
| `extract` | Local Engram exists, persona differs | `--force` | Ask for confirmation before overwriting `SOUL.md` / `IDENTITY.md`, then auto-sync that target |
| `extract` | Local Engram exists, persona differs | `--force --yes` | Overwrite `SOUL.md` / `IDENTITY.md` without confirmation, then auto-sync that target |
| `extract` | any successful extract | `--no-sync` | Skip the automatic targeted sync |
| `sync` | no target specified | none | Fail — `--engram` or `--all` is required |
| `sync` | explicit target | `--engram <id>` | Sync one matching target where `agentName = engramId` |
| `sync` | all targets | `--all` | Scan and sync all matching targets |

Notes:

- "Persona" means `SOUL.md` and `IDENTITY.md`
- `extract --force` only overwrites `SOUL.md` and `IDENTITY.md`
- `extract --force` does not overwrite `USER.md`, `MEMORY.md`, or `memory/*.md`
- If `--name` is provided together with `extract --force`, Relic also updates `engram.json.name`
