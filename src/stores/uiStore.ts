import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  hasCompletedWalkthrough: boolean;
  completeWalkthrough: () => void;
  resetWalkthrough: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      hasCompletedWalkthrough: false,
      completeWalkthrough: () => set({ hasCompletedWalkthrough: true }),
      resetWalkthrough: () => set({ hasCompletedWalkthrough: false }),
    }),
    { name: "tpc-ui-state" },
  ),
);
