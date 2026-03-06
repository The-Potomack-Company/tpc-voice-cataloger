import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  ms?: number;
}

export function useLongPress({ onLongPress, ms = 500 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress();
      timerRef.current = null;
    }, ms);
  }, [onLongPress, ms]);

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  return { onPointerDown, onPointerUp, onPointerLeave };
}
