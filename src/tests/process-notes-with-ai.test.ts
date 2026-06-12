import { describe, expect, it } from "vitest";
import type { NotePage } from "../db/types";
import { normalizeModelDrafts, notePagesBatchKey } from "../services/processNotesWithAi";

function page(pageUid: string, sortOrder: number): NotePage {
  return {
    pageUid,
    sessionId: "session-1",
    blob: new Blob(["full"], { type: "image/jpeg" }),
    thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    sortOrder,
    status: "captured",
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}

describe("photo note segmentation normalization", () => {
  it("uses ordered page UIDs as the stable idempotency key", () => {
    const pages = [page("p-b", 0), page("p-a", 1)];

    expect(notePagesBatchKey("session-1", pages)).toBe(
      "photo-notes:v1:session-1:p-b@0,p-a@1",
    );
  });

  it("blanks and flags fields below the confidence threshold", () => {
    const drafts = normalizeModelDrafts([page("p-1", 0)], {
      drafts: [
        {
          source_page_uids: ["p-1"],
          raw_ocr_text: "Walnut chair, maybe 200",
          fields: {
            title: { value: "Walnut chair", confidence: 0.92 },
            description: { value: "maybe a tall back", confidence: 0.4 },
            condition: { value: null, confidence: 1 },
            estimate: { value: "200", confidence: 0.59 },
            measurements: { value: null, confidence: 1 },
            category: { value: "FRN", confidence: 0.91 },
            transcript: { value: "Walnut chair, maybe 200", confidence: 0.88 },
            receipt_number: { value: "12345-1", confidence: 0.3 },
          },
        },
      ],
    });

    expect(drafts[0].fields.title).toBe("WALNUT CHAIR");
    expect(drafts[0].fields.description).toBeNull();
    expect(drafts[0].fields.estimate).toBeNull();
    expect(drafts[0].fields.receipt_number).toBeNull();
    expect(drafts[0].lowConfidenceFields).toEqual([
      "description",
      "estimate",
      "receipt_number",
    ]);
    expect(drafts[0].sourcePageRefs).toEqual([{ pageUid: "p-1", sortOrder: 0 }]);
  });
});
