import { supabase } from "../lib/supabase";
import { audioRecordsForItem } from "../db/audioLookup";
import { processAudioWithAi } from "./gemini";
import { isInBackoff, ATTEMPT_CAP } from "../utils/backoff";
import { classifyAiError } from "../utils/aiErrorClass";

const CONCURRENCY = 4;

// D-02: an item left in 'processing' longer than this is presumed stranded by a
// dead/closed tab and is reclaimed to 'queued'. Basis is ~2× the observed max
// processAudioWithAi wall-clock (large audio + slow proxy/model latency), NOT
// the backoff cap — the backoff cap governs retry spacing, not how long a single
// live call can legitimately run. A reclaim that fires under a still-live worker
// re-queues a row another tab then re-claims, double-billing Gemini (CR-01). A
// per-item heartbeat (see HEARTBEAT_MS) re-stamps claimed_at while a long call is
// in flight so a live worker is never reclaimed even past STALE_MS.
const STALE_MS = 600_000;

// While a claim-winner awaits processAudioWithAi, re-stamp claimed_at on this
// cadence so a call that legitimately outlives STALE_MS is never reclaimed
// (CR-01). Cleared in finally when the call settles.
const HEARTBEAT_MS = 60_000;

let draining = false;

export interface QueuedItem {
  id: string;
  itemType: "house" | "sale";
  sessionId: string;
  createdAt: Date;
  claimedAt: Date | null;
  aiAttempts: number;
}

/**
 * Query all items with ai_status='queued' from Supabase,
 * sorted by created_at ascending (FIFO).
 */
export async function getQueuedItems(): Promise<QueuedItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, mode, session_id, created_at, claimed_at, ai_attempts")
    .eq("ai_status", "queued")
    .order("created_at", { ascending: true });

  if (error || !data) {
    // IN-01: a transient read failure is not an empty queue — log it so a
    // persistently stuck queue is diagnosable instead of silently draining nothing.
    if (error) console.warn("getQueuedItems: Supabase read failed", error);
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    itemType: item.mode as "house" | "sale",
    sessionId: item.session_id,
    createdAt: new Date(item.created_at),
    claimedAt: item.claimed_at ? new Date(item.claimed_at) : null,
    aiAttempts: item.ai_attempts ?? 0,
  }));
}

/**
 * Find the most recent audio record for a given item.
 * Delegates to the DAT-7 shared helper (audioRecordsForItem) which unions both
 * itemId forms (UUID + mapped legacy int), so no audio is missed regardless of
 * which form a given row used. Returns the audio ID or null if no audio exists.
 */
async function findAudioForItem(itemId: string): Promise<number | null> {
  const audios = await audioRecordsForItem(itemId);
  // WR-01: cross-device Supabase-union rows intentionally carry `id: undefined`
  // (audioLookup leaves the integer key unset). Filter those out before picking
  // the max so we never return `undefined` typed as number — which slipped the
  // `=== null` caller guard and fed a bogus audioId into Gemini.
  const ids = audios.map((a) => a.id).filter((x): x is number => typeof x === "number");
  if (ids.length === 0) return null;
  return Math.max(...ids);
}

/**
 * Process a single queued item under persisted-attempt backoff (REL-1).
 *
 * WHY no immediate retry loop: the old fixed retry loop re-fired Gemini on
 * every `online` flip with no persistence, so a permanently-failing item burned
 * calls forever. We now read `claimed_at`/`ai_attempts` off the row and skip any
 * item still inside its full-jitter backoff window, persisting attempt count so
 * retries are bounded and cross-tab consistent. After ATTEMPT_CAP the item is
 * terminally `failed`; below the cap it is re-queued with an incremented count.
 * Items with no audio are marked failed immediately (path preserved).
 */
async function processItem(item: QueuedItem): Promise<void> {
  // Skip items still cooling down — replaces the old unconditional re-process,
  // which is what produced the per-online-event retry storm.
  if (isInBackoff(item.claimedAt, item.aiAttempts)) return;

  if (!navigator.onLine) return; // offline is itself transient — leave queued

  const audioId = await findAudioForItem(item.id);
  // WR-01: `== null` short-circuits both null AND undefined so a cross-device
  // row (id undefined) can never proceed to claim + processAudioWithAi.
  if (audioId == null) {
    // No audio found -- mark as failed via Supabase
    await supabase
      .from("items")
      .update({ ai_status: "failed" })
      .eq("id", item.id);
    return;
  }

  // REL-2 / D-01: DB-atomic claim. The conditional update only mutates the row
  // if it is still 'queued', so across tabs/processes/devices exactly one drain
  // can flip a given item to 'processing' and proceed — making duplicate Gemini
  // spend structurally impossible without any cross-tab message bus (D-03).
  // WHY .select("id"): PostgREST .update().eq() returns data:null WITHOUT an
  // explicit .select(), so winner-detection would silently no-op (RESEARCH
  // Pitfall 1). The .select("id") is what makes the row-returned check real.
  const { data: claimed } = await supabase
    .from("items")
    .update({ ai_status: "processing", claimed_at: new Date().toISOString() })
    .eq("id", item.id)
    .eq("ai_status", "queued")
    .select("id");
  if (!claimed || claimed.length === 0) return; // another tab won the claim

  // CR-01 heartbeat: a single processAudioWithAi call can legitimately run past
  // STALE_MS (large audio, slow proxy). Re-stamp claimed_at periodically so the
  // stale-reclaim pass never yanks this row out from under a live worker and
  // hands it to a second tab (duplicate Gemini spend). Cleared in finally.
  const heartbeat = setInterval(() => {
    void supabase
      .from("items")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("ai_status", "processing");
  }, HEARTBEAT_MS);

  try {
    await processAudioWithAi(audioId, item.id, item.sessionId);
  } catch (err) {
    // A transient error (offline/network/5xx/429, folds in #17 net-abort) is
    // re-queued and aged out via the attempt cap; a permanent error (4xx/Zod)
    // fails immediately since retrying cannot help — don't burn the remaining
    // attempts on it.
    if (classifyAiError(err) === "permanent") {
      await supabase
        .from("items")
        .update({ ai_status: "failed" })
        .eq("id", item.id);
      return;
    }
    const next = item.aiAttempts + 1;
    if (next >= ATTEMPT_CAP) {
      // D-07: cap reached → terminal failure, not re-queued.
      await supabase
        .from("items")
        .update({ ai_status: "failed" })
        .eq("id", item.id);
    } else {
      // Read-then-write is safe pre-claim: only the claim-winner mutates the
      // row (REL-2 / 33-02 adds the atomic claim). Re-queue + persist attempt.
      // WR-03: re-stamp claimed_at to the failure time so the D-06 backoff
      // window measures from when the call actually failed — the claim-time
      // stamp predates the (possibly long) processAudioWithAi call, which let a
      // slow failure consume its whole backoff window and re-fire immediately.
      // A 'queued' row is never reclaimed (reclaim filters ai_status='processing'),
      // so re-stamping claimed_at here can't trigger a spurious stale-reclaim.
      await supabase
        .from("items")
        .update({
          ai_status: "queued",
          ai_attempts: next,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Drain the offline queue by processing all queued items in FIFO order
 * with bounded concurrency. Prevents concurrent drains via mutex flag.
 * Pauses if connectivity drops mid-drain.
 */
export async function drainQueue(): Promise<void> {
  if (draining) return; // Prevent concurrent drains
  draining = true;

  try {
    // D-02: stale-claim reclaim. Re-queue any item stranded in 'processing'
    // past STALE_MS (dead/closed tab) so it becomes drainable again. Runs once
    // per drain, before we read the queue, so reclaimed rows join this pass.
    const staleCutoff = new Date(Date.now() - STALE_MS).toISOString();
    await supabase
      .from("items")
      .update({ ai_status: "queued" })
      .eq("ai_status", "processing")
      .lt("claimed_at", staleCutoff);

    const items = await getQueuedItems();
    // Process in batches of CONCURRENCY
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      if (!navigator.onLine) break; // Stop if offline
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(processItem));
    }
  } finally {
    draining = false;
  }
}
