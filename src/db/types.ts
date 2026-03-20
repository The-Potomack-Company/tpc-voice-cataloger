export interface Session {
  id?: number;
  name: string;
  mode: "house" | "sale";
  status: "active" | "submitted" | "returned" | "exported";
  notes: string;
  deletedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportHistoryRecord {
  id?: number;
  sessionId: number;
  sessionName: string;
  sessionMode: "house" | "sale";
  itemCount: number;
  exportedAt: Date;
}

export type AiStatus = "pending" | "processing" | "done" | "failed" | "queued";

export interface HouseVisitItem {
  id?: number;
  sessionId: number;
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  measurements?: string;
  category?: string;
  transcript?: string;
  aiStatus?: AiStatus;
  sortOrder: number;
  createdAt: Date;
}

export interface SaleItem {
  id?: number;
  sessionId: number;
  receiptNumber?: string;
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  measurements?: string;
  category?: string;
  transcript?: string;
  aiStatus?: AiStatus;
  sortOrder: number;
  createdAt: Date;
}

export interface ItemPhoto {
  id?: number;
  itemId: number;
  itemType: "house" | "sale";
  blob: Blob;
  thumbnail?: Blob;
  sortOrder: number;
  createdAt: Date;
}

export interface ItemAudio {
  id?: number;
  itemId: number;
  itemType: "house" | "sale";
  blob: Blob;
  mimeType: string;
  durationMs?: number;
  createdAt: Date;
}

export interface IdMapping {
  id?: number;
  oldId: number;
  newId: string;
  type: "session" | "item";
}

export interface WriteAheadEntry {
  id?: number;
  table: "sessions" | "items";
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  tempId?: string;
  createdAt: Date;
}

export interface ExportSchema {
  version: 1;
  exportedAt: string;
  session: Omit<Session, "id">;
  items: Array<{
    title?: string;
    description?: string;
    condition?: string;
    estimate?: string;
    measurements?: string;
    department?: string;
    transcript?: string;
    receiptNumber?: string;
    sortOrder: number;
    createdAt: string;
    photos: Array<{
      blob: string;
      sortOrder: number;
    }>;
    audio: Array<{
      blob: string;
      mimeType: string;
      durationMs?: number;
    }>;
  }>;
}
