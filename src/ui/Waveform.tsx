/**
 * src/ui/Waveform.tsx
 *
 * Phase 27 — live recording waveform (MOTION-02).
 *
 * Renders amplitude bars from the recording store's `levels` array. Recent
 * bars use the accent color; older bars decay to --ink-4. The component
 * honors `prefers-reduced-motion`: when set, the height transitions are
 * suppressed by base.css and (in practice) `levels` stays empty because
 * useAudioRecorder's analyser loop also short-circuits — so the bars
 * render as a flat static row, the spec-mandated "static recording-active
 * glyph" fallback.
 */

import { useEffect, useState } from "react";
import { useRecordingStore } from "../stores/recordingStore";

const BAR_COUNT = 48;
const ACCENT_LATEST = 12; // last N bars get the accent color

function usePrefersReducedMotion(): boolean {
  const [pref, setPref] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setPref(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return pref;
}

export interface WaveformProps {
  ariaLabel?: string;
  className?: string;
}

export function Waveform({ ariaLabel = "Recording level", className }: WaveformProps) {
  const levels = useRecordingStore((s) => s.levels);
  const isRecording = useRecordingStore((s) => s.isRecording);
  const reduceMotion = usePrefersReducedMotion();

  // Pad to BAR_COUNT so the visual grid is stable.
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const idx = levels.length - (BAR_COUNT - i);
    bars.push(idx >= 0 ? levels[idx] : 0);
  }

  if (reduceMotion && isRecording) {
    return (
      <div
        className={["tpc-waveform", "tpc-waveform-static", className]
          .filter(Boolean)
          .join(" ")}
        role="img"
        aria-label={ariaLabel}
      >
        <span className="tpc-waveform-static-glyph">Recording…</span>
      </div>
    );
  }

  return (
    <div
      className={["tpc-waveform", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      {bars.map((level, i) => {
        const isRecent = i >= BAR_COUNT - ACCENT_LATEST;
        const height = Math.max(2, Math.round(level * 56));
        return (
          <span
            key={i}
            className="tpc-waveform-bar"
            data-active={isRecent && level > 0.02 ? "true" : "false"}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}
