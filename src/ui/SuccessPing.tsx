/* eslint-disable react-hooks/set-state-in-effect --
 * This effect IS the side-effect synchronizer: it observes a `trigger`
 * prop diff and flips internal animation state (tick + visibility),
 * then schedules a self-clearing timer. Splitting it across useReducer
 * doesn't change the cascade structure; the cascade is intentional and
 * bounded to one re-render per trigger change. */
/**
 * src/ui/SuccessPing.tsx
 *
 * Phase 27 (MOTION-04) — momentary success indicator. Self-clearing.
 * Animation gated by `prefers-reduced-motion` via base.css.
 */

import { useEffect, useState, useRef } from "react";
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
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevTriggerRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (trigger === undefined || trigger === null || trigger === false) return;
    if (trigger === prevTriggerRef.current) return;
    prevTriggerRef.current = trigger;
    setTick((t) => t + 1);
    setVisible(true);
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
