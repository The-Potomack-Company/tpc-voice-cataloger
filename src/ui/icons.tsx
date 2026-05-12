/* eslint-disable react-refresh/only-export-components --
 * The icon registry is conceptually static design-data co-located with
 * the Icon component that consumes it. Splitting them would require
 * every consumer to import from two files for what is functionally a
 * single primitive. HMR boundaries are still respected for component
 * edits because the registry never mutates at runtime. */
/**
 * src/ui/icons.tsx
 *
 * Phase 24 icon manifest (LIB-04 add-on).
 * Hand-drawn 24x24 inline SVGs from docs/design-handoff/prototype-icons.jsx.
 *
 * Conventions:
 *   - viewBox="0 0 24 24"
 *   - fill="none", stroke="currentColor"
 *   - strokeWidth 1.6 (standard) or higher for hero glyphs
 *   - round caps + joins
 *   - currentColor for theme adaptation
 */

import type { SVGProps, ReactNode } from "react";

interface IconDef {
  body: ReactNode;
  strokeWidth?: number;
  fill?: "none" | "currentColor";
}

const wrap = (body: ReactNode, opts: Omit<IconDef, "body"> = {}): IconDef => ({
  body,
  ...opts,
});

export const iconRegistry = {
  mic: wrap(
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </>,
  ),
  search: wrap(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
  ),
  plus: wrap(<path d="M12 5v14M5 12h14" />),
  chev: wrap(<path d="m9 6 6 6-6 6" />),
  back: wrap(<path d="m15 6-6 6 6 6" />),
  camera: wrap(
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>,
  ),
  upload: wrap(<path d="M12 16V4M7 9l5-5 5 5M4 20h16" />),
  download: wrap(<path d="M12 4v12M7 11l5 5 5-5M4 20h16" />),
  check: wrap(<path d="m5 12 5 5 9-10" />, { strokeWidth: 1.8 }),
  x: wrap(<path d="M6 6l12 12M18 6 6 18" />),
  settings: wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13A7.5 7.5 0 0 0 19.5 12a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4Z" />
    </>,
  ),
  home: wrap(<path d="m3 11 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />),
  stop: wrap(<rect x="6" y="6" width="12" height="12" rx="2" />, { fill: "currentColor" }),
  play: wrap(<path d="M8 5v14l11-7z" />, { fill: "currentColor" }),
  pause: wrap(
    <>
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </>,
    { fill: "currentColor" },
  ),
  filter: wrap(<path d="M3 5h18l-7 8v6l-4-2v-4z" />),
  users: wrap(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M22 17c0-2.5-2-4-4.5-4" />
    </>,
  ),
  sparkle: wrap(<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />),
  trending: wrap(
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>,
  ),
  help: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .7-1 1.4V14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </>,
  ),
  dot: wrap(<circle cx="12" cy="12" r="4" fill="currentColor" />, { fill: "currentColor" }),
  dots: wrap(
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>,
    { fill: "currentColor" },
  ),
  ext: wrap(
    <>
      <path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>,
  ),
  folder: wrap(
    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  ),
  file: wrap(
    <>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M15 2v5h5" />
    </>,
  ),
  // Status
  warn: wrap(
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>,
  ),
  info: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </>,
  ),
  err: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </>,
  ),
  success: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>,
  ),
  pending: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  // Actions
  edit: wrap(
    <>
      <path d="M4 20h4L20 8l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>,
  ),
  trash: wrap(
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>,
  ),
  copy: wrap(
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>,
  ),
  link: wrap(
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11 7" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L13 17" />
    </>,
  ),
  share: wrap(
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 11l8-4M8 13l8 4" />
    </>,
  ),
  refresh: wrap(
    <>
      <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
      <path d="M20 3v5h-5M4 21v-5h5" />
    </>,
  ),
  sync: wrap(
    <>
      <path d="M21 13a9 9 0 0 1-15 5.7L3 16" />
      <path d="M3 11a9 9 0 0 1 15-5.7L21 8" />
      <path d="M3 21v-5h5M21 3v5h-5" />
    </>,
  ),
  export: wrap(
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>,
  ),
  import: wrap(
    <>
      <path d="M12 15V3M8 11l4 4 4-4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>,
  ),
  send: wrap(
    <>
      <path d="M4 20 20 12 4 4l3 8-3 8z" />
      <path d="M7 12h13" />
    </>,
  ),
  // Objects
  tag: wrap(
    <>
      <path d="M4 12V4h8l9 9-8 8z" />
      <circle cx="8" cy="8" r="1.2" />
    </>,
  ),
  receipt: wrap(
    <>
      <path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-1z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>,
  ),
  image: wrap(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m4 19 5-5 4 4 3-3 4 4" />
    </>,
  ),
  hammer: wrap(
    <>
      <path d="M14 4l6 6-4 4-6-6zM10 10 3 17a2 2 0 0 0 3 3l7-7" />
      <path d="M4 22h16" />
    </>,
  ),
  eye: wrap(
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  eyeOff: wrap(
    <>
      <path d="M3 3l18 18" />
      <path d="M10 10a3 3 0 0 0 4 4" />
      <path d="M22 12s-3 7-10 7c-2 0-3.7-.5-5.2-1.4M2 12s3-7 10-7c2 0 3.7.5 5.2 1.4" />
    </>,
  ),
  clock: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  bell: wrap(
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>,
  ),
  lock: wrap(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  key: wrap(
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3" />
    </>,
  ),
  user: wrap(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  ),
  building: wrap(
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </>,
  ),
  phone: wrap(
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M10 19h4" />
    </>,
  ),
  globe: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>,
  ),
  // Layout / nav
  grid: wrap(
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>,
  ),
  list: wrap(
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="0.5" fill="currentColor" stroke="none" />
    </>,
  ),
  columns: wrap(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M9 4v16M15 4v16" />
    </>,
  ),
  menu: wrap(<path d="M4 7h16M4 12h16M4 17h16" />),
  chevDown: wrap(<path d="m6 9 6 6 6-6" />),
  chevUp: wrap(<path d="m6 15 6-6 6 6" />),
  arrowUp: wrap(<path d="M12 20V4M6 10l6-6 6 6" />),
  arrowDown: wrap(<path d="M12 4v16M6 14l6 6 6-6" />),
  arrowRight: wrap(<path d="M4 12h16M14 6l6 6-6 6" />),
  external: wrap(
    <>
      <path d="M14 4h6v6M10 14 20 4" />
      <path d="M20 14v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </>,
  ),
  // Data / charts
  chart: wrap(
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 15v-5M12 15v-8M16 15v-3" />
    </>,
  ),
  pulse: wrap(<path d="M3 12h4l3-7 4 14 3-7h4" />),
  wave: wrap(<path d="M2 12h2v6h0M6 12h2v2M10 12h2v8M14 12h2v3M18 12h2v6" />),
  // Editor / docs
  waveform: wrap(<path d="M3 12h1M7 8v8M11 5v14M15 9v6M19 11v2" />),
  doc: wrap(
    <>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M15 2v5h5M8 13h8M8 17h5" />
    </>,
  ),
  attach: wrap(
    <path d="M21 12 12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />,
  ),
  // AI / magic
  ai: wrap(<path d="M12 4v4M12 16v4M4 12h4M16 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />),
  spark: wrap(<path d="M12 3v5M12 16v5M3 12h5M16 12h5M7 7l3 3M14 14l3 3M7 17l3-3M14 10l3-3" />),
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof iconRegistry;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  "aria-label"?: string;
}

export function Icon({
  name,
  size = 14,
  className,
  "aria-label": ariaLabel,
  ...rest
}: IconProps) {
  const def = iconRegistry[name] as IconDef | undefined;
  if (!def) {
    // Soft fail in dev; render a question-mark glyph so the surface
    // doesn't crash on a typo.
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        aria-hidden={!ariaLabel}
        aria-label={ariaLabel}
        className={className}
        {...rest}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M10 9.5a2 2 0 1 1 3 1.7c-.6.4-1 .7-1 1.3v.5" />
        <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={def.fill ?? "none"}
      stroke="currentColor"
      strokeWidth={def.strokeWidth ?? 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      className={className}
      {...rest}
    >
      {def.body}
    </svg>
  );
}
