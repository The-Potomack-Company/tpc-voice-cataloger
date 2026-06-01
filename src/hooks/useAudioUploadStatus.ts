import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

type UploadStatus = "pending" | "uploading" | "uploaded" | "failed" | "none";

/**
 * Returns the upload status for a specific Dexie audio ID, reactively.
 * Mirrors usePhotoUploadStatus: the query MUST run inside the useLiveQuery
 * callback so Dexie tracks the read and re-emits on every status transition.
 */
export function useAudioUploadStatus(
  dexieAudioId: number | undefined,
): UploadStatus {
  const entry = useLiveQuery(
    () => {
      if (dexieAudioId === undefined) return undefined;
      return db.audioUploadQueue
        .where("dexieAudioId")
        .equals(dexieAudioId)
        .first();
    },
    [dexieAudioId],
    undefined,
  );

  if (!entry) return "none";
  return (entry as { status: UploadStatus }).status;
}
