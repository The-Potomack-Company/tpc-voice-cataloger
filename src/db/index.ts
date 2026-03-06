import Dexie, { type EntityTable } from "dexie";
import type {
  Session,
  HouseVisitItem,
  SaleItem,
  ItemPhoto,
  ItemAudio,
} from "./types";

const db = new Dexie("TPCCatalog") as Dexie & {
  sessions: EntityTable<Session, "id">;
  houseVisitItems: EntityTable<HouseVisitItem, "id">;
  saleItems: EntityTable<SaleItem, "id">;
  photos: EntityTable<ItemPhoto, "id">;
  audio: EntityTable<ItemAudio, "id">;
};

db.version(1).stores({
  sessions: "++id, mode, createdAt",
  houseVisitItems: "++id, sessionId, sortOrder",
  saleItems: "++id, sessionId, receiptNumber, sortOrder",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});

export { db };
