/**
 * src/stores/themeStore.ts
 *
 * Phase 25 — theme preference (light / dark / system).
 *
 * Persistence:
 *   - Source of truth: in-memory zustand store.
 *   - Mirror: localStorage under "tpc-theme" so reloads survive without
 *     a round-trip to Supabase.
 *   - Optional cloud mirror: `profiles.theme` column. If the column is
 *     missing in Supabase (early adopters, graceful migration), the
 *     write quietly logs and continues. Read path: when a user logs in,
 *     we try to read profiles.theme; if it errors (column missing),
 *     we fall back to localStorage.
 *
 * The store DOES NOT manipulate the DOM directly — `initTheme` (in
 * src/ui/tokens/initTheme.ts) is the single writer of `.tpc-dark` on
 * `<html>`. The store calls initTheme() (idempotent) whenever the
 * preference changes.
 */

import { create } from "zustand";
import { initTheme, type ThemeOverride } from "../ui/tokens/initTheme";
import { supabase } from "../lib/supabase";

const LS_KEY = "tpc-theme";

function readLocal(): ThemeOverride {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* localStorage unavailable in some embedded contexts */
  }
  return "system";
}

function writeLocal(pref: ThemeOverride): void {
  try {
    localStorage.setItem(LS_KEY, pref);
  } catch {
    /* no-op */
  }
}

interface ThemeState {
  preference: ThemeOverride;
  hydrated: boolean;
  setPreference: (pref: ThemeOverride) => Promise<void>;
  hydrateFromSupabase: (userId: string) => Promise<void>;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  preference: readLocal(),
  hydrated: false,

  setPreference: async (pref) => {
    set({ preference: pref });
    writeLocal(pref);
    // Re-init the listener with the new override. initTheme is idempotent
    // and will replace the previous listener via its returned teardown
    // (managed at the main.tsx boundary).
    initTheme({ override: pref });

    // Best-effort Supabase mirror. If the column is missing, swallow the
    // error so the rest of the flow continues working.
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;
    try {
      // The profiles row type is auto-generated from the live schema and
      // does not include `theme` until the Phase 25 migration is applied.
      // We cast the partial payload so the update compiles before the
      // database.types.ts regen lands; runtime tolerates missing column
      // via isMissingColumnError below.
      const payload = { theme: pref } as unknown as Record<string, unknown>;
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId);
      if (error && !isMissingColumnError(error)) {
        // Log non-schema errors for debugging; do not throw.
        console.warn("[themeStore] supabase mirror failed:", error.message);
      }
    } catch (e) {
      console.warn("[themeStore] supabase mirror exception:", e);
    }
  },

  hydrateFromSupabase: async (userId) => {
    if (get().hydrated) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", userId)
        .single();
      set({ hydrated: true });
      if (error) {
        // Missing column or no profile row — fall back to localStorage.
        return;
      }
      const cloudPref = (data as { theme?: string | null } | null)?.theme;
      if (
        cloudPref === "light" ||
        cloudPref === "dark" ||
        cloudPref === "system"
      ) {
        // Cloud wins, but mirror to LS for next cold load.
        set({ preference: cloudPref });
        writeLocal(cloudPref);
        initTheme({ override: cloudPref });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));

function isMissingColumnError(err: { code?: string; message?: string }): boolean {
  // Postgres error 42703 = undefined_column; PostgREST surfaces this in code
  // and the message includes "theme" / "column" hints.
  if (err.code === "42703") return true;
  const m = err.message?.toLowerCase() ?? "";
  return m.includes("column") && m.includes("theme");
}
