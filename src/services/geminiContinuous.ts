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
import { blobToBase64, SYSTEM_PROMPT } from "./gemini";
import { catalogFieldsJsonSchema, catalogFieldsSchema } from "./geminiSchema";

const CONTINUOUS_CHUNK_TIMEOUT_MS = 30_000;

function responseSchemaForGemini(): Record<string, unknown> {
  const raw = catalogFieldsJsonSchema as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "$schema" && key !== "additionalProperties"),
  );
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

  return `Extract and MERGE catalog fields from this continuous session audio chunk with the existing values below. If a wake phrase starts the next item, set new_item_detected and do not include that phrase or next-item speech in the current item fields.\n\nEXISTING VALUES:\nTitle: ${currentItem.title ?? "(empty)"}\nDescription: ${currentItem.description ?? "(empty)"}\nCondition: ${currentItem.condition ?? "(empty)"}\nEstimate: ${currentItem.estimate ?? "(empty)"}\nCategory: ${currentItem.category ?? "(empty)"}\nMeasurements: ${currentItem.measurements ?? "(empty)"}\nTranscript: ${currentItem.transcript ?? "(empty)"}\nReceipt Number: ${currentItem.receipt_number ?? "(empty)"}`;
}

async function sendChunkToGemini(audioBlob: Blob, mimeType: string, currentItem: NonNullable<Awaited<ReturnType<typeof fetchCurrentItem>>>) {
  const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error("VITE_GEMINI_PROXY_URL is not configured. Create a .env file from .env.example.");
  }

  const base64Audio = await blobToBase64(audioBlob);
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
      responseMimeType: "application/json",
      responseSchema: responseSchemaForGemini(),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTINUOUS_CHUNK_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        payload,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    throw new Error(`Proxy returned HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
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
  if (fields.receipt_number != null) updates.push(["receipt_number", fields.receipt_number]);

  const sessionStore = useSessionStore.getState();
  for (const [field, value] of updates) {
    await sessionStore.updateItemField(itemId, sessionId, field, value);
  }

  return updates.map(([field]) => field);
}

export async function processContinuousChunk(
  audioId: number,
  itemId: string,
  sessionId: string,
  chunkIndex: number,
): Promise<void> {
  const startedAt = performance.now();
  const continuousStore = useContinuousModeStore.getState();
  continuousStore.markChunkPending(chunkIndex);
  trackEvent({
    event_type: "ai.processing_started",
    session_id: sessionId,
    items_content: { item_id: itemId, continuous: true, chunk_index: chunkIndex },
  });

  try {
    await useSessionStore.getState().updateItemField(itemId, sessionId, "ai_status", "processing");

    const audioRecord = await db.audio.get(audioId);
    if (!audioRecord) {
      throw new Error(`Audio record ${audioId} not found`);
    }

    const currentItem = await fetchCurrentItem(itemId);
    if (!currentItem) {
      continuousStore.markChunkDone(chunkIndex);
      return;
    }

    const fields = await sendChunkToGemini(audioRecord.blob, audioRecord.mimeType, currentItem);
    const updatedFields = await mergeFieldsIntoItem(itemId, sessionId, fields);

    if (fields.transcript !== null) {
      useContinuousModeStore.getState().appendTranscript(fields.transcript);
    }

    useContinuousModeStore.getState().markChunkDone(chunkIndex);
    trackEvent({
      event_type: "ai.processing_succeeded",
      session_id: sessionId,
      execution_time_ms: Math.round(performance.now() - startedAt),
      items_content: {
        item_id: itemId,
        continuous: true,
        chunk_index: chunkIndex,
        fields: updatedFields,
      },
    });

    if (fields.new_item_detected?.triggered) {
      await useContinuousModeStore.getState().advanceItem(fields.new_item_detected.receipt_number ?? null);
    }
  } catch (error) {
    console.error("Continuous AI processing error:", error);
    useContinuousModeStore.getState().markChunkFailed(chunkIndex);
    trackEvent({
      event_type: "ai.processing_failed",
      session_id: sessionId,
      execution_time_ms: Math.round(performance.now() - startedAt),
      error_message: error instanceof Error ? error.message : String(error),
      error_count: 1,
      items_content: { item_id: itemId, continuous: true, chunk_index: chunkIndex },
    });
    try {
      await useSessionStore.getState().updateItemField(itemId, sessionId, "ai_status", "failed");
    } catch (dbError) {
      console.error("Failed to mark continuous chunk failed:", dbError);
    }
  }
}
