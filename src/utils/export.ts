import { db } from "../db";
import { supabase } from "../lib/supabase";
import { getDexieItemId } from "../db/idMapping";
import { useAuthStore } from "../stores/authStore";
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
  sessionId: string,
): Promise<ExportSchema> {
  // Read session from Supabase
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Read items from Supabase
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  const supabaseItems = items ?? [];

  const exportItems = await Promise.all(
    supabaseItems.map(async (item) => {
      // Look up Dexie integer ID for blob access
      const dexieItemId = await getDexieItemId(item.id);
      const lookupId = dexieItemId ?? (item.id as unknown as number);

      const photos = await db.photos
        .where("itemId")
        .equals(lookupId)
        .sortBy("sortOrder");

      const audioRecords = await db.audio
        .where("itemId")
        .equals(lookupId)
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
        title: item.title ?? undefined,
        description: item.description ?? undefined,
        measurements: item.measurements ?? undefined,
        condition: item.condition ?? undefined,
        estimate: item.estimate ?? undefined,
        department: item.category ?? undefined,
        transcript: item.transcript ?? undefined,
        receiptNumber: item.receipt_number ?? undefined,
        sortOrder: item.sort_order,
        createdAt: item.created_at,
        photos: photoData,
        audio: audioData,
      };
    }),
  );

  // Map Supabase session fields to ExportSchema format
  const sessionData = {
    name: session.name,
    mode: session.mode as "house" | "sale",
    status: session.status as "active" | "submitted" | "returned" | "exported",
    notes: session.notes,
    createdAt: new Date(session.created_at),
    updatedAt: new Date(session.updated_at),
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: sessionData,
    items: exportItems,
  };
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .replace(/^-+|-+$/g, "");
}

export async function exportSession(sessionId: string): Promise<void> {
  const data = await buildExportData(sessionId);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Versioned filename: count existing exports for this session from Supabase
  const { count } = await supabase
    .from("export_history")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const version = (count ?? 0) + 1;
  const sanitized = sanitizeFilename(data.session.name);
  const baseName = sanitized || `tpc-session-${sessionId}`;
  // First export: no version suffix. Subsequent: -v2, -v3, etc.
  a.download = version === 1
    ? `${baseName}.json`
    : `${baseName}-v${version}.json`;

  a.click();
  URL.revokeObjectURL(url);

  // Record export in Supabase export_history table
  const userId = useAuthStore.getState().user?.id ?? "";
  await supabase.from("export_history").insert({
    session_id: sessionId,
    session_name: data.session.name,
    session_mode: data.session.mode,
    item_count: data.items.length,
    exported_by: userId,
  });
}

// Re-export is identical to export -- regenerates from live data
export const reExportSession = exportSession;
