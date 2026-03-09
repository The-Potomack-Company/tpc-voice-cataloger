import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { db } from "../db";
import { ItemList } from "../components/ItemList";

// Mock useAudioRecorder to avoid MediaRecorder in component tests
vi.mock("../hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => ({
    status: "idle" as const,
    durationMs: 0,
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

// Mock processAudioWithAi
vi.mock("../services/gemini", () => ({
  processAudioWithAi: vi.fn(),
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("ItemList", () => {
  it("shows empty state when no items exist", () => {
    render(<ItemList sessionId={1} mode="house" />);
    expect(screen.getByText(/No items yet/)).toBeInTheDocument();
  });

  it("renders items as cards with correct item numbers", async () => {
    await db.houseVisitItems.bulkAdd([
      { sessionId: 1, title: "Antique Chair", sortOrder: 0, createdAt: new Date() },
      { sessionId: 1, title: "Oak Table", sortOrder: 1, createdAt: new Date() },
    ]);

    render(<ItemList sessionId={1} mode="house" />);

    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
      expect(screen.getByText(/Item 2/)).toBeInTheDocument();
    });
  });

  it("expands a card on tap to show editable fields", async () => {
    await db.houseVisitItems.add({
      sessionId: 1,
      title: "Vase",
      description: "Blue porcelain",
      sortOrder: 0,
      createdAt: new Date(),
    });

    render(<ItemList sessionId={1} mode="house" />);

    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText(/Item 1/));

    // Should show field labels in expanded section
    await waitFor(() => {
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Condition")).toBeInTheDocument();
      expect(screen.getByText("Estimate")).toBeInTheDocument();
      expect(screen.getByText("Category")).toBeInTheDocument();
    });
  });

  it("shows Add Item button when items exist", async () => {
    await db.houseVisitItems.add({
      sessionId: 1,
      title: "Item A",
      sortOrder: 0,
      createdAt: new Date(),
    });

    render(<ItemList sessionId={1} mode="house" />);

    await waitFor(() => {
      expect(screen.getByText("Add Item")).toBeInTheDocument();
    });
  });
});
