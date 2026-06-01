import { useSessionStore } from "../stores/sessionStore";
import { db } from "./index";

// D-05: the 8 catalog fields whose user edits establish no-clobber provenance.
// ai_status and any other control field are intentionally excluded — flagging
// only genuine user-originated catalog edits keeps the no-clobber guard from
// ever firing against the AI's own ai_status writes (Pitfall 3).
const CATALOG_FIELDS = new Set([
  "title",
  "description",
  "condition",
  "estimate",
  "category",
  "measurements",
  "transcript",
  "receipt_number",
]);

export async function createBlankItem(
  sessionId: string,
  mode: "house" | "sale",
  receiptNumber?: string,
): Promise<string> {
  return useSessionStore
    .getState()
    .createItem(sessionId, mode, receiptNumber);
}

export async function updateItemField(
  id: string,
  sessionId: string,
  field: string,
  value: string | null,
): Promise<void> {
  await useSessionStore
    .getState()
    .updateItemField(id, sessionId, field, value);

  // D-05: flag this catalog field as user-owned so a later AI retry skips it.
  // AI-internal merges call the store action directly (not this wrapper), so
  // flagging here cleanly excludes AI writes; control fields like ai_status
  // are excluded via the CATALOG_FIELDS allowlist.
  if (CATALOG_FIELDS.has(field)) {
    await db.userEditedFields.put({ itemId: id, field });
  }
}

export async function deleteItem(
  id: string,
  sessionId: string,
): Promise<void> {
  await useSessionStore.getState().deleteItem(id, sessionId);
}

export async function appendToItemField(
  id: string,
  sessionId: string,
  field: string,
  newContent: string,
): Promise<void> {
  await useSessionStore
    .getState()
    .appendToItemField(id, sessionId, field, newContent);
}
