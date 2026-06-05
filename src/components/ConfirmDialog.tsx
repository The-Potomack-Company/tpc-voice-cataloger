import { useId } from "react";
import { Modal } from "../ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  if (!open) return null;

  // Escape === cancel (non-destructive default) — onClose reuses onCancel.
  return (
    <Modal open onClose={onCancel} ariaLabelledBy={titleId}>
      <h3
        id={titleId}
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {title}
      </h3>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-300"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-12 rounded-lg px-4 py-3 font-medium text-white"
          // IN-04: drive the destructive ink from the --err design token (the
          // rest of the Phase 37 a11y work uses var(--err)) instead of the
          // hardcoded Tailwind bg-red-500.
          style={{ background: destructive ? "var(--err)" : "var(--accent)" }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
