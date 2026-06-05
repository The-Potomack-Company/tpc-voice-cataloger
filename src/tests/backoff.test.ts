import { describe, it, expect, afterEach, vi } from "vitest";
import {
  nextEligibleAt,
  isInBackoff,
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  ATTEMPT_CAP,
} from "../utils/backoff";

describe("backoff constants (D-06/D-07)", () => {
  it("base 5s, cap 5min, attempt cap 5", () => {
    expect(BACKOFF_BASE_MS).toBe(5_000);
    expect(BACKOFF_CAP_MS).toBe(300_000);
    expect(ATTEMPT_CAP).toBe(5);
  });
});

describe("nextEligibleAt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0 when claimedAt is null (never claimed → eligible now)", () => {
    expect(nextEligibleAt(null, 3)).toBe(0);
  });

  it("returns 0 when attempts is 0 (never tried → eligible now)", () => {
    expect(nextEligibleAt(new Date(), 0)).toBe(0);
  });

  it("returns 0 when attempts is negative", () => {
    expect(nextEligibleAt(new Date(), -1)).toBe(0);
  });

  it("is in [claimedAt, claimedAt + base*2^attempts) for attempts within cap", () => {
    const claimedAt = new Date(1_000_000);
    const attempts = 3; // exp = 5000 * 2^3 = 40000 (< cap)
    const exp = BACKOFF_BASE_MS * 2 ** attempts;

    // lower bound: random()=0 → exactly claimedAt
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(nextEligibleAt(claimedAt, attempts)).toBe(claimedAt.getTime());

    // upper bound is exclusive: random()→1 approaches but never reaches the cap
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    const high = nextEligibleAt(claimedAt, attempts);
    expect(high).toBeGreaterThanOrEqual(claimedAt.getTime());
    expect(high).toBeLessThan(claimedAt.getTime() + exp);
  });

  it("clamps the exponential term at BACKOFF_CAP_MS for large attempts", () => {
    const claimedAt = new Date(2_000_000);
    // attempts=10 → 5000*2^10 = 5_120_000 >> cap (300_000)
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    const high = nextEligibleAt(claimedAt, 10);
    expect(high).toBeLessThan(claimedAt.getTime() + BACKOFF_CAP_MS);
    expect(high).toBeGreaterThan(claimedAt.getTime());
  });
});

describe("isInBackoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when never claimed (nextEligibleAt 0)", () => {
    expect(isInBackoff(null, 5)).toBe(false);
  });

  it("returns false when attempts is 0", () => {
    expect(isInBackoff(new Date(), 0)).toBe(false);
  });

  it("returns false for a far-past claim (window long elapsed)", () => {
    const longAgo = new Date(Date.now() - BACKOFF_CAP_MS * 10);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(isInBackoff(longAgo, 3)).toBe(false);
  });

  it("returns true when claim is now and the jittered window is in the future", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // push window well past now
    expect(isInBackoff(new Date(Date.now()), 3)).toBe(true);
  });
});
