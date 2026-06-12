import { useEffect } from "react";
import { trackUiInteraction } from "../services/analytics";

/** Retained call-site hook; UI interaction telemetry is retired. */
export function usePageView(pagePath: string, sessionId?: string | null): void {
  useEffect(() => {
    trackUiInteraction({
      interaction_type: "view",
      page_path: pagePath,
      session_id: sessionId ?? null,
    });
  }, [pagePath, sessionId]);
}
