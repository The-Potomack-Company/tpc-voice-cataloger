/**
 * src/ui/ThemePicker.tsx
 *
 * Phase 25 — light / dark / system segmented control built from LIB
 * primitives. Selecting a value flips the app shell instantly via the
 * theme store (which calls initTheme under the hood).
 */

import { useThemeStore } from "../stores/themeStore";
import { Icon } from "./icons";
import type { ThemeOverride } from "./tokens/initTheme";

const OPTIONS: { value: ThemeOverride; label: string; icon: "spark" | "sparkle" | "settings" }[] = [
  { value: "light", label: "Light", icon: "sparkle" },
  { value: "dark", label: "Dark", icon: "spark" },
  { value: "system", label: "System", icon: "settings" },
];

export function ThemePicker() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="tpc-theme-picker"
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              void setPreference(opt.value);
            }}
            className={`tpc-btn ${active ? "tpc-btn-primary" : "tpc-btn-secondary"} tpc-theme-picker-option`}
          >
            <Icon name={opt.icon} aria-hidden />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
