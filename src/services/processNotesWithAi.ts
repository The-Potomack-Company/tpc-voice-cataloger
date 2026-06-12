import { z, toJSONSchema } from "zod";
import { getNotePages, markNotePagesStatus } from "../db/notePages";
import type { NotePage } from "../db/types";
import { ensureFreshSession } from "../lib/authGuard";
import { toAllCaps } from "../utils/toAllCaps";
import { formatEstimate } from "../utils/formatEstimate";
import { mapCategoryToCode } from "../utils/categoryMapper";
import { reformatMeasurements } from "../utils/formatMeasurements";
import { applySpokenBullets, applySpokenQuotes } from "../utils/spokenPunctuation";
import { blobToBase64 } from "./gemini";
import {
  persistItemDraftBatch,
  type DraftFieldName,
  type DraftFields,
  type DraftSourcePageRef,
  type ItemDraftPayload,
} from "./itemDraftsApi";

const CONFIDENCE_THRESHOLD = 0.6;

const DRAFT_FIELDS = [
  "title",
  "description",
  "condition",
  "estimate",
  "measurements",
  "category",
  "transcript",
  "receipt_number",
] as const satisfies readonly DraftFieldName[];

const FIELD_SCHEMA = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const MODEL_DRAFT_SCHEMA = z.object({
  source_page_uids: z.array(z.string()).min(1),
  raw_ocr_text: z.string().min(1),
  fields: z.object({
    title: FIELD_SCHEMA,
    description: FIELD_SCHEMA,
    condition: FIELD_SCHEMA,
    estimate: FIELD_SCHEMA,
    measurements: FIELD_SCHEMA,
    category: FIELD_SCHEMA,
    transcript: FIELD_SCHEMA,
    receipt_number: FIELD_SCHEMA,
  }),
});

const MODEL_RESPONSE_SCHEMA = z.object({
  drafts: z.array(MODEL_DRAFT_SCHEMA).min(1),
});

const NOTE_SEGMENTATION_PROMPT = `You are segmenting handwritten auction catalog notes.

You will receive ordered page images. Split the handwriting into distinct item drafts. For each draft, return only text fields that are visibly written on the pages.

Fields:
- title: item title/name.
- description: item description.
- condition: condition notes.
- estimate: numeric estimate or numeric range, without currency symbols.
- measurements: dimensions, weight, karats/carats when written.
- category: best RFC department code only when clearly inferable from the writing.
- transcript: the raw text for the item.
- receipt_number: lot/receipt number in XXXXX-N format when clearly written.

Rules:
1. Do not guess. If a field is blank, illegible, or only weakly implied, return value null.
2. Return confidence 0..1 for every field. Anything below 0.6 is treated as blank by the client, so do not place uncertain guesses in value.
3. Preserve raw OCR text for each draft so a reviewer can compare it to the generated fields.
4. Include source_page_uids for the page UIDs that contributed to the draft.
5. Never create real items. These outputs are draft rows for human review.`;

function sanitizeGeminiSchema(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(sanitizeGeminiSchema);
    return;
  }
  const obj = node as Record<string, unknown>;
  delete obj.$schema;
  delete obj.additionalProperties;
  delete obj.$defs;
  delete obj.definitions;
  for (const value of Object.values(obj)) {
    sanitizeGeminiSchema(value);
  }
}

const rawResponseSchema = toJSONSchema(MODEL_RESPONSE_SCHEMA);
sanitizeGeminiSchema(rawResponseSchema);

export function notePagesBatchKey(sessionId: string, pages: NotePage[]): string {
  const orderedRefs = pages
    .map((page) => `${page.pageUid}@${page.sortOrder}`)
    .join(",");
  return `photo-notes:v1:${sessionId}:${orderedRefs}`;
}

function refsForDraft(pages: NotePage[], sourcePageUids: string[]): DraftSourcePageRef[] {
  const byUid = new Map(pages.map((page) => [page.pageUid, page]));
  return sourcePageUids.flatMap((pageUid) => {
    const page = byUid.get(pageUid);
    return page ? [{ pageUid, sortOrder: page.sortOrder }] : [];
  });
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeField(field: DraftFieldName, value: string | null): string | null {
  const cleaned = cleanText(value);
  if (cleaned === null) return null;
  if (field === "title") return toAllCaps(applySpokenQuotes(cleaned));
  if (field === "description") return applySpokenBullets(applySpokenQuotes(cleaned));
  if (field === "condition" || field === "transcript") return applySpokenQuotes(cleaned);
  if (field === "estimate") return formatEstimate(cleaned);
  if (field === "category") return mapCategoryToCode(cleaned);
  if (field === "measurements") return reformatMeasurements(cleaned);
  return cleaned;
}

export function normalizeModelDrafts(
  pages: NotePage[],
  parsed: z.infer<typeof MODEL_RESPONSE_SCHEMA>,
): ItemDraftPayload[] {
  return parsed.drafts.map((draft) => {
    const fields = {} as DraftFields;
    const fieldConfidence = {} as Record<DraftFieldName, number>;
    const lowConfidenceFields: DraftFieldName[] = [];

    for (const field of DRAFT_FIELDS) {
      const output = draft.fields[field];
      fieldConfidence[field] = output.confidence;
      if (output.confidence < CONFIDENCE_THRESHOLD) {
        fields[field] = null;
        lowConfidenceFields.push(field);
      } else {
        fields[field] = normalizeField(field, output.value);
      }
    }

    return {
      sourcePageRefs: refsForDraft(pages, draft.source_page_uids),
      rawOcrText: draft.raw_ocr_text,
      fields,
      fieldConfidence,
      lowConfidenceFields,
    };
  });
}

export async function processNotesWithAi(sessionId: string): Promise<{ draftCount: number }> {
  const pages = await getNotePages(sessionId);
  if (pages.length === 0) {
    throw new Error("No note pages to process");
  }

  const batchKey = notePagesBatchKey(sessionId, pages);
  const pageIds = pages.flatMap((page) => (page.id === undefined ? [] : [page.id]));
  await markNotePagesStatus(pageIds, "processing");

  try {
    const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
    if (!proxyUrl) {
      throw new Error("VITE_GEMINI_PROXY_URL is not configured. Create a .env file from .env.example.");
    }

    const [accessToken, encodedPages] = await Promise.all([
      ensureFreshSession(),
      Promise.all(
        pages.map(async (page) => ({
          pageUid: page.pageUid,
          sortOrder: page.sortOrder,
          mimeType: page.blob.type || "image/jpeg",
          data: await blobToBase64(page.blob),
        })),
      ),
    ]);

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: NOTE_SEGMENTATION_PROMPT }],
      },
      contents: [
        {
          parts: [
            {
              text: [
                `Session ID: ${sessionId}`,
                `Batch key: ${batchKey}`,
                "Page order:",
                ...encodedPages.map((page) => `${page.sortOrder + 1}. ${page.pageUid}`),
              ].join("\n"),
            },
            ...encodedPages.map((page) => ({
              inlineData: {
                mimeType: page.mimeType.split(";")[0],
                data: page.data,
              },
            })),
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: rawResponseSchema,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response: Response;
    try {
      response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          payload: geminiPayload,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "unknown");
      throw new Error(`Proxy returned HTTP ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Gemini response did not include JSON text");
    }

    const parsedJson = JSON.parse(text);
    const parsed = MODEL_RESPONSE_SCHEMA.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(`Note draft validation failed: ${parsed.error.message}`);
    }

    const drafts = normalizeModelDrafts(pages, parsed.data);
    const result = await persistItemDraftBatch({
      sessionId,
      batchKey,
      pages: pages.map((page) => ({ pageUid: page.pageUid, sortOrder: page.sortOrder })),
      drafts,
    });
    await markNotePagesStatus(pageIds, "processed");
    return result;
  } catch (error) {
    await markNotePagesStatus(pageIds, "failed");
    throw error;
  }
}
