/**
 * Phase 46 stub seam for photo-notes processing.
 *
 * Deliberate no-op: Phase 46 ships capture + local persistence only. Phase 47 wires
 * the real pipeline here (multi-image Gemini call via tpc-ai-proxy → item_drafts).
 * Keeping the call site explicit now means Phase 47 is a body swap, not a rewire.
 */
export async function processNotes(sessionId: string): Promise<void> {
  // intentionally inert — see Phase 47 (photo-notes-vision-segmentation)
  void sessionId;
}
