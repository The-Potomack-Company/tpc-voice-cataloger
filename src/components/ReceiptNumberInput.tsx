import { useState } from "react";
import { isValidReceiptNumber } from "../utils/receiptNumber";

interface ReceiptNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ReceiptNumberInput({
  value,
  onChange,
  disabled = false,
}: ReceiptNumberInputProps) {
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const showError = touched && trimmed.length > 0 && !isValidReceiptNumber(trimmed);

  return (
    <div className="space-y-1">
      <label
        htmlFor="receipt-number"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Receipt Number
      </label>
      <input
        id="receipt-number"
        type="text"
        inputMode="numeric"
        placeholder="XXXXX-N (e.g., 12345-1)"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.trim())}
        onBlur={() => setTouched(true)}
        className={`w-full rounded-lg border px-3 py-2.5 text-base min-h-12
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          focus:outline-none focus:ring-2
          ${
            showError
              ? "border-red-500 focus:ring-red-300 dark:focus:ring-red-700"
              : "border-gray-300 dark:border-gray-600 focus:ring-accent/50"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      />
      {showError && (
        <p className="text-sm text-red-500">Format: XXXXX-N</p>
      )}
    </div>
  );
}
