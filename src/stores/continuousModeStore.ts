import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSessionStore } from "./sessionStore";

type ChunkRef = {
  audioId: number;
  itemId: string | null;
  startedAt: number;
};

type LastAdvance = {
  previousItemId: string | null;
  newItemId: string;
  receiptNumber: string | null;
  advancedAt: number;
  epoch: number;
};

interface ContinuousModeState {
  active: boolean;
  finalizing: boolean;
  sessionId: string | null;
  currentItemId: string | null;
  epoch: number;
  chunkIndex: number;
  chunkBuffer: ChunkRef[];
  liveTranscript: string;
  pendingChunks: Set<number>;
  failedChunks: Set<number>;
  lastAdvance: LastAdvance | null;

  enterMode: (sessionId: string) => void;
  exitMode: () => void;
  setFinalizing: (value: boolean) => void;
  advanceItem: (nextReceiptNum?: string | null) => Promise<string | null>;
  mergeChunksBackToPrevious: () => Promise<boolean>;
  pushChunk: (audioId: number, startedAt?: number) => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  markChunkPending: (chunkIndex: number) => void;
  markChunkDone: (chunkIndex: number) => void;
  markChunkFailed: (chunkIndex: number) => void;
  retryChunk: (chunkIndex: number) => void;
}

const blankState = {
  active: false,
  finalizing: false,
  sessionId: null,
  currentItemId: null,
  epoch: 0,
  chunkIndex: 0,
  chunkBuffer: [] as ChunkRef[],
  liveTranscript: "",
  pendingChunks: new Set<number>(),
  failedChunks: new Set<number>(),
  lastAdvance: null,
};

function trimTranscript(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join("\n");
}

function resolveSessionMode(sessionId: string): "house" | "sale" {
  const sessionStore = useSessionStore.getState();
  const session = sessionStore.sessions.find((s) => s.id === sessionId);
  if (session?.mode === "house" || session?.mode === "sale") {
    return session.mode;
  }

  const firstItem = sessionStore.itemsBySession[sessionId]?.[0];
  if (firstItem?.mode === "house" || firstItem?.mode === "sale") {
    return firstItem.mode;
  }

  return "sale";
}

function latestItemId(sessionId: string): string | null {
  const items = useSessionStore.getState().itemsBySession[sessionId] ?? [];
  return items.at(-1)?.id ?? null;
}

export const useContinuousModeStore = create<ContinuousModeState>()(
  persist(
    (set, get) => ({
      ...blankState,

      enterMode: (sessionId) => {
        set({
          ...blankState,
          active: true,
          sessionId,
          currentItemId: latestItemId(sessionId),
        });
      },

      exitMode: () => {
        set({ ...blankState });
      },

      setFinalizing: (value) => {
        set({ finalizing: value });
      },

      advanceItem: async (nextReceiptNum) => {
        const { sessionId, currentItemId, epoch } = get();
        if (!sessionId) return null;

        const sessionStore = useSessionStore.getState();

        if (currentItemId) {
          await sessionStore.updateItemField(currentItemId, sessionId, "ai_status", "done");
        }

        const newItemId = await sessionStore.createItem(
          sessionId,
          resolveSessionMode(sessionId),
          nextReceiptNum ?? undefined,
        );

        set((state) => ({
          currentItemId: newItemId,
          epoch: state.epoch + 1,
          chunkIndex: state.chunkIndex + 1,
          liveTranscript: "",
          lastAdvance: {
            previousItemId: currentItemId,
            newItemId,
            receiptNumber: nextReceiptNum ?? null,
            advancedAt: Date.now(),
            epoch: epoch + 1,
          },
        }));

        return newItemId;
      },

      mergeChunksBackToPrevious: async () => {
        const { sessionId, lastAdvance, chunkBuffer, epoch } = get();
        if (!sessionId || !lastAdvance?.previousItemId) return false;
        if (epoch !== lastAdvance.epoch) {
          set({ lastAdvance: null });
          return false;
        }

        const newItemHasChunks = chunkBuffer.some((chunk) => chunk.itemId === lastAdvance.newItemId);
        if (!newItemHasChunks) {
          await useSessionStore.getState().deleteItem(lastAdvance.newItemId, sessionId);
        }

        set((state) => ({
          currentItemId: lastAdvance.previousItemId,
          epoch: state.epoch + 1,
          chunkIndex: Math.max(0, state.chunkIndex - 1),
          lastAdvance: null,
        }));
        return true;
      },

      pushChunk: (audioId, startedAt = Date.now()) => {
        set((state) => ({
          chunkBuffer: [
            ...state.chunkBuffer,
            {
              audioId,
              itemId: state.currentItemId,
              startedAt,
            },
          ],
        }));
      },

      setTranscript: (text) => {
        set({ liveTranscript: trimTranscript(text) });
      },

      appendTranscript: (text) => {
        set((state) => ({
          liveTranscript: trimTranscript([state.liveTranscript, text].filter(Boolean).join("\n")),
        }));
      },

      markChunkPending: (chunkIndex) => {
        set((state) => {
          const pendingChunks = new Set(state.pendingChunks);
          const failedChunks = new Set(state.failedChunks);
          pendingChunks.add(chunkIndex);
          failedChunks.delete(chunkIndex);
          return { pendingChunks, failedChunks };
        });
      },

      markChunkDone: (chunkIndex) => {
        set((state) => {
          const pendingChunks = new Set(state.pendingChunks);
          const failedChunks = new Set(state.failedChunks);
          pendingChunks.delete(chunkIndex);
          failedChunks.delete(chunkIndex);
          return { pendingChunks, failedChunks };
        });
      },

      markChunkFailed: (chunkIndex) => {
        set((state) => {
          const pendingChunks = new Set(state.pendingChunks);
          const failedChunks = new Set(state.failedChunks);
          pendingChunks.delete(chunkIndex);
          failedChunks.add(chunkIndex);
          return { pendingChunks, failedChunks };
        });
      },

      retryChunk: (chunkIndex) => {
        get().markChunkPending(chunkIndex);
      },
    }),
    {
      name: "tpc-continuous-mode",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        active: state.active,
        finalizing: state.finalizing,
        sessionId: state.sessionId,
        currentItemId: state.currentItemId,
        epoch: state.epoch,
        chunkIndex: state.chunkIndex,
        chunkBuffer: state.chunkBuffer,
        liveTranscript: state.liveTranscript,
        lastAdvance: state.lastAdvance,
      }),
    },
  ),
);
