import { db } from "../db";
import { supabase } from "../lib/supabase";
import { useContinuousModeStore } from "../stores/continuousModeStore";
import { useSessionStore } from "../stores/sessionStore";
import { formatEstimate } from "../utils/formatEstimate";
import { mapCategoryToCode } from "../utils/categoryMapper";
import { toAllCaps } from "../utils/toAllCaps";
import { applySpokenBullets, applySpokenQuotes } from "../utils/spokenPunctuation";
import { reformatMeasurements } from "../utils/formatMeasurements";
import { trackEvent } from "./analytics";
import { blobToBase64, formatExistingValuesBlock, SYSTEM_PROMPT } from "./gemini";
import { catalogFieldsJsonSchema, catalogFieldsSchema } from "./geminiSchema";
import { ensureFreshSession } from "../lib/authGuard";

const CONTINUOUS_CHUNK_TIMEOUT_MS = 60_000;
const WEBM_CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75] as const;

export type ContinuousChunkSnapshot = {
  epoch: number;
  itemId: string;
  sessionId: string;
};

type ProcessContinuousChunkOptions = {
  snapshot?: ContinuousChunkSnapshot;
  signal?: AbortSignal;
  lookBackBytes?: Uint8Array;
};

class ContinuousChunkAbortError extends Error {
  constructor() {
    super("Continuous chunk processing aborted");
    this.name = "AbortError";
  }
}

function isTransientNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && /abort|Load failed|Failed to fetch|NetworkError/i.test(error.message)) return true;
  return false;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ContinuousChunkAbortError();
  }
}

function targetItemExists(itemId: string, sessionId: string): boolean {
  const items = useSessionStore.getState().itemsBySession[sessionId] ?? [];
  return items.some((item) => item.id === itemId);
}

function canProcessSession(sessionId: string): boolean {
  const continuousState = useContinuousModeStore.getState();
  return (
    (continuousState.active || continuousState.finalizing) &&
    continuousState.sessionId === sessionId
  );
}

function responseSchemaForGemini(): Record<string, unknown> {
  const raw = catalogFieldsJsonSchema as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "$schema" && key !== "additionalProperties"),
  );
}

function findWebmClusterOffset(bytes: Uint8Array): number {
  for (let i = 0; i <= bytes.length - WEBM_CLUSTER_ID.length; i++) {
    if (
      bytes[i] === WEBM_CLUSTER_ID[0] &&
      bytes[i + 1] === WEBM_CLUSTER_ID[1] &&
      bytes[i + 2] === WEBM_CLUSTER_ID[2] &&
      bytes[i + 3] === WEBM_CLUSTER_ID[3]
    ) {
      return i;
    }
  }
  return -1;
}

async function withLookBackAudio(audioBlob: Blob, lookBackBytes: Uint8Array | undefined): Promise<Blob> {
  if (!lookBackBytes || lookBackBytes.length === 0) {
    return audioBlob;
  }

  const currentBytes = new Uint8Array(await audioBlob.arrayBuffer());
  const clusterOffset = findWebmClusterOffset(currentBytes);
  if (clusterOffset <= 0) {
    const combined = new Uint8Array(lookBackBytes.length + currentBytes.length);
    combined.set(lookBackBytes, 0);
    combined.set(currentBytes, lookBackBytes.length);
    return new Blob([combined], { type: audioBlob.type });
  }

  const combined = new Uint8Array(currentBytes.length + lookBackBytes.length);
  combined.set(currentBytes.slice(0, clusterOffset), 0);
  combined.set(lookBackBytes, clusterOffset);
  combined.set(currentBytes.slice(clusterOffset), clusterOffset + lookBackBytes.length);
  return new Blob([combined], { type: audioBlob.type });
}

async function fetchCurrentItem(itemId: string) {
  const { data } = await supabase
    .from("items")
    .select("title, description, condition, estimate, category, measurements, transcript, receipt_number")
    .eq("id", itemId)
    .maybeSingle();

  return data;
}

function mergeContextText(currentItem: NonNullable<Awaited<ReturnType<typeof fetchCurrentItem>>>): string {
  const hasExistingData = Object.values(currentItem).some((value) => value !== null);
  if (!hasExistingData) {
    return "Extract catalog fields from this continuous session audio chunk.";
  }

  return `Extract and MERGE catalog fields from this continuous session audio chunk with the existing values below. If a wake phrase starts the next item, set new_item_detected and do not include that phrase or next-item speech in the current item fields.\n\n${formatExistingValuesBlock(currentItem)}`;
}

async function sendChunkToGemini(
  audioBlob: Blob,
  mimeType: string,
  currentItem: NonNullable<Awaited<ReturnType<typeof fetchCurrentItem>>>,
  accessToken: string,
  lookBackBytes?: Uint8Array,
  signal?: AbortSignal,
) {
  const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error("VITE_GEMINI_PROXY_URL is not configured. Create a .env file from .env.example.");
  }

  throwIfAborted(signal);
  // PERF-2 (DEFERRED — D-04): the continuous master-blob is currently materialized
  // whole here (withLookBackAudio concatenates look-back + current into one Uint8Array).
  // The bounded-blob rework (stream-append or segment-and-discard so peak memory does
  // not grow with session length) is deferred until continuous mode is re-enabled
  // (D-050). The chunked blobToBase64 below (PERF-1) already bounds the encode step.
  const geminiAudioBlob = await withLookBackAudio(audioBlob, lookBackBytes);
  throwIfAborted(signal);
  const base64Audio = await blobToBase64(geminiAudioBlob);
  throwIfAborted(signal);
  const baseMimeType = mimeType.split(";")[0];
  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [
          { text: mergeContextText(currentItem) },
          {
            inlineData: {
              mimeType: baseMimeType,
              data: base64Audio,
            },
          },
        ],
      },
    ],
    generationConfig: {
      // D-01: greedy decoding for deterministic extraction (SC-1). No seed/topP/topK (D-02).
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: responseSchemaForGemini(),
    },
  };

  const timeoutController = new AbortController();
  const abortTimeout = () => timeoutController.abort();
  signal?.addEventListener("abort", abortTimeout, { once: true });
  const timeout = setTimeout(abortTimeout, CONTINUOUS_CHUNK_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        payload,
      }),
      signal: timeoutController.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortTimeout);
  }

  throwIfAborted(signal);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    throw new Error(`Proxy returned HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  throwIfAborted(signal);
  const text = data.candidates[0].content.parts[0].text;
  const parsed = JSON.parse(text);
  const result = catalogFieldsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Zod validation failed: ${result.error.message}`);
  }

  return result.data;
}

async function mergeFieldsIntoItem(
  itemId: string,
  sessionId: string,
  fields: ReturnType<typeof catalogFieldsSchema.parse>,
): Promise<string[]> {
  const updates: Array<[string, string | null]> = [["ai_status", "done"]];
  const textFields = ["title", "description", "condition", "transcript"] as const;

  for (const field of textFields) {
    if (fields[field] !== null) {
      fields[field] = applySpokenQuotes(fields[field]);
    }
  }
  if (fields.description !== null) {
    fields.description = applySpokenBullets(fields.description);
  }

  if (fields.title !== null) updates.push(["title", toAllCaps(fields.title)]);
  if (fields.description !== null) updates.push(["description", fields.description]);
  if (fields.condition !== null) updates.push(["condition", fields.condition]);

  const formattedEstimate = formatEstimate(fields.estimate);
  if (formattedEstimate !== null) updates.push(["estimate", formattedEstimate]);

  const mappedCategory = mapCategoryToCode(fields.category);
  if (mappedCategory !== null) updates.push(["category", mappedCategory]);

  if (fields.measurements !== null) {
    updates.push(["measurements", reformatMeasurements(fields.measurements)]);
  }
  if (fields.transcript !== null) updates.push(["transcript", fields.transcript]);
  // Intentionally skip receipt_number: in continuous mode the receipt is set exactly
  // once when advanceItem creates the item. Chunk-level receipt_number emissions from
  // Gemini (sometimes hallucinated from adjacent "hundred dollars" context) must never
  // overwrite the established receipt. Manual mid-session receipt correction is deferred
  // — user can edit the item directly after Stop if a fix is needed.

  const sessionStore = useSessionStore.getState();
  for (const [field, value] of updates) {
    await sessionStore.updateItemField(itemId, sessionId, field, value);
  }

  return updates.map(([field]) => field);
}

const sessionProcessingQueues = new Map<string, Promise<void>>();

export async function waitForSessionChunksDrain(sessionId: string): Promise<void> {
  while (sessionProcessingQueues.has(sessionId)) {
    const current = sessionProcessingQueues.get(sessionId);
    if (!current) break;
    try {
      await current;
    } catch {
      /* ignored */
    }
    if (sessionProcessingQueues.get(sessionId) === current) {
      sessionProcessingQueues.delete(sessionId);
    }
  }
}

export async function processContinuousChunk(
  audioId: number,
  itemId: string,
  sessionId: string,
  chunkIndex: number,
  options: ProcessContinuousChunkOptions = {},
): Promise<void> {
  throwIfAborted(options.signal);
  const accessToken = await ensureFreshSession();

  const startedAt = performance.now();
  const continuousStore = useContinuousModeStore.getState();
  continuousStore.markChunkPending(chunkIndex);
  trackEvent({
    event_type: "ai.processing_started",
    session_id: sessionId,
    items_content: { item_id: itemId, continuous: true, chunk_index: chunkIndex },
  });

  const previous = sessionProcessingQueues.get(sessionId) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(async () => {
    let liveItemId: string | null = null;
    try {
      throwIfAborted(options.signal);

      const liveState = useContinuousModeStore.getState();
      const allowed = (liveState.active || liveState.finalizing) && liveState.sessionId === sessionId;
      if (!allowed) {
        useContinuousModeStore.getState().markChunkDone(chunkIndex);
        return;
      }

      liveItemId = liveState.currentItemId;
      if (!liveItemId || !targetItemExists(liveItemId, sessionId)) {
        useContinuousModeStore.getState().markChunkDone(chunkIndex);
        return;
      }

      await useSessionStore.getState().updateItemField(liveItemId, sessionId, "ai_status", "processing");

      const audioRecord = await db.audio.get(audioId);
      throwIfAborted(options.signal);
      if (!audioRecord) {
        throw new Error(`Audio record ${audioId} not found`);
      }

      const currentItem = await fetchCurrentItem(liveItemId);
      throwIfAborted(options.signal);
      if (!currentItem) {
        continuousStore.markChunkDone(chunkIndex);
        return;
      }

      const fields = await sendChunkToGemini(
        audioRecord.blob,
        audioRecord.mimeType,
        currentItem,
        accessToken,
        options.lookBackBytes,
        options.signal,
      );
      throwIfAborted(options.signal);

      if (fields.transcript !== null) {
        useContinuousModeStore.getState().appendTranscript(fields.transcript);
      }

      let updatedFields: string[] = [];
      updatedFields = await mergeFieldsIntoItem(liveItemId, sessionId, fields);

      useContinuousModeStore.getState().markChunkDone(chunkIndex);
      trackEvent({
        event_type: "ai.processing_succeeded",
        session_id: sessionId,
        execution_time_ms: Math.round(performance.now() - startedAt),
        items_content: {
          item_id: liveItemId,
          continuous: true,
          chunk_index: chunkIndex,
          fields: updatedFields,
        },
      });

      if (fields.new_item_detected?.triggered) {
        const wakeState = useContinuousModeStore.getState();
        if (
          (wakeState.active || wakeState.finalizing) &&
          wakeState.sessionId === sessionId &&
          wakeState.currentItemId === liveItemId &&
          targetItemExists(liveItemId, sessionId)
        ) {
          const detectedReceipt = fields.new_item_detected.receipt_number;
          const liveCurrentItem = wakeState.currentItemId
            ? await fetchCurrentItem(wakeState.currentItemId)
            : null;
          if (detectedReceipt && liveCurrentItem?.receipt_number === detectedReceipt) {
            console.info("[processContinuousChunk] Suppressing duplicate wake-phrase advance", { detectedReceipt });
            return;
          }

          const newItemId = await useContinuousModeStore
            .getState()
            .advanceItem(detectedReceipt ?? null);
          const nextItem = fields.new_item_detected.next_item;
          if (newItemId && nextItem) {
            throwIfAborted(options.signal);
            const postAdvanceState = useContinuousModeStore.getState();
            if (
              (postAdvanceState.active || postAdvanceState.finalizing) &&
              postAdvanceState.sessionId === sessionId &&
              postAdvanceState.currentItemId === newItemId &&
              targetItemExists(newItemId, sessionId)
            ) {
              if (nextItem.transcript) {
                postAdvanceState.appendTranscript(nextItem.transcript);
              }
              await mergeFieldsIntoItem(newItemId, sessionId, {
                title: nextItem.title,
                description: nextItem.description,
                condition: nextItem.condition,
                estimate: nextItem.estimate,
                category: nextItem.category,
                measurements: nextItem.measurements,
                transcript: nextItem.transcript,
                receipt_number: null,
                new_item_detected: null,
              });
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof ContinuousChunkAbortError || (error instanceof DOMException && error.name === "AbortError")) {
        useContinuousModeStore.getState().markChunkDone(chunkIndex);
        return;
      }
      console.error("Continuous AI processing error:", error);
      const transientNetworkError = isTransientNetworkError(error);
      if (transientNetworkError) {
        useContinuousModeStore.getState().markChunkDone(chunkIndex);
      } else {
        useContinuousModeStore.getState().markChunkFailed(chunkIndex);
      }
      trackEvent({
        event_type: "ai.processing_failed",
        session_id: sessionId,
        execution_time_ms: Math.round(performance.now() - startedAt),
        error_message: error instanceof Error ? error.message : String(error),
        error_count: 1,
        items_content: { item_id: itemId, continuous: true, chunk_index: chunkIndex },
      });
      try {
        if (!transientNetworkError && liveItemId && canProcessSession(sessionId) && targetItemExists(liveItemId, sessionId)) {
          await useSessionStore.getState().updateItemField(liveItemId, sessionId, "ai_status", "failed");
        }
      } catch (dbError) {
        console.error("Failed to mark continuous chunk failed:", dbError);
      }
    }
  });

  sessionProcessingQueues.set(sessionId, queued);
  try {
    await queued;
  } finally {
    if (sessionProcessingQueues.get(sessionId) === queued) {
      sessionProcessingQueues.delete(sessionId);
    }
  }
}
