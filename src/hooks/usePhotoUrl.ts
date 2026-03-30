import { useEffect, useState } from "react";
import { useBlobUrl } from "./useBlobUrl";
import { supabase } from "../lib/supabase";

/**
 * Returns a display URL for a photo.
 * Prefers local Dexie blob (instant, works offline).
 * Falls back to Supabase Storage signed URL when no local blob (admin on different device).
 * Signed URL expires after 3600 seconds (1 hour).
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
    supabase.storage
      .from("photos")
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (!cancelled && data) {
          setSignedUrl(data.signedUrl);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; setSignedUrl(undefined); };
  }, [blob, storagePath]);

  return blobUrl ?? signedUrl;
}
