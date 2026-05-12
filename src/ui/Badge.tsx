/**
 * src/ui/Badge.tsx
 *
 * Library primitive (Phase 24, LIB-02).
 * Wraps the `.tpc-badge` rules from src/ui/tokens/base.css.
 *
 * Tones: default | ok | warn | err | info
 * Optional dot indicator (uses .tpc-dot class).
 */

import type { ReactNode, HTMLAttributes } from "react";

export type BadgeTone = "default" | "ok" | "warn" | "err" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  children?: ReactNode;
}

export function Badge({
  tone = "default",
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  const toneClass = tone === "default" ? "" : `tpc-badge-${tone}`;
  const classes = ["tpc-badge", toneClass, className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} {...rest}>
      {dot && <span className="tpc-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
