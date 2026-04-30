import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App";
import { useAuthStore } from "./stores/authStore";
import { trackEvent } from "./services/analytics";
import { initTheme } from "./ui/tokens";

// Initialize theme listener before React renders (per Phase 22 CONTEXT D-06).
const teardownTheme = initTheme();

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
