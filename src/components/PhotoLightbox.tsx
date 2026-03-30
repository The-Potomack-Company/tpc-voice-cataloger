import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { ItemPhoto } from "../db/types";
import { usePhotoUrl } from "../hooks/usePhotoUrl";
import { ConfirmDialog } from "./ConfirmDialog";

interface PhotoLightboxProps {
  photos: ItemPhoto[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (photoId: number) => void;
}

function LightboxImage({ photo }: { photo: ItemPhoto }) {
  // Look up storage path from photoUploadQueue for signed URL fallback
  const queueEntry = useLiveQuery(
    () => photo.id ? db.photoUploadQueue.where('dexiePhotoId').equals(photo.id).first() : undefined,
    [photo.id],
    undefined,
  );
  const url = usePhotoUrl(photo.blob, queueEntry?.storagePath);

  return url ? (
    <img
      src={url}
      alt="Full size"
      className="max-w-full max-h-full object-contain select-none"
      draggable={false}
    />
  ) : (
    <div className="text-gray-400">Loading...</div>
  );
}

export function PhotoLightbox({
  photos,
  initialIndex,
  onClose,
  onDelete,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, photos.length - 1),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Swipe gesture tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  if (photos.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentIndex, photos.length - 1);
  const currentPhoto = photos[safeIndex];

  const goNext = () => {
    if (safeIndex < photos.length - 1) {
      setCurrentIndex(safeIndex + 1);
    }
  };

  const goPrev = () => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swiping.current) return;
    swiping.current = false;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Only count as horizontal swipe if horizontal movement > vertical
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  };

  const handleDelete = () => {
    const photoId = currentPhoto.id!;
    const wasLastPhoto = photos.length === 1;
    const wasLastIndex = safeIndex === photos.length - 1;

    onDelete(photoId);

    if (wasLastPhoto) {
      onClose();
    } else if (wasLastIndex) {
      setCurrentIndex(safeIndex - 1);
    }
    // else: stay at same index (next photo slides in)

    setShowDeleteConfirm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-2 z-10">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="min-w-12 min-h-12 flex items-center justify-center text-white"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Trash button */}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete photo"
          className="min-w-12 min-h-12 flex items-center justify-center text-white"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      </div>

      {/* Photo display */}
      <div className="flex-1 flex items-center justify-center px-2 overflow-hidden">
        <LightboxImage photo={currentPhoto} />
      </div>

      {/* Photo counter */}
      <div className="text-center text-white text-sm pb-4 pt-2">
        {safeIndex + 1} / {photos.length}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Photo"
        message="Delete this photo?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
