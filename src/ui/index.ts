/**
 * src/ui/index.ts
 *
 * Public LIB primitive exports (Phase 24).
 * Consumers import from "../ui" / "@/ui" depending on path setup.
 */

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Eyebrow } from "./Eyebrow";
export type { EyebrowProps } from "./Eyebrow";

export { Bar } from "./Bar";
export type { BarProps, BarTone } from "./Bar";

export { Placeholder } from "./Placeholder";
export type { PlaceholderProps } from "./Placeholder";

export { Icon, iconRegistry } from "./icons";
export type { IconName, IconProps } from "./icons";

export { Waveform } from "./Waveform";
export type { WaveformProps } from "./Waveform";

export { SuccessPing } from "./SuccessPing";
export type { SuccessPingProps } from "./SuccessPing";

export { ThemePicker } from "./ThemePicker";

// Re-export token utilities for convenience.
export { initTheme } from "./tokens/initTheme";
export type { InitThemeOpts, ThemeOverride } from "./tokens/initTheme";
