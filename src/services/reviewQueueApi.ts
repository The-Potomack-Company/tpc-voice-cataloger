import { ensureFreshSession } from "../lib/authGuard";
import type { DraftFieldName, DraftFields } from "./itemDraftsApi";

export interface DraftDuplicateBlock {
  blocking_draft_id: string;
  blocking_status: string;
}

export interface ReviewDraft {
  id: string;
  session_id: string;
  status: "draft" | "promoted" | "discarded" | string;
  source_page_refs: unknown[];
  raw_ocr_text: string | null;
  title: string | null;
  description: string | null;
  condition: string | null;
  estimate: string | null;
  measurements: string | null;
  category: string | null;
  transcript: string | null;
  receipt_number: string | null;
  field_confidence: Partial<Record<DraftFieldName, number>>;
  low_confidence_fields: DraftFieldName[];
  receipt_number_requires_review: boolean;
  receipt_number_acknowledged: boolean;
  promoted_item_id: string | null;
  duplicate_block: DraftDuplicateBlock | null;
  created_at: string;
  updated_at: string;
}

export interface DraftSummaryCounts {
  total: number;
  draft: number;
  promoted: number;
  discarded: number;
  duplicate_blocked: number;
}

export interface ReviewQueueResponse {
  session: { id: string; status: string };
  can_review: boolean;
  drafts: ReviewDraft[];
}

export interface ReviewSummaryResponse {
  session_id: string;
  session_status: string;
  counts: DraftSummaryCounts;
}

export interface ReviewActionAck {
  type: "promote" | "discard";
  draft_id: string;
  status: string;
  actor_uid: string;
  acted_at: string;
}

export interface ReviewActionResponse {
  ok: boolean;
  draft_id: string;
  promoted_item_id: string | null;
  action_ack: ReviewActionAck;
}

export class DuplicateDraftPromotionError extends Error {
  duplicate: DraftDuplicateBlock;

  constructor(duplicate: DraftDuplicateBlock) {
    super("Draft is blocked by a duplicate receipt number");
    this.duplicate = duplicate;
  }
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const apiUrl = import.meta.env.VITE_CATALOGER_API_URL;
  if (!apiUrl) {
    throw new Error("VITE_CATALOGER_API_URL is not set. Add it to .env.local");
  }
  const token = await ensureFreshSession();
  return fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 409 &&
      (body as { error?: string }).error === "duplicate_blocked" &&
      (body as { duplicate?: DraftDuplicateBlock }).duplicate
    ) {
      throw new DuplicateDraftPromotionError((body as { duplicate: DraftDuplicateBlock }).duplicate);
    }
    throw new Error((body as { error?: string }).error ?? fallback);
  }
  return body as T;
}

export async function fetchReviewQueue(sessionId: string): Promise<ReviewQueueResponse> {
  const response = await apiFetch(`/sessions/${sessionId}/item-drafts`, { method: "GET" });
  return jsonOrThrow<ReviewQueueResponse>(response, "Could not load draft review queue");
}

export async function fetchReviewSummary(sessionId: string): Promise<ReviewSummaryResponse> {
  const response = await apiFetch(`/sessions/${sessionId}/item-drafts/summary`, { method: "GET" });
  return jsonOrThrow<ReviewSummaryResponse>(response, "Could not load draft summary");
}

export async function promoteDraft(
  draftId: string,
  fields: Partial<DraftFields>,
): Promise<ReviewActionResponse> {
  const response = await apiFetch(`/item-drafts/${draftId}/promote`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  return jsonOrThrow<ReviewActionResponse>(response, "Could not promote draft");
}

export async function discardDraft(draftId: string): Promise<ReviewActionResponse> {
  const response = await apiFetch(`/item-drafts/${draftId}/discard`, { method: "POST" });
  return jsonOrThrow<ReviewActionResponse>(response, "Could not discard draft");
}
