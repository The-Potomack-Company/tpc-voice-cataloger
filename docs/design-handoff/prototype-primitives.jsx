// Shared primitives

const TPCBtn = ({ variant = 'primary', children, icon, iconRight, onClick, style, className = '', fullWidth, size = 'md' }) => {
  const cls = `tpc-btn tpc-btn-${variant} ${className}`;
  const pad = size === 'sm' ? '4px 9px' : size === 'lg' ? '9px 16px' : undefined;
  return (
    <button className={cls} onClick={onClick} style={{ width: fullWidth ? '100%' : undefined, padding: pad, fontSize: size === 'sm' ? 11.5 : undefined, ...style }}>
      {icon}<span>{children}</span>{iconRight}
    </button>
  );
};

const TPCBadge = ({ tone = 'neutral', children, dot }) => (
  <span className={tone === 'neutral' ? 'tpc-badge' : `tpc-badge tpc-badge-${tone}`}>
    {dot && <span className="tpc-dot" />}{children}
  </span>
);

const Eyebrow = ({ children, style }) => <div className="tpc-eyebrow" style={style}>{children}</div>;

// Hero wordmark — the ONLY place italic display font is used.
// Small headings/numbers now use Geist (500) for a cleaner, more restrained feel.
const Wordmark = ({ size = 16, color = 'var(--ink)', mono = true }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color }}>
    <TPCMonogram size={size + 6} />
    {!mono && (
      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: size, letterSpacing: '0.005em', lineHeight: 1 }}>
        The Potomack Co.
      </span>
    )}
  </span>
);

// Monogram — italic serif "P" inside a hairline square (italic used here because it IS the hero mark)
const TPCMonogram = ({ size = 28, color = 'var(--ink)', bg }) => (
  <span style={{
    width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${color}`, borderRadius: Math.round(size * 0.18), color,
    background: bg || 'transparent',
    fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: size * 0.72, lineHeight: 1,
    letterSpacing: '-0.02em', paddingBottom: size * 0.02,
  }}>
    P
  </span>
);

// App-name hero — used in sidebars / headers for the app name ONLY. Italic.
const AppHero = ({ kicker, name, size = 22 }) => (
  <div style={{ lineHeight: 1.1 }}>
    {kicker && <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{kicker}</div>}
    <div style={{ fontFamily: 'var(--font-display)', fontSize: size, marginTop: 2, color: 'var(--ink)', letterSpacing: '-0.005em' }}>{name}</div>
  </div>
);

// Product marks — each app gets a tiny companion glyph paired with the monogram
const ProductMark = ({ product = 'voice', size = 14, color = 'currentColor' }) => {
  if (product === 'voice') return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4">
      <rect x="6" y="2" width="4" height="8" rx="2" /><path d="M4 8a4 4 0 0 0 8 0" /><path d="M8 12v2" />
    </svg>
  );
  if (product === 'extension') return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M2 6h12M6 2v4"/>
    </svg>
  );
  return ( /* dashboard */
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4">
      <path d="M2 13V8M6 13V4M10 13v-6M14 13V2"/>
    </svg>
  );
};

const AppHeader = ({ product, name, dark, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--rule)', background: 'var(--bg)' }}>
    <TPCMonogram size={22} color={dark ? 'var(--ink)' : 'var(--ink)'} />
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>The Potomack Co.</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginTop: 2, color: 'var(--ink)' }}>{name}</span>
    </div>
    <div style={{ flex: 1 }} />
    {right}
  </div>
);

const Icon = {
  mic: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>),
  search: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
  plus: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 5v14M5 12h14"/></svg>),
  chev: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="m9 6 6 6-6 6"/></svg>),
  back: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="m15 6-6 6 6 6"/></svg>),
  camera: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>),
  upload: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>),
  download: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></svg>),
  check: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="m5 12 5 5 9-10"/></svg>),
  x: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>),
  settings: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 13A7.5 7.5 0 0 0 19.5 12a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4Z"/></svg>),
  home: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="m3 11 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>),
  stop: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="6" y="6" width="12" height="12" rx="2"/></svg>),
  play: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7z"/></svg>),
  pause: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>),
  filter: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>),
  users: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M22 17c0-2.5-2-4-4.5-4"/></svg>),
  sparkle: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/></svg>),
  trending: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>),
  help: (p = {}) => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .7-1 1.4V14"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>),
  dot: (p = {}) => (<svg width="6" height="6" viewBox="0 0 6 6" {...p}><circle cx="3" cy="3" r="2.5" fill="currentColor"/></svg>),
  dots: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>),
  ext: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>),
  folder: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>),
  file: (p = {}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M15 2v5h5"/></svg>),
};

const Placeholder = ({ label, w, h, style }) => <div className="tpc-placeholder" style={{ width: w, height: h, ...style }}>{label}</div>;

// Sparkline
const Sparkline = ({ data, color = 'var(--accent)', w = 80, h = 24, fill = true, strokeWidth = 1.4 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {fill && <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.12" stroke="none" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

Object.assign(window, { TPCBtn, TPCBadge, Eyebrow, Wordmark, TPCMonogram, ProductMark, AppHeader, Icon, Placeholder, Sparkline });
