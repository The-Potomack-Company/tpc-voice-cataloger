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
import { MemoryRouter } from "react-router";

type BlockedRow = {
  id: string;
  mode: string;
  session_id: string;
  title: string | null;
  receipt_number: string | null;
};

// --- Supabase mock: items select().eq('ai_status','failed') returns a controllable set ---
const { mockFrom, setBlocked } = vi.hoisted(() => {
  let blocked: Array<{
    id: string;
    mode: string;
    session_id: string;
    title: string | null;
    receipt_number: string | null;
  }> = [];
  const setBlocked = (
    rows: Array<{
      id: string;
      mode: string;
      session_id: string;
      title: string | null;
      receipt_number: string | null;
    }>,
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

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { BlockedQueueBadge } from "../components/BlockedQueueBadge";

function renderBadge() {
  return render(
    <MemoryRouter>
      <BlockedQueueBadge />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setBlocked([]);
});

describe("BlockedQueueBadge (REL-3 / D-10)", () => {
  it('renders a Badge with tone="err" when blockedCount > 0', async () => {
    setBlocked([
      { id: "i1", mode: "house", session_id: "s1", title: null, receipt_number: null },
    ]);
    renderBadge();
    const badge = await screen.findByTestId("blocked-queue-badge");
    expect(badge.className).toContain("tpc-badge-err");
  });

  it("shows the blocked-item count as the badge text", async () => {
    setBlocked([
      { id: "i1", mode: "house", session_id: "s1", title: null, receipt_number: null },
      { id: "i2", mode: "sale", session_id: "s1", title: null, receipt_number: null },
      { id: "i3", mode: "house", session_id: "s2", title: null, receipt_number: null },
    ]);
    renderBadge();
    const badge = await screen.findByTestId("blocked-queue-badge");
    expect(badge).toHaveTextContent("3");
  });

  it("renders nothing (no badge) when blockedCount is 0", async () => {
    setBlocked([]);
    const { container } = renderBadge();
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
    renderBadge();
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(screen.queryByTestId("blocked-queue-badge")).toBeNull();

    // A drain (while online, no DOM 'online' event) marks an item failed and
    // signals completion. The badge must re-fetch and appear.
    setBlocked([
      { id: "i-late", mode: "house", session_id: "s1", title: null, receipt_number: null },
    ]);
    act(() => {
      notifyDrainComplete();
    });

    const badge = await screen.findByTestId("blocked-queue-badge");
    expect(badge).toHaveTextContent("1");
  });

  it("opens a blocked-items detail list on click/tap — named rows, no bare UUIDs", async () => {
    setBlocked([
      {
        id: "item-aaaaaaaa-0000",
        mode: "house",
        session_id: "s1",
        title: "Brass Lamp",
        receipt_number: null,
      },
      {
        id: "item-bbbbbbbb-1111",
        mode: "sale",
        session_id: "s2",
        title: null,
        receipt_number: "R123",
      },
    ]);
    renderBadge();
    const badge = await screen.findByTestId("blocked-queue-badge");

    // Detail list hidden until the badge is clicked.
    expect(screen.queryByTestId("blocked-queue-detail")).toBeNull();

    fireEvent.click(badge);

    const detail = await screen.findByTestId("blocked-queue-detail");
    expect(detail).toBeInTheDocument();
    // Named rows render the title / receipt — never the bare UUID.
    expect(detail).toHaveTextContent("Brass Lamp");
    expect(detail).toHaveTextContent("#R123");
    expect(detail).not.toHaveTextContent("item-aaaaaaaa-0000");
    expect(detail).not.toHaveTextContent("item-bbbbbbbb-1111");
  });

  it("renders the title when present", async () => {
    setBlocked([
      {
        id: "uuid-title-row",
        mode: "house",
        session_id: "s1",
        title: "Brass Lamp",
        receipt_number: null,
      },
    ]);
    renderBadge();
    fireEvent.click(await screen.findByTestId("blocked-queue-badge"));
    const detail = await screen.findByTestId("blocked-queue-detail");
    expect(detail).toHaveTextContent("Brass Lamp");
    expect(detail).not.toHaveTextContent("uuid-title-row");
  });

  it("falls back to #receipt_number when title is null", async () => {
    setBlocked([
      {
        id: "uuid-receipt-row",
        mode: "sale",
        session_id: "s1",
        title: null,
        receipt_number: "R123",
      },
    ]);
    renderBadge();
    fireEvent.click(await screen.findByTestId("blocked-queue-badge"));
    const detail = await screen.findByTestId("blocked-queue-detail");
    expect(detail).toHaveTextContent("#R123");
    expect(detail).not.toHaveTextContent("uuid-receipt-row");
  });

  it("falls back to a short id slice (never the full UUID) when title + receipt are null", async () => {
    setBlocked([
      {
        id: "abcdef12-3456-7890-aaaa-bbbbbbbbbbbb",
        mode: "house",
        session_id: "s1",
        title: null,
        receipt_number: null,
      },
    ]);
    renderBadge();
    fireEvent.click(await screen.findByTestId("blocked-queue-badge"));
    const detail = await screen.findByTestId("blocked-queue-detail");
    // Short slice shown, full UUID never rendered.
    expect(detail).toHaveTextContent("abcdef12");
    expect(detail).not.toHaveTextContent("abcdef12-3456-7890-aaaa-bbbbbbbbbbbb");
  });

  it("shows each row's mode (House / Sale)", async () => {
    setBlocked([
      { id: "h1", mode: "house", session_id: "s1", title: "Lamp", receipt_number: null },
      { id: "s1x", mode: "sale", session_id: "s2", title: "Vase", receipt_number: null },
    ]);
    renderBadge();
    fireEvent.click(await screen.findByTestId("blocked-queue-badge"));
    const detail = await screen.findByTestId("blocked-queue-detail");
    expect(detail).toHaveTextContent("House");
    expect(detail).toHaveTextContent("Sale");
  });

  it("navigates to the item route on tap", async () => {
    setBlocked([
      {
        id: "item-99",
        mode: "house",
        session_id: "sess-42",
        title: "Brass Lamp",
        receipt_number: null,
      },
    ]);
    renderBadge();
    fireEvent.click(await screen.findByTestId("blocked-queue-badge"));
    const row = await screen.findByText("Brass Lamp");
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith("/session/sess-42/item/item-99");
  });

  it("closes the dropdown after navigating", async () => {
    setBlocked([
      {
        id: "item-99",
        mode: "house",
        session_id: "sess-42",
        title: "Brass Lamp",
        receipt_number: null,
      },
    ]);
    renderBadge();
    fireEvent.click(await screen.findByTestId("blocked-queue-badge"));
    const row = await screen.findByText("Brass Lamp");
    fireEvent.click(row);
    expect(screen.queryByTestId("blocked-queue-detail")).toBeNull();
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
