# PROJECT RELIC

A system that manages AI personas (Engrams) on a cloud fortress (Mikoshi) and dynamically injects them into any LLM interface (Shell).

## Parent Documents

Before making cross-repo sync, privacy, or ownership decisions:

- read the shared Mikoshi sync contract from the sibling `contracts-local/` directory
- read the relevant local plan index under `docs-local/plans/` when working on roadmap or multi-step changes

If this document conflicts with a shared contract, the shared contract wins.

## Domain Glossary (The 5 Pillars)

| Term | Role | Description |
|------|------|-------------|
| **Relic** | Injector | The core system. An adapter with CLI, MCP, and API faces. |
| **Mikoshi** | Backend | Cloud fortress where all Engrams are stored (`mikoshi.ectplsm.com`). |
| **Engram** | Data | An OpenClaw `workspace`-compatible persona dataset (set of Markdown files). |
| **Shell** | LLM | Claude, Gemini, GPT, etc. An empty vessel with pure compute. |
| **Construct** | Process | A live process where an Engram is loaded into a Shell. |

## Architecture

Clean Architecture. Dependencies always point inward (toward `core/`).

```
src/
├── core/           # Business logic (no external deps except Zod)
│   ├── entities/   # Domain models: Engram, Construct, etc.
│   ├── usecases/   # Use cases: summon, list, sync, archive, memory, etc.
│   └── ports/      # Abstract boundary interfaces
├── adapters/       # Concrete port implementations (Mikoshi API, shell launchers, hooks, etc.)
├── interfaces/     # Entry points (CLI via Commander, MCP Server)
└── shared/         # Shared utilities (config, path resolution, etc.)
```

## Tech Stack

- **Runtime**: Node.js (>=18)
- **Language**: TypeScript (strict mode)
- **Validation**: Zod
- **CLI**: Commander
- **MCP**: @modelcontextprotocol/sdk
- **Build**: tsc (TypeScript compiler)
- **Package Manager**: npm

## Key Files & Concepts

- `templates/engrams/` — Sample Engram templates (johnny, motoko). Copied during `relic init`.
- `src/shared/config.ts` — Central config, Engram seeding, path resolution via `import.meta.url`.
- `src/adapters/shells/` — Shell launchers (claude, codex, gemini) and hook scripts.
- `src/interfaces/mcp/` — MCP server with `relic_archive_search`, `relic_archive_pending`, `relic_memory_write` tools.
- `src/interfaces/cli/` — CLI commands including `relic claw` subcommands (inject/extract/sync).
- `docs-local/plans/` — local-only durable implementation plans and their index for larger features.

## Coding Conventions

- Use domain terms (Engram, Mikoshi, Shell, Construct, Relic) in variable and type names.
- `core/` must not depend on external libraries (Zod is the only exception).
- Engram data structure must remain OpenClaw `workspace`-compatible.
- Keep small, focused changes. Respect module boundaries.
- Build check: `npm run build` (runs `tsc`).

## Git & PR Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **Pull Requests**: Always write PR titles and descriptions in **English**.
- **PR template**: Use `## Summary` with bullet points and `## Test plan` with checklist.
- Do not auto-merge PRs — wait for explicit user approval.
