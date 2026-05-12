/**
 * src/ui/Bar.tsx
 *
 * Library primitive (Phase 24, LIB-06).
 * Progress / meter bar — 4 px height per spec. Reads the `.bar-track` /
 * `.bar-fill` rules from base.css and adds accent / warn / ok / err
 * variants. Sets ARIA role="progressbar" with the right value attrs
 * unless `meter` is passed (then role="meter").
 */

import type { HTMLAttributes } from "react";

export type BarTone = "accent" | "warn" | "ok" | "err" | "sand";

export interface BarProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  value: number;
  min?: number;
  max?: number;
  tone?: BarTone;
  meter?: boolean;
  label?: string;
}

export function Bar({
  value,
  min = 0,
  max = 100,
  tone = "accent",
  meter = false,
  label,
  className,
  ...rest
}: BarProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = ((clamped - min) / (max - min || 1)) * 100;
  const classes = ["bar-track", className ?? ""].filter(Boolean).join(" ");
  const fillClass = ["bar-fill", `bar-fill-${tone}`].join(" ");
  return (
    <div
      role={meter ? "meter" : "progressbar"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-label={label}
      className={classes}
      {...rest}
    >
      <span className={fillClass} style={{ width: `${pct}%` }} />
    </div>
  );
}
