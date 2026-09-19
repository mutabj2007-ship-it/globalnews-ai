'use client';

/**
 * PART X · HUMANITARIAN — THE PHONE FRAME.
 *
 * R14: "Phone is not a shrunken desktop. At 390 the assessment honesty, precision,
 * freshness, coverage gap, change state and uncertainty all survive; prose is cut
 * before meaning."
 *
 * So zone A's four facts are never dropped — only their prose truncates — and the
 * drawer becomes a detent. ONE detent open at a time, and NO MAP BELOW A HALF DETENT:
 * the spatial slot is simply not mounted at PEEK, which a stylesheet edit cannot
 * undo, rather than hidden with CSS, which one could.
 */
import { useReducer, type JSX } from 'react';
import { HUM_CANVAS, HUM_INK, HUM_LINE, HUM_NAV, HUM_SURFACE, HUM_TYPE, humTracking } from '@/lib/humanitarian/humTokens';
import { HUM_DETENT_GEOMETRY, HUM_HIT_TARGET_PX } from '@/lib/humanitarian/humConfig';
import {
  HUM_DRAWER_DETENT, HUM_DRAWER_KINDS, humViewReducer, initialViewState,
  type HumDrawerKind, type HumFrameState,
} from '@/lib/humanitarian/humState';
import { humFrameLabel, resolveHumStrings, type HumLocale } from '@/lib/humanitarian/humStrings';
import { quietClaimFor } from '@/lib/humanitarian/humDegraded';
import { HUM_VIEWS } from './HumanitarianModel';
import { HumDrawer } from './HumDrawer';
import { Absence, AreaLabel, Chip, SectionTitle, microLabel, panelEdge } from './HumParts';

const FRAMES: readonly HumFrameState[] = ['ENTRY', 'SELECTED', 'GAP', 'QUIET'];

export function HumanitarianCompactScreen({ locale }: { locale: HumLocale }): JSX.Element {
  const resolution = resolveHumStrings(locale);
  const t = resolution.strings;
  const [state, dispatch] = useReducer(humViewReducer, undefined, () => initialViewState('ENTRY'));
  const view = HUM_VIEWS[state.frame];
  const detent = state.drawer === null ? null : HUM_DRAWER_DETENT[state.drawer];
  /** R14 · the map is not mounted below HALF. Structural, not cosmetic. */
  const mapAllowed = detent === null;

  return (
    <main
      data-hum="compact-screen"
      data-hum-frame={state.frame}
      data-hum-drawer={state.drawer ?? 'none'}
      data-hum-detent={detent ?? 'none'}
      className={`relative ${HUM_CANVAS.base}`}
      style={{
        color: HUM_INK.primary, minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/*
        THE RELEASED SUBSTRATE, GN-CD-300 §F.2 and §G — the two layers this frame was
        missing. Both are decorative and both say so: aria-hidden, pointer-events-none,
        no reading, no count, no state. They sit BEHIND the regions, and the regions are
        translucent, so the navy field and the 56px technical grid read through the frame
        instead of being covered by it.
      */}
      <div aria-hidden="true" data-hum="canvas-field"
        className={`pointer-events-none absolute inset-0 ${HUM_CANVAS.field}`} />
      <div aria-hidden="true" data-hum="canvas-grid"
        className={`pointer-events-none absolute inset-0 ${HUM_CANVAS.grid}`} />

      {resolution.fellBack && (
        <div data-hum="locale-fallback" style={{ position: 'relative', padding: '8px 14px', background: HUM_SURFACE.raised, borderBottom: panelEdge, ...microLabel, color: HUM_INK.tertiary }}>
          {t.common.localeFallback}
        </div>
      )}

      {/* ZONE A — all four facts survive. Prose is cut, meaning is not. */}
      <header data-hum="compact-zone-a" style={{
        position: 'relative', flex: '0 0 auto', padding: '14px', background: HUM_SURFACE.header, borderBottom: panelEdge,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        <span style={microLabel}>{t.domain} · {view.region}</span>
        <h1 style={{ margin: 0, fontSize: HUM_TYPE.title, fontWeight: 600, color: HUM_INK.primary }}>
          {view.jurisdiction}
        </h1>
        {/* Resolved from the change slot on this frame too — the claim cannot differ by viewport. */}
        <span data-hum="frame-title"
          data-hum-quiet-claim={view.title.kind === 'FROM_CHANGE_STATE' ? quietClaimFor(view.change) : undefined}
          style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
          {view.title.kind === 'STATED' ? view.title.text : t.quietSubtitle[quietClaimFor(view.change)]}
        </span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Chip label={t.zoneA.precision} value={view.precision.alias} />
          <Chip label={t.zoneA.coverage} value={t.coverage[view.coverage.health]}
            accent={view.coverage.health === 'COVERAGE_GAP' ? 'amber' : undefined} />
        </div>
      </header>

      {/*
        `role="tablist"` WAS MISSING HERE while the buttons already declared `role="tab"`.
        A tab must be owned by a tablist; without one the four buttons are announced as
        loose tabs belonging to nothing, and the set/position ("2 of 4") is lost. The
        desktop frame had the tablist and the compact frame did not — the kind of drift a
        visual check cannot see and a screen reader hits immediately.
      */}
      <nav data-hum="compact-frame-switch" role="tablist" style={{ position: 'relative',
        flex: '0 0 auto', display: 'flex', overflowX: 'auto', gap: '1px',
        background: HUM_LINE.structure, borderBottom: panelEdge,
      }}>
        {FRAMES.map((f) => {
          const active = state.frame === f;
          return (
            <button
              key={f} type="button" role="tab" aria-selected={active}
              id={`humc-tab-${f}`} aria-controls="humc-tabpanel" tabIndex={active ? 0 : -1}
              data-hum="frame-button" data-hum-active={String(active)}
              onClick={() => dispatch({ kind: 'SELECT_FRAME', frame: f })}
              style={{
                minHeight: `${HUM_HIT_TARGET_PX}px`, padding: '0 12px', whiteSpace: 'nowrap',
                background: active ? HUM_NAV.activeWash : HUM_NAV.inactiveFill,
                border: 'none',
                boxShadow: active ? `inset 0 2px 0 0 ${HUM_NAV.activeEdge}` : 'none',
                cursor: 'pointer',
                color: active ? HUM_NAV.activeInk : HUM_NAV.inactiveInk,
                fontWeight: active ? 600 : 400,
                fontSize: HUM_TYPE.monoMeta, textTransform: 'uppercase',
                letterSpacing: humTracking(active ? 0.09 : 0.07),
              }}
            >
              {humFrameLabel(t, f, HUM_VIEWS[f].change)}
            </button>
          );
        })}
      </nav>

      {/* The panel the four tabs control — zone B and the substrate below it. */}
      <div id="humc-tabpanel" role="tabpanel" tabIndex={0}
        aria-labelledby={`humc-tab-${state.frame}`} data-hum="compact-tabpanel"
        style={{ position: 'relative', flex: '1 1 auto', minHeight: 0,
          display: 'flex', flexDirection: 'column' }}>

      {/* ZONE B */}
      <section data-hum="compact-zone-b" style={{ position: 'relative',
        flex: '0 0 auto', padding: '14px', background: HUM_SURFACE.panel, borderBottom: panelEdge,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Chip label={t.assessment.changeState} value={view.change.state ?? t.common.notAssessed}
            title={t.absence.STATE_NOT_DERIVABLE} />
          <Chip label={t.assessment.confidence} value={t.confidence[view.change.confidence]} />
        </div>
        <p style={{ margin: 0, fontSize: HUM_TYPE.bodyLarge, lineHeight: 'var(--ar-lh, 1.4)', color: HUM_INK.primary }}>
          {t.assessment.noAssessment}
        </p>
        {view.change.reason !== null && <Absence reason={view.change.reason} t={t} />}
      </section>

      {/* SUBSTRATE — single column */}
      <div data-hum="compact-substrate" style={{ position: 'relative',
        flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SectionTitle note={t.need.noComposite}>{t.need.title}</SectionTitle>
          {view.sectors.map((s) => (
            <div key={s.sector} data-hum="compact-sector" data-hum-need-level={s.level}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline',
                padding: '10px 0', borderBottom: `1px solid ${HUM_LINE.hairline}`,
              }}>
              <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>{t.sectors[s.sector]}</span>
              <Chip label="" value={t.needLevels[s.level]} />
            </div>
          ))}
          <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.coverage.notZeroNeed}</span>
        </section>

        <section data-hum="compact-access" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SectionTitle note={t.access.ownAxis}>{t.access.title}</SectionTitle>
          {view.access.map((row, i) => (
            <div key={`${row.area.name}-${row.area.precision}-${i}`} data-hum="access-row" data-hum-access={row.condition}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline',
                padding: '10px 0', borderBottom: `1px solid ${HUM_LINE.hairline}`, flexWrap: 'wrap',
              }}>
              <AreaLabel area={row.area} precision={view.precision} t={t} />
              <Chip label="" value={t.access[row.condition]} />
              {row.absence !== null && (
                <span style={{ flex: '1 0 100%' }}>
                  <Absence reason={row.absence} t={t} />
                </span>
              )}
            </div>
          ))}
          <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.access.notAssessedIsNotOpen}</span>
        </section>

        {/*
          C-4 · THE CLASS-LEVEL POSTURE, STATED ON THE PHONE FRAME TOO.

          `data-hum="sensitive-posture"` was on desktop zone D and absent here, so a phone
          reader could reach it only by opening a drawer. Class-level disclosure is what
          the accepted policy PERMITS and it is the honest thing to show — the honesty the
          desktop earned was simply not available at 390.

          CLASS LEVEL ONLY. One statement for the whole frame, never keyed by a record,
          never a count, never a class, never a site, never a coordinate.
        */}
        <section data-hum="compact-sensitive" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SectionTitle level="secondary">{t.sensitive.title}</SectionTitle>
          <span data-hum="sensitive-posture" style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary, lineHeight: 'var(--ar-lh, 1.45)' }}>
            {t.sensitive.protectionOn} · {t.sensitive.noReveal}
          </span>
        </section>

        {mapAllowed && (
          <section data-hum="compact-spatial-slot" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionTitle note={t.spatial.degraded}>Geography</SectionTitle>
            <div style={{ border: panelEdge, padding: '12px' }}>
              <span style={{ ...microLabel }}>{t.spatial.countryOutlineOnly}</span>
            </div>
          </section>
        )}
      </div>
      </div>

      {/* DETENT — one at a time, height from R14's own geometry */}
      {state.drawer !== null && detent !== null && (
        <div
          data-hum="compact-detent"
          style={{ position: 'relative',
            flex: '0 0 auto',
            height: detent === 'PEEK' ? `${HUM_DETENT_GEOMETRY.peekPx}px`
              : detent === 'HALF' ? `${Math.round(HUM_DETENT_GEOMETRY.halfFraction * 100)}vh`
                : `${Math.round(HUM_DETENT_GEOMETRY.fullFraction * 100)}vh`,
            display: 'flex', minHeight: 0,
          }}
        >
          <HumDrawer kind={state.drawer} view={view} t={t} onClose={() => dispatch({ kind: 'CLOSE_DRAWER' })} />
        </div>
      )}

      <nav data-hum="compact-dock" style={{ position: 'relative',
        flex: '0 0 auto', borderTop: panelEdge, background: HUM_SURFACE.panel,
        display: 'flex', overflowX: 'auto',
      }}>
        {HUM_DRAWER_KINDS.map((kind: HumDrawerKind) => (
          <button
            key={kind} type="button" data-hum="dock-button" data-hum-opens={kind}
            onClick={() => dispatch({ kind: 'OPEN_DRAWER', drawer: kind })}
            style={{
              minHeight: `${HUM_HIT_TARGET_PX}px`, padding: '0 12px', whiteSpace: 'nowrap',
              background: state.drawer === kind ? HUM_SURFACE.selected : 'transparent',
              border: 'none', borderInlineEnd: `1px solid ${HUM_LINE.hairline}`, cursor: 'pointer',
              color: state.drawer === kind ? HUM_INK.primary : HUM_INK.secondary,
              fontSize: HUM_TYPE.monoMeta, textTransform: 'uppercase',
            }}
          >
            {t.drawers[kind]}
          </button>
        ))}
      </nav>
    </main>
  );
}
