# Phase 36: ux-visibility-polish - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 13 (5 new, 8 modified)
**Analogs found:** 13 / 13 (all in-repo; zero external)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/toUserMessage.ts` (NEW — or `src/services/`) | utility | transform | `src/stores/sessionStore.ts:9` (`isNetworkError`) | partial (shape) |
| `src/stores/notificationStore.ts` (MODIFY) | store | event-driven | self (dedupe in `notifyError`) | exact (self-edit) |
| `src/components/ErrorToast.tsx` (MODIFY) | component | event-driven | self (sticky timer) | exact (self-edit) |
| `src/pages/SessionDetail.tsx` (MODIFY, ~239-274) | page/handler | request-response | `src/stores/sessionStore.ts:468` (notify+retry) | exact (notify pattern) |
| `src/pages/NewSession.tsx` (MODIFY, 78-122) | page/handler | request-response + rollback | `src/db/migration.ts:160-177` (id-tracking) | role+flow match |
| `src/hooks/useDataMigration.ts` (MODIFY, 28-44) | hook | event-driven | self (thread `partial`) | exact (self-edit) |
| `src/components/MigrationSplash.tsx` (MODIFY, 48-60) | component | request-response | self (copy branch) | exact (self-edit) |
| `src/hooks/useUserRole.ts` (MODIFY) | hook | request-response | self (fail-closed + signal) | exact (self-edit) |
| `src/pages/Login.tsx` (MODIFY, 22-25) | page/handler | request-response | self (`setError`) | exact (self-edit) |
| `src/services/offlineQueue.ts` (MODIFY, ~50) | service | request-response | `src/stores/sessionStore.ts:468` | role-match |
| `src/tests/to-user-message.test.ts` (NEW) | test | transform | `src/tests/update-item-field-notify.test.ts` | role-match |
| `src/tests/error-toast.test.tsx` (NEW) | test | event-driven | `src/tests/update-item-field-notify.test.ts` | role-match |
| `src/tests/session-export-notify.test.tsx` + `new-session-import-rollback.test.tsx` (NEW) | test | request-response | `src/tests/update-item-field-notify.test.ts` | exact (mock shape) |

> Extend (not create): `src/tests/data-migration.test.ts`, `src/tests/login-page.test.tsx`, `src/tests/use-user-role.test.ts` — **all three already exist** (RESEARCH listed `use-user-role.test.ts` as a Wave-0 gap; it is present — extend it).

## Pattern Assignments

### `src/lib/toUserMessage.ts` (utility, transform) — NEW

**Analog:** `src/stores/sessionStore.ts:9-13` (`isNetworkError`) — reuse its token set; do not duplicate, import or fold it in.

**Network-token detection to mirror** (`sessionStore.ts:9-13`):
```typescript
function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "");
  return msg.includes("Failed to fetch") || msg.includes("ERR_INTERNET_DISCONNECTED") || msg.includes("NetworkError") || msg.includes("network");
}
```

**New helper shape (D-09)** — pure function, no I/O, maps known shapes → friendly copy, generic fallback for unmapped. Auth bad-credential → "Wrong email or password"; network → "Connection problem — try again"; unknown → "Something went wrong". Match auth string case-insensitively (`/invalid login credentials/i`); verify exact GoTrue string with one live failed login during impl (research A2/Q1). **Do not flatten already-good site copy** (Pitfall 4) — funnel's job is killing raw-JSON/auth-string leakage.

---

### `src/stores/notificationStore.ts` (store, event-driven) — MODIFY

**Analog:** self. Current store (full file, 15 lines):
```typescript
export const useNotificationStore = create<NotificationState>()((set) => ({
  message: null,
  retry: null,
  notifyError: (message, retry) => set({ message, retry: retry ?? null }),
  dismiss: () => set({ message: null, retry: null }),
}));
```

**Dedupe change (D-05)** — skip re-show when message is identical to the currently displayed one. No signature change:
```typescript
notifyError: (message, retry) =>
  set((s) => (s.message === message ? s : { message, retry: retry ?? null })),
```

---

### `src/components/ErrorToast.tsx` (component, event-driven) — MODIFY

**Analog:** self. Current auto-dismiss effect (`ErrorToast.tsx:11-19`):
```typescript
useEffect(() => {
  if (message === null) return;
  const timer = setTimeout(() => {
    useNotificationStore.getState().dismiss();
  }, 6000);
  return () => clearTimeout(timer);
}, [message]);
```

**Sticky-when-retryable change (D-06)** — gate the timer on `retry === null`, add `retry` to deps. Informational toasts keep 6s; retryable toasts never schedule dismissal:
```typescript
useEffect(() => {
  if (message === null || retry !== null) return; // sticky when retryable
  const timer = setTimeout(() => useNotificationStore.getState().dismiss(), 6000);
  return () => clearTimeout(timer);
}, [message, retry]);
```
Retry button already wired (`ErrorToast.tsx:36-47`: `retry(); dismiss();`) — no change there.

---

### `src/pages/SessionDetail.tsx` (page/handler, request-response) — MODIFY (~239-274)

**Analog:** `src/stores/sessionStore.ts:468-487` (the canonical notify+retry pattern).

**Today — silent swallow** (`SessionDetail.tsx:244-248`, identical shape at `269-271`):
```typescript
} catch (err) {
  console.error("Export failed:", err);
} finally {
  setExporting(false);
}
```

**Apply — canonical notify+retry** (copy from `sessionStore.ts:472-486`):
```typescript
useNotificationStore.getState().notifyError(
  `Couldn't save ${field}. Tap Retry to try again.`,
  () => { /* retry closure — re-run the same op (D-08) */ },
);
```
Export is idempotent/read-only, so the retry closure is simply `() => handleExport()` / `() => handleExportSpreadsheet()` (no stale-edit guard needed — that guard at `sessionStore.ts:478-484` is specific to field edits). Funnel the message through `toUserMessage(err)`. Toast is sticky because a `retry` is attached (D-06).

---

### `src/pages/NewSession.tsx` (page/handler, request-response + rollback) — MODIFY (78-122)

**Analog:** `src/db/migration.ts:160-177` (in-repo id-tracking + selective cleanup precedent) for the rollback; `sessionStore.ts:468` for the notify.

**`doCreate` today — silent on throw** (`NewSession.tsx:78-91`): wrap the `createSession` call so a throw routes to `notifyError(toUserMessage(err), () => doCreate())`.

**`handleImport` today — non-atomic** (`NewSession.tsx:100-121`): leaves an orphan session + partial items if any insert throws mid-loop.
```typescript
const sessionId = await createSession(name.trim(), "sale", ...);
for (const receipt of receipts) {
  const itemId = await createBlankItem(sessionId, "sale");
  await updateItemField(itemId, sessionId, "receipt_number", receipt);
}
```

**Apply — client-side compensating rollback (D-01, Pattern 2):** track `createdSessionId` + `createdItemIds[]`; on `catch`, delete in reverse (best-effort `.catch(() => {})`), then `notifyError("Import didn't finish — changes were undone. Try again.", () => handleImport(receipts, skipped))` (wholesale retry, D-08).

**Delete actions already exist and unwind Dexie via the store** (these satisfy D-01's Dexie-unwind, but verify A3/Q2 the store actions also purge Dexie idMapping/cache rows created during the failed import):
- `deleteItem(id, sessionId)` — `src/db/items.ts:48-53` → `useSessionStore.getState().deleteItem(id, sessionId)`
- `deleteSession(id)` — `src/db/sessions.ts:28-30` → `useSessionStore.getState().deleteSession(id)`

**id-tracking precedent to mirror** (`migration.ts:168-177`): arrays accumulate landed ids; cleanup deletes only what landed. Same "track what landed, clean up selectively" shape.

> Note: `NewSession` already surfaces `accountsError` inline (`:49-52`) with good copy — leave it; only route its text through `toUserMessage` if raw error leakage is possible (Pitfall 3/4). Do NOT double-handle.

---

### `src/hooks/useDataMigration.ts` (hook, event-driven) — MODIFY (28-44)

**Analog:** self. The bug (`useDataMigration.ts:35-40`): reads `result.migrated`/`result.skipped`, **ignores `result.partial`**, always sets `state: "complete"`.

**Upstream already computes the flag** (`migration.ts:177`): `return { migrated, skipped, partial: skipped > 0 };`

**Apply (D-07):** add a `"partial"` branch to the `MigrationState` union and set it when `result.partial` (or `result.skipped > 0`); thread `skipped` through. `MigrationState` currently: `"checking" | "not-needed" | "in-progress" | "complete" | "error"`. The `catch` (`:41-42`) only fires on thrown exceptions — partial must be handled on the success path. **Do NOT add Phase 38's retry-from-Settings flow.**

---

### `src/components/MigrationSplash.tsx` (component, request-response) — MODIFY (48-60)

**Analog:** self. Honest copy already exists in the `state === "error"` branch (`:58-59`): `"${skipped} items could not be migrated. Your data is safe..."`. Route the new `partial` outcome to honest copy (reuse the error-branch wording or add a dedicated partial heading). `complete` keeps `"All sessions are now synced to the server."` only on a true clean run. Props type currently `"in-progress" | "complete" | "error"` (`:5`) — widen to accept `partial` consistent with the hook change.

---

### `src/hooks/useUserRole.ts` (hook, request-response) — MODIFY

**Analog:** self. Today (`useUserRole.ts:21-27`) collapses load-failure into `setRole(null)` — indistinguishable from "not admin", silently demotes an admin whose fetch failed:
```typescript
.then(({ data, error }) => {
  if (cancelled) return;
  if (error) {
    setRole(null);
  } else {
    setRole(data?.role ?? null);
  }
});
```

**Apply (Codex #16-20, ASVS V4 fail-closed):** distinguish load-failure from "not admin" — keep `isAdmin = false` on error (preserve fail-closed; never default to admin), but signal the failure (toast with retry, or a distinct state). Keep existing `undefined`=loading semantics (`:32`). Surface only on a definite error, not transient blips (Q3). This is the **one genuinely-silent admin path** (Pitfall 3) — other admin consumers already surface inline; do not touch them.

---

### `src/pages/Login.tsx` (page/handler, request-response) — MODIFY (22-25)

**Analog:** self. Today renders raw Supabase text (`Login.tsx:24-25`): `setError(error.message);`

**Apply (Codex #21, D-09):** `setError(toUserMessage(error));` — no raw GoTrue/JSON text reaches the user. Existing `role="alert"` error paragraph (`:104-108`) is the render surface; unchanged. Generic "Wrong email or password" avoids the email-exists oracle (ASVS V2 / STRIDE Information Disclosure).

---

### `src/services/offlineQueue.ts` (service, request-response) — MODIFY (~50)

**Analog:** `sessionStore.ts:468` (non-hook notify). Today (`offlineQueue.ts:47-52`) returns `[]` on read failure with `console.warn` only:
```typescript
if (error || !data) {
  if (error) console.warn("getQueuedItems: Supabase read failed", error);
  return [];
}
```

**Apply (Codex #27/#28):** route the read failure through `useNotificationStore.getState().notifyError(toUserMessage(error))` (visibility only — function still returns `[]` by design; do not change the empty-return contract). Informational (no retry) → keeps 6s auto-dismiss.

---

## Shared Patterns

### Non-hook store notify (every catch site outside a React render)
**Source:** `src/stores/sessionStore.ts:468,472`
**Apply to:** `SessionDetail` handlers, `NewSession` handlers, `offlineQueue`, `useUserRole`
```typescript
useNotificationStore.getState().notifyError(
  `Couldn't save ${field}. Tap Retry to try again.`,
  () => { /* retry closure */ },
);
```

### Error → friendly copy funnel (D-09)
**Source:** NEW `toUserMessage`, seeded from `isNetworkError` (`sessionStore.ts:9`)
**Apply to:** Login, fetch (`offlineQueue`), admin load (`useUserRole`), export (`SessionDetail`)
Raw Supabase/JSON/stack text must never reach the user (ASVS V7). Preserve already-good site copy; map known shapes, generic fallback for unmapped.

### Client-side compensating rollback (D-01)
**Source:** `src/db/migration.ts:168-177` id-tracking precedent; delete actions `src/db/items.ts:48`, `src/db/sessions.ts:28`
**Apply to:** `NewSession.handleImport` (and the spirit of `doCreate` failure)
Track landed ids → reverse-order best-effort deletes on failure → notify with wholesale retry.

### Test mocking pattern (notify-assertion tests)
**Source:** `src/tests/update-item-field-notify.test.ts:1-34`
**Apply to:** all new/extended tests (to-user-message, error-toast, export-notify, import-rollback, login, use-user-role, data-migration)
```typescript
const { mockFrom, mockNotifyError, mockDismiss } = vi.hoisted(() => ({
  mockFrom: vi.fn(), mockNotifyError: vi.fn(), mockDismiss: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({ supabase: { from: mockFrom } }));
vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: { getState: () => ({ notifyError: mockNotifyError, dismiss: mockDismiss }) },
}));
vi.mock("zustand/middleware", async () => {
  const actual = await vi.importActual<typeof import("zustand/middleware")>("zustand/middleware");
  return { ...actual, persist: (fn: unknown) => fn };
});
```
For `error-toast.test.tsx` use **fake timers** to assert sticky-when-retry (D-06) + dedupe (D-05). **Ignore** the 18 pre-existing `localStorage.clear is not a function` failures in `persist-scoping.test.ts`/`photo-migration.test.ts` (STATE.md — unrelated).

## No Analog Found

None. Every file has an in-repo analog (most are self-edits to DAT-4 infrastructure). The single piece of new *logic* — import rollback — has a structural precedent in `migration.ts`. The single new *utility* — `toUserMessage` — has a token-detection precedent in `isNetworkError`.

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/hooks/`, `src/pages/`, `src/services/`, `src/db/`, `src/lib/`, `src/tests/`
**Files scanned (read):** notificationStore.ts, ErrorToast.tsx, useDataMigration.ts, MigrationSplash.tsx, sessionStore.ts (3 ranges), migration.ts, SessionDetail.tsx, NewSession.tsx, Login.tsx, useUserRole.ts, offlineQueue.ts, items.ts, sessions.ts, update-item-field-notify.test.ts
**Pattern extraction date:** 2026-06-02
