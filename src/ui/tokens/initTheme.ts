/**
 * src/ui/tokens/initTheme.ts
 *
 * Runtime dark-mode listener.
 *
 * Phase 22 (system-pref only): toggle `.tpc-dark` on `<html>` per
 * `prefers-color-scheme: dark` and live-update on change.
 *
 * Phase 25 (override): accept `{ override: 'light' | 'dark' | 'system' }`.
 *   - "light" — force `.tpc-dark` off, ignore matchMedia.
 *   - "dark"  — force `.tpc-dark` on, ignore matchMedia.
 *   - "system" (default) — follow `prefers-color-scheme: dark` live.
 *
 * Idempotent: calling initTheme() again replaces the previous listener
 * via its returned teardown (the caller is expected to teardown before
 * re-calling, which our store does in the new preference flow).
 *
 * Single writer of `.tpc-dark`. Avoids racing the inline pre-paint
 * script in index.html — that script runs once at parse time; this
 * function manages the live cascade afterwards.
 */

export type ThemeOverride = "light" | "dark" | "system";

export interface InitThemeOpts {
  override?: ThemeOverride;
}

// Module-level handle for the active system listener (so multiple
// initTheme calls don't leak listeners when callers forget teardown).
let activeTeardown: (() => void) | null = null;

function setDark(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("tpc-dark", on);
}

export function initTheme(opts: InitThemeOpts = {}): () => void {
  // Always tear down any previous registration first.
  if (activeTeardown) {
    try {
      activeTeardown();
    } catch {
      /* swallow — best effort */
    }
    activeTeardown = null;
  }

  const override = opts.override ?? "system";

  // Light / dark overrides short-circuit matchMedia entirely.
  if (override === "light") {
    setDark(false);
    const teardown = () => {};
    activeTeardown = teardown;
    return teardown;
  }
  if (override === "dark") {
    setDark(true);
    const teardown = () => {};
    activeTeardown = teardown;
    return teardown;
  }

  // System mode (the default). SSR / legacy webview guard returns
  // a no-op teardown so callers can unconditionally store it.
  if (typeof window === "undefined" || !window.matchMedia) {
    const teardown = () => {};
    activeTeardown = teardown;
    return teardown;
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  setDark(mq.matches);

  const listener = (e: MediaQueryListEvent): void => setDark(e.matches);
  mq.addEventListener("change", listener);

  const teardown = () => {
    mq.removeEventListener("change", listener);
  };
  activeTeardown = teardown;
  return teardown;
}
