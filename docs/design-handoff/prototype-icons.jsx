// tpc-icons.jsx
// App icons for the three TPC products + expanded UI icon library.
//
// Design language for app icons:
//  - Rounded square tile (iOS/macOS-style, 22% corner radius)
//  - Shared monogram "P" italic serif baseline in every tile (small mark, corner)
//  - Dominant glyph = product-specific mark, drawn in hairline strokes
//  - Paper tone tile surface, single accent in the glyph
//  - Palette: near-white tile, deep-ink glyph, teal-blue accent = consistency across all three

// ─────────────────────────────────────────────────────────────────────
// APP ICONS
// ─────────────────────────────────────────────────────────────────────

const AppIconTile = ({ size = 96, variant = 'paper', children, corner = 'TPC' }) => {
  const radius = size * 0.22;
  const bg = variant === 'paper' ? 'var(--bg)'
    : variant === 'ink' ? 'var(--ink)'
    : variant === 'accent' ? 'var(--accent)'
    : 'var(--bg-2)';
  const stroke = variant === 'paper' ? 'var(--rule-2)'
    : variant === 'ink' ? 'var(--ink)'
    : 'transparent';
  const cornerColor = variant === 'paper' ? 'var(--ink-3)'
    : variant === 'ink' ? 'var(--ink-3)'
    : 'rgba(255,255,255,0.55)';
  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      borderRadius: radius,
      background: bg,
      border: `1px solid ${stroke}`,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: variant === 'paper'
        ? '0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 24px -10px rgba(20,24,40,0.18), 0 2px 4px -1px rgba(20,24,40,0.06)'
        : '0 8px 24px -10px rgba(20,24,40,0.28), 0 2px 4px -1px rgba(20,24,40,0.1)',
    }}>
      {children}
      {corner && (
        <span style={{
          position: 'absolute',
          top: size * 0.08,
          right: size * 0.09,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: size * 0.14,
          lineHeight: 1,
          color: cornerColor,
          letterSpacing: '0',
        }}>{corner}</span>
      )}
    </div>
  );
};

// Voice — microphone with listening waves radiating UP from the top of the mic
const VoiceAppIcon = ({ size = 96, variant = 'paper' }) => {
  const stroke = variant === 'ink' ? 'var(--bg)' : variant === 'accent' ? 'var(--bg)' : 'var(--ink)';
  const accent = variant === 'paper' ? 'var(--accent)' : variant === 'ink' ? 'var(--accent)' : 'var(--bg)';
  const s = size;
  return (
    <AppIconTile size={size} variant={variant}>
      <svg width={s * 0.58} height={s * 0.58} viewBox="0 0 48 48" fill="none">
        {/* listening waves — radiating UP from above the mic */}
        <path d="M10 17a14 14 0 0 1 28 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round" opacity="0.4"/>
        <path d="M14 17a10 10 0 0 1 20 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
        <path d="M18 17a6 6 0 0 1 12 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round"/>
        {/* mic capsule */}
        <rect x="19" y="21" width="10" height="14" rx="5" stroke={stroke} strokeWidth="1.8"/>
        {/* mic body / stem */}
        <path d="M15 31a9 9 0 0 0 18 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M24 40v4M20 44h8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </AppIconTile>
  );
};

// Extension — puzzle-slot tucked into a browser chrome frame
const ExtensionAppIcon = ({ size = 96, variant = 'paper' }) => {
  const stroke = variant === 'ink' ? 'var(--bg)' : variant === 'accent' ? 'var(--bg)' : 'var(--ink)';
  const accent = variant === 'paper' ? 'var(--accent)' : variant === 'ink' ? 'var(--accent)' : 'var(--bg)';
  const s = size;
  return (
    <AppIconTile size={size} variant={variant}>
      <svg width={s * 0.58} height={s * 0.58} viewBox="0 0 48 48" fill="none">
        {/* browser chrome */}
        <rect x="6" y="9" width="36" height="30" rx="3" stroke={stroke} strokeWidth="1.8"/>
        <path d="M6 17h36" stroke={stroke} strokeWidth="1.4"/>
        <circle cx="10" cy="13" r="0.9" fill={stroke}/>
        <circle cx="13.5" cy="13" r="0.9" fill={stroke}/>
        <circle cx="17" cy="13" r="0.9" fill={stroke}/>
        {/* puzzle piece injected */}
        <path d="M26 22h6v4a2 2 0 0 0 2 2h2v5a1 1 0 0 1-1 1h-9v-5a2 2 0 0 0-2-2h-2v-4a1 1 0 0 1 1-1z"
              fill={accent} stroke={accent} strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    </AppIconTile>
  );
};

// Dashboard — an analog dial/gauge (live ops) with a single indicator
const DashboardAppIcon = ({ size = 96, variant = 'paper' }) => {
  const stroke = variant === 'ink' ? 'var(--bg)' : variant === 'accent' ? 'var(--bg)' : 'var(--ink)';
  const accent = variant === 'paper' ? 'var(--accent)' : variant === 'ink' ? 'var(--accent)' : 'var(--bg)';
  const s = size;
  return (
    <AppIconTile size={size} variant={variant}>
      <svg width={s * 0.58} height={s * 0.58} viewBox="0 0 48 48" fill="none">
        {/* dial arc */}
        <path d="M8 32a16 16 0 0 1 32 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
        {/* ticks */}
        <path d="M10 26l2 1M14 20l1.8 1.5M24 16v2M34 20l-1.8 1.5M38 26l-2 1"
              stroke={stroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.6"/>
        {/* indicator needle */}
        <path d="M24 32L31 19" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="24" cy="32" r="2.2" fill={accent}/>
      </svg>
    </AppIconTile>
  );
};

// ─────────────────────────────────────────────────────────────────────
// EXTENDED UI ICON LIBRARY
// Standardized 24×24 viewBox, 1.6 stroke, round caps/joins, currentColor.
// Merged with existing Icon set via Object.assign at the bottom.
// ─────────────────────────────────────────────────────────────────────

const svg = (children, { w = 14, h = 14 } = {}) => (p = {}) => (
  <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

const IconExt = {
  // Status
  warn:      svg(<><path d="M12 3 2 20h20z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/></>),
  info:      svg(<><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none"/></>),
  err:       svg(<><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/></>),
  success:   svg(<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>),
  pending:   svg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),

  // Actions
  edit:      svg(<><path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/></>),
  trash:     svg(<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></>),
  copy:      svg(<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>),
  link:      svg(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11 7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L13 17"/></>),
  share:     svg(<><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></>),
  refresh:   svg(<><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M20 3v5h-5M4 21v-5h5"/></>),
  sync:      svg(<><path d="M21 13a9 9 0 0 1-15 5.7L3 16"/><path d="M3 11a9 9 0 0 1 15-5.7L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/></>),
  export:    svg(<><path d="M12 3v12M8 7l4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>),
  import:    svg(<><path d="M12 15V3M8 11l4 4 4-4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>),
  send:      svg(<><path d="M4 20 20 12 4 4l3 8-3 8z"/><path d="M7 12h13"/></>),

  // Objects
  tag:       svg(<><path d="M4 12V4h8l9 9-8 8z"/><circle cx="8" cy="8" r="1.2"/></>),
  receipt:   svg(<><path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-1z"/><path d="M8 8h8M8 12h8M8 16h5"/></>),
  image:     svg(<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 19 5-5 4 4 3-3 4 4"/></>),
  hammer:    svg(<><path d="M14 4l6 6-4 4-6-6zM10 10 3 17a2 2 0 0 0 3 3l7-7"/><path d="M4 22h16"/></>),
  eye:       svg(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
  eyeOff:    svg(<><path d="M3 3l18 18"/><path d="M10 10a3 3 0 0 0 4 4"/><path d="M22 12s-3 7-10 7c-2 0-3.7-.5-5.2-1.4M2 12s3-7 10-7c2 0 3.7.5 5.2 1.4"/></>),
  clock:     svg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  bell:      svg(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></>),
  lock:      svg(<><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>),
  key:       svg(<><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/></>),
  user:      svg(<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>),
  building:  svg(<><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>),
  phone:     svg(<><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 19h4"/></>),
  globe:     svg(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>),

  // Layout / nav
  grid:      svg(<><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>),
  list:      svg(<><path d="M8 6h13M8 12h13M8 18h13M4 6h0M4 12h0M4 18h0"/><circle cx="4" cy="6" r="0.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="0.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="0.5" fill="currentColor" stroke="none"/></>),
  columns:   svg(<><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16M15 4v16"/></>),
  menu:      svg(<><path d="M4 7h16M4 12h16M4 17h16"/></>),
  chevDown:  svg(<><path d="m6 9 6 6 6-6"/></>),
  chevUp:    svg(<><path d="m6 15 6-6 6 6"/></>),
  arrowUp:   svg(<><path d="M12 20V4M6 10l6-6 6 6"/></>),
  arrowDown: svg(<><path d="M12 4v16M6 14l6 6 6-6"/></>),
  arrowRight:svg(<><path d="M4 12h16M14 6l6 6-6 6"/></>),
  external: svg(<><path d="M14 4h6v6M10 14 20 4"/><path d="M20 14v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/></>),

  // Data / charts
  chart:     svg(<><path d="M4 20V4M4 20h16"/><path d="M8 15v-5M12 15v-8M16 15v-3"/></>),
  pulse:     svg(<><path d="M3 12h4l3-7 4 14 3-7h4"/></>),
  wave:      svg(<><path d="M2 12h2v6h0M6 12h2v2M10 12h2v8M14 12h2v3M18 12h2v6M22 12h0"/></>),

  // Editor / docs
  mic2:      svg(<><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>),
  waveform:  svg(<><path d="M3 12h1M7 8v8M11 5v14M15 9v6M19 11v2"/></>),
  doc:       svg(<><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M15 2v5h5M8 13h8M8 17h5"/></>),
  attach:    svg(<><path d="M21 12 12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></>),

  // AI / magic
  ai:        svg(<><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></>),
  spark:     svg(<><path d="M12 3v5M12 16v5M3 12h5M16 12h5M7 7l3 3M14 14l3 3M7 17l3-3M14 10l3-3"/></>),
};

Object.assign(window, {
  AppIconTile, VoiceAppIcon, ExtensionAppIcon, DashboardAppIcon,
  IconExt,
});

// Inline variants — small tile app icons WITHOUT the TPC corner mark, for use
// inside app headers where the product identity is the whole point of the mark.
const VoiceAppMark = ({ size = 22 }) => (
  <AppIconTile size={size} variant="paper" corner={null}><VoiceAppIconGlyph size={size} /></AppIconTile>
);
const ExtensionAppMark = ({ size = 22 }) => (
  <AppIconTile size={size} variant="paper" corner={null}><ExtensionAppIconGlyph size={size} /></AppIconTile>
);
const DashboardAppMark = ({ size = 22 }) => (
  <AppIconTile size={size} variant="paper" corner={null}><DashboardAppIconGlyph size={size} /></AppIconTile>
);

const VoiceAppIconGlyph = ({ size }) => {
  const s = size;
  return (
    <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 48 48" fill="none">
      <path d="M10 17a14 14 0 0 1 28 0" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.4"/>
      <path d="M14 17a10 10 0 0 1 20 0" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/>
      <path d="M18 17a6 6 0 0 1 12 0" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="19" y="21" width="10" height="14" rx="5" stroke="var(--ink)" strokeWidth="2"/>
      <path d="M15 31a9 9 0 0 0 18 0" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M24 40v4M20 44h8" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
};
const ExtensionAppIconGlyph = ({ size }) => {
  const s = size;
  return (
    <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 48 48" fill="none">
      <rect x="6" y="9" width="36" height="30" rx="3" stroke="var(--ink)" strokeWidth="2"/>
      <path d="M6 17h36" stroke="var(--ink)" strokeWidth="1.4"/>
      <circle cx="10" cy="13" r="0.9" fill="var(--ink)"/>
      <circle cx="13.5" cy="13" r="0.9" fill="var(--ink)"/>
      <circle cx="17" cy="13" r="0.9" fill="var(--ink)"/>
      <path d="M26 22h6v4a2 2 0 0 0 2 2h2v5a1 1 0 0 1-1 1h-9v-5a2 2 0 0 0-2-2h-2v-4a1 1 0 0 1 1-1z"
            fill="var(--accent)" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
};
const DashboardAppIconGlyph = ({ size }) => {
  const s = size;
  return (
    <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 48 48" fill="none">
      <path d="M8 32a16 16 0 0 1 32 0" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10 26l2 1M14 20l1.8 1.5M24 16v2M34 20l-1.8 1.5M38 26l-2 1"
            stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"/>
      <path d="M24 32L31 19" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="24" cy="32" r="2.2" fill="var(--accent)"/>
    </svg>
  );
};

Object.assign(window, { VoiceAppMark, ExtensionAppMark, DashboardAppMark });

// Merge IconExt into the existing Icon object so downstream code can use one namespace.
if (window.Icon) {
  Object.assign(window.Icon, IconExt);
}
