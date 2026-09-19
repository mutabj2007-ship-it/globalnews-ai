'use client';

/**
 * PART X · HUMANITARIAN — THE DESKTOP FRAME.
 *
 * R13's four permanent regions plus a dock. ONE component; the four drawn frame
 * states are its STATE, not four files. A drawer replaces zones C and D and never
 * occludes zone A or the assessment statement — which is why the drawer is rendered
 * INSIDE the C/D grid area and the header sits outside it.
 *
 * DEGRADED-FIRST IS NOT A MODE. Every axis below arrives already absent, because
 * nothing in the source programme is DATA READY. There is no branch here that shows
 * "real" values when data appears — the model carries slots, and a slot without an
 * observation renders its reason. That is the only way a coverage gap cannot quietly
 * become a calm blank.
 */
import { useReducer, type JSX } from 'react';
import { HUM_CANVAS, HUM_INK, HUM_LICENSED, HUM_LINE, HUM_NAV, HUM_SURFACE, HUM_TYPE, humTracking } from '@/lib/humanitarian/humTokens';
import { HUM_HIT_TARGET_PX, HUM_QUEUE_CAP, HUM_RAIL_PX } from '@/lib/humanitarian/humConfig';
import {
  HUM_DRAWER_KINDS, humViewReducer, initialViewState,
  type HumDrawerKind, type HumFrameState,
} from '@/lib/humanitarian/humState';
import { humFrameLabel, resolveHumStrings, type HumLocale } from '@/lib/humanitarian/humStrings';
import { quietClaimFor } from '@/lib/humanitarian/humDegraded';
import { HUM_VIEWS, HUM_QUEUE_ROWS } from './HumanitarianModel';
import { HumDrawer } from './HumDrawer';
import { Absence, AreaLabel, Chip, Dependency, SectionTitle, Zone, microLabel, panelEdge } from './HumParts';

const FRAMES: readonly HumFrameState[] = ['ENTRY', 'SELECTED', 'GAP', 'QUIET'];

export function HumanitarianScreen({ locale }: { locale: HumLocale }): JSX.Element {
  const resolution = resolveHumStrings(locale);
  const t = resolution.strings;
  const [state, dispatch] = useReducer(humViewReducer, undefined, () => initialViewState('ENTRY'));
  const view = HUM_VIEWS[state.frame];

  return (
    <main
      data-hum="screen"
      data-hum-frame={state.frame}
      data-hum-drawer={state.drawer ?? 'none'}
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

      {/*
        THE FALLBACK IS DISCLOSED, NEVER SILENT. LANG-UI-7-D3 exists because a client
        that renders English while claiming another locale is the failure mode that
        cannot be seen from inside the page.
      */}
      {resolution.fellBack && (
        <div data-hum="locale-fallback" style={{ position: 'relative',
          padding: '8px 20px', background: HUM_SURFACE.raised, borderBottom: panelEdge,
          ...microLabel, color: HUM_INK.tertiary,
        }}>
          {t.common.localeFallback}
        </div>
      )}

      {/* ── ZONE A · status header. Never occluded by a drawer. ───────────── */}
      <header
        data-hum="zone-a"
        style={{
          position: 'relative', flex: '0 0 auto', padding: '16px 20px', background: HUM_SURFACE.header,
          borderBottom: panelEdge, display: 'flex', flexDirection: 'column', gap: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <span style={{ ...microLabel }}>{t.domain} · {view.region}</span>
            <h1 style={{
              margin: 0, fontSize: HUM_TYPE.title, fontWeight: 600,
              letterSpacing: humTracking(-0.01), color: HUM_INK.primary,
            }}>
              {view.jurisdiction}
            </h1>
            {/*
              THE HEADLINE IS RESOLVED, NOT READ. A STATED title is ordinary prose that
              claims nothing about whether anyone looked; the QUIET frame carries no text
              at all and resolves from its change slot, so "Checked — no material change"
              is reachable only when a change state was genuinely derived.
            */}
            <span data-hum="frame-title"
              data-hum-quiet-claim={view.title.kind === 'FROM_CHANGE_STATE' ? quietClaimFor(view.change) : undefined}
              style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
              {view.title.kind === 'STATED' ? view.title.text : t.quietSubtitle[quietClaimFor(view.change)]}
            </span>
          </div>
          {/*
            R13's zone A carries FOUR facts and all four survive at 390: jurisdiction,
            precision, freshness and coverage honesty. `UPDATED` and `GENERATED` are
            shown as absent rather than filled with a fetch time — a render clock is
            not a freshness fact, and printing one would be the same class of invention
            as printing a population.
          */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Chip label={t.zoneA.scope} value={view.region} />
            <Chip label={t.zoneA.precision} value={view.precision.alias} />
            {/*
              AMBER IS THE ATTENTION CONDITION, and a coverage gap is the one thing on a
              data-poor frame a reader must not scroll past. It is applied to THIS state
              only — the other three coverage values stay neutral, because a hue that
              marks every state marks nothing.
            */}
            <Chip label={t.zoneA.coverage} value={t.coverage[view.coverage.health]}
              accent={view.coverage.health === 'COVERAGE_GAP' ? 'amber' : undefined} />
            <Chip label={t.zoneA.updated} value={t.common.noData} />
            <Chip label={t.zoneA.revision} value={t.common.noData} />
          </div>
        </div>
        {view.coverage.assertedFromAbsence && (
          <span data-hum="coverage-asserted" style={{ ...microLabel, color: HUM_INK.tertiary }}>
            {t.coverage.assertedFromAbsence}
          </span>
        )}
      </header>

      {/*
        THE MOVING SELECTION. The ten drawn states are reached without ten routes, so
        WHICH ONE a reader is in has to be unmistakable — it is the only thing telling
        them where they are.

        The treatment is bound to `state.frame`, a single value, so exactly one tab can
        carry it and "two look selected" is not a reachable state. Three signals together,
        because the tinted fill alone measures 1.07:1 against the panel and would be a
        whisper: the fill, a 2px cyan top edge at 9.97:1, and a title at 11.94:1 against
        the inactive label's 6.35:1.
      */}
      {/*
        THE STRIP SCROLLS SO THE PAGE DOES NOT.

        Four tabs reach 415px at a 390px viewport and the PAGE scrolled horizontally —
        measured, in English. The QUIET tab is the widest because its label is now
        resolved from the change slot ("State not derivable — this is not 'no material
        change'"), which is the honest label and a longer one; the geometry has to hold
        the truthful string rather than the string being chosen to fit the geometry.

        A deliberate horizontal scroller is the accepted pattern here for a narrow control
        strip — Economy's compact indicator rail, this domain's own compact frame switch
        and Market's section switch all use it — so the strip is the thing that scrolls.
      */}
      <nav data-hum="frame-switch" role="tablist" style={{ position: 'relative',
        flex: '0 0 auto', display: 'flex', gap: '1px', background: HUM_LINE.structure,
        borderBottom: panelEdge, overflowX: 'auto',
      }}>
        {FRAMES.map((f) => {
          const active = state.frame === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              id={`hum-tab-${f}`}
              aria-controls="hum-tabpanel"
              /* ROVING TABINDEX. In a tablist, Tab enters the strip once and arrows move
                 within it; leaving every tab at 0 makes a keyboard user tab through all
                 four to reach the content. */
              tabIndex={active ? 0 : -1}
              data-hum="frame-button"
              data-hum-active={String(active)}
              onClick={() => dispatch({ kind: 'SELECT_FRAME', frame: f })}
              style={{
                minHeight: `${HUM_HIT_TARGET_PX}px`, padding: '0 14px', flex: '1 0 auto',
                whiteSpace: 'nowrap',
                background: active ? HUM_NAV.activeWash : HUM_NAV.inactiveFill,
                border: 'none',
                /* The edge is the loudest part, and it is 2px on one side only. */
                boxShadow: active ? `inset 0 2px 0 0 ${HUM_NAV.activeEdge}` : 'none',
                cursor: 'pointer',
                color: active ? HUM_NAV.activeInk : HUM_NAV.inactiveInk,
                fontWeight: active ? 600 : 400,
                fontSize: HUM_TYPE.monoMeta, textTransform: 'uppercase',
                letterSpacing: humTracking(active ? 0.1 : 0.08),
              }}
            >
              {humFrameLabel(t, f, HUM_VIEWS[f].change)}
            </button>
          );
        })}
      </nav>

      {/*
        THE TAB PANEL — THE HALF OF THE PATTERN THAT WAS MISSING.

        `role="tab"` was already here and `aria-selected` already moved with selection, so
        the strip LOOKED correct to a visual check and to a style-delta assertion. It was
        not: a tab that controls nothing is an incomplete widget, and a screen reader
        announcing "tab, 1 of 4, selected" with no associated panel gives a user no way to
        reach what they just selected. Zones B, C and D all change with the frame, so they
        are wrapped in ONE panel rather than each claiming to be the panel — a tab owns a
        single region, and three tabpanels for one tab would be a different defect.

        The wrapper is column flex with `minHeight: 0`, which is what zone B (0 0 auto)
        and the body grid (1 1 auto) were already relying on from `main`.
      */}
      <div
        id="hum-tabpanel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`hum-tab-${state.frame}`}
        data-hum="tabpanel"
        style={{ position: 'relative', flex: '1 1 auto', minHeight: 0,
          display: 'flex', flexDirection: 'column' }}
      >
      {/* ── ZONE B · assessment and change. Also never occluded. ──────────── */}
      <section
        data-hum="zone-b"
        style={{ position: 'relative',
          flex: '0 0 auto', padding: '16px 20px', background: HUM_SURFACE.panel,
          borderBottom: panelEdge, display: 'flex', flexDirection: 'column', gap: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/*
            A chip carries a VALUE. The first draft put the whole explanation inside it
            and the chip ran the width of the frame — the explanation belongs to the
            Absence block below, which is where a reader looks for a reason.
          */}
          <Chip label={t.assessment.changeState}
            value={view.change.state ?? t.common.notAssessed}
            title={t.absence.STATE_NOT_DERIVABLE} />
          <Chip label={t.assessment.direction} value={t.direction[view.change.direction]} />
          <Chip label={t.assessment.confidence} value={t.confidence[view.change.confidence]} />
        </div>
        <p data-hum="assessment-statement" style={{
          margin: 0, fontSize: HUM_TYPE.statement, lineHeight: 'var(--ar-lh, 1.35)', color: HUM_INK.primary,
          maxWidth: '68ch',
        }}>
          {t.assessment.noAssessment}
        </p>
        {view.change.reason !== null && <Absence reason={view.change.reason} t={t} />}
      </section>

      {/* ── ZONES C + D, or the drawer that replaces them. ────────────────── */}
      {state.drawer === null ? (
        <div
          data-hum="body-grid"
          style={{ position: 'relative',
            flex: '1 1 auto', minHeight: 0, display: 'grid',
            gridTemplateColumns: `minmax(0, 1fr) ${HUM_RAIL_PX}px`,
            gap: '1px', background: HUM_LINE.structure,
          }}
        >
          {/* ZONE C · substrate, absorbs surplus */}
          <Zone gn="zone-c" style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <section data-hum="queue" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionTitle note={`${t.queue.cap} · ${t.queue.notAnIncidentFeed}`}>{t.queue.title}</SectionTitle>
              {HUM_QUEUE_ROWS.length === 0 ? (
                <div data-hum="queue-empty" style={{ border: panelEdge, padding: '14px' }}>
                  <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary, lineHeight: 'var(--ar-lh, 1.45)' }}>
                    {t.queue.empty}
                  </span>
                </div>
              ) : null}
              <span style={{ ...microLabel, color: HUM_INK.tertiary }}>Cap {HUM_QUEUE_CAP}</span>
            </section>

            <section data-hum="sector-summary" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionTitle note={t.need.noComposite}>{t.need.title}</SectionTitle>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {view.sectors.map((s) => (
                  <span key={s.sector} data-hum="sector-chip" data-hum-need-level={s.level}>
                    <Chip label={t.sectors[s.sector]} value={t.needLevels[s.level]} />
                  </span>
                ))}
              </div>
              <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.coverage.notZeroNeed}</span>
            </section>

            {/* SPATIAL SLOT — degraded by default. No shading of an unassessed area. */}
            <section data-hum="spatial-slot" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionTitle note={t.spatial.degraded}>Geography</SectionTitle>
              <div style={{ border: panelEdge, padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ ...microLabel }}>{t.spatial.countryOutlineOnly}</span>
                <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>{t.spatial.shadingImplies}</span>
                <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.spatial.notAvailable}</span>
              </div>
            </section>

            {/*
              ACCESS IS ITS OWN REGION ON THE FRAME, not a line inside need. R08: "Access
              can be open while need is critical." Putting it under need would encode the
              collapse the axis rule exists to prevent.
            */}
            <section data-hum="access-summary" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionTitle note={t.access.ownAxis}>{t.access.title}</SectionTitle>
              <div style={{ border: panelEdge, display: 'flex', flexDirection: 'column' }}>
                {/*
                  THE ROW'S OWN ABSENCE REASON IS RENDERED, NOT DROPPED. One renderer used
                  to print `row.absence` and this one silently discarded it — the same
                  field, opposite behaviour, and nothing in the candidate decided which was
                  intended. Dropping it is the calm-blank failure this domain forbids, so
                  it renders here too; and since a protection state can no longer BE an
                  absence reason, rendering it cannot disclose one.
                */}
                {view.access.map((row, i) => (
                  <div key={`${row.area.name}-${row.area.precision}-${i}`} data-hum="access-row" data-hum-access={row.condition}
                    style={{
                      padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
                      gap: '10px', alignItems: 'baseline', flexWrap: 'wrap',
                      borderTop: i === 0 ? 'none' : `1px solid ${HUM_LINE.hairline}`,
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
              </div>
              <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.access.notAssessedIsNotOpen}</span>
            </section>

            {/* WHAT WOULD CLOSE THE GAP — the design's own H-06 region, and the one part
                of a data-poor frame that is genuinely actionable. */}
            <section data-hum="what-would-close" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionTitle>{t.coverage.whatWouldClose}</SectionTitle>
              <ul style={{ margin: 0, paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
                  A validated local-source baseline for this jurisdiction.
                </li>
                <li style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
                  Any sector measure with a stated method, period and precision.
                </li>
                <li style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
                  Local corroboration of any standing claim, which would move it from unverified.
                </li>
              </ul>
            </section>

            <Dependency t={t} text="Shared coverage authority, Assessment Revision schema, population facet and the sensitive-location classifier are all absent. Each is recorded for Main; none is implemented here." />
          </Zone>

          {/* ZONE D · context rail, capped and never grows */}
          <Zone gn="zone-d" style={{ padding: '14px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SectionTitle level="secondary" accent={HUM_LICENSED.mint}>{t.watch.title}</SectionTitle>
            <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>{t.watch.triggersInactive}</span>
            <SectionTitle level="secondary">{t.timeline.title}</SectionTitle>
            <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>{t.timeline.unavailable}</span>
            <SectionTitle level="secondary">{t.analysis.crossDomain}</SectionTitle>
            <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>{t.analysis.referenceCountOnly}</span>

            {/*
              THE SENSITIVE-LOCATION POSTURE IS STATED ON THE FRAME, not buried in a
              drawer — a reader should be able to see that protection is on without
              opening anything. What is stated is the POSTURE. What is never stated,
              here or anywhere, is a class, a count, a site or a coordinate: a
              per-record protected marker would itself narrow a location.
            */}
            <SectionTitle level="secondary">{t.sensitive.title}</SectionTitle>
            <span data-hum="sensitive-posture" style={{ fontSize: HUM_TYPE.body, color: HUM_INK.secondary }}>
              {t.sensitive.protectionOn} · {t.sensitive.noReveal}
            </span>
          </Zone>
        </div>
      ) : (
        <div data-hum="drawer-region" style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
          <HumDrawer kind={state.drawer} view={view} t={t}
            onClose={() => dispatch({ kind: 'CLOSE_DRAWER' })} />
        </div>
      )}
      </div>

      {/* ── ZONE E · dock. Every drawer reachable; none stacks. ───────────── */}
      <footer data-hum="zone-e" style={{ position: 'relative',
        flex: '0 0 auto', borderTop: panelEdge, background: HUM_SURFACE.panel,
        /*
          SIX FIXED COLUMNS BROKE AT 390. This frame is the DESKTOP composition, but it is
          still served at every width — a reader who opens /humanitarian on a phone gets
          this one — and six equal cells across 390 give each dock button 63px, which is
          narrower than the single word "understanding". Measured on this gate: five
          titles clipped and the PAGE scrolled horizontally on every mobile row, English
          included.

          `auto-fit` with a floor lets the dock become three rows of two at 390 and stay
          one row of six at 1440, from one declaration. The `min(100%, …)` guard keeps the
          floor from exceeding the container at the narrowest widths, which would
          reintroduce the overflow it exists to prevent.
        */
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 148px), 1fr))', gap: '1px',
      }}>
        {HUM_DRAWER_KINDS.map((kind: HumDrawerKind) => (
          <button
            key={kind}
            type="button"
            data-hum="dock-button"
            data-hum-opens={kind}
            onClick={() => dispatch({ kind: 'OPEN_DRAWER', drawer: kind })}
            style={{
              /*
                THE GEOMETRY WAS WRONG, NOT THE COPY.

                Six equal cells across 1440 give each dock button about 238px, and the
                button was `nowrap` + `overflow: hidden` + `ellipsis`. Five of the six
                titles are wider than that IN ENGLISH — up to 293px against 238 — so the
                strip clipped before a single translation existed. It was read as a
                translation-expansion problem; it is a fixed-width layout defect in the
                English design that every locale would have inherited, and French at the
                predicted 1.61x would have made it worse rather than caused it.

                So the label WRAPS and the cell grows. Nothing is shortened, nothing is
                abbreviated, and no translation is cut to fit a container that was too
                small to begin with — `minHeight` is a floor for the hit target, not a
                cap on the text.
              */
              minHeight: `${HUM_HIT_TARGET_PX}px`, padding: '8px 10px', minWidth: 0,
              whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1.25,
              /* The dock is navigation, so the open drawer wears the same cyan edge the
                 selected section wears. One idea, applied twice, rather than two. */
              background: state.drawer === kind ? HUM_NAV.activeWash : 'transparent',
              boxShadow: state.drawer === kind ? `inset 0 2px 0 0 ${HUM_NAV.activeEdge}` : 'none',
              border: 'none', borderInlineEnd: `1px solid ${HUM_LINE.hairline}`, cursor: 'pointer',
              color: state.drawer === kind ? HUM_NAV.activeInk : HUM_INK.label,
              fontWeight: state.drawer === kind ? 600 : 400,
              fontSize: HUM_TYPE.monoMeta, textTransform: 'uppercase', letterSpacing: humTracking(0.07),
            }}
          >
            {t.drawers[kind]}
          </button>
        ))}
      </footer>
    </main>
  );
}
