# v1.4 migration — dispatch-ready packet (locked 2026-06-11, cockpit session)

Queue paused by user 2026-06-11 (usage conservation). Dispatch each phase manually:
`brain-enqueue ~/Projects/TPC/tpc-voice-cataloger --prompt "<phase block below + LOCKED CONTEXT>"`

## LOCKED CONTEXT (paste into every dispatch)
- Full migration off Vercel+Supabase to GCP project gen-lang-client-0662587427 "Potomack
  App", domain app.potomackco.com (Firebase Hosting — already deployed + CNAME live).
- NO data migration: fresh start, schema-only (all prod data confirmed exported 2026-06-11).
- Dashboard repo + crm-poll = mockups, pruned; real poller lands with CRM later.
- Architecture: PostgREST on Cloud Run over Cloud SQL (db-f1-micro) bridges the ~50
  existing supabase-js CRUD call sites (URL+JWT swap); NEW server code goes in
  cataloger-api (Cloud Run, tpc-ai-proxy conventions). Auth = Firebase from day 1
  (Google SSO domain-restricted per D-061) since data sits behind the new layer.
- Storage: Firebase Storage for photos/audio buckets (client-SDK resumable uploads fit
  the offline queues; rules mirror per-session RLS scoping). purge-audio + admin-* edge
  functions move into cataloger-api.
- ai-proxy: dual-accept Supabase+Firebase JWTs during cutover window (extension/hub
  consumers must not blink).
- Cutover: staff switch when auth phase lands; Vercel+Supabase frozen ~1 week as
  rollback, then decommissioned (kill any paid plans).
- Billing rail: worker cannot run gcloud/firebase — provisioning steps go in PROVISION.md
  at repo root for user execution (Cloud SQL create = the billing card, db-f1-micro,
  per D-078). Local dev/tests on Docker postgres.
- v1.4 Phase 47 (segmentation + drafts) re-plans AFTER migration phases: Firebase-JWT
  native, text-only drafts (fields + page refs, images stay in Dexie, NO GCS).

## Phase order
1. AUTH: Firebase SSO login (Google IdP enabled already; add potomackco.com to authorized
   domains), roles/profiles port to new layer, login UI swap, ai-proxy dual-JWT.
2. SCHEMA+DATA PATH: Cloud SQL provision (user), schema port from supabase/migrations
   (cataloger tables only — items, audio, photos, sessions, profiles, export_history,
   analytics_events), PostgREST on Cloud Run, client URL/JWT swap.
3. STORAGE+FUNCTIONS: Firebase Storage buckets + rules, upload queues repoint,
   admin-*/purge-audio into cataloger-api, CI deploy workflow (replace Vercel git deploy).
4. CUTOVER: smoke, staff switch, freeze Vercel/Supabase, decommission after ~1 week.
5. Phase 47 re-plan + execute (Firebase-native, locks above).

GSD: insert these as phases ahead of 47 in .planning/ROADMAP.md (gsd-phase insert) or
run as prompt-dispatches with this packet. Decision trail: TPC _workspace/Decisions/
D-078/D-080 + pending drafts (architecture + this restructure) in _drafts.md.

## PHASE 2 HARD REQUIREMENT (added 2026-06-11 post phase-1 review)
Client-side hd gate is UX only — Firebase client config is public, popup gate is
bypassable. SERVER-SIDE FAIL-CLOSED is load-bearing: a Workspace custom claim
(workspace=potomackco.com) minted by admin SDK on first login (minimal cataloger-api
endpoint), and EVERY Firebase-JWT consumer (PostgREST role mapping, cataloger-api,
tpc-ai-proxy) REJECTS Firebase tokens lacking the claim. Auth flag stays supabase for
staff until this lands. Phase 1 shipped dark: b1150c3 (PR #36, 4 review rounds).

## CUTOVER GATE (added 2026-06-12, user)
Staff actively use the Vercel/Supabase app during the migration window — fresh working
data accumulates AFTER the 2026-06-11 "everything exported" confirmation. Before the
Vercel/Supabase freeze: (1) no active cataloging session in flight (check sessions table
activity / ask staff), (2) every session created since 2026-06-11 confirmed exported to
the systems of record. Then freeze. The 2026-06-12 live session specifically: wait for
completion + export.
