// Wave-0 RED (Phase 39 plan 01) — optimistic-locking shared helper contract.
//
// Specs the `preconditionUpdate` helper that Plan 39-02 creates in
// `src/db/optimisticUpdate.ts` (does not exist yet — these tests are RED until then).
//
// Contract (Plan 39-02 implements to satisfy this):
//   export type ReconcileFn = (
//     freshRow: Record<string, unknown>,
//     intendedPatch: Record<string, unknown>,
//   ) => Record<string, unknown> | null;     // null/empty => nothing left to write
//
//   export async function preconditionUpdate(args: {
//     table: string;
//     id: string;
//     prevUpdatedAt: string | null | undefined;   // version token snapshot
//     patch: Record<string, unknown>;
//     reconcile?: ReconcileFn;   // default: re-apply intendedPatch verbatim (user-intent-preserving)
//     maxAttempts?: number;      // default 3
//   }): Promise<
//     | { status: "applied"; row: Record<string, unknown> }
//     | { status: "noop" }       // row vanished on re-read (deleted / RLS deny) — do NOT loop
//     | { status: "exhausted" }  // hit maxAttempts — surfaced via notifyError(message, retry)
//   >;
//
// Write idiom (mirrors the proven Phase-33 CAS in offlineQueue.ts:119-132):
//   supabase.from(table).update(patch).eq("id", id).eq("updated_at", prev).select()
//   → data.length === 0  (error: null)  IS the conflict signal (Pitfall 1: NOT an error return).
// Re-read idiom:
//   supabase.from(table).select("*").eq("id", id).maybeSingle()  → { data: freshRow | null }
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockNotifyError } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotifyError: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ supabase: { from: mockFrom } }));
vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: { getState: () => ({ notifyError: mockNotifyError }) },
}));

type PreconditionResult =
  | { status: "applied"; row: Record<string, unknown> }
  | { status: "noop" }
  | { status: "exhausted" };
type PreconditionUpdate = (args: {
  table: string;
  id: string;
  prevUpdatedAt: string | null | undefined;
  patch: Record<string, unknown>;
  reconcile?: (
    fresh: Record<string, unknown>,
    patch: Record<string, unknown>,
  ) => Record<string, unknown> | null;
  maxAttempts?: number;
}) => Promise<PreconditionResult>;

let preconditionUpdate: PreconditionUpdate;

// Scriptable supabase mock. `update().eq("id").eq("updated_at",T).select()` returns the
// next scripted update result and records the precondition token used; the re-read
// `select().eq().maybeSingle()` returns the next scripted fresh row.
function installMock(opts: {
  updateResults: Array<{ data: unknown; error: unknown }>;
  reReads: Array<{ data: unknown; error: unknown }>;
}) {
  const updateTokens: unknown[] = [];
  const updatePatches: Array<Record<string, unknown>> = [];
  let u = 0;
  let r = 0;
  mockFrom.mockImplementation(() => ({
    update: (patch: Record<string, unknown>) => {
      updatePatches.push(patch);
      return {
        eq: () => ({
          eq: (col2: string, val2: unknown) => {
            if (col2 === "updated_at") updateTokens.push(val2);
            return {
              select: () =>
                Promise.resolve(opts.updateResults[u++] ?? { data: [], error: null }),
            };
          },
        }),
      };
    },
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve(opts.reReads[r++] ?? { data: null, error: null }),
        single: () =>
          Promise.resolve(opts.reReads[r++] ?? { data: null, error: null }),
      }),
    }),
  }));
  return {
    updateTokens,
    updatePatches,
    get updateCount() {
      return u;
    },
  };
}

describe("preconditionUpdate (optimistic locking helper)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Module is absent in Wave 0 (RED). A computed specifier + @vite-ignore keeps vite's
    // static analyzer from failing the transform, so the file loads and each test fails
    // cleanly at the call site until Plan 39-02 creates the module (then GREEN, unchanged).
    const spec = "../db/" + "optimisticUpdate";
    const mod = (await import(/* @vite-ignore */ spec).catch(() => ({}))) as Record<string, unknown>;
    preconditionUpdate = mod.preconditionUpdate as PreconditionUpdate;
  });

  it("applies on the first try when the precondition matches (no conflict)", async () => {
    const m = installMock({
      updateResults: [{ data: [{ id: "i1", updated_at: "T1", title: "X" }], error: null }],
      reReads: [],
    });
    const res = await preconditionUpdate({
      table: "items",
      id: "i1",
      prevUpdatedAt: "T0",
      patch: { title: "X" },
    });
    expect(res.status).toBe("applied");
    expect(m.updateCount).toBe(1);
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("on a 0-row conflict re-reads and re-applies using the FRESH token, not the stale snapshot", async () => {
    const m = installMock({
      updateResults: [
        { data: [], error: null }, // attempt 1 -> conflict
        { data: [{ id: "i1", updated_at: "T2", title: "X" }], error: null }, // attempt 2 -> success
      ],
      reReads: [{ data: { id: "i1", updated_at: "T1", title: "server" }, error: null }],
    });
    const res = await preconditionUpdate({
      table: "items",
      id: "i1",
      prevUpdatedAt: "T0",
      patch: { title: "X" },
    });
    expect(res.status).toBe("applied");
    // Pitfall 4: the second write must use the refreshed token (T1), never the stale T0.
    expect(m.updateTokens).toEqual(["T0", "T1"]);
  });

  it("stops without looping when the re-read returns nothing (deleted / RLS-denied)", async () => {
    const m = installMock({
      updateResults: [{ data: [], error: null }],
      reReads: [{ data: null, error: null }],
    });
    const res = await preconditionUpdate({
      table: "items",
      id: "i1",
      prevUpdatedAt: "T0",
      patch: { title: "X" },
    });
    expect(res.status).toBe("noop");
    expect(m.updateCount).toBe(1); // did not keep looping
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("CR-01: a missing (undefined) token re-reads for a real token instead of dropping the .eq filter", async () => {
    // supabase-js drops `.eq("updated_at", undefined)`, which would collapse the
    // precondition to a bare `.eq("id")` (unconditional clobber). The helper must
    // re-read to obtain a token first, then write WITH the precondition.
    const m = installMock({
      updateResults: [{ data: [{ id: "i1", updated_at: "T9" }], error: null }],
      reReads: [{ data: { id: "i1", updated_at: "Tnow" }, error: null }],
    });
    const res = await preconditionUpdate({
      table: "items",
      id: "i1",
      prevUpdatedAt: undefined,
      patch: { title: "X" },
    });
    expect(res.status).toBe("applied");
    // The single write carried the re-read token — never an undefined (dropped) filter.
    expect(m.updateTokens).toEqual(["Tnow"]);
  });

  it("CR-01: a missing token whose row is gone on re-read is a noop, not an unconditional write", async () => {
    const m = installMock({
      updateResults: [],
      reReads: [{ data: null, error: null }],
    });
    const res = await preconditionUpdate({
      table: "items",
      id: "i1",
      prevUpdatedAt: undefined,
      patch: { title: "X" },
    });
    expect(res.status).toBe("noop");
    expect(m.updateCount).toBe(0); // never wrote without a precondition
  });

  it("CR-02: a transient error on the conflict re-read THROWS (not noop) so the caller keeps the queued edit", async () => {
    // The write-ahead flush deletes the entry on noop. A network blip on the
    // re-read must not masquerade as a gone-row noop, or the offline edit is
    // silently lost — the exact failure this primitive guards against.
    const m = installMock({
      updateResults: [{ data: [], error: null }], // attempt 1 -> 0-row conflict
      reReads: [{ data: null, error: { message: "network down" } }], // re-read errors
    });
    await expect(
      preconditionUpdate({
        table: "items",
        id: "i1",
        prevUpdatedAt: "T0",
        patch: { title: "X" },
      }),
    ).rejects.toMatchObject({ message: "network down" });
    expect(m.updateCount).toBe(1); // attempted the write once, then threw on the errored re-read
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("CR-02: a transient error on the missing-token re-read THROWS instead of noop (no silent drop)", async () => {
    const m = installMock({
      updateResults: [],
      reReads: [{ data: null, error: { message: "network down" } }],
    });
    await expect(
      preconditionUpdate({
        table: "items",
        id: "i1",
        prevUpdatedAt: undefined,
        patch: { title: "X" },
      }),
    ).rejects.toMatchObject({ message: "network down" });
    expect(m.updateCount).toBe(0); // never wrote without a precondition token
  });

  it("surfaces notifyError(message, retry) after 3 failed attempts (exhaustion)", async () => {
    const m = installMock({
      updateResults: [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ],
      reReads: [
        { data: { id: "i1", updated_at: "T1" }, error: null },
        { data: { id: "i1", updated_at: "T2" }, error: null },
        { data: { id: "i1", updated_at: "T3" }, error: null },
      ],
    });
    const res = await preconditionUpdate({
      table: "items",
      id: "i1",
      prevUpdatedAt: "T0",
      patch: { title: "X" },
      maxAttempts: 3,
    });
    expect(res.status).toBe("exhausted");
    expect(m.updateCount).toBe(3);
    expect(mockNotifyError).toHaveBeenCalledTimes(1);
    expect(mockNotifyError).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
  });
});
