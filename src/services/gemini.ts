import { db } from "../db";
import { supabase } from "../lib/supabase";
import { catalogFieldsSchema, catalogFieldsJsonSchema } from "./geminiSchema";
import { formatEstimate } from "../utils/formatEstimate";
import { mapCategoryToCode } from "../utils/categoryMapper";
import { toAllCaps } from "../utils/toAllCaps";
import { useSessionStore } from "../stores/sessionStore";
import { applySpokenQuotes } from "../utils/spokenPunctuation";

const SYSTEM_PROMPT = `You are an auction catalog field extractor. You will receive an audio recording of an auctioneer describing an item.

Your job is to extract the following fields from EXACTLY what the speaker says:
- title: The item name/type as spoken
- description: The item description as spoken
- condition: The condition assessment as spoken
- estimate: The price estimate as a number or numeric range (e.g. "500" or "300 to 500"). Strip dollar signs. If the speaker says "two hundred", return "200". If they give a range like "three to five hundred", return "300 to 500"
- category: The RFC department code matching the item category. Valid codes: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE. If uncertain, return the closest match.
- measurements: A single formatted string combining dimensions, weight, and karats.
  Dimensions in inches: format as "N x N in. (N x N cm.)" with auto cm conversion. Common fractions (1/4, 1/2, 3/4) display as fractions in the inch portion.
  Dimensions in millimeters: ONLY when the speaker explicitly says "millimeters" or "mm". Format as "N x N mm" with no conversion to other units. Default to inches when no unit specified.
  Weight: "N oz." for ounces, "N g" for grams. No pounds.
  Karats: "Nkt" (e.g., "18kt").
  Combine all components separated by ", ". Example: "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt".
  Return null if no measurements mentioned.
- transcript: The full verbatim transcript of everything said in the audio

CRITICAL RULES:
1. Use the speaker's EXACT words. Do not rephrase, improve, or formalize.
2. If a field is not mentioned in the audio, return null for that field.
3. Do NOT invent or guess values for unmentioned fields.
4. If the speaker says "oak table, kinda beat up, maybe two hundred", return those exact words in the appropriate fields.

MERGE RULES:
When existing field values are provided in the user message, your job is to MERGE new information with existing values:
- Default behavior: APPEND new information to existing field values. For example, if title is "OAK TABLE" and speaker says "add ROBERT", return "OAK TABLE ROBERT".
- If the speaker says "change X to Y", "replace X with Y", or similar edit instructions, modify the existing value accordingly.
- If the speaker says "add X to the title/description", append X to the existing value.
- Only OVERWRITE a field completely if the speaker explicitly asks (e.g., "replace the description with...").
- If a field has no existing value (marked "(empty)"), write the new extracted value directly.
- For transcript: ALWAYS append new speech to the existing transcript, separated by a newline. Never overwrite existing transcript.
- If the audio contains no information relevant to a field, return the existing value unchanged (do NOT return null for fields that already have values).

SPOKEN PUNCTUATION:
When the speaker says punctuation words, convert them to actual punctuation characters. Apply to ALL fields (title, description, condition, transcript, etc.):
- "comma" -> ","
- "period" or "full stop" -> "."
- "semicolon" -> ";"
- "colon" -> ":"
- "dash" or "hyphen" -> "-"
- "parenthesis" or "open parenthesis" -> "("
- "close parenthesis" or "end parenthesis" -> ")"
- "quote" or "open quote" -> " (ASCII double-quote character, 0x22)
- "unquote" or "close quote" or "end quote" -> " (ASCII double-quote character, 0x22)
For example: speaker says "quote 19th century unquote" -> output: "19th century" (with literal double-quote characters wrapping the phrase)
- "exclamation point" or "exclamation mark" -> "!"
- "question mark" -> "?"
Use context to distinguish: "period" as punctuation vs "period" as a time era (e.g., "Victorian period" should NOT become "Victorian.").`;

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
 * validate response with Zod, write structured fields back to Supabase items table.
 *
 * Designed to be called fire-and-forget after recording stops.
 * Uses captured itemId in closure to prevent race conditions.
 *
 * @param audioId - Dexie integer ID for the audio blob
 * @param itemId - Supabase UUID string for the item
 * @param sessionId - Supabase UUID string for the session (for potential store refresh)
 */
export async function processAudioWithAi(
  audioId: number,
  itemId: string,
  sessionId: string,
): Promise<void> {
  try {
    // Set ai_status to "processing" via Supabase
    await supabase
      .from("items")
      .update({ ai_status: "processing" })
      .eq("id", itemId);

    // Fetch audio record from Dexie (blobs stay in IndexedDB)
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

    // Read existing field values for smart merge context (per D-02)
    const { data: currentItem } = await supabase
      .from("items")
      .select("title, description, condition, estimate, category, measurements, transcript")
      .eq("id", itemId)
      .maybeSingle();

    if (!currentItem) return; // Item deleted mid-processing, bail out

    const hasExistingData = Object.values(currentItem).some(v => v !== null);

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
              text: hasExistingData
                ? `Extract and MERGE catalog fields from this audio recording with the existing values below.\n\nEXISTING VALUES:\nTitle: ${currentItem.title ?? "(empty)"}\nDescription: ${currentItem.description ?? "(empty)"}\nCondition: ${currentItem.condition ?? "(empty)"}\nEstimate: ${currentItem.estimate ?? "(empty)"}\nCategory: ${currentItem.category ?? "(empty)"}\nMeasurements: ${currentItem.measurements ?? "(empty)"}\nTranscript: ${currentItem.transcript ?? "(empty)"}`
                : "Extract catalog fields from this audio recording.",
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
          const raw = catalogFieldsJsonSchema as Record<string, unknown>;
          const clean = Object.fromEntries(
            Object.entries(raw).filter(([k]) => k !== '$schema' && k !== 'additionalProperties'),
          );
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

    // Safety net: ensure spoken quote markers are converted even if AI missed them
    const textFields = ['title', 'description', 'condition', 'transcript'] as const;
    for (const field of textFields) {
      if (fields[field] !== null) {
        fields[field] = applySpokenQuotes(fields[field]);
      }
    }

    // Write fields to Supabase items table
    const supabaseUpdate: Record<string, unknown> = {
      ai_status: "done",
    };

    if (fields.title !== null) {
      supabaseUpdate.title = toAllCaps(fields.title);
    }
    if (fields.description !== null) {
      supabaseUpdate.description = fields.description;
    }
    if (fields.condition !== null) {
      supabaseUpdate.condition = fields.condition;
    }
    const formattedEstimate = formatEstimate(fields.estimate);
    if (formattedEstimate !== null) {
      supabaseUpdate.estimate = formattedEstimate;
    }
    const mappedCategory = mapCategoryToCode(fields.category);
    if (mappedCategory !== null) {
      supabaseUpdate.category = mappedCategory;
    }
    if (fields.measurements !== null) {
      supabaseUpdate.measurements = fields.measurements;
    }
    if (fields.transcript !== null) {
      supabaseUpdate.transcript = fields.transcript;
    }

    await supabase
      .from("items")
      .update(supabaseUpdate)
      .eq("id", itemId);

    // Refresh Zustand store so UI re-renders with AI results
    useSessionStore.getState().fetchItems(sessionId).catch(() => {});
  } catch (error) {
    // On ANY error: set ai_status to "failed", set fallback description
    console.error("AI processing error:", error);
    try {
      await supabase
        .from("items")
        .update({
          ai_status: "failed",
          description:
            "AI processing failed - audio recorded, awaiting manual review",
        })
        .eq("id", itemId);

      // Refresh store so UI shows "failed" status immediately
      useSessionStore.getState().fetchItems(sessionId).catch(() => {});
    } catch (dbError) {
      console.error("Failed to update ai_status to failed:", dbError);
    }
  }
}
