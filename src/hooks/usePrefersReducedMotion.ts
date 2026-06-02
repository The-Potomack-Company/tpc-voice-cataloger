import { useEffect, useState } from "react";

/**
 * Tracks the `prefers-reduced-motion: reduce` media query (Phase 37, IN-01).
 *
 * Extracted from Modal / OverflowMenu / MigrationSplash, which each carried a
 * verbatim copy — drift risk if one gained an SSR/guard fix and the others did
 * not. The initial state + listener both guard `window`/`matchMedia` so this is
 * SSR- and jsdom-safe.
 */
export function usePrefersReducedMotion(): boolean {
  const [pref, setPref] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setPref(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return pref;
}
