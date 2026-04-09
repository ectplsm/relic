# Development Rules — Relic

Rules for AI agents and human contributors working on this codebase.
For project overview, architecture, and API reference, see `README.md`.

## Parent Documents

Before making cross-repo sync, privacy, or ownership decisions:

- read the shared Mikoshi sync contract from the `ectplsm/engram-sync-contracts` repository
- read the relevant local plan index under `docs-local/plans/` when working on roadmap or multi-step changes

If this document conflicts with a shared contract, the shared contract wins.

## Coding Conventions

- TypeScript strict mode
- `core/` must not depend on external libraries (Zod is the only exception)
- Use domain terms (Engram, Mikoshi, Shell, Construct, Relic) in variable and type names
- Engram data structure must remain OpenClaw `workspace`-compatible
- Keep modules small and boundaries explicit
- Prefer root-cause fixes over surface patches
- Do not claim "complete compatibility" unless it is literally defensible
- Build check: `npm run build` (runs `tsc`)

## Commit Rules

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.)
- Subject line under 72 characters
- Blank line after subject, then a short explanatory body
- Subject-only commits are acceptable when the change is trivially obvious

## PR Workflow

- Default base branch: `main`
- PR title and body in English
- Use `## Summary` with bullet points and `## Test plan` with checklist
- Never auto-merge — wait for explicit approval

## Shared Contracts

Cross-repo contracts live in the `ectplsm/engram-sync-contracts` repository.
These define boundaries, invariants, and API/data contracts that both `relic` and `mikoshi` must obey.

- Put cross-repo facts there, not implementation details
- If a rule must be enforced by both repos, it belongs there
- Prefer updating contracts before implementing behavior that depends on them

## Local Plans

Multi-step work that should survive beyond a single session goes in `docs-local/plans/`.
This directory is not tracked in git.

- `docs-local/plans/` — active and blocked plans only
- `docs-local/plans/archive/` — completed or superseded plans

Priority order: shared contracts in `ectplsm/engram-sync-contracts` > this file > local plans.
If a plan conflicts with a shared contract or this file, update the plan.

Plan format:

- Start with purpose and scope
- Name parent documents near the top
- Distinguish settled rules from open questions
- Mark status clearly: active, blocked, superseded, or complete
- Archive completed/superseded plans instead of deleting them
