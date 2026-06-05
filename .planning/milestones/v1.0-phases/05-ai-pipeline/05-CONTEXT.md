# Phase 5: AI Pipeline - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Recorded audio is automatically sent to Gemini for transcription and field extraction into structured catalog fields (title, description, condition, estimate, category). Gemini acts as a pure field splitter — extracting verbatim from speech, no formatting or post-processing. TPC formatting (ALL CAPS titles, formal description language) is NOT part of this phase. No review/edit UI (Phase 6), no offline queue (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Gemini's role
- Pure field splitter — extracts what the auctioneer said and drops it into the right buckets verbatim
- No post-processing: no ALL CAPS conversion, no "the"-prefixing, no formal language rewriting
- TPC formatting is a downstream concern (Phase 6 or a separate utility), not part of the AI prompt
- Category defaults to "furniture" — auctioneer can override in Phase 6 review
- Audio-only input — photos are not sent to Gemini, auctioneer's words are the source of truth
- No raw transcript returned — fields are already verbatim from speech, a separate transcript would be redundant
- Fields not mentioned in audio are stored as null — no hallucinated values

### Processing trigger
- Auto-fires in background immediately after recording stops
- Auctioneer moves on to the next item without waiting
- Fields populate silently — visible when auctioneer revisits the item

### Error handling
- If Gemini fails, times out, or returns bad/unparseable data, dump the full transcription into the description field as fallback
- No data lost — auctioneer can manually split fields in Phase 6 review
- No automatic retries — the fallback transcription ensures the words are captured

### API key security
- Simple backend proxy (Cloudflare Worker, Vercel function, or similar) holds the Gemini API key
- PWA calls the proxy, proxy forwards to Gemini
- API key never exposed in client-side code

### Claude's Discretion
- Gemini prompt structure and JSON schema design
- Backend proxy implementation details (platform choice, error responses)
- How audio blob is converted to base64 for the API call
- Processing status tracking on the item record (pending/done/failed)
- Retry vs no-retry policy details beyond the fallback behavior

</decisions>

<specifics>
## Specific Ideas

- Gemini should NOT rewrite or improve what was said — if the auctioneer says "oak table, kinda beat up, maybe two hundred", the fields should contain exactly that language, not polished auction prose
- The existing TPC Chrome extension already does AI-powered cataloging from photos with Gemini — this is the speech counterpart, not a replacement
- Single Gemini call for transcription + extraction (confirmed in STATE.md decisions — no separate Whisper step)
- Must verify Gemini accepts both `audio/mp4` (iOS Safari) and `audio/webm;codecs=opus` (Android Chrome) at implementation time

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ItemAudio` type in `src/db/types.ts` — audio blob with mimeType and durationMs, linked by itemId + itemType
- `HouseVisitItem` and `SaleItem` types — already have nullable title, description, condition, estimate, category fields ready to receive AI output
- `useAudioRecorder` hook (`src/hooks/useAudioRecorder.ts`) — handles recording lifecycle, auto-saves to Dexie on stop
- `audio.ts` utility (`src/utils/audio.ts`) — MIME type detection, audio helpers
- `@google/genai` 1.x confirmed as SDK (STATE.md decision)

### Established Patterns
- Dexie/IndexedDB as sole source of truth — AI results written directly to item records
- Auto-increment integer PKs
- Zustand for UI state management
- Auto-save on meaningful events (Phase 3 pattern) — AI completion is a meaningful event

### Integration Points
- Hook into recording stop event from `useAudioRecorder` to trigger AI processing
- Write extracted fields back to `HouseVisitItem` or `SaleItem` in Dexie
- Need new `aiStatus` field on items (pending/processing/done/failed) for Phase 6 to know display state
- Backend proxy is new infrastructure — first server-side component in the project

</code_context>

<deferred>
## Deferred Ideas

- TPC formatting (ALL CAPS titles, formal description conventions) — Phase 6 or separate utility
- Multimodal input (sending photos + audio together to Gemini) — future enhancement
- Category-aware prompts (furniture/books/fashion extraction strategies) — v2 (AI-05)
- Estimate extraction from natural speech ("three to five hundred" -> $300-$500) — v2 (AI-06)

</deferred>

---

*Phase: 05-ai-pipeline*
*Context gathered: 2026-03-06*
