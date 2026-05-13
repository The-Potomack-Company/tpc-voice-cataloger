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
  setRecording: (isRecording: boolean) => void;
  setDuration: (ms: number) => void;
  setLastSaved: (id: number, durationMs: number) => void;
  pushLevel: (level: number) => void;
  reset: () => void;
}

const LEVEL_HISTORY = 48; // visible bar count on the waveform

export const useRecordingStore = create<RecordingState>()((set) => ({
  isRecording: false,
  currentDurationMs: 0,
  lastSavedAudioId: null,
  lastSavedDurationMs: 0,
  levels: [],
  setRecording: (isRecording) => set({ isRecording }),
  setDuration: (ms) => set({ currentDurationMs: ms }),
  setLastSaved: (id, durationMs) =>
    set({ lastSavedAudioId: id, lastSavedDurationMs: durationMs }),
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
    }),
}));
