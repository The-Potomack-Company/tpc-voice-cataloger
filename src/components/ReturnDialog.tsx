import { useId, useRef, useState } from "react";
import { Modal } from "../ui/Modal";

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
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
  };

  const handleCancel = () => {
    setNotes("");
    onCancel();
  };

  // Escape === cancel; textarea is the initial-focus target.
  return (
    <Modal
      open
      onClose={handleCancel}
      ariaLabelledBy={titleId}
      initialFocusRef={textareaRef}
    >
      <h3
        id={titleId}
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        Return to Specialist
      </h3>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Return "{sessionName}" with notes for the specialist.
      </p>
      <textarea
        ref={textareaRef}
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
    </Modal>
  );
}
