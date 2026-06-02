import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";

// --- Mocks ---
const { mockFrom } = vi.hoisted(
  () => {
    const mockFrom = vi.fn();

    return { mockFrom };
  },
);

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock uiStore for the hook
vi.mock("../stores/uiStore", () => ({
  useUIStore: vi.fn((selector: (s: { isOnline: boolean }) => boolean) =>
    selector({ isOnline: true }),
  ),
}));

// Phase 39: the precondition flush surfaces exhausted conflicts via notifyError.
vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: { getState: () => ({ notifyError: vi.fn() }) },
}));

import {
  enqueueWrite,
  processWriteAheadQueue,
  getPendingCount,
  hasPendingForItem,
} from "../hooks/useWriteAheadQueue";

describe("write-ahead queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  describe("enqueueWrite", () => {
    it("adds entry to db.writeAheadQueue with createdAt timestamp for sessions insert", async () => {
      await enqueueWrite({
        table: "sessions",
        operation: "insert",
        payload: { name: "Test Session" },
      });

      const entries = await db.writeAheadQueue.toArray();
      expect(entries).toHaveLength(1);
      expect(entries[0].table).toBe("sessions");
      expect(entries[0].operation).toBe("insert");
      expect(entries[0].payload).toEqual({ name: "Test Session" });
      expect(entries[0].createdAt).toBeInstanceOf(Date);
    });

    it("adds entry for items update operation", async () => {
      await enqueueWrite({
        table: "items",
        operation: "update",
        payload: { id: "uuid-123", title: "new" },
      });

      const entries = await db.writeAheadQueue.toArray();
      expect(entries).toHaveLength(1);
      expect(entries[0].table).toBe("items");
      expect(entries[0].operation).toBe("update");
      expect(entries[0].payload).toEqual({ id: "uuid-123", title: "new" });
    });
  });

  describe("processWriteAheadQueue", () => {
    it("drains entries in FIFO order (oldest createdAt first)", async () => {
      const processOrder: string[] = [];

      // Add entries with different timestamps
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "Second" },
        createdAt: new Date("2026-01-02"),
      });
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "First" },
        createdAt: new Date("2026-01-01"),
      });

      mockFrom.mockImplementation(() => ({
        insert: vi.fn().mockImplementation((payload: unknown) => {
          processOrder.push(
            (payload as Record<string, unknown>).name as string,
          );
          return { error: null };
        }),
      }));

      await processWriteAheadQueue();

      expect(processOrder).toEqual(["First", "Second"]);
    });

    it("calls supabase.from(entry.table).insert(entry.payload) for 'insert' operations", async () => {
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "New Session" },
        createdAt: new Date(),
      });

      const mockInsertFn = vi.fn().mockReturnValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsertFn });

      await processWriteAheadQueue();

      expect(mockFrom).toHaveBeenCalledWith("sessions");
      expect(mockInsertFn).toHaveBeenCalledWith({ name: "New Session" });
    });

    it("calls supabase.from(entry.table).update(entry.payload).eq('id', payload.id) for 'update' operations", async () => {
      await db.writeAheadQueue.add({
        table: "items",
        operation: "update",
        payload: { id: "uuid-1", title: "Updated" },
        createdAt: new Date(),
      });

      const mockEqFn = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValue({ update: mockUpdateFn });

      await processWriteAheadQueue();

      expect(mockFrom).toHaveBeenCalledWith("items");
      expect(mockUpdateFn).toHaveBeenCalledWith({ title: "Updated" });
      expect(mockEqFn).toHaveBeenCalledWith("id", "uuid-1");
    });

    it("calls supabase.from(entry.table).delete().eq('id', payload.id) for 'delete' operations", async () => {
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "delete",
        payload: { id: "uuid-delete" },
        createdAt: new Date(),
      });

      const mockEqFn = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteFn = vi.fn().mockReturnValue({ eq: mockEqFn });
      mockFrom.mockReturnValue({ delete: mockDeleteFn });

      await processWriteAheadQueue();

      expect(mockFrom).toHaveBeenCalledWith("sessions");
      expect(mockDeleteFn).toHaveBeenCalled();
      expect(mockEqFn).toHaveBeenCalledWith("id", "uuid-delete");
    });

    it("removes entry from Dexie table after successful Supabase call", async () => {
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "Test" },
        createdAt: new Date(),
      });

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({ error: null }),
      });

      expect(await db.writeAheadQueue.count()).toBe(1);
      await processWriteAheadQueue();
      expect(await db.writeAheadQueue.count()).toBe(0);
    });

    it("stops on first failure (preserves ordering)", async () => {
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "Will Fail" },
        createdAt: new Date("2026-01-01"),
      });
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "Should Not Process" },
        createdAt: new Date("2026-01-02"),
      });

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({ error: { message: "Network error" } }),
      });

      await processWriteAheadQueue();

      // Both entries should still be in the queue (first failed, second not attempted)
      expect(await db.writeAheadQueue.count()).toBe(2);
    });

    it("permanent failure drops the failing entry + same-item dependents and CONTINUES the drain", async () => {
      // Entry 1: insert items/uuid-perm -> permanent failure (HTTP 400)
      await db.writeAheadQueue.add({
        table: "items",
        operation: "insert",
        payload: { id: "uuid-perm", title: "bad" },
        createdAt: new Date("2026-01-01"),
      });
      // Entry 2: dependent update on the SAME item -> must be dropped with the failing insert
      await db.writeAheadQueue.add({
        table: "items",
        operation: "update",
        payload: { id: "uuid-perm", title: "still bad" },
        createdAt: new Date("2026-01-02"),
      });
      // Entry 3: unrelated insert that MUST still process after the drop
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "Unrelated" },
        createdAt: new Date("2026-01-03"),
      });

      const processed: string[] = [];
      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockImplementation((payload: unknown) => {
          const p = payload as Record<string, unknown>;
          if (table === "items" && p.id === "uuid-perm") {
            // Permanent: "Proxy returned HTTP 400: validation"
            return { error: { message: "Proxy returned HTTP 400: validation" } };
          }
          processed.push((p.name as string) ?? (p.id as string));
          return { error: null };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }));

      await processWriteAheadQueue();

      // Failing insert + same-item dependent update dropped; unrelated entry processed + removed.
      expect(processed).toEqual(["Unrelated"]);
      expect(await db.writeAheadQueue.count()).toBe(0);
    });

    it("transient failure halts the drain and leaves all remaining entries in FIFO order", async () => {
      await db.writeAheadQueue.add({
        table: "items",
        operation: "insert",
        payload: { id: "uuid-trans", title: "first" },
        createdAt: new Date("2026-01-01"),
      });
      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: { name: "Later" },
        createdAt: new Date("2026-01-02"),
      });

      mockFrom.mockReturnValue({
        // "Proxy returned HTTP 503" classifies as transient -> halt-and-backoff
        insert: vi
          .fn()
          .mockReturnValue({ error: { message: "Proxy returned HTTP 503: upstream" } }),
      });

      await processWriteAheadQueue();

      // Failing entry + later entry remain; FIFO order preserved.
      const remaining = await db.writeAheadQueue.orderBy("createdAt").toArray();
      expect(remaining).toHaveLength(2);
      expect((remaining[0].payload as Record<string, unknown>).id).toBe("uuid-trans");
      expect((remaining[1].payload as Record<string, unknown>).name).toBe("Later");
    });

    it("WR-05: a transient failure self-reschedules a single delayed re-drain", async () => {
      await db.writeAheadQueue.add({
        table: "items",
        operation: "insert",
        payload: { id: "uuid-trans", title: "first" },
        createdAt: new Date("2026-01-01"),
      });

      mockFrom.mockReturnValue({
        insert: vi
          .fn()
          .mockReturnValue({ error: { message: "Proxy returned HTTP 503: upstream" } }),
      });

      // Track live timers so we can assert at most one re-drain is ever pending
      // (no pile-up), and no real timer leaks into a later test.
      let nextId = 0;
      const live = new Set<number>();
      const setTimeoutSpy = vi
        .spyOn(globalThis, "setTimeout")
        .mockImplementation(((_cb: unknown, delay?: number) => {
          if (typeof delay === "number" && delay > 0) {
            nextId += 1;
            live.add(nextId);
            return nextId as unknown as ReturnType<typeof setTimeout>;
          }
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout);
      const clearTimeoutSpy = vi
        .spyOn(globalThis, "clearTimeout")
        .mockImplementation(((id?: unknown) => {
          if (typeof id === "number") live.delete(id);
        }) as typeof clearTimeout);
      try {
        await processWriteAheadQueue();

        // Transient halt scheduled a delayed re-drain so the queue is not
        // stranded until an unrelated online/enqueue/mount event.
        expect(nextId).toBeGreaterThanOrEqual(1);
        expect(live.size).toBe(1);

        // A second drain that fails again supersedes the pending timer and
        // reschedules — there is never more than one pending re-drain.
        await processWriteAheadQueue();
        expect(live.size).toBe(1);
      } finally {
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
      }
    });
  });

  describe("getPendingCount", () => {
    it("returns number of entries in writeAheadQueue", async () => {
      expect(await getPendingCount()).toBe(0);

      await db.writeAheadQueue.add({
        table: "sessions",
        operation: "insert",
        payload: {},
        createdAt: new Date(),
      });
      await db.writeAheadQueue.add({
        table: "items",
        operation: "update",
        payload: {},
        createdAt: new Date(),
      });

      expect(await getPendingCount()).toBe(2);
    });
  });

  describe("hasPendingForItem", () => {
    it("returns true if queue has entry with payload.id matching itemId", async () => {
      await db.writeAheadQueue.add({
        table: "items",
        operation: "update",
        payload: { id: "target-item" },
        createdAt: new Date(),
      });

      expect(await hasPendingForItem("target-item")).toBe(true);
    });

    it("returns false if no matching item in queue", async () => {
      await db.writeAheadQueue.add({
        table: "items",
        operation: "update",
        payload: { id: "other-item" },
        createdAt: new Date(),
      });

      expect(await hasPendingForItem("non-existent")).toBe(false);
    });
  });
});

// Wave-0 RED (Phase 39 plan 01) — offline write-ahead flush must honor the optimistic-locking
// precondition (D-04). Plan 39-03 turns these GREEN:
//   - enqueue captures the item's `updated_at` snapshot into the payload (done by the caller);
//   - on flush the items-update branch applies `.eq("updated_at", snapshot).select()` (precondition,
//     NOT a SET field — the trigger owns the bump);
//   - a 0-row flush routes through reconcile and does NOT delete the queue entry (Pitfall 5 — a
//     silent delete on a precondition miss is a lost write);
//   - a legacy entry with NO `updated_at` snapshot re-reads the row first, then preconditions
//     (fallback — not an unconditional write, not a crash) (Pitfall 6).
describe("write-ahead queue — Phase 39 optimistic-locking precondition on flush", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.writeAheadQueue.clear();
  });

  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("applies the payload's updated_at snapshot as a precondition (WHERE) + select, not as a SET field", async () => {
    await db.writeAheadQueue.add({
      table: "items",
      operation: "update",
      payload: { id: "i1", title: "new", updated_at: "T0" },
      createdAt: new Date(),
    });

    const setPatches: Array<Record<string, unknown>> = [];
    const eqCalls: Array<[string, unknown]> = [];
    const selectSpy = vi.fn().mockResolvedValue({ data: [{ id: "i1" }], error: null });
    mockFrom.mockImplementation(() => ({
      update: (patch: Record<string, unknown>) => {
        setPatches.push(patch);
        return {
          eq: (c1: string, v1: unknown) => {
            eqCalls.push([c1, v1]);
            const afterFirstEq = {
              eq: (c2: string, v2: unknown) => {
                eqCalls.push([c2, v2]);
                return { select: selectSpy };
              },
              select: selectSpy,
            };
            // Thenable so the legacy single-eq path can `await` it without crashing.
            return Object.assign(Promise.resolve({ error: null }), afterFirstEq);
          },
        };
      },
      select: () => ({
        eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "i1", updated_at: "T0" }, error: null }) }),
      }),
    }));

    await processWriteAheadQueue();

    expect(eqCalls).toContainEqual(["updated_at", "T0"]);
    expect(selectSpy).toHaveBeenCalled();
    expect(setPatches[0]).not.toHaveProperty("updated_at");
    expect(setPatches[0]).toHaveProperty("title");
  });

  it("does NOT delete the queue entry when the precondition keeps missing (Pitfall 5 — no silent lost write)", async () => {
    await db.writeAheadQueue.add({
      table: "items",
      operation: "update",
      payload: { id: "i1", title: "new", updated_at: "T0" },
      createdAt: new Date(),
    });

    // Every precondition write misses (0-row); re-read always returns a row so the helper
    // loops to exhaustion rather than treating the row as gone — the entry must survive.
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => {
          const afterFirstEq = {
            eq: () => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }),
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
          return Object.assign(Promise.resolve({ error: null }), afterFirstEq);
        },
      }),
      select: () => ({
        eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "i1", updated_at: "T9" }, error: null }) }),
      }),
    }));

    expect(await db.writeAheadQueue.count()).toBe(1);
    await processWriteAheadQueue();
    expect(await db.writeAheadQueue.count()).toBe(1); // retained for a later retry, not silently dropped
  });

  it("a legacy entry without an updated_at snapshot re-reads the row first, then preconditions (fallback)", async () => {
    await db.writeAheadQueue.add({
      table: "items",
      operation: "update",
      payload: { id: "i1", title: "new" }, // NO updated_at snapshot (pre-Phase-39 entry)
      createdAt: new Date(),
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "i1", updated_at: "Tnow" }, error: null });
    const eqCalls: Array<[string, unknown]> = [];
    const selectSpy = vi.fn().mockResolvedValue({ data: [{ id: "i1" }], error: null });
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: (c1: string, v1: unknown) => {
          eqCalls.push([c1, v1]);
          const afterFirstEq = {
            eq: (c2: string, v2: unknown) => {
              eqCalls.push([c2, v2]);
              return { select: selectSpy };
            },
            select: selectSpy,
          };
          return Object.assign(Promise.resolve({ error: null }), afterFirstEq);
        },
      }),
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }));

    await processWriteAheadQueue();

    expect(maybeSingle).toHaveBeenCalled(); // re-read happened (fallback, not unconditional)
    expect(eqCalls).toContainEqual(["updated_at", "Tnow"]); // precondition applied with the re-read token
    expect(await db.writeAheadQueue.count()).toBe(0); // resolved + removed
  });
});
