import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  hasCompletedWalkthrough: boolean;
  completeWalkthrough: () => void;
  resetWalkthrough: () => void;
  recordingSessionId: number | null;
  setRecordingSession: (id: number | null) => void;
  isOnline: boolean;
  setOnline: (online: boolean) => void;
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
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      setOnline: (online: boolean) => set({ isOnline: online }),
    }),
    {
      name: "tpc-ui-state",
      partialize: (state) => ({
        hasCompletedWalkthrough: state.hasCompletedWalkthrough,
        recordingSessionId: state.recordingSessionId,
      }),
    },
  ),
);
