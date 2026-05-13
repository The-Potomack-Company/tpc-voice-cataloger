/**
 * src/ui/WarnBanner.tsx
 *
 * Library primitive (Issue 11.18). Consolidates the three duplicate
 * warn-banner implementations that previously lived in SessionDetail.tsx
 * (returned + interrupted) and SessionCard.tsx (interrupted badge surface).
 *
 * Reads from tokens via `bg-warn-wash` / `text-warn` so dark + light themes
 * stay consistent.
 */

import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export interface WarnBannerProps {
  /** Optional icon override; defaults to the warning glyph. */
  icon?: IconName;
  /** Headline string. */
  title: ReactNode;
  /** Optional supporting body line. */
  body?: ReactNode;
  /** When provided, renders an X close affordance that fires this callback. */
  onDismiss?: () => void;
  className?: string;
}

export function WarnBanner({
  icon = "warn",
  title,
  body,
  onDismiss,
  className,
}: WarnBannerProps) {
  const classes = [
    "flex items-start gap-3 rounded-lg bg-warn-wash text-warn px-4 py-3",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role="status">
      <Icon name={icon} size={20} className="shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {body && <p className="text-sm mt-0.5">{body}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-warn hover:opacity-80"
          aria-label="Dismiss"
        >
          <Icon name="x" size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}
