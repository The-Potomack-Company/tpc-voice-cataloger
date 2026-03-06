# Feature Research

**Domain:** Mobile speech-to-text cataloging / auction catalog generation (internal tool)
**Researched:** 2026-03-06
**Confidence:** MEDIUM — core features are HIGH confidence from domain analysis and competitor research; UX patterns are MEDIUM from general dictation app research; no direct competitor builds exactly this (voice-first, field-structured, auction-specific, offline-first PWA)

## Feature Landscape

### Table Stakes (Users Expect These)

Features the auctioneers assume exist. Missing any of these = tool feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Voice recording with tap-to-start/stop | Core value proposition — the entire reason this app exists over typing | LOW | Web Audio API / MediaRecorder on mobile is well-supported in modern browsers; hold-to-record or tap-toggle both work |
| AI transcription of spoken audio | Users dictate natural speech, not robotic keywords — raw transcription is not enough | MEDIUM | Requires STT (Whisper API or Google STT); must handle auction vocabulary: "marquetry," "ormolu," "verdigris," etc. |
| AI field extraction from transcription | Natural speech must map to discrete catalog fields: title, description, condition, estimate, category | HIGH | LLM with structured output (JSON schema) against a system prompt that knows TPC conventions; this is the core AI step |
| Review and edit before export | Auctioneers need to correct AI errors before data leaves the app | MEDIUM | Inline edit UI; each field editable individually; no "auto-publish without review" pattern |
| Photo capture per item (house visit mode) | Standard practice — every lot needs photos for catalog and buyer reference | LOW | Mobile camera access via `<input type="file" accept="image/*" capture="environment">` |
| Session save and resume | House visits span hours; power/connectivity interruption must not lose work | MEDIUM | IndexedDB persistence; sessions list on home screen; auto-save after each item |
| Two cataloging modes (house visit / sale cataloging) | The two workflows are distinct: field visit = photo-first; sale cataloging = receipt number first | MEDIUM | Mode selection on session creation; different UI scaffolding per mode |
| Receipt number entry (sale cataloging mode) | Receipt number `XXXXX-N` is the primary lot identifier in RFC Invaluable | LOW | Text input with format validation; voice entry of receipt numbers is unreliable — keyboard input preferred |
| JSON export in TPC extension format | Useless without export — this is the handoff to RFC Invaluable via the extension | MEDIUM | Must match exact schema the TPC AI-Cataloging extension expects; download as `.json` file or transfer mechanism |
| Mobile-optimized UI | App is used on-site, phone or tablet, one-handed, possibly in poor lighting | MEDIUM | Large tap targets (min 48px), high contrast, landscape + portrait, thumb-zone–friendly layout |
| Item-by-item sequential flow | Auctioneers work through a room item by item — the app must reinforce this linear workflow | LOW | "Next item" button advances to fresh entry; item count shown; back navigation to review previous |

### Differentiators (Competitive Advantage)

Features that go beyond what general dictation apps or photo-AI catalogers offer. These are where TPC Speech Cataloger earns its value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| TPC auction convention enforcement | AI output always matches TPC style (ALL CAPS title format, lowercase "the"-starting descriptions, formal auction language) without manual correction | HIGH | System prompt encodes TPC conventions; few-shot examples per category (furniture, books, fashion); reduces editing time to near zero |
| Category-aware field extraction | Furniture, books, and fashion have different cataloging vocabularies and field priorities — the AI adapts | HIGH | Category flag on each session or item; different prompt branches or suffixes per category; category informs what to listen for (e.g., bindings/edition for books, provenance/period for furniture) |
| Offline audio queue | Works at rural house locations with no connectivity — audio recorded locally, AI processing queued until signal returns | HIGH | MediaRecorder stores audio blobs to IndexedDB; service worker Background Sync fires processing when online; visual indicator of queued vs. processed items |
| End-to-end workflow into RFC Invaluable | Not just export — extension batch import fills RFC directly, closing the loop without manual copy-paste | HIGH | Extension component: reads exported JSON, navigates to each RFC lot, fills `#fld1` and `#fld2`; uses discovered `reports.r3?mm=data` import page if viable |
| Button-based advance (not voice commands) | More reliable in noisy house environments; auctioneers can control the flow without speaking navigation commands | LOW | Deliberate anti-voice-command design; big "Next Item" button; no "next item" spoken trigger |
| Estimate extraction from natural speech | Auctioneer can say "estimate three to five hundred" and get `$300–$500` in the estimate field | MEDIUM | LLM extracts dollar ranges from conversational phrasing; fallback to manual entry |
| Per-item photo gallery with ordering | Multiple photos per lot, user can reorder (hero shot first), matching auction platform expectations | MEDIUM | Swipe-to-reorder or drag handle; preview thumbnails; compress before storage to manage IndexedDB size |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like natural additions but create complexity without commensurate value for this team of 2–5.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time voice transcription (streaming) | "Feels more responsive" | Streaming STT via WebSockets is complex, expensive, and brittle on mobile with intermittent connectivity; increases latency risk; noisy environments cause mid-sentence corrections | Tap-to-record, process on stop; near-instant for typical lot descriptions (10–30 seconds); perceived latency is acceptable |
| Multi-user collaboration / shared sessions | Small teams sometimes hand off work | 2–5 users do not need real-time multi-user editing; adds auth complexity, conflict resolution, WebSocket infrastructure | Sequential handoff: export JSON from one session, another user imports/extends it |
| User accounts and authentication | "Secure the app" | Internal tool for a named set of people; OAuth/SSO adds deployment complexity and failure modes without meaningful security gain | Deploy behind a known URL; add HTTP Basic Auth or a simple PIN if access control is genuinely needed |
| Direct RFC Invaluable API integration | Bypass the extension entirely | RFC/Invaluable API terms are not publicly available; screen-scraping the extension approach is already proven and deployed | Keep extension as the integration layer; it already works for single items and can be extended for batch |
| Video recording of items | "More documentation" | Large file sizes destroy offline queue manageability; no existing auction platform field consumes video | Photos (3–6 per item) plus condition notes via voice cover buyer needs |
| Voice commands for navigation | "Hands-free workflow" | Unreliable in house environments (background noise, echoes); voice-command parsing adds a separate intent-detection layer | Physical button tap between items; reliable in all conditions |
| Automatic publish to RFC on AI completion | "Skip the review step" | AI errors (hallucinated dates, wrong materials, wrong estimates) published without review cause expensive catalog corrections | Always-review workflow: AI output presented as draft, human confirms before export |
| Barcode / QR scanning for lot IDs | "Faster lot lookup" | Auction house visits don't use barcode labeling; receipt numbers are handwritten or pre-assigned; scanning solves no real friction | Manual receipt number keyboard entry; fast and accurate enough for `XXXXX-N` format |
| Offline AI processing (on-device LLM) | "Works without internet at all" | On-device LLMs capable of auction-quality extraction require 4–8 GB model weights; current mobile hardware is marginal; output quality is significantly below GPT-4o class models | Offline audio queue — record offline, process when connected; the 30–60 minute delay until connectivity is acceptable for house visits |

## Feature Dependencies

```
[Offline Audio Queue]
    └──requires──> [Session Save/Resume]
                       └──requires──> [IndexedDB Persistence Layer]

[AI Field Extraction]
    └──requires──> [AI Transcription]
                       └──requires──> [Voice Recording]

[TPC Convention Enforcement]
    └──enhances──> [AI Field Extraction]

[Category-Aware Extraction]
    └──enhances──> [AI Field Extraction]

[Export JSON]
    └──requires──> [Review & Edit UI]
                       └──requires──> [AI Field Extraction]

[Extension Batch Import]
    └──requires──> [Export JSON]

[Photo Gallery per Item]
    └──requires──> [Photo Capture]

[House Visit Mode]
    └──requires──> [Photo Capture]
    └──requires──> [Item-by-Item Sequential Flow]

[Sale Cataloging Mode]
    └──requires──> [Receipt Number Entry]
    └──requires──> [Item-by-Item Sequential Flow]

[Estimate Extraction] ──enhances──> [AI Field Extraction]

[Offline Audio Queue] ──conflicts──> [Real-Time Streaming STT]
    (streaming requires persistent connection; queue assumes disconnected recording)
```

### Dependency Notes

- **AI Transcription requires Voice Recording:** The recording must be complete before the STT API call is made. This rules out streaming and simplifies the offline queue design — audio blob is the unit of work.
- **AI Field Extraction requires AI Transcription:** Extraction runs on the transcript, not the raw audio. The pipeline is sequential: record → transcribe → extract → present for review.
- **TPC Convention Enforcement enhances AI Field Extraction:** The system prompt that encodes TPC naming conventions is injected at the extraction step, not transcription. Transcription is generic; extraction is TPC-specific.
- **Export JSON requires Review & Edit:** No direct AI-to-export path. Human review is a mandatory gate — this is a workflow constraint by design, not a feature that can be skipped.
- **Extension Batch Import requires Export JSON:** The extension consumes the JSON file. This is a hard dependency — the extension feature cannot be built without knowing the final JSON schema.
- **Offline Audio Queue conflicts with Real-Time Streaming STT:** These are architectural choices, not features that coexist. Commit to batch processing early.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed for auctioneers to replace their current workflow.

- [ ] Voice recording with tap-to-start/stop — the core input mechanism
- [ ] AI transcription (Whisper or equivalent) — converts audio to text
- [ ] AI field extraction with TPC convention enforcement — title, description, condition, estimate, category fields populated from transcript; output matches RFC format
- [ ] Review and edit UI — inline editing of each extracted field before export
- [ ] Session save and resume — IndexedDB persistence; survives browser close
- [ ] Both modes: house visit (with photo capture) and sale cataloging (with receipt number entry)
- [ ] Item-by-item sequential flow — "Next Item" tap advances to fresh entry
- [ ] JSON export — downloads file in TPC extension schema format
- [ ] Mobile-optimized UI — large tap targets, thumb-zone layout, works on phone and tablet
- [ ] Extension batch import — reads exported JSON, fills RFC lots in batch (closes the end-to-end loop)

### Add After Validation (v1.x)

Features to add once core workflow is confirmed to work in real house visits.

- [ ] Offline audio queue — service worker + Background Sync; add when auctioneers report connectivity issues are real blockers (expected based on rural house visit context)
- [ ] Category-aware AI extraction (furniture / books / fashion prompt branches) — add when auctioneers report category-specific AI errors
- [ ] Per-item photo gallery with reordering — add when auctioneers need to set hero shots
- [ ] Estimate extraction from natural speech — add when auctioneers start including estimates in dictation

### Future Consideration (v2+)

Features to defer until core workflow is validated and team expands.

- [ ] Custom vocabulary injection (auctioneer-specific terms, consignor names) — improves transcription accuracy for specialized terminology; high value but requires infrastructure for per-user dictionaries
- [ ] Export history and session archive — browse past cataloging sessions; low urgency for 2–5 users but grows with catalog volume
- [ ] Condition report templates — pre-built condition phrases by category that can be voice-selected; reduces description variability

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Voice recording | HIGH | LOW | P1 |
| AI transcription | HIGH | LOW | P1 |
| AI field extraction + TPC conventions | HIGH | HIGH | P1 |
| Review & edit UI | HIGH | MEDIUM | P1 |
| Session save/resume | HIGH | MEDIUM | P1 |
| House visit mode (photo capture) | HIGH | LOW | P1 |
| Sale cataloging mode (receipt number) | HIGH | LOW | P1 |
| Item-by-item sequential flow | HIGH | LOW | P1 |
| JSON export | HIGH | LOW | P1 |
| Mobile-optimized UI | HIGH | MEDIUM | P1 |
| Extension batch import | HIGH | HIGH | P1 |
| Offline audio queue | HIGH | HIGH | P2 |
| Category-aware extraction | MEDIUM | MEDIUM | P2 |
| Photo gallery + reordering | MEDIUM | MEDIUM | P2 |
| Estimate extraction | MEDIUM | LOW | P2 |
| Custom vocabulary | MEDIUM | HIGH | P3 |
| Session archive | LOW | MEDIUM | P3 |
| Condition report templates | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch — tool is not usable without it
- P2: Should have — significant friction without it; add as soon as P1 is stable
- P3: Nice to have — quality of life improvement; defer until P2 is validated

## Competitor Feature Analysis

| Feature | AIM (Auction Item Manager) | AuctionWriter | TPC Speech Cataloger (our plan) |
|---------|---------------------------|---------------|----------------------------------|
| Primary input | Photos (AI describes from images) | Photos (bulk upload) | Voice dictation (speech-to-structured) |
| Mobile-first | Yes (iOS/Android native) | Web-based, any device | Yes (PWA, phone/tablet) |
| Offline support | Partial ("online, offline or somewhere in between") | Not mentioned | Full audio queue (IndexedDB + Background Sync) |
| AI field generation | Photo-based, generic descriptions | Photo-based, bulk titles & descriptions | Voice-based, TPC-convention-specific |
| Custom output conventions | Not documented | Custom instructions available | TPC-specific prompt engineering baked in |
| Export / integration | Platform-agnostic universal export | Major auction platforms | RFC Invaluable via TPC Chrome extension |
| Voice / dictation | Not offered | Not offered | Core feature |
| Condition field | Not documented | Via AI from photos | Explicitly extracted from speech |
| Estimate field | Not documented | AI-generated valuation | Extracted from spoken estimate ranges |
| Receipt number workflow | Not applicable | Not applicable | Sale cataloging mode with `XXXXX-N` format |
| Team size target | Mid-size auction houses | Any auction house | 2–5 person internal team (The Potomack Company) |

**Competitive position:** No direct competitor offers voice-first, auction-house-specific structured cataloging. AIM and AuctionWriter are photo-first. The voice path is uncontested and aligns with real fieldwork conditions (hands full, lighting variable, faster to speak than type or photograph).

## Sources

- [Mobile AI Cataloging for Auctioneers — AIM](https://www.aimhq.com/) — competitor feature reference
- [AuctionWriter — AI Auction Cataloging Software](https://auctionwriter.com/) — competitor feature reference
- [AuctionScale — AI Cataloging Software](https://auctionscale.com/) — competitor feature reference
- [Auction Cataloging Software — Auctioneer Software](https://auctioneersoftware.com/auction-cataloging-software/) — offline field cataloging patterns
- [Auction Cataloging: Goals, Priorities, and Challenges — Auction Daily](https://auctiondaily.com/news/auction-cataloging-goals-priorities-and-challenges/) — stakeholder needs and cataloging field standards
- [Best Speech to Text Apps in 2026 — VoiceToNotes](https://voicetonotes.ai/blog/speech-to-text-apps/) — STT feature baseline
- [Best AI Dictation Tools 2026 — Digital Watch Observatory](https://dig.watch/updates/best-ai-dictation-tools-for-faster-speech-to-text-in-2026) — dictation UX patterns
- [Background Sync in PWAs — ZeePalm](https://www.zeepalm.com/blog/background-sync-in-pwas-service-worker-guide) — offline queue architecture
- [Offline and background operation — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — PWA service worker patterns
- [End-to-End Structured Extraction with LLM — Databricks / Medium](https://medium.com/@AI-on-Databricks/end-to-end-structured-extraction-with-llm-part-1-batch-entity-extraction-876ce17b290f) — LLM JSON schema extraction patterns

---
*Feature research for: TPC Speech Cataloger — mobile speech-to-text auction cataloging internal tool*
*Researched: 2026-03-06*
