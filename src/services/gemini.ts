import { db } from "../db";
import { catalogFieldsSchema, catalogFieldsJsonSchema } from "./geminiSchema";

const SYSTEM_PROMPT = `You are an auction catalog field extractor. You will receive an audio recording of an auctioneer describing an item.

Your job is to extract the following fields from EXACTLY what the speaker says:
- title: The item name/type as spoken
- description: The item description as spoken
- condition: The condition assessment as spoken
- estimate: The price estimate as spoken
- category: The item category as spoken
- transcript: The full verbatim transcript of everything said in the audio

CRITICAL RULES:
1. Use the speaker's EXACT words. Do not rephrase, improve, or formalize.
2. If a field is not mentioned in the audio, return null for that field.
3. Do NOT invent or guess values for unmentioned fields.
4. If the speaker says "oak table, kinda beat up, maybe two hundred", return those exact words in the appropriate fields.`;

/**
 * Convert a Blob to a base64 string.
 * Uses Response API to read the blob (works across environments including jsdom).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  // Re-wrap to ensure we have a proper Blob (handles structured clone edge cases)
  const freshBlob = new Blob([blob], { type: blob.type });
  const buffer = await freshBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Full AI processing pipeline: fetch audio from Dexie, send to Gemini via proxy,
 * validate response with Zod, write structured fields back to item record.
 *
 * Designed to be called fire-and-forget after recording stops.
 * Uses captured itemId in closure to prevent race conditions.
 */
export async function processAudioWithAi(
  audioId: number,
  itemId: number,
  itemType: "house" | "sale",
): Promise<void> {
  const table =
    itemType === "house" ? db.houseVisitItems : db.saleItems;

  try {
    // Set aiStatus to "processing"
    await table.update(itemId, { aiStatus: "processing" });

    // Fetch audio record from Dexie
    const audioRecord = await db.audio.get(audioId);
    if (!audioRecord) {
      throw new Error(`Audio record ${audioId} not found`);
    }

    // Guard: ensure proxy URL is configured before doing any work
    const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
    if (!proxyUrl) {
      throw new Error("VITE_GEMINI_PROXY_URL is not configured. Create a .env file from .env.example.");
    }

    // Convert audio blob to base64
    const base64Audio = await blobToBase64(audioRecord.blob);

    // Strip codec parameters from mimeType (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseMimeType = audioRecord.mimeType.split(";")[0];

    // Build Gemini request payload
    const geminiPayload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [
            {
              text: "Extract catalog fields from this audio recording.",
            },
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
        responseSchema: (() => {
          // Gemini API rejects $schema and additionalProperties fields
          const { $schema, additionalProperties, ...clean } = catalogFieldsJsonSchema as Record<string, unknown>;
          return clean;
        })(),
      },
    };

    // Send to proxy (30s timeout so a down server doesn't hang forever)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          payload: geminiPayload,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Check for non-200 response before attempting to parse
    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(`Proxy returned HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Parse response
    const text = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    // Validate with Zod
    const result = catalogFieldsSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Zod validation failed: ${result.error.message}`);
    }

    const fields = result.data;

    // Write fields to item record
    // Use undefined for null fields so Dexie doesn't store them
    // Category defaults to "furniture" if null
    const updateData: Record<string, unknown> = {
      aiStatus: "done",
    };

    if (fields.title !== null) {
      updateData.title = fields.title;
    }
    if (fields.description !== null) {
      updateData.description = fields.description;
    }
    if (fields.condition !== null) {
      updateData.condition = fields.condition;
    }
    if (fields.estimate !== null) {
      updateData.estimate = fields.estimate;
    }
    updateData.category = fields.category ?? "furniture";
    if (fields.transcript !== null) {
      // Append to existing transcript so multiple recordings accumulate
      const existing = await table.get(itemId);
      const prev = (existing as Record<string, unknown>)?.transcript as string | undefined;
      updateData.transcript = prev
        ? `${prev}\n\n${fields.transcript}`
        : fields.transcript;
    }

    await table.update(itemId, updateData);
  } catch (error) {
    // On ANY error: set aiStatus to "failed", set fallback description
    console.error("AI processing error:", error);
    try {
      await table.update(itemId, {
        aiStatus: "failed",
        description:
          "AI processing failed - audio recorded, awaiting manual review",
      });
    } catch (dbError) {
      console.error("Failed to update aiStatus to failed:", dbError);
    }
  }
}
