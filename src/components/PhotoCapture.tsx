import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { ItemPhoto } from "../db/types";
import { resizeImage } from "../utils/image";
import { useBlobUrl } from "../hooks/useBlobUrl";

interface PhotoCaptureProps {
  itemId: number;
  onOpenLightbox: (index: number) => void;
}

function Thumbnail({
  photo,
  index,
  onTap,
}: {
  photo: ItemPhoto;
  index: number;
  onTap: (index: number) => void;
}) {
  const url = useBlobUrl(photo.thumbnail ?? photo.blob);

  return (
    <button
      type="button"
      onClick={() => onTap(index)}
      className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 focus:border-accent"
    >
      {url ? (
        <img
          src={url}
          alt={`Photo ${index + 1}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />
      )}
    </button>
  );
}

export function PhotoCapture({ itemId, onOpenLightbox }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const photos = useLiveQuery(
    () => db.photos.where("itemId").equals(itemId).sortBy("sortOrder"),
    [itemId],
    [] as ItemPhoto[],
  );

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleKeep = async () => {
    if (!previewFile) return;
    setIsSaving(true);
    try {
      const [fullBlob, thumbBlob] = await Promise.all([
        resizeImage(previewFile, 2048),
        resizeImage(previewFile, 200),
      ]);

      await db.photos.add({
        itemId,
        itemType: "house",
        blob: fullBlob,
        thumbnail: thumbBlob,
        sortOrder: photos.length,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error("Failed to save photo:", err);
    } finally {
      clearPreview();
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    clearPreview();
    // Re-open camera
    setTimeout(() => handleCameraClick(), 100);
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Camera button */}
      <button
        type="button"
        onClick={handleCameraClick}
        disabled={isSaving}
        className="flex items-center justify-center gap-2 w-full min-h-12 rounded-lg
          border-2 border-dashed border-gray-300 dark:border-gray-600
          text-gray-600 dark:text-gray-400
          hover:border-accent hover:text-accent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          />
        </svg>
        <span className="text-sm font-medium">Take Photo</span>
      </button>

      {/* Keep/Retake preview overlay */}
      {previewUrl && (
        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full max-h-64 object-contain bg-black"
          />
          <div className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              onClick={handleRetake}
              disabled={isSaving}
              className="flex-1 min-h-10 rounded-lg bg-gray-200 dark:bg-gray-700
                text-gray-700 dark:text-gray-300 text-sm font-medium
                disabled:opacity-50"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={handleKeep}
              disabled={isSaving}
              className="flex-1 min-h-10 rounded-lg bg-accent text-white text-sm font-medium
                disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Keep"}
            </button>
          </div>
        </div>
      )}

      {/* Horizontal thumbnail strip */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {photos.map((photo, index) => (
            <Thumbnail
              key={photo.id}
              photo={photo}
              index={index}
              onTap={onOpenLightbox}
            />
          ))}
        </div>
      )}
    </div>
  );
}
