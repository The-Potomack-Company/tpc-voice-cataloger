import { processNotesWithAi } from "./processNotesWithAi";

export async function processNotes(sessionId: string): Promise<{ draftCount: number }> {
  return processNotesWithAi(sessionId);
}
