/**
 * src/ui/Input.tsx
 *
 * Library primitive (Phase 24, LIB-03).
 * Wraps the `.tpc-input` rules from src/ui/tokens/base.css with proper
 * label / id wiring and aria-invalid for validation states.
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const classes = ["tpc-input", className ?? ""].filter(Boolean).join(" ");

  return (
    <span className="tpc-input-field">
      {label && (
        <label htmlFor={inputId} className="tpc-eyebrow tpc-input-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error && (
        <span id={hintId} className="tpc-input-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="tpc-input-error">
          {error}
        </span>
      )}
    </span>
  );
});
