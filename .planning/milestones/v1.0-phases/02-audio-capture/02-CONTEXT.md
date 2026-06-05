# Phase 2: Audio Capture - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Tap-to-record/stop audio capture with MediaRecorder API, cross-platform audio blob storage in IndexedDB. Auctioneers can tap to record their voice for each item and see the audio stored locally, on both iOS Safari and Android Chrome. No session management, no AI processing, no playback review screen — just capture and store.

</domain>

<decisions>
## Implementation Decisions

### Recording button
- Large red circle with microphone icon, centered at bottom of screen — dominant UI element like a camera shutter
- On tap (recording starts): button morphs to red square (universal "stop" symbol) — clear state change
- Button sizing: Claude's discretion based on thumb-zone ergonomics (minimum 48px per Phase 1 UX-02)

### Recording indicator
- Subtle MM:SS timer counting up, displayed near the record button (not large/prominent)
- Red accent border/glow around screen edge while recording — unmissable even while scrolling
- No audio waveform or level meter — button state + timer + red border is sufficient

### Audio format
- Store browser-native format as-is: `audio/mp4` (AAC) on iOS Safari, `audio/webm;codecs=opus` on Android Chrome
- No on-device format conversion or normalization
- MIME type saved alongside blob in Dexie so downstream phases know what format they're sending to Gemini
- Gemini compatibility with both formats is a pre-Phase 5 blocker (already tracked in STATE.md)

### Post-recording flow
- Auto-save on stop: blob written to IndexedDB immediately, no confirmation step required
- Brief toast notification appears: "Recording saved — 0:23" with a small play button for optional instant playback
- Toast auto-dismisses after a few seconds
- No persistent playback UI on recorded items in this phase — playback review is Phase 6 scope

### Claude's Discretion
- Exact button sizing and spacing within thumb-zone constraints
- Toast duration and animation
- Red border/glow intensity and animation style
- Timer typography and exact placement relative to button
- MediaRecorder configuration (sample rate, bitrate, chunk strategy)
- Error handling for microphone permission denial
- Fallback behavior if MediaRecorder is unsupported

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint is the success criteria: must work on both iOS Safari and Android Chrome without errors.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dexie database with `audioBlobs` table (from Phase 1 schema) — audio blobs link to items by ID
- Bottom tab bar and page routing already in place — recording UI integrates into existing shell
- Tailwind CSS 4 with @theme blocks for consistent styling
- Dark mode support via system preference (Phase 1)

### Established Patterns
- Zustand for state management
- Dexie/IndexedDB as sole source of truth — audio blobs written immediately on stop, never held in React state
- Pathname-based routing (React Router v7) — prevents iOS microphone re-prompts on navigation
- Auto-increment integer PKs (not UUID)

### Integration Points
- Recording UI lives within the existing app shell (bottom tab bar)
- Audio blobs stored in Dexie `audioBlobs` table, linked to items
- Phase 3 (Session Management) will wrap recordings into sessions
- Phase 5 (AI Pipeline) will read stored blobs and send to Gemini

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-audio-capture*
*Context gathered: 2026-03-06*
