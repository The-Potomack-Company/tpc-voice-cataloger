/**
 * src/ui/StatStrip.tsx
 *
 * Three-stat strip primitive — used on the Recording surface and the
 * SessionDetail/Review screen per docs/design-handoff/tpc-voice.jsx.
 *
 * Each Stat has:
 *   - eyebrow label
 *   - italic display value (with optional "/total" suffix)
 *   - optional mini Bar showing progress toward `total`
 *
 * Reads tokens via .tpc-stat-* classes in base.css — no hardcoded literals.
 */

import type { ReactNode } from "react";
import { Bar } from "./Bar";
import type { BarTone } from "./Bar";

export interface StatItem {
  label: string;
  value: number | string;
  total?: number;
  tone?: BarTone;
  /** When false, no bar is rendered for this stat. */
  showBar?: boolean;
}

export interface StatStripProps {
  stats: StatItem[];
  /** When true, the strip uses the larger display size (Recording screen). */
  large?: boolean;
  /** "strip" (default) is the open strip layout; "cards" lays each stat
   *  out as a small centered card — used on the ItemEntry recording surface. */
  variant?: "strip" | "cards";
  className?: string;
  children?: ReactNode;
}

export function StatStrip({ stats, large, variant = "strip", className }: StatStripProps) {
  const classes = [
    "tpc-stat-strip",
    large ? "tpc-stat-strip-lg" : "",
    variant === "cards" ? "tpc-stat-strip-cards" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role="group" aria-label="Session stats">
      {stats.map((stat) => {
        const hasTotal = typeof stat.total === "number" && stat.total > 0;
        const numeric = typeof stat.value === "number" ? stat.value : 0;
        const pct = hasTotal
          ? Math.max(0, Math.min(100, (numeric / (stat.total as number)) * 100))
          : 0;
        const showBar = stat.showBar !== false && hasTotal;
        return (
          <div key={stat.label} className="tpc-stat">
            <div className="tpc-stat-label">{stat.label}</div>
            <div className="tpc-stat-value">
              <span>{stat.value}</span>
              {hasTotal && (
                <span className="tpc-stat-total">/{stat.total}</span>
              )}
            </div>
            {showBar && (
              <Bar
                value={pct}
                tone={stat.tone ?? "accent"}
                aria-label={`${stat.label} progress`}
                style={{ marginTop: 4 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
