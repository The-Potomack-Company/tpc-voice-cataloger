# Phase 35: ai-correctness-track-2 - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 9 (4 modified, 1 new store-migration, 4 new tests)
**Analogs found:** 9 / 9 (every change has an in-repo twin)

> Every fix in this phase mirrors existing code. There is no new pattern to invent — the work is placement and wiring. Line numbers below are re-verified against the live source (RESEARCH corrected CONTEXT's stale numbers; both are reconciled here).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/gemini.ts` (MODIFY) | service | request-response + transform | self (existing pipeline) | self / in-place |
| `src/services/geminiContinuous.ts` (MODIFY) | service | streaming/chunked request-response | `src/services/gemini.ts:267` generationConfig | exact (sibling path) |
| `src/db/items.ts` (MODIFY) | data-access wrapper | CRUD (write) | self `updateItemField:13` | self / in-place |
| `src/db/index.ts` (MODIFY) | config (Dexie schema) | migration | `db.version(10)` chain `:135` | exact (same file, prior version bumps) |
| `src/components/ItemCard.tsx` (MODIFY) | component | request-response (presentational) | `AiFailureBanner` `ItemEntry.tsx:33` | exact (component to mirror) |
| `src/tests/gemini-determinism.test.ts` (NEW) | test | unit | `src/tests/gemini-pipeline.test.ts` | exact |
| `src/tests/gemini-confab-guard.test.ts` (NEW) | test | unit | `src/tests/gemini-pipeline.test.ts` | exact |
| `src/tests/gemini-no-clobber.test.ts` (NEW) | test | unit | `src/tests/gemini-pipeline.test.ts` | exact |
| `src/tests/item-card-ai-failure.test.tsx` (NEW) | test | component (jsdom) | `src/tests/item-card-audio-status.test.tsx` | exact |

**Optional new file (Discretion / D-07):** `src/components/AiFailureBanner.tsx` — RESEARCH Pattern 3 recommends lifting the local `AiFailureBanner` out of `ItemEntry.tsx` into a shared component consumed by both `ItemEntry` and `ItemCard`. Classified as **component / presentational**, analog = the existing inline function. Planner decides lift-vs-duplicate.

---

## Pattern Assignments

### `src/services/gemini.ts` (service, request-response + transform)

**Analog:** self. Three insertions, all in `processAudioWithAi`. The surrounding shape is the pattern to preserve.

**D-01 — temperature in `generationConfig`** (current object, lines 267-277):
```ts
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: (() => {
    const raw = catalogFieldsJsonSchema as Record<string, unknown>;
    const clean = Object.fromEntries(
      Object.entries(raw).filter(([k]) => k !== '$schema' && k !== 'additionalProperties'),
    );
    return clean;
  })(),
},
```
Add `temperature: 0,` as the first key. One-line change. (CONTEXT cites `:249`; verified live = `:267`.)

**D-03 — confab guard insertion point** (between line 319 and 321):
```ts
const fields = result.data;          // <-- line 319 (existing)

// D-03: insert confab guard HERE, before the applySpokenQuotes loop and before
// any supabaseUpdate is built. Nothing touches the DB between parse and guard.

// Safety net: ensure spoken quote markers are converted...   // <-- line 321 (existing)
```
The guard reuses the existing terminal-failure machinery. RESEARCH recommends a tagged error so the existing catch maps it to `failed`:

**Existing catch / failure-status write to reuse** (lines 385-405):
```ts
} catch (error) {
  console.error("AI processing error:", error);
  trackEvent({ event_type: "ai.processing_failed", /* ... */ });
  try {
    const update = isTransientNetworkError(error)
      ? { ai_status: "queued" }
      : { ai_status: "failed" };          // <-- confab error must land here
    await supabase.from("items").update(update).eq("id", itemId);
    useSessionStore.getState().fetchItems(sessionId).catch(() => {});
  } catch (dbError) { /* ... */ }
}
```

**`isTransientNetworkError`** (lines 164-169) — the guard error must map to NON-transient (`failed`, not `queued`). Per RESEARCH O-2, branch on error *type*, not message, to be safe:
```ts
function isTransientNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && /abort|Load failed|Failed to fetch|NetworkError/i.test(error.message)) return true;
  return false;
}
```
Recommended: add `if (error instanceof ConfabRejectedError) { ... ai_status: "failed" ... }` explicitly ahead of the transient check (RESEARCH O-2), so wording of the message can never accidentally match the regex.

**D-05/D-06 — no-clobber skip filter** in the write-back block (lines 333-371). The established pattern is **conditional-on-non-null then unconditional `.update().eq("id")`**:
```ts
const supabaseUpdate: Record<string, unknown> = {
  ai_status: "done",
  completed_at: new Date().toISOString(),
};
if (fields.title !== null) {
  supabaseUpdate.title = toAllCaps(fields.title);
}
if (fields.description !== null) {
  supabaseUpdate.description = fields.description;
}
// ... condition, estimate, category, measurements, transcript, receipt_number
await supabase.from("items").update(supabaseUpdate).eq("id", itemId);
```
D-05 inserts a `flagged` Set read before this block and adds `&& !flagged.has("<field>")` to **each** of the 8 field conditionals (`title, description, condition, estimate, category, measurements, transcript, receipt_number`). Note `receipt_number` uses `!= null` (line 364), the rest use `!== null`.

**`hasExistingData` — the fresh-vs-retry signal** (line 240):
```ts
const hasExistingData = Object.values(currentItem).some(v => v !== null);
```
D-05 clear-on-success keys on this (`if (!hasExistingData) await db.userEditedFields.where("itemId").equals(itemId).delete();`). RESEARCH O-1 flags `hasExistingData` as a proxy, not a perfect oracle — planner should decide whether to add an explicit `isRetry` param instead.

---

### `src/services/geminiContinuous.ts` (service, chunked request-response)

**Analog:** `gemini.ts:267`. D-01 ONLY (per D-03 scope note + RESEARCH Pitfall 5 — confab guard is single-shot-only).

**generationConfig** (lines 165-168):
```ts
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: responseSchemaForGemini(),
},
```
Add `temperature: 0,` as first key. (CONTEXT cites `:160`; verified live = `:165`.) Do NOT add the confab guard here.

---

### `src/db/items.ts` (data-access wrapper, CRUD write)

**Analog:** self. `updateItemField` (lines 13-22) is the user-edit choke point. AI-internal merges call the *store action* (`sessionStore.updateItemField`) directly, NOT this wrapper — so flagging here cleanly excludes AI writes (RESEARCH Pitfall 3 / Assumption A2).

**Current wrapper** (lines 13-22):
```ts
export async function updateItemField(
  id: string,
  sessionId: string,
  field: string,
  value: string | null,
): Promise<void> {
  await useSessionStore.getState().updateItemField(id, sessionId, field, value);
}
```
D-05 appends one line after the store call: `await db.userEditedFields.put({ itemId: id, field });`. Requires importing `db`. **Planner must grep-verify every UI edit site routes through this wrapper** (`ItemCard.tsx:71`, `ItemEntry.tsx:20` import it — confirm no component calls `sessionStore.updateItemField` directly).

---

### `src/db/index.ts` (config, Dexie v11 migration)

**Analog:** the `db.version(N).stores({...})` chain, specifically v10 (lines 135-147) and v7 (`:96`, the last version that *added a new table*). New-table version bumps in this file carry the full store map forward unchanged and add the new line; only versions that reshape existing data use `.upgrade()` (see v2 `:46`).

**v10 (the immediate predecessor — copy forward verbatim, add one line):**
```ts
db.version(10).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
  sessionAudio: "sessionId, updatedAt",
  exportHistory: "++id, sessionId, exportedAt",
  idMapping: "++id, oldId, newId, type, [newId+type]",
  writeAheadQueue: "++id, createdAt",
  photoUploadQueue: "++id, status, dexiePhotoId, itemId, createdAt",
  audioUploadQueue: "++id, status, dexieAudioId, itemId, createdAt",
});
```

**v11 to add** (RESEARCH Standard Stack — compound primary key + `itemId` secondary index, no `.upgrade()`):
```ts
db.version(11).stores({
  // ...all v10 stores repeated unchanged...
  userEditedFields: "[itemId+field], itemId",
});
```

**Typed table handle** — the `db` cast block (lines 16-28) must gain the new table. Follow the existing `EntityTable` convention. Compound-key tables have no single primary-key field, so use `EntityTable<UserEditedField, "itemId">` (or planner's chosen primary), mirroring `sessionAudio: EntityTable<SessionAudio, "sessionId">` at line 22:
```ts
sessionAudio: EntityTable<SessionAudio, "sessionId">;
// add:
userEditedFields: EntityTable<UserEditedField, "itemId">;
```

**Type definition** — add to `src/db/types.ts` following the existing interface convention (e.g. `ItemAudio` at line 65). `itemId` is the **Supabase UUID string** (RESEARCH Pitfall 1 — NOT the integer Dexie id):
```ts
export interface UserEditedField {
  itemId: string;   // Supabase UUID, the value updateItemField/processAudioWithAi pass
  field: string;
}
```

---

### `src/components/ItemCard.tsx` (component, presentational)

**Analog:** `AiFailureBanner` (`ItemEntry.tsx:33-88`). Mirror its markup + retry wiring; render on the card when `isFailed`.

**Existing card state + retry handler already present** (lines 51-68) — reuse, don't rebuild (D-08):
```ts
const [retrying, setRetrying] = useState(false);
const isFailed = item.ai_status === "failed";

const handleRetryAi = () => {
  if (!latestAudioId || retrying) return;
  setRetrying(true);
  processAudioWithAi(latestAudioId, item.id, sessionId)
    .then(() => setRetrying(false))
    .catch((err) => { console.error("AI retry failed:", err); setRetrying(false); });
};
```

**Current terse badge to PROMOTE** (line 199):
```ts
{isFailed && <Badge tone="err">Failed</Badge>}
```
(CONTEXT cites `:185`, RESEARCH `:199`; verified live = `:199`.) D-07 replaces/augments this with a full-width inline row gated on `isFailed`.

**Markup to mirror — the detail banner** (`ItemEntry.tsx:64-87`):
```tsx
<div
  role="alert"
  className="flex items-center justify-between gap-3 rounded-lg border border-err bg-err-wash px-3 py-2 text-sm"
  style={{ color: "var(--err)" }}
>
  <div className="flex items-center gap-2 min-w-0">
    <span className="tpc-status-dot tpc-status-dot-err" aria-hidden />
    <span className="font-medium truncate">AI processing failed</span>
  </div>
  <button
    type="button"
    onClick={handleRetry}
    disabled={retrying}
    className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-err px-2.5 py-1 text-xs font-semibold hover:opacity-80 disabled:opacity-50 transition-opacity"
    style={{ color: "var(--err)" }}
  >
    <svg className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} /* retry icon */ />
    {retrying ? "Retrying" : "Retry"}
  </button>
</div>
```
**Card wiring difference:** the banner derives `latestAudioId` via its own `useLiveQuery`; `ItemCard` already receives `latestAudioId` as a prop (`:23`) and has `handleRetryAi`. If lifting to a shared component (`AiFailureBanner.tsx`), accept `latestAudioId` as a prop and pass each caller's own source. Same null-guard: `if (latestAudioId == null) return null;` (banner line 52).

---

### `src/tests/gemini-determinism.test.ts` / `gemini-confab-guard.test.ts` / `gemini-no-clobber.test.ts` (NEW, unit)

**Analog:** `src/tests/gemini-pipeline.test.ts` — copy its harness verbatim. Dexie (`db.audio`, and now `db.userEditedFields`) is real via fake-indexeddb; assert on it directly.

**Hoisted Supabase mock + dynamic import + env stub** (lines 1-58):
```ts
const { mockFrom, mockUpdate, mockEq, mockSelect, mockSingle, mockGetSession, mockRefreshSession }
  = vi.hoisted(() => ({ /* all vi.fn() */ }));
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: mockGetSession, refreshSession: mockRefreshSession }, from: mockFrom },
}));
vi.mock("../stores/sessionStore", () => ({
  useSessionStore: { getState: () => ({ fetchItems: vi.fn().mockResolvedValue(undefined) }) },
}));
let processAudioWithAi: typeof import("../services/gemini").processAudioWithAi;
vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://test-proxy.example.com/api");

function mockGeminiResponse(fields: Record<string, unknown>) {
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(fields) }] } }] }) };
}
```

**`createMockFrom` helper — captures every `.update()` payload** (lines 146-169). This is how all three tests assert on what was written:
```ts
const nullItem = { title: null, description: null, condition: null,
  estimate: null, category: null, measurements: null, transcript: null };

function createMockFrom(options: { updateCalls?: Array<Record<string, unknown>>; existingItem?: Record<string, unknown> | null; }) {
  const { updateCalls = [], existingItem = null } = options;
  return () => ({
    update: (data: Record<string, unknown>) => { updateCalls.push(data); return { eq: vi.fn().mockResolvedValue({ error: null }) }; },
    select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: existingItem, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: existingItem, error: null }) }) }),
  });
}
```

**beforeEach audio seed + session mock** (lines 63-103) — copy as-is. Seed `db.audio.add({...})` returns the `testAudioId`. Call shape: `await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");` (lines 188+).

Per-test assertion patterns to extend (from RESEARCH §Dimension detail):
- **Determinism (SC-1):** spy `globalThis.fetch`, parse the request `body`, assert `JSON.parse(body).payload.generationConfig.temperature === 0`; run twice, assert identical `updateCalls` snapshot. The existing success test (lines 194-224) shows the `updateCalls[last]` assertion shape (`.title === "OAK TABLE"`, `.category === "FRN"` — note transforms applied).
- **Confab (SC-2):** `mockGeminiResponse({ transcript: null, title: "Oak table", estimate: "300" })`; assert the only `updateCalls` entries are `{ai_status:"processing"}` then `{ai_status:"failed"}`, and NO entry has a `title`/`estimate` key. Repeat with `transcript: "   "`.
- **No-clobber (SC-3):** seed `await db.userEditedFields.put({ itemId: "item-uuid-1", field: "title" })`; use `createMockFrom({ existingItem: {...non-null...} })` so `hasExistingData` is true; mock a response with new title + new description; assert last `updateCalls` has no `title` key but has `description`. Second case: `!hasExistingData` run → `db.userEditedFields.where("itemId").equals("item-uuid-1").toArray()` is empty after.

The first-update assertion `expect(updateCalls[0]).toEqual({ ai_status: "processing" })` (line 191) confirms the pipeline always writes `processing` first — both confab and no-clobber tests must account for that leading write.

---

### `src/tests/item-card-ai-failure.test.tsx` (NEW, component/jsdom)

**Analog:** `src/tests/item-card-audio-status.test.tsx` — copy structure verbatim.

**Mock block + render helper** (lines 5-83):
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ItemCard } from "../components/ItemCard";

vi.mock("../services/gemini", () => ({ processAudioWithAi: vi.fn() }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: (fn: () => unknown) => { try { return fn(); } catch { return undefined; } } }));
vi.mock("../db/items", () => ({ updateItemField: vi.fn(), deleteItem: vi.fn() }));
// + useAudioUploadStatus, audioLookup, idMapping, db mocks as in analog

function makeItem(overrides = {}) {
  return { id: "item-uuid-1", session_id: "session-uuid-1", ai_status: "done",
    title: "TEST ITEM", sort_order: 0, created_at: "2026-01-01T00:00:00Z", ...overrides };
}
function renderCard(item = makeItem()) {
  return render(<MemoryRouter><ItemCard item={item as never} sessionId="session-uuid-1"
    isExpanded={false} onToggle={() => {}} audioCount={1} latestAudioId={10}
    photoCount={0} dexieItemId={10} isPending={false} /></MemoryRouter>);
}
```

**Assertion pattern** (mirror lines 90-115) — render with `ai_status: "failed"`, assert the alert row + retry, and absence on other statuses:
```tsx
it("renders the inline AI-failure row when ai_status is failed", () => {
  renderCard(makeItem({ ai_status: "failed" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/AI processing failed/i);
  // assert a Retry control present; mock processAudioWithAi was used in analog via fireEvent.click
});
it("does not render the failure row when ai_status is done", () => {
  renderCard(makeItem({ ai_status: "done" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
```
Note the analog's `useAudioUploadStatus` mock returns a pill status; this test will want `mockUseAudioUploadStatus.mockReturnValue("none")` to avoid the upload pill confusing the `alert` query.

---

## Shared Patterns

### Conditional-then-unconditional Supabase write
**Source:** `src/services/gemini.ts:333-371`
**Apply to:** the no-clobber filter (D-05). Build a plain `Record<string, unknown>`, append fields under `if (x !== null)` guards, then a single `.update(obj).eq("id", itemId)`. D-05 adds `&& !flagged.has("field")` to each guard. Don't restructure into per-field `.update()` calls.

### Terminal-failure status write via catch
**Source:** `src/services/gemini.ts:385-405` + `isTransientNetworkError:164`
**Apply to:** confab guard (D-03). Reuse this single failure-write site by throwing a typed error; do NOT add a second `{ ai_status: "failed" }` write. Maps to `failed` (non-transient) which also fires the `ai.processing_failed` analytics event for free.

### Dexie version-bump (new table, no upgrade)
**Source:** `src/db/index.ts:96` (v7) and `:135` (v10); contrast `:38` (v2 with `.upgrade()`)
**Apply to:** v11 `userEditedFields`. Repeat all prior stores unchanged, add the new line, no `.upgrade()`. Add the typed handle to the `db` cast (line 16-28) and an interface to `src/db/types.ts`.

### `err` token palette for failure UI
**Source:** `src/pages/ItemEntry.tsx:64-87` (`border-err`, `bg-err-wash`, `tpc-status-dot-err`, `style={{ color: "var(--err)" }}`)
**Apply to:** the ItemCard failure row (D-07). Match this palette exactly per CONTEXT Discretion note. The terse badge already uses `<Badge tone="err">` (`ItemCard.tsx:199`) — same tone family.

### Vitest harness: hoisted Supabase mock + dynamic gemini import
**Source:** `src/tests/gemini-pipeline.test.ts:1-103, 146-169`
**Apply to:** all three new `gemini-*.test.ts`. The `vi.hoisted` mock block, `mockGeminiResponse`, `createMockFrom` (captures `updateCalls`), and the `beforeEach` audio-seed are the reusable kit. Dexie is real in this suite.

### Vitest harness: ItemCard component render
**Source:** `src/tests/item-card-audio-status.test.tsx:5-83`
**Apply to:** `item-card-ai-failure.test.tsx`. The `vi.mock` set (gemini, dexie-react-hooks, db/items, audioLookup, idMapping, useAudioUploadStatus), `makeItem` factory, and `renderCard` wrapper transfer directly.

---

## No Analog Found

None. Every file in scope has an exact or in-place analog. The only genuinely new artifact is the `userEditedFields` Dexie table, and even its *shape* and *migration mechanics* follow the established v7/v10 new-table pattern in the same file.

---

## Metadata

**Analog search scope:** `src/services/`, `src/db/`, `src/components/`, `src/pages/`, `src/tests/`
**Files scanned:** gemini.ts, geminiContinuous.ts, db/items.ts, db/index.ts, db/types.ts, ItemCard.tsx, ItemEntry.tsx, gemini-pipeline.test.ts, item-card-audio-status.test.tsx
**Line-number reconciliation:** CONTEXT cited pre-edit numbers (`:249`, `:160`, `:185`); RESEARCH corrected to live (`:267`, `:165`, `:199`); all verified against current source this session.
**Pattern extraction date:** 2026-06-01
