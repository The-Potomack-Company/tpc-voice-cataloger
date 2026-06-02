import { create } from "zustand";

interface NotificationState {
  message: string | null;
  retry: (() => void) | null;
  notifyError: (message: string, retry?: () => void) => void;
  dismiss: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  message: null,
  retry: null,
  notifyError: (message, retry) =>
    set((s) => (s.message === message ? s : { message, retry: retry ?? null })),
  dismiss: () => set({ message: null, retry: null }),
}));
