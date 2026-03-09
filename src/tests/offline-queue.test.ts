import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUIStore } from "../stores/uiStore";

describe("AiStatus type", () => {
  it("accepts 'queued' as a valid value", () => {
    // Compile-time check: if this compiles, the test passes
    const status: import("../db/types").AiStatus = "queued";
    expect(status).toBe("queued");
  });
});

describe("useOnlineStatus hook", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    // Reset store
    useUIStore.setState({ isOnline: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: originalOnLine,
    });
  });

  it("returns true when navigator.onLine is true", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false when navigator.onLine is false", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: false,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("updates when online event fires on window", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: false,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    // Simulate going online
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  it("updates when offline event fires on window", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // Simulate going offline
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: false,
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });
});
