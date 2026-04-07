import { supabase } from "../lib/supabase";
import { db } from "../db";
import { getDexieItemId } from "../db/idMapping";
import { useSessionStore } from "../stores/sessionStore";
import type { Tables } from "../db/database.types";

type SupabaseItem = Tables<"items">;

/**
 * Pure function: merge fields from two items according to concatenation rules.
 * Target = item with lower sort_order (surviving item).
 * Source = item with higher sort_order (absorbed item).
 */
export function mergeFields(
  target: SupabaseItem,
  source: SupabaseItem,
): Partial<SupabaseItem> {
  return {
    title: concatSemicolon(target.title, source.title),
    description: concatNewline(target.description, source.description),
    transcript: concatNewline(target.transcript, source.transcript),
    estimate: concatSemicolon(target.estimate, source.estimate),
    condition: concatSemicolon(target.condition, source.condition),
    measurements: concatSemicolon(target.measurements, source.measurements),
    category: target.category ?? source.category ?? null,
    receipt_number: target.receipt_number ?? source.receipt_number ?? null,
    ai_status:
      target.ai_status === "done" && source.ai_status === "done"
        ? "done"
        : target.ai_status,
  };
}

function concatSemicolon(a: string | null, b: string | null): string | null {
  if (a && b) return `${a}; ${b}`;
  return a ?? b ?? null;
}

function concatNewline(a: string | null, b: string | null): string | null {
  if (a && b) return `${a}\n${b}`;
  return a ?? b ?? null;
}

/**
 * Orchestrator: merge source item into target item.
 * - Updates target item fields in Supabase
 * - Reassigns photos (Supabase + Dexie)
 * - Reassigns audio (Dexie)
 * - Deletes source item
 * - Re-sorts remaining items
 * - Refreshes session store
 */
export async function mergeItems(
  targetId: string,
  sourceId: string,
  sessionId: string,
): Promise<void> {
  const state = useSessionStore.getState();
  const items = state.itemsBySession[sessionId] ?? [];

  const target = items.find((i) => i.id === targetId);
  const source = items.find((i) => i.id === sourceId);
  if (!target || !source) {
    throw new Error("Could not find both items for merge");
  }

  // Compute merged fields
  const merged = mergeFields(target, source);

  // Update target item in Supabase
  const { error: updateError } = await supabase
    .from("items")
    .update(merged)
    .eq("id", targetId);
  if (updateError) throw updateError;

  // Reassign Supabase photos from source to target
  const { error: photoError } = await supabase
    .from("photos")
    .update({ item_id: targetId })
    .eq("item_id", sourceId);
  if (photoError) throw photoError;

  // Reassign Dexie photos and audio (legacy local blobs)
  const targetDexieId = await getDexieItemId(targetId);
  const sourceDexieId = await getDexieItemId(sourceId);

  if (targetDexieId != null && sourceDexieId != null) {
    await db.photos
      .where("itemId")
      .equals(sourceDexieId)
      .modify({ itemId: targetDexieId });
    await db.audio
      .where("itemId")
      .equals(sourceDexieId)
      .modify({ itemId: targetDexieId });
  }

  // Delete source item
  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("id", sourceId);
  if (deleteError) throw deleteError;

  // Re-sort remaining items to close gaps
  const remaining = items
    .filter((i) => i.id !== sourceId)
    .sort((a, b) => a.sort_order - b.sort_order);

  const sortUpdates = remaining
    .map((item, index) => ({ id: item.id, sort_order: index }))
    .filter((u, i) => remaining[i].sort_order !== u.sort_order);

  if (sortUpdates.length > 0) {
    await Promise.all(
      sortUpdates.map((u) =>
        supabase.from("items").update({ sort_order: u.sort_order }).eq("id", u.id),
      ),
    );
  }

  // Refresh store
  await state.fetchItems(sessionId);
}
