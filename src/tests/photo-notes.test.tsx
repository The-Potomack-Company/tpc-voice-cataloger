import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { PhotoNotesPage } from "../pages/PhotoNotes";
import { db } from "../db";
import { addNotePage, getNotePages } from "../db/notePages";

// Local-only blobs render through useBlobUrl — stub it to a fake URL.
vi.mock("../hooks/useBlobUrl", () => ({
  useBlobUrl: (blob: Blob | undefined) =>
    blob ? "blob:http://localhost/fake" : undefined,
}));

const { mockProcessNotes } = vi.hoisted(() => ({ mockProcessNotes: vi.fn() }));
vi.mock("../services/notesProcessing", () => ({ processNotes: mockProcessNotes }));

const SID = "session-1";

function jpeg(tag: string): Blob {
  return new Blob([tag], { type: "image/jpeg" });
}

async function seed(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await addNotePage({ sessionId: SID, blob: jpeg(`full-${i}`), thumbnail: jpeg(`thumb-${i}`) });
  }
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/session/${SID}/photo-notes`]}>
      <Routes>
        <Route path="/session/:sessionId/photo-notes" element={<PhotoNotesPage />} />
        <Route path="/session/:sessionId" element={<div>SESSION</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProcessNotes.mockResolvedValue(undefined);
  setOnline(true);
});

afterEach(async () => {
  await db.delete();
  await db.open();
});

describe("PhotoNotes — capture surface (PHN-02)", () => {
  it("renders captured pages as numbered, ordered thumbnails (UAT-2)", async () => {
    await seed(3);
    renderPage();

    expect(await screen.findByAltText("Note page 1")).toBeInTheDocument();
    expect(screen.getByAltText("Note page 2")).toBeInTheDocument();
    expect(screen.getByAltText("Note page 3")).toBeInTheDocument();
    expect(screen.queryByAltText("Note page 4")).not.toBeInTheDocument();
  });

  it("disables Move-up on the first row and Move-down on the last (UAT-8 a11y reorder)", async () => {
    await seed(2);
    renderPage();

    expect(await screen.findByLabelText("Move page 1 up")).toBeDisabled();
    expect(screen.getByLabelText("Move page 2 down")).toBeDisabled();
    expect(screen.getByLabelText("Move page 1 down")).toBeEnabled();
  });

  it("reorders pages via the down button and persists the new order (UAT-3)", async () => {
    await seed(3);
    const before = await getNotePages(SID);
    renderPage();

    fireEvent.click(await screen.findByLabelText("Move page 1 down"));

    await waitFor(async () => {
      const after = await getNotePages(SID);
      expect(after.map((p) => p.id)).toEqual([before[1].id, before[0].id, before[2].id]);
    });
  });

  it("deletes a page through the confirm dialog (UAT-4)", async () => {
    await seed(2);
    renderPage();

    fireEvent.click(await screen.findByLabelText("Delete page 1"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(async () => {
      expect((await getNotePages(SID)).length).toBe(1);
    });
  });
});

describe("PhotoNotes — Process gating (PHN-02)", () => {
  it("disables Process when there are no pages", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: /process 0 pages/i });
    expect(btn).toBeDisabled();
  });

  it("disables Process and shows the saved hint when offline with pages (UAT-6)", async () => {
    setOnline(false);
    await seed(2);
    renderPage();

    const btn = await screen.findByRole("button", { name: /process 2 pages/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/pages are saved/i)).toBeInTheDocument();
  });

  it("enables Process online and shows the stub toast without writing items (UAT-7)", async () => {
    await seed(2);
    renderPage();

    const btn = await screen.findByRole("button", { name: /process 2 pages/i });
    expect(btn).toBeEnabled();

    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockProcessNotes).toHaveBeenCalledWith(SID);
    });
    expect(await screen.findByText(/lands in the next update/i)).toBeInTheDocument();
  });
});
