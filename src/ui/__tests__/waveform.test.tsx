/**
 * Phase 27 — Waveform a11y / reduced-motion behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Waveform } from "../Waveform";
import { useRecordingStore } from "../../stores/recordingStore";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

describe("Waveform", () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    act(() => useRecordingStore.getState().reset());
  });
  afterEach(() => {
    if (originalMatchMedia) window.matchMedia = originalMatchMedia;
    act(() => useRecordingStore.getState().reset());
  });

  it("renders 48 bars with role=img and aria-label", () => {
    mockMatchMedia(false);
    const { container } = render(<Waveform ariaLabel="Mic level" />);
    const bars = container.querySelectorAll(".tpc-waveform-bar");
    expect(bars.length).toBe(48);
    expect(screen.getByLabelText("Mic level")).toHaveClass("tpc-waveform");
  });

  it("renders the static glyph fallback under prefers-reduced-motion when recording", () => {
    mockMatchMedia(true);
    act(() => useRecordingStore.getState().setRecording(true));
    render(<Waveform />);
    expect(screen.getByText("Recording…")).toBeInTheDocument();
  });

  it("does not render the static glyph when not recording", () => {
    mockMatchMedia(true);
    act(() => useRecordingStore.getState().setRecording(false));
    render(<Waveform />);
    expect(screen.queryByText("Recording…")).toBeNull();
  });

  it("marks recent bars as active when amplitudes are above threshold", () => {
    mockMatchMedia(false);
    act(() => {
      const s = useRecordingStore.getState();
      for (let i = 0; i < 48; i++) s.pushLevel(0.7);
    });
    const { container } = render(<Waveform />);
    const active = container.querySelectorAll('[data-active="true"]');
    // Last 12 bars are the "recent" window.
    expect(active.length).toBe(12);
  });
});
