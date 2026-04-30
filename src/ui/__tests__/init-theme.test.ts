import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTheme } from "../tokens/initTheme";

type Listener = (e: MediaQueryListEvent) => void;

interface FakeMQL {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Listener[];
  _emit: (matches: boolean) => void;
}

function makeFakeMatchMedia(initialMatches: boolean): FakeMQL {
  const listeners: Listener[] = [];
  const fake: FakeMQL = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_event: string, fn: Listener) => {
      listeners.push(fn);
    }),
    removeEventListener: vi.fn((_event: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    }),
    _listeners: listeners,
    _emit: (matches: boolean) => {
      fake.matches = matches;
      // Cast to MediaQueryListEvent shape for the listener payload.
      const evt = { matches } as unknown as MediaQueryListEvent;
      for (const fn of listeners) fn(evt);
    },
  };
  return fake;
}

describe("initTheme", () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    document.documentElement.classList.remove("tpc-dark");
  });

  afterEach(() => {
    document.documentElement.classList.remove("tpc-dark");
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("adds .tpc-dark to <html> when system preference is dark on call", () => {
    const mq = makeFakeMatchMedia(true);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme();

    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);
  });

  it("removes .tpc-dark from <html> when system preference is light on call", () => {
    document.documentElement.classList.add("tpc-dark"); // pre-existing state
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme();

    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("flips .tpc-dark live when matchMedia emits a change event", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme();
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);

    mq._emit(true);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);

    mq._emit(false);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("teardown removes the change listener", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    const teardown = initTheme();
    expect(mq.addEventListener).toHaveBeenCalledTimes(1);
    expect(mq._listeners.length).toBe(1);

    teardown();
    expect(mq.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mq._listeners.length).toBe(0);

    // Subsequent emit should not flip the class.
    mq._emit(true);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("returns a no-op teardown when window.matchMedia is unavailable", () => {
    // @ts-expect-error simulate environment without matchMedia
    window.matchMedia = undefined;

    const teardown = initTheme();
    expect(typeof teardown).toBe("function");
    // Must not throw on call.
    expect(() => teardown()).not.toThrow();
    // No class should have been added.
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("accepts an opts object with override field (forward-compat, Phase 22 ignores it)", () => {
    const mq = makeFakeMatchMedia(true);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    // Phase 25 will pass override; Phase 22 should accept the call signature.
    const teardown = initTheme({ override: "system" });
    expect(typeof teardown).toBe("function");
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);
    teardown();
  });
});
