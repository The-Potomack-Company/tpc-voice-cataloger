import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  hasCompletedWalkthrough: boolean;
  completeWalkthrough: () => void;
  resetWalkthrough: () => void;
  recordingSessionId: number | null;
  setRecordingSession: (id: number | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      hasCompletedWalkthrough: false,
      completeWalkthrough: () => set({ hasCompletedWalkthrough: true }),
      resetWalkthrough: () => set({ hasCompletedWalkthrough: false }),
      recordingSessionId: null,
      setRecordingSession: (id: number | null) =>
        set({ recordingSessionId: id }),
    }),
    { name: "tpc-ui-state" },
  ),
);
