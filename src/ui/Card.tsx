/**
 * src/ui/Card.tsx
 *
 * Library primitive (Phase 24, LIB-04).
 * Wraps the `.tpc-card` rules from src/ui/tokens/base.css. The card is a
 * polymorphic element so it can render as <div>, <button>, or <a>
 * depending on whether the consumer needs an interactive surface.
 */

import type { ElementType, ReactNode, ComponentPropsWithoutRef } from "react";

type CardOwnProps<E extends ElementType> = {
  as?: E;
  tone?: "default" | "accent-wash" | "sand-wash";
  interactive?: boolean;
  children?: ReactNode;
};

export type CardProps<E extends ElementType = "div"> = CardOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof CardOwnProps<E>>;

export function Card<E extends ElementType = "div">({
  as,
  tone = "default",
  interactive = false,
  className,
  children,
  ...rest
}: CardProps<E>) {
  const Tag = (as ?? "div") as ElementType;
  const toneClass = tone !== "default" ? `tpc-card-${tone}` : "";
  const interactiveClass = interactive ? "tpc-card-interactive" : "";
  const classes = ["tpc-card", toneClass, interactiveClass, className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
