import { db } from "../db";
import type { ExportSchema } from "../db/types";

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader did not return a string"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function buildExportData(
  sessionId: number,
): Promise<ExportSchema> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Destructure out id and deletedAt
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, deletedAt: _deletedAt, ...sessionData } = session;

  const table =
    session.mode === "house" ? db.houseVisitItems : db.saleItems;
  const items = await table
    .where("sessionId")
    .equals(sessionId)
    .sortBy("sortOrder");

  const exportItems = await Promise.all(
    items.map(async (item) => {
      const itemId = item.id!;

      const photos = await db.photos
        .where("itemId")
        .equals(itemId)
        .sortBy("sortOrder");

      const audioRecords = await db.audio
        .where("itemId")
        .equals(itemId)
        .toArray();

      const photoData = await Promise.all(
        photos.map(async (p) => ({
          blob: await blobToBase64(
            p.blob instanceof Blob
              ? p.blob
              : new Blob([p.blob as unknown as ArrayBuffer]),
          ),
          sortOrder: p.sortOrder,
        })),
      );

      const audioData = await Promise.all(
        audioRecords.map(async (a) => ({
          blob: await blobToBase64(
            a.blob instanceof Blob
              ? a.blob
              : new Blob([a.blob as unknown as ArrayBuffer]),
          ),
          mimeType: a.mimeType,
          durationMs: a.durationMs,
        })),
      );

      return {
        title: item.title,
        description: item.description,
        condition: item.condition,
        estimate: item.estimate,
        category: item.category,
        transcript: item.transcript,
        receiptNumber:
          "receiptNumber" in item
            ? (item as Record<string, unknown>).receiptNumber as
                | string
                | undefined
            : undefined,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        photos: photoData,
        audio: audioData,
      };
    }),
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: sessionData,
    items: exportItems,
  };
}

export async function exportSession(sessionId: number): Promise<void> {
  const data = await buildExportData(sessionId);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tpc-session-${sessionId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
