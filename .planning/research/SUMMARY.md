# Project Research Summary

**Project:** TPC Speech Cataloger
**Domain:** Mobile-first PWA — speech-to-text auction cataloging with offline support and AI field parsing
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

TPC Speech Cataloger is a voice-first, offline-capable Progressive Web App that replaces manual data entry during auction house visits and sale cataloging sessions. Auctioneers dictate item descriptions hands-free; the app records audio locally via MediaRecorder, transcribes via Gemini AI, extracts structured catalog fields (title, description, condition, estimate, category) using a TPC-convention-aware prompt, and exports JSON to a companion Chrome extension that batch-imports directly into RFC Invaluable. The core technical challenge is the intersection of offline-first audio storage, cross-platform mobile audio format handling, and reliable AI-to-structured-data extraction — none of which are trivial, but all have well-documented solutions when combined correctly.

The recommended approach is a React 19 + Vite 7 PWA with Dexie.js for IndexedDB storage, Zustand for reactive state, and the `@google/genai` SDK for both transcription and field parsing in a single Gemini call. The architecture is four layers: UI components communicate only through Zustand stores; stores hydrate from Dexie (the source of truth); services own all business logic and external API calls; the service worker handles offline queue replay. IndexedDB as the source of truth from the first recording prevents data loss on network disruption, browser close, or device power-off — the primary reliability requirement for field use. The extension integration uses `chrome.runtime.sendMessage` with a versioned JSON schema and a file download fallback.

The two highest risks are platform-specific: iOS Safari does not support the Web Speech API in PWA mode (use MediaRecorder instead, which is confirmed to work), and iOS does not implement the Background Sync API (use `window.addEventListener('online', ...)` as the primary queue drain trigger, with Background Sync as a Chromium-only enhancement). A third risk is AI field hallucination — the LLM will invent plausible values for fields not mentioned in audio. This is mitigated by enforcing `null` for absent fields in the system prompt and making the review screen a mandatory, non-skippable gate before export.

## Key Findings

### Recommended Stack

The stack is React 19 + Vite 7 + TypeScript 5 + Tailwind CSS 4 + Zustand 5 + Dexie 4 + `@google/genai` 1.x. This combination is the current standard for offline-first PWAs and avoids every deprecated or problematic alternative. The critical library decisions are: use `@google/genai` (not `@google/generative-ai` — deprecated since November 2025), use Dexie for IndexedDB (not localStorage, which cannot hold audio blobs), and use Vite 7 with `vite-plugin-pwa` (not Next.js, which adds server complexity with no benefit for this client-only tool). Tailwind CSS v4 requires `@tailwindcss/vite` plugin, not the v3 PostCSS approach. React Router v7 must use pathname-based routing, not hash routing, to prevent iOS microphone permission re-prompts on route changes.

**Core technologies:**
- React 19 + Vite 7: UI framework and build tool — current standard for offline PWAs post-CRA; fastest HMR for mobile iteration
- TypeScript 5 (strict): Type safety — mandatory because the JSON export schema must match the extension's schema exactly; types enforce this at compile time
- `vite-plugin-pwa` 1.x (Workbox): Service worker + manifest — zero-config PWA with `generateSW` strategy; handles asset precaching and Background Sync registration
- Tailwind CSS 4: Styling — essential for rapid mobile-first UI with large tap targets; 5x faster builds than v3
- Zustand 5 + `persist` middleware: Client state — minimal, hook-first; `persist` serializes session state to localStorage for free
- Dexie 4: IndexedDB wrapper — stores audio blobs, catalog sessions, items, and sync queue; required because localStorage has a 5MB limit (single recording can be 1MB+)
- `@google/genai` 1.x: Gemini AI SDK — handles both audio transcription and structured field extraction in a single API call; matches the AI provider already used in the existing TPC extension
- `workbox-background-sync` 7.x: Offline queue replay for Chromium — Chromium-only enhancement; must be paired with `window.addEventListener('online', ...)` as the universal fallback

### Expected Features

The MVP is clearly defined by the feature dependency chain: voice recording is the root dependency; everything else builds on it. No feature can be deferred that sits in the critical dependency path from recording to export. The extension batch import is classified as P1 (launch requirement) because without it, the end-to-end workflow is not closed — auctioneers would still manually copy from the app into RFC.

**Must have (table stakes — v1):**
- Voice recording with tap-to-start/stop — core input mechanism; no alternative acceptable
- AI transcription via Gemini — converts audio to text; must handle auction vocabulary
- AI field extraction with TPC convention enforcement — title, description, condition, estimate, category; output matches RFC Invaluable catalog format
- Review and edit UI — mandatory gate before export; non-skippable; shows raw transcript alongside parsed fields
- Session save and resume — IndexedDB persistence; survives browser close, power loss, and app backgrounding
- House visit mode (photo capture + sequential flow) and sale cataloging mode (receipt number + sequential flow)
- JSON export in versioned TPC extension format — file download plus `chrome.runtime.sendMessage` fast path
- Mobile-optimized UI — minimum 48–64px tap targets, thumb-zone layout, high contrast
- Extension batch import — reads exported JSON, fills RFC Invaluable lots in batch; closes the end-to-end loop

**Should have (competitive — v1.x, after field validation):**
- Offline audio queue (MediaRecorder + IndexedDB + Background Sync + `online` event fallback) — add when auctioneers confirm connectivity loss is a real blocker; expected for rural house visits
- Category-aware AI extraction (furniture / books / fashion prompt branches) — reduces per-category AI errors
- Per-item photo gallery with reordering — hero shot ordering matches auction platform expectations
- Estimate extraction from natural speech — parse "$300–$500" from "estimate three to five hundred"

**Defer (v2+):**
- Custom vocabulary injection (auctioneer-specific terms and consignor names)
- Export history and session archive
- Condition report templates (pre-built phrases by category)

### Architecture Approach

The architecture is a strict four-layer system where Dexie/IndexedDB is the sole source of truth, Zustand provides reactive in-memory state for rendering, services own all external API boundaries (AudioService, CameraService, AIService, ExportService, SyncService), and React components communicate only through hooks that wrap stores and services. Audio blobs are written to IndexedDB immediately when recording stops — never held in React state — and transcription happens against the stored blob either immediately (online) or via the Background Sync queue (offline). The Chrome extension integration uses `externally_connectable` messaging with a versioned JSON schema, falling back to file download when the extension is absent.

**Major components:**
1. AudioService — MediaRecorder lifecycle, blob assembly, immediate transcription trigger or queue parking
2. AIService — Gemini API calls for transcription and field parsing; returns typed structured output with `null` for absent fields
3. Dexie / IndexedDB — four tables: `sessions`, `items`, `audio_blobs`, `sync_queue`; schema versioned from day one with migration callbacks
4. Service Worker (Workbox) — asset caching and Background Sync queue processing for Chromium
5. ExportService — assembles versioned JSON and either sends via `chrome.runtime.sendMessage` or downloads as file
6. Chrome Extension — receives JSON payload, drives RFC Invaluable DOM via content script with selector verification

**Build order (phase dependencies from architecture research):**
Data layer → Session management → Audio capture → Camera capture → AI pipeline → Offline queue → Review UI → Export + extension

### Critical Pitfalls

1. **Web Speech API is not offline-capable and fails completely in iOS PWA mode** — use MediaRecorder exclusively; never use `SpeechRecognition` as the recording path. Fatal: this is the core offline requirement.

2. **iOS Safari re-prompts microphone permission on hash route changes** — use pathname-based routing (`/items/1`, not `#/item/1`); hold a single `MediaStream` reference at app root; never call `getUserMedia()` inside components that remount on navigation.

3. **Background Sync does not exist on iOS** — `window.addEventListener('online', processQueue)` must be the primary sync trigger in every browser; Background Sync is Chromium-only enhancement only. Testing only on Android Chrome will miss this entirely.

4. **AI field hallucination for absent fields** — include in every parsing prompt: "If a field is not mentioned in the audio, return null — do not infer or estimate." Validate parsed output against the raw transcript before writing to IndexedDB. The review screen is the mandatory safety gate.

5. **Audio format mismatch: iOS produces `audio/mp4`, Android produces `audio/webm;codecs=opus`** — always call `MediaRecorder.isTypeSupported()`, store the detected mimeType alongside the blob in IndexedDB, and pass it as the `Content-Type` header on upload. Never hardcode `audio/webm`.

6. **Export JSON schema drift between PWA and extension** — define a single shared TypeScript interface `CatalogEntry` that both codebases import; version every export file (`"version": 1`); extension rejects unknown versions.

7. **Audio blob storage exhaustion on long sessions** — delete audio blob from IndexedDB immediately after successful transcription; check `navigator.storage.estimate()` on session start; call `navigator.storage.persist()` on first install to opt out of Safari's 7-day eviction policy.

## Implications for Roadmap

Based on combined research findings, the architecture's explicit build order, and the pitfall-to-phase mapping, a clear phase structure emerges. The dependency chain is non-negotiable: data schema must precede all storage; audio capture must precede AI; AI must precede review UI; review UI must precede export.

### Phase 1: Foundation — Data Schema, Project Setup, and PWA Shell

**Rationale:** Every other component depends on Dexie schema and TypeScript types. The shared `CatalogEntry` export schema must be defined before writing a single line of export or import code (Pitfall 8 — schema drift). Pathname-based routing must be established before audio capture UI is built (Pitfall 2 — iOS permission). PWA manifest and service worker scaffolding must be in place before offline features are layered in.

**Delivers:** Working PWA shell installable on iOS and Android; Dexie schema with versioned migrations; shared TypeScript types for sessions, items, and export format; pathname-based React Router setup; Tailwind CSS 4 configured; CI/CD scaffold.

**Addresses:** Session save/resume (storage foundation), mobile-optimized UI shell, JSON export schema contract.

**Avoids:** Schema drift (Pitfall 8), iOS permission re-prompts on hash routing (Pitfall 2).

**Research flag:** Standard patterns — well-documented. Skip research-phase for this phase.

---

### Phase 2: Audio Capture and Local Storage

**Rationale:** Audio recording is the root of the entire feature dependency tree. Nothing downstream (transcription, AI parsing, review, export) can be built until the recording pipeline works on both iOS and Android. Platform-specific audio format handling (Pitfall 7) and MediaStream lifecycle management (Pitfall 2) must be solved here before any AI work begins.

**Delivers:** Tap-to-record/stop UI; MediaRecorder with `isTypeSupported()` detection; audio blobs written to Dexie `audio_blobs` table with mimeType stored alongside; single MediaStream held at app root; item-by-item sequential flow; "Next Item" button; both house visit mode and sale cataloging mode scaffolding.

**Addresses:** Voice recording, item-by-item flow, both cataloging modes.

**Avoids:** Web Speech API anti-pattern (Pitfall 1), audio format mismatch (Pitfall 7), iOS permission re-prompts (Pitfall 2), audio blobs in React state (Architecture Anti-Pattern 2).

**Research flag:** iOS MediaRecorder behavior is well-documented but should be verified on a real device early. No research-phase needed — test on hardware.

---

### Phase 3: Session Management and Persistence

**Rationale:** Session save/resume requires the Dexie schema from Phase 1 and the item writing pattern from Phase 2. Without session persistence, every interruption at a house visit loses work. This phase also establishes the storage quota monitoring and persistent storage request that prevents data loss (Pitfall 3).

**Delivers:** Session list UI; create/resume/delete session flows; auto-save on every item write; `navigator.storage.persist()` on first install; `navigator.storage.estimate()` check on session start with low-storage warning; session recovery prompt on app reopen after abnormal close.

**Addresses:** Session save and resume, IndexedDB persistence layer.

**Avoids:** Audio blob storage exhaustion (Pitfall 3), silent data loss on crash.

**Research flag:** Standard patterns. Skip research-phase.

---

### Phase 4: AI Pipeline — Transcription and Field Extraction

**Rationale:** The AI pipeline requires completed audio blobs from Phase 2 and the item schema from Phase 1. This is the highest-complexity phase in terms of prompt engineering — TPC convention enforcement, category-aware extraction, and null-handling for absent fields all belong here. AI hallucination (Pitfall 4) is an architectural concern, not an afterthought.

**Delivers:** `AIService` calling Gemini with inline base64 audio; structured field extraction (title, description, condition, estimate, category) with TPC auction conventions enforced; null returned for absent fields (not hallucinated values); raw transcript stored alongside parsed fields in Dexie `items` table; Zustand itemStore hydration after parse completes.

**Addresses:** AI transcription, AI field extraction with TPC convention enforcement, estimate extraction from natural speech.

**Avoids:** AI field hallucination (Pitfall 4), using deprecated `@google/generative-ai` package (Stack anti-pattern).

**Research flag:** Needs research-phase. Gemini structured output prompt design for auction-specific extraction is domain-specific and not standardly documented. The system prompt design and few-shot examples for TPC conventions require iteration. Plan time for prompt engineering validation.

---

### Phase 5: Review, Edit, and Export

**Rationale:** Review UI requires parsed items from Phase 4. Export requires reviewed items. The export schema is already defined (Phase 1) but the `ExportService` and Chrome extension integration are built here. The review screen is a mandatory safety gate — it must show raw transcript alongside parsed fields and cannot be skipped.

**Delivers:** Review/edit UI with inline field editing; raw transcript displayed alongside parsed fields; "Approve" tap per item (no auto-advance); JSON export with version field; `chrome.runtime.sendMessage` to TPC extension with fallback to file download; receipt number format validation for sale cataloging mode.

**Addresses:** Review and edit UI, JSON export, mobile-optimized UI refinement.

**Avoids:** Hallucinated fields reaching catalog (UX Pitfall — review not skippable), extension as hard dependency (Architecture Anti-Pattern 4).

**Research flag:** Chrome extension `externally_connectable` setup is well-documented. Skip research-phase for export. The RFC Invaluable DOM interaction in the extension is the fragile part — see Phase 6.

---

### Phase 6: Chrome Extension Batch Import

**Rationale:** Extension batch import depends on the versioned JSON schema (Phase 1) and the export flow (Phase 5). RFC Invaluable DOM selectors are inherently fragile and require defensive coding (Pitfall 5). This phase is architecturally separate from the PWA — it is a distinct Chrome extension build in the same monorepo.

**Delivers:** Extension manifest with `externally_connectable` for the PWA's origin; background service worker receiving `TPC_IMPORT` messages; content script filling RFC Invaluable fields with selector verification (re-read value after write); `new Event('input', { bubbles: true })` dispatch after each field write; error logging for selector failures; batch workflow driving multiple lot pages.

**Addresses:** Extension batch import (P1 MVP feature).

**Avoids:** DOM selector fragility without verification (Pitfall 5), silent failure on field write.

**Research flag:** Needs research-phase. RFC Invaluable page structure must be reverse-engineered (exact selector IDs, whether React synthetic events are needed, whether the `reports.r3?mm=data` import endpoint is usable as a network request rather than DOM manipulation). This is the most fragile integration and will require direct inspection of the live RFC pages.

---

### Phase 7: Offline Audio Queue

**Rationale:** The offline queue enhances the already-working audio + AI pipeline from Phases 2–4. It is v1.x (add after core workflow is validated in real sessions) because its complexity (Background Sync + iOS fallback + storage lifecycle) is significant and its necessity depends on whether auctioneers actually encounter connectivity issues. Architecture research confirms it should be built after the pipeline is proven.

**Delivers:** Audio blob queuing to Dexie `sync_queue` when offline; `window.addEventListener('online', processQueue)` as primary trigger (iOS + all browsers); `workbox-background-sync` as Chromium-only secondary trigger; visual "Offline — N items queued" banner; queue processing with per-item retry and exponential backoff; audio blob deletion from IndexedDB after successful transcription.

**Addresses:** Offline audio queue (P2 feature).

**Avoids:** Background Sync iOS gap (Pitfall 6), audio blob storage exhaustion (Pitfall 3), polling for connectivity (Architecture Anti-Pattern 3).

**Research flag:** Standard patterns for Background Sync + online event fallback are well-documented. Skip research-phase. Primary concern is iOS testing on real hardware.

---

### Phase 8: Category-Aware Extraction and Photo Gallery (v1.x Enhancements)

**Rationale:** These enhancements build on the validated AI pipeline and photo capture from earlier phases. Category-aware prompt branching (furniture / books / fashion) reduces AI errors for specialized vocabulary. Photo gallery with reordering supports house visit workflow improvements. Both are deferred until Phase 4 AI pipeline is confirmed accurate in real use.

**Delivers:** Category flag per session/item; Gemini prompt branches per category; per-item photo gallery with drag-to-reorder; hero shot ordering; image compression before IndexedDB storage.

**Addresses:** Category-aware extraction (P2), photo gallery with reordering (P2).

**Research flag:** Category-specific auction vocabulary for prompt engineering needs domain input from TPC auctioneers. Plan a prompt validation session with real users before building the category branching.

---

### Phase Ordering Rationale

- Phases 1–3 establish the foundation all other phases build on; they cannot be reordered.
- Phase 4 (AI) depends on Phases 1–2; Phase 5 (Review/Export) depends on Phase 4; Phase 6 (Extension) depends on Phase 5. This is a strict dependency chain.
- Phase 7 (Offline queue) is intentionally deferred to v1.x — it enhances a working pipeline rather than enabling it.
- Phase 3 (Session management) could run in parallel with Phase 4 by different developers, but Phase 4 must not be started before the Dexie schema (Phase 1) and audio capture (Phase 2) are stable.
- Platform pitfalls (iOS audio, iOS permissions, iOS Background Sync) span Phases 1–2–7 and must be verified on real iOS hardware at each phase, not deferred to QA.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (AI Pipeline):** Gemini prompt engineering for TPC-specific auction extraction is domain-specific. The system prompt, few-shot examples, and null-handling contract need iterative validation with real auction speech samples before the phase is considered complete.
- **Phase 6 (Chrome Extension / RFC Integration):** RFC Invaluable page structure must be directly inspected to determine exact selector IDs, event dispatch requirements, and whether the batch import endpoint (`reports.r3?mm=data`) accepts programmatic requests. This cannot be designed from documentation alone.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Vite + React + Dexie + Tailwind v4 + PWA manifest are extensively documented. Standard scaffold.
- **Phase 2 (Audio Capture):** MediaRecorder with `isTypeSupported()` is well-documented. Verify on real iOS hardware — no additional research needed.
- **Phase 3 (Session Management):** IndexedDB persistence patterns with Dexie are standard. No new research needed.
- **Phase 5 (Review/Export):** `chrome.runtime.sendMessage` and file download fallback are documented. No research needed beyond Phase 6.
- **Phase 7 (Offline Queue):** Background Sync + `online` event fallback patterns are well-documented in MDN and Workbox docs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core choices confirmed via official docs (Gemini SDK deprecation, vite-plugin-pwa, Dexie); version pins correct as of 2026-03-06 but should be verified at scaffold time |
| Features | HIGH | Table stakes derived from domain analysis and competitor research; differentiators are unique to TPC workflow (no direct competitor); v1 / v1.x / v2+ split is well-reasoned |
| Architecture | HIGH | Core PWA offline-first patterns are well-established; Chrome extension `externally_connectable` is documented; data flow is standard Dexie + Zustand hydration pattern |
| Pitfalls | HIGH | iOS Web Speech API failure is confirmed (WebKit behavior); iOS Background Sync absence is confirmed (MDN); AI hallucination risk is documented; audio format mismatch is confirmed (MediaRecorder MDN) |

**Overall confidence:** HIGH

### Gaps to Address

- **Gemini audio input format:** Research confirms Gemini accepts both `audio/mp4` and `audio/webm` with inline base64, but the exact Gemini model version and audio token cost per minute should be verified at Phase 4 start against current pricing. Audio costs 7x text tokens per the Gemini pricing page.
- **RFC Invaluable field selectors:** The extension's existing `#fld1` / `#fld2` selector IDs were identified from the existing TPC extension. These must be confirmed against the live RFC site before Phase 6 begins — they may have changed since the extension was last updated.
- **API key security:** Research flags that AI API keys must not be in the frontend bundle. The recommended solution is a backend proxy (serverless function). Whether this proxy is in scope for v1 or whether a shared secret header is acceptable for a 2–5 person internal tool is a product decision to make before Phase 4.
- **Gemini combined STT + extraction:** Research recommends a single Gemini call for both transcription and field parsing (the system diagram in ARCHITECTURE.md shows Whisper + Gemini as two separate services). Confirm with Gemini audio API capabilities whether the combined approach is viable before Phase 4 architecture is finalized.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — MediaRecorder API, Background Sync API, Web Speech API, PWA offline operation
- Google AI Developers — `@google/genai` SDK documentation, audio understanding, pricing
- GitHub — `deprecated-generative-ai-js` deprecation confirmation
- Chrome Developers — `externally_connectable`, message passing in extensions, MV3 documentation
- npm — `dexie@4.3.0`, `vite-plugin-pwa@1.1.0` version confirmation
- caniuse.com — Speech Recognition API browser support table
- WebKit Bug 215884 — iOS microphone permission on hash change

### Secondary (MEDIUM confidence)
- buildwithmatija.com — iPhone Safari MediaRecorder + transcription implementation guide (2025)
- LogRocket — Offline-first frontend apps 2025: IndexedDB vs SQLite comparison
- ZeePalm — Background Sync in PWAs: service worker guide
- Gemini API Pricing page — audio token cost (7x text tokens)
- VoiceToNotes — Best speech-to-text apps 2026 (feature baseline)
- WebSearch — Background Sync Safari status 2026 (multiple sources agree)

### Tertiary (LOW confidence — needs validation)
- RFC Invaluable DOM selectors (`#fld1`, `#fld2`) — identified from existing TPC extension; must be verified against live site before Phase 6
- `reports.r3?mm=data` batch import endpoint — referenced in research but not confirmed to accept programmatic requests; verify via DevTools Network inspection

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
