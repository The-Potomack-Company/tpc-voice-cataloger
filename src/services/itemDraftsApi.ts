import { ensureFreshSession } from "../lib/authGuard";

export type DraftFieldName =
  | "title"
  | "description"
  | "condition"
  | "estimate"
  | "measurements"
  | "category"
  | "transcript"
  | "receipt_number";

export type DraftFields = Record<DraftFieldName, string | null>;
export type DraftFieldConfidence = Record<DraftFieldName, number>;

export interface DraftSourcePageRef {
  pageUid: string;
  sortOrder: number;
  pageContentKey?: string;
}

export interface ItemDraftPayload {
  pageContentKey: string;
  pageSegmentIndex: number;
  sourcePageRefs: DraftSourcePageRef[];
  rawOcrText: string;
  fields: DraftFields;
  fieldConfidence: DraftFieldConfidence;
  lowConfidenceFields: DraftFieldName[];
}

export interface PersistItemDraftBatchResult {
  draftCount: number;
  skippedCount: number;
}

export class DuplicateDraftBatchError extends Error {}

export async function persistItemDraftBatch(input: {
  sessionId: string;
  batchKey: string;
  pages: DraftSourcePageRef[];
  drafts: ItemDraftPayload[];
}): Promise<PersistItemDraftBatchResult> {
  const apiUrl = import.meta.env.VITE_CATALOGER_API_URL;
  if (!apiUrl) {
    throw new Error("VITE_CATALOGER_API_URL is not set. Add it to .env.local");
  }

  const token = await ensureFreshSession();
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/item-draft-batches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (response.status === 409) {
    throw new DuplicateDraftBatchError("Draft batch already processed");
  }

  if (!response.ok) {
    let message = `Draft persistence failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the stable fallback when the API did not return JSON.
    }
    throw new Error(message);
  }

  const body = (await response.json()) as { draftCount?: number; skippedCount?: number };
  return {
    draftCount: body.draftCount ?? input.drafts.length,
    skippedCount: body.skippedCount ?? 0,
  };
}
