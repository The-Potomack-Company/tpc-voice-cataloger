# Phase 36: ux-visibility-polish - Research

**Researched:** 2026-06-02
**Domain:** Frontend error-visibility + client-side transactional correctness (React 19 / Zustand / Supabase / Dexie)
**Confidence:** HIGH (all findings verified by direct codebase read; zero external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use **client-side rollback**, NOT a Supabase RPC. New session and import touch *both* Dexie and Supabase; an RPC only wraps the Supabase side and cannot unwind Dexie. Orchestrate inserts client-side, track what landed, run compensating deletes on failure.
- **D-02:** On failure, surface via the DAT-4 ErrorToast path with a `retry` callback. Retry re-runs the operation (D-08).
- **D-03:** **No schema change in this phase.** A transactional RPC is deferred to a phase already doing schema work (38/39). Keep 36 schema-free.
- **D-04:** Keep `notificationStore` **single-slot** (one active message). Latest-message-wins.
- **D-05:** **Dedupe** — do not re-show a message identical to the currently displayed one.
- **D-06:** **Retryable toasts are sticky.** Drop the 6s auto-dismiss only when a `retry` callback is attached. Informational toasts keep the 6s auto-dismiss.
- **D-07:** Fix the false-success migration copy **now, standalone — decoupled from Phase 38.** DAT-1 already returns `partial`; make banner copy honest about partial state immediately. Phase 38 later upgrades the banner with retry; Phase 36 only stops it claiming success when partial.
- **D-08:** **Retry re-runs the operation wholesale.** No partial/targeted retry logic in this phase.
- **D-09:** Add one central **`toUserMessage(err)`** helper mapping known error shapes to friendly copy with a generic fallback. Supabase auth → "Wrong email or password"; network → "Connection problem — try again"; unknown → "Something went wrong". Raw Supabase/JSON text must never reach the user. All touchpoints funnel through this helper.

### Claude's Discretion
- Exact friendly-copy wording per error class (within the spirit of D-09).
- Where `toUserMessage` lives (`src/services/` vs `src/lib/`) — planner's call.
- Admin load (#16–20) and silent fetch (#27, #28) reuse the same notify path; exact call sites are an implementation detail.

### Deferred Ideas (OUT OF SCOPE)
- **Transactional RPC for session/import** — DB-level-atomic alternative to D-01. Revisit in a schema-work phase.
- **Multi-toast queue / stacking** — upgrade `notificationStore` to a queue only if concurrent distinct errors become a real problem. Not needed now.
- **Phase 38 migration retry banner** ("N items not yet synced — Retry") lives in Phase 38, not here.
</user_constraints>

## Summary

This is a pure **error-visibility + client-side transactional-correctness** polish phase. No new packages, no schema migrations (`supabase/migrations/*.sql` is NOT needed — D-03), no new visual language. Everything routes through the **already-shipped** DAT-4 infrastructure: `notificationStore.notifyError(message, retry?)` → globally-mounted `ErrorToast`, plus the `WarnBanner` primitive for partial-state copy.

All six Codex-flagged touchpoints were located at file:line during research. The work splits into three buckets: (1) **wire silent catch sites into `notifyError`** (export, login, fetch, admin role-load); (2) **make import atomic** via client-side compensating deletes (the one genuinely new logic — D-01); (3) **fix one boolean bug** where the migration hook discards the `partial` flag and unconditionally reports "complete" (Codex #2, D-07).

**Primary recommendation:** Add a single `toUserMessage(err)` helper, three small `notificationStore`/`ErrorToast` behavior changes (dedupe + retry-sticky), one `useDataMigration` fix to thread `partial` through, one `handleImport` rollback, and ~5 catch-site rewires. Reuse the established non-hook store pattern `useNotificationStore.getState().notifyError(...)` already present in `sessionStore.ts:468`. Tests follow the existing `update-item-field-notify.test.ts` mocking pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Error→user copy mapping (`toUserMessage`) | Client (util/service) | — | Pure function over caught error shapes; no I/O |
| Toast lifecycle (dedupe, sticky, single-slot) | Client (Zustand store + component) | — | UI-feedback state, already owned by DAT-4 store |
| Export failure surfacing | Client (page handler) | — | `exportSession` throws; caller catches → notify |
| Import atomicity (compensating deletes) | Client (page handler / new orchestrator) | Supabase + Dexie | Touches both stores; only the client sees both (D-01) |
| Migration partial honesty | Client (hook + splash) | — | `migrateToSupabase` already returns `partial`; hook drops it |
| Admin role-load failure visibility | Client (hook) | Supabase | `useUserRole` silently nulls role on error |
| Login error friendliness | Client (page) | Supabase auth | Raw `error.message` rendered today |

## Phase Requirements

> No REQ-IDs mapped (Track-2 quality track). Success criteria map directly to the Codex findings below.

| Success Criterion | Codex refs | Research support |
|-------------------|------------|------------------|
| SC1: Export failures toast + retry | #9, #10 | `SessionDetail.tsx:242,268` swallow with `console.error` — confirmed |
| SC2: New-session/import transactional | #7, #8 | `NewSession.tsx:93-122` `handleImport` non-atomic — confirmed |
| SC3: Migration copy honest vs `partial` | #2 | `useDataMigration.ts:35-40` discards `partial`, always "complete" — confirmed |
| SC4: Fetch/admin/login errors visible | #16-21, #27, #28 | `useUserRole`, `Login.tsx:25`, `offlineQueue.ts:50` — confirmed |

## Standard Stack

**No new packages.** This phase adds zero dependencies. All work uses what v1.2/DAT-4 already shipped.

### Reused Infrastructure (verified by read)
| Asset | File | Current API | Phase-36 change |
|-------|------|-------------|-----------------|
| `notificationStore` | `src/stores/notificationStore.ts` | `message`, `retry`, `notifyError(message, retry?)`, `dismiss()` — single-slot Zustand | Add dedupe (D-05); no signature change needed |
| `ErrorToast` | `src/components/ErrorToast.tsx` | renders active message + optional Retry button; **hardcoded 6s auto-dismiss** (line 11-19) | Make auto-dismiss conditional on `retry === null` (D-06) |
| `WarnBanner` | `src/ui/WarnBanner.tsx` | `{ icon?, title, body?, onDismiss?, className? }`, `role`-status, `bg-warn-wash text-warn` | Reuse for honest partial copy if an inline banner is wanted |
| `Badge` | `src/ui/Badge.tsx` | `tone="err"\|"warn"\|"ok"` | Optional inline load-failure indicator |
| `Icon` | `src/ui/icons.tsx` | glyphs: `err warn info refresh check x` (verified present) | `refresh` pairs with retry |
| Non-hook notify pattern | `src/stores/sessionStore.ts:468,472` | `useNotificationStore.getState().notifyError(msg, retryFn)` | **Copy this exact pattern** for service/store call sites |

**Package legitimacy audit:** Not applicable — no packages installed this phase.

## Architecture Patterns

### System Architecture Diagram

```
            ┌─────────────────────── caught error (any shape) ───────────────────────┐
            │                                                                          │
  Login ──┐ │  Export ──┐   Import ──┐   Fetch ──┐   Admin role-load ──┐               │
          │ │           │            │           │                     │               │
          ▼ ▼           ▼            ▼           ▼                     ▼               │
        ┌──────────────────────────────────────────────────────────────┐             │
        │  toUserMessage(err)   (D-09, NEW — single funnel)             │             │
        │  auth → "Wrong email or password"                            │             │
        │  network → "Connection problem — try again"                  │             │
        │  unknown → "Something went wrong"                            │             │
        └──────────────────────────────────┬───────────────────────────┘             │
                                            │ friendly string (+ optional retryFn)    │
                                            ▼                                          │
        ┌──────────────────────────────────────────────────────────────┐             │
        │  notificationStore.notifyError(msg, retry?)                  │             │
        │  • single-slot, latest-wins (D-04)                          │             │
        │  • dedupe: skip if msg === current message (D-05)           │             │
        └──────────────────────────────────┬───────────────────────────┘             │
                                            ▼                                          │
        ┌──────────────────────────────────────────────────────────────┐             │
        │  ErrorToast (global, AppLayout)                              │             │
        │  • retry present → STICKY (no 6s timer)  (D-06)             │             │
        │  • retry absent  → 6s auto-dismiss        (D-06)            │             │
        │  • Retry button → retry(); dismiss()                       │◀── re-run op  │
        └──────────────────────────────────────────────────────────────┘  (D-08) ────┘

  Migration path (separate surface — WarnBanner/Splash, NOT toast):
    migrateToSupabase() → { migrated, skipped, partial }
        │  (partial flag ALREADY computed at migration.ts:177)
        ▼
    useDataMigration  ── BUG: discards partial, sets state:"complete" always (Codex #2)
        │  FIX: if partial → state:"partial" (or "error"); thread skipped through
        ▼
    MigrationSplash  ── honest copy: "Some items couldn't be migrated. Your data is safe."
```

### Component Responsibilities

| File | Today | Phase-36 responsibility |
|------|-------|-------------------------|
| `src/lib/` or `src/services/` (NEW) | — | `toUserMessage(err)` pure helper (D-09 location = planner's call) |
| `src/stores/notificationStore.ts` | single-slot set/dismiss | add dedupe in `notifyError` |
| `src/components/ErrorToast.tsx` | always 6s timer | timer only when `retry === null` |
| `src/pages/SessionDetail.tsx:240-275` | `handleExport`/`handleExportSpreadsheet` console.error + swallow | catch → `notifyError(toUserMessage(err), () => handleExport())` sticky |
| `src/pages/NewSession.tsx:78-122` | `doCreate` silent on throw; `handleImport` non-atomic | doCreate → notify on failure; handleImport → track-and-rollback (D-01) |
| `src/hooks/useDataMigration.ts:28-44` | discards `partial` | thread `partial`/`skipped`; new "partial" outcome |
| `src/components/MigrationSplash.tsx:48-60` | "complete" copy only | honest partial copy when partial set |
| `src/hooks/useUserRole.ts` | silently `setRole(null)` on error | distinguish "load failed" from "not admin"; surface |
| `src/pages/Login.tsx:22-25` | renders raw `error.message` | `setError(toUserMessage(error))` |
| `src/services/offlineQueue.ts:50` | `console.warn` only on read fail | route through notify (note: returns `[]` by design — visibility only) |

### Pattern 1: Non-hook store access from services/handlers
**What:** Call the Zustand store imperatively from non-component code.
**When to use:** Any catch block outside a React render (services, store actions, async handlers).
**Example:**
```typescript
// Source: src/stores/sessionStore.ts:468 (existing, VERIFIED)
useNotificationStore.getState().notifyError(
  `Couldn't save ${field}. Tap Retry to try again.`,
  () => { /* retry closure */ },
);
```

### Pattern 2: Client-side compensating rollback (D-01, the one new pattern)
**What:** Track every row that successfully landed; on failure, delete them in reverse.
**When to use:** `handleImport` in `NewSession.tsx` — creates 1 session + N items across Supabase (+ Dexie id-mapping).
**Shape:**
```typescript
// PSEUDOCODE — planner authors. Mirrors the structure migration.ts already uses
// (it tracks migratedHouseItemIds / fullyMigratedSessionIds for selective cleanup).
let createdSessionId: string | undefined;
const createdItemIds: string[] = [];
try {
  createdSessionId = await createSession(...);
  for (const receipt of receipts) {
    const itemId = await createBlankItem(createdSessionId, "sale");
    createdItemIds.push(itemId);
    await updateItemField(itemId, createdSessionId, "receipt_number", receipt);
  }
  navigate(`/session/${createdSessionId}`);
} catch (err) {
  // Compensating deletes — reverse order, best-effort
  for (const id of createdItemIds.reverse()) await deleteItem(id, createdSessionId!).catch(() => {});
  if (createdSessionId) await deleteSession(createdSessionId).catch(() => {});
  useNotificationStore.getState().notifyError(
    "Import didn't finish — changes were undone. Try again.",
    () => handleImport(receipts, skipped),  // wholesale retry (D-08)
  );
}
```
**Note:** `deleteItem`/`deleteSession` already exist (`src/db/sessions.ts:28`, sessionStore). They cascade to Dexie via the existing store actions, satisfying D-01's "unwind Dexie too" requirement without new DB code.

### Anti-Patterns to Avoid
- **Surfacing raw `error.message`** (today: `Login.tsx:25`, `AccountManagement` create path leaks `User already registered`). Funnel through `toUserMessage` (D-09).
- **Treating a read failure as empty data without signal** (today: `offlineQueue.ts:50`, `sessionStore.fetchSessions:90` return `[]`/early-return silently). At minimum the user-facing fetch paths must notify.
- **Adding a Supabase RPC / `supabase/migrations/*.sql`** — explicitly out of scope (D-03). A Postgres function = a migration = schema push; do not introduce one.
- **Building a toast queue** — single-slot is the locked decision (D-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast rendering/lifecycle | New toast component | existing `ErrorToast` + `notificationStore` | Already mounted globally in AppLayout, a11y-correct (`role=alert`, `aria-live=assertive`) |
| Partial-state banner | Bespoke div | `WarnBanner` (`src/ui/WarnBanner.tsx`) | Token-driven, `role=status`, dark/light handled |
| Network-error detection | New regex | `isNetworkError` (`sessionStore.ts:9`) — reuse or fold into `toUserMessage` | Already covers "Failed to fetch", "NetworkError", "ERR_INTERNET_DISCONNECTED" |
| AI/transient error taxonomy | New classifier | `classifyAiError` (`src/utils/aiErrorClass.ts`) if relevant | Existing tested taxonomy (`error-classify.test.ts`) — don't duplicate |
| Compensating-delete bookkeeping | From scratch | Mirror `migration.ts:38-42` id-tracking arrays | Same "track what landed, clean up selectively" shape already proven in repo |

**Key insight:** The DAT-4 plumbing is done. Phase 36 is wiring, not building — the single piece of new *logic* is the import rollback (D-01), and even that has a structural precedent in `migration.ts`.

## Runtime State Inventory

> Rename/refactor/migration categories. This phase changes behavior, not stored identifiers, but the migration touchpoint warrants explicit answers.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no keys/IDs/collections renamed. `partial` flag already persisted in migration return shape. | None |
| Live service config | None — no external service config touched | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — no package rename | None |

**Nothing found in any category — verified by read.** The migration *fix* (Codex #2) changes how `useDataMigration` interprets an existing return value; it does not migrate or rename any stored data. The `idMapping` table and Dexie recovery-set semantics (`migration.ts:168-175`) are unchanged.

## Common Pitfalls

### Pitfall 1: Auto-dismiss timer keyed on `[message]` swallows the sticky requirement
**What goes wrong:** `ErrorToast.tsx:11-19` runs a 6s timer for *every* non-null message. If you add a retry callback but leave the effect as-is, retryable toasts still vanish at 6s.
**Why it happens:** The effect depends only on `message`, not on `retry`.
**How to avoid:** Gate the timer: `if (message === null || retry !== null) return;` so retryable toasts never schedule dismissal (D-06). Add `retry` to the dep array.
**Warning signs:** Test "retry toast persists past 6s" fails with fake timers.

### Pitfall 2: Migration "error" state only fires on a thrown exception, never on partial
**What goes wrong:** `useDataMigration.ts:31-43` only enters `state:"error"` in the `catch`. A *partial* run (some items skipped) resolves normally → `state:"complete"` with the false "All sessions are now synced" copy. This is exactly Codex #2.
**Why it happens:** The hook reads `result.migrated`/`result.skipped` but ignores `result.partial`.
**How to avoid:** Add a `"partial"` branch (or set `"error"`/a new flag) when `result.partial` (or `result.skipped > 0`). `MigrationSplash` already has honest copy in its `state === "error"` branch (`"${skipped} items could not be migrated. Your data is safe..."`) — route partial there or add a dedicated partial heading. Do NOT add Phase 38's retry-from-Settings flow (D-07).
**Warning signs:** A migration with ≥1 skip shows "Migration complete".

### Pitfall 3: Some admin paths are ALREADY surfaced — don't double-handle
**What goes wrong:** Codex #16-20 reads as "all admin loads silent," but several already surface inline: `AccountManagement.fetchAccounts` sets `loadError`, toggle/create set `toggleError`/`createError`; `NewSession` `listAccounts` sets `accountsError`; `SessionDetail` reassignment sets `reassignError`. Wrapping these in a toast too would double-notify.
**Why it happens:** The grep for `listAccounts` hits both already-handled and unhandled consumers.
**How to avoid:** The genuinely-silent admin path is **`useUserRole`** (`setRole(null)` on error with no signal — an admin whose role-load fails is silently demoted to non-admin). Target that. For the already-inline cases, the only consistency fix is routing their copy through `toUserMessage` (so raw Supabase text in `AccountManagement` create — `User already registered` etc. — can't leak), not adding a second surface.
**Warning signs:** Two simultaneous error UIs for one failure; raw `error.message` visible in account-create.

### Pitfall 4: `toUserMessage` must not regress already-good copy
**What goes wrong:** Several sites already have decent friendly copy (NewSession `accountsError`, AccountManagement `loadError`). A blanket funnel could flatten specific messages into the generic "Something went wrong."
**How to avoid:** `toUserMessage` maps *known shapes* and falls back to generic only for *unmapped* errors; preserve site-specific copy where it's already user-appropriate. The helper's primary job is killing raw-JSON/auth-string leakage (Login #21, account-create), not replacing every string.

## Code Examples

### `toUserMessage(err)` skeleton (D-09)
```typescript
// Source: synthesized from existing isNetworkError (sessionStore.ts:9) + D-09 spec
export function toUserMessage(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? "");
  // Supabase auth bad-credentials (Codex #21)
  if (/invalid login credentials|invalid email or password/i.test(msg))
    return "Wrong email or password";
  // Network / fetch (Codex #27, #28) — mirrors isNetworkError tokens
  if (/failed to fetch|networkerror|err_internet_disconnected|\bnetwork\b/i.test(msg) || navigator.onLine === false)
    return "Connection problem — try again";
  return "Something went wrong";
}
```

### Conditional auto-dismiss (D-06)
```typescript
// Source: src/components/ErrorToast.tsx:11-19 (modified)
useEffect(() => {
  if (message === null || retry !== null) return; // sticky when retryable
  const timer = setTimeout(() => useNotificationStore.getState().dismiss(), 6000);
  return () => clearTimeout(timer);
}, [message, retry]);
```

### Dedupe in store (D-05)
```typescript
// Source: src/stores/notificationStore.ts:13 (modified)
notifyError: (message, retry) =>
  set((s) => (s.message === message ? s : { message, retry: retry ?? null })),
```

## State of the Art

| Old Approach (current code) | Phase-36 Approach | Impact |
|------------------------------|-------------------|--------|
| `console.error("Export failed", err)` then swallow | `notifyError(toUserMessage(err), retryFn)` sticky | User sees failure + can retry |
| Raw `setError(error.message)` on login | `setError(toUserMessage(error))` | No raw Supabase text leaks |
| `useDataMigration` ignores `partial` | thread `partial` → honest splash copy | No false "complete" |
| `handleImport` leaves orphan session/items on failure | track + compensating delete | Atomic from the user's POV |
| `useUserRole` silently nulls role | distinguish load-failure, surface | Admin not silently demoted |

**Deprecated/outdated:** none — no library churn relevant here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Codex #16-20 "admin role/account load" refers primarily to `useUserRole` (the only fully-silent admin path); other admin consumers already surface inline | Pitfall 3 | Low — if a specific Codex line names a different site, planner adds it; the inventory of admin consumers is complete in this doc |
| A2 | Supabase bad-credential message string is "Invalid login credentials" (matched case-insensitively in `toUserMessage`) | Code Examples | Low — copy still degrades gracefully to generic; verify exact GoTrue string against a live failed login during impl |
| A3 | `deleteItem`/`deleteSession` store actions fully unwind Dexie state for newly-created rows (satisfying D-01's Dexie-unwind requirement) | Pattern 2 | Medium — planner should confirm these actions remove the Dexie id-mapping/cached rows, not just the Supabase row; if not, rollback must also clear Dexie explicitly |

## Open Questions

1. **Exact Supabase auth error string for bad credentials**
   - What we know: GoTrue returns a message; D-09 maps it to "Wrong email or password".
   - What's unclear: the precise string (could be "Invalid login credentials").
   - Recommendation: match a small set case-insensitively (A2) and verify with one live failed login during execution; generic fallback covers misses.

2. **Does `deleteSession`/`deleteItem` clear Dexie id-mapping rows too?**
   - What we know: D-01 requires unwinding Dexie, not just Supabase.
   - What's unclear: whether the existing delete actions also purge the Dexie `idMapping`/cache entries created during the failed import.
   - Recommendation: planner verifies during planning; if not, add explicit Dexie cleanup to the compensating block (A3).

3. **Should `useUserRole` load-failure surface a toast or just an inline/retry state?**
   - What we know: it's the genuinely-silent admin path.
   - What's unclear: a toast for a background role fetch may be noisy on every transient blip.
   - Recommendation: distinguish `null` (not admin) from `undefined`/`"error"` (load failed); surface via toast with retry only on a definite error, keeping the existing `undefined`=loading semantics.

## Environment Availability

> Skipped — this phase is code-only. No external tools, services, or runtimes beyond the existing dev stack (vitest, vite) are introduced. Supabase is already wired; no new edge functions or migrations.

## Validation Architecture

> `nyquist_validation` not disabled in config → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (`package.json`) |
| Config file | `vite.config.ts` |
| Quick run command | `npx vitest --run <file>` |
| Full suite command | `npm test` (`vitest --run`) |

### Phase Requirements → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | Export failure → notifyError called with retry | unit | `npx vitest --run src/tests/session-export-notify.test.tsx` | ❌ Wave 0 |
| SC2 | Import failure → compensating deletes + notify | unit | `npx vitest --run src/tests/new-session-import-rollback.test.tsx` | ❌ Wave 0 |
| SC3 | Partial migration → splash NOT "complete" | unit | `npx vitest --run src/tests/data-migration-partial.test.ts` | ⚠️ extend `data-migration.test.ts` |
| SC4a | Login error → toUserMessage friendly copy | unit | `npx vitest --run src/tests/login-page.test.tsx` (extend) | ⚠️ exists |
| SC4b | `toUserMessage` maps auth/network/unknown | unit | `npx vitest --run src/tests/to-user-message.test.ts` | ❌ Wave 0 |
| SC4c | useUserRole load-failure distinguishable | unit | `npx vitest --run src/tests/use-user-role.test.ts` | ❌ Wave 0 |
| toast | retryable toast is sticky; dedupe works | unit | `npx vitest --run src/tests/error-toast.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched test file(s) via `npx vitest --run <file>`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/to-user-message.test.ts` — D-09 mapping (auth/network/unknown)
- [ ] `src/tests/error-toast.test.tsx` — sticky-when-retry (D-06) + dedupe (D-05); use fake timers
- [ ] `src/tests/session-export-notify.test.tsx` — SC1
- [ ] `src/tests/new-session-import-rollback.test.tsx` — SC2 (assert compensating deletes + notify)
- [ ] `src/tests/use-user-role.test.ts` — SC4c
- [ ] Extend `src/tests/data-migration.test.ts` — partial → not "complete" (SC3)
- [ ] Extend `src/tests/login-page.test.tsx` — friendly copy (SC4a)
- [ ] **Pattern to copy:** `src/tests/update-item-field-notify.test.ts` (vi.hoisted mocks of `notificationStore.getState().notifyError`, `supabase.from`, zustand persist no-op). All notify-assertion tests should mirror this.
- [ ] **Pre-existing failures to ignore:** 18 `localStorage.clear is not a function` failures in `persist-scoping.test.ts` / `photo-migration.test.ts` (STATE.md — unrelated, do not "fix" in this phase).

## Project Constraints (from CLAUDE.md)

- **No comments unless WHY-comments** — default to none; the existing code (e.g. `migration.ts:38`, `offlineQueue.ts:48`) follows this with explanatory WHY-comments only on non-obvious invariants. Match that.
- **Atomic commits** — one concern per commit (the rollback, the toast change, the migration fix, the helper should be separable).
- **Schema = single source of truth** — N/A this phase (D-03: no schema change). Do NOT touch `_workspace/Schema/schema.md` or run `npm run db:types`.
- **Cross-app check** — this is single-repo polish; no cross-app feature note drives it.
- **Reference code as `path:line`** — already done throughout this doc.

## Security Domain

> `security_enforcement` not disabled → section included. This phase is low-security-surface (UI feedback + client rollback), but two items are relevant.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Login error copy must not leak whether email exists vs password wrong — D-09's "Wrong email or password" is the correct generic (does not distinguish) ✓ |
| V3 Session Management | no | Untouched |
| V4 Access Control | yes | `useUserRole` load-failure must **fail closed** — a failed role fetch must NOT grant admin. Current `setRole(null)` already fails closed; preserve that when adding visibility (surface the error, but keep `isAdmin=false` on load failure) |
| V5 Input Validation | no | No new inputs |
| V6 Cryptography | no | None |
| V7 Error Handling / Logging | yes | Raw Supabase/JSON/stack text must never reach the user (D-09) — this is the core of the phase; generic fallback prevents info leakage |

### Known Threat Patterns for React/Supabase client
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth error enumeration (email-exists oracle) | Information Disclosure | Single generic "Wrong email or password" (D-09) — do not branch copy on which field was wrong |
| Privilege fail-open on role-load error | Elevation of Privilege | `useUserRole` keeps `isAdmin=false` on error; surface the failure but never default to admin |
| Raw backend error leakage to UI | Information Disclosure | `toUserMessage` generic fallback; never render `error.message` directly |

## Sources

### Primary (HIGH confidence)
- Direct codebase read (all file:line references above): `notificationStore.ts`, `ErrorToast.tsx`, `WarnBanner.tsx`, `migration.ts`, `useDataMigration.ts`, `MigrationSplash.tsx`, `sessions.ts`, `sessionStore.ts`, `NewSession.tsx`, `SessionDetail.tsx`, `authStore.ts`, `Login.tsx`, `useUserRole.ts`, `adminApi.ts`, `AccountManagement.tsx`, `offlineQueue.ts`, `aiErrorClass.ts`, `update-item-field-notify.test.ts`, `error-classify.test.ts`.
- `36-CONTEXT.md`, `36-UI-SPEC.md` — locked decisions D-01..D-09.
- `STATE.md` — pre-existing test-failure list, branch policy.

### Secondary / Tertiary
- None — no external/web sources needed for this phase.

## Metadata

**Confidence breakdown:**
- Call-site identification: HIGH — every Codex touchpoint located at file:line by direct read.
- Reuse API surface: HIGH — `notificationStore`/`ErrorToast`/`WarnBanner` read in full.
- Import-rollback design: MEDIUM-HIGH — pattern sound and has in-repo precedent (`migration.ts`); open question on Dexie-unwind completeness of `deleteItem`/`deleteSession` (A3/Q2).
- Migration-bug fix: HIGH — exact discard located (`useDataMigration.ts:35-40`).

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable; codebase-internal, low churn)
