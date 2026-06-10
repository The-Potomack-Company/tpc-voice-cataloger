# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-9 + 5.1 (shipped 2026-03-17) -- See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Accounts & Deploy** -- Phases 11-21 (shipped 2026-03-31) -- See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 UI Overhaul** -- Phases 22-30 (shipped 2026-05-13 via PR #11) -- See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Maturation** -- Phases 31-45 (shipped 2026-06-04) -- See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- 📋 **v1.4 Photo Notes** -- Phases 46-50 (planned 2026-06-10, intent locked with user) -- batch photo capture of handwritten notes → Gemini segmentation → draft items → review queue → confirmed session items. Requirements: [milestones/v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md) · Risks: [milestones/v1.4-RISKS.md](milestones/v1.4-RISKS.md). Carry-ins: accepted tech-debt backlog in `milestones/v1.3-MILESTONE-AUDIT.md` (not in v1.4 scope).

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

<details>
<summary>✅ v1.3 Maturation (Phases 31-45) -- SHIPPED 2026-06-04</summary>

Security/durability/quality maturation: profiles RLS hardening, durable cross-device audio persistence, offline reliability, iOS memory, AI correctness, UX visibility, a11y foundation, retryable migration, optimistic locking, AI-proxy Cloud Run cutover + CI hardening, pending-stranding recovery, audio-upload reliability, photo-migration collision fix, visibility UX polish, and the SEAM-3 AI-write precondition fix. Verdict: tech_debt (no blockers); all integration seams wired; live UAT passed. Full detail + accepted tech-debt backlog in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) + [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md).

- [x] Phase 31: sec-profiles-self-update-hardening -- completed 2026-05-29
- [x] Phase 32: audio-blob-supabase-persistence -- completed 2026-06-01
- [x] Phase 33: offline-reliability -- completed 2026-06
- [x] Phase 34: ios-memory-optimization -- completed 2026-06
- [x] Phase 35: ai-correctness-track-2 -- completed 2026-06
- [x] Phase 36: ux-visibility-polish -- completed 2026-06
- [x] Phase 37: a11y-foundation -- completed 2026-06
- [x] Phase 38: migration-retryability -- completed 2026-06 (live UAT 2026-06-04)
- [x] Phase 39: optimistic-locking -- completed 2026-06
- [x] Phase 40: ai-proxy-cloud-run-migration -- completed 2026-06-02
- [x] Phase 40.1: harden-ai-proxy-deploy-ci -- completed 2026-06-03 *(inserted, urgent)*
- [x] Phase 41: ai-pending-stranding -- completed 2026-06-04 *(urgent lane)*
- [x] Phase 42: audio-upload-reliability -- completed 2026-06-04 (live UAT)
- [x] Phase 43: photomigration-itemid-collision -- completed 2026-06-04
- [x] Phase 44: visibility-ux-polish -- completed 2026-06-04 (live UAT)
- [x] Phase 45: ai-write-precondition -- completed 2026-06-04 *(SEAM-3 fix)*

</details>

## v1.4 Photo Notes (Phases 46-50) — IN PLANNING

**Intent (locked 2026-06-10):** From the session detail screen, the cataloger photographs handwritten notes (multiple pages), hits process once, and the app creates session items with fields filled from what was written. Flow shape modeled on continuous capture: capture stream → segmentation → items. Locked decisions:

- **Vision/OCR:** Gemini via the existing `tpc-ai-proxy` Cloud Run service and the existing TPC key (`gemini-2.5-flash` is already multimodal — images use the same `inlineData` mechanism as audio). No new API enablement, no new billed resources. Anything that would change that is a **BILLING item** — surface for user triage, never provision (see v1.4-RISKS.md R-6).
- **Capture flow:** batch + auto-segment — N photos in one process action → model segments into M items and fills fields per item.
- **Review gate:** OCR-created items land as **drafts in a review queue**; the user confirms/edits each before it becomes a real session item. Drafts never reach the items table, the export JSON, or the extension import path.

**Relationship to D-050 (continuous mode disabled):** photo-notes ships **independent of the continuous-mode rework**. It reuses the *single-shot* pipeline patterns — `gemini.ts` service shape (JWT → proxy → Zod-validated structured response), `preconditionUpdate` optimistic locking (Phase 39/45), the upload-queue pattern (Phases 19/32), and the Phase 37 Modal/review primitives — and does **not** touch `geminiContinuous.ts` or any dormant continuous code. The four D-050 hazards (WebM byte-splicing, `liveItemId` merge race, wake-phrase replay, dropped-chunk retry) are all audio-streaming-specific; batch photo processing has no streaming chunks, no live-item pointer, and no wake phrase. Cost is bounded: one Gemini call per explicit user action (vs ~480/2h in continuous mode).

**Cross-job dependency:** a parallel job (00-urgent-20260610-150427-tpc-extension) is auditing the extension-side session import contract. Phase 49 consumes its findings; the draft-item schema is planned against the cataloger's existing item schema (`src/db/database.types.ts:339-424`, `../_workspace/Schema/schema.md`) so promoted items satisfy the export contract (`src/db/types.ts:148-173`) by construction.

### Phase 46: photo-notes-capture-ui

**Goal**: The cataloger can photograph multiple pages of handwritten notes from the session detail screen, see/reorder/retake/delete them as a page list, and reach an enabled "Process" action — entirely client-side (Dexie), so the phase ships with zero schema or proxy changes. Full SPEC: `milestones/v1.4-phases/46-photo-notes-capture-ui/46-SPEC.md`.
**Depends on**: nothing (first v1.4 phase; reuses PhotoCapture/resizeImage/Modal/Button primitives as analogs)
**Requirements**: PHN-01, PHN-02
**Success Criteria** (what must be TRUE):

  1. Session detail (active, non-read-only sessions, both modes) shows a "Photo notes" entry point; read-only sessions (submitted/exported, specialist-view) hide it.
  2. Capture loop: rear-camera capture (`<input capture="environment">`, same mechanism as PhotoCapture — no getUserMedia) appends pages to a thumbnail list; pages can be reordered, retaken, and deleted before processing.
  3. Pages persist in Dexie (`notePages` table, schema bump) keyed by session — navigating away and returning, or going offline, loses nothing.
  4. "Process N pages" button exists, shows page count, and is disabled offline with an explanatory hint (processing is online-only; capture is offline-capable). In Phase 46 it terminates in a stub (wired to the real pipeline in Phase 47).
  5. A11y holds the Phase 37 bar: focus-trapped modal/screen, 44px touch targets, labeled icon buttons.

**UAT sketch:** on a phone, open an active session → capture 3 note pages → reorder page 2 to front → delete one → kill the tab → reopen: pages intact in order → airplane mode: capture still works, Process disabled with hint.
**Plans**: TBD (`/gsd-discuss-phase 46` → `/gsd-plan-phase 46`; SPEC already written)

### Phase 47: photo-notes-vision-segmentation

**Goal**: One "Process" tap sends the captured pages to Gemini through the existing tpc-ai-proxy and lands M draft items (segmented + fields filled + per-field confidence) in a new `item_drafts` table — server-persisted, session-scoped RLS, never touching `items`. Wave 0 carries the schema migration (`item_drafts`, optionally `note_pages` for durable page storage — see R-4); schema change is a cross-app event: update `../_workspace/Schema/schema.md` + `Schema/migrations.md` first, regenerate `database.types.ts` via `npm run db:types` (D-046: Claude owns schema plumbing).
**Depends on**: Phase 46 (pages in Dexie), tpc-ai-proxy contract (verify it forwards multi-image `inlineData` payloads unchanged — see R-6)
**Requirements**: PHN-03, PHN-04, PHN-09, PHN-10
**Success Criteria** (what must be TRUE):

  1. New `src/services/processNotesWithAi.ts` mirrors the `gemini.ts` single-shot shape: `ensureFreshSession()` JWT → POST proxy (`VITE_GEMINI_PROXY_URL`) with `system_instruction` (segmentation prompt encoding TPC title/description/measurements conventions), N `inlineData` image parts, `generationConfig` `temperature: 0` + `responseSchema` (array of draft items) → Zod validation → `item_drafts` insert. 60s timeout, AbortController, retryable on failure.
  2. Per-field confidence is returned by the model; fields under the threshold land **blank + flagged** (`low_confidence` markers persisted per draft) — never a guessed value (PHN-04). Raw page OCR text persists per draft (transcript analog) so the reviewer can see what was written.
  3. Payload respects the proxy 25 MB body cap: pages resized (maxDimension ~2048, JPEG — higher than item photos for handwriting legibility) and batch size capped in the UI with a clear "split your batch" message when exceeded (no silent truncation).
  4. Drafts are invisible to every existing items consumer: item list, counts, AI claim/queue logic, export JSON, extension import (verified by test).
  5. Failures surface via the shared ErrorToast path (Phase 36) and the batch is retryable without duplicating drafts (idempotency key per process action).

**UAT sketch:** capture 2 pages holding ~3 handwritten items → Process → within ~30s the review queue shows 3 drafts with title/description filled, sloppy fields blank+flagged; pull network mid-process → error toast, retry succeeds, no duplicate drafts.
**Plans**: TBD

### Phase 48: draft-review-queue

**Goal**: Drafts are reviewable: a queue UI on session detail shows pending drafts; each can be edited field-by-field (inline `EditableField` pattern), confirmed (promote → real item via the existing create path, `ai_status='done'`, ordered `sort_order`), or discarded. Promotion is the **only** way a draft becomes an item.
**Depends on**: Phase 47 (`item_drafts` populated)
**Requirements**: PHN-05, PHN-06, PHN-08
**Success Criteria** (what must be TRUE):

  1. Session detail surfaces a draft-review queue (count badge + list) when drafts exist; low-confidence/blank fields are visibly flagged per draft.
  2. Confirm promotes the draft through the existing item-creation path (`sessionStore.createItem` shape + field writes via `preconditionUpdate`), sets `ai_status='done'`, appends `sort_order`, marks the draft `promoted`; discard marks it `discarded`. Both are individually actionable; bulk-confirm exists only for drafts with zero flagged fields.
  3. Sale mode: `receipt_number` always requires explicit reviewer confirmation (pre-filled but must be touched/acknowledged); a duplicate within the session surfaces the named duplicate-receipt error (Phase 44 pattern + DAT-8 partial unique constraint) inline, blocking promotion until fixed.
  4. Drafts never auto-promote — no path creates an item without a reviewer action (aligns with the existing "Auto-publish without review" out-of-scope line).
  5. Promoted items are indistinguishable from manually created items everywhere downstream (item list, export, extension import).

**UAT sketch:** from Phase 47's drafts: edit a flagged estimate → confirm → item appears in the session list and in export JSON; discard a garbage draft → gone, no item; sale session: try promoting two drafts with the same receipt number → named error blocks the second.
**Plans**: TBD

### Phase 49: import-contract-alignment

**Goal**: Close the loop with the extension-side import contract audit (parallel job 00-urgent-20260610-150427-tpc-extension): diff the promoted-item field set against the audited contract, fix any gap (field presence, formatting conventions — ALL-CAPS title, "the"-leading description, N×N×N measurements), and add a contract regression test so OCR-originated items can never break extension import.
**Depends on**: Phase 48 (promotion live), extension audit findings (external input — if not yet delivered, phase blocks on it, not on code)
**Requirements**: PHN-07
**Success Criteria** (what must be TRUE):

  1. A documented field-by-field mapping exists: draft schema → items schema → export JSON → extension import expectations, with the per-field "OCR can/cannot reliably produce" verdict mirrored from v1.4-RISKS.md (R-2).
  2. Export JSON containing promoted items round-trips through the extension import path (or its audited contract fixture) without error.
  3. A regression test pins the export shape for OCR-originated items (presence + formatting of the 8 catalog fields, receiptNumber, sortOrder).
  4. Any contract gap OCR cannot satisfy is either fixed in the prompt/review-gate (preferred) or explicitly documented as requiring reviewer input (flagged field in Phase 48 UI).

**UAT sketch:** catalog a sale session purely from photo notes → confirm drafts → export → import into the extension on an RFC lot page → fields land correctly.
**Plans**: TBD

### Phase 50: photo-notes-e2e-uat

**Goal**: End-to-end hardening and live UAT of the whole lane: multi-page real-handwriting sessions on real devices (iOS Safari + Android Chrome), offline-capture/online-process transitions, error/retry paths, cost sanity check on the existing key, and a milestone-close UAT walk mirroring the v1.3 pattern.
**Depends on**: Phases 46-49
**Requirements**: PHN-01..PHN-10 (verification pass)
**Success Criteria** (what must be TRUE):

  1. E2E test (mocked proxy) covers capture → process → review → promote → export.
  2. Live UAT on both mobile platforms with genuinely messy handwriting passes the per-phase UAT sketches; accuracy findings feed threshold tuning (R-1) rather than silent acceptance.
  3. Gemini usage at realistic volume (e.g. 100-item house visit ≈ pages/12 calls) measured and recorded; if cost/quota pressure on the existing key surfaces, it is logged as a BILLING item for user triage — not provisioned around.
  4. v1.4 milestone audit + archive per the v1.3 pattern (ROADMAP/REQUIREMENTS archived to `milestones/`).

**UAT sketch:** full live run: photograph a real notepad (5+ pages, ~10 items) at phone-camera quality → process → review/correct → confirm all → export → extension import — single sitting, no dev tools.
**Plans**: TBD

## Progress

| Milestone | Phases | Status | Completed |
|-----------|--------|--------|-----------|
| v1.0 MVP | 1-9 + 5.1 | ✅ Shipped | 2026-03-17 |
| v1.1 Accounts & Deploy | 11-21 | ✅ Shipped | 2026-03-31 |
| v1.2 UI Overhaul | 22-30 | ✅ Shipped (PR #11) | 2026-05-13 |
| v1.3 Maturation | 31-45 | ✅ Shipped | 2026-06-04 |
| v1.4 Photo Notes | 46-50 | 📋 Planned 2026-06-10 | — |

## Backlog

### Phase 999.1: Stream photos from Supabase Storage during extension import (BACKLOG)

**Goal:** Replace base64-embedded photos in export JSON with Supabase Storage URLs fetched on demand during extension import. Current approach embeds all photos as base64, which balloons to 200-450MB for typical house visits (100-300 items x multiple photos). With Storage URLs, export JSON drops to ~500KB and photos stream one at a time during import. Requires: export emits storage paths/signed URLs instead of base64 blobs, importController fetches URL->blob->File before injection. Supabase Storage infra already exists from Phase 19.
**Requirements:** TBD
**Plans:** 1/1 plans complete

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)
