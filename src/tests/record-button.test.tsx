import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordButton } from "../components/RecordButton";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { useRecordingStore } from "../stores/recordingStore";
import { processAudioWithAi } from "../services/gemini";
import { updateItemField } from "../db/items";

vi.mock("../services/gemini", () => ({
  processAudioWithAi: vi.fn(),
}));

vi.mock("../db/items", () => ({
  updateItemField: vi.fn(),
}));

// Mock the useAudioRecorder hook
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn().mockResolvedValue(1);

vi.mock("../hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => mockHookReturn,
}));

let mockHookReturn = {
  status: "idle" as "idle" | "requesting" | "recording" | "error",
  durationMs: 0,
  error: null as string | null,
  startRecording: mockStartRecording,
  stopRecording: mockStopRecording,
};

describe("RecordButton", () => {
  beforeEach(() => {
    mockHookReturn = {
      status: "idle",
      durationMs: 0,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
    };
    vi.clearAllMocks();
    vi.mocked(processAudioWithAi).mockResolvedValue(undefined);
    vi.mocked(updateItemField).mockResolvedValue(undefined);
  });

  it("renders microphone icon in idle state", () => {
    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Start recording");
    // Should have the mic icon (data-testid)
    expect(screen.getByTestId("mic-icon")).toBeInTheDocument();
  });

  it("renders stop icon when recording", () => {
    mockHookReturn.status = "recording";
    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Stop recording");
    expect(screen.getByTestId("stop-icon")).toBeInTheDocument();
  });

  it("renders with the tpc-record-fab class (76x76 token-driven FAB)", () => {
    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    const button = screen.getByRole("button");
    expect(button.className).toMatch(/tpc-record-fab/);
  });

  it("calls startRecording on tap when idle", async () => {
    const user = userEvent.setup();
    render(<RecordButton itemId="item-5" sessionId="session-1" />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(mockStartRecording).toHaveBeenCalledWith("item-5", "session-1");
  });

  it("calls stopRecording on tap when recording", async () => {
    mockHookReturn.status = "recording";
    const user = userEvent.setup();
    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(mockStopRecording).toHaveBeenCalled();
  });

  it("sets ai_status to queued before fire-and-forget AI so a rejected inline call stays drainable", async () => {
    mockHookReturn.status = "recording";
    vi.mocked(processAudioWithAi).mockRejectedValue(new Error("network down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    await user.click(screen.getByRole("button"));
    await Promise.resolve();

    expect(updateItemField).toHaveBeenCalledWith(
      "item-1",
      "session-1",
      "ai_status",
      "queued",
    );
    expect(updateItemField).not.toHaveBeenCalledWith(
      "item-1",
      "session-1",
      "ai_status",
      "pending",
    );
    expect(processAudioWithAi).toHaveBeenCalledWith(1, "item-1", "session-1");

    consoleSpy.mockRestore();
  });

  it("shows disabled state while requesting", () => {
    mockHookReturn.status = "requesting";
    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.style.opacity).toBe("0.5");
  });

  it("shows error message when status is error", () => {
    mockHookReturn.status = "error";
    mockHookReturn.error = "Microphone permission denied.";
    render(<RecordButton itemId="item-1" sessionId="session-1" />);
    expect(screen.getByText("Microphone permission denied.")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });
});

describe("RecordingIndicator", () => {
  beforeEach(() => {
    useRecordingStore.getState().reset();
  });

  it("shows MM:SS timer when isRecording is true", () => {
    act(() => {
      useRecordingStore.getState().setRecording(true);
      useRecordingStore.getState().setDuration(65000); // 1:05
    });
    render(<RecordingIndicator />);
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("renders nothing when isRecording is false", () => {
    render(<RecordingIndicator />);
    const { container } = render(<RecordingIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it("shows red border overlay when recording", () => {
    act(() => {
      useRecordingStore.getState().setRecording(true);
    });
    render(<RecordingIndicator />);
    expect(screen.getByTestId("recording-border")).toBeInTheDocument();
  });
});

describe("RecordingToast", () => {
  beforeEach(() => {
    useRecordingStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders formatted duration when lastSavedAudioId is set", () => {
    act(() => {
      useRecordingStore.getState().setLastSaved(42, 5000);
    });
    render(<RecordingToast />);
    expect(screen.getByText(/Recording saved/)).toBeInTheDocument();
    expect(screen.getByText(/0:05/)).toBeInTheDocument();
  });

  it("renders nothing when lastSavedAudioId is null", () => {
    const { container } = render(<RecordingToast />);
    expect(container.firstChild).toBeNull();
  });

  it("shows confirmation text when toast is visible", () => {
    act(() => {
      useRecordingStore.getState().setLastSaved(42, 5000);
    });
    render(<RecordingToast />);
    expect(screen.getByText(/Recording saved/)).toBeInTheDocument();
  });

  it("auto-dismisses after 3 seconds", () => {
    act(() => {
      useRecordingStore.getState().setLastSaved(42, 5000);
    });
    render(<RecordingToast />);
    expect(screen.getByText(/Recording saved/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(useRecordingStore.getState().lastSavedAudioId).toBeNull();
  });
});
