import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockSessionStore, mockAuthStore } = vi.hoisted(() => {
  const mockSessionStore = {
    sessions: [] as Array<Record<string, unknown>>,
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  };

  const mockAuthStore = {
    user: { id: "user-uuid-123" } as { id: string } | null,
  };

  return { mockSessionStore, mockAuthStore };
});

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => mockSessionStore,
  },
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: {
    getState: () => mockAuthStore,
  },
}));

import {
  createSession,
  updateSession,
  deleteSession,
  getSessionById,
} from "../db/sessions";

describe("sessions.ts (Supabase-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStore.sessions = [];
    mockAuthStore.user = { id: "user-uuid-123" };
  });

  describe("createSession", () => {
    it("calls useSessionStore.getState().createSession with correct args and returns a string UUID", async () => {
      mockSessionStore.createSession.mockResolvedValue("new-session-uuid");

      const result = await createSession("Test", "house", "notes");

      expect(mockSessionStore.createSession).toHaveBeenCalledWith(
        { name: "Test", mode: "house", notes: "notes", assigned_to: "user-uuid-123" },
        "user-uuid-123",
      );
      expect(typeof result).toBe("string");
      expect(result).toBe("new-session-uuid");
    });

    it("throws when user is not authenticated", async () => {
      mockAuthStore.user = null;

      await expect(createSession("Test", "house")).rejects.toThrow(
        "Not authenticated",
      );
      expect(mockSessionStore.createSession).not.toHaveBeenCalled();
    });
  });

  describe("updateSession", () => {
    it("calls useSessionStore.getState().updateSession with id and changes", async () => {
      mockSessionStore.updateSession.mockResolvedValue(undefined);

      await updateSession("uuid-1", { name: "New" });

      expect(mockSessionStore.updateSession).toHaveBeenCalledWith("uuid-1", {
        name: "New",
      });
    });
  });

  describe("deleteSession", () => {
    it("calls useSessionStore.getState().deleteSession with id", async () => {
      mockSessionStore.deleteSession.mockResolvedValue(undefined);

      await deleteSession("uuid-1");

      expect(mockSessionStore.deleteSession).toHaveBeenCalledWith("uuid-1");
    });
  });

  describe("getSessionById", () => {
    it("returns session from useSessionStore.getState().sessions matching id", () => {
      const session = {
        id: "uuid-1",
        name: "Test Session",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "user-uuid-123",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        assigned_to: null,
        review_notes: null,
      };
      mockSessionStore.sessions = [session];

      const result = getSessionById("uuid-1");

      expect(result).toEqual(session);
    });

    it("returns undefined when session not found", () => {
      mockSessionStore.sessions = [];

      const result = getSessionById("nonexistent");

      expect(result).toBeUndefined();
    });
  });
});
