import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockSessionStore } = vi.hoisted(() => {
  const mockSessionStore = {
    createItem: vi.fn(),
    updateItemField: vi.fn(),
    deleteItem: vi.fn(),
    appendToItemField: vi.fn(),
  };

  return { mockSessionStore };
});

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => mockSessionStore,
  },
}));

import {
  createBlankItem,
  updateItemField,
  deleteItem,
  appendToItemField,
} from "../db/items";

describe("items.ts (Supabase-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBlankItem", () => {
    it("calls useSessionStore.getState().createItem and returns string UUID", async () => {
      mockSessionStore.createItem.mockResolvedValue("new-item-uuid");

      const result = await createBlankItem("session-uuid", "house");

      expect(mockSessionStore.createItem).toHaveBeenCalledWith(
        "session-uuid",
        "house",
        undefined,
      );
      expect(typeof result).toBe("string");
      expect(result).toBe("new-item-uuid");
    });

    it("passes receiptNumber when provided", async () => {
      mockSessionStore.createItem.mockResolvedValue("new-item-uuid");

      await createBlankItem("session-uuid", "sale", "R-001");

      expect(mockSessionStore.createItem).toHaveBeenCalledWith(
        "session-uuid",
        "sale",
        "R-001",
      );
    });
  });

  describe("updateItemField", () => {
    it("calls useSessionStore.getState().updateItemField with correct args", async () => {
      mockSessionStore.updateItemField.mockResolvedValue(undefined);

      await updateItemField("item-uuid", "session-uuid", "title", "NEW");

      expect(mockSessionStore.updateItemField).toHaveBeenCalledWith(
        "item-uuid",
        "session-uuid",
        "title",
        "NEW",
      );
    });
  });

  describe("deleteItem", () => {
    it("calls useSessionStore.getState().deleteItem with correct args", async () => {
      mockSessionStore.deleteItem.mockResolvedValue(undefined);

      await deleteItem("item-uuid", "session-uuid");

      expect(mockSessionStore.deleteItem).toHaveBeenCalledWith(
        "item-uuid",
        "session-uuid",
      );
    });
  });

  describe("appendToItemField", () => {
    it("calls useSessionStore.getState().appendToItemField with correct args", async () => {
      mockSessionStore.appendToItemField.mockResolvedValue(undefined);

      await appendToItemField(
        "item-uuid",
        "session-uuid",
        "transcript",
        "new text",
      );

      expect(mockSessionStore.appendToItemField).toHaveBeenCalledWith(
        "item-uuid",
        "session-uuid",
        "transcript",
        "new text",
      );
    });
  });
});
