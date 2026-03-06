import { useCallback, useRef, useState, type ReactNode } from "react";

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}

const SNAP_OPEN = -120;
const THRESHOLD = -80;

export function SwipeableRow({
  children,
  onDelete,
  deleteLabel = "Delete",
}: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null);
  const currentXRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      directionLockedRef.current = null;
      currentXRef.current = isOpen ? SNAP_OPEN : 0;
      setIsSwiping(true);

      // Capture pointer for reliable tracking
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isOpen],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSwiping) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      // Lock direction on first significant movement
      if (
        directionLockedRef.current === null &&
        (Math.abs(dx) > 10 || Math.abs(dy) > 10)
      ) {
        if (Math.abs(dx) > Math.abs(dy) * 1.5) {
          directionLockedRef.current = "horizontal";
        } else {
          directionLockedRef.current = "vertical";
          setIsSwiping(false);
          return;
        }
      }

      if (directionLockedRef.current !== "horizontal") return;

      const baseX = isOpen ? SNAP_OPEN : 0;
      const newX = Math.min(0, baseX + dx);
      currentXRef.current = newX;
      setTranslateX(newX);
    },
    [isSwiping, isOpen],
  );

  const handlePointerUp = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const finalX = currentXRef.current;

    if (finalX < THRESHOLD) {
      setTranslateX(SNAP_OPEN);
      setIsOpen(true);
    } else {
      setTranslateX(0);
      setIsOpen(false);
    }
  }, [isSwiping]);

  const handleDeleteClick = useCallback(() => {
    setTranslateX(0);
    setIsOpen(false);
    onDelete();
  }, [onDelete]);

  return (
    <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      {/* Delete button behind content */}
      <button
        type="button"
        onClick={handleDeleteClick}
        className="absolute inset-y-0 right-0 flex w-[120px] items-center justify-center bg-red-500 text-white font-medium"
      >
        {deleteLabel}
      </button>

      {/* Sliding content */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative bg-white dark:bg-gray-900"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? "none" : "transform 0.2s ease-out",
          willChange: isSwiping ? "transform" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
