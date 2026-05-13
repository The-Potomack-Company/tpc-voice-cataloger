/**
 * src/ui/Button.tsx
 *
 * Library primitive (Phase 24, LIB-01).
 * Reads from .tpc design tokens via the .tpc-btn* class set declared in
 * src/ui/tokens/base.css — never hard-code colors, fonts, or radii here.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes:    sm | md (md is the default declared in base.css)
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    iconRight,
    fullWidth,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = [
    "tpc-btn",
    `tpc-btn-${variant}`,
    size === "sm" ? "tpc-btn-sm" : null,
    fullWidth ? "tpc-btn-fullwidth" : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {icon}
      {children !== undefined && <span>{children}</span>}
      {iconRight}
    </button>
  );
});
