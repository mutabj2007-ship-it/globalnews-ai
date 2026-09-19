'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VII · MARKET — THE COMPACT READER SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * NOT THE DESKTOP SCREEN AT 390px, AND THE PROOF IS IN THE DOM.
 *
 * This route once rendered `MarketScreen` byte for byte — both served `data-mkt="screen"`,
 * 33 domain nodes, 19,106 identical characters — so every mobile row of every QA matrix
 * was measuring the desktop composition while reporting on the compact one. The guard that
 * caught it is kept and still asserts the two roots differ.
 *
 * ── THE ORDERING RULE THE ACTIVATION NAMES ────────────────────────────────
 *
 * PRIMARY OBSERVATIONS BEFORE SECONDARY METADATA. On a phone that is not a preference, it
 * is the whole design: a reader sees the value, its unit and its period in the first
 * screenful; provenance is one tap into a detent; the capability detail is last and
 * behind a control, because a reader who came to see the market did not come to read a
 * provider allowlist.
 *
 * ── WHAT COMPACT REDUCES, AND WHAT IT REFUSES TO ──────────────────────────
 *
 * It reduces INFORMATION, not legibility. Labels wrap rather than truncate — a truncated
 * unit is a different unit — and nothing here drops a fact that changes what a figure
 * means. The value, the unit, the period, the vintage and its provenance, the freshness
 * state and the source all survive at 390px. What is cut is the explanatory prose and the
 * contract constants, both of which are one tap away.
 */

import { useReducer, type JSX } from 'react';
import {
  MKT_CANVAS, MKT_HIT_TARGET_PX, MKT_INK, MKT_LICENSED, MKT_LINE, MKT_NAV,
  MKT_SURFACE, MKT_TYPE, mktTracking,
} from '@/lib/market/mktTokens';
import { Heading, Identifier, Verdict, edge, micro } from './MktParts';
import { CapabilityList, MarketStatus, ObservationCard, ReadUnavailable } from './MktReader';
import {
  CHANGE_STATES_NOT_DERIVABLE, DATA_READINESS,
  MARKET_FIGURE_GAP_REASON, SUBJECT_READINESS,
} from '@/lib/market/mktReadiness';
import { MARKET_CAPABILITY, type MarketReadResult } from '@/lib/market/mktReadModel';
import { resolveMktStrings, type MktLocale } from '@/lib/market/mktStrings';
import { economyStrings } from '@/lib/economy/strings';

/**
 * THE DETENTS ARE THE INHERITED ONES, AND THE HEIGHTS SAY WHICH IS WHICH.
 *
 * `CAPABILITY` is FULL because it is a list a reader scrolls; `ANALYSIS` is HALF because
 * it is one disabled control and three sentences. A detent that opens to the wrong height
 * is how a sheet stops reading as a sheet.
 */
type Drawer = 'CAPABILITY' | 'ANALYSIS';
const DRAWERS: readonly Drawer[] = ['CAPABILITY', 'ANALYSIS'];
const DETENT: Readonly<Record<Drawer, 'HALF' | 'FULL'>> = {
  CAPABILITY: 'FULL',
  ANALYSIS: 'HALF',
};
const DETENT_VH: Readonly<Record<'HALF' | 'FULL', number>> = { HALF: 42, FULL: 68 };

interface View { readonly drawer: Drawer | null }
type Action = { k: 'OPEN'; v: Drawer } | { k: 'CLOSE' };
const reducer = (s: View, a: Action): View =>
  a.k === 'OPEN' ? { drawer: a.v } : { drawer: null };

/** The compact readiness row. Stacked, because two columns at 390px truncate one of them. */
function CompactReadinessRow({ ready, label, measured }: {
  ready: boolean; label: string; measured: string;
}): JSX.Element {
  return (
    <div data-mkt="compact-readiness-row" data-mkt-ready={String(ready)}
      style={{
        display: 'flex', flexDirection: 'column', gap: '5px',
        padding: '10px 0', borderBottom: `1px solid ${MKT_LINE.hairline}`,
      }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: MKT_TYPE.body, color: MKT_INK.secondary, flex: '1 1 16ch',
          whiteSpace: 'normal', overflowWrap: 'anywhere',
        }}>{label}</span>
        <Verdict ready={ready}>{ready ? 'READY' : 'NOT READY'}</Verdict>
      </div>
      <span style={{
        ...micro, color: MKT_INK.label, textTransform: 'none',
        letterSpacing: mktTracking(0.01), whiteSpace: 'normal', overflowWrap: 'anywhere',
      }}>
        <Identifier>{measured}</Identifier>
      </span>
    </div>
  );
}

export function MarketCompactScreen({ locale, read }: {
  locale: MktLocale; read: MarketReadResult;
}): JSX.Element {
  const [view, dispatch] = useReducer(reducer, { drawer: null });
  const res = resolveMktStrings(locale);
  const t = res.strings;
  const held = read.kind === 'OBSERVATIONS' ? read.observations.length : 0;
  const detent = view.drawer === null ? null : DETENT[view.drawer];

  return (
    <main data-mkt="compact-screen" data-mkt-drawer={view.drawer ?? 'none'}
      className={`relative ${MKT_CANVAS.base}`}
      style={{ color: MKT_INK.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <div aria-hidden="true" data-mkt="canvas-field"
        className={`pointer-events-none absolute inset-0 ${MKT_CANVAS.field}`} />
      <div aria-hidden="true" data-mkt="canvas-grid"
        className={`pointer-events-none absolute inset-0 ${MKT_CANVAS.grid}`} />

      {res.fellBack && (
        <div data-mkt="locale-fallback" style={{
          position: 'relative', padding: '8px 14px', background: MKT_SURFACE.raised,
          borderBottom: edge, ...micro, color: MKT_INK.tertiary,
          whiteSpace: 'normal', overflowWrap: 'anywhere',
        }}>{t.labels.localeFallback}</div>
      )}

      <header data-mkt="compact-zone-a" style={{
        position: 'relative', flex: '0 0 auto', padding: '14px',
        background: MKT_SURFACE.panel, borderBottom: edge,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        <span style={{ ...micro, whiteSpace: 'normal' }}>GlobalNews AI · {t.domain}</span>
        <h1 style={{
          margin: 0, fontSize: MKT_TYPE.title, fontWeight: 600, color: MKT_INK.primary,
          whiteSpace: 'normal', overflowWrap: 'anywhere',
        }}>{read.kind === 'OBSERVATIONS' ? t.reader.headline : t.reader.headlineNone}</h1>
        <MarketStatus held={held} t={t} />
      </header>

      <div data-mkt="compact-body" style={{
        position: 'relative', flex: '1 1 auto', overflow: 'auto',
        padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        {read.kind === 'OBSERVATIONS' ? (
          <section data-mkt="compact-observations" style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {read.observations.map((o) => (
              <ObservationCard key={o.observationKey} o={o} t={t} />
            ))}
          </section>
        ) : (
          <ReadUnavailable reason={read.reason} t={t} />
        )}
      </div>

      {/*
        THE BOTTOM DETENT. One sheet at a time, replacement not stacking; opening a second
        replaces the first, which is the inherited rule and the reason there is no stack
        to pop.
      */}
      {view.drawer !== null && detent !== null && (
        <section data-mkt="compact-drawer" data-mkt-detent={detent} role="region"
          aria-label={view.drawer === 'CAPABILITY' ? t.reader.showCapability : t.drawers.ANALYSIS}
          style={{
            position: 'relative', flex: '0 0 auto', height: `${DETENT_VH[detent]}vh`,
            overflow: 'auto', borderTop: edge, background: MKT_SURFACE.panel,
            padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
            <Heading>
              {view.drawer === 'CAPABILITY' ? t.reader.showCapability : t.drawers.ANALYSIS}
            </Heading>
            <button type="button" data-mkt="drawer-close" onClick={() => dispatch({ k: 'CLOSE' })}
              style={{
                ...micro, minHeight: `${MKT_HIT_TARGET_PX}px`, padding: '0 14px',
                border: `1px solid ${MKT_LINE.border}`, background: MKT_SURFACE.chip,
                color: MKT_INK.secondary, cursor: 'pointer',
              }}>{t.labels.close}</button>
          </div>

          {view.drawer === 'CAPABILITY' && (
            <>
              <CapabilityList rows={MARKET_CAPABILITY} t={t} />
              <Heading level="secondary" note={t.labels.contractSays}>{t.labels.sourceReadiness}</Heading>
              <div>
                {DATA_READINESS.map((f) => (
                  <CompactReadinessRow key={f.id} ready={f.ready} label={t.readiness[f.id as keyof typeof t.readiness] ?? f.id} measured={f.measured} />
                ))}
              </div>
              <Heading level="secondary">{t.sections.SUBJECTS}</Heading>
              <div>
                {SUBJECT_READINESS.map((s) => (
                  <div key={s.subject} data-mkt="compact-subject-row"
                    data-mkt-enabled={String(s.runtimeEnabled)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '4px', padding: '9px 0',
                      borderBottom: `1px solid ${MKT_LINE.hairline}`,
                    }}>
                    <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary,
                      whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                      {t.subjects[s.subject] ?? s.subject}
                    </span>
                    <span data-mkt="absence" data-mkt-absence={s.absence}
                      style={{ ...micro, color: MKT_INK.tertiary, textTransform: 'none',
                        letterSpacing: mktTracking(0.01), whiteSpace: 'normal',
                        overflowWrap: 'anywhere' }}>
                      {t.absence[s.absence]}
                    </span>
                  </div>
                ))}
              </div>
              <span data-mkt="ceiling-count" style={{ ...micro, color: MKT_INK.label,
                whiteSpace: 'normal' }}>
                {CHANGE_STATES_NOT_DERIVABLE.length} {t.labels.notReady}
              </span>
            </>
          )}

          {view.drawer === 'ANALYSIS' && (
            <>
              <button type="button" data-mkt="deep-analysis" data-mkt-cost="unavailable"
                disabled aria-disabled="true"
                style={{
                  ...micro, minHeight: `${MKT_HIT_TARGET_PX}px`, padding: '0 16px',
                  border: `1px solid ${MKT_LINE.border}`, background: MKT_SURFACE.chip,
                  color: MKT_INK.tertiary, cursor: 'not-allowed', alignSelf: 'flex-start',
                  whiteSpace: 'normal', overflowWrap: 'anywhere',
                }}>{t.labels.analysisUnavailable}</button>
              <p style={{ margin: 0, fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
                whiteSpace: 'normal' }}>{t.labels.watchUnavailable}</p>
              {MARKET_FIGURE_GAP_REASON !== null && (
                <span data-mkt="figure-gap-reason" data-mkt-gap-reason={MARKET_FIGURE_GAP_REASON}
                  style={{ ...micro, color: MKT_INK.label, whiteSpace: 'normal' }}>
                  {economyStrings(locale).gapReason[MARKET_FIGURE_GAP_REASON]}
                </span>
              )}
            </>
          )}
        </section>
      )}

      <nav data-mkt="compact-dock" aria-label={t.domain} style={{
        position: 'relative', flex: '0 0 auto', borderTop: edge, background: MKT_NAV.inactiveFill,
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      }}>
        {DRAWERS.map((d) => (
          <button key={d} type="button" data-mkt="dock-button" data-mkt-dock={d}
            onClick={() => dispatch({ k: 'OPEN', v: d })}
            style={{
              ...micro, minHeight: `${MKT_HIT_TARGET_PX}px`, padding: '11px 10px',
              border: 'none', borderInlineEnd: `1px solid ${MKT_LINE.hairline}`,
              background: view.drawer === d ? MKT_SURFACE.selected : 'transparent',
              color: view.drawer === d ? MKT_LICENSED.cyan : MKT_INK.secondary,
              cursor: 'pointer',
              /* WRAP, NEVER TRUNCATE — a clipped label is a different label. */
              whiteSpace: 'normal', overflowWrap: 'anywhere',
            }}>
            {d === 'CAPABILITY' ? t.reader.showCapability : t.drawers.ANALYSIS}
          </button>
        ))}
      </nav>
    </main>
  );
}
