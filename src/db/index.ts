import Dexie, { type EntityTable } from "dexie";
import type {
  Session,
  HouseVisitItem,
  SaleItem,
  ItemPhoto,
  ItemAudio,
  ExportHistoryRecord,
  IdMapping,
  WriteAheadEntry,
  PhotoUploadEntry,
} from "./types";

const db = new Dexie("TPCCatalog") as Dexie & {
  sessions: EntityTable<Session, "id">;
  houseVisitItems: EntityTable<HouseVisitItem, "id">;
  saleItems: EntityTable<SaleItem, "id">;
  photos: EntityTable<ItemPhoto, "id">;
  audio: EntityTable<ItemAudio, "id">;
  exportHistory: EntityTable<ExportHistoryRecord, "id">;
  idMapping: EntityTable<IdMapping, "id">;
  writeAheadQueue: EntityTable<WriteAheadEntry, "id">;
  photoUploadQueue: EntityTable<PhotoUploadEntry, "id">;
};

db.version(1).stores({
  sessions: "++id, mode, createdAt",
  houseVisitItems: "++id, sessionId, sortOrder",
  saleItems: "++id, sessionId, receiptNumber, sortOrder",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});

db.version(2)
  .stores({
    sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
    houseVisitItems: "++id, sessionId, sortOrder",
    saleItems: "++id, sessionId, receiptNumber, sortOrder",
    photos: "++id, itemId, sortOrder",
    audio: "++id, itemId",
  })
  .upgrade((tx) => {
    return tx
      .table("sessions")
      .toCollection()
      .modify((session) => {
        if (session.status === undefined) {
          session.status = "active";
        }
        if (session.notes === undefined) {
          session.notes = "";
        }
      });
  });

db.version(3).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});

db.version(4).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});

// v5: Add measurements field to item types (not indexed — no store schema change needed)
db.version(5).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});

// v6: Add exportHistory table, archivedAt on Session (optional, no upgrade needed)
db.version(6).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
  exportHistory: "++id, sessionId, exportedAt",
});

// v7: Add idMapping and writeAheadQueue tables for Supabase migration
db.version(7).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
  exportHistory: "++id, sessionId, exportedAt",
  idMapping: "++id, oldId, newId, type, [newId+type]",
  writeAheadQueue: "++id, createdAt",
});

// v8: Add photoUploadQueue table for offline photo upload queuing
db.version(8).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
  exportHistory: "++id, sessionId, exportedAt",
  idMapping: "++id, oldId, newId, type, [newId+type]",
  writeAheadQueue: "++id, createdAt",
  photoUploadQueue: '++id, status, dexiePhotoId, itemId, createdAt',
});

export { db };
