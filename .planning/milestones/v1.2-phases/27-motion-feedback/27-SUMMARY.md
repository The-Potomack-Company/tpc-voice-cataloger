# Phase 27: Motion & Live Feedback — Summary

**Completed:** 2026-05-12

## Shipped (MOTION-01..04)

### MOTION-01 — Pulse on the record button
- `.tpc-record-pulse` class wraps the active record-button shell with an accent-halo expansion via the `tpc-pulse` keyframe (declared in `base.css` since Phase 24).
- `RecordButton.tsx` now applies the class when `isRecording` or `isRequesting` is true.
- `RecordingIndicator.tsx` now uses the class on the badge timer pill.
- Reduced-motion: `@media (prefers-reduced-motion: reduce) { .tpc-record-pulse::after { animation: none; opacity: 0; } }` declared in `base.css`.

### MOTION-02 — Live waveform
- `src/stores/recordingStore.ts` gains a `levels: number[]` field + `pushLevel()` action (48-sample history).
- `src/hooks/useAudioRecorder.ts` builds an `AudioContext` + `AnalyserNode` chain on the active MediaStream, samples byte-time-domain data, computes RMS, throttles to ~20 fps, and pushes into the store. The loop short-circuits when `prefers-reduced-motion: reduce` is set and tears down cleanly on `cleanupStream`.
- `src/ui/Waveform.tsx` renders 48 `.tpc-waveform-bar` spans; the last 12 are accent-tinted and respond to current amplitudes; reduced-motion path renders a single static "Recording…" glyph as the spec-mandated fallback.
- Mounted on `ItemEntryPage` directly below the RecordButton via a small `RecordingWaveform` wrapper that only renders while recording.

### MOTION-03 — Route cross-fade
- `AppLayout.tsx` keyed wrapper on `<Outlet />` triggers the `tpc-route-fade` keyframe (150 ms ease-out). The keyframe is wrapped in `@media (prefers-reduced-motion: no-preference)` so the reduced-motion path becomes instant.

### MOTION-04 — Success ping on save
- `RecordingToast.tsx` wraps its content in `.tpc-success-ping[data-animate="true"]` (scale + opacity entrance keyframed in base.css; reduced-motion path becomes instant).
- New `src/ui/SuccessPing.tsx` primitive is also exported for downstream use (any save flow can mount it with a `trigger` prop).

## Tests added

- `src/ui/__tests__/waveform.test.tsx` (4 specs) — bar count, ARIA, static-glyph fallback under reduced-motion, accent-active markers respond to amplitude pushes.

## Verification

- `npx tsc -b` — clean
- `vitest --run` — 429 passed (4 new waveform specs added)
