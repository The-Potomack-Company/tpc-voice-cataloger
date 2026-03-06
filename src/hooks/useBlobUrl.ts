import { useEffect, useState } from "react";

/**
 * Creates an object URL from a Blob and revokes it on cleanup.
 * Prevents memory leaks when rendering many photo thumbnails.
 */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}
