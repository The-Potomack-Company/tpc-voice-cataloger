---
phase: 39-optimistic-locking
audited: 2026-06-02
auditor: gsd-security-auditor
asvs_level: default
block_on: high
threats_total: 8
threats_closed: 8
threats_open: 0
status: secured
---

# Phase 39 — optimistic-locking: Security Audit

Verification of each declared threat mitigation against the implemented code and
tests. Disposition drives method: `mitigate` → grep the mitigation pattern in the
cited file(s) + confirm a passing test asserts it; `accept` → record the
acceptance rationale below and confirm it still holds in code.

Implementation files are read-only; this audit modified nothing but this file.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-39-00 | Tampering | mitigate | CLOSED | `supabase/migrations/20260603000000_add_items_updated_at_trigger.sql` — additive `add column` + `coalesce(created_at, now())` backfill + `create trigger items_updated_at` reusing `set_updated_at()`. Grep for `row level security` / `policy` / `enable rls` returns no match (exit 1): RLS undisturbed. No `create or replace function` (reuse not redefine). |
| T-39-01 (P01) | Information Disclosure | accept | CLOSED | Accepted-risk AR-1 below. `src/db/database.types.ts:363` exposes only the column name `updated_at: string` in `items.Row`; public schema metadata, no secrets. |
| T-39-01 (P02) | Tampering | mitigate | CLOSED | `src/db/optimisticUpdate.ts:70-81` — `.update(nextPatch).eq("id",id).eq("updated_at",prev).select()` then `data && data.length > 0` → applied; 0-row falls through to re-read (`:86-92`). Test `src/tests/optimistic-update.test.ts:134` mocks conflict as `{ data: [], error: null }` and proves 0-row ≠ success. 55/55 Phase-39 tests pass. |
| T-39-02 | Denial of Service | mitigate | CLOSED | `src/db/optimisticUpdate.ts:63` bounded `for (attempt < maxAttempts)` (default 3, `:35`); re-read `maybeSingle()` returning null → `return { status: "noop" }` ends the loop (`:92`). Test `optimistic-update.test.ts:150` "stops without looping when re-read returns nothing". Highest-value threat — verified. |
| T-39-03 (P02) | Tampering | accept | CLOSED | Accepted-risk AR-2 below. Precondition token is the client's own prior read; forged value either matches (legit) or 0-rows → reconcile (safe). RLS gates row access. Behavior confirmed by the 0-row conflict path above. |
| T-39-03 (P03) | Tampering | mitigate | CLOSED | `src/services/geminiContinuous.ts:264-303` — captures `valueAtRead` per `MERGE_FIELDS` before write; reconcile (`:286-295`) `if (fresh[field] !== valueAtRead[field]) continue` drops user-changed fields (AI yields, D-06). Test `src/tests/continuous-merge-no-clobber.test.ts` (HEADLINE, GREEN): user-changed field dropped, untouched field re-applied. |
| T-39-04 | Tampering | mitigate | CLOSED | `src/hooks/useWriteAheadQueue.ts:95-120` — flush destructures `updated_at` out of patch, routes through `preconditionUpdate` with `prevUpdatedAt: updated_at`; `result.status === "exhausted"` → `continue` (entry NOT deleted; Pitfall 5). Tests `src/tests/write-ahead-queue.test.ts:421` (precondition applied as WHERE not SET) and `:463` (no delete on persistent miss). |
| T-39-05 | Tampering | mitigate | CLOSED | Legacy snapshot-less entry → `prevUpdatedAt: undefined` → helper guard `src/db/optimisticUpdate.ts:47-61` re-reads to obtain a real token (`maybeSingle()`); row gone → `noop` (no write), else precondition with fresh token. No unconditional last-writer-wins. Test `write-ahead-queue.test.ts:136` legacy entry re-reads then preconditions. |
| T-39-SC | Tampering | mitigate | CLOSED | No package install in Phase 39. `git log --oneline -- package.json` shows last touch was Phase 37 (`41453f0`); all three SUMMARYs declare `tech-stack.added: []`. |

**Closed: 8/8. Open: 0.**

## Accepted Risks Log

### AR-1 (T-39-01 P01) — generated types expose `updated_at` column name
The regenerated `src/db/database.types.ts` adds `updated_at: string` to
`items.Row`/`Insert`/`Update`. This is public schema metadata (a column name and
its TypeScript type), already discoverable via the PostgREST schema. No secret,
credential, or row data is exposed. Accepted per the plan-time disposition.

### AR-2 (T-39-03 P02) — client may forge a fake `updated_at` precondition token
The precondition snapshot originates from the client's own prior read, not from
untrusted external input. A forged value either (a) matches the current server
token (a legitimate, harmless write) or (b) does not match → 0-row → reconcile
loop (safe — no clobber). Row-level access remains gated by Supabase RLS, which
this phase leaves undisturbed (T-39-00). Accepted per the plan-time disposition;
low risk per RESEARCH security table.

## Unregistered Flags

None. No SUMMARY (39-01/02/03) declares a `## Threat Flags` section, so no new
attack surface was reported by the executor during implementation.

## Auditor Notes (informational — not blocking)

The deep code review (`39-REVIEW.md`) raised one Critical (CR-01) lost-write hole:
a `prev === undefined` token would let supabase-js drop the `.eq("updated_at")`
filter and collapse the precondition to an unconditional write. This audit
verified the **fix is present in code** (not merely claimed):

- `src/db/optimisticUpdate.ts:47-61` — explicit `prev === undefined || prev === null`
  guard that re-reads for a real token before any write, `noop` if the row is gone.
  This closes the three CR-01 sources (AI null-snapshot, tokenless freshly-created
  item, legacy queue entry) — and is exactly what makes T-39-05 CLOSED rather than
  relying on a per-caller fallback.
- WR-02 (stale local token) fix present at `src/stores/sessionStore.ts:447-459` —
  fresh `updated_at` folded back into local state on `applied`.

Residual REVIEW items WR-01/03/04/05 and IN-01..04 are correctness/robustness
observations, not declared threats in the register, and none reopen a mitigated
threat. WR-04 (strict `!==` compare in the AI reconcile) is **latent only**: all
seven `MERGE_FIELDS` are scalar text columns (`geminiContinuous.ts:18-26`), so the
strict compare cannot misfire today; if a non-text field is ever added, that guard
must switch to a normalized compare. Flagged for future phases, not Phase 39.
