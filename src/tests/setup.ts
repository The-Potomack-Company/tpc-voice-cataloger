import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { expect } from "vitest";
// jest-axe@10 bundles its own types — do NOT add @types/jest-axe (stale 3.5.9 would shadow them).
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// Mock matchMedia for jsdom (used by InstallBanner standalone detection)
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// --- MediaRecorder and getUserMedia mocks for audio tests ---

let _supportedTypes: string[] = ["audio/webm;codecs=opus", "audio/webm"];

/**
 * Set which MIME types MediaRecorder.isTypeSupported returns true for.
 * Call in beforeEach to customize per test.
 */
export function mockIsTypeSupported(supportedTypes: string[]): void {
  _supportedTypes = supportedTypes;
}

class MockMediaRecorder {
  stream: MediaStream;
  mimeType: string;
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType || "";
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    // Fire ondataavailable with a test Blob, then onstop (async, like real MediaRecorder)
    queueMicrotask(() => {
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob(["test-audio-data"], { type: this.mimeType || "audio/webm" }),
        });
      }
      if (this.onstop) {
        this.onstop();
      }
    });
  }

  static isTypeSupported(type: string): boolean {
    return _supportedTypes.includes(type);
  }
}

// Install MediaRecorder mock on globalThis
Object.defineProperty(globalThis, "MediaRecorder", {
  writable: true,
  configurable: true,
  value: MockMediaRecorder,
});

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [{ stop: vi.fn(), kind: "audio" }],
  getAudioTracks: () => [{ stop: vi.fn(), kind: "audio" }],
} as unknown as MediaStream);

if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: {
      getUserMedia: mockGetUserMedia,
    },
  });
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof URL !== "undefined") {
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: () => "blob:mock-url",
    });
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: () => {},
    });
  }
}
