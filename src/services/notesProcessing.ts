import { processNotesWithAi } from "./processNotesWithAi";
import type { PersistItemDraftBatchResult } from "./itemDraftsApi";

export async function processNotes(sessionId: string): Promise<PersistItemDraftBatchResult> {
  return processNotesWithAi(sessionId);
}
