// src/ui/tokens/index.ts — Phase 22 barrel re-export.
//
// This is the stable public API for src/ui consumers, including the
// future dashboard repo per Phase 22 CONTEXT spec (specifics §"future
// dashboard repo will consume src/ui/ primitives").
//
// initTheme is added by Plan 03 in this same phase; the import line is
// commented out here and uncommented when initTheme.ts lands.

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

// export { initTheme } from "./initTheme"; // Added by Plan 03.
