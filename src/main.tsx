import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App";
import { useAuthStore } from "./stores/authStore";

// Initialize auth listener before React renders
const unsubscribe = useAuthStore.getState().initialize();

// Cleanup on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribe());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
