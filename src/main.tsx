import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App";
import { useAuthStore } from "./stores/authStore";
import { trackEvent } from "./services/analytics";
import { initTheme } from "./ui/tokens";
import { useThemeStore } from "./stores/themeStore";

// Initialize theme listener before React renders. Honors the persisted
// user preference (localStorage) from the start so cold loads don't flash
// the wrong theme. Phase 25 — extended over Phase 22's system-pref-only.
const teardownTheme = initTheme({ override: useThemeStore.getState().preference });

// Hydrate cloud preference once a user is known. The store handles the
// missing-column / first-session case gracefully (falls back to LS). On
// sign-out, clear the hydration marker so the next user on the same tab
// re-hydrates from their own profile (Codex P2 fix).
useAuthStore.subscribe((state, prev) => {
  if (state.user && state.user.id !== prev.user?.id) {
    useThemeStore.getState().hydrateFromSupabase(state.user.id).catch(() => {});
  } else if (!state.user && prev.user) {
    useThemeStore.getState().resetHydration();
  }
});

// Initialize auth listener before React renders
const unsubscribe = useAuthStore.getState().initialize();

// Global error capture for unhandled exceptions and promise rejections.
window.addEventListener("error", (e) => {
  trackEvent({
    event_type: "app.error",
    error_message: e.message,
    error_count: 1,
    items_content: {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error instanceof Error ? e.error.stack : undefined,
    },
  });
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  trackEvent({
    event_type: "app.error",
    error_message: message,
    error_count: 1,
    items_content: {
      kind: "unhandledrejection",
      stack: reason instanceof Error ? reason.stack : undefined,
    },
  });
});

// Cleanup on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribe();
    teardownTheme();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
