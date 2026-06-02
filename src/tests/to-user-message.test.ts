import { describe, it, expect, afterEach, vi } from "vitest";
import { toUserMessage } from "../lib/toUserMessage";

const BAD_CREDS = "Wrong email or password";
const NETWORK = "Connection problem — try again";
const GENERIC = "Something went wrong";

describe("toUserMessage (D-09 central copy mapping)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps bad-credentials auth shape to the non-oracle login string (case-insensitive)", () => {
    expect(toUserMessage({ message: "Invalid login credentials" })).toBe(BAD_CREDS);
    expect(toUserMessage({ message: "INVALID LOGIN CREDENTIALS" })).toBe(BAD_CREDS);
    expect(toUserMessage({ message: "Invalid email or password" })).toBe(BAD_CREDS);
  });

  it("maps network/fetch shapes to the connection string", () => {
    expect(toUserMessage({ message: "Failed to fetch" })).toBe(NETWORK);
    expect(toUserMessage({ message: "NetworkError when attempting to fetch" })).toBe(NETWORK);
    expect(toUserMessage({ message: "ERR_INTERNET_DISCONNECTED" })).toBe(NETWORK);
  });

  it("maps offline navigator with an otherwise-unmapped message to the connection string", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(toUserMessage({ message: "boom" })).toBe(NETWORK);
  });

  it("falls back to the generic string for unmapped errors, strings, null, and undefined", () => {
    expect(toUserMessage({ message: "boom" })).toBe(GENERIC);
    expect(toUserMessage("some raw text")).toBe(GENERIC);
    expect(toUserMessage(null)).toBe(GENERIC);
    expect(toUserMessage(undefined)).toBe(GENERIC);
  });

  it("does not special-case good copy — it only maps known shapes + generic fallback", () => {
    expect(toUserMessage({ message: "Couldn't save title. Tap Retry to try again." })).toBe(GENERIC);
  });
});
