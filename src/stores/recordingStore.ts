import { create } from "zustand";

interface RecordingState {
  isRecording: boolean;
  currentDurationMs: number;
  lastSavedAudioId: number | null;
  lastSavedDurationMs: number;
  /**
   * Recent amplitude samples in [0, 1], oldest first. Phase 27 (MOTION-02)
   * — fed from the AnalyserNode in useAudioRecorder. Falls back to empty
   * array when recording is idle.
   */
  levels: number[];
  /**
   * REL-4 (D-12): user-facing error set when db.audio.add ultimately fails
   * after retries. Null when the recorder is healthy.
   */
  recorderError: string | null;
  /**
   * REL-4 (D-12): blob retained for manual re-save when db.audio.add fails
   * on the final attempt, so the recording is never silently lost.
   */
  retryBuffer: { blob: Blob; itemId: string; durationMs: number } | null;
  setRecording: (isRecording: boolean) => void;
  setDuration: (ms: number) => void;
  setLastSaved: (id: number, durationMs: number) => void;
  pushLevel: (level: number) => void;
  setRecorderError: (msg: string | null) => void;
  stashForRetry: (
    buf: { blob: Blob; itemId: string; durationMs: number } | null,
  ) => void;
  reset: () => void;
}

const LEVEL_HISTORY = 48; // visible bar count on the waveform

export const useRecordingStore = create<RecordingState>()((set) => ({
  isRecording: false,
  currentDurationMs: 0,
  lastSavedAudioId: null,
  lastSavedDurationMs: 0,
  levels: [],
  recorderError: null,
  retryBuffer: null,
  setRecording: (isRecording) => set({ isRecording }),
  setDuration: (ms) => set({ currentDurationMs: ms }),
  setLastSaved: (id, durationMs) =>
    set({ lastSavedAudioId: id, lastSavedDurationMs: durationMs }),
  setRecorderError: (msg) => set({ recorderError: msg }),
  stashForRetry: (buf) => set({ retryBuffer: buf }),
  pushLevel: (level) =>
    set((s) => {
      const next = s.levels.concat(Math.max(0, Math.min(1, level)));
      if (next.length > LEVEL_HISTORY) next.splice(0, next.length - LEVEL_HISTORY);
      return { levels: next };
    }),
  reset: () =>
    set({
      isRecording: false,
      currentDurationMs: 0,
      lastSavedAudioId: null,
      lastSavedDurationMs: 0,
      levels: [],
      recorderError: null,
      retryBuffer: null,
    }),
}));
