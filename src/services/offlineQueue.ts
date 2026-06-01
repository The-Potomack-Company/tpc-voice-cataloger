import { supabase } from "../lib/supabase";
import { audioRecordsForItem } from "../db/audioLookup";
import { processAudioWithAi } from "./gemini";
import { isInBackoff, ATTEMPT_CAP } from "../utils/backoff";
import { classifyAiError } from "../utils/aiErrorClass";

const CONCURRENCY = 4;

// D-02: an item left in 'processing' longer than this is presumed stranded by a
// dead/closed tab and is reclaimed to 'queued'. ~2× the 5min backoff cap so a
// legitimately slow-but-live processing attempt is never yanked out from under
// itself, while a truly dead tab self-heals within one drain.
const STALE_MS = 300_000;

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

  if (error || !data) return [];

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
  if (audios.length === 0) return null;
  // Return the highest id (most recent)
  return audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!);
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
  if (audioId === null) {
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
      await supabase
        .from("items")
        .update({ ai_status: "queued", ai_attempts: next })
        .eq("id", item.id);
    }
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
