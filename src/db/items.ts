import { useSessionStore } from "../stores/sessionStore";

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
