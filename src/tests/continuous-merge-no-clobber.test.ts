// Wave-0 RED (Phase 39 plan 01) — HEADLINE race: AI continuous-merge must yield to the user.
//
// D-06 compare-and-skip contract (Plan 39-03 implements):
//   mergeFieldsIntoItem(itemId, sessionId, fields) must
//     1. read the current item row -> capture per-field `valueAtRead` + the `updated_at` snapshot,
//     2. build the formatted AI patch,
//     3. write it through `preconditionUpdate` with a reconcile that, on a 0-row conflict,
//        DROPS every field whose fresh server value differs from `valueAtRead`
//        (i.e. the user changed it since the merge read) and re-applies the rest.
//
// Net effect proven here: a live user edit that lands between the merge's read and its write
// is NOT clobbered by the AI re-apply, while a field the user did NOT touch IS re-applied.
//
// Drives `mergeFieldsIntoItem` DIRECTLY (continuous recorder UI is dormant — CONTINUOUS_MODE_ENABLED=false, D-050).
// RED now: `mergeFieldsIntoItem` is not exported and the precondition/compare-skip path does not exist.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockNotifyError } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotifyError: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ supabase: { from: mockFrom } }));
vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: { getState: () => ({ notifyError: mockNotifyError }) },
}));
// mergeFieldsIntoItem may still touch the store for local refresh — keep it inert.
vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => ({
      updateItemField: vi.fn().mockResolvedValue(undefined),
      fetchItems: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

type MergeFieldsIntoItem = (
  itemId: string,
  sessionId: string,
  fields: Record<string, unknown>,
) => Promise<string[]>;
let mergeFieldsIntoItem: MergeFieldsIntoItem;

// Shared stateful supabase mock spanning the merge read + the preconditionUpdate write/re-read.
// Order of maybeSingle() reads: [0] merge's initial read, [1] preconditionUpdate's re-read on conflict.
function installMock(opts: {
  reads: Array<{ data: unknown; error: unknown }>;
  updateResults: Array<{ data: unknown; error: unknown }>;
}) {
  const updatePatches: Array<Record<string, unknown>> = [];
  let rd = 0;
  let up = 0;
  mockFrom.mockImplementation(() => ({
    update: (patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return {
        eq: () => ({
          eq: () => ({
            select: () =>
              Promise.resolve(opts.updateResults[up++] ?? { data: [], error: null }),
          }),
        }),
      };
    },
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve(opts.reads[rd++] ?? { data: null, error: null }),
        single: () =>
          Promise.resolve(opts.reads[rd++] ?? { data: null, error: null }),
      }),
    }),
  }));
  return { updatePatches };
}

describe("continuous-merge path (dormant — D-050): AI merge must not clobber a user edit (D-06)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = (await import("../services/geminiContinuous")) as Record<string, unknown>;
    mergeFieldsIntoItem = mod.mergeFieldsIntoItem as unknown as MergeFieldsIntoItem;
  });

  it("on a 0-row conflict, drops the field the user changed since the read, re-applies the rest", async () => {
    const ITEM_ID = "item-1";

    // Field values the AI saw when the merge began.
    const itemAtRead = {
      id: ITEM_ID,
      updated_at: "T0",
      title: "OLD AI TITLE",
      description: "old desc",
      condition: null,
      estimate: null,
      category: null,
      measurements: null,
      transcript: null,
      ai_status: "processing",
    };
    // After the read, the user edited the title; description is untouched. updated_at bumped.
    const freshAfterUserEdit = {
      ...itemAtRead,
      title: "USER TYPED THIS",
      updated_at: "T1",
    };

    const m = installMock({
      reads: [
        { data: itemAtRead, error: null }, // merge's initial read
        { data: freshAfterUserEdit, error: null }, // preconditionUpdate re-read on conflict
      ],
      updateResults: [
        { data: [], error: null }, // first write -> 0-row conflict
        { data: [freshAfterUserEdit], error: null }, // re-applied write -> success
      ],
    });

    // AI proposes new title + description; everything else null.
    await mergeFieldsIntoItem(ITEM_ID, "session-1", {
      title: "new ai title",
      description: "new ai description",
      condition: null,
      estimate: null,
      category: null,
      measurements: null,
      transcript: null,
      receipt_number: null,
    });

    expect(m.updatePatches.length).toBe(2);
    // First write carries the AI's title (the merge intended to set it).
    expect(m.updatePatches[0]).toHaveProperty("title");
    // Re-applied write: title is DROPPED (user changed it since read — AI yields, D-06)...
    expect(m.updatePatches[1]).not.toHaveProperty("title");
    // ...but description (which the user did NOT touch) is still re-applied.
    expect(m.updatePatches[1]).toHaveProperty("description");
  });
});
