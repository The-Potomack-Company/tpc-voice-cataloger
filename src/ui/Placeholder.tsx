/**
 * src/ui/Placeholder.tsx
 *
 * Library primitive (Phase 24, LIB-07).
 * Skeleton / hatched placeholder used during loading or when imagery is
 * still missing. Wraps the `.tpc-placeholder` rule from base.css.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface PlaceholderProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  label?: ReactNode;
}

export function Placeholder({
  width,
  height,
  label,
  className,
  style,
  ...rest
}: PlaceholderProps) {
  const classes = ["tpc-placeholder", className ?? ""].filter(Boolean).join(" ");
  const merged: CSSProperties = { width, height, ...style };
  return (
    <div className={classes} style={merged} aria-hidden={!label} {...rest}>
      {label}
    </div>
  );
}
