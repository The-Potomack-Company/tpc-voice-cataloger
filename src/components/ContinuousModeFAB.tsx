import { Button } from "../ui/Button";
import { Icon } from "../ui/icons";

interface ContinuousModeFABProps {
  onStart: () => void;
  disabled?: boolean;
}

export function ContinuousModeFAB({ onStart, disabled }: ContinuousModeFABProps) {
  return (
    <div className="fixed bottom-24 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom)] landscape:max-w-3xl landscape:mx-auto z-40">
      <Button
        variant="secondary"
        fullWidth
        onClick={onStart}
        disabled={disabled}
        icon={<Icon name="sync" size={14} aria-hidden />}
        style={{
          minHeight: 44,
          boxShadow: "0 8px 24px var(--accent-wash)",
        }}
      >
        Continuous Mode
      </Button>
    </div>
  );
}
