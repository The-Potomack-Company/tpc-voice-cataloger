import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoLightbox } from "../components/PhotoLightbox";
import type { ItemPhoto } from "../db/types";

// Mock useBlobUrl to return a fake URL
vi.mock("../hooks/useBlobUrl", () => ({
  useBlobUrl: (blob: Blob | undefined) =>
    blob ? "blob:http://localhost/fake-url" : undefined,
}));

function createMockPhoto(id: number, sortOrder: number): ItemPhoto {
  return {
    id,
    itemId: 1,
    itemType: "house",
    blob: new Blob(["fake"], { type: "image/jpeg" }),
    thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    sortOrder,
    createdAt: new Date(),
  };
}

describe("PhotoLightbox", () => {
  const mockPhotos = [
    createMockPhoto(1, 0),
    createMockPhoto(2, 1),
    createMockPhoto(3, 2),
  ];

  it("opens with correct initial photo index", () => {
    render(
      <PhotoLightbox
        photos={mockPhotos}
        initialIndex={1}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("shows first photo when initialIndex is 0", () => {
    render(
      <PhotoLightbox
        photos={mockPhotos}
        initialIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("clamps initialIndex to photo array bounds", () => {
    render(
      <PhotoLightbox
        photos={mockPhotos}
        initialIndex={10}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Should clamp to last photo (index 2 => "3 / 3")
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });

  it("calls onClose when close button is tapped", () => {
    const onClose = vi.fn();

    render(
      <PhotoLightbox
        photos={mockPhotos}
        initialIndex={0}
        onClose={onClose}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows delete confirmation when trash icon is tapped", () => {
    render(
      <PhotoLightbox
        photos={mockPhotos}
        initialIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Delete photo"));
    expect(screen.getByText("Delete this photo?")).toBeTruthy();
  });

  it("calls onDelete with correct photo ID when delete is confirmed", () => {
    const onDelete = vi.fn();

    render(
      <PhotoLightbox
        photos={mockPhotos}
        initialIndex={1}
        onClose={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByLabelText("Delete photo"));
    fireEvent.click(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledWith(2); // photo at index 1 has id=2
  });

  it("returns null when photos array is empty", () => {
    const { container } = render(
      <PhotoLightbox
        photos={[]}
        initialIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
