-- Phase 25: theme preference per user.
-- Adds nullable `theme` column to profiles. Values: 'light' | 'dark' | 'system'.
-- Application falls back to localStorage if this column is missing
-- (themeStore handles the 42703 error gracefully), so this migration is
-- safe to apply at any time without breaking older builds.

alter table public.profiles
  add column if not exists theme text
    check (theme is null or theme in ('light', 'dark', 'system'));

comment on column public.profiles.theme is
  'User-chosen theme preference (Phase 25). NULL means no preference; the app falls back to the device system preference.';
