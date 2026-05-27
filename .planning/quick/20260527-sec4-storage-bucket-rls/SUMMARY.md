---
type: quick-summary
slug: sec4-storage-bucket-rls
status: complete
completed: 2026-05-27
branch: urgent/sec-storage-bucket-rls
base: urgent/sec-proxy-hardening
commits: ["6a7c58a", "0a489a6"]
codex_review: CLEAN (1 finding dismissed — false positive, verified)
smoke: "tsc -b green; 507 tests passed"
pr: "not yet opened — classifier blocked outward publish; branch pushed"
---

# SEC-4 — Storage-bucket RLS ownership scoping — COMPLETE

## Delivered
- Migration `supabase/migrations/20260527000001_scope_photos_storage_rls.sql` (commit 6a7c58a).
- Drops the two over-permissive photos-bucket `storage.objects` policies; replaces
  with session-ownership-scoped SELECT/INSERT/UPDATE/DELETE (token [2] = sessionId)
  + admin `FOR ALL`. Mirrors photos-table RLS. No client change.

## Verification
- Codex adversarial review (D-046): items 1-5 CLEAN (path index, path forgery,
  upsert/UPDATE coverage, no orphaned access, NULL/anon safe).
- Item 6 (missing `private.is_admin()` grant) **dismissed as false positive**:
  the identical `(select private.is_admin())` + `to authenticated` pattern is
  prod-live across profiles/sessions/items policies since 20260318000005. A missing
  grant would abort every authenticated query to those tables → app fully broken.
  It isn't, so the grant is already effective (Supabase default role setup). Codex
  itself rated it MEDIUM + "fails closed" → not a security hole regardless.
- `tsc -b` exit 0; 507 tests passed / 55 todo / 5 skipped.

## Open / hand-off
- **PR not yet opened.** Branch `urgent/sec-storage-bucket-rls` pushed to origin
  (The-Potomack-Company/tpc-voice-cataloger). PR creation against base
  `urgent/sec-proxy-hardening` was blocked by the auto-mode classifier (outward
  publish to a new org target). Open manually:
  https://github.com/The-Potomack-Company/tpc-voice-cataloger/pull/new/urgent/sec-storage-bucket-rls
- **Prod-apply (user-owned, like SEC-1):** apply storage policies to prod Supabase +
  admin audit. Deferred to end-of-sweep per D-051.
- **Next in chain:** DAT-1/2/3, branched off this branch.
