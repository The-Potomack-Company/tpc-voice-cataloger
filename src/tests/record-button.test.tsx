import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordButton } from "../components/RecordButton";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { useRecordingStore } from "../stores/recordingStore";

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
  });

  it("renders microphone icon in idle state", () => {
    render(<RecordButton itemId={1} itemType="house" />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Start recording");
    // Should have the mic icon (data-testid)
    expect(screen.getByTestId("mic-icon")).toBeInTheDocument();
  });

  it("renders stop icon when recording", () => {
    mockHookReturn.status = "recording";
    render(<RecordButton itemId={1} itemType="house" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Stop recording");
    expect(screen.getByTestId("stop-icon")).toBeInTheDocument();
  });

  it("has minimum dimensions of 72px (w-18 h-18)", () => {
    render(<RecordButton itemId={1} itemType="house" />);
    const button = screen.getByRole("button");
    // w-18 h-18 = 4.5rem = 72px
    expect(button.className).toMatch(/w-18/);
    expect(button.className).toMatch(/h-18/);
  });

  it("calls startRecording on tap when idle", async () => {
    const user = userEvent.setup();
    render(<RecordButton itemId={5} itemType="sale" />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(mockStartRecording).toHaveBeenCalledWith(5, "sale");
  });

  it("calls stopRecording on tap when recording", async () => {
    mockHookReturn.status = "recording";
    const user = userEvent.setup();
    render(<RecordButton itemId={1} itemType="house" />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(mockStopRecording).toHaveBeenCalled();
  });

  it("shows disabled state while requesting", () => {
    mockHookReturn.status = "requesting";
    render(<RecordButton itemId={1} itemType="house" />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.className).toMatch(/opacity-50/);
  });

  it("shows error message when status is error", () => {
    mockHookReturn.status = "error";
    mockHookReturn.error = "Microphone permission denied.";
    render(<RecordButton itemId={1} itemType="house" />);
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

  it("shows play button when toast is visible", () => {
    act(() => {
      useRecordingStore.getState().setLastSaved(42, 5000);
    });
    render(<RecordingToast />);
    expect(screen.getByLabelText("Play recording")).toBeInTheDocument();
  });

  it("auto-dismisses after 4 seconds", () => {
    act(() => {
      useRecordingStore.getState().setLastSaved(42, 5000);
    });
    render(<RecordingToast />);
    expect(screen.getByText(/Recording saved/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(useRecordingStore.getState().lastSavedAudioId).toBeNull();
  });
});
