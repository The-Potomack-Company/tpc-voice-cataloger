import { useEffect } from "react";
import { trackUiInteraction } from "../services/analytics";

/**
 * Fire a `view` ui_interactions event on mount and whenever pagePath/sessionId changes.
 */
export function usePageView(pagePath: string, sessionId?: string | null): void {
  useEffect(() => {
    trackUiInteraction({
      interaction_type: "view",
      page_path: pagePath,
      session_id: sessionId ?? null,
    });
  }, [pagePath, sessionId]);
}
