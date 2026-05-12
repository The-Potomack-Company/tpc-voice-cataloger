// src/ui/tokens/index.ts — Phase 22 barrel re-export.
//
// This is the stable public API for src/ui consumers, including the
// future dashboard repo per Phase 22 CONTEXT spec (specifics §"future
// dashboard repo will consume src/ui/ primitives").

export {
  tpcUnifiedLight,
  tpcUnifiedDark,
  fonts,
  radii,
  fontSizes,
  space,
  paletteFor,
} from "./tokens";
export type { TpcUnifiedPalette } from "./tokens";

export { initTheme } from "./initTheme";
export type { InitThemeOpts, ThemeOverride } from "./initTheme";

// Re-export the LIB primitives so consumers can `import { Button, Card } from "@/ui/tokens"`.
// The primitives themselves live in src/ui/ and are also exported via
// src/ui/index.ts for clarity (Phase 24).
