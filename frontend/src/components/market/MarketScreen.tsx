'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VII · MARKET — THE DESKTOP READER SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS FILE USED TO BE, AND WHY IT IS NOT THAT ANY MORE.
 *
 * It was a readiness console. Its first screenful was four contract-readiness rows with
 * `EQUITY_OR_INDEX_SOURCE_QUALIFIED = false` under them and eight NOT READY pills down the
 * right edge, and its tab strip was READINESS / SUBJECTS / PROCUREMENT / ENTITY. Every one
 * of those facts is true and none of them is what a reader came for. A reader came to see
 * the market; the platform's opinion of its own plumbing is a detail, and a detail belongs
 * below the fold in its own register.
 *
 * SO THE SUBSTRATE IS KEPT AND THE FRAME IS INVERTED. `mktReadiness.ts` is untouched and
 * still measures the contract. `mktTokens.ts` is untouched. `MktParts.tsx` is untouched.
 * The canvas, the disclosed locale fallback, the replace-the-body drawer and the dock are
 * the proven mechanics and they are reused, not rebuilt. What changed is what is FIRST:
 * observations, then where they came from, then — for whoever wants it — what the platform
 * can and cannot yet observe.
 *
 * ── THE PRIMARY SURFACE, AND WHAT IT SAYS WHEN IT IS EMPTY ────────────────
 *
 * Today the read returns UNAVAILABLE, so the first screenful is the honest unavailable
 * state and nothing else. It does not fill the space with readiness rows to look busy: an
 * empty market surface padded with engineering facts reads as a surface that is working,
 * and it is not. It states what is missing, in one sentence a reader can act on, and
 * carries the sentence that stops the inference — *"That describes what we hold — it is
 * not a statement about the market."*
 *
 * When the read returns observations the same frame carries them, in the same place, with
 * no layout change. That is deliberate: the populated composition is not a second design
 * to be discovered later, it is this one with its list non-empty.
 *
 * ── MINIMAL EMPTY SPACE — R13's CAP, NOT A FULLER PAGE ────────────────────
 *
 * The activation asks for minimal empty space. The wrong way to get it is more content;
 * the right way is a narrower measure and a capped rail, which is what R13 already
 * specifies. The body is capped at a reading measure and the page does not stretch a
 * four-line answer across 1512px.
 */

import { useReducer, type JSX } from 'react';
import {
  MKT_CANVAS, MKT_HIT_TARGET_PX, MKT_INK, MKT_LICENSED, MKT_LINE, MKT_NAV,
  MKT_SURFACE, MKT_TYPE, mktTracking,
} from '@/lib/market/mktTokens';
import { Heading, Identifier, Verdict, edge, micro } from './MktParts';
import {
  CapabilityList, MarketStatus, ObservationCard, ReadUnavailable,
} from './MktReader';
import {
  CHANGE_STATES_NOT_DERIVABLE, CHANGE_STATE_GAPS, DATA_READINESS,
  MARKET_FIGURE_GAP_REASON, MARKET_SURFACE_DECLARES_NO_SCORER, SUBJECT_READINESS,
} from '@/lib/market/mktReadiness';
import { MARKET_CAPABILITY, type MarketReadResult } from '@/lib/market/mktReadModel';
import { resolveMktStrings, type MktLocale } from '@/lib/market/mktStrings';
import { economyStrings } from '@/lib/economy/strings';

/**
 * TWO DRAWERS, NOT FOUR TABS.
 *
 * The tab strip is gone. It existed to switch between four readiness views, and there are
 * no longer four readiness views on the primary surface to switch between. What survives
 * is R08's drawer model — *"DRAWER = sustained investigation. Drawers replace, they do not
 * stack"* — for the two things a reader may want to sustain: where a figure came from, and
 * what the platform can observe at all.
 */
type Drawer = 'CAPABILITY' | 'ANALYSIS';
const DRAWERS: readonly Drawer[] = ['CAPABILITY', 'ANALYSIS'];

interface View { readonly drawer: Drawer | null }
type Action = { k: 'OPEN'; v: Drawer } | { k: 'CLOSE' };
const reducer = (s: View, a: Action): View =>
  a.k === 'OPEN' ? { drawer: a.v } : { drawer: null };

/**
 * A capability row in the DETAIL drawer — the readiness substrate, kept.
 *
 * It shows the VERDICT and, beside it, the CONSTANT that produced the verdict. That
 * pairing is the whole point and it is why the substrate is worth keeping: a reader who
 * doubts "not ready" can read the contract value that says so. It is simply no longer the
 * first thing anybody sees.
 */
function ReadinessRow({ ready, label, measured }: {
  ready: boolean; label: string; measured: string;
}): JSX.Element {
  return (
    <div data-mkt="readiness-row" data-mkt-ready={String(ready)}
      style={{
        display: 'flex', gap: '14px', justifyContent: 'space-between', alignItems: 'baseline',
        flexWrap: 'wrap', padding: '9px 0', borderBottom: `1px solid ${MKT_LINE.hairline}`,
      }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: '1 1 26ch' }}>
        <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary,
          whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{label}</span>
        <span style={{ ...micro, color: MKT_INK.label, textTransform: 'none',
          letterSpacing: mktTracking(0.01) }}>
          <Identifier>{measured}</Identifier>
        </span>
      </div>
      <Verdict ready={ready}>{ready ? 'READY' : 'NOT READY'}</Verdict>
    </div>
  );
}

export function MarketScreen({ locale, read }: {
  locale: MktLocale; read: MarketReadResult;
}): JSX.Element {
  const [view, dispatch] = useReducer(reducer, { drawer: null });
  const res = resolveMktStrings(locale);
  const t = res.strings;
  const held = read.kind === 'OBSERVATIONS' ? read.observations.length : 0;

  return (
    <main data-mkt="screen" data-mkt-drawer={view.drawer ?? 'none'}
      className={`relative ${MKT_CANVAS.base}`}
      style={{ color: MKT_INK.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/*
        THE APPLICATION'S CANVAS, GN-CD-300 §F.2 and §G. Part VII draws no gradient and no
        grid — measured: zero in all four boards — because a board mocks panels, not the
        page beneath them. Decorative only: aria-hidden, pointer-events-none, no state.
      */}
      <div aria-hidden="true" data-mkt="canvas-field"
        className={`pointer-events-none absolute inset-0 ${MKT_CANVAS.field}`} />
      <div aria-hidden="true" data-mkt="canvas-grid"
        className={`pointer-events-none absolute inset-0 ${MKT_CANVAS.grid}`} />

      {/*
        THE FALLBACK IS DISCLOSED, NEVER SILENT. A locale with no authored Market
        catalogue renders English AND says so. The alternative — inheriting English under
        `fellBack: false` — is the one delivery route worse than not translating at all.
      */}
      {res.fellBack && (
        <div data-mkt="locale-fallback" style={{
          position: 'relative', padding: '8px 20px', background: MKT_SURFACE.raised,
          borderBottom: edge, ...micro, color: MKT_INK.tertiary,
        }}>{t.labels.localeFallback}</div>
      )}

      {/* ── ZONE A · the market headline and its status ──────────────────── */}
      <header data-mkt="zone-a" style={{
        position: 'relative', flex: '0 0 auto', padding: '18px 20px',
        background: MKT_SURFACE.panel, borderBottom: edge,
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <span style={micro}>GlobalNews AI · {t.domain}</span>
        <div style={{
          display: 'flex', gap: '16px', justifyContent: 'space-between',
          alignItems: 'baseline', flexWrap: 'wrap',
        }}>
          <h1 style={{ margin: 0, fontSize: MKT_TYPE.title, fontWeight: 600, color: MKT_INK.primary }}>
            {read.kind === 'OBSERVATIONS' ? t.reader.headline : t.reader.headlineNone}
          </h1>
          <MarketStatus held={held} t={t} />
        </div>
      </header>

      {view.drawer === null ? (
        /*
          ZONE C ABSORBS SURPLUS; ZONE D IS CAPPED — R13, AND THE ANSWER TO EMPTY SPACE.

          The first pass capped the whole body at a reading measure and left it against the
          left edge, so at 1512px more than half the viewport was canvas and the surface
          read as unfinished rather than as calm. R13 already says what to do with surplus
          width: it goes to zone C, and the context rail stays capped at 336px and never
          grows. So the body is a two-column grid — substrate, then capped rail — and the
          rail is where capability lives.

          At narrow widths the grid collapses to one column and the rail follows the
          substrate, which is the same ordering the compact composition uses.
        */
        <div data-mkt="body" style={{
          position: 'relative', flex: '1 1 auto', overflow: 'auto', padding: '20px',
          display: 'grid', gap: '18px 28px', alignContent: 'start',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 336px)',
          maxWidth: '1240px', width: '100%', margin: '0 auto',
        }}>
          {/*
            PRIMARY. Observations, or the truthful unavailable state — never both, and
            never readiness rows standing in for either.
          */}
          {read.kind === 'OBSERVATIONS' ? (
            <section data-mkt="observations" style={{
              gridColumn: '1', display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <Heading>{t.reader.observations}</Heading>
              {read.observations.map((o) => (
                <ObservationCard key={o.observationKey} o={o} t={t} />
              ))}
            </section>
          ) : (
            <div style={{ gridColumn: '1' }}>
              <ReadUnavailable reason={read.reason} t={t} />
            </div>
          )}

          {/*
            SECONDARY. Which sources this surface may use, and whether any is running.
            Two facts per provider, never one verdict — SI-18.5.
          */}
          <section data-mkt="capability-summary" style={{
            gridColumn: '2', display: 'flex', flexDirection: 'column', gap: '10px',
            alignSelf: 'start',
          }}>
            <Heading level="secondary">{t.reader.capability}</Heading>
            <CapabilityList rows={MARKET_CAPABILITY} t={t} />
          </section>
        </div>
      ) : (
        /*
          THE DRAWER REPLACES THE BODY. R08: drawers replace, they do not stack, and there
          is no popup-on-popup anywhere in this composition.
        */
        <div data-mkt="drawer" data-mkt-drawer-open={view.drawer} role="region"
          aria-label={view.drawer === 'CAPABILITY' ? t.reader.showCapability : t.drawers.ANALYSIS}
          style={{
            position: 'relative', flex: '1 1 auto', overflow: 'auto', padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '16px',
            maxWidth: '86ch', width: '100%',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
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
              {/* The readiness substrate, in the place it belongs. */}
              <Heading level="secondary" note={t.labels.contractSays}>{t.labels.sourceReadiness}</Heading>
              <div>
                {DATA_READINESS.map((f) => (
                  <ReadinessRow key={f.id} ready={f.ready} label={t.readiness[f.id as keyof typeof t.readiness] ?? f.id} measured={f.measured} />
                ))}
              </div>

              <Heading level="secondary">{t.sections.SUBJECTS}</Heading>
              <div>
                {SUBJECT_READINESS.map((s) => (
                  <div key={s.subject} data-mkt="subject-row" data-mkt-enabled={String(s.runtimeEnabled)}
                    style={{
                      display: 'flex', gap: '12px', justifyContent: 'space-between',
                      alignItems: 'baseline', flexWrap: 'wrap', padding: '9px 0',
                      borderBottom: `1px solid ${MKT_LINE.hairline}`,
                    }}>
                    <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.secondary }}>
                      {t.subjects[s.subject] ?? s.subject}
                    </span>
                    <span data-mkt="absence" data-mkt-absence={s.absence}
                      style={{ ...micro, color: MKT_INK.tertiary, textTransform: 'none',
                        letterSpacing: mktTracking(0.01), whiteSpace: 'normal', flex: '1 1 24ch' }}>
                      {t.absence[s.absence]}
                    </span>
                  </div>
                ))}
              </div>

              <Heading level="secondary">{t.labels.changeCeiling}</Heading>
              <span style={{ ...micro, color: MKT_INK.label }}>
                {CHANGE_STATES_NOT_DERIVABLE.length} {t.labels.notReady}
              </span>
              <div>
                {CHANGE_STATES_NOT_DERIVABLE.map((s) => (
                  <div key={s} style={{
                    display: 'flex', gap: '14px', justifyContent: 'space-between',
                    alignItems: 'baseline', flexWrap: 'wrap', padding: '8px 0',
                    borderBottom: `1px solid ${MKT_LINE.hairline}`,
                  }}>
                    <span style={{ ...micro, color: MKT_INK.secondary, textTransform: 'none' }}>
                      <Identifier>{s}</Identifier>
                    </span>
                    <span style={{ fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
                      whiteSpace: 'normal', flex: '1 1 30ch', textAlign: 'end' }}>
                      {CHANGE_STATE_GAPS[s]}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ margin: 0, fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
                whiteSpace: 'normal', maxWidth: '62ch' }}>{t.labels.degradedDefault}</p>
            </>
          )}

          {view.drawer === 'ANALYSIS' && (
            <>
              {/*
                R15's degraded rule, verbatim: where no cost estimate is available the
                control is disabled and reads COST UNAVAILABLE — CANNOT INVOKE. It never
                falls back to invoking without a stated price, and `disabled` plus
                `aria-disabled` means it cannot be clicked into one.
              */}
              <button type="button" data-mkt="deep-analysis" data-mkt-cost="unavailable"
                disabled aria-disabled="true"
                style={{
                  ...micro, minHeight: `${MKT_HIT_TARGET_PX}px`, padding: '0 16px',
                  border: `1px solid ${MKT_LINE.border}`, background: MKT_SURFACE.chip,
                  color: MKT_INK.tertiary, cursor: 'not-allowed', alignSelf: 'flex-start',
                }}>{t.labels.analysisUnavailable}</button>
              <p style={{ margin: 0, fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
                whiteSpace: 'normal', maxWidth: '62ch' }}>{t.labels.watchUnavailable}</p>
              <p style={{ margin: 0, fontSize: MKT_TYPE.body, color: MKT_INK.tertiary,
                whiteSpace: 'normal', maxWidth: '62ch' }}>{t.labels.noScorer}</p>
              {MARKET_FIGURE_GAP_REASON !== null && (
                <span data-mkt="figure-gap-reason" data-mkt-gap-reason={MARKET_FIGURE_GAP_REASON}
                  style={{ ...micro, color: MKT_INK.label }}>
                  {economyStrings(locale).gapReason[MARKET_FIGURE_GAP_REASON]}
                </span>
              )}
              <span data-mkt="no-scorer" data-mkt-declared={String(MARKET_SURFACE_DECLARES_NO_SCORER)}
                style={{ ...micro, color: MKT_INK.label }} />
            </>
          )}
        </div>
      )}

      {/* ── THE DOCK ─────────────────────────────────────────────────────── */}
      <nav data-mkt="dock" aria-label={t.domain} style={{
        position: 'relative', flex: '0 0 auto', borderTop: edge, background: MKT_NAV.inactiveFill,
        display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 232px), 1fr))`,
      }}>
        {DRAWERS.map((d) => (
          <button key={d} type="button" data-mkt="dock-button" data-mkt-dock={d}
            onClick={() => dispatch({ k: 'OPEN', v: d })}
            style={{
              ...micro, minHeight: `${MKT_HIT_TARGET_PX}px`, padding: '12px 14px',
              border: 'none', borderInlineEnd: `1px solid ${MKT_LINE.hairline}`,
              background: view.drawer === d ? MKT_SURFACE.selected : 'transparent',
              color: view.drawer === d ? MKT_LICENSED.cyan : MKT_INK.secondary,
              cursor: 'pointer', whiteSpace: 'normal', overflowWrap: 'anywhere',
            }}>
            {d === 'CAPABILITY' ? t.reader.showCapability : t.drawers.ANALYSIS}
          </button>
        ))}
      </nav>
    </main>
  );
}
