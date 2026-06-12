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
  sessionId?: string;
  createdAt: Date;
}

export interface SessionAudio {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotePage {
  id?: number;
  // crypto.randomUUID() — stable UI identity across retake/reorder. NOT the Dexie
  // ++id (which churns) and NOT a Supabase id.
  pageUid: string;
  // Supabase session UUID (the useParams sessionId string), NOT the Dexie ++id.
  sessionId: string;
  blob: Blob; // resized JPEG, maxDimension 2048 (handwriting legibility for Phase 47)
  thumbnail: Blob;
  // SHA-256 over the persisted page blob. This is the Phase 47 idempotency key:
  // reordering pages or adding new pages must not change whether this content has
  // already produced drafts.
  contentHash?: string;
  processedContentHash?: string;
  sortOrder: number;
  status: "captured" | "processing" | "processed" | "failed";
  processedAt?: string;
  createdAt: string; // ISO
}

export interface UserEditedField {
  // Supabase UUID — the SAME value updateItemField/processAudioWithAi pass around,
  // NOT the integer Dexie item id (the houseVisitItems/saleItems tables are legacy
  // pre-Supabase-migration stores keyed by ++id). Keying on the integer id would make
  // the no-clobber retry guard silently miss migrated items. (RESEARCH Pitfall 1.)
  itemId: string;
  field: string;
}

export interface IdMapping {
  id?: number;
  oldId: number;
  newId: string;
  type: "session" | "item";
  // Disambiguates house vs sale items: both Dexie tables have independent ++id
  // keyspaces, so oldId is not unique across them. Unindexed additive field
  // (no schema migration); only present on item mappings written by Phase 38+.
  itemTable?: "house" | "sale";
}

export interface WriteAheadEntry {
  id?: number;
  table: "sessions" | "items" | "analytics_events";
  operation: "insert" | "update" | "delete";
  // Phase 39 (D-04): for an `items` update, an optional `updated_at` key in the
  // payload carries the optimistic-concurrency snapshot taken at enqueue time. On
  // flush it is pulled OUT of the written patch and applied as a `.eq("updated_at")`
  // precondition (WHERE-token, never a SET column — the items_updated_at trigger owns
  // the bump). No structural change / no Dexie version bump: payload is already an
  // open Record. A legacy entry with no `updated_at` falls back to re-read-then-
  // precondition on flush (Pitfall 6).
  payload: Record<string, unknown>;
  tempId?: string;
  createdAt: Date;
}

export interface PhotoUploadEntry {
  id?: number;
  dexiePhotoId: number;
  itemId: string;
  sessionId: string;
  sortOrder: number;
  storagePath: string;
  thumbnailPath: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  retryCount: number;
  createdAt: Date;
  lastAttemptAt?: Date;
}

export interface AudioUploadEntry {
  id?: number;
  dexieAudioId: number;
  itemId: string;
  sessionId: string;
  mimeType: string;
  storagePath: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  retryCount: number;
  createdAt: Date;
  lastAttemptAt?: Date;
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
