import { useCallback, useRef, useState, type ReactNode } from "react";

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  disabled?: boolean;
}

const SNAP_OPEN = -120;
const THRESHOLD = -80;

export function SwipeableRow({
  children,
  onDelete,
  deleteLabel = "Delete",
  disabled,
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

      // Capture pointer for reliable tracking (skip when open so taps reach delete button)
      if (!isOpen) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
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

  if (disabled) {
    return (
      <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
        <div className="relative z-20 bg-bg">
          {children}
        </div>
      </div>
    );
  }

  const showDelete = translateX !== 0 || isSwiping;

  return (
    <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      {/* Delete button behind content — only mounted while swiping/open so
          there's no red bar leaking from under the rest position. */}
      {showDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="absolute inset-y-0 right-0 z-10 flex w-[120px] items-center justify-center bg-err text-white font-medium tracking-wide"
        >
          {deleteLabel}
        </button>
      )}

      {/* Sliding content — bg-bg-2 matches the inner tpc-card; border-radius
          inherit keeps the corners flush with the wrapper. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative z-20 bg-bg-2"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? "none" : "transform 0.2s ease-out",
          willChange: isSwiping ? "transform" : "auto",
          borderRadius: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );
}
