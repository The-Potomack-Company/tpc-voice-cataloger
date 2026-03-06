export interface Session {
  id?: number;
  name: string;
  mode: "house" | "sale";
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseVisitItem {
  id?: number;
  sessionId: number;
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  category?: string;
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
  category?: string;
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

export interface ExportSchema {
  version: 1;
  exportedAt: string;
  session: Omit<Session, "id">;
  items: Array<{
    title?: string;
    description?: string;
    condition?: string;
    estimate?: string;
    category?: string;
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
