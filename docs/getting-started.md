# Getting Started

This guide covers the first-run path for Relic after installation.

## What `relic init` Creates

Running `relic init` creates `~/.relic/`, writes `config.json`, and seeds two sample
Engrams under `~/.relic/engrams/`.

```text
~/.relic/
├── config.json
└── engrams/
    ├── rebel/
    │   ├── engram.json
    │   ├── manifest.json
    │   ├── SOUL.md
    │   ├── IDENTITY.md
    │   └── memory/
    │       └── YYYY-MM-DD.md
    └── commander/
        ├── engram.json
        ├── manifest.json
        ├── SOUL.md
        ├── IDENTITY.md
        └── memory/
            └── YYYY-MM-DD.md
```

- `config.json` stores global Relic settings such as `engramsPath`, `defaultEngram`,
  `clawPath`, and `memoryWindowSize`
- `engrams/<id>/` is one Engram workspace
- `engram.json` stores editable profile fields like display name, description, and tags
- `manifest.json` stores system-managed fields like the Engram ID and timestamps
- `SOUL.md` and `IDENTITY.md` define the persona itself
- `memory/YYYY-MM-DD.md` stores dated distilled memory entries

## Files Created Later

As you keep using an Engram, more files are added to the same workspace:

- `archive.md` is created inside `engrams/<id>/` when shell hooks start logging raw conversation turns
- `MEMORY.md` can be created or extended when especially important distilled facts are promoted to long-term memory
- `USER.md` is created or updated during memory distillation to record user preferences, tendencies, and work style
- `~/.relic/hooks/` and `~/.relic/gemini-system-default.md` are created later on first shell launch when hook registration or Gemini prompt caching is needed
