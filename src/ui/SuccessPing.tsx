/**
 * src/ui/SuccessPing.tsx
 *
 * Phase 27 (MOTION-04) — momentary success indicator. Self-clearing.
 * Animation gated by `prefers-reduced-motion` via base.css.
 */

import { useEffect, useState } from "react";
import { Icon } from "./icons";

export interface SuccessPingProps {
  /**
   * Increment to trigger the ping. Each value change re-runs the
   * animation and shows the badge for `durationMs`.
   */
  trigger: unknown;
  label?: string;
  durationMs?: number;
}

export function SuccessPing({ trigger, label = "Saved", durationMs = 1600 }: SuccessPingProps) {
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (trigger === undefined || trigger === null || trigger === false) return;
    setVisible(true);
    setTick((t) => t + 1);
    const handle = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(handle);
  }, [trigger, durationMs]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      key={tick}
      className="tpc-success-ping"
      data-animate="true"
    >
      <Icon name="success" size={16} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
