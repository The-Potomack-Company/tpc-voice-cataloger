/**
 * REL-3 / D-10 contract — implemented in Plan 33-03.
 *
 * The blocked-count badge: a Badge (tone="err") rendered in the AppLayout header
 * next to OfflineIndicator showing the count of blocked (items.ai_status='failed')
 * items, where click/tap opens a detail list of those items. Renders nothing when
 * the count is 0 (mirrors OfflineIndicator). Keep this file in sync with D-10.
 *
 * (Un-skipped from the Wave-0 RED stub; assertions intact per the locked contract.)
 */
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// --- Supabase mock: items select().eq('ai_status','failed') returns a controllable set ---
const { mockFrom, setBlocked } = vi.hoisted(() => {
  let blocked: Array<{ id: string; mode: string; session_id: string }> = [];
  const setBlocked = (
    rows: Array<{ id: string; mode: string; session_id: string }>,
  ) => {
    blocked = rows;
  };
  const mockFrom = vi.fn(() => ({
    select: vi.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => ({
      eq: vi.fn(() => {
        if (opts?.head) {
          return Promise.resolve({ data: null, count: blocked.length, error: null });
        }
        return {
          order: vi.fn(() =>
            Promise.resolve({ data: blocked, count: blocked.length, error: null }),
          ),
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: blocked, count: blocked.length, error: null }),
        };
      }),
    })),
  }));
  return { mockFrom, setBlocked };
});

vi.mock("../lib/supabase", () => ({ supabase: { from: mockFrom } }));

import { BlockedQueueBadge } from "../components/BlockedQueueBadge";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setBlocked([]);
});

describe("BlockedQueueBadge (REL-3 / D-10)", () => {
  it('renders a Badge with tone="err" when blockedCount > 0', async () => {
    setBlocked([{ id: "i1", mode: "house", session_id: "s1" }]);
    render(<BlockedQueueBadge />);
    const badge = await screen.findByTestId("blocked-queue-badge");
    expect(badge.className).toContain("tpc-badge-err");
  });

  it("shows the blocked-item count as the badge text", async () => {
    setBlocked([
      { id: "i1", mode: "house", session_id: "s1" },
      { id: "i2", mode: "sale", session_id: "s1" },
      { id: "i3", mode: "house", session_id: "s2" },
    ]);
    render(<BlockedQueueBadge />);
    const badge = await screen.findByTestId("blocked-queue-badge");
    expect(badge).toHaveTextContent("3");
  });

  it("renders nothing (no badge) when blockedCount is 0", async () => {
    setBlocked([]);
    const { container } = render(<BlockedQueueBadge />);
    // Allow the async count read to settle, then assert nothing rendered.
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("blocked-queue-badge")).toBeNull();
    expect(container.querySelector(".tpc-badge")).toBeNull();
  });

  it("WR-04: refreshes when a drain completes (item flips to failed while online)", async () => {
    const { notifyDrainComplete } = await import("../stores/drainSignalStore");
    const { act } = await import("@testing-library/react");

    // Start with nothing blocked → badge renders nothing.
    setBlocked([]);
    render(<BlockedQueueBadge />);
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByTestId("blocked-queue-badge")).toBeNull();

    // A drain (while online, no DOM 'online' event) marks an item failed and
    // signals completion. The badge must re-fetch and appear.
    setBlocked([{ id: "i-late", mode: "house", session_id: "s1" }]);
    act(() => {
      notifyDrainComplete();
    });

    const badge = await screen.findByTestId("blocked-queue-badge");
    expect(badge).toHaveTextContent("1");
  });

  it("opens a blocked-items detail list on click/tap", async () => {
    setBlocked([
      { id: "item-aaa", mode: "house", session_id: "s1" },
      { id: "item-bbb", mode: "sale", session_id: "s2" },
    ]);
    render(<BlockedQueueBadge />);
    const badge = await screen.findByTestId("blocked-queue-badge");

    // Detail list hidden until the badge is clicked.
    expect(screen.queryByTestId("blocked-queue-detail")).toBeNull();

    fireEvent.click(badge);

    const detail = await screen.findByTestId("blocked-queue-detail");
    expect(detail).toBeInTheDocument();
    expect(detail).toHaveTextContent("item-aaa");
    expect(detail).toHaveTextContent("item-bbb");
  });
});

describe("BlockedQueueBadge mount (AppLayout header next to OfflineIndicator)", () => {
  it("is imported and mounted in AppLayout adjacent to OfflineIndicator", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(
      resolve(process.cwd(), "src/layouts/AppLayout.tsx"),
      "utf8",
    );
    expect(src).toContain("BlockedQueueBadge");
    // Mounted directly after the OfflineIndicator element in the header.
    const offlineIdx = src.indexOf("<OfflineIndicator");
    const badgeIdx = src.indexOf("<BlockedQueueBadge");
    expect(offlineIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(offlineIdx);
  });
});
