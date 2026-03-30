import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase since sessionStore imports it
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useSessionStore, scopeSessionStore } from "../stores/sessionStore";
import { useUIStore, scopeUIStore } from "../stores/uiStore";

describe("persist scoping", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("sessionStore persist", () => {
    it("useSessionStore.persist has name property", () => {
      const options = useSessionStore.persist.getOptions();
      expect(options.name).toBeDefined();
      expect(typeof options.name).toBe("string");
    });

    it("scopeSessionStore(userId) sets name to tpc-sessions-{userId}", () => {
      scopeSessionStore("user-abc-123");
      const options = useSessionStore.persist.getOptions();
      expect(options.name).toBe("tpc-sessions-user-abc-123");
    });
  });

  describe("uiStore persist", () => {
    it("scopeUIStore(userId) sets name to tpc-ui-state-{userId}", () => {
      scopeUIStore("user-abc-123");
      const options = useUIStore.persist.getOptions();
      expect(options.name).toBe("tpc-ui-state-user-abc-123");
    });

    it("legacy key migration: copies tpc-ui-state to tpc-ui-state-{userId} and removes old", () => {
      const legacyData = JSON.stringify({
        state: { hasCompletedWalkthrough: true, recordingSessionId: null },
        version: 0,
      });
      localStorage.setItem("tpc-ui-state", legacyData);

      scopeUIStore("user-abc-123");

      // Legacy key should be removed
      expect(localStorage.getItem("tpc-ui-state")).toBeNull();
      // Scoped key should have the data
      expect(localStorage.getItem("tpc-ui-state-user-abc-123")).toBe(
        legacyData,
      );
    });

    it("legacy key migration: does not overwrite existing scoped key", () => {
      const legacyData = JSON.stringify({
        state: { hasCompletedWalkthrough: false },
        version: 0,
      });
      const scopedData = JSON.stringify({
        state: { hasCompletedWalkthrough: true },
        version: 0,
      });
      localStorage.setItem("tpc-ui-state", legacyData);
      localStorage.setItem("tpc-ui-state-user-abc-123", scopedData);

      scopeUIStore("user-abc-123");

      // Scoped key should still have original scoped data
      expect(localStorage.getItem("tpc-ui-state-user-abc-123")).toBe(
        scopedData,
      );
    });
  });
});
