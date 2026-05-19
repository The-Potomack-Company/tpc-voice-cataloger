# 02-06 cataloger Edge Function patch

## What shipped

- `supabase/functions/admin-list-users/index.ts` now excludes users listed in `private.dev_users` before returning `{ accounts: Account[] }`.
- The Edge Function still runs with the service-role client and still uses the same HTTP surface: no request body, same `Deno.serve` entrypoint, same `{ accounts }` response shape, and no module exports.
- `supabase/functions/admin-list-users/index.test.ts` adds Deno coverage for:
  - non-Josh admin sees no dev accounts
  - Josh sees no dev accounts, including his own admin profile
  - real accounts remain visible with the unchanged account response shape

## Implementation notes

- The current function uses `@supabase/supabase-js`/PostgREST, not a raw SQL client. That API does not provide a reliable direct SQL JOIN from `public.profiles` to `private.dev_users` here, so the patch uses the accepted fallback from the plan: a service-role read of `private.dev_users(user_id)` and an in-memory exclusion before payload serialization.
- No schema or migration files were changed.
- `admin-create-user` and `admin-update-user` were not touched.

## Verification

- Static checks:
  - `rg -n "^export|Deno\\.serve|JSON\\.stringify\\(\\{ accounts \\}\\)|req\\.json|\\.schema\\('private'\\)|dev_users" supabase/functions/admin-list-users/index.ts supabase/functions/admin-list-users/index.test.ts`
  - Confirmed no `export` declarations in `index.ts`.
  - Confirmed the response is still serialized as `JSON.stringify({ accounts })`.
  - Confirmed the function still has no request body parse.
- `git diff --check -- supabase/functions/admin-list-users/index.ts supabase/functions/admin-list-users/index.test.ts` passed.

## Blockers / follow-up

- SQL-level JOIN blocker: the current Edge Function uses `@supabase/supabase-js`/PostgREST, not a raw SQL client. In this source shape there is no reliable direct SQL JOIN from `public.profiles` to `private.dev_users`, so the patch uses the plan's accepted fallback read of `private.dev_users` plus response filtering.
- `deno` is not installed in this worktree environment (`command -v deno` returned empty), so I could not run:
  - `cd supabase/functions/admin-list-users && deno test`
  - `cd supabase/functions/admin-list-users && deno check index.ts index.test.ts`
- The user must redeploy the Edge Function after merge:
  - `supabase functions deploy admin-list-users`
