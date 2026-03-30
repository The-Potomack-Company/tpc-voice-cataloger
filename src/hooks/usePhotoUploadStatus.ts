import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

type UploadStatus = "pending" | "uploading" | "uploaded" | "failed" | "none";

/**
 * Returns the upload status for a specific Dexie photo ID.
 * Uses Dexie live query for reactive updates as queue entries change status.
 */
export function usePhotoUploadStatus(
  dexiePhotoId: number | undefined,
): UploadStatus {
  const entry = useLiveQuery(
    () => {
      if (dexiePhotoId === undefined) return undefined;
      return db.photoUploadQueue
        .where("dexiePhotoId")
        .equals(dexiePhotoId)
        .first();
    },
    [dexiePhotoId],
    undefined,
  );

  if (!entry) return "none";
  return entry.status;
}
