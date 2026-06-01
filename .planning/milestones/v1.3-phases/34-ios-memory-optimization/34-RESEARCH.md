# Phase 34: ios-memory-optimization - Research

**Researched:** 2026-06-01
**Domain:** Browser memory footprint reduction — base64 audio encoding + React/Dexie re-render fan-out
**Confidence:** HIGH (all targets are in-repo code with existing tests and verified shapes; no new deps)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (PERF-1):** Fix in-place with a **chunked base64 encode**. Replace the per-byte `String.fromCharCode` accumulation loop in `src/services/gemini.ts:135` (`blobToBase64`) with a fixed-chunk encoder (~32 KB windows: `btoa(String.fromCharCode(...chunk))` concatenated), eliminating the multi-MB intermediate binary string.
- **D-02:** Drop the `freshBlob = new Blob([blob], …)` re-wrap copy unless a test proves the structured-clone edge case still bites — it adds a full copy on the hot path. If kept, document why with a WHY-comment.
- **D-03:** **Do NOT** move to out-of-band Gemini Files API upload this phase. That structural fix lands in **Phase 40** alongside the Cloud Run proxy migration (D-056). Captured as deferred.
- **D-03 cont.:** Same fix applies to the duplicate `blobToBase64` in `src/services/geminiContinuous.ts` — route both through **one** chunked encoder (shared helper preferred over two copies) so the fix isn't lost when continuous is re-enabled.
- **D-04 (PERF-2):** **Defer.** Continuous mode is disabled (D-050); no master-blob rework this phase. Leave a tracked TODO/deferred note. The chunked-encode fix from D-03 still flows through the continuous path via the shared helper.
- **D-05 (PERF-3):** Introduce a **session-level provider** mounted in `ItemList` scope that runs **one** aggregate `useLiveQuery` over the session's items and returns a per-item meta map keyed by item id: `{ audioCount, latestAudioId, photoCount, dexieItemId, isPending }`. Collapses 4 subscriptions/effects × N cards into one subscription.
- **D-06:** `ItemList` reads each item's slice from the provider and **passes it as a prop** to `ItemCard`. `ItemCard` becomes prop-driven/"dumb" for these values — no live queries or async effects of its own for audio/photo/pending/dexieId. Keep local UI state (delete-confirm, retrying) in the card.
- **D-07:** Provider must handle house-mode-only photo counts (skip photo count for non-house mode) and the `getDexieItemId` mapping in the aggregate.
- **D-08 (verification):** **Render-count is the CI-testable win.** Add a dev-only render counter to `ItemCard` (guarded by a dev flag, no-op in prod) + a Vitest component test asserting an `ai_status`/recording-state change on one item does **not** re-render the other N-1 cards.
- **D-09 (verification):** **Memory is a manual smoke**, not CI. `performance.measureUserAgentSpecificMemory()` is Chromium-only and requires cross-origin isolation (COOP/COEP) — will NOT run on iOS Safari. Document a two-part procedure: (a) desktop Chrome heap snapshot before/after a 5-min single-mode session showing bounded growth; (b) iOS Safari Web Inspector JS-heap timeline as the real-device check. Note the COOP/COEP caveat.

### Claude's Discretion
- Exact chunk size for the base64 encoder (32 KB starting point; tune if a test shows a better peak/throughput tradeoff).
- Provider shape (React context vs. lifted state passed through `ItemList`) — keep it minimal; contract is "one subscription, slice-as-prop".

### Deferred Ideas (OUT OF SCOPE)
- **Out-of-band Gemini Files API upload (PERF-1 structural fix)** — stream-upload blob, pass only a file URI inline. Belongs in **Phase 40** with the Cloud Run proxy migration (D-056).
- **Continuous-mode master-blob rework (PERF-2)** — stream-append / segment-and-discard. Pick up when continuous mode is re-enabled (D-050 rework).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-1 | `blobToBase64` holds multiple full copies of multi-MB audio | Chunked encoder pattern (§Code Examples), shared helper consumed by both gemini.ts:202 and geminiContinuous.ts:140. Existing `gemini-pipeline.test.ts:109` + `geminiContinuous.test.ts` lock the I/O contract. TDD-eligible. |
| PERF-2 | Continuous master blob grows unbounded | DEFERRED per D-04. Only action: continuous path consumes the shared chunked encoder (already imports `blobToBase64` from gemini.ts at `geminiContinuous.ts:11`). Leave deferred note. |
| PERF-3 | `ItemCard` runs 2 live Dexie subscriptions + 2 async effects per card × N | Aggregate-provider pattern (§Architecture Patterns); building blocks `audioRecordsForItem`, `getDexieItemId`, `hasPendingForItem` called once over the item set. Dev-only render counter + Vitest assertion (D-08). TDD-eligible. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No schema changes** this phase (guardrail + cross-app event rule). Confirmed — nothing here touches Supabase schema or `database.types.ts`.
- **No new npm deps** (bundle-size discipline carried from v1.2). All work uses existing `dexie`, `dexie-react-hooks`, `zustand`, React 19, `btoa`/`Uint8Array` builtins.
- **No auth work.** `processAudioWithAi` keeps its existing `ensureFreshSession()` call untouched.
- **WHY-comments only.** Any retained re-wrap copy (D-02) needs a WHY-comment; identifiers carry the WHAT.
- **Atomic commits.** PERF-1 (encoder), PERF-3 (provider hoist), and the render-counter test are separable concerns.

## Summary

Phase 34 is a pure optimization phase on two independent hot paths, both in-repo with verified code shapes and existing test coverage. **No new dependencies, no schema, no auth.** The work decomposes cleanly into two atomic tracks plus a CI test.

**PERF-1 (chunked base64):** `blobToBase64` (`src/services/gemini.ts:135`) currently does two memory-expensive things on multi-MB audio: (1) a `new Blob([blob], …)` re-wrap that forces a full copy, and (2) a per-byte `binary += String.fromCharCode(bytes[i])` accumulation that builds a string the size of the whole binary, which `btoa` then copies again — three+ full copies live simultaneously. The fix is a fixed-window encoder: iterate the `Uint8Array` in ~32 KB chunks, `btoa(String.fromCharCode(...chunk))` per chunk, concatenate the base64 fragments. The output base64 string is identical, so the existing equality test (`gemini-pipeline.test.ts:114`, `"hello world"` → `"aGVsbG8gd29ybGQ="`) stays green. `geminiContinuous.ts` already imports `blobToBase64` from `gemini.ts` (line 11), so making the single exported function chunked fixes both paths with zero duplication — D-03's "one encoder" is already structurally satisfied.

**PERF-3 (Dexie subscription hoist):** Each `ItemCard` runs 4 reactive surfaces per card: a `getDexieItemId` effect (`:39`), a `hasPendingForItem` effect (`:45`), an `audioRecordsForItem` `useLiveQuery` (`:49`), and a `photoCount` `useLiveQuery` (`:79`) — plus `useAudioUploadStatus` keyed off `latestAudioId`. With N items that's ~4N Dexie subscriptions all re-running whenever any audio/photo/queue row changes (during recording, every chunk write fires all of them). The fix is one session-scoped provider mounted in `ItemList` that runs a single aggregate computation over `items` returning a `Map<itemId, ItemMeta>`; `ItemList` looks up each slice and passes it as a prop. `ItemCard` becomes prop-driven for these five values, keeping only local UI state (`showDeleteConfirm`, `retrying`). `useAudioUploadStatus` stays per-card (it's keyed off the now-prop `latestAudioId` and is cheap), or can fold into the aggregate — recommend keeping it per-card to minimize churn (see Open Questions).

**Primary recommendation:** Two atomic commits — (1) chunked encoder in `gemini.ts` (drop the re-wrap, keep both existing base64 tests green); (2) `ItemList`-scoped aggregate provider returning `Map<itemId, ItemMeta>`, `ItemCard` refactored to prop-driven. Add a dev-only render counter + Vitest render-count assertion as the CI win. Memory is a manual two-part smoke (Chrome heap + iOS Web Inspector).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Base64 audio encode (`blobToBase64`) | Browser / Client | — | Runs in the PWA tab before fetch to proxy; pure client-side memory concern. Files-API offload to API tier is deferred (Phase 40). |
| Audio AI dispatch (`processAudioWithAi`) | Browser / Client → API (proxy) | — | Client builds payload, proxy forwards to Gemini. Unchanged this phase except encoder call. |
| Per-item meta aggregation (audio/photo/pending counts) | Browser / Client (Dexie + Zustand) | — | All sources are IndexedDB (Dexie) reads + write-ahead queue; no server round-trip. Belongs entirely in the client render layer. |
| Item list rendering | Browser / Client (React) | — | Pure presentation; the optimization is render-fan-out reduction, no tier crossing. |

## Standard Stack

No new packages. This phase uses only what is already installed and verified in `package.json`.

### Core (already installed — verified via package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dexie` | ^4.3.0 | IndexedDB wrapper backing audio/photos/queue tables | Already the app's offline store [VERIFIED: package.json] |
| `dexie-react-hooks` | ^4.2.0 | `useLiveQuery` reactive Dexie reads | Established pattern across the app [VERIFIED: package.json] |
| `zustand` | ^5.0.11 | `useSessionStore.itemsBySession` is the item source | Drives `useSessionItems` [VERIFIED: package.json, sessionStore.ts] |
| `react` / `react-dom` | ^19.2.0 | Component layer; React 19 memo/context | [VERIFIED: package.json] |
| `btoa` / `Uint8Array` | builtin | Chunked base64 encode | No dep needed [VERIFIED: gemini.ts:139-144] |

### Supporting (test-only — already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^4.0.18 | Test runner (`npm test` → `vitest --run`) | Render-count assertion (D-08), encoder I/O test [VERIFIED: package.json] |
| `@testing-library/react` | ^16.3.2 | `render`/`rerender`/`screen` harness | Render-count test reuses `item-card-audio-status.test.tsx` mock pattern [VERIFIED: package.json] |
| `fake-indexeddb` | ^6.2.5 | jsdom IndexedDB for Dexie under test | Auto-imported in `src/tests/setup.ts:2` [VERIFIED: setup.ts] |
| `jsdom` | ^28.1.0 | Test DOM environment | `vite.config.ts:63` `environment: "jsdom"` [VERIFIED: vite.config.ts] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chunked `btoa` loop | `FileReader.readAsDataURL` | Reads whole blob to a data-URL string (full base64 copy) then string-slice the prefix — no peak-memory win, and async-event API is clunkier. The chunked `btoa` keeps peak bounded to one 32 KB window + the growing output. |
| Chunked `btoa` loop | Gemini Files API (out-of-band upload) | The real OOM-proof fix, but touches the proxy contract — **deferred to Phase 40** (D-03/D-056). |
| React Context provider | Lifted state in `ItemList` passed as props | Both satisfy "one subscription, slice-as-prop" (D-05 discretion). Lifted state is simpler (no new context file, no extra provider node) and `ItemList` already owns `items`. **Recommend lifted state** — compute the `Map` in `ItemList` via one `useLiveQuery`/effect, pass slices down. Context only earns its keep if a non-`ItemList` descendant also needs the map (none does today). |

**Installation:** None. `npm install` not run this phase (guardrail). All builds use existing `node_modules`.

## Package Legitimacy Audit

Not applicable — this phase installs **zero** external packages (explicit guardrail: "no new npm deps"). All code uses already-installed, already-audited dependencies and browser builtins. No slopcheck run required.

## Architecture Patterns

### System Architecture Diagram

```
PERF-1 — audio encode path (gemini.ts + geminiContinuous.ts)
─────────────────────────────────────────────────────────────
 recording stops / continuous chunk
        │
        ▼
 resolveAudioForAi({itemId,dexieAudioId})  ──► Blob (multi-MB)
        │
        ▼
 blobToBase64(blob)   ◄── SHARED, single export from gemini.ts
        │                 geminiContinuous.ts imports it (line 11)
        │
        │  BEFORE: new Blob([blob]) copy → arrayBuffer → per-byte
        │          binary string (full copy) → btoa (full copy)
        │          = 3+ live full copies  ✗ OOM
        │
        │  AFTER:  arrayBuffer → Uint8Array → for each 32KB window:
        │          btoa(String.fromCharCode(...window)) → push fragment
        │          → fragments.join("")
        │          = peak ≈ 1 window + growing output  ✓
        ▼
 base64Audio ──► inlineData.data in Gemini payload ──► fetch(proxyUrl)


PERF-3 — item meta path (ItemList → ItemCard)
─────────────────────────────────────────────────────────────
 useSessionItems(sessionId)  (Zustand: itemsBySession[sessionId])
        │  items: SupabaseItem[]
        ▼
 ItemList
   │
   │  BEFORE: renders N × ItemCard; EACH card runs:
   │    - getDexieItemId effect      ┐
   │    - hasPendingForItem effect   │  4N Dexie subscriptions/effects
   │    - audioRecordsForItem live   │  all re-fire on any audio/photo/
   │    - photoCount live            ┘  queue write (recording = storm)
   │
   │  AFTER: ONE aggregate over `items`:
   │    sessionItemMeta = useLiveQuery(async () => {
   │       for each item: audioRecordsForItem, getDexieItemId,
   │       photos.count (house only), hasPendingForItem
   │       → Map<itemId, ItemMeta>
   │    }, [items], emptyMap)
   ▼
 ItemList passes meta={metaMap.get(item.id)} as prop
        │
        ▼
 ItemCard (prop-driven: audioCount, latestAudioId, photoCount,
           dexieItemId, isPending arrive as props;
           only local UI state remains: showDeleteConfirm, retrying)
```

### Pattern 1: Fixed-window chunked base64 encoder
**What:** Encode a `Uint8Array` to base64 in fixed-size windows, concatenating per-window `btoa` output, instead of building one giant binary string.
**When to use:** Any time a multi-MB binary must become base64 in-browser without a structural offload.
**Example:**
```typescript
// Source: pattern derived from gemini.ts:135-145 current shape + standard chunked-btoa idiom.
// Verified contract: same output as current loop (gemini-pipeline.test.ts:114).
const CHUNK_SIZE = 0x8000; // 32 KB — discretion D; tune via peak/throughput test

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    // subarray = view (no copy); spread into fromCharCode bounded to one window
    result += btoa(String.fromCharCode(...chunk));
  }
  return result;
}
```
**WHY base64 stays byte-identical:** base64 encodes in 3-byte groups → 4 chars. As long as each chunk boundary is a multiple of 3 bytes, per-chunk `btoa` concatenation equals whole-buffer `btoa`. `0x8000` (32768) is divisible by 3? No — 32768 / 3 is not integer. **Pitfall: chunk size MUST be a multiple of 3** or the concatenated output gets stray padding mid-string. Use `CHUNK_SIZE = 0x8000` only if you encode the whole buffer's byte length per chunk aligned to 3, or pick a multiple of 3 (e.g. `32766` or `0x8000 - 2 = 32766`). See Pitfall 1 — this is the one real correctness trap.

**D-02 (re-wrap drop):** The current `new Blob([blob], {type})` re-wrap (`gemini.ts:137`) exists "to handle structured clone edge cases." `blob.arrayBuffer()` works on any `Blob`/`File` regardless of origin; the re-wrap forces a full copy purely defensively. The existing tests pass a plain `new Blob([...])` so they won't exercise the edge case either way. **Recommend: drop the re-wrap.** If a test (or smoke) surfaces a real structured-clone failure, restore it with a WHY-comment naming the exact failing case.

### Pattern 2: Aggregate session-meta via single useLiveQuery in ItemList
**What:** One `useLiveQuery` keyed on `items` computes `Map<itemId, ItemMeta>` by calling the existing per-item helpers once each in a loop; `ItemList` threads slices to cards as props.
**When to use:** When N children each subscribe to the same store/DB for per-row derived data.
**Example:**
```typescript
// Source: composition of existing helpers (audioLookup.ts, idMapping.ts,
// useWriteAheadQueue.ts) inside one useLiveQuery, mirroring ItemCard.tsx:49 default-value pattern.
interface ItemMeta {
  audioCount: number;
  latestAudioId: number | null;
  photoCount: number;
  dexieItemId: number | string | null;
  isPending: boolean;
}

const EMPTY_META = new Map<string, ItemMeta>();

const itemMeta = useLiveQuery(
  async () => {
    const map = new Map<string, ItemMeta>();
    for (const item of items) {
      const audios = await audioRecordsForItem(item.id);
      const audioCount = audios.length;
      const latestAudioId = audioCount > 0
        ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)
        : null;
      const dexieItemId = (await getDexieItemId(item.id)) ?? item.id;
      const photoCount = item.mode === "house" && dexieItemId != null
        ? await db.photos.where("itemId").equals(dexieItemId).count()
        : 0;
      const isPending = await hasPendingForItem(item.id);
      map.set(item.id, { audioCount, latestAudioId, photoCount, dexieItemId, isPending });
    }
    return map;
  },
  [items],
  EMPTY_META,
);
```
**Note on Dexie reactivity:** `useLiveQuery` tracks the Dexie tables *read inside the callback* and re-emits on writes to them. Because all four helpers ultimately read `db.audio` / `db.photos` / `db.writeAheadQueue` inside this one callback, the single subscription stays reactive to the same writes that previously drove 4N subscriptions — but now re-computes once and React diffs the `Map`. Keep the `[items]` dep + a stable `EMPTY_META` default (module-level constant) so the empty-state reference is stable and doesn't churn.

### Pattern 3: Dev-only render counter (D-08)
**What:** A render counter that increments on every `ItemCard` render, exposed to tests, no-op in prod.
**When to use:** To assert render-fan-out is eliminated.
**Example:**
```typescript
// dev/test only; tree-shaken / no-op in prod via import.meta.env guard
export const __itemCardRenderCounts = new Map<string, number>(); // test-visible

function ItemCardImpl(props: ItemCardProps) {
  if (import.meta.env.MODE !== "production") {
    __itemCardRenderCounts.set(props.item.id, (__itemCardRenderCounts.get(props.item.id) ?? 0) + 1);
  }
  // ...
}
export const ItemCard = React.memo(ItemCardImpl); // memo so prop-equal cards skip re-render
```
**Critical:** `React.memo` on `ItemCard` is what actually *delivers* the fan-out reduction — without it, a parent (`ItemList`) re-render still re-renders every card even with stable props. The aggregate `Map` change will re-render `ItemList`; `memo` + stable per-item prop slices ensure only the changed card re-renders. Default shallow `memo` comparison works if the `meta` slice object is referentially stable for unchanged items. Since the aggregate rebuilds the whole `Map` on any write, **wrap slice objects so unchanged items keep their reference** (e.g. memoize per-item meta, or pass primitive props instead of a meta object). Passing primitives (audioCount, latestAudioId, photoCount, dexieItemId, isPending as separate props) sidesteps object-identity churn entirely — **recommend primitive props over a meta object** for clean `memo` behavior.

### Anti-Patterns to Avoid
- **Chunk size not a multiple of 3:** corrupts concatenated base64. Use a 3-aligned window.
- **Passing a fresh `meta` object per render without memo-stable identity:** defeats `React.memo`; the storm returns. Pass primitives or memoize slices.
- **Keeping any `useLiveQuery`/async effect in `ItemCard` for audio/photo/pending/dexieId:** violates D-06; the card must be prop-driven for these.
- **New context provider when lifted state suffices:** adds a node + file for no consumer outside `ItemList`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio→item lookup with UUID/legacy-int duality | A new query | `audioRecordsForItem` (`db/audioLookup.ts`) | Already handles DAT-7 dual-id union + cross-device Supabase fallback. Reuse in the aggregate. |
| UUID→legacy Dexie id | Inline `idMapping` query | `getDexieItemId` (`db/idMapping.ts`) | Established mapping helper. |
| "Has pending write" check | New queue scan | `hasPendingForItem` (`useWriteAheadQueue.ts:155`) | Existing payload-id filter idiom. |
| Reactive Dexie read default value | Manual undefined guard | `useLiveQuery(fn, deps, defaultValue)` | App-wide pattern (ItemCard.tsx:49, useAudioUploadStatus.ts:14) — avoids undefined flicker. |
| Memo comparison for cards | Custom diff | `React.memo` (default shallow) + primitive props | Built-in; primitives make shallow compare correct. |

**Key insight:** Every input the aggregate provider needs already exists as a tested helper. PERF-3 is a *composition + hoist*, not new logic — the risk is purely in reactivity/identity wiring, not in the data layer.

## Runtime State Inventory

Not a rename/refactor/migration phase — this is a behavior-preserving optimization. No stored data, service config, OS-registered state, secrets, or build artifacts change.
- **Stored data:** None — Dexie/Supabase rows untouched; no schema change.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None — `VITE_GEMINI_PROXY_URL` read unchanged.
- **Build artifacts:** None beyond normal `vite build`.

## Common Pitfalls

### Pitfall 1: Base64 chunk size not divisible by 3
**What goes wrong:** Concatenated per-chunk `btoa` produces `=` padding mid-string and a base64 string that decodes wrong → Gemini gets corrupt audio.
**Why it happens:** base64 maps 3 input bytes → 4 chars. A chunk boundary mid-group injects padding.
**How to avoid:** Choose a window that is a multiple of 3 (e.g. `32766`, or any `3*k`). The existing `gemini-pipeline.test.ts:110` ("hello world" → exact base64) will catch a non-aligned size **only if** the test blob exceeds one chunk — it's 11 bytes, so it passes regardless. **Add a multi-chunk encoder test** (blob > 32 KB) comparing chunked output to a reference whole-buffer `btoa`, or the alignment bug ships silently.
**Warning signs:** Gemini transcription quality drops for longer recordings only; short clips fine.

### Pitfall 2: `React.memo` omitted → fan-out persists
**What goes wrong:** `ItemList` re-renders (aggregate Map changes) and re-renders all N cards anyway; render-count test fails or PERF-3 delivers nothing.
**Why it happens:** Props became stable but `ItemCard` is still a plain function component.
**How to avoid:** Wrap `ItemCard` in `React.memo` and pass referentially-stable (primitive) props per item.
**Warning signs:** Render-count test shows N renders on a single-item change.

### Pitfall 3: Aggregate re-computes O(N) on every keystroke/write
**What goes wrong:** One `useLiveQuery` that loops all items does N async Dexie reads per emit; during recording (frequent writes) this is heavier than before per-emit, even if it re-renders fewer cards.
**Why it happens:** Collapsing 4N subscriptions into 1 is a render win but the 1 does 4N reads each time it fires.
**How to avoid:** Acceptable for typical session sizes (tens of items). If profiling shows the loop is hot, debounce the aggregate or scope photo counts to house mode only (already required by D-07). Document the tradeoff; do not pre-optimize. The render-count win (D-08) is the measured target, not read count.
**Warning signs:** Recording-time jank that scales with item count even after the render fix.

### Pitfall 4: `latestAudioId` must still reach the retry handler
**What goes wrong:** `ItemCard.handleRetryAi` (`:68`) needs `latestAudioId` to call `processAudioWithAi`. If the hoist drops it, retry breaks.
**Why it happens:** It was a derived value from the now-removed per-card `useLiveQuery`.
**How to avoid:** `latestAudioId` is in the meta slice (D-05) — pass it as a prop and read it in the handler. Same for `dexieItemId` (photo count) and `isPending` (sync badge).
**Warning signs:** "No audio to retry" on items that clearly have audio.

### Pitfall 5: `useAudioUploadStatus` keying after the hoist
**What goes wrong:** This hook is keyed off `latestAudioId` and currently lives in the card (`:66`). After hoist, `latestAudioId` is a prop — the hook still works, but if you also try to hoist *it*, you'd need per-item upload status in the aggregate too.
**How to avoid:** **Keep `useAudioUploadStatus` per-card** — it's one cheap subscription on `audioUploadQueue` keyed by a single id, and keeping it avoids widening the aggregate. It does add back one subscription per card, but it's a single keyed `.first()` not a table scan, and it only re-fires on that one audio's status transition. (See Open Questions if you want it fully hoisted.)

## Code Examples

### Current `blobToBase64` (the target — gemini.ts:135-145)
```typescript
// Source: src/services/gemini.ts:135 (current)
export async function blobToBase64(blob: Blob): Promise<string> {
  const freshBlob = new Blob([blob], { type: blob.type }); // D-02: full copy — drop
  const buffer = await freshBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]); // builds full-size binary string
  }
  return btoa(binary); // btoa copies again
}
```

### Existing base64 contract test (must stay green)
```typescript
// Source: src/tests/gemini-pipeline.test.ts:109
describe("blobToBase64", () => {
  it("converts a Blob to a base64 string", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    expect(await blobToBase64(blob)).toBe("aGVsbG8gd29ybGQ=");
  });
});
```

### Render-count test harness (reuse item-card-audio-status.test.tsx mocks)
```typescript
// Source: composition of src/tests/item-card-audio-status.test.tsx mock pattern + RTL rerender.
// Mock dexie-react-hooks useLiveQuery to return controlled values (as that test does at line 36).
// Render ItemList with 3 items, capture __itemCardRenderCounts, flip one item's ai_status
// via rerender, assert only that item's count incremented.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-byte `String.fromCharCode` accumulation | Chunked `btoa` over `Uint8Array` windows | Long-standing browser idiom | Bounds peak memory to ~one window + output |
| `FileReader.readAsDataURL` for blob→b64 | `blob.arrayBuffer()` + chunked `btoa` | `arrayBuffer()` widely available | Avoids data-URL prefix handling + async event API |
| N children each `useLiveQuery` | One aggregate query + `React.memo` children | React perf norm | Eliminates O(N) subscription fan-out |

**Deprecated/outdated:** none relevant; all APIs in use (`btoa`, `arrayBuffer`, `useLiveQuery`, `React.memo`) are current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dropping the `new Blob([blob])` re-wrap (D-02) is safe — `arrayBuffer()` works on any Blob origin | Pattern 1 / Pitfall | LOW — existing tests pass plain Blobs; if a real structured-clone case exists it would surface in smoke. Mitigation: keep behind a test; restore with WHY-comment if it bites. |
| A2 | `React.memo` + primitive props is sufficient to stop fan-out (no deeper reconciler subtlety) | Pattern 2/3 | LOW — standard React behavior; verified by the D-08 render-count test itself. |
| A3 | Looping all items in one `useLiveQuery` (O(N) Dexie reads per emit) is acceptable at real session sizes | Pitfall 3 | MEDIUM — depends on max items per session; large house visits could make the per-emit loop hot. Mitigation: measure; debounce if needed. |
| A4 | Keeping `useAudioUploadStatus` per-card (not hoisted) is the right call | Pitfall 5 / Open Q | LOW — it's a single keyed read; hoisting is optional polish. |
| A5 | 32 KB starting chunk size, aligned to a multiple of 3, gives good peak/throughput | Pattern 1 | LOW — discretion D; tunable, output-correctness depends only on 3-alignment not size. |

## Open Questions

1. **Fully hoist `useAudioUploadStatus` into the aggregate, or keep per-card?**
   - What we know: It's keyed off `latestAudioId`, reads `db.audioUploadQueue.first()`, cheap.
   - What's unclear: Whether one-subscription-per-card here meaningfully contributes to the storm.
   - Recommendation: Keep per-card (Pitfall 5). It's a single keyed read, not a table scan; hoisting widens the aggregate for marginal gain. Revisit only if profiling shows it matters.

2. **Provider as React context vs. lifted state in `ItemList`?**
   - What we know: D-05 discretion allows either; only `ItemList`/`ItemCard` consume the map.
   - Recommendation: Lifted state in `ItemList` (compute Map via one `useLiveQuery`, pass primitive slices). No consumer outside `ItemList` justifies a context.

3. **Exact 3-aligned chunk size.**
   - Recommendation: Start at `32766` (`0x8000 - 2`, divisible by 3) or any `3*k` near 32 KB; only correctness constraint is 3-alignment. Tune via a peak/throughput micro-bench if desired (discretion).

## Environment Availability

Skipped — no external runtime dependencies. All work is in-repo TS/TSX using already-installed deps and browser builtins. Tests run under the existing `npm test` (Vitest + jsdom + fake-indexeddb).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (jsdom env) |
| Config file | `vite.config.ts` (`test:` block, line 61-68) |
| Quick run command | `npx vitest --run src/tests/gemini-pipeline.test.ts src/tests/item-card-render-count.test.tsx` |
| Full suite command | `npm test` (= `vitest --run`) |
| Setup file | `src/tests/setup.ts` (jest-dom + fake-indexeddb/auto + MediaRecorder mocks) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-1 | `blobToBase64("hello world")` → `aGVsbG8gd29ybGQ=` (output unchanged) | unit | `npx vitest --run src/tests/gemini-pipeline.test.ts -t blobToBase64` | ✅ (gemini-pipeline.test.ts:109) |
| PERF-1 | Multi-chunk blob (> chunk size) chunked output === reference whole-buffer btoa | unit | `npx vitest --run src/tests/gemini-pipeline.test.ts -t "multi-chunk"` | ❌ Wave 0 — add to guard 3-alignment (Pitfall 1) |
| PERF-1 | `processAudioWithAi` still sends `inlineData.data` base64 (pipeline intact) | integration | `npx vitest --run src/tests/gemini-pipeline.test.ts` | ✅ (gemini-pipeline.test.ts:268) |
| PERF-1 | Continuous path still encodes via shared helper | integration | `npx vitest --run src/tests/geminiContinuous.test.ts` | ✅ |
| PERF-3 | Single item `ai_status` change re-renders only that card (not N-1) | component | `npx vitest --run src/tests/item-card-render-count.test.tsx` | ❌ Wave 0 |
| PERF-3 | `ItemCard` is prop-driven (no audio/photo/pending live queries) | component | covered by render-count test + existing `item-card-audio-status.test.tsx` (props still wire the pill) | ⚠️ existing test passes `latestAudioId`-derived props — may need prop-signature update |
| PERF-2 | (deferred) — continuous unchanged except shared encoder | — | existing `geminiContinuous.test.ts` regression-only | ✅ |

### Sampling Rate
- **Per task commit:** quick run (the two target suites above).
- **Per wave merge:** `npm test` (full suite — watch the 18 known pre-existing `localStorage.clear` failures in `persist-scoping.test.ts`/`photo-migration.test.ts` per STATE.md; do not attribute to this phase).
- **Phase gate:** full suite green (minus the 18 known pre-existing) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/tests/item-card-render-count.test.tsx` — dev render counter + RTL rerender asserting one-item change doesn't re-render others (PERF-3, D-08). Mock pattern: copy `item-card-audio-status.test.tsx:29-53`.
- [ ] Multi-chunk encoder test in `gemini-pipeline.test.ts` (blob > chunk size) guarding 3-byte alignment (PERF-1, Pitfall 1).
- [ ] Confirm `item-card-audio-status.test.tsx` still passes after `ItemCard` prop-signature change (it renders `ItemCard` directly and mocks the helpers; new required meta props may need to be added to `renderCard`'s `<ItemCard ... />`).
- Framework install: none — Vitest/RTL/fake-indexeddb already present.

### TDD Eligibility (TDD mode is ON)
- **PERF-1 chunked encoder — TDD-eligible (RED-first).** Defined I/O: `(Blob) → base64 string`. Write the multi-chunk RED test first, then implement. Existing `:114` test is the baseline assertion.
- **PERF-3 render-count — TDD-eligible (RED-first).** Defined assertion: render count of N-1 cards unchanged after a one-item state flip. Write the RED test against the current N-render behavior, then hoist + memo to green.
- **PERF-2 — not applicable (deferred);** regression-only via existing `geminiContinuous.test.ts`.

### Manual Verification (D-09 — not CI)
- **Desktop Chrome heap snapshot:** record a heap snapshot, run a 5-minute single-mode recording/cataloging session, snapshot again; assert bounded growth (no monotonic multi-MB-per-recording climb from retained binary strings).
- **iOS Safari Web Inspector JS-heap timeline:** real-device check — record the JS-heap timeline during a session, confirm no runaway growth / no tab reload (OOM).
- **COOP/COEP caveat:** `performance.measureUserAgentSpecificMemory()` is Chromium-only and needs cross-origin isolation (COOP/COEP headers). The PWA is not cross-origin isolated, so this API is unavailable on-device — only the Web Inspector timeline applies on iOS. Capture this in the runbook.

## Security Domain

`security_enforcement` not found in config context for this phase; this is a memory/perf optimization with **no new data flows, no new inputs, no auth/crypto changes, no schema**. The existing `sanitizeForDataBlock`/DATA-vs-INSTRUCTIONS prompt-injection guards (gemini.ts:104, SEC-5) are untouched. No new ASVS categories become applicable. Threat surface unchanged:
- V5 Input Validation — unchanged (same Gemini payload, same Zod `catalogFieldsSchema` parse).
- V6 Cryptography — N/A (no crypto).
- The base64 output is byte-identical, so no change to what crosses the proxy boundary.

## Sources

### Primary (HIGH confidence)
- Codebase (verified by direct read): `src/services/gemini.ts`, `src/services/geminiContinuous.ts`, `src/components/ItemCard.tsx`, `src/components/ItemList.tsx`, `src/db/audioLookup.ts`, `src/db/idMapping.ts`, `src/hooks/useAudioUploadStatus.ts`, `src/hooks/useWriteAheadQueue.ts`, `src/hooks/useSessions.ts`, `src/tests/setup.ts`, `src/tests/item-card-audio-status.test.tsx`, `src/tests/gemini-pipeline.test.ts`, `vite.config.ts`, `package.json`.
- `34-CONTEXT.md` (locked decisions D-01..D-09).
- `.planning/STATE.md` (known pre-existing test failures; guardrails).

### Secondary (MEDIUM confidence)
- Chunked-`btoa` idiom and 3-byte-alignment requirement — standard browser base64 knowledge [ASSUMED]; verified against current `gemini.ts` output contract via the existing test.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all packages verified in package.json.
- Architecture: HIGH — both targets are in-repo with verified code shapes and existing helpers/tests.
- Pitfalls: HIGH for #1/#2/#4/#5 (mechanical/verified); MEDIUM for #3 (O(N)-per-emit depends on real session sizes).

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable — in-repo code, no fast-moving external deps)
