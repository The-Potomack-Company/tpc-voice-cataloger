# Phase 38: migration-retryability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 38-migration-retryability
**Areas discussed:** exportHistory + cleanup

---

## Gray-area selection

Four gray areas were presented (recommendation-first, advisor tier=standard).
User selected only **exportHistory + cleanup** to discuss; the other three were
locked to their recommended defaults:

| Area | Locked default |
|------|----------------|
| needsMigration rule | Per-row mapping check (true if any non-deleted session/item oldId lacks an idMapping); deletedAt excluded |
| Idempotency lookup | Dexie v11 `[oldId+type]` index + `getNewIdByOldId()`; skip insert + reuse newId on existing mapping (incl. session insert) |
| Partial banner surface | Plumb `partial` through `useDataMigration`; persistent dismissible in-app banner + Settings retry, separate from login `MigrationSplash` |

---

## exportHistory + cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on post-run completeness | Clear exportHistory iff `needsMigration()===false` after run; split counters so `partial`=failures-only and idempotent-skips tracked separately | ✓ |
| Split counters only | Keep clearing on `failures===0`; separate idempotent-skip from failure count, but cleanup still keyed to a counter | |
| Never clear on retry | Only clear on first fully-clean run; retries leave exportHistory untouched (risks dangling rows) | |

**User's choice:** Gate on post-run completeness (REC).
**Notes:** Driven by the discovery that once retries are idempotent, counting
already-migrated rows as `skipped` would permanently block the
`skipped === 0` exportHistory-clear gate. Ground-truth `needsMigration()`
check avoids the conflation; counter split keeps the partial banner honest.

## Claude's Discretion

- Return-shape field names (`failed`/`alreadyMigrated`/`migrated`) and how
  `useDataMigration` surfaces them, provided the semantic split holds.
- Banner component structure/placement, following `PhotoMigrationBanner`.

## Deferred Ideas

None — discussion stayed within phase scope.
