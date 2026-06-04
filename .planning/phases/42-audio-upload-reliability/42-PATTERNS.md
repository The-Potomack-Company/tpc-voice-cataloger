# Phase 42: audio-upload-reliability - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 8 in-scope (7 edits + 1 new test) + 4 analog/reference files
**Analogs found:** 8 / 8 (this phase is almost entirely edits to existing files — the "analog" for each edit is the file's own surrounding code plus the proven Phase-41 `offlineQueue` machinery)

> **Framing for the planner:** this is a *wire-the-missing-edges* phase, not a build-new-machinery phase. Every primitive (bounded retry, idempotent upsert, cross-device union query, Storage-by-`item_id` resolver, aggregate-meta prop threading) already exists. The patterns below are the *exact existing code each edit must respect or replicate* — copy the shape, don't invent a new one. RESEARCH.md (`42-RESEARCH.md`) already cites every `file:line`; this doc pins the concrete excerpts.

---

## Naming disambiguation (READ FIRST — the planner will trip on this)

There are **two** functions named `processAudioWithAi`. Do not conflate them.

| Symbol | File | Signature | Role |
|--------|------|-----------|------|
| `processAudioWithAi` (orchestrator) | `src/services/gemini.ts:202` | `(audioId: number, itemId: string, sessionId: string, isRetry?, alreadyClaimed?) => Promise<void>` | Claims the `items` row, resolves the blob, calls Gemini, writes result. **This is what RecordButton / ItemCard / AiFailureBanner / ItemList call.** |
| `processAudioWithAi` → imported as `resolveAudioForAi` | `src/services/processAudioWithAi.ts:21` | `({ itemId, dexieAudioId }) => Promise<{ blob; mimeType? }>` | Pure blob resolver: Dexie-first, then Storage-by-`item_id`. Called *inside* the orchestrator at `gemini.ts:242` as `resolveAudioForAi(...)`. |

RESEARCH.md's "Code Examples" block shows a 3-arg `processAudioWithAi(audioId, itemId, sessionId)` calling `resolveAudioForAi` — that's the orchestrator. The retry capability F2 needs **already exists in the orchestrator** (it takes `isRetry` and resolves by `item_id` regardless of the integer `audioId`). The F2 fix is about *gating* the banner and *plumbing* a valid `audioId`, not about the resolver.

---

## File Classification

| In-scope file | Role | Data Flow | Closest Analog / Pattern Source | Match Quality |
|---------------|------|-----------|----------------------------------|---------------|
| `src/services/audioUploadQueue.ts` | service (worker/queue) | batch + event-driven retry | self (`retryFailedUploads` :159, `drainAudioQueue` :136) + `offlineQueue.drainQueue` attempt-cap pattern | exact (extend in place) |
| `src/services/offlineQueue.ts` | service (worker/queue) | batch + request-response | self (`processItem` :100, `drainQueue` pending-reclaim :210-246) | exact (mirror the reclaim block) |
| `src/components/RecordButton.tsx` | component (handler) | event-driven (capture trigger) | self (`handleClick` :17-34) | exact (gate the AI fire) |
| `src/hooks/useAudioRecorder.ts` | hook | event-driven (capture → persist → enqueue) | self (`onstop` :189-255) | exact (the swallowed `.catch` :227) |
| `src/components/AiFailureBanner.tsx` | component (presentational + action) | request-response (retry) | self (:28-51) + `ItemCard.handleRetryAi` :61-70 | exact (re-gate on `hasServerAudio`) |
| `src/db/audioLookup.ts` | utility (data access) | CRUD read / union | self (`audioRecordsForItem` :14-66) | exact (reuse, do not edit unless adding a `hasServerAudio` helper) |
| `src/components/ItemList.tsx` + `src/pages/ItemEntry.tsx` | component (container) | aggregate subscription → prop thread | PERF-3 `itemMeta`/`ItemMeta` aggregate (`ItemList.tsx:23-72`) | exact (add `hasServerAudio` slice to the same map) |
| `src/tests/audio-cross-device-recovery.test.tsx` (NEW, Wave 0) | test | — | `item-card-ai-failure.test.tsx` (component) + `audio-storage-fallback.test.ts` (unit mock) | role-match (clone harness) |

---

## Shared Patterns (cross-cutting — apply to all relevant plans)

### SHARED-1: Bounded attempt cap, NEVER unbounded auto-retry
**Source:** `src/services/offlineQueue.ts:90-103` (the WHY comment) + `:160-184` (cap logic)
**Apply to:** any new `failed→pending` resweep in `audioUploadQueue.ts` (Plan 1).
The proven pattern reads a persisted attempt count and stops at a cap:
```ts
// offlineQueue.ts:160-167 — the cap that replaced the per-online retry storm
const next = item.aiAttempts + 1;
if (next >= ATTEMPT_CAP) {
  await supabase.from("items").update({ ai_status: "failed" }).eq("id", item.id);
} else {
  await supabase.from("items").update({ ai_status: "queued", ai_attempts: next, ... }).eq("id", item.id);
}
```
**Anti-pattern (Pitfall 3, from history):** the existing `retryFailedUploads` (`audioUploadQueue.ts:159-176`) resets `retryCount: 0` unconditionally — fine as a *manual* one-shot, but a *boot/online* resweep that does this on every `online` event would re-arm a permanently-failing entry forever. A boot/online resweep must be bounded (e.g. only reset entries below a resweep cap, or one-shot per session), not a blind `retryFailedUploads()`.

### SHARED-2: PostgREST conditional writes MUST end in `.select(...)`
**Source:** `offlineQueue.ts:126-132` and `gemini.ts:230`
```ts
const { data: claimed } = await supabase
  .from("items")
  .update({ ai_status: "processing", claimed_at: new Date().toISOString() })
  .eq("id", item.id)
  .eq("ai_status", "queued")
  .select("id");                 // ← WITHOUT this, data is null and winner-detection silently no-ops
if (!claimed || claimed.length === 0) return;
```
**Apply to:** any new reconcile/claim write in Plan 1 (e.g. flipping an item back to `queued` once its audio lands).

### SHARED-3: `== null`, never `=== null`, on any path that can see cross-device rows
**Source:** `offlineQueue.ts:84` + `:108-110` (WR-01)
```ts
// audioLookup returns Supabase-union rows with id: undefined (intentional)
const ids = audios.map((a) => a.id).filter((x): x is number => typeof x === "number");
...
if (audioId == null) { /* covers null AND undefined */ }
```
**Apply to:** the F2 banner gating (Plan 2). Do NOT key recovery on the integer `latestAudioId` — that is exactly the bug. Gate on a server-side boolean.

### SHARED-4: RLS is session-owner-scoped on the Storage path token — never broaden
**Source:** `../_workspace/Schema/schema.md:116` (per RESEARCH §Security). All new reconcile reads/writes key on `item_id` (UUID) and stay within the existing `audio`/`items` RLS. No service-role, no cross-session queries.

---

## Pattern Assignments

### Plan 1 — root cause / SC-1

#### `src/services/audioUploadQueue.ts` (service, batch + event-driven retry)

**The gap (GAP-3):** `drainAudioQueue` scans **only** `pending`; `failed` entries are invisible to every automatic drain.
```ts
// audioUploadQueue.ts:141-144 — the scan that ignores 'failed'
const items = await db.audioUploadQueue
  .where("status")
  .equals("pending")
  .sortBy("createdAt");
```

**Existing manual escape hatch to model the resweep on (but make BOUNDED, per SHARED-1):**
```ts
// audioUploadQueue.ts:159-176 — retryFailedUploads (reachable only via ItemCard pill)
export async function retryFailedUploads(): Promise<void> {
  const failed = await db.audioUploadQueue.where("status").equals("failed").toArray();
  await Promise.all(failed.map((entry) =>
    db.audioUploadQueue.update(entry.id!, { status: "pending" as const, retryCount: 0 })
  ));
  drainAudioQueue();   // fire-and-forget
}
```

**Idempotency pattern that makes a resweep retry-safe (DAT-5) — reuse, do NOT reinvent dedup:**
```ts
// audioUploadQueue.ts:71-91 — Storage upload + idempotent metadata upsert
await supabase.storage.from("audio").upload(entry.storagePath, audio.blob, {
  contentType: entry.mimeType, cacheControl: "31536000", upsert: true,
});
await supabase.from("audio").upsert(
  { item_id: entry.itemId, storage_path: entry.storagePath, mime_type: entry.mimeType, upload_status: "uploaded" },
  { onConflict: "storage_path", ignoreDuplicates: true }   // retry can't duplicate
);
await db.audioUploadQueue.update(entryId, { status: "uploaded" });
```

**Backoff / MAX_RETRIES constants to extend, not replace:**
```ts
// audioUploadQueue.ts:7-9
const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // delay = 4^retryCount * 1000 => 1s, 4s, 16s
```
The `failed` terminal write is at `:106-110` (cap reached) and `:63-66` (missing Dexie blob — note this one fails *without* incrementing, so a resweep that resets it will retry the blob lookup, which is correct only if the blob can reappear; for a cleared blob it will re-fail and re-terminate — acceptable and self-limiting).

**Storage path / mime invariants (Pitfall 5) — keep derived:**
```ts
// audioUploadQueue.ts:26,32
const ext = extFromMime(mimeType);
storagePath: `audio/${sessionId}/${itemId}/${dexieAudioId}.${ext}`
```

#### Boot + online resweep wiring — `src/layouts/AppLayout.tsx:60-77`

The boot/online drain orchestration already exists; the resweep hooks in here next to `drainAudioQueue()`:
```ts
// AppLayout.tsx:60-77 — handleReconnect runs on mount-if-online AND on window 'online'
const handleReconnect = async () => {
  await processWriteAheadQueue();
  await fetchSessions();
  await drainPhotoQueue();
  void drainAudioQueue(); // ← Plan 1: a bounded failed→pending resweep belongs adjacent to this
  drainQueue();
};
if (navigator.onLine) handleReconnect();
window.addEventListener("online", handleOnline);
```
**Decision deferred to discuss-phase (Open Q2/Q3 in RESEARCH):** whether the resweep is a new exported fn in `audioUploadQueue.ts` (e.g. `resweepFailedUploads()` with a cap) called here, or whether `drainAudioQueue` itself widens its scan to include bounded `failed`. Either way the call site is this block.

#### `src/services/offlineQueue.ts` (service) — reconcile signal, mirror the pending-reclaim block

The AI worker already converts "no audio" → terminal `failed` (GAP-4):
```ts
// offlineQueue.ts:107-117 — processItem: no audio ⇒ failed
const audioId = await findAudioForItem(item.id);
if (audioId == null) {
  await supabase.from("items").update({ ai_status: "failed" }).eq("id", item.id);
  return;
}
```
**The exact pattern to mirror for "item has audio uploaded ⇒ make it drainable again"** is the *pending-reclaim* block already in `drainQueue` — it reads `audio` by `item_id` and flips matching items back to `queued`:
```ts
// offlineQueue.ts:219-240 — pending rows WITH uploaded audio get re-queued (the reconcile edge already exists for 'pending')
const { data: audioRows } = await supabase.from("audio").select("item_id").in("item_id", pendingIds);
const idsWithAudio = [...new Set((audioRows ?? []).map((row) => row.item_id))];
if (idsWithAudio.length > 0) {
  await supabase.from("items").update({ ai_status: "queued" })
    .in("id", idsWithAudio).eq("ai_status", "pending");
}
```
This is the canonical "reconcile audio existence → item state" shape. Plan 1's SC-1 reconcile (Pattern 1: use `audio.upload_status`/row existence to decide recoverability) should follow this exact union-then-conditional-update structure. **Re-queue-on-missing-audio (Open Q2 preferred design) lives here**, reusing the attempt cap at `:160-184` rather than gating at RecordButton.

#### `src/components/RecordButton.tsx` (component) — the GAP-1 weld (only if discuss-phase picks the gating design)

```ts
// RecordButton.tsx:17-30 — items welded to 'queued' immediately after a Dexie id, before any upload
const audioId = await stopRecording();        // audioId != null means blob reached DEXIE only
if (audioId != null) {
  if (navigator.onLine) {
    await updateItemField(itemId, sessionId, "ai_status", "queued");  // DURABLE items write
    processAudioWithAi(audioId, itemId, sessionId).catch(...)          // fire-and-forget AI (gemini.ts orchestrator)
  } else {
    await updateItemField(itemId, sessionId, "ai_status", "queued");
  }
}
```
**Anti-pattern (Pitfall 4):** do NOT make `stopRecording()` await the upload. If the chosen design gates the AI fire, the item must still reach a *recoverable* state (`queued` + drainable), never a dead one. RESEARCH recommends the lower-blast-radius re-queue design in `offlineQueue` over editing this hot path — but if gating is chosen, this is the site.

#### `src/hooks/useAudioRecorder.ts` (hook) — the swallowed enqueue failure (GAP-2)

```ts
// useAudioRecorder.ts:220-227 — fire-and-forget enqueue; a thrown enqueue is dropped entirely
enqueueAudioUpload({
  dexieAudioId: id as number,
  itemId: itemIdRef.current,          // Supabase UUID STRING (not the `as unknown as number` Dexie coercion)
  sessionId: sessionIdRef.current,
  mimeType: detectedMimeTypeRef.current || "audio/webm",
})
  .then(() => drainAudioQueue())
  .catch(() => {});                    // ← GAP-2: enqueue/drain failure silently dropped
```
The intentional always-settle / fire-and-forget contract (D-05, REL-4) lives at `:215-219` and `:250-254`. **Constraint:** durability must NOT come from awaiting here (Pitfall 4) — it comes from the resumable queue (Plan 1 above). If anything changes here, it is at most observing the `.catch` to a non-blocking diagnostic, never an `await`.

---

### Plan 2 — F2 / SC-2/3

#### `src/components/AiFailureBanner.tsx` (component) — re-gate off server-side existence

**The gap (GAP-5):** returns `null` whenever the integer `latestAudioId` is absent — exactly the cross-device case.
```ts
// AiFailureBanner.tsx:39 — hides the banner (and Retry) for server-only audio
if (latestAudioId == null) return null;
```
```ts
// AiFailureBanner.tsx:28-51 — current prop shape + retry handler
export function AiFailureBanner({ itemId, sessionId, latestAudioId }: {
  itemId: string; sessionId: string; latestAudioId: number | null;
}) {
  ...
  const handleRetry = () => {
    ...
    processAudioWithAiRetry(latestAudioId, itemId, sessionId, true)   // needs an integer it doesn't have cross-device
      .catch(...).finally(...);
  };
```
**Fix shape (Pattern 3):** add a `hasServerAudio: boolean` prop (computed by the parent — see prop-threading below), gate on `hasServerAudio || latestAudioId != null`, and call the orchestrator retry in a way that does not require a real integer. The orchestrator already resolves by `item_id`:
```ts
// gemini.ts:218-242 — retry claim (isRetry widens claim to ['failed','processing']) + item_id-keyed resolve
const fromStatuses = isRetry ? ["failed", "processing"] : ["queued"];
... .in("ai_status", fromStatuses).select("id");
const { blob, mimeType } = await resolveAudioForAi({ itemId, dexieAudioId: audioId }); // resolves via Storage when Dexie misses
```
So a server-only retry can pass a sentinel/`0` `audioId` and still succeed because `resolveAudioForAi` falls through to Storage-by-`item_id`. (Discuss-phase: decide sentinel vs. widening the orchestrator's first param to `number | null`.)

**Storage-by-`item_id` resolver this relies on — already keyed correctly, no integer needed:**
```ts
// processAudioWithAi.ts:27-50 (imported as resolveAudioForAi)
const audioRecord = await db.audio.get(dexieAudioId);
if (audioRecord?.blob) return { blob: audioRecord.blob, mimeType: audioRecord.mimeType };
const { data: rows } = await supabase.from("audio").select("storage_path, mime_type").eq("item_id", itemId);
const row = rows?.[0];
if (!row) throw new Error(`Audio for ${itemId} not in Dexie or Storage`);
const { data: dl } = await supabase.storage.from("audio").download(row.storage_path);
return { blob: dl, mimeType: row.mime_type ?? undefined };
```

#### Prop threading — PERF-3 aggregate-subscription pattern (the `hasServerAudio` boolean)

**This is the exact pattern RESEARCH §Open-Q3 references — thread a boolean through the existing aggregate, do NOT add a per-banner network call.**

`ItemList.tsx` runs ONE `useLiveQuery` that builds a `Map<itemId, ItemMeta>` and threads each slice as a primitive prop into the `React.memo`'d `ItemCard`:
```ts
// ItemList.tsx:23-33 — the ItemMeta shape + stable EMPTY default
interface ItemMeta {
  audioCount: number;
  latestAudioId: number | null;
  photoCount: number;
  dexieItemId: number | string | null;
  isPending: boolean;
}
const EMPTY_META = new Map<string, ItemMeta>();
```
```ts
// ItemList.tsx:51-72 — the ONE aggregate subscription that already calls audioRecordsForItem per item
const itemMeta = useLiveQuery(async () => {
  const map = new Map<string, ItemMeta>();
  for (const item of items) {
    const audios = await audioRecordsForItem(item.id);     // ← already fetches the Supabase-union rows
    const audioCount = audios.length;
    const latestAudioId = audioCount > 0
      ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)
      : null;
    ...
    map.set(item.id, { audioCount, latestAudioId, photoCount, dexieItemId, isPending });
  }
  return map;
}, [items], EMPTY_META);
```
```tsx
// ItemList.tsx:363-374 — slices threaded as primitive props (clean React.memo compare)
<ItemCard ... audioCount={meta?.audioCount ?? 0} latestAudioId={meta?.latestAudioId ?? null} ... />
```
**Add `hasServerAudio: boolean` to `ItemMeta`** and compute it in the same loop from the already-fetched `audios` (e.g. `audios.length > 0`, or stricter: any row whose `id` is undefined ⇒ a server-union row ⇒ cross-device audio exists). Thread it through `ItemCard` (`src/components/ItemCard.tsx`) — note `ItemCard` already imports and renders `AiFailureBanner` and owns the prop boundary:
```tsx
// ItemCard.tsx:257-264 — the banner render site that must pass the new boolean
{isFailed && (
  <div className="border-t border-rule px-3 py-3">
    <AiFailureBanner itemId={item.id} sessionId={sessionId} latestAudioId={latestAudioId} />
  </div>
)}
```
`ItemCard`'s `latestAudioId` prop is also what drives `handleRetryAi` (`ItemCard.tsx:61-70`) and the `useAudioUploadStatus` pill (`:59`) — leave those; just add the parallel `hasServerAudio` for the banner gate.

**Detail page parallel (`ItemEntry.tsx`):** the detail view derives its own `latestAudioId` via a standalone `useLiveQuery`, NOT the aggregate map — so it needs a parallel `hasServerAudio` derivation in the same hook:
```ts
// ItemEntry.tsx:158-169 — bannerLatestAudioId derivation (add a sibling hasServerAudio here)
const bannerLatestAudioId = useLiveQuery(async () => {
  if (!itemId || isNewItem) return null;
  const audios = await audioRecordsForItem(itemId);
  return audios.length > 0 ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!) : null;
}, [itemId, isNewItem], null as number | null);
```

#### `src/db/audioLookup.ts` (utility) — the source of `id: undefined` rows (respect, mostly don't edit)

```ts
// audioLookup.ts:54-65 — cross-device union; Supabase rows DELIBERATELY get id: undefined
if (!remote || remote.length === 0) return dexieRows;
const remoteRows: ItemAudio[] = remote.map((r) => ({
  // id intentionally undefined — Supabase id is a UUID, not the Dexie int.
  itemId: itemId as unknown as number,
  itemType: "house",
  blob: new Blob([]),          // placeholder: cross-device row has no local blob
  mimeType: r.mime_type ?? "audio/webm",
  createdAt: r.created_at ? new Date(r.created_at) : new Date(),
}));
return [...dexieRows, ...remoteRows];
```
The Supabase query shape to reuse for any new server-existence check:
```ts
// audioLookup.ts:45-49
const res = await supabase.from("audio")
  .select("id, item_id, mime_type, storage_path, upload_status, created_at")
  .eq("item_id", itemId);
```
**Do NOT** attempt `db.audio.itemId` UUID/int normalization (out of scope, `:6-13`). If a dedicated `hasServerAudioForItem(itemId): Promise<boolean>` helper is cleaner than threading through the union, it would live in this file and use the `:45-49` query — but prefer reusing the already-fetched `audios` array in the parent loop to avoid a second round-trip (Open Q3 recommendation).

---

### Plan 2 (cont.) — Tests

#### NEW `src/tests/audio-cross-device-recovery.test.tsx` (Wave 0)

Clone the harness from two existing tests:

**Component-render harness** (banner shows Retry when audio is server-only) — clone `src/tests/item-card-ai-failure.test.tsx`:
```ts
// item-card-ai-failure.test.tsx:6-31 — RTL + MemoryRouter + vi.mock of hooks/services
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ItemCard } from "../components/ItemCard";
vi.mock("../hooks/useAudioUploadStatus", ...);
vi.mock("../services/audioUploadQueue", () => ({ retryFailedUploads: vi.fn(), enqueueAudioUpload: vi.fn(), drainAudioQueue: vi.fn() }));
vi.mock("../services/gemini", () => ({ processAudioWithAi: vi.fn() }));
```
The new case: `ai_status: "failed"`, `latestAudioId: null`, `hasServerAudio: true` ⇒ assert `role="alert"` + Retry button render (currently they would NOT, per GAP-5).

**Storage-fallback retry harness** (retry resolves via Storage-by-`item_id`, no integer) — clone `src/tests/audio-storage-fallback.test.ts` (it already mocks `../lib/supabase`).

**Resweep unit case** — extend `src/tests/audio-upload-queue.test.ts` (vi.hoisted supabase + `mockAudioUploadQueue`/`mockAudio` harness at `:14-53`) with a `failed → pending → uploaded` resweep case.

**Test commands (per RESEARCH Validation):**
- Per task: `npx vitest --run src/tests/<touched>.test.*`
- Per wave merge / phase gate: `npm test` (full suite, keep ~710 green)

---

## No Analog Found

None. Every edit has a same-file or proven-sibling pattern. The only genuinely-new artifact is the `audio-cross-device-recovery.test.tsx` file, and even that clones two existing test harnesses.

---

## Metadata

**Analog search scope:** `src/services/`, `src/components/`, `src/hooks/`, `src/pages/`, `src/db/`, `src/layouts/`, `src/tests/`
**Files read this session:** RecordButton.tsx, useAudioRecorder.ts, audioUploadQueue.ts, offlineQueue.ts, AiFailureBanner.tsx, audioLookup.ts, processAudioWithAi.ts, ItemList.tsx, ItemEntry.tsx (159-184), gemini.ts (200-334), ItemCard.tsx (1-75, 248-269), AppLayout.tsx (40-99), audio-upload-queue.test.ts (1-55), item-card-ai-failure.test.tsx (1-50)
**Pattern extraction date:** 2026-06-04
