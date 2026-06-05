---
phase: 34-ios-memory-optimization
plan: 02
subsystem: catalog-ui
tags: [perf, react-memo, dexie, render-fanout, ios-memory]
requires:
  - "34-00 (Wave-0 RED tests: item-card-render-count.test.tsx, __itemCardRenderCounts contract)"
provides:
  - "ItemList single aggregate useLiveQuery → Map<itemId, ItemMeta>; primitive meta props to ItemCard"
  - "Prop-driven React.memo'd ItemCard with dev-only __itemCardRenderCounts (D-08)"
  - "docs/runbooks/ios-memory-smoke.md (D-09 manual two-part memory smoke)"
affects:
  - "src/components/ItemList.tsx"
  - "src/components/ItemCard.tsx"
tech-stack:
  added: []
  patterns:
    - "Single aggregate Dexie subscription hoisted to container; slices passed as primitive props"
    - "React.memo with custom field-level item comparator (item object identity churns per Dexie emit)"
    - "Stable per-item callback dispatcher (ref-backed) to keep memo'd children stable across parent renders"
    - "Dev-only render instrumentation guarded by import.meta.env.MODE (first in repo)"
key-files:
  created:
    - "docs/runbooks/ios-memory-smoke.md"
  modified:
    - "src/components/ItemList.tsx"
    - "src/components/ItemCard.tsx"
    - "src/tests/item-card-audio-status.test.tsx"
    - "src/tests/item-list.test.tsx"
decisions:
  - "Custom React.memo comparator shallow-compares item fields — primitive props alone don't cover the item object whose reference changes on every Dexie emit"
  - "Stable per-item onToggle dispatcher (ref + per-id cache) so closures don't defeat memo"
  - "db.photos mock in item-list.test.tsx gained .count() (aggregate now calls count, not toArray)"
metrics:
  duration: "~13m"
  completed: "2026-06-01"
  tasks: 2
  files: 5
---

# Phase 34 Plan 02: ItemList aggregate hoist + prop-driven memoized ItemCard Summary

Collapsed the ~4N per-ItemCard Dexie subscriptions/effects into ONE aggregate `useLiveQuery` in `ItemList` that builds a `Map<itemId, ItemMeta>`; `ItemCard` is now prop-driven and `React.memo`-wrapped, so a single item's `ai_status`/recording-state change re-renders only that card (PERF-3, D-08), plus a D-09 manual memory-smoke runbook.

## What Was Built

**ItemList aggregate (`src/components/ItemList.tsx`)**
- Added imports: `useLiveQuery`, `getDexieItemId`, `hasPendingForItem`, `db`.
- Module-level `interface ItemMeta` (5 fields) + `const EMPTY_META = new Map(...)` for stable empty-state identity.
- One aggregate `useLiveQuery(async () => Map, [items], EMPTY_META)` composing the existing tested helpers once per item: `audioRecordsForItem` (audioCount + reduce-max latestAudioId), `getDexieItemId ?? item.id`, house-only `db.photos…count()` (D-07), `hasPendingForItem`. Guarded `itemMeta instanceof Map` fallback to `EMPTY_META` (the test's sync `useLiveQuery` mock returns a Promise for an async builder).
- Threaded primitive props (`audioCount`/`latestAudioId`/`photoCount`/`dexieItemId`/`isPending`) onto the non-compact `<ItemCard>`. `compact` branch and `handleRetryAll` left untouched.
- Stable per-item `onToggle` dispatcher (ref-backed handler + per-id callback cache) so a fresh closure per render doesn't defeat `React.memo`.

**Prop-driven memoized ItemCard (`src/components/ItemCard.tsx`)**
- Removed all 4 reactive surfaces: `dexieItemId` effect, `isPending` effect, audio `useLiveQuery`, photo `useLiveQuery`. Dropped now-unused imports (`useLiveQuery`, `db`, `getDexieItemId`, `audioRecordsForItem`, `hasPendingForItem`).
- Extended `ItemCardProps` with the 5 meta props. `handleRetryAi` reads the `latestAudioId` prop (Pitfall 4); retry-disabled guard + "No audio to retry" title preserved. Kept `useAudioUploadStatus(latestAudioId ?? undefined)` per-card (Pitfall 5).
- `export const __itemCardRenderCounts` dev-only counter (D-08), guarded by `import.meta.env.MODE !== "production"`.
- Renamed component to `ItemCardImpl`; `export const ItemCard = React.memo(ItemCardImpl, arePropsEqual)`.

**Runbook (`docs/runbooks/ios-memory-smoke.md`)** — D-09 two-part manual procedure (Chrome heap snapshot + iOS Safari Web Inspector timeline) with the verbatim COOP/COEP caveat and the literal `measureUserAgentSpecificMemory` token.

## TDD Gate Compliance

- RED: `src/tests/item-card-render-count.test.tsx` (Wave-0 / Plan 00) — verified failing at base (no `__itemCardRenderCounts`, all 3 cards re-render).
- GREEN: commit `c64cc7b` (`feat(34-02): …`) — render-count test passes; one-item flip re-renders only that card.
- `docs(34-02)` runbook commit `e391af4` precedes GREEN (doc task, no test gate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React.memo needs a custom field-level comparator**
- **Found during:** GREEN (render-count test).
- **Issue:** Default shallow `memo` re-rendered ALL cards on a one-item flip — the test rebuilds the whole `items` array, so every `item` prop is a new object reference each render. Primitive meta props alone don't cover the `item` object identity churn (also occurs in production: every Dexie emit yields a fresh array).
- **Fix:** Added `arePropsEqual` to `React.memo` — strict-compares the 9 scalar/function props, then shallow-compares the `item` object's own fields. Structurally-unchanged items skip re-render. This is the must-have ("a change on one item does NOT re-render the other N-1").
- **Files:** `src/components/ItemCard.tsx`. **Commit:** c64cc7b.

**2. [Rule 1 - Bug] Inline onToggle closures defeated memo**
- **Found during:** GREEN.
- **Issue:** `onToggle={() => toggleExpand(item.id)}` created a fresh function per render → comparator always returned false.
- **Fix:** Stable per-item dispatcher — a `toggleHandlerRef` holds the live select-mode-aware behavior; a per-id `onToggleCacheRef` returns the same callback identity per item across renders.
- **Files:** `src/components/ItemList.tsx`. **Commit:** c64cc7b.

**3. [Rule 1 - Bug] item-list.test.tsx db mock missing .count()**
- **Found during:** full-suite run (2 unhandled rejections).
- **Issue:** The aggregate calls `db.photos.where().equals().count()`; the test's mock only provided `.toArray()`.
- **Fix:** Added `count: vi.fn().mockResolvedValue(0)` to the photos/audio mocks. Tests passed before the fix but emitted unhandled rejections — cleaned up since I introduced the `.count()` path.
- **Files:** `src/tests/item-list.test.tsx`. **Commit:** c64cc7b.

**4. [Rule 3 - Blocking] eslint react-refresh on dev-counter export**
- **Issue:** Exporting the non-component `__itemCardRenderCounts` from `ItemCard.tsx` trips `react-refresh/only-export-components`. The export location is contract (the test imports it from this module).
- **Fix:** Single-line `eslint-disable-next-line` with a WHY comment.
- **Files:** `src/components/ItemCard.tsx`. **Commit:** c64cc7b.

## Verification

- `npx vitest --run src/tests/item-card-render-count.test.tsx` → green.
- `npx vitest --run src/tests/item-card-audio-status.test.tsx` → green (renderCard passes 5 meta props).
- `grep -c useLiveQuery src/components/ItemCard.tsx` → 0; `grep -q "React.memo"` → present; `grep -q "audioCount="` in ItemList → present.
- Runbook check: `test -f … && grep -q measureUserAgentSpecificMemory … && grep -qi "web inspector" …` → OK.
- `npx tsc --noEmit` → clean. `npx eslint` on both components → clean.
- Full suite: 70 files passed / 5 skipped, 593 passed / 55 todo, 0 failures, 0 errors. (The "18 localStorage.clear failures" noted in the plan are not present at this worktree base — those suites are among the skipped set.)

## Known Stubs

None.

## Threat Flags

None — read-only aggregate; same tested helpers composed once each; no new external surface.

## Self-Check: PASSED
