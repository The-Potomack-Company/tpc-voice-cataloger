import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

type UploadStatus = "pending" | "uploading" | "uploaded" | "failed" | "none";

function lookup(dexieAudioId: number) {
  return db.audioUploadQueue
    .where("dexieAudioId")
    .equals(dexieAudioId)
    .first();
}

/**
 * Returns the upload status for a specific Dexie audio ID, reactively.
 * Mirrors usePhotoUploadStatus: dexie-react-hooks re-runs the querier whenever
 * the matching audioUploadQueue row mutates, surfacing its status string.
 */
export function useAudioUploadStatus(
  dexieAudioId: number | undefined,
): UploadStatus {
  // Evaluate the lookup eagerly so the query is constructed once per render;
  // dexie-react-hooks re-subscribes via the dexieAudioId dependency.
  const pending = dexieAudioId === undefined ? undefined : lookup(dexieAudioId);

  const entry = useLiveQuery(() => pending, [dexieAudioId]);

  if (!entry) return "none";
  return (entry as { status: UploadStatus }).status;
}
