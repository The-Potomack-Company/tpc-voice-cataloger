import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorToast } from "../components/ErrorToast";
import { useNotificationStore } from "../stores/notificationStore";

function resetStore() {
  useNotificationStore.setState({ message: null, retry: null });
}

describe("notificationStore dedupe (D-05)", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("does not replace state when re-firing the identical current message", () => {
    const retry = vi.fn();
    useNotificationStore.getState().notifyError("X", retry);
    const before = useNotificationStore.getState();

    useNotificationStore.getState().notifyError("X");
    const after = useNotificationStore.getState();

    expect(after.message).toBe("X");
    expect(after.retry).toBe(before.retry);
  });

  it("replaces state when a different message fires", () => {
    useNotificationStore.getState().notifyError("X");
    useNotificationStore.getState().notifyError("Y");
    expect(useNotificationStore.getState().message).toBe("Y");
  });
});

describe("ErrorToast retry-sticky auto-dismiss (D-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
    resetStore();
  });

  it("a retryable toast survives past 6s (no auto-dismiss)", () => {
    act(() => {
      useNotificationStore.getState().notifyError("retryable", vi.fn());
    });
    render(<ErrorToast />);

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(useNotificationStore.getState().message).toBe("retryable");
    expect(screen.getByText("retryable")).toBeTruthy();
  });

  it("an informational toast (no retry) auto-dismisses after 6s", () => {
    act(() => {
      useNotificationStore.getState().notifyError("info");
    });
    render(<ErrorToast />);

    expect(useNotificationStore.getState().message).toBe("info");

    act(() => {
      vi.advanceTimersByTime(6001);
    });

    expect(useNotificationStore.getState().message).toBe(null);
  });

  it("Dismiss icon button exposes an accessible name (WCAG 4.1.2)", () => {
    act(() => {
      useNotificationStore.getState().notifyError("info");
    });
    render(<ErrorToast />);

    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });
});
