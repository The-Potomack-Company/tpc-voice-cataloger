import { useState } from "react";
import { createPortal } from "react-dom";

interface ReturnDialogProps {
  open: boolean;
  sessionName: string;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}

export function ReturnDialog({
  open,
  sessionName,
  onConfirm,
  onCancel,
}: ReturnDialogProps) {
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
  };

  const handleCancel = () => {
    setNotes("");
    onCancel();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Return to Specialist
        </h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Return "{sessionName}" with notes for the specialist.
        </p>
        <textarea
          rows={3}
          placeholder="Review notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-12 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-300"
          >
            Keep Submitted
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-12 rounded-lg px-4 py-3 font-semibold text-white bg-amber-600 hover:bg-amber-700"
          >
            Return Session
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
