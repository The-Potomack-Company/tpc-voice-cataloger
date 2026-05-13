# TPC App

This repo is part of the **TPC workspace** at `..` — three apps (TPC_AI_Cataloger Chrome ext, this app, tpc-dashboard) sharing one Supabase project.

## Cross-app coordination

Before starting any GSD phase work, check whether the work is being driven from a cross-app feature note:

```bash
grep -l "app:" ../_workspace/Features/*.md 2>/dev/null
```

If a feature note lists this app, **read it first** — it carries the cross-app spec, schema impact, and ship order that the per-repo phase plan won't. The PLAN.md should already have a `<context>` line pointing back to it; if you authored the phase manually, add one.

For **shared decisions, conventions, schema, model routing, hooks**:
- `../CLAUDE.md` — workspace router
- `../_workspace/Decisions/_index.md` — cross-app ADRs (one file per decision)
- `../_workspace/Architecture/{Stack,Conventions,Constants}.md`
- `../_workspace/Schema/schema.md`
- `../_workspace/AI/routing.md` — Haiku / Sonnet / Opus / Codex routing rules
- `../_workspace/AI/codex.md` — Codex gate matrix
- `../_workspace/AI/agents.md` — A1–A5 always-on agent contracts

For **app-specific** architecture, requirements, milestones, and decisions:
- `.planning/PROJECT.md`
- `.planning/STATE.md` (vault mirror: `../_workspace/State/app.md`)
- `.planning/MILESTONES.md`
- `.planning/milestones/<v>-phases/<slug>/` — active phase work
- `../_workspace/Docs/AI/app/` — Claude-facing bulk operational docs (populate as needed)

## What this app is

The operational web app for TPC. React 19 + Vite 7 + Tailwind 4, Supabase backend, Dexie offline cache, Zustand state. Owns user-facing cataloging UI and is the **auth-of-record** for the workspace (see Decisions D-002).

Detailed scope and constraints: see `.planning/PROJECT.md`. Auth-of-record per [`D-002`](../_workspace/Decisions/D-002-tpc-app-owns-auth.md).

## Important checks before changing schema

This app shares Supabase with cataloger + dashboard. Any schema change is a **cross-app event** — start from `../_workspace/Schema/schema.md`, not from a local belief about the schema. Regenerate `src/db/database.types.ts` via `npm run db:types` after any migration.

## When in doubt

App-specific question → `.planning/PROJECT.md`. Cross-app question → `../_workspace/`.
