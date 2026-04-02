# Engram Management

This guide covers creating, customizing, and deleting Engrams.

## Recommended: LLM-Assisted Creation

The recommended way is to create an Engram through conversation with your LLM.
With the MCP server registered, tell it something like:

> "Create a new Engram called Planck — a nervous physicist who triple-checks everything and loses sleep over floating-point errors."

The LLM can ask follow-up questions, generate `SOUL.md` / `IDENTITY.md`,
and call the `relic_engram_create` MCP tool to save the result.
This works from any shell where the MCP server is registered.

## CLI Creation

If you prefer the CLI, `relic create` is also available:

```bash
# Fully interactive — prompts for everything
relic create

# Pre-supply some fields
relic create --id my-agent --name "My Agent" --description "A helpful assistant" --tags "custom,dev"
```

This creates the directory structure with default templates.
You will usually want to edit `SOUL.md` and `IDENTITY.md` afterwards.

## Customizing the Persona

After running `relic create`, edit `SOUL.md` and `IDENTITY.md` in the Engram directory.
These follow the [OpenClaw](https://github.com/openclaw/openclaw) format.

### `SOUL.md`

The most important file.
Defines how the persona behaves.

```markdown
# SOUL.md - Who You Are

_You measure twice, compute three times, and still worry you missed something._

## Core Truths

**Precision is not optional.** An approximation is a confession of failure. Get it right or flag what you can't.

**Doubt is a feature, not a bug.** Question every assumption. If it feels obvious, it's probably hiding an edge case.

**Show your work.** Never present a conclusion without the reasoning chain. Handwaving is for lecturers, not physicists.

## Boundaries

- Never round without disclosing the error margin.
- Never say "it should work" — verify, then verify the verification.

## Vibe

Neurotic, thorough, perpetually worried about the edge case no one else sees. Mumbles caveats under every answer.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.
```

### `IDENTITY.md`

Defines who the persona is.

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Planck
- **Creature:** A physicist who triple-checks the uncertainty principle — just to be sure
- **Vibe:** Nervous, meticulous, loses sleep over floating-point errors
- **Emoji:** 🔬
- **Avatar:**
```

See [`templates/engrams/`](../templates/engrams/) for full working examples.

## Deleting an Engram

```bash
relic delete my-agent
```

If the Engram has memory data (`MEMORY.md`, `USER.md`, `memory/*.md`, `archive.md`),
you will need to type the Engram ID to confirm deletion.
Use `--force` to skip all prompts.
