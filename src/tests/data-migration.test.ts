import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";
import type { Session, HouseVisitItem, SaleItem } from "../db/types";

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockFrom, mockInsert, mockSelect, mockSingle, mockAddIdMapping } =
  vi.hoisted(() => {
    const mockSingle = vi.fn();
    const mockSelect = vi.fn();
    const mockInsert = vi.fn();
    const mockFrom = vi.fn();
    const mockAddIdMapping = vi.fn();

    return { mockFrom, mockInsert, mockSelect, mockSingle, mockAddIdMapping };
  });

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

// addIdMapping is spied (assertions at :212/:276) but must ALSO write real Dexie
// so getNewIdByOldId and the ground-truth needsMigration() cleanup gate (D-09)
// observe the mappings within a run. getNewIdByOldId stays real (indexed lookup).
// The impl clones before .add() — Dexie mutates its arg with the auto `id`, which
// would otherwise pollute the spy's captured call args (toHaveBeenCalledWith).
vi.mock("../db/idMapping", async (importActual) => {
  const actual = await importActual<typeof import("../db/idMapping")>();
  mockAddIdMapping.mockImplementation((m) => actual.addIdMapping({ ...m }));
  return {
    addIdMapping: mockAddIdMapping,
    getNewIdByOldId: actual.getNewIdByOldId,
  };
});

import { needsMigration, migrateToSupabase } from "../db/migration";

// Helper: set up supabase insert chain
function setupInsertChain(
  data: Record<string, unknown> | null = null,
  error: unknown = null,
) {
  const chain = {
    insert: mockInsert,
    select: mockSelect,
    single: mockSingle,
  };
  mockInsert.mockReturnValue(chain);
  mockSelect.mockReturnValue(chain);
  mockSingle.mockResolvedValue({ data, error });
  mockFrom.mockReturnValue(chain);
  return chain;
}

// Helper: create a Dexie session
function makeDexieSession(overrides: Partial<Session> = {}): Omit<Session, "id"> {
  return {
    name: "Test Session",
    mode: "house",
    status: "active",
    notes: "some notes",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    ...overrides,
  };
}

// Helper: create a Dexie house item
function makeDexieHouseItem(
  sessionId: number,
  overrides: Partial<HouseVisitItem> = {},
): Omit<HouseVisitItem, "id"> {
  return {
    sessionId,
    title: "Vase",
    description: "Blue ceramic vase",
    condition: "Good",
    estimate: "$100",
    measurements: "12x6",
    category: "Ceramics",
    transcript: "A blue vase",
    aiStatus: "done",
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// Helper: create a Dexie sale item
function makeDexieSaleItem(
  sessionId: number,
  overrides: Partial<SaleItem> = {},
): Omit<SaleItem, "id"> {
  return {
    sessionId,
    receiptNumber: "R001",
    title: "Painting",
    description: "Oil painting",
    condition: "Fair",
    estimate: "$500",
    measurements: "24x36",
    category: "Art",
    transcript: "An oil painting",
    aiStatus: "done",
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("data migration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-bind the real-writing impl after clearAllMocks wiped it.
    const actual =
      await vi.importActual<typeof import("../db/idMapping")>("../db/idMapping");
    mockAddIdMapping.mockImplementation((m) => actual.addIdMapping({ ...m }));
  });

  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  describe("needsMigration", () => {
    it("returns true when Dexie sessions table has entries AND idMapping table is empty", async () => {
      await db.sessions.add(makeDexieSession());
      const result = await needsMigration();
      expect(result).toBe(true);
    });

    it("returns true when a session is mapped but an item remains unmapped (per-row, D-01)", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      await db.houseVisitItems.add(makeDexieHouseItem(sessId!));
      // Session got a mapping from a prior partial run; its item did not.
      await db.idMapping.add({
        oldId: sessId!,
        newId: "uuid-sess",
        type: "session",
      });
      const result = await needsMigration();
      expect(result).toBe(true);
    });

    it("returns false when every non-deleted session AND item is mapped", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      const itemId = await db.houseVisitItems.add(makeDexieHouseItem(sessId!));
      await db.idMapping.add({
        oldId: sessId!,
        newId: "uuid-sess",
        type: "session",
      });
      await db.idMapping.add({
        oldId: itemId!,
        newId: "uuid-item",
        type: "item",
        itemTable: "house",
      });
      const result = await needsMigration();
      expect(result).toBe(false);
    });

    it("returns false when Dexie sessions table is empty (nothing to migrate)", async () => {
      const result = await needsMigration();
      expect(result).toBe(false);
    });
  });

  describe("migrateToSupabase", () => {
    it("skips sessions with deletedAt set (soft-deleted sessions not migrated)", async () => {
      await db.sessions.add(
        makeDexieSession({ deletedAt: new Date("2026-01-05") }),
      );
      await db.houseVisitItems.add(makeDexieHouseItem(1));

      // Session insert should NOT be called since session is soft-deleted
      setupInsertChain({ id: "new-uuid" });

      const onProgress = vi.fn();
      const result = await migrateToSupabase("user-123", onProgress);

      // No sessions inserted (soft-deleted skipped)
      expect(mockFrom).not.toHaveBeenCalledWith("sessions");
      expect(result.migrated).toBe(0);
    });

    it("inserts session to Supabase with created_by=userId, mode, name, notes, status='active'", async () => {
      await db.sessions.add(
        makeDexieSession({ name: "My Session", mode: "house", notes: "Notes" }),
      );

      // Set up the chain so it returns session then responds to item queries
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "supabase-sess-1" },
                  error: null,
                }),
              }),
            }),
          };
        }
        // items table
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `supabase-item-${++callCount}` },
                error: null,
              }),
            }),
          }),
        };
      });

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      // Verify supabase.from('sessions').insert was called
      expect(mockFrom).toHaveBeenCalledWith("sessions");
    });

    it("creates ID mapping entry for each migrated session (oldId -> newId, type='session')", async () => {
      const sessId = await db.sessions.add(makeDexieSession());

      mockFrom.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "supabase-sess-1" },
              error: null,
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      expect(mockAddIdMapping).toHaveBeenCalledWith({
        oldId: sessId,
        newId: "supabase-sess-1",
        type: "session",
      });
    });

    it("inserts house items with mode='house' and sale items with mode='sale' to unified items table", async () => {
      const sessId = await db.sessions.add(makeDexieSession({ mode: "house" }));
      await db.houseVisitItems.add(makeDexieHouseItem(sessId!));
      await db.saleItems.add(makeDexieSaleItem(sessId!));

      const insertCalls: Array<{ table: string; payload: unknown }> = [];
      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockImplementation((payload: unknown) => {
          insertCalls.push({ table, payload });
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `uuid-${insertCalls.length}` },
                error: null,
              }),
            }),
          };
        }),
      }));

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      // Find item inserts (not session inserts)
      const itemInserts = insertCalls.filter((c) => c.table === "items");
      expect(itemInserts).toHaveLength(2);

      const houseInsert = itemInserts.find(
        (c) => (c.payload as Record<string, unknown>).mode === "house",
      );
      const saleInsert = itemInserts.find(
        (c) => (c.payload as Record<string, unknown>).mode === "sale",
      );
      expect(houseInsert).toBeDefined();
      expect(saleInsert).toBeDefined();
    });

    it("creates ID mapping for each migrated item (oldId -> newId, type='item')", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      const itemId = await db.houseVisitItems.add(makeDexieHouseItem(sessId!));

      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: table === "sessions" ? "supabase-sess-1" : "supabase-item-1",
              },
              error: null,
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      expect(mockAddIdMapping).toHaveBeenCalledWith({
        oldId: itemId,
        newId: "supabase-item-1",
        type: "item",
        itemTable: "house",
      });
    });

    it("calls onProgress callback with (current, total) counts", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      await db.houseVisitItems.add(makeDexieHouseItem(sessId!));
      await db.houseVisitItems.add(
        makeDexieHouseItem(sessId!, { sortOrder: 1, title: "Chair" }),
      );

      let itemCounter = 0;
      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id:
                  table === "sessions"
                    ? "supabase-sess-1"
                    : `supabase-item-${++itemCounter}`,
              },
              error: null,
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      // Should have called onProgress with incrementing current and total=2
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it("returns { migrated, alreadyMigrated, failed, partial } counts", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      await db.houseVisitItems.add(makeDexieHouseItem(sessId!));

      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: table === "sessions" ? "sess-1" : "item-1",
              },
              error: null,
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      const result = await migrateToSupabase("user-123", onProgress);

      expect(result).toEqual({
        migrated: 1,
        alreadyMigrated: 0,
        failed: 0,
        partial: false,
      });
    });

    it("after successful migration, Dexie sessions/houseVisitItems/saleItems/exportHistory tables are cleared", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      await db.houseVisitItems.add(makeDexieHouseItem(sessId!));
      await db.saleItems.add(makeDexieSaleItem(sessId!));
      await db.exportHistory.add({
        sessionId: sessId!,
        sessionName: "Test",
        sessionMode: "house",
        itemCount: 1,
        exportedAt: new Date(),
      });

      mockFrom.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: `uuid-${Math.random()}` },
              error: null,
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      expect(await db.sessions.count()).toBe(0);
      expect(await db.houseVisitItems.count()).toBe(0);
      expect(await db.saleItems.count()).toBe(0);
      expect(await db.exportHistory.count()).toBe(0);
    });

    it("Dexie photos, audio, idMapping tables are NOT cleared after migration", async () => {
      await db.sessions.add(makeDexieSession());

      // Add some photos and audio
      await db.photos.add({
        itemId: 1,
        itemType: "house",
        blob: new Blob(["photo"]),
        sortOrder: 0,
        createdAt: new Date(),
      });
      await db.audio.add({
        itemId: 1,
        itemType: "house",
        blob: new Blob(["audio"]),
        mimeType: "audio/webm",
        createdAt: new Date(),
      });

      mockFrom.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: `uuid-${Math.random()}` },
              error: null,
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      await migrateToSupabase("user-123", onProgress);

      expect(await db.photos.count()).toBe(1);
      expect(await db.audio.count()).toBe(1);
      // idMapping will have entries from addIdMapping calls (which is mocked)
    });

    it("on individual item insert error, item is counted in failed, migration continues", async () => {
      const sessId = await db.sessions.add(makeDexieSession());
      await db.houseVisitItems.add(makeDexieHouseItem(sessId!));
      await db.houseVisitItems.add(
        makeDexieHouseItem(sessId!, { sortOrder: 1, title: "Chair" }),
      );

      let itemCallCount = 0;
      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              if (table === "sessions") {
                return Promise.resolve({
                  data: { id: "supabase-sess-1" },
                  error: null,
                });
              }
              itemCallCount++;
              if (itemCallCount === 1) {
                // First item fails
                return Promise.resolve({
                  data: null,
                  error: { message: "Insert failed" },
                });
              }
              // Second item succeeds
              return Promise.resolve({
                data: { id: "supabase-item-2" },
                error: null,
              });
            }),
          }),
        }),
      }));

      const onProgress = vi.fn();
      const result = await migrateToSupabase("user-123", onProgress);

      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(1);
    });

    it("preserves failed records on partial migration (DAT-1)", async () => {
      // Session A: insert OK, has one good item + one failing item.
      const sessAId = await db.sessions.add(
        makeDexieSession({ name: "SessA" }),
      );
      const goodHouseItemId = await db.houseVisitItems.add(
        makeDexieHouseItem(sessAId!, { title: "GoodItem", sortOrder: 0 }),
      );
      const failedHouseItemId = await db.houseVisitItems.add(
        makeDexieHouseItem(sessAId!, { title: "FailItem", sortOrder: 1 }),
      );

      // Session B: session insert itself fails (early continue path).
      const sessBId = await db.sessions.add(
        makeDexieSession({ name: "FailSession" }),
      );
      const orphanItemId = await db.houseVisitItems.add(
        makeDexieHouseItem(sessBId!, { title: "OrphanItem", sortOrder: 0 }),
      );

      // Session C: fully clean — session + one sale item both succeed.
      const sessCId = await db.sessions.add(
        makeDexieSession({ name: "SessC" }),
      );
      const goodSaleItemId = await db.saleItems.add(
        makeDexieSaleItem(sessCId!, { title: "GoodSale", sortOrder: 0 }),
      );

      // exportHistory entry — must survive because the run is partial.
      await db.exportHistory.add({
        sessionId: sessAId!,
        sessionName: "SessA",
        sessionMode: "house",
        itemCount: 2,
        exportedAt: new Date(),
      });

      let itemSeq = 0;
      mockFrom.mockImplementation((table: string) => ({
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              if (table === "sessions") {
                // FailSession's insert fails; others succeed.
                if (payload.name === "FailSession") {
                  return Promise.resolve({
                    data: null,
                    error: { message: "session insert failed" },
                  });
                }
                return Promise.resolve({
                  data: { id: `sess-${payload.name}` },
                  error: null,
                });
              }
              // items table: the item titled "FailItem" fails.
              if (payload.title === "FailItem") {
                return Promise.resolve({
                  data: null,
                  error: { message: "item insert failed" },
                });
              }
              return Promise.resolve({
                data: { id: `item-${++itemSeq}` },
                error: null,
              });
            }),
          }),
        })),
      }));

      const onProgress = vi.fn();
      const result = await migrateToSupabase("user-123", onProgress);

      // (a) partial run reported.
      // FailItem (1) + OrphanItem under FailSession (1) failed = 2.
      expect(result.failed).toBe(2);
      expect(result.migrated).toBe(2); // GoodItem + GoodSale
      expect(result.partial).toBe(true);

      // (b) failed records remain in Dexie.
      const failedItem = await db.houseVisitItems.get(failedHouseItemId!);
      expect(failedItem).toBeDefined();
      expect(failedItem?.title).toBe("FailItem");

      const orphanItem = await db.houseVisitItems.get(orphanItemId!);
      expect(orphanItem).toBeDefined();
      expect(orphanItem?.title).toBe("OrphanItem");

      // Failed session B (insert failed) is preserved.
      const failedSession = await db.sessions.get(sessBId!);
      expect(failedSession).toBeDefined();
      expect(failedSession?.name).toBe("FailSession");

      // (c) successfully migrated items were removed.
      expect(await db.houseVisitItems.get(goodHouseItemId!)).toBeUndefined();
      expect(await db.saleItems.get(goodSaleItemId!)).toBeUndefined();

      // (d) session A had a failing child item → its row must remain.
      const sessionAStillThere = await db.sessions.get(sessAId!);
      expect(sessionAStillThere).toBeDefined();
      expect(sessionAStillThere?.name).toBe("SessA");

      // Session C was fully clean → removed.
      expect(await db.sessions.get(sessCId!)).toBeUndefined();

      // (e) exportHistory NOT cleared on a partial run.
      expect(await db.exportHistory.count()).toBe(1);
    });
  });
});
