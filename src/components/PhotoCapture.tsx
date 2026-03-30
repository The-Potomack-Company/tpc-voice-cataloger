import { useRef, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { ItemPhoto } from "../db/types";
import { resizeImage } from "../utils/image";
import { getDexieItemId } from "../db/idMapping";
import { enqueuePhotoUpload, drainPhotoQueue, retryFailedUploads } from "../services/photoUploadQueue";
import { usePhotoUploadStatus } from "../hooks/usePhotoUploadStatus";
import { usePhotoUrl } from "../hooks/usePhotoUrl";

interface PhotoCaptureProps {
  itemId: string;
  sessionId: string;
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
  // Look up storage thumbnail path from photoUploadQueue for signed URL fallback
  const queueEntry = useLiveQuery(
    () => photo.id ? db.photoUploadQueue.where('dexiePhotoId').equals(photo.id).first() : undefined,
    [photo.id],
    undefined,
  );
  const url = usePhotoUrl(photo.thumbnail ?? photo.blob, queueEntry?.thumbnailPath);
  const uploadStatus = usePhotoUploadStatus(photo.id);

  return (
    <button
      type="button"
      onClick={() => uploadStatus === "failed" ? retryFailedUploads() : onTap(index)}
      className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 focus:border-accent"
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
      {/* Sync status overlay */}
      {(uploadStatus === "pending" || uploadStatus === "uploading") && (
        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-white/80 flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {uploadStatus === "uploaded" && (
        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}
      {uploadStatus === "failed" && (
        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </div>
      )}
    </button>
  );
}

export function PhotoCapture({ itemId, sessionId, onOpenLightbox }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ID mapping for migrated items
  const [dexieItemId, setDexieItemId] = useState<number | string | null>(null);
  useEffect(() => {
    getDexieItemId(itemId).then(id => setDexieItemId(id ?? itemId));
  }, [itemId]);

  const photos = useLiveQuery(
    () => {
      const lookupId = dexieItemId ?? itemId;
      return db.photos.where("itemId").equals(lookupId).sortBy("sortOrder");
    },
    [dexieItemId, itemId],
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

      // Use Supabase UUID directly for new items (post-migration)
      const storeId = dexieItemId ?? itemId;
      const photoId = await db.photos.add({
        itemId: storeId as number, // Dexie accepts both number and string
        itemType: "house",
        blob: fullBlob,
        thumbnail: thumbBlob,
        sortOrder: photos.length,
        createdAt: new Date(),
      });

      // Fire-and-forget upload (non-blocking)
      enqueuePhotoUpload({
        dexiePhotoId: photoId as number,
        itemId: itemId, // Always use Supabase UUID, not dexieItemId
        sessionId: sessionId,
        sortOrder: photos.length,
      }).then(() => drainPhotoQueue()).catch(() => {});
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
