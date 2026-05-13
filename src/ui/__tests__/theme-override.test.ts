/**
 * Phase 25 — initTheme override behavior.
 *
 * Verifies that opts.override of "light" / "dark" forces .tpc-dark on or
 * off regardless of matchMedia, and that "system" reverts to live media
 * tracking.
 */

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
      const evt = { matches } as unknown as MediaQueryListEvent;
      for (const fn of listeners) fn(evt);
    },
  };
  return fake;
}

describe("initTheme override (Phase 25)", () => {
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

  it("override='dark' forces .tpc-dark on even if system pref is light", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme({ override: "dark" });

    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);
    // Should not register a media listener (override short-circuits it).
    expect(mq.addEventListener).not.toHaveBeenCalled();
  });

  it("override='light' forces .tpc-dark off even if system pref is dark", () => {
    document.documentElement.classList.add("tpc-dark");
    const mq = makeFakeMatchMedia(true);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme({ override: "light" });

    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
    expect(mq.addEventListener).not.toHaveBeenCalled();
  });

  it("override='system' tracks matchMedia live", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme({ override: "system" });
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);

    mq._emit(true);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);
  });

  it("subsequent initTheme calls tear down prior listeners", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme({ override: "system" });
    expect(mq.addEventListener).toHaveBeenCalledTimes(1);

    // Switching to a force override should remove the system listener.
    initTheme({ override: "dark" });
    expect(mq.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
