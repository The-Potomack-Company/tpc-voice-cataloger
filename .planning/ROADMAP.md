# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-9 + 5.1 (shipped 2026-03-17) -- See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Accounts & Deploy** -- Phases 11-21 (shipped 2026-03-31) -- See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 UI Overhaul** -- Phases 22-30 (shipped 2026-05-13 via PR #11) -- See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- [ ] **v1.3 Maturation** -- LIVE track. v3.0 hub cutover deferred 2026-05-27 (D-052) — apps matured independently before reconciling. Phases 31-40 queued from the 2026-05-27 audit + 2026-05-28 UAT findings + the audio-blob-persistence ask + the AI-proxy Cloudflare→Cloud Run migration (D-049). See pipeline section below.

## Phases

<details>
<summary>v1.0 MVP (Phases 1-9 + 5.1) -- SHIPPED 2026-03-17</summary>

- [x] Phase 1: Foundation (2/2 plans) -- completed 2026-03-06
- [x] Phase 2: Audio Capture (2/2 plans) -- completed 2026-03-06
- [x] Phase 3: Session Management (3/3 plans) -- completed 2026-03-06
- [x] Phase 4: Cataloging Modes (2/2 plans) -- completed 2026-03-06
- [x] Phase 5: AI Pipeline (5/5 plans) -- completed 2026-03-16
- [x] Phase 5.1: Measurements Field (2/2 plans) -- completed 2026-03-16 *(inserted)*
- [x] Phase 6: Review, Edit, Export (3/3 plans) -- completed 2026-03-16
- [x] Phase 7: Extension Batch Import (3/3 plans) -- completed 2026-03-09
- [x] Phase 8: Offline Queue (2/2 plans) -- completed 2026-03-16
- [x] Phase 9: Deferred Items (3/3 plans) -- completed 2026-03-17

</details>

<details>
<summary>v1.1 Accounts & Deploy (Phases 11-21) -- SHIPPED 2026-03-31</summary>

- [x] Phase 11: Supabase Foundation (2/2 plans) -- completed 2026-03-18
- [x] Phase 12: Authentication (3/3 plans) -- completed 2026-03-18
- [x] Phase 13: Account Management (2/2 plans) -- completed 2026-03-18
- [x] Phase 14: Data Migration (5/5 plans) -- completed 2026-03-20
- [x] Phase 15: Session Assignment (3/3 plans) -- completed 2026-03-20
- [x] Phase 16: Session Lifecycle (4/4 plans) -- completed 2026-03-20
- [x] Phase 17: Deployment & CI (4/4 plans) -- completed 2026-03-30
- [x] Phase 18: Walkthrough (3/3 plans) -- completed 2026-03-20
- [x] Phase 19: Photo Upload (5/5 plans) -- completed 2026-03-22
- [x] Phase 20: House Session Import Fix (2/2 plans) -- completed 2026-03-28
- [x] Phase 21: AI Granularity (3/3 plans) -- completed 2026-03-31

</details>

<details>
<summary>✅ v1.2 UI Overhaul (Phases 22-30) -- SHIPPED 2026-05-13</summary>

Mockup-faithful design system migration: unified tokens, LIB primitives, theme picker (light/dark/system), self-hosted fonts (EB Garamond/Inter/IBM Plex Mono), mockup-faithful Sessions/Recording/Review screens, motion + waveform, WCAG AA contrast guard, focus rings across all primitives. Shipped via PR #11 (single mega-PR; phases 22-30 SUMMARY.md preserved in milestones/v1.2-phases/).

- [x] Phase 22: Foundation Tokens (4/4 plans) -- completed 2026-04-30
- [x] Phase 23: Typography Pipeline -- completed 2026-05-12
- [x] Phase 24: Component Library -- completed 2026-05-12
- [x] Phase 25: Theme Toggle & Settings -- completed 2026-05-12
- [x] Phase 26: Mockup-Faithful Screens -- completed 2026-05-12
- [x] Phase 27: Motion & Live Feedback -- completed 2026-05-12
- [x] Phase 28: Specialist Screen Restyle -- completed 2026-05-12
- [x] Phase 29: Admin Screen Restyle -- completed 2026-05-12
- [x] Phase 30: A11Y Verification -- completed 2026-05-12

Known issues + follow-ups: `.planning/v1.2-known-issues.md`, `.planning/v1.2-followup.md`.

</details>

## v1.3 Maturation — Phases (LIVE)

Sourced from the 2026-05-27 audit (`docs/audit-consolidated-backlog-2026-05-27.md`) plus the 2026-05-28 UAT findings + the new audio-blob-persistence ask. Ordered by ship sequence: live-security first, then durability/perf, then quality/polish, then concurrency. Each phase ships independently with its own UAT + tests.

Ready to plan via `/gsd-discuss-phase` → `/gsd-plan-phase`.

- [x] **Phase 31: sec-profiles-self-update-hardening** *(P0 🔴 LIVE on prod)* (completed 2026-05-29)
  - From `_workspace/Urgent/sec-profiles-self-update-escalation.md`. Independent vector from SEC-1: any authenticated specialist can `PATCH /rest/v1/profiles?id=eq.<their-uid> {role:'admin'}` because UPDATE is granted on every profiles column to `authenticated`, the RLS UPDATE policy is not column-scoped, and no trigger guards `role`/`is_active`.
  - REVOKE broad UPDATE on `public.profiles` from authenticated + anon; GRANT UPDATE only on user-self-editable columns (`walkthrough_completed`, possibly `display_name`).
  - Add a BEFORE UPDATE trigger raising if a non-admin attempts to mutate `role` or `is_active` (defense in depth against future broad re-grants).
  - Verify existing admins list matches the known set (no prior self-promotion). Codex review (D-046).
  - Tests: as specialist, PATCH `{role:'admin'}` returns 403/no-op; PATCH `{walkthrough_completed:true}` still works; admin elevation only via the admin-only Edge Function path.
  - Risk: medium (RLS + trigger + grants), bounded blast radius.
  - **Plans:** 2 plans (1 wave, sequential)
    - [x] 31-01-PLAN.md — author migration (table-form REVOKE + narrow GRANT walkthrough_completed/theme + private guard trigger) + V-1 grant-assertion query
    - [x] 31-02-PLAN.md — Codex review (D-046) → [BLOCKING] db push --dry-run isolation + prod apply (D-07) → V-1/V-6 prod reads → db:types zero-diff (V-7) → Tier-2 smoke (walkthrough/theme/admin toggle)

- [x] **Phase 32: audio-blob-supabase-persistence** *(NEW 🟠 — durable audio, cross-device retry, audit trail)* (completed 2026-06-01)
  - Today audio blobs live only in Dexie. Lost on device wipe / browser cache clear; can't retry from a different device; AI-failure recovery is local-only.
  - Create a Supabase Storage `audio` bucket with RLS scoped to session owner (mirror the SEC-4 photos pattern, with the column-scope fix from Phase 31's Codex pass baked in).
  - On `db.audio.add`, push the blob to `audio/{sessionId}/{itemId}/{audioId}.opus` (or similar) in the background; record `storage_path` + upload status on the audio row.
  - `processAudioWithAi` reads from Supabase Storage when the local Dexie blob is missing, so retry-from-any-device works.
  - Surface upload state in UI (pending / uploaded / failed) so the user knows when audio is durable.
  - Cleanup policy: keep Supabase blobs for N days after item is `done`; purge on hard-delete (cascade via item delete).
  - Update `audioRecordsForItem` (DAT-7 union helper) to consider Supabase audio too, not just Dexie variants.
  - Tests: device A records, device B opens the same item and can retry AI; blob purged when item deleted; upload-pending audio shows in UI; cross-user RLS denies blob reads.
  - Risk: medium-high (new bucket + RLS + cross-device sync + Dexie hydration).
  - **Plans:** 5 plans (4 waves)
    - [x] 32-01-PLAN.md — author consolidated create_audio migration (table + bucket + column-scoped storage RLS + items.completed_at + pg_cron/pg_net + purge-old-audio job) + service-role purge-audio edge fn + schema.md update + RED Wave-0 test scaffolds
    - [x] 32-02-PLAN.md — [BLOCKING] Codex adversarial review (D-046) → db push --dry-run isolation + prod apply (D-08) → cross-user RLS deny proof (T-32-01) → db:types regen with the audio table
    - [x] 32-03-PLAN.md — client data layer: Dexie v10 audioUploadQueue + AudioUploadEntry/ItemAudio.sessionId + audioUploadQueue.ts (photo clone) + useAudioUploadStatus + extFromMime
    - [x] 32-04-PLAN.md — recorder sessionId thread + fire-and-forget enqueue (D-05) + processAudioWithAi Storage fallback (keyed by item_id) + items.completed_at on done (D-07) + audioRecordsForItem Supabase union
    - [x] 32-05-PLAN.md — deleteItem audio storage.remove (D-04 orphan-leak close) + ItemCard upload-status pill + failed-retry (D-06)

- [x] **Phase 33: offline-reliability** *(🟠 REL-1, REL-2, REL-3, REL-4)* (completed 2026-06-01)
  - REL-1: offline-queue drains on every `online` event with no backoff or attempt cap → retry storm. Add exponential backoff + persisted attempt counter (folds in the #17 net-abort-requeue follow-up).
  - REL-2: cross-tab/process concurrent drains burn duplicate Gemini spend + cause lost updates (CONCURRENCY=4 plus no cross-tab coordination). Add atomic `queued→processing` DB claim on items (D-01/D-03: DB-atomic claim, NO BroadcastChannel) + stale-claim reclaim.
  - REL-3: write-ahead queue blocks all later writes after the first permanent failure (console-only). Classify permanent vs transient errors; surface a blocked-count badge with detail.
  - REL-4: `useAudioRecorder.stopRecording()` never settles on `db.audio.add` reject → hang. Settle with error + keep the recorded blob for retry.
  - Tests: simulated 4-tab concurrent drain produces zero duplicate Gemini calls; permanent failure surfaces in UI; transient failure backs off; recorder always settles.
  - Risk: medium (offline queue is core; regressions here look like AI processing failures).
  - **Plans:** 5 plans (4 waves)
    - [x] 33-00-PLAN.md — [BLOCKING] one two-column items migration (claimed_at + ai_attempts) via the 4-step schema protocol + Phase-31 dry-run push gate + db:types regen; pure backoff.ts + aiErrorClass.ts helpers; Wave-0 test stubs (backoff, error-classify, blocked-badge RED)
    - [x] 33-01-PLAN.md — REL-1: replace MAX_RETRIES loop with persisted-attempt backoff-window skip + cap 5→failed in offlineQueue.ts (owns the file for REL-1)
    - [x] 33-02-PLAN.md — REL-2: DB-atomic claim (.eq queued .select) + stale-claim reclaim in offlineQueue.ts (depends_on 33-01, sequential same-wave to avoid file conflict)
    - [x] 33-03-PLAN.md — REL-3: classify-driven drop/continue vs halt in useWriteAheadQueue + BlockedQueueBadge (tone=err) next to OfflineIndicator
    - [x] 33-04-PLAN.md — REL-4: recorder onstop retry 2× then always-settle(undefined) + blob stash in recordingStore retry buffer

- [x] **Phase 34: ios-memory-optimization** *(🟠 PERF-1, PERF-2, PERF-3)* (completed 2026-06-01)
  - PERF-1: `blobToBase64` holds 2-3 full copies of multi-MB audio in memory → iOS PWA tab OOM. Chunked encode OR push the audio out-of-band (e.g. signed-URL upload to Gemini-compatible endpoint) so the worker doesn't need a giant base64 in memory.
  - PERF-2: continuous-mode master blob grows unbounded; re-materialized on every 15s append. (Lower priority — continuous gated off via D-050.) Switch to stream-append or segment-and-discard.
  - PERF-3: `ItemCard` has 2 live Dexie subscriptions × N items → re-render storm during recording. Hoist the queries up to a session-level provider; pass the per-item slice as props.
  - Tests: memory snapshot before/after a 5-minute single-mode session shows bounded growth; ItemCard render count during recording drops by ~Nx.
  - Risk: medium (touches hot paths).
  - **Plans:** 3 plans (2 waves) — PERF-1 chunked encoder + PERF-3 provider-hoist are disjoint files, parallel in Wave 1 after Wave-0 RED tests. PERF-2 deferred (D-04, continuous gated off via D-050). TDD mode ON.
    - [x] 34-00-PLAN.md — Wave 0 RED tests: multi-chunk base64 encoder test (guards 3-byte alignment) + render-count test scaffold (PERF-1, PERF-3)
    - [x] 34-01-PLAN.md — PERF-1: chunked 3-aligned `blobToBase64` (drop freshBlob re-wrap, D-02), shared by both gemini paths; PERF-2 deferred note (gemini.ts/geminiContinuous.ts)
    - [x] 34-02-PLAN.md — PERF-3: ItemList single aggregate useLiveQuery → primitive props; React.memo prop-driven ItemCard + dev render counter (D-08); D-09 memory-smoke runbook

- [ ] **Phase 35: ai-correctness-track-2** *(🟡 Track-2 quality)*
  - `temperature=0` on the Gemini call so the same input deterministically yields the same output. (Currently default sampling allows drift between identical retries.)
  - Confabulation guard: instruct the model to return `null` for fields it cannot extract from the audio; never invent a title/estimate when only a description was given. Validate via Zod + reject responses that fill clearly-empty fields.
  - No-clobber on AI retry: if the user edited a field between the initial AI call and the retry, the retry must NOT overwrite their value (matches the DAT-2 / DAT-4 spirit but for retries specifically).
  - Per-item retry visibility: ensure the Phase #31-shipped AI-failure banner (item detail) is also reflected on the list-view card (the existing badge is small + easy to miss).
  - Tests: deterministic-output snapshot tests; user-edited-field-survives-retry; confab-rejection on intentionally-empty input.
  - Risk: medium (prompt + Zod schema changes).

- [ ] **Phase 36: ux-visibility-polish** *(🟡)*
  - Export failures invisible (Codex #9, #10) → surface a toast with retry.
  - New session / import not transactional (Codex #7, #8) → wrap in a single Supabase RPC or rollback partial state on failure.
  - Migration success copy false (Codex #2) → align banner copy with the DAT-1 `partial` flag (use Phase 38's banner from the DAT-1 followup).
  - Silent fetch errors (Codex #27, #28) → catch-and-surface.
  - Admin role/account load silent failures (Codex #16-20) → use the same ErrorToast path that DAT-4 introduced.
  - Raw login errors (Codex #21) → friendlier copy ("Wrong email or password" not the Supabase JSON).
  - Tests: each error path produces a visible toast/state; no console-only failures.
  - Risk: low-medium (lots of small touchpoints).

- [ ] **Phase 37: a11y-foundation** *(🟡)*
  - Modal focus-trap + aria-modal primitive (Codex #33, #34, #48). Apply to every modal site.
  - 44px minimum touch targets across action buttons (Codex #46).
  - Icon-button tooltips/aria-labels for icon-only buttons (Codex #49).
  - Swipe-delete alternative affordance (Codex #32) — a long-press or explicit delete button so non-swipe-aware users can delete.
  - Tests: axe-core scan on representative pages clean; keyboard-only navigation completes the record/edit/save flow.
  - Risk: low (additive primitives).

- [ ] **Phase 38: migration-retryability** *(🟡 — promoted from 999.2, DAT-1 follow-up, builds on PR #24)*
  - `needsMigration()` returns true while any non-deleted Dexie session/item lacks an `idMapping` entry (today returns false as soon as ANY mapping exists, so a partial migration is treated as complete and the preserved recovery set is never re-offered).
  - Make `migrateToSupabase` idempotent: before inserting a session/item, look up `idMapping` by `oldId` and reuse the existing `newId` / skip the insert — so a retry over preserved rows can't create duplicate Supabase sessions/items.
  - Surface partial state in the UI using the `partial` flag DAT-1 already returns (migration banner: "N items not yet synced — Retry"; retry re-runs the migration).
  - Tests: retry-after-partial migrates only the remaining rows, creates no duplicates, banner reflects partial state.
  - Risk: medium (migration logic + migration banner UI).

- [ ] **Phase 39: optimistic-locking** *(🔴 — promoted from 999.3, DAT-3 — HIGH RISK, builds on PR #26 + DAT-1)*
  - Add an `items.updated_at` auto-bump-on-UPDATE Postgres trigger (before-update / moddatetime). New migration + update `../_workspace/Schema/schema.md`.
  - `updateItemField` (and the AI merge path) read `updated_at`, write with an `.eq("updated_at", <prev>)` precondition, and on a 0-row conflict re-read + reconcile instead of last-writer-wins.
  - Per-writer conflict policy: a user single-field edit re-applies on conflict (intent-preserving); the AI merge re-reads & re-merges and must NOT overwrite a field the user changed since the merge's read.
  - Optional: cross-tab/device version check (broadcast or version compare).
  - Conflicts surface to the user via the DAT-4 ErrorToast.
  - Tests: a live user edit racing an AI continuous-mode chunk write does not silently lose the user's edit; cross-writer conflicts are handled, not dropped.
  - Risk: HIGH (concurrency + DB trigger + reconciliation) — a careless partial implementation can silently drop writes, so this needs careful planning + UAT.

- [ ] **Phase 40: ai-proxy-cloud-run-migration** *(🟠 cross-app infra — cut AI traffic off the Cloudflare Worker onto the shared GCloud proxy)*
  - **What:** repoint this app's AI calls from the local Cloudflare Worker (`proxy/` → `tpc-gemini-proxy`) to the shared **`tpc-ai-proxy`** Cloud Run service (the-potomack-company / GCP project `gen-lang-client-0662587427`, us-east1) that now fronts AI for all TPC projects. Then retire the in-repo Worker.
  - **Decision basis:** D-056 (this migration — timing + auth), D-013 (one centralized proxy), D-049 (host = Cloud Run, overrides D-013's CF host), D-053 (deployment bindings, Phase 39a stood the service up for the extension), D-043 (GCP consolidation target). The extension already migrated in Phase 39a; this is the cataloger's turn.
  - **Timing note (D-056):** D-049 framed the cataloger's move as *post-v3.0*. D-052 (2026-05-27) deferred the hub cutover and freed apps to mature independently, so doing it now in v1.3 is consistent with D-052 — it lands ahead of D-049's stated sequence (D-056 amends that timing; flagged, not a blocker).
  - **Mechanics (app side):** `VITE_GEMINI_PROXY_URL` (consumed by `src/services/gemini.ts` + `src/services/geminiContinuous.ts`) repoints to the Cloud Run prod URL `https://tpc-ai-proxy-prod-588770300226.us-east1.run.app/` (dev → `…-dev-…`). The request/response contract stays identical (same JSON shape, `gemini-2.5-flash`, 25 MB body cap) so it's a config-level cutover, not a payload reshape.
  - **Proxy side:** add the cataloger's production + Vercel-preview **web origins** to the Cloud Run service `ALLOWED_ORIGINS` (today it allowlists extension IDs only). Coordinate via `tpc-ai-proxy` repo — this is the cross-app touch.
  - **Auth contract — LOCKED (D-056): preserve JWT.** The cataloger's CF Worker enforces a **Supabase JWT** (`verifyAuth` → `/auth/v1/user`); that guarantee is kept. D-014's bearer-verify is **implemented on the Cloud Run proxy as part of this phase** (pulled forward from its 39b/post-v3.0 slot) so the cataloger never falls back to the proxy's interim origin+quota-only posture. Auth plumbing is Claude-owned, Codex barred (D-046).
  - Retire `proxy/` (CF Worker) only after the Cloud Run path is verified in prod; keep one rollback commit. Update `.env.example`, the proxy-URL tests (`src/tests/gemini-pipeline.test.ts`, `src/tests/geminiContinuous.test.ts`), and remove the `wrangler`/`tpc-gemini-proxy` workspace bits.
  - **Cross-app:** touches both this repo and `tpc-ai-proxy`. Consider driving via `/tpc-coordinate` rather than single-repo GSD if the proxy-side `ALLOWED_ORIGINS` + (optional) JWT-verify work is non-trivial.
  - Tests: AI processing succeeds against the Cloud Run URL in dev + prod; unauthorized/cross-origin caller is rejected per the chosen auth model; `VITE_GEMINI_PROXY_URL`-unset still fails closed.
  - Risk: medium (config cutover is low-risk; the auth-model choice + cross-app `ALLOWED_ORIGINS` coordination is where the care goes).

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-9 + 5.1 | v1.0 | 27/27 | Complete | 2026-03-17 |
| 11-21 | v1.1 | 36/36 | Complete | 2026-03-31 |
| 22-30 | v1.2 | All | Complete (shipped in PR #11) | 2026-05-13 |
| 31-40 | v1.3 | 0/10 | Queued — none planned | — |

## v1.2 Phase Detail

### Phase 22: Foundation Tokens
**Goal**: Replace Tailwind 4 `@theme` color/font/radius variables with the unified TPC token set so every styling decision flows from one source.
**Depends on**: None
**Requirements**: TOKENS-01, TOKENS-02, TOKENS-04
**Success Criteria** (what must be TRUE):
  1. `src/index.css` (or equivalent) exposes the full unified token set from `tpc-unified-tokens.css`; no hardcoded oklch / hex / font-family literals remain in `src/` outside `src/ui/tokens/`.
  2. Wrapping the app shell in `tpc tpc-dark` (or matching the OS `prefers-color-scheme: dark`) flips every surface and ink value without any extra component-level work.
  3. CI fails the build when a TS/TSX/CSS file outside `docs/design-handoff/` introduces a hex code, `oklch(...)` literal, or named font-family string.
  4. The existing screens still render (visually unrefined is acceptable -- correctness gate is "no broken styling"), proving the token swap is non-destructive.
**Plans**:

**Wave 1** *(token files installed; precondition for everything else)*
- [x] 22-01-token-scaffold-PLAN.md -- Install canonical token CSS/TS at src/ui/tokens/ + clear pwa-manifest hex literal -- completed 2026-04-30

**Wave 2** *(blocked on Wave 1 completion; Plans 02 and 03 run in parallel — disjoint files)*
- [x] 22-02-bridge-dark-variant-PLAN.md -- Wire token imports + @custom-variant dark + @theme inline bridge in src/index.css; .tpc class + pre-paint script + paired theme-color in index.html -- completed 2026-04-30
- [x] 22-03-init-theme-runtime-PLAN.md -- src/ui/tokens/initTheme.ts runtime listener + main.tsx wiring + jsdom unit test -- completed 2026-04-30

**Wave 3** *(blocked on Waves 1 + 2 — guard runs only after pre-existing #2563eb literal cleared and legacy @theme block removed)*
- [x] 22-04-tokens-04-guard-PLAN.md -- TOKENS-04 Vitest filesystem regex sweep with three patterns + narrow allowlist -- completed 2026-04-30

**Cross-cutting constraints** *(must_haves shared across 2+ plans):*
- `.tpc-dark` class on `<html>` is the single dark-mode signal — pre-paint inline script (Plan 02) and runtime `initTheme` (Plan 03) both manipulate it idempotently
- Phase 22 stays system-pref-only — no localStorage, no Supabase, no toggle UI (Plans 02, 03)
- `@theme inline` (NOT `@theme`) for the bridge so `.tpc-dark`-scoped overrides reach utilities (Plan 02; honored by Plan 04's allowlist for `src/ui/tokens/**`)

**Estimated plan count**: 4
**UI hint**: yes

### Phase 23: Typography Pipeline
**Goal**: Self-host EB Garamond / Inter / IBM Plex Mono via `@fontsource` and expose them as the display, UI, and metadata stacks.
**Depends on**: Phase 22
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04
**Success Criteria** (what must be TRUE):
  1. Production network panel shows zero requests to `fonts.googleapis.com` or `fonts.gstatic.com`; all font files are served from the app origin.
  2. EB Garamond 400 / 400 italic / 500 italic, Inter 400 / 500 / 600, and IBM Plex Mono 400 / 500 are all observable on screens that consume them (visible italic display title, mono receipt numbers, etc.).
  3. A `tnum` utility class enables tabular-numeric figures wherever the mockups call for monospaced numbers (timers, counts, item numbers).
  4. Bundle size delta is documented in the phase transition notes (font subset / preload strategy chosen).
**Plans**: TBD
**Estimated plan count**: 2
**UI hint**: yes

### Phase 24: Component Library
**Goal**: Ship reusable design-system primitives in `src/ui/` and migrate all screens off ad-hoc inline styles for these element types.
**Depends on**: Phase 22, Phase 23
**Requirements**: LIB-01, LIB-02, LIB-03, LIB-04, LIB-05, LIB-06, LIB-07
**Success Criteria** (what must be TRUE):
  1. `src/ui/` exports `Button`, `Badge`, `Input`, `Card`, `Eyebrow`, `Bar`, and `Placeholder` primitives that match the rules in `tpc-unified-base.css`.
  2. `Button` exposes primary / secondary / ghost / danger variants and sm / md sizes; `Badge` exposes default / ok / warn / err / info tones with optional dot indicator; `Bar` exposes accent / warn / ok / err semantic slots at the 4 px height.
  3. A repo-wide grep finds zero remaining inline `<button>`, `<input>`, hand-rolled badge `<span>`, or hatched-placeholder ad-hoc styles in app screens -- only LIB primitives remain.
  4. Storybook (or an equivalent visual playground page mounted at `/dev/ui`) renders every variant for review.
**Plans**: TBD
**Estimated plan count**: 4
**UI hint**: yes

### Phase 25: Theme Toggle & Settings
**Goal**: Let users explicitly choose Light / Dark / System theme from Settings, persist the choice per-user, and surface the option in the walkthrough.
**Depends on**: Phase 22, Phase 24
**Requirements**: TOKENS-03, A11Y-03
**Success Criteria** (what must be TRUE):
  1. Settings screen shows a Light / Dark / System segmented control built from LIB primitives; selecting a value flips the app shell instantly.
  2. The chosen theme persists across browser reload for signed-in users (Supabase user record) and pre-auth users (`localStorage` fallback).
  3. The role-aware walkthrough includes a step pointing out the new theme toggle, and that step's seen-state persists per-user using the same model as existing walkthrough steps.
**Plans**: TBD
**Estimated plan count**: 2
**UI hint**: yes

### Phase 26: Mockup-Faithful Screens
**Goal**: Restyle the three mocked screens (Sessions, Recording, Review) and the bottom-tab chrome to match `tpc-voice.jsx` exactly, using only LIB primitives.
**Depends on**: Phase 24
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-10
**Success Criteria** (what must be TRUE):
  1. Sessions list renders date-grouped sections with paired Sale (S) / House (H) tiles in `accent-wash` / `sand-wash`, mono session IDs, status badges, active-recording dot, and search-with-filter chip indistinguishable from the mockup at the same viewport.
  2. Recording screen renders eyebrow + italic display title, current-item card with live transcript caret, full-width waveform area (waveform behavior arrives in Phase 27), tnum elapsed timer, and the hero red stop button with accent-halo shadow flanked by side controls.
  3. Review screen renders sticky header with sync action, three-stat progress strip with mini bars, and an item list with status dots (`ok` / `warn` / `err`), mono item numbers, two-line excerpt clamp, tnum durations, status pills, and ghost play button.
  4. Bottom-tab navigation renders with the new icon set, accent active-state color, and density -- tab structure and routes unchanged.
**Plans**: TBD
**Estimated plan count**: 4
**UI hint**: yes

### Phase 27: Motion & Live Feedback
**Goal**: Add live recording motion (pulse + real audio waveform) and consistent route transitions, all gated by `prefers-reduced-motion`.
**Depends on**: Phase 26
**Requirements**: MOTION-01, MOTION-02, MOTION-03, MOTION-04
**Success Criteria** (what must be TRUE):
  1. While a session is recording, the recording badge visibly pulses with an accent-halo expansion at a steady cadence.
  2. The Recording screen waveform reflects real microphone amplitude via Web Audio API -- recent bars in accent, older bars decay to ink-4 -- and updates in real time.
  3. Top-level route transitions complete in under 250 ms with a consistent cross-fade or slide.
  4. With `prefers-reduced-motion: reduce` set, the pulse stops, the waveform falls back to a static recording-active glyph, and route transitions become instant -- verified by an end-to-end test or manual checklist captured in the phase transition.
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [ ] 35-01-PLAN.md — Wave 0: Dexie v11 userEditedFields store + 4 RED test files (SC-1..SC-4)
- [ ] 35-02-PLAN.md — D-01/D-02: temperature:0 on both AI paths (determinism, SC-1)
- [ ] 35-03-PLAN.md — D-07/D-08: lift AiFailureBanner to shared component, render on ItemCard (SC-4)
- [ ] 35-04-PLAN.md — D-03..D-06: confab guard (single-shot) + Dexie no-clobber retry filter (SC-2, SC-3)

### Phase 28: Specialist Screen Restyle
**Goal**: Extrapolate the design system onto the unmocked specialist-facing surfaces (item detail/edit, login, walkthrough overlay) with a discuss-step approval before implementation.
**Depends on**: Phase 24
**Requirements**: SCREEN-04, SCREEN-08, SCREEN-09
**Success Criteria** (what must be TRUE):
  1. Item detail / edit view renders transcript, editable structured fields (title, description, condition, estimate, category, measurements), photo grid (house mode), and re-record action -- all from LIB primitives with the new typographic hierarchy and no ad-hoc styling.
  2. Login screen uses the new tokens and italic display headline; routing, copy, and form behavior unchanged.
  3. Role-aware walkthrough overlay matches the new visual language (cards, eyebrows, accent buttons) while preserving step copy and step structure from v1.1.
  4. Each screen's proposed treatment is reviewed in a discuss step (recorded in the plan) before implementation begins.
**Plans**: TBD
**Estimated plan count**: 3
**UI hint**: yes

### Phase 29: Admin Screen Restyle
**Goal**: Extrapolate the design system onto the admin-facing surfaces (accounts, assignments, review queue) with discuss-step approval before implementation.
**Depends on**: Phase 24
**Requirements**: SCREEN-05, SCREEN-06, SCREEN-07
**Success Criteria** (what must be TRUE):
  1. Admin accounts screen renders the specialist list, create/deactivate actions, and role tags using LIB primitives -- no inline styles for these element types remain.
  2. Admin assignments view renders the receipt-list import flow, session creation, and specialist assignment using the new visual language.
  3. Admin review queue renders submitted sessions with edit / return-with-notes / export actions and status tracking, consuming the new badge tones for status.
  4. Each screen's proposed treatment is reviewed in a discuss step before implementation begins.
**Plans**: TBD
**Estimated plan count**: 3
**UI hint**: yes

### Phase 30: A11Y Verification
**Goal**: Verify WCAG AA contrast across both token sets and ensure every interactive primitive shows a visible focus ring.
**Depends on**: Phase 22, Phase 24, Phase 26, Phase 27, Phase 28, Phase 29
**Requirements**: A11Y-01, A11Y-02
**Success Criteria** (what must be TRUE):
  1. `src/ui/__tests__/contrast.test.ts` enumerates every ink-on-bg combination in the light and dark token sets and asserts WCAG AA thresholds (4.5:1 body, 3:1 large text); CI fails on regressions.
  2. Every interactive primitive (Button, Input, Badge-as-button, Card-as-link) renders the accent border + accent-wash glow focus ring on `:focus-visible` -- verified by a focus-ring smoke test or manual checklist captured in the phase transition.
  3. No screen ships with a contrast or focus-ring failure outstanding; any waiver is documented in the milestone close-out.
**Plans**: TBD
**Estimated plan count**: 2
**UI hint**: yes

### Phase 35: ai-correctness-track-2
**Goal**: Make the Gemini cataloging pipeline deterministic, non-confabulating, retry-safe, and visibly-failed via four narrow correctness fixes to the existing AI extraction path — without crossing into Phase 39's optimistic-locking lane.
**Depends on**: Phase 31 (AI-failure banner shipped on item detail; this phase mirrors it onto the list card)
**Requirements**: none mapped (Track-2 quality track)
**Success Criteria** (what must be TRUE):
  1. Both AI paths (`src/services/gemini.ts`, `src/services/geminiContinuous.ts`) set `temperature: 0`; a deterministic-output snapshot test proves identical input yields identical output across retries.
  2. A post-Zod confabulation guard rejects the whole response (writes no catalog fields, sets `ai_status="failed"`) when the model returns a null/whitespace/unintelligible `transcript`; a confab-rejection test on intentionally-empty input passes.
  3. An AI retry never overwrites a field the user edited between the initial call and the retry, enforced by client-side per-field provenance in Dexie (no Supabase schema change, no `updated_at` machinery); a user-edited-field-survives-retry test passes.
  4. The list-view `ItemCard` shows a full-width inline AI-failure warning row (icon + copy + Retry CTA) mirroring the detail-view banner, rendered only when `ai_status === "failed"`.
**Plans**: TBD
**Estimated plan count**: 3
**UI hint**: yes

## Backlog

### Phase 999.1: Stream photos from Supabase Storage during extension import (BACKLOG)

**Goal:** Replace base64-embedded photos in export JSON with Supabase Storage URLs fetched on demand during extension import. Current approach embeds all photos as base64, which balloons to 200-450MB for typical house visits (100-300 items x multiple photos). With Storage URLs, export JSON drops to ~500KB and photos stream one at a time during import. Requires: export emits storage paths/signed URLs instead of base64 blobs, importController fetches URL->blob->File before injection. Supabase Storage infra already exists from Phase 19.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
