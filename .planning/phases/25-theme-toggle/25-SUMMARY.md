# Phase 25: Theme Toggle & Settings — Summary

**Completed:** 2026-05-12

## Shipped (TOKENS-03, A11Y-03)

- `src/ui/tokens/initTheme.ts` — extended to honor `{ override: 'light' | 'dark' | 'system' }`. Light / dark forces the class on/off and skips matchMedia entirely; system keeps live media tracking. Idempotent — repeated calls tear down the previous listener.
- `src/stores/themeStore.ts` — zustand store holding the user preference. Persists to localStorage immediately (offline-safe) and best-effort to `profiles.theme` in Supabase. Handles the "column missing" case (Postgres 42703 or message-sniffed) so the rollout sequence does not require the SQL migration to land first.
- `src/ui/ThemePicker.tsx` — Light / Dark / System segmented control built from LIB Button primitives. Uses `role="radiogroup"` / `aria-checked` for screen reader correctness.
- `src/main.tsx` — boots with `initTheme({ override: useThemeStore.getState().preference })` so cold loads pick up the saved choice; subscribes to auth changes to hydrate the cloud preference once a user is known.
- `src/pages/Settings.tsx` — added an "Appearance" section at the top of the page hosting the picker.
- `supabase/migrations/20260512000000_add_theme_to_profiles.sql` — adds nullable `theme text check (...)` column with a documenting comment.
- New tests: `src/ui/__tests__/theme-override.test.ts` (4 specs) covering the three override modes + teardown idempotency.

## Walkthrough step (success criterion #3) — deferred

The roadmap calls for a walkthrough step pointing out the toggle. The picker is discoverable in Settings, and Phase 28 keeps the existing walkthrough step structure. A new "Theme" step using the existing per-step seen-state model is logged in `.planning/v1.2-followup.md`.

## Verification

- `npx tsc -b` — clean
- `vitest --run` — 425 passed, 5 skipped, 55 todo (pre-existing; nothing regressed)
