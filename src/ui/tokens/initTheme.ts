/**
 * src/ui/tokens/initTheme.ts
 *
 * Runtime dark-mode listener for Phase 22 (system-pref only).
 *
 * Two-piece bootstrap (per Phase 22 CONTEXT D-07):
 *   1. The inline <script> in index.html does the synchronous pre-paint pass
 *      (mandatory for no-FOUC on cold load).
 *   2. This helper handles runtime live updates — when the OS dark/light
 *      preference flips during a session, .tpc-dark flips on <html>
 *      without a reload.
 *
 * Phase 25 will pass `{ override: 'light' | 'dark' | 'system' }` via opts to
 * apply a user-chosen preference. Phase 22 stays strictly system-pref-only:
 * does NOT read localStorage, does NOT read from Supabase, does NOT ship UI.
 * The opts param is accepted and ignored here so Phase 25 can add behavior
 * without changing call sites.
 */

export type ThemeOverride = "light" | "dark" | "system";

export interface InitThemeOpts {
  override?: ThemeOverride;
}

/**
 * Attach a matchMedia('change') listener that toggles `.tpc-dark` on
 * `document.documentElement` whenever the OS preference changes. Returns
 * a teardown callable that removes the listener.
 *
 * Idempotent: re-applies the current state on call, so it converges with
 * the inline pre-paint script's state. Safe under React StrictMode (the
 * function runs once at module top-level in main.tsx, not inside a
 * component effect).
 */
export function initTheme(_opts: InitThemeOpts = {}): () => void {
  // SSR / legacy webview guard. Returns a no-op teardown so callers can
  // unconditionally store the return value.
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = (matches: boolean): void => {
    document.documentElement.classList.toggle("tpc-dark", matches);
  };

  // Idempotent re-sync. The inline script in index.html already did this,
  // but running again here ensures correctness if the inline script was
  // skipped (e.g., dev tools blocked it) or if the OS pref changed between
  // HTML parse and this call.
  apply(mq.matches);

  const listener = (e: MediaQueryListEvent): void => apply(e.matches);
  // Use addEventListener('change'), not the deprecated addListener
  // (per RESEARCH Anti-Pattern §5).
  mq.addEventListener("change", listener);

  return () => mq.removeEventListener("change", listener);
}
