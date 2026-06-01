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
