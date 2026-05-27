import { useEffect } from "react";
import { useNotificationStore } from "../stores/notificationStore";
import { Icon } from "../ui/icons";

export function ErrorToast() {
  const message = useNotificationStore((s) => s.message);
  const retry = useNotificationStore((s) => s.retry);
  const dismiss = useNotificationStore((s) => s.dismiss);

  // Auto-dismiss after 6 seconds, keyed on the current message.
  useEffect(() => {
    if (message === null) return;

    const timer = setTimeout(() => {
      useNotificationStore.getState().dismiss();
    }, 6000);

    return () => clearTimeout(timer);
  }, [message]);

  if (message === null) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-3
                 bg-red-700 dark:bg-red-800 text-white px-4 py-3 rounded-xl shadow-lg
                 animate-[slideUp_0.3s_ease-out]"
    >
      <Icon name="err" size={16} aria-hidden />
      <span className="text-sm">{message}</span>
      {retry !== null && (
        <button
          type="button"
          onClick={() => {
            retry();
            dismiss();
          }}
          className="text-sm font-semibold underline underline-offset-2"
        >
          Retry
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-1 opacity-80 hover:opacity-100"
      >
        <Icon name="x" size={16} aria-hidden />
      </button>
    </div>
  );
}
