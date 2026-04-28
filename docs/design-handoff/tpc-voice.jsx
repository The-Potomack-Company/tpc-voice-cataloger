// Voice Cataloging App — mobile screens

const PhoneShell = ({ dark, children }) => (
  <IOSDevice dark={dark} width={402} height={874}>
    <div className={"tpc" + (dark ? " tpc-dark" : "")} style={{ width: '100%', height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', paddingTop: 54 }}>
      {children}
    </div>
  </IOSDevice>
);

const TabBar = ({ active = 'sessions' }) => (
  <div style={{ borderTop: '1px solid var(--rule)', background: 'var(--bg)', padding: '8px 0 24px', display: 'flex', justifyContent: 'space-around' }}>
    {[
      ['sessions', 'Sessions', <Icon.folder />],
      ['now', 'Record', <Icon.mic />],
      ['settings', 'Settings', <Icon.settings />],
    ].map(([k, label, ic]) => (
      <button key={k} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        color: active === k ? 'var(--accent)' : 'var(--ink-3)',
        fontSize: 10, fontWeight: 500,
      }}>
        <span style={{ transform: 'scale(1.2)' }}>{ic}</span>
        {label}
      </button>
    ))}
  </div>
);

// Session list
const VoiceSessions = ({ dark }) => (
  <PhoneShell dark={dark}>
    <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>The Potomack Co.</div>
        <div className="tpc-display" style={{ fontSize: 26, color: 'var(--ink)', marginTop: 2 }}>Sessions</div>
      </div>
      <TPCBtn variant="secondary" size="sm" icon={<Icon.plus />}>New</TPCBtn>
    </div>

    <div style={{ padding: '6px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--rule)' }}>
        <Icon.search style={{ color: 'var(--ink-3)' }} />
        <span style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>Search sessions…</span>
        <Icon.filter style={{ color: 'var(--ink-3)' }} />
      </div>
    </div>

    <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
      {[
        { date: 'Today · Mar 28', items: [
          { id: 'TPC23', title: 'Modern & Contemporary', count: 42, tone: 'Sale', status: 'active', mins: 38 },
          { id: 'HSE-04', title: 'Georgetown estate walk', count: 18, tone: 'House', status: 'synced', mins: 22 },
        ]},
        { date: 'This week', items: [
          { id: 'TPC22', title: 'Fine Jewelry & Couture', count: 140, tone: 'Sale', status: 'synced', mins: 102 },
          { id: 'HSE-03', title: 'Chevy Chase appraisal', count: 9, tone: 'House', status: 'draft', mins: 14 },
          { id: 'TPC21', title: 'Silver & Decorative Arts', count: 88, tone: 'Sale', status: 'synced', mins: 64 },
        ]},
      ].map(section => (
        <div key={section.date} style={{ marginBottom: 16 }}>
          <Eyebrow style={{ padding: '4px 2px 8px' }}>{section.date}</Eyebrow>
          <div className="tpc-card" style={{ padding: 0, overflow: 'hidden' }}>
            {section.items.map((s, i) => (
              <div key={s.id} style={{
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: i < section.items.length - 1 ? '1px solid var(--rule)' : 'none',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: s.tone === 'Sale' ? 'var(--accent-wash)' : 'var(--sand-wash)', color: s.tone === 'Sale' ? 'var(--accent)' : 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 14 }}>
                  {s.tone === 'Sale' ? 'S' : 'H'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{s.id}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.tone}</span>
                    {s.status === 'active' && <TPCBadge tone="info" dot>Recording</TPCBadge>}
                    {s.status === 'draft' && <TPCBadge tone="warn">Draft</TPCBadge>}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{s.count} items · {s.mins} min</div>
                </div>
                <Icon.chev style={{ color: 'var(--ink-4)' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    <TabBar active="sessions" />
  </PhoneShell>
);

// Now Recording screen — mic in action, with live transcription
const VoiceRecording = ({ dark }) => {
  return (
    <PhoneShell dark={dark}>
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="tpc-btn tpc-btn-ghost" style={{ padding: 4 }}><Icon.back /></button>
        <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.1 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Sale · TPC23</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginTop: 2 }}>Modern & Contemporary</div>
        </div>
        <button className="tpc-btn tpc-btn-ghost" style={{ padding: 4 }}><Icon.dots /></button>
      </div>

      {/* Current item card */}
      <div style={{ padding: '4px 14px 10px' }}>
        <div className="tpc-card" style={{ padding: 16, background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>ITEM 043</div>
            <TPCBadge tone="info" dot>Recording</TPCBadge>
          </div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>
            Pair of Mid-Century walnut side chairs<span style={{ color: 'var(--accent)' }}>|</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            attributed to Paul McCobb, circa 1955, sculpted backs, original upholstery showing…
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 80, justifyContent: 'center' }}>
          {Array.from({ length: 48 }).map((_, i) => {
            const baseHeight = Math.abs(Math.sin(i * 0.5) * 30) + Math.abs(Math.cos(i * 0.9) * 20) + 6;
            const recent = i > 38;
            return (
              <div key={i} style={{
                width: 3, height: baseHeight,
                background: recent ? 'var(--accent)' : 'var(--ink-4)',
                borderRadius: 2, opacity: recent ? 1 : 0.5,
              }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <div className="tnum" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>
            00:42
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          Item 43 · session 00:38:14
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        <button style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid var(--rule-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
          <Icon.back />
        </button>
        <button style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--err)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 0 0 6px color-mix(in oklch, var(--err) 15%, transparent)' }}>
          <Icon.stop style={{ width: 22, height: 22 }} />
        </button>
        <button style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-wash)', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <Icon.plus />
        </button>
      </div>
    </PhoneShell>
  );
};

// Review screen — after a session, scroll of items
const VoiceReview = ({ dark }) => (
  <PhoneShell dark={dark}>
    <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--rule)' }}>
      <button className="tpc-btn tpc-btn-ghost" style={{ padding: 4 }}><Icon.back /></button>
      <div style={{ flex: 1, lineHeight: 1.1 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Review · TPC23</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginTop: 2 }}>42 items · 38 min</div>
      </div>
      <TPCBtn variant="primary" size="sm" icon={<Icon.upload />}>Sync</TPCBtn>
    </div>

    {/* Progress meta */}
    <div style={{ padding: '12px 18px', display: 'flex', gap: 14, borderBottom: '1px solid var(--rule)' }}>
      {[
        ['Transcribed', 42, 42],
        ['AI cataloged', 38, 42],
        ['Needs review', 4, 42],
      ].map(([label, val, total], i) => (
        <div key={label} style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</div>
          <div className="tnum" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', marginTop: 2 }}>
            {val}<span style={{ color: 'var(--ink-4)', fontSize: 13 }}>/{total}</span>
          </div>
          <div className="bar-track" style={{ marginTop: 4 }}><div className="bar-fill" style={{ width: `${(val / total) * 100}%`, background: i === 2 ? 'var(--warn)' : 'var(--accent)' }} /></div>
        </div>
      ))}
    </div>

    <div style={{ flex: 1, overflow: 'auto' }}>
      {[
        { n: 43, title: 'Pair of McCobb walnut side chairs', excerpt: 'attributed to Paul McCobb, circa 1955, sculpted backs…', status: 'ok', dur: '1:28' },
        { n: 42, title: 'Noguchi-style coffee table', excerpt: 'biomorphic glass top, walnut base, minor surface wear to…', status: 'ok', dur: '0:54' },
        { n: 41, title: 'Ed Ruscha lithograph, 1975', excerpt: 'signed lower right, edition 14/50, framed and glazed, some…', status: 'warn', dur: '1:12' },
        { n: 40, title: 'Georg Jensen sterling coffee set', excerpt: 'pattern number 80, designed Johan Rohde, four pieces…', status: 'ok', dur: '2:04' },
        { n: 39, title: '— needs title —', excerpt: 'low audio, background noise — tap to re-transcribe or enter man…', status: 'err', dur: '0:38' },
      ].map(item => (
        <div key={item.n} style={{
          padding: '14px 18px', borderBottom: '1px solid var(--rule)',
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
            <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{String(item.n).padStart(3, '0')}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--${item.status})` }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: item.status === 'err' ? 'var(--err)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.excerpt}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{item.dur}</span>
              {item.status === 'warn' && <TPCBadge tone="warn">Review</TPCBadge>}
              {item.status === 'err' && <TPCBadge tone="err">Retry</TPCBadge>}
            </div>
          </div>
          <button className="tpc-btn tpc-btn-ghost" style={{ padding: 4 }}><Icon.play /></button>
        </div>
      ))}
    </div>

    <TabBar active="sessions" />
  </PhoneShell>
);

Object.assign(window, { VoiceSessions, VoiceRecording, VoiceReview });
