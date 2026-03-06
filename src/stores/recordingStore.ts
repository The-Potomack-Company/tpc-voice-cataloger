import { create } from "zustand";

interface RecordingState {
  isRecording: boolean;
  currentDurationMs: number;
  lastSavedAudioId: number | null;
  lastSavedDurationMs: number;
  setRecording: (isRecording: boolean) => void;
  setDuration: (ms: number) => void;
  setLastSaved: (id: number, durationMs: number) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>()((set) => ({
  isRecording: false,
  currentDurationMs: 0,
  lastSavedAudioId: null,
  lastSavedDurationMs: 0,
  setRecording: (isRecording) => set({ isRecording }),
  setDuration: (ms) => set({ currentDurationMs: ms }),
  setLastSaved: (id, durationMs) =>
    set({ lastSavedAudioId: id, lastSavedDurationMs: durationMs }),
  reset: () =>
    set({
      isRecording: false,
      currentDurationMs: 0,
      lastSavedAudioId: null,
      lastSavedDurationMs: 0,
    }),
}));
