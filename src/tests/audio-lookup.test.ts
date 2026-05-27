import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db";
import { addIdMapping } from "../db/idMapping";
import { audioRecordsForItem } from "../db/audioLookup";
import type { ItemAudio } from "../db/types";

afterEach(async () => {
  await db.delete();
  await db.open();
});

function makeAudio(itemId: number | string, durationMs: number): Omit<ItemAudio, "id"> {
  return {
    itemId: itemId as unknown as number,
    itemType: "house",
    blob: new Blob(["audio"], { type: "audio/webm" }),
    mimeType: "audio/webm",
    durationMs,
    createdAt: new Date(),
  };
}

describe("audioRecordsForItem (DAT-7)", () => {
  const UUID = "uuid-item-1";

  it("finds rows stored under the UUID string", async () => {
    const id = await db.audio.add(makeAudio(UUID, 100));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(id);
    expect(result[0].durationMs).toBe(100);
  });

  it("finds rows stored under the legacy integer id when an idMapping exists", async () => {
    await addIdMapping({ oldId: 42, newId: UUID, type: "item" });
    const id = await db.audio.add(makeAudio(42, 200));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(id);
    expect(result[0].durationMs).toBe(200);
  });

  it("unions both forms, deduped by id, when audio exists under UUID and legacy id", async () => {
    await addIdMapping({ oldId: 42, newId: UUID, type: "item" });
    const uuidId = await db.audio.add(makeAudio(UUID, 100));
    const legacyId = await db.audio.add(makeAudio(42, 200));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(2);
    const ids = result.map((a) => a.id).sort((a, b) => a! - b!);
    expect(ids).toEqual([uuidId, legacyId].sort((a, b) => a - b));
    // No duplicate ids
    expect(new Set(ids).size).toBe(2);
  });

  it("returns only UUID rows when no idMapping exists", async () => {
    const uuidId = await db.audio.add(makeAudio(UUID, 100));
    // A legacy-int row that is NOT mapped to this UUID must not be returned.
    await db.audio.add(makeAudio(42, 999));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(uuidId);
  });
});
