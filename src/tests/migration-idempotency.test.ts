import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";
import type { Session, HouseVisitItem, SaleItem } from "../db/types";

// SC2 + SC4: idempotent retry-after-partial. Unlike data-migration.test.ts, this
// file does NOT mock ../db/idMapping — addIdMapping/getNewIdByOldId hit real
// fake-indexeddb so the reverse-lookup guard is genuinely exercised. Supabase is
// mocked via a per-run insert dispatcher whose failure set shrinks between runs.

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

import { needsMigration, migrateToSupabase } from "../db/migration";

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

function makeDexieHouseItem(
  sessionId: number,
  overrides: Partial<HouseVisitItem> = {},
): Omit<HouseVisitItem, "id"> {
  return {
    sessionId,
    title: "Vase",
    sortOrder: 0,
    aiStatus: "done",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeDexieSaleItem(
  sessionId: number,
  overrides: Partial<SaleItem> = {},
): Omit<SaleItem, "id"> {
  return {
    sessionId,
    receiptNumber: "R001",
    title: "Painting",
    sortOrder: 0,
    aiStatus: "done",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// Build a Supabase insert mock. `failTitles` controls which item titles fail;
// shrinking the set between runs simulates a transient failure clearing. Tracks
// per-table insert call counts so the no-duplicate assertion can read them.
function installSupabaseMock(failTitles: Set<string>) {
  const counts = { sessions: 0, items: 0 };
  let seq = 0;
  mockFrom.mockImplementation((table: string) => ({
    insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(() => {
          if (table === "sessions") {
            counts.sessions++;
            return Promise.resolve({
              data: { id: `sess-${payload.name}-${counts.sessions}` },
              error: null,
            });
          }
          counts.items++;
          if (failTitles.has(payload.title as string)) {
            return Promise.resolve({
              data: null,
              error: { message: "item insert failed" },
            });
          }
          return Promise.resolve({ data: { id: `item-${++seq}` }, error: null });
        }),
      }),
    })),
  }));
  return counts;
}

describe("migration idempotency (SC2/SC4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("retry-after-partial: 0 duplicate sessions, 0 duplicate items, ground-truth cleanup", async () => {
    // One session with a good item + a (transiently) failing item, plus a sale
    // item with the SAME integer id as the house item — exercises the house/sale
    // id-collision guard.
    const sessId = await db.sessions.add(makeDexieSession({ name: "SessA" }));
    await db.houseVisitItems.add(
      makeDexieHouseItem(sessId!, { title: "GoodHouse", sortOrder: 0 }),
    );
    await db.houseVisitItems.add(
      makeDexieHouseItem(sessId!, { title: "FailHouse", sortOrder: 1 }),
    );
    await db.saleItems.add(
      makeDexieSaleItem(sessId!, { title: "GoodSale", sortOrder: 0 }),
    );

    await db.exportHistory.add({
      sessionId: sessId!,
      sessionName: "SessA",
      sessionMode: "house",
      itemCount: 3,
      exportedAt: new Date(),
    });

    // --- Run 1: partial (FailHouse fails). ---
    const run1Counts = installSupabaseMock(new Set(["FailHouse"]));
    const result1 = await migrateToSupabase("user-123", vi.fn());

    expect(result1.failed).toBe(1);
    expect(result1.partial).toBe(true);
    expect(result1.alreadyMigrated).toBe(0);
    // 1 session insert, 3 item inserts attempted (Good house, Fail house, Good sale).
    expect(run1Counts.sessions).toBe(1);
    expect(run1Counts.items).toBe(3);

    // The session is preserved (had a failing child), FailHouse is preserved,
    // the migrated items + the still-partial session row remain in Dexie.
    expect(await db.sessions.get(sessId!)).toBeDefined();
    expect(await db.exportHistory.count()).toBe(1); // partial → NOT cleared
    expect(await needsMigration()).toBe(true);

    // --- Run 2: the transient failure clears (no titles fail). ---
    const run2Counts = installSupabaseMock(new Set());
    const result2 = await migrateToSupabase("user-123", vi.fn());

    // Idempotency: the already-mapped session is NOT re-inserted (SC2 core — the
    // dangerous duplicate path). On run 1 the session was preserved (failing
    // child) but already carried a `session` mapping; run 2 reuses it.
    expect(run2Counts.sessions).toBe(0);
    // Only the one previously-failed item is inserted now (the run-1 survivors
    // were bulkDeleted, so they are gone, not re-inserted).
    expect(run2Counts.items).toBe(1);

    // Total inserts across BOTH runs never exceed the real row count → 0 dups.
    expect(run1Counts.sessions + run2Counts.sessions).toBe(1); // 1 session
    expect(run1Counts.items + run2Counts.items).toBe(4); // 3 attempts + 1 retry

    // Counter split: no failures, no partial on the clean retry.
    expect(result2.failed).toBe(0);
    expect(result2.partial).toBe(false);

    // Ground-truth cleanup fired: everything drained.
    expect(await needsMigration()).toBe(false);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.houseVisitItems.count()).toBe(0);
    expect(await db.saleItems.count()).toBe(0);
    expect(await db.exportHistory.count()).toBe(0);
  });

  it("an item already mapped but still in Dexie is counted alreadyMigrated and skipped, not re-inserted", async () => {
    // Simulates a prior run that mapped a row but crashed before bulkDelete: the
    // Dexie row + its idMapping both survive. The item guard must skip the insert,
    // count it alreadyMigrated (NOT failed/partial), and bulkDelete it this run.
    const sessId = await db.sessions.add(makeDexieSession({ name: "Resume" }));
    const houseId = await db.houseVisitItems.add(
      makeDexieHouseItem(sessId!, { title: "AlreadyDone" }),
    );
    // Seed the prior-run mappings (session + the item) directly.
    await db.idMapping.add({
      oldId: sessId!,
      newId: "sess-prior",
      type: "session",
    });
    await db.idMapping.add({
      oldId: houseId!,
      newId: "item-prior",
      type: "item",
      itemTable: "house",
    });

    const counts = installSupabaseMock(new Set());
    const result = await migrateToSupabase("user-123", vi.fn());

    // No inserts at all — both session and item already mapped.
    expect(counts.sessions).toBe(0);
    expect(counts.items).toBe(0);
    expect(result.alreadyMigrated).toBe(1);
    expect(result.migrated).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.partial).toBe(false);

    // Ground-truth cleanup drained the dead recovery rows.
    expect(await needsMigration()).toBe(false);
    expect(await db.houseVisitItems.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });

  it("house and sale items with colliding ++id are not confused by the reverse guard", async () => {
    // House item id and sale item id both auto-increment from 1 → collision.
    const sessId = await db.sessions.add(makeDexieSession({ name: "Collide" }));
    const houseId = await db.houseVisitItems.add(
      makeDexieHouseItem(sessId!, { title: "House1" }),
    );
    const saleId = await db.saleItems.add(
      makeDexieSaleItem(sessId!, { title: "Sale1" }),
    );
    expect(houseId).toBe(saleId); // same integer id, different tables

    const counts = installSupabaseMock(new Set());
    const result = await migrateToSupabase("user-123", vi.fn());

    // BOTH items must insert — the sale item must not be skipped because a house
    // item with the same id was just mapped.
    expect(counts.items).toBe(2);
    expect(result.migrated).toBe(2);
    expect(result.alreadyMigrated).toBe(0);
    expect(await needsMigration()).toBe(false);
  });
});
