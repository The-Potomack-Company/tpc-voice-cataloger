/**
 * src/ui/Eyebrow.tsx
 *
 * Library primitive (Phase 24, LIB-05).
 * Wraps the `.tpc-eyebrow` class from src/ui/tokens/base.css — small
 * uppercased kicker label used above display titles and section headers.
 */

import type { ReactNode, HTMLAttributes } from "react";

export interface EyebrowProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Eyebrow({ className, children, ...rest }: EyebrowProps) {
  const classes = ["tpc-eyebrow", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
