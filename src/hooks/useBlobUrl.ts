import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Creates an object URL from a Blob and revokes it on cleanup.
 * Prevents memory leaks when rendering many photo thumbnails.
 *
 * Uses useRef + useSyncExternalStore to avoid synchronous setState in effects
 * (react-hooks/set-state-in-effect).
 */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const urlRef = useRef<string | undefined>(undefined);
  const subscribersRef = useRef(new Set<() => void>());

  // Clean up previous URL and create new one when blob changes
  useEffect(() => {
    // Revoke previous URL
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = undefined;
    }

    if (blob) {
      urlRef.current = URL.createObjectURL(blob);
    }

    // Notify subscribers of change
    subscribersRef.current.forEach((cb) => cb());

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = undefined;
      }
    };
  }, [blob]);

  return useSyncExternalStore(
    (cb) => {
      subscribersRef.current.add(cb);
      return () => subscribersRef.current.delete(cb);
    },
    () => urlRef.current,
  );
}
