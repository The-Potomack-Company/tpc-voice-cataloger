/**
 * Pure exponential-backoff helpers for the offline audio→AI drain (REL-1).
 *
 * Constants per D-06/D-07; consumed by offlineQueue.drainQueue to decide
 * whether a queued item is still inside its retry window. No side effects,
 * no DB access — the drain reads `claimed_at`/`ai_attempts` off the item row
 * and passes them here.
 */

export const BACKOFF_BASE_MS = 5_000; // D-06: 5s base
export const BACKOFF_CAP_MS = 300_000; // D-06: 5min cap
export const ATTEMPT_CAP = 5; // D-07: after 5 attempts → ai_status='failed'

/** Earliest epoch-ms at which an item may be retried. */
export function nextEligibleAt(claimedAt: Date | null, attempts: number): number {
  if (!claimedAt || attempts <= 0) return 0; // never tried (or never claimed) → eligible now
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempts);
  // Full jitter (D-06): random point in [0, exp) spreads concurrent retries so
  // every queued item does not stampede the proxy on the same `online` flip.
  // IN-03: jitter is intentionally re-rolled on every call — eligibility is
  // probabilistic admission, NOT a stable per-row instant. Two checks ms apart
  // can disagree; that is by design. Persist a computed next_eligible_at only if
  // deterministic scheduling is ever needed.
  const jittered = Math.random() * exp;
  return claimedAt.getTime() + jittered;
}

/** True while the item is still inside its backoff window (drain should skip it). */
export function isInBackoff(claimedAt: Date | null, attempts: number): boolean {
  return Date.now() < nextEligibleAt(claimedAt, attempts);
}
