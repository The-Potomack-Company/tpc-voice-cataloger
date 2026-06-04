// Wave-0 RED gate (Phase 42 plan 02) — SC-2/SC-3 cross-device audio recovery.
// Contract: AiFailureBanner must render a working Retry for a failed item whose
// audio exists ONLY server-side (no local Dexie integer id). The banner must
// gate on a `hasServerAudio` boolean threaded from the parent, NOT the
// device-local integer `latestAudioId` (GAP-5 / 42-RESEARCH.md). Retry must
// route through the gemini.ts orchestrator (processAudioWithAi) with isRetry=true
// keyed on item_id — resolveAudioForAi falls through to Storage-by-item_id, so a
// sentinel/0 audioId resolves without a real Dexie integer.
//
// RED before Task 1: AiFailureBanner currently returns null whenever
// latestAudioId == null (AiFailureBanner.tsx:39) and has no hasServerAudio prop,
// so the server-only case renders nothing and the prop reference is a type error.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AiFailureBanner } from "../components/AiFailureBanner";

const { mockProcessAudioWithAi } = vi.hoisted(() => ({
  mockProcessAudioWithAi: vi.fn(() => Promise.resolve()),
}));
vi.mock("../services/gemini", () => ({
  processAudioWithAi: mockProcessAudioWithAi,
}));

vi.mock("../hooks/useAudioUploadStatus", () => ({
  useAudioUploadStatus: vi.fn(() => "none"),
}));

vi.mock("../services/audioUploadQueue", () => ({
  retryFailedUploads: vi.fn(),
  enqueueAudioUpload: vi.fn(),
  drainAudioQueue: vi.fn(),
}));

const ITEM_UUID = "item-uuid-1";
const SESSION_UUID = "session-uuid-1";

function renderBanner(props: {
  latestAudioId: number | null;
  hasServerAudio: boolean;
}) {
  return render(
    <MemoryRouter>
      <AiFailureBanner
        itemId={ITEM_UUID}
        sessionId={SESSION_UUID}
        latestAudioId={props.latestAudioId}
        hasServerAudio={props.hasServerAudio}
      />
    </MemoryRouter>,
  );
}

describe("AiFailureBanner cross-device recovery (SC-2/SC-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessAudioWithAi.mockReturnValue(Promise.resolve());
  });

  it("renders the alert + Retry when audio exists only server-side (no Dexie int)", () => {
    // Cross-device: latestAudioId is null (audioRecordsForItem returned only
    // Supabase-union rows with id:undefined) but the audio truly exists.
    renderBanner({ latestAudioId: null, hasServerAudio: true });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/AI processing failed/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("clicking Retry calls the gemini orchestrator keyed on item_id (no integer audioId)", () => {
    renderBanner({ latestAudioId: null, hasServerAudio: true });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(mockProcessAudioWithAi).toHaveBeenCalledTimes(1);
    const call = mockProcessAudioWithAi.mock.calls[0];
    // (audioId, itemId, sessionId, isRetry): sentinel audioId, real item UUID,
    // isRetry=true so resolveAudioForAi resolves via Storage-by-item_id.
    expect(call[1]).toBe(ITEM_UUID);
    expect(call[2]).toBe(SESSION_UUID);
    expect(call[3]).toBe(true);
  });

  it("stays hidden when there is neither a Dexie int nor server-side audio", () => {
    const { container } = renderBanner({ latestAudioId: null, hasServerAudio: false });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("still renders for the local-blob path (latestAudioId is a number)", () => {
    renderBanner({ latestAudioId: 10, hasServerAudio: false });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
