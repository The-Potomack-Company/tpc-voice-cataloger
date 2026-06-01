// Wave-0 RED scaffold (Phase 32 plan 01). Depends on the audio upload-status pill
// wired into ItemCard by plans 04/05 via ../hooks/useAudioUploadStatus and a
// retry path through ../services/audioUploadQueue (retryFailedUploads). Both modules
// are built later, so this suite is EXPECTED to fail/not-resolve at this commit.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ItemCard } from "../components/ItemCard";

// --- audio upload status hook (plan 04) — drives the pill ---
const { mockUseAudioUploadStatus } = vi.hoisted(() => ({
  mockUseAudioUploadStatus: vi.fn(),
}));
vi.mock("../hooks/useAudioUploadStatus", () => ({
  useAudioUploadStatus: mockUseAudioUploadStatus,
}));

// --- retry path (plan 03/04) ---
const { mockRetryFailedUploads } = vi.hoisted(() => ({
  mockRetryFailedUploads: vi.fn(),
}));
vi.mock("../services/audioUploadQueue", () => ({
  retryFailedUploads: mockRetryFailedUploads,
  enqueueAudioUpload: vi.fn(),
  drainAudioQueue: vi.fn(),
}));

// --- supporting mocks (mirror item-list.test.tsx) ---
vi.mock("../services/gemini", () => ({ processAudioWithAi: vi.fn() }));
vi.mock("../db", () => ({
  db: {
    photos: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) },
    audio: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) },
  },
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => {
    try { return fn(); } catch { return undefined; }
  },
}));
vi.mock("../hooks/useWriteAheadQueue", () => ({
  hasPendingForItem: vi.fn().mockResolvedValue(false),
}));
vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn().mockResolvedValue(10),
}));
vi.mock("../db/audioLookup", () => ({
  audioRecordsForItem: vi.fn().mockResolvedValue([{ id: 10 }]),
}));
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
        photoCount={0}
        dexieItemId={10}
        isPending={false}
      />
    </MemoryRouter>
  );
}

describe("ItemCard audio upload pill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a pending pill when the audio upload is pending", () => {
    mockUseAudioUploadStatus.mockReturnValue("pending");
    renderCard();
    expect(screen.getByTestId("audio-upload-pill")).toHaveTextContent(/pending/i);
  });

  it("renders an uploaded pill when the audio upload is uploaded", () => {
    mockUseAudioUploadStatus.mockReturnValue("uploaded");
    renderCard();
    expect(screen.getByTestId("audio-upload-pill")).toHaveTextContent(/uploaded/i);
  });

  it("renders a failed pill and re-enqueues via retryFailedUploads on click", () => {
    mockUseAudioUploadStatus.mockReturnValue("failed");
    renderCard();
    const pill = screen.getByTestId("audio-upload-pill");
    expect(pill).toHaveTextContent(/failed/i);
    fireEvent.click(pill);
    expect(mockRetryFailedUploads).toHaveBeenCalled();
  });

  it("renders no pill when there is no audio upload (status 'none')", () => {
    mockUseAudioUploadStatus.mockReturnValue("none");
    renderCard();
    expect(screen.queryByTestId("audio-upload-pill")).toBeNull();
  });
});
