import { describe, it, expect, beforeEach } from "vitest";
import { mockIsTypeSupported } from "./setup";
import { getPreferredMimeType, formatDuration } from "../utils/audio";

describe("getPreferredMimeType", () => {
  beforeEach(() => {
    // Reset to default supported types
    mockIsTypeSupported(["audio/webm;codecs=opus", "audio/webm"]);
  });

  it("returns audio/webm;codecs=opus when supported", () => {
    mockIsTypeSupported(["audio/webm;codecs=opus", "audio/webm"]);
    expect(getPreferredMimeType()).toBe("audio/webm;codecs=opus");
  });

  it("returns audio/mp4 when only audio/mp4 is supported (iOS Safari)", () => {
    mockIsTypeSupported(["audio/mp4"]);
    expect(getPreferredMimeType()).toBe("audio/mp4");
  });

  it("returns empty string when no types are supported", () => {
    mockIsTypeSupported([]);
    expect(getPreferredMimeType()).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats 0ms as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats 63000ms as 1:03", () => {
    expect(formatDuration(63000)).toBe("1:03");
  });

  it("formats 3661000ms as 61:01", () => {
    expect(formatDuration(3661000)).toBe("61:01");
  });
});
