# Phase 34: ios-memory-optimization - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 6 (4 modify, 1 create, 1 modify-test)
**Analogs found:** 6 / 6 (all in-repo; 2 patterns are net-new and sourced from RESEARCH.md)

> RESEARCH.md already enumerated analogs + excerpts with line numbers. This map
> confirms the live code shapes (re-read each analog) and pins the exact
> copy-from lines so the planner can reference them directly. Two patterns
> (`React.memo` + dev render counter) have **no in-repo analog** — the codebase
> contains zero `React.memo` and zero `import.meta.env.MODE/DEV` guards today
> (verified by grep). Those come from RESEARCH.md Pattern 3.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/gemini.ts` (`blobToBase64`) | service / utility | transform (blob→base64) | self (current `blobToBase64`, lines 135-145) | in-place refactor |
| `src/services/geminiContinuous.ts` | service | transform | already imports shared `blobToBase64` (line 11) | no-change (verify) |
| `src/components/ItemList.tsx` | component (container) | CRUD-read aggregate (Dexie) | the per-card query in `ItemCard.tsx:49-60` (lift it up) | role+flow exact |
| `src/components/ItemCard.tsx` | component (presentational) | request-response → prop-driven | self (strip 4 reactive surfaces, lines 37-88) | in-place refactor |
| `src/tests/item-card-render-count.test.tsx` | test (component) | n/a | `src/tests/item-card-audio-status.test.tsx:29-78` | exact harness reuse |
| `src/tests/gemini-pipeline.test.ts` | test (unit) | n/a | existing `blobToBase64` test, lines 109-116 | extend existing describe |

## Pattern Assignments

### `src/services/gemini.ts` — `blobToBase64` (service/transform)

**Analog:** self — replace current body. Current shape (lines 135-145):

```typescript
export async function blobToBase64(blob: Blob): Promise<string> {
  // Re-wrap to ensure we have a proper Blob (handles structured clone edge cases)
  const freshBlob = new Blob([blob], { type: blob.type });   // D-02: full copy — DROP
  const buffer = await freshBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);                 // PERF-1: full-size binary string
  }
  return btoa(binary);                                       // PERF-1: btoa copies again
}
```

**Replace with** (chunked encoder, RESEARCH.md Pattern 1, lines 167-176):
- Drop the `freshBlob` re-wrap (D-02). `blob.arrayBuffer()` works on the passed blob directly.
- Iterate `bytes` in a **3-byte-aligned** window (NOT `0x8000`=32768; that is not divisible by 3). Use `32766` (`0x8000 - 2`, divisible by 3) or any `3*k`. This is the single correctness trap (Pitfall 1).
- `result += btoa(String.fromCharCode(...chunk))` per window via `bytes.subarray(i, i+CHUNK)` (subarray = view, no copy).
- Keep the exact export name/signature `(blob: Blob): Promise<string>` — `geminiContinuous.ts:11` and `gemini.ts:202` both consume it unchanged.
- Output is byte-identical, so the existing `:114` equality test stays green.

**Why a WHY-comment is needed:** D-02 mandates a WHY-comment ONLY if the re-wrap is *retained*. Recommended path drops it, so no WHY-comment for the drop; if a smoke surfaces a structured-clone failure, restore the re-wrap with a comment naming the failing case.

---

### `src/services/geminiContinuous.ts` (service/transform)

**Analog:** itself — already correct. Verified live: line 11 imports `blobToBase64` from `./gemini`; line 140 calls `await blobToBase64(geminiAudioBlob)`. **No source edit needed** — making the single `gemini.ts` export chunked fixes this path automatically (D-03 "one encoder" already structurally satisfied). Planner action: leave a deferred-note TODO for PERF-2 (master-blob rework, D-04), do not touch the encoder call.

---

### `src/components/ItemList.tsx` (container/aggregate-read)

**Analog for the aggregate query:** the per-card `useLiveQuery` in `ItemCard.tsx:49-60` (lift it to operate over the whole `items` array).

**Current render site** (lines 264-310) — items already mapped here; `ItemList` already owns `items` via `useSessionItems(sessionId)` (line 30):

```tsx
const items = useSessionItems(sessionId);
// ...
{items.map((item) => (
  <div key={item.id} data-item-id={item.id} ...>
    {/* checkbox ... */}
    <ItemCard
      item={item}
      sessionId={sessionId}
      isExpanded={!selectMode && expandedIds.has(item.id)}
      onToggle={...}
      readOnly={readOnly || selectMode}
    />
  </div>
))}
```

**Add ONE aggregate `useLiveQuery`** (RESEARCH.md Pattern 2, lines 199-220) above the return, keyed `[items]`, with a **module-level stable empty default**:

```typescript
const EMPTY_META = new Map<string, ItemMeta>();   // module scope — stable identity (avoids flicker churn)
```

Loop body composes the existing tested helpers once per item (the same calls `ItemCard` makes today):
- `audioRecordsForItem(item.id)` → `audioCount` + `latestAudioId` (reduce-max, copied verbatim from `ItemCard.tsx:51-56`)
- `getDexieItemId(item.id) ?? item.id` → `dexieItemId` (from `ItemCard.tsx:40`)
- `item.mode === "house" && dexieItemId != null ? db.photos.where("itemId").equals(dexieItemId).count() : 0` → `photoCount` (D-07 house-only guard, from `ItemCard.tsx:79-88`)
- `hasPendingForItem(item.id)` → `isPending` (from `ItemCard.tsx:46`)

`ItemList` already imports `audioRecordsForItem` (line 3). It must add imports for `getDexieItemId` (`../db/idMapping`), `hasPendingForItem` (`../hooks/useWriteAheadQueue`), `db` (`../db`), and `useLiveQuery` (`dexie-react-hooks`) — all already imported in `ItemCard.tsx:3,12-14`.

**Thread the slice as PROPS** (RESEARCH.md recommends **primitive props over a meta object** for clean `React.memo` shallow-compare — Anti-Pattern + Pattern 3):

```tsx
const meta = itemMeta.get(item.id);   // or default zeros
<ItemCard
  item={item}
  sessionId={sessionId}
  isExpanded={...}
  onToggle={...}
  readOnly={...}
  audioCount={meta?.audioCount ?? 0}
  latestAudioId={meta?.latestAudioId ?? null}
  photoCount={meta?.photoCount ?? 0}
  dexieItemId={meta?.dexieItemId ?? null}
  isPending={meta?.isPending ?? false}
/>
```

Note: the `compact` branch (lines 199-235) renders a different markup and does NOT use `ItemCard` — leave it untouched. `handleRetryAll` (lines 88-105) still calls `audioRecordsForItem` itself; that is fine (one-shot on click, not a subscription) — out of scope.

---

### `src/components/ItemCard.tsx` (presentational/prop-driven)

**Analog:** self — strip the 4 reactive surfaces, become prop-driven, wrap in `React.memo`.

**Remove** (current lines 37-88):
- `dexieItemId` state + effect (lines 37-41)
- `isPending` state + effect (lines 43-47)
- `audioData` `useLiveQuery` (lines 49-60) → `audioCount`, `latestAudioId` (lines 62-63)
- `photoCount` `useLiveQuery` (lines 79-88)
- Drop imports now unused: `useLiveQuery`, `getDexieItemId`, `audioRecordsForItem`, `hasPendingForItem`, and possibly `db` (keep only if still referenced).

**Keep** (local UI state — D-06): `showDeleteConfirm`, `retrying` (lines 31-32), and `useAudioUploadStatus(latestAudioId ?? undefined)` per-card (line 66, Pitfall 5 — `latestAudioId` is now a prop, hook stays).

**Extend `ItemCardProps`** (current lines 21-27) with the 5 meta props:
```typescript
interface ItemCardProps {
  item: SupabaseItem;
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  readOnly?: boolean;
  audioCount: number;
  latestAudioId: number | null;
  photoCount: number;
  dexieItemId: number | string | null;
  isPending: boolean;
}
```

**Pitfall 4 — `latestAudioId` must still reach `handleRetryAi`** (current lines 68-77). It now arrives as a prop; the handler body is unchanged, just reads the prop instead of the removed `audioData`. The retry-disabled guard `disabled={retrying || !latestAudioId}` (line 377) and `title={!latestAudioId ? "No audio to retry" : undefined}` (line 378) keep working with the prop.

**Wrap in `React.memo`** (NO in-repo analog — source: RESEARCH.md Pattern 3, lines 231-238). This is what *delivers* the fan-out reduction (Pitfall 2):
```typescript
function ItemCardImpl({ item, sessionId, isExpanded, onToggle, readOnly,
                       audioCount, latestAudioId, photoCount, dexieItemId, isPending }: ItemCardProps) {
  if (import.meta.env.MODE !== "production") {
    __itemCardRenderCounts.set(item.id, (__itemCardRenderCounts.get(item.id) ?? 0) + 1);
  }
  // ...existing JSX, now reading props instead of live queries...
}
export const ItemCard = React.memo(ItemCardImpl);
```
And export the test-visible counter (dev-only, D-08):
```typescript
export const __itemCardRenderCounts = new Map<string, number>();
```
Primitive props (not a meta object) make the default shallow `memo` compare correct (Anti-Pattern: fresh object per render defeats memo).

---

### `src/tests/item-card-render-count.test.tsx` (CREATE — component test)

**Analog:** `src/tests/item-card-audio-status.test.tsx` (full file is the template; copy mock block lines 29-53 + `makeItem`/`renderCard` lines 55-78).

**Reusable harness from the analog:**

```typescript
// Mock block to copy (item-card-audio-status.test.tsx:28-53) — adjust as noted below:
vi.mock("../services/gemini", () => ({ processAudioWithAi: vi.fn() }));
vi.mock("../db", () => ({ db: { photos: { where: ... }, audio: { where: ... } } }));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => { try { return fn(); } catch { return undefined; } },
}));
vi.mock("../hooks/useWriteAheadQueue", () => ({ hasPendingForItem: vi.fn().mockResolvedValue(false) }));
vi.mock("../db/idMapping", () => ({ getDexieItemId: vi.fn().mockResolvedValue(10) }));
vi.mock("../db/audioLookup", () => ({ audioRecordsForItem: vi.fn().mockResolvedValue([{ id: 10 }]) }));
vi.mock("../db/items", () => ({ updateItemField: vi.fn(), deleteItem: vi.fn() }));
```

**`makeItem` factory** (lines 55-65) and **`MemoryRouter` wrap** (lines 67-78) copy directly. The synchronous `useLiveQuery` mock (lines 36-40) means the aggregate computes synchronously in the test.

**New test structure (D-08, RED-first):**
- Render `ItemList` with 3 items (the aggregate lives in `ItemList` now, so render `ItemList`, not bare `ItemCard`).
- Clear `__itemCardRenderCounts` in `beforeEach`.
- Capture per-item counts after initial render.
- `rerender` with one item's `ai_status` flipped (e.g. `queued` → `done`).
- Assert ONLY that item's count incremented; the other N-1 stayed flat (proves `React.memo` + stable primitive props).

**Note (Wave 0 task):** the existing `item-card-audio-status.test.tsx` renders `ItemCard` directly (line 67-78) and will break once `ItemCardProps` gains 5 required meta props — `renderCard` must add them (`audioCount`, `latestAudioId`, `photoCount`, `dexieItemId`, `isPending`) to the `<ItemCard .../>`. Confirm that suite still passes after the prop-signature change.

---

### `src/tests/gemini-pipeline.test.ts` (MODIFY — add multi-chunk test)

**Analog:** the existing `describe("blobToBase64")` block (lines 109-116):
```typescript
describe("blobToBase64", () => {
  it("converts a Blob to a base64 string", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    const result = await blobToBase64(blob);
    expect(result).toBe("aGVsbG8gd29ybGQ=");
  });
});
```

**Add a sibling `it`** in the same describe (Pitfall 1 guard): build a blob LARGER than the chunk window (> 32 KB, e.g. 100_000 random/sequential bytes), encode via `blobToBase64`, and assert it equals a reference whole-buffer `btoa`. The 11-byte `"hello world"` test passes regardless of chunk alignment, so this multi-chunk test is the only thing that catches a non-3-aligned window. RED-first (TDD): write before the encoder refactor.

## Shared Patterns

### Reactive Dexie read with stable default (avoid undefined flicker)
**Source:** `src/components/ItemCard.tsx:49-60` (and `useAudioUploadStatus.ts:14`)
**Apply to:** the new aggregate `useLiveQuery` in `ItemList.tsx`
```typescript
const x = useLiveQuery(async () => { /* ... */ }, [deps], DEFAULT_VALUE);
```
Use a **module-level** `EMPTY_META` constant as the default so the empty-state reference is stable across renders (RESEARCH.md note, line 221).

### Existing per-item helpers (do NOT re-implement — compose)
**Source:** `audioRecordsForItem` (`db/audioLookup.ts`), `getDexieItemId` (`db/idMapping.ts`), `hasPendingForItem` (`hooks/useWriteAheadQueue.ts`)
**Apply to:** the aggregate loop in `ItemList.tsx`. These already handle DAT-7 dual-id + cross-device fallback (audioLookup) and the write-ahead queue scan (hasPendingForItem). Call each once per item inside the single `useLiveQuery`.

### `latestAudioId` reduce-max idiom (copied verbatim)
**Source:** `ItemCard.tsx:53-56` AND `ItemList.tsx:96` (already used in `handleRetryAll`)
```typescript
const latestAudioId = count > 0
  ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)
  : null;
```

## No Analog Found

These patterns do not exist anywhere in the repo today (verified: `grep -rn "React.memo" src/` → 0 hits; `import.meta.env.MODE/DEV` guards → 0 hits). Planner must use RESEARCH.md as the source, not a codebase analog:

| Pattern | Used In | Source | Reason |
|---------|---------|--------|--------|
| `React.memo(Component)` | `ItemCard.tsx` | RESEARCH.md Pattern 3 (lines 231-238) | First memoized component in the app — no prior usage |
| `import.meta.env.MODE !== "production"` dev-only counter | `ItemCard.tsx` | RESEARCH.md Pattern 3 (lines 227-236) | No dev-flagged instrumentation exists yet |
| Multi-chunk base64 encoder loop | `gemini.ts` | RESEARCH.md Pattern 1 (lines 167-176) | Current encoder is per-byte; chunked form is new (but byte-identical output) |

## Metadata

**Analog search scope:** `src/components/`, `src/services/`, `src/tests/`, `src/db/`, `src/hooks/`
**Files scanned/read:** `ItemCard.tsx`, `ItemList.tsx`, `gemini.ts` (encoder + pipeline head), `geminiContinuous.ts` (import line), `item-card-audio-status.test.tsx`, `gemini-pipeline.test.ts` (blobToBase64 block); grep sweep for `React.memo` / dev-flags
**Pattern extraction date:** 2026-06-01
