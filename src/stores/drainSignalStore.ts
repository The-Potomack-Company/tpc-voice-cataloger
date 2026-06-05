import { create } from "zustand";

/**
 * WR-04: a monotonically increasing tick bumped whenever the offline (audio→AI)
 * drain or the write-ahead drain finishes. Items transition to 'failed' during a
 * normal drain while already online (attempt-cap, permanent classify, no-audio,
 * permanent write-ahead drop), none of which fire a `window 'online'` event — so
 * the BlockedQueueBadge, which previously refreshed only on mount + 'online',
 * went stale within a session. The badge subscribes to `drainTick` and re-fetches
 * the blocked count whenever it changes.
 *
 * Not persisted: this is an in-session signal, meaningless across reloads.
 */
interface DrainSignalState {
  drainTick: number;
  notifyDrainComplete: () => void;
}

export const useDrainSignalStore = create<DrainSignalState>()((set) => ({
  drainTick: 0,
  notifyDrainComplete: () => set((s) => ({ drainTick: s.drainTick + 1 })),
}));

/** Non-hook accessor for the queue services (which run outside React). */
export function notifyDrainComplete(): void {
  useDrainSignalStore.getState().notifyDrainComplete();
}
