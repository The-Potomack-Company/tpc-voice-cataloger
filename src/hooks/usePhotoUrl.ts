import { useEffect, useState } from "react";
import { useBlobUrl } from "./useBlobUrl";
import { supabase } from "../lib/supabase";
import { isFirebaseAuthBackend } from "../lib/authBackend";
import { getFirebaseStorageDownloadUrl } from "../lib/firebaseStorage";

/**
 * Returns a display URL for a photo.
 * Prefers local Dexie blob (instant, works offline).
 * Falls back to the active backend when no local blob (admin on different device).
 * Supabase mode uses a 1-hour signed URL. Firebase mode uses getDownloadURL; rules
 * authorize the lookup before returning Firebase's tokenized download URL.
 */
export function usePhotoUrl(
  blob: Blob | undefined,
  storagePath: string | undefined,
): string | undefined {
  const blobUrl = useBlobUrl(blob);
  const [signedUrl, setSignedUrl] = useState<string | undefined>();

  useEffect(() => {
    // Check blob (not blobUrl) to avoid race: useBlobUrl returns undefined
    // on first render before its effect creates the object URL.
    if (blob || !storagePath) return;

    let cancelled = false;
    const urlPromise = isFirebaseAuthBackend()
      ? getFirebaseStorageDownloadUrl(storagePath)
      : supabase.storage
        .from("photos")
        .createSignedUrl(storagePath, 3600)
        .then(({ data }) => data?.signedUrl);

    urlPromise
      .then((url) => {
        if (!cancelled && url) setSignedUrl(url);
      })
      .catch(() => {});

    return () => { cancelled = true; setSignedUrl(undefined); };
  }, [blob, storagePath]);

  return blobUrl ?? signedUrl;
}
