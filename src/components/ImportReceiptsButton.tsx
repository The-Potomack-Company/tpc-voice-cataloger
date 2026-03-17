import { useState, useRef } from "react";
import { parseReceiptNumbers } from "../utils/importReceipts";

interface ImportReceiptsButtonProps {
  onImport: (receipts: string[], skipped: number) => void;
  disabled?: boolean;
}

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export function ImportReceiptsButton({
  onImport,
  disabled,
}: ImportReceiptsButtonProps) {
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension (iOS Safari ignores accept attribute)
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setImporting(true);
    try {
      const result = await parseReceiptNumbers(file);
      onImport(result.valid, result.skipped);
    } catch (err) {
      console.error("Failed to parse receipt file:", err);
      onImport([], 0);
    } finally {
      setImporting(false);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || importing}
        className="w-full min-h-12 rounded-lg border border-accent text-accent font-medium
                   hover:bg-accent/10 transition-colors flex items-center justify-center gap-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {importing ? (
          <>
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Importing...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            Import Receipt List
          </>
        )}
      </button>
    </>
  );
}
