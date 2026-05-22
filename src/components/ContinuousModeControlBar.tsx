import { Button } from "../ui/Button";
import { Icon } from "../ui/icons";

interface ContinuousModeControlBarProps {
  paused: boolean;
  finalizing: boolean;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onNewItem: () => void;
}

export function ContinuousModeControlBar({
  paused,
  finalizing,
  onStop,
  onPause,
  onResume,
  onNewItem,
}: ContinuousModeControlBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-rule bg-bg px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-lg">
      <div className="landscape:max-w-3xl landscape:mx-auto flex items-center gap-2">
        <Button
          variant="danger"
          onClick={onStop}
          disabled={finalizing}
          icon={<Icon name="stop" size={14} aria-hidden />}
          className="flex-[1.2]"
        >
          {finalizing ? "Finalizing..." : "Stop"}
        </Button>
        <Button
          variant="primary"
          onClick={onNewItem}
          disabled={finalizing}
          iconRight={<Icon name="arrowRight" size={14} aria-hidden />}
          className="flex-1"
        >
          New Item
        </Button>
        <Button
          variant="ghost"
          onClick={paused ? onResume : onPause}
          disabled={finalizing}
          icon={<Icon name={paused ? "play" : "pause"} size={14} aria-hidden />}
          aria-label={paused ? "Resume continuous recording" : "Pause continuous recording"}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
    </div>
  );
}
