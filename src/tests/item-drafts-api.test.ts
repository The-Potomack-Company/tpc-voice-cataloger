import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DuplicateDraftBatchError,
  persistItemDraftBatch,
  type ItemDraftPayload,
} from "../services/itemDraftsApi";

vi.mock("../lib/authGuard", () => ({
  ensureFreshSession: vi.fn().mockResolvedValue("firebase-token"),
}));

const draft: ItemDraftPayload = {
  pageContentKey: "sha256:page-1",
  pageSegmentIndex: 0,
  sourcePageRefs: [{ pageUid: "page-1", sortOrder: 0 }],
  rawOcrText: "Walnut chair",
  fields: {
    title: "WALNUT CHAIR",
    description: null,
    condition: null,
    estimate: null,
    measurements: null,
    category: "FRN",
    transcript: "Walnut chair",
    receipt_number: null,
  },
  fieldConfidence: {
    title: 0.9,
    description: 1,
    condition: 1,
    estimate: 1,
    measurements: 1,
    category: 0.9,
    transcript: 0.9,
    receipt_number: 1,
  },
  lowConfidenceFields: [],
};

describe("item draft API client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CATALOGER_API_URL", "https://cataloger-api.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("persists a batch through cataloger-api with a Firebase bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ draftCount: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await persistItemDraftBatch({
      sessionId: "session-1",
      batchKey: "batch-1",
      pages: [{ pageUid: "page-1", sortOrder: 0 }],
      drafts: [draft],
    });

    expect(result).toEqual({ draftCount: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cataloger-api.test/item-draft-batches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer firebase-token" }),
      }),
    );
  });

  it("surfaces duplicate batches as a typed error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: "Draft batch already processed" }),
    }));

    await expect(
      persistItemDraftBatch({
        sessionId: "session-1",
        batchKey: "batch-1",
        pages: [{ pageUid: "page-1", sortOrder: 0 }],
        drafts: [draft],
      }),
    ).rejects.toBeInstanceOf(DuplicateDraftBatchError);
  });
});
