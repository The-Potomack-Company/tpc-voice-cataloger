---
type: quick-plan
slug: sec4-storage-bucket-rls
created: 2026-05-27
severity: P0
chain: stacked-pr (D-051) — base urgent/sec-proxy-hardening
---

# SEC-4 — Storage-bucket RLS ownership scoping

## Problem

`20260320200000_create_photos.sql:76-85` defines two `storage.objects` policies
for the `photos` bucket that gate **only** on `bucket_id = 'photos'`:

- `"Users can upload photos"` (INSERT) — any authenticated user can write any path
- `"Users can read photos"` (SELECT) — any authenticated user can read any path

Because `supabase.storage.from("photos").upload(..., { upsert: true })` is used,
any specialist can **overwrite** another specialist's photo blobs by path, and
can generate signed URLs to **read** any blob. The photos *table* RLS is already
session-scoped (lines 32-69), so the storage layer is the lone gap.

## Path convention (load-bearing)

`photoUploadQueue.ts:28-29` writes:
    photos/{sessionId}/{itemId}/full-{sortOrder}.jpg
    photos/{sessionId}/{itemId}/thumb-{sortOrder}.jpg
Object key inside the `photos` bucket therefore = `photos/{sessionId}/{itemId}/...`.
`storage.foldername(name)` -> `{photos, sessionId, itemId}`; **sessionId = index [2]**
(Postgres arrays are 1-indexed). `usePhotoUrl.ts:24-26` reads via the same key, so
**no client change** is required — the migration matches the existing convention.

## Fix

New migration `20260527000001_scope_photos_storage_rls.sql`:

1. Drop the two over-permissive policies.
2. Recreate, scoped to ownership — same shape as the photos-table RLS:
   - **Admin** -> `FOR ALL` gated on `private.is_admin()`.
   - **Specialist** -> SELECT / INSERT / UPDATE / DELETE, each gated on
     `bucket_id = 'photos'` **and** the session in path-token [2] being owned
     (`sessions.created_by = auth.uid() OR sessions.assigned_to = auth.uid()`).
   - UPDATE is required because `upsert: true` UPDATEs an existing object; DELETE
     mirrors the photos-table delete policy.

## Out of scope

- No client code change (path convention unchanged).
- Prod-apply of the storage policies + admin audit is a user-owned Supabase
  dashboard step (same blocker shape as SEC-1) — flagged at hand-off, not done here.

## Verification

- Local migration apply succeeds (or `tsc -b` + smoke if no local supabase).
- Codex adversarial review per D-046 (Claude owns schema/auth; Codex reviews).
- Manual UAT deferred to end-of-sweep batch UAT (D-051).
