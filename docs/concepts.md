# Concepts

This guide explains how Relic fits together.

## How It Works

```text
+--------------+     +--------------+     +--------------+
|   Mikoshi    |     |    Relic     |     |    Shell     |
|  (backend)   |     |  (injector)  |     |   (AI CLI)   |
+--------------+     +--------------+     +--------------+
       ^                   |                    |
       |            sync full Engram            |
       |                   |                    |
       |             compose & inject           |
       |                   v                    v
       |            ╔═══════════╗          +---------+
       +------------║  Engram   ║--------->|Construct|
       |            ║ (persona) ║          | (live)  |
       |            ╚═══════════╝          +---------+
       |            SOUL.md              claude / codex / gemini
       |            IDENTITY.md               |
       |            USER.md                   | hooks append logs
       |            MEMORY.md                 |
       |            memory/*.md               v
       |                                +-----------+
   push /                               |archive.md |
   pull /                               | raw logs  |
   sync                                 +-----------+
       |                                      |
       v                     MCP recall       | user-triggered
 +-----------+              search/pending    | distillation
 |  OpenClaw |                                v
 |  & Claws  |                          +-----------+
 +-----------+                          | distilled |
                                        |memory/*.md|
                                        +-----------+
                                              |
                                         promote key
                                           insights
                                              v
                                       MEMORY.md / USER.md
```

## Core Concepts

1. **Engram** is the persona dataset. It is made of Markdown files plus metadata.
2. **Relic** reads that dataset, composes it into prompts, and injects it into a shell.
3. **Shell** is the AI CLI itself, such as Claude Code, Codex CLI, or Gemini CLI.
4. **Construct** is the live session where one Engram is loaded into one shell.
5. **archive.md** stores raw turn logs written by shell hooks.
6. **memory/*.md**, `MEMORY.md`, and `USER.md` store distilled memory that later feeds future system prompts.
7. **relic claw** connects Engrams to OpenClaw and other Claw-based frameworks.
8. **Mikoshi** is the cloud backend layer for storing and syncing the full Engram.

## Terms

| Term | Role | Description |
|------|------|-------------|
| **Relic** | Injector | The core system. Adapts personas to AI interfaces. |
| **Mikoshi** | Backend | Cloud layer where full Engrams are stored and synced. |
| **Engram** | Data | A persona dataset made of Markdown files and metadata. |
| **Shell** | LLM | An AI CLI such as Claude Code, Codex CLI, or Gemini CLI. |
| **Construct** | Process | A live process where an Engram is loaded into a Shell. |
| **archive.md** | Raw Log | Raw conversation history written by hooks. |
| **Memory Distillation** | Process | Turning raw archive entries into distilled memory files. |
