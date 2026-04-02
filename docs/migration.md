# Migration

This guide covers upgrade tasks for existing Relic users.

## Replacing Legacy Sample Engrams

Versions prior to `0.3.0` shipped sample Engrams that referenced copyrighted character names.
Those samples were replaced with original personas: `rebel` and `commander`.

Run `refresh-samples` to add the new samples. Your existing Engrams are not deleted.

```bash
relic refresh-samples
# → Seeded: 2 (commander, rebel)
# → Memory migrated from legacy samples
# → Legacy samples remain untouched
```

If the legacy samples had memory data (`USER.md`, `MEMORY.md`, `memory/*.md`) or archive data (`archive.md`, `archive.cursor`), Relic copies that data to the new samples during seeding.

Then switch your default Engram:

```bash
relic config default-engram rebel
```

After you confirm the new samples work, remove the old ones if you no longer need them:

```bash
relic delete <id>
```

## Other Migrations

Use this command to migrate legacy `engram.json` metadata into `manifest.json`:

```bash
relic migrate engrams
```

## What This Covers

This guide is the home for:

- legacy sample replacement
- `relic refresh-samples`
- default Engram switching after migration
- metadata migration commands
- cleanup guidance
