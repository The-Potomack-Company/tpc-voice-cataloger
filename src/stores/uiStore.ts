import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  recordingSessionId: string | null;
  setRecordingSession: (id: string | null) => void;
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      recordingSessionId: null,
      setRecordingSession: (id: string | null) =>
        set({ recordingSessionId: id }),
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      setOnline: (online: boolean) => set({ isOnline: online }),
    }),
    {
      name: "tpc-ui-state",
      partialize: (state) => ({
        recordingSessionId: state.recordingSessionId,
      }),
    },
  ),
);

/**
 * Scope the UI store persist key to a specific user.
 * Handles migration of legacy unscoped key if present.
 * Call this after login to isolate data per user.
 */
export function scopeUIStore(userId: string) {
  const legacyKey = "tpc-ui-state";
  const scopedKey = `tpc-ui-state-${userId}`;
  const legacyData = localStorage.getItem(legacyKey);
  if (legacyData && !localStorage.getItem(scopedKey)) {
    localStorage.setItem(scopedKey, legacyData);
    localStorage.removeItem(legacyKey);
  }
  useUIStore.persist.setOptions({ name: scopedKey });
  useUIStore.persist.rehydrate();
}
