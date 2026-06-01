import { describe, it, expect, afterEach } from "vitest";
import { classifyAiError } from "../utils/aiErrorClass";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

describe("classifyAiError (D-08 taxonomy)", () => {
  afterEach(() => {
    setOnline(true); // reset to default for subsequent tests
  });

  it("offline → transient regardless of error", () => {
    setOnline(false);
    expect(classifyAiError(new Error("Proxy returned HTTP 400: bad"))).toBe("transient");
  });

  it("AbortError DOMException → transient (request timeout)", () => {
    setOnline(true);
    const err = new DOMException("aborted", "AbortError");
    expect(classifyAiError(err)).toBe("transient");
  });

  it("network error messages → transient", () => {
    setOnline(true);
    expect(classifyAiError(new Error("Failed to fetch"))).toBe("transient");
    expect(classifyAiError(new Error("NetworkError when attempting fetch"))).toBe("transient");
    expect(classifyAiError(new Error("Load failed"))).toBe("transient");
    expect(classifyAiError(new Error("The operation was aborted"))).toBe("transient");
  });

  it("HTTP 429 → transient (rate-limit)", () => {
    setOnline(true);
    expect(classifyAiError(new Error("Proxy returned HTTP 429: rate limited"))).toBe("transient");
  });

  it("HTTP 5xx → transient (server fault)", () => {
    setOnline(true);
    expect(classifyAiError(new Error("Proxy returned HTTP 500: oops"))).toBe("transient");
    expect(classifyAiError(new Error("Proxy returned HTTP 503: unavailable"))).toBe("transient");
  });

  it("HTTP 4xx (non-429) → permanent (validation/auth)", () => {
    setOnline(true);
    expect(classifyAiError(new Error("Proxy returned HTTP 400: bad request"))).toBe("permanent");
    expect(classifyAiError(new Error("Proxy returned HTTP 401: unauthorized"))).toBe("permanent");
    expect(classifyAiError(new Error("Proxy returned HTTP 404: not found"))).toBe("permanent");
  });

  it("Zod validation failure → permanent", () => {
    setOnline(true);
    expect(classifyAiError(new Error("Zod validation failed: bad shape"))).toBe("permanent");
  });

  it("unsupported format → permanent", () => {
    setOnline(true);
    expect(classifyAiError(new Error("unsupported format: audio/foo"))).toBe("permanent");
  });

  it("unknown error → transient (safe default: retry not drop)", () => {
    setOnline(true);
    expect(classifyAiError(new Error("something weird happened"))).toBe("transient");
    expect(classifyAiError("plain string error")).toBe("transient");
    expect(classifyAiError(undefined)).toBe("transient");
  });
});
