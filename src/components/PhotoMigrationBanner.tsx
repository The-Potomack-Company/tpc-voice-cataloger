import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function PhotoMigrationBanner() {
  const pending = useLiveQuery(
    () =>
      db.photoUploadQueue
        .where("status")
        .anyOf(["pending", "uploading"])
        .count(),
    [],
    0,
  );
  const failed = useLiveQuery(
    () => db.photoUploadQueue.where("status").equals("failed").count(),
    [],
    0,
  );

  if (pending === 0 && failed === 0) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/20 px-4 py-2 text-sm text-center">
      {pending > 0 && (
        <span className="text-accent">
          Uploading {pending} photo{pending !== 1 ? "s" : ""}...
        </span>
      )}
      {pending === 0 && failed > 0 && (
        <span className="text-red-600 dark:text-red-400">
          {failed} photo upload{failed !== 1 ? "s" : ""} failed. Tap thumbnails
          to retry.
        </span>
      )}
    </div>
  );
}
