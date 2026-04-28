/**
 * TPC Unified — Design Tokens (TS)
 * v1.0
 *
 * Mirror of tpc-unified-tokens.css for JS consumers
 * (React Native, styled-components, anything that can't read CSS vars).
 * If you change a value here, change tpc-unified-tokens.css too.
 */

export const tpcUnifiedLight = {
  bg:    'oklch(0.985 0.003 240)',
  bg2:   'oklch(0.97 0.004 240)',
  bg3:   'oklch(0.945 0.005 240)',

  rule:  'oklch(0.90 0.006 240)',
  rule2: 'oklch(0.82 0.008 240)',

  ink:   'oklch(0.22 0.020 255)',
  ink2:  'oklch(0.40 0.015 255)',
  ink3:  'oklch(0.56 0.012 255)',
  ink4:  'oklch(0.70 0.010 255)',

  accent:       'oklch(0.58 0.13 225)',
  accentHover:  'oklch(0.52 0.13 225)',
  accentWash:   'oklch(0.95 0.03 225)',
  accentInk:    'oklch(0.98 0.008 225)',

  sand:      'oklch(0.72 0.09 75)',
  sandWash:  'oklch(0.95 0.03 75)',

  ok:       'oklch(0.55 0.10 155)',
  okWash:   'oklch(0.95 0.03 155)',
  warn:     'oklch(0.62 0.11 75)',
  warnWash: 'oklch(0.95 0.035 80)',
  err:      'oklch(0.55 0.13 28)',
  errWash:  'oklch(0.95 0.03 28)',
} as const;

export const tpcUnifiedDark: typeof tpcUnifiedLight = {
  bg:    'oklch(0.19 0.015 255)',
  bg2:   'oklch(0.22 0.016 255)',
  bg3:   'oklch(0.26 0.018 255)',

  rule:  'oklch(0.30 0.018 255)',
  rule2: 'oklch(0.38 0.020 255)',

  ink:   'oklch(0.97 0.008 240)',
  ink2:  'oklch(0.82 0.012 240)',
  ink3:  'oklch(0.65 0.014 240)',
  ink4:  'oklch(0.50 0.014 240)',

  accent:       'oklch(0.72 0.13 225)',
  accentHover:  'oklch(0.78 0.13 225)',
  accentWash:   'oklch(0.32 0.05 225)',
  accentInk:    'oklch(0.16 0.02 255)',

  sand:     'oklch(0.78 0.09 75)',
  sandWash: 'oklch(0.30 0.04 75)',

  ok:       'oklch(0.70 0.10 155)',
  okWash:   'oklch(0.30 0.04 155)',
  warn:     'oklch(0.74 0.11 75)',
  warnWash: 'oklch(0.30 0.04 80)',
  err:      'oklch(0.70 0.13 28)',
  errWash:  'oklch(0.30 0.05 28)',
};

export const fonts = {
  display: 'EB Garamond',     // 400 + 400 italic + 500 italic
  ui:      'Inter',           // 400 / 500 / 600
  mono:    'IBM Plex Mono',   // 400 / 500
} as const;

export const radii = {
  sm: 4,
  md: 6,
  lg: 10,
} as const;

export const fontSizes = {
  micro: 10,
  meta:  10.5,
  small: 11,
  body:  13,
  ui:    13,
  // Display (EB Garamond italic)
  d1: 18, d2: 22, d3: 26, d4: 32, d5: 40, d6: 56,
} as const;

/** Spacing scale used across the prototypes. */
export const space = {
  '0': 0, '1': 4, '2': 6, '3': 8, '4': 10, '5': 12, '6': 14,
  '7': 16, '8': 20, '9': 24, '10': 28, '11': 32, '12': 40,
} as const;

export type TpcUnifiedPalette = typeof tpcUnifiedLight;
export const paletteFor = (mode: 'light' | 'dark'): TpcUnifiedPalette =>
  mode === 'dark' ? tpcUnifiedDark : tpcUnifiedLight;
