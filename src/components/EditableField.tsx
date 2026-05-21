import { useState, useRef, useEffect } from "react";

interface EditableFieldProps {
  value: string | undefined;
  onSave: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
  readOnly?: boolean;
}

export function EditableField({
  value,
  onSave,
  placeholder,
  multiline,
  label,
  readOnly,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? "")) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && !multiline) {
      handleSave();
    }
  };

  if (editing) {
    const sharedProps = {
      ref: inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>,
      value: draft,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setDraft(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className:
        "w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500",
    };

    return (
      <div>
        {label && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {label}
          </span>
        )}
        {multiline ? (
          <textarea {...sharedProps} rows={3} />
        ) : (
          <input type="text" {...sharedProps} />
        )}
      </div>
    );
  }

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  if (readOnly) {
    return (
      <div>
        {label && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {label}
          </span>
        )}
        <span
          className={`rounded px-1 py-0.5 inline-block ${multiline ? "whitespace-pre-wrap" : ""} ${
            isPlaceholder
              ? "text-gray-400 dark:text-gray-500 italic"
              : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {displayValue}
        </span>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {label}
        </span>
      )}
      <span
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5 inline-block ${multiline ? "whitespace-pre-wrap" : ""} ${
          isPlaceholder
            ? "text-gray-400 dark:text-gray-500 italic"
            : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {displayValue}
      </span>
    </div>
  );
}
