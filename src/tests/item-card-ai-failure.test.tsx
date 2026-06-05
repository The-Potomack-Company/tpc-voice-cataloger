// Wave-0 RED (Phase 35 plan 01) — SC-4 list-card AI-failure row.
// D-07 contract: ItemCard must render a full-width inline failure row
// (role="alert", "AI processing failed" copy + Retry control) when
// ai_status === "failed", mirroring the detail-view AiFailureBanner. RED now
// because the card only renders a terse <Badge tone="err">Failed</Badge>.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ItemCard } from "../components/ItemCard";

// --- audio upload status hook — drives the pill (forced to "none" so the pill
//     does not produce a competing element near the alert query) ---
const { mockUseAudioUploadStatus } = vi.hoisted(() => ({
  mockUseAudioUploadStatus: vi.fn(),
}));
vi.mock("../hooks/useAudioUploadStatus", () => ({
  useAudioUploadStatus: mockUseAudioUploadStatus,
}));

vi.mock("../services/audioUploadQueue", () => ({
  retryFailedUploads: vi.fn(),
  enqueueAudioUpload: vi.fn(),
  drainAudioQueue: vi.fn(),
}));

vi.mock("../services/gemini", () => ({ processAudioWithAi: vi.fn() }));

vi.mock("../db/items", () => ({
  updateItemField: vi.fn(),
  deleteItem: vi.fn(),
}));

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-uuid-1",
    session_id: "session-uuid-1",
    ai_status: "done",
    title: "TEST ITEM",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderCard(item = makeItem()) {
  return render(
    <MemoryRouter>
      <ItemCard
        item={item as never}
        sessionId="session-uuid-1"
        isExpanded={false}
        onToggle={() => {}}
        audioCount={1}
        latestAudioId={10}
        hasServerAudio={false}
        photoCount={0}
        dexieItemId={10}
        isPending={false}
      />
    </MemoryRouter>
  );
}

describe("ItemCard AI-failure row (SC-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAudioUploadStatus.mockReturnValue("none");
  });

  it("renders the inline AI-failure row when ai_status is failed", () => {
    renderCard(makeItem({ ai_status: "failed" }));
    // RED: card currently shows only a terse Failed badge, no role="alert" row.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/AI processing failed/i);
    // A Retry control must be present in the failure row.
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("does not render the failure row when ai_status is done", () => {
    renderCard(makeItem({ ai_status: "done" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
