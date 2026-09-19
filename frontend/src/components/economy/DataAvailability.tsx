import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { EconomyDataCapability } from '@/lib/economy/economyConfig';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { PROSE_MAX_CH } from '@/lib/economy/economyConfig';

/**
 * ECON-UI-1 — THE HONEST UNAVAILABLE STATE (ECON-DATA-1), NOW SUBORDINATE.
 *
 * ECON-DATA-1 measured the producer surface: there is NO CURRENT NUMERIC ECONOMIC
 * TIME-SERIES PRODUCER. No live CPI, GDP, policy-rate, debt or trade observation exists
 * to consume. That has not changed, and neither has the prohibition it carries: the
 * design's illustrative Rwanda / Kenya / Poland figures may not be promoted onto a
 * production path to make the surface "look finished".
 *
 * WHAT CHANGED IS THIS COMPONENT'S RANK, AND A RULE IT USED TO CARRY.
 *
 * It was the PRIMARY substrate under `NO_SOURCE`: `flex: 1 1 auto`, a 20px headline, three
 * paragraphs and a second copy of the indicator structure, rendered INSTEAD of the frame.
 * The Product Owner ruled that missing data may be visually silenced so the intended final
 * dashboard can be inspected, and that *"missing data must not dominate the page"*. A panel
 * that replaces the dashboard is the definition of dominating it.
 *
 * So the frame now renders its own final geometry with the figure withheld (`QuietFrame`),
 * and this is one quiet note beside it: the subject, the availability state, and the one
 * sentence that stops an empty economy page reading as a calm economy. The two paragraphs
 * of explanation moved to `ObservationAbsenceDetail`, reachable in a drawer.
 *
 * THE RULE THAT WAS RETIRED, AND WHY IT IS SAFE TO RETIRE.
 *
 * This header previously forbade keeping *"the triad, the chart or the surprise cell
 * present-but-empty, which would imply an observation exists and merely failed to load"*.
 * That reasoning was sound while nothing on the frame said otherwise — a dashed triad
 * alone is indistinguishable from a failed fetch. It is answered, not ignored:
 *
 *   - this note is RESIDENT beside the geometry, not behind a control, so the reason for
 *     the absence is on screen wherever an absent figure is;
 *   - the quiet cells carry NO release status, value kind or freshness axis, so nothing
 *     claims an observation was formed;
 *   - the SURPRISE cell is still not drawn, because it is derived from two absences;
 *   - the plot well draws no line, baseline or gridline, so no series is implied to have
 *     been flat.
 *
 * What survives unchanged: no zero, no `0.0%`, no dash-with-a-trend, and no unit-bearing
 * placeholder that reads as a value.
 */
export function NoObservationData({
  locale, subjectName,
}: {
  locale: EconomyLocale;
  subjectName: string;
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <section
      data-econ="no-observation-data"
      data-observation-source="absent"
      aria-live="polite"
      style={{
        flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '6px',
        border: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel, padding: '20px',
      }}
    >
      <span
        data-econ="no-observation-title"
        style={{
          fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))',
          textTransform: 'uppercase', color: ECON_INK.secondary,
        }}
      >
        {subjectName} · {t.noObservationTitle}
      </span>

      <p
        data-econ="no-observation-statement"
        style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.55)', color: ECON_INK.tertiary, maxWidth: `${PROSE_MAX_CH}ch` }}
      >
        {t.noObservationBody}
      </p>
    </section>
  );
}

/**
 * THE EXPLANATION THAT IS NO LONGER RESIDENT.
 *
 * `noObservationAxes` and `noObservationStructure` are the two paragraphs that used to sit
 * on the primary frame beside the note above. Both are true, both are worth reading once,
 * and neither is what a reader opened the dashboard for. R08's own model puts sustained
 * explanation in a drawer, so that is where they went — reachable, not resident.
 *
 * They are exported rather than inlined at the call site so there is exactly one place
 * where this copy is composed, and a later surface cannot quietly promote it back onto the
 * first viewport.
 */
export function ObservationAbsenceDetail({ locale }: { locale: EconomyLocale }): JSX.Element {
  const t = economyStrings(locale);
  const prose = {
    margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.55)',
    color: ECON_INK.secondary, maxWidth: `${PROSE_MAX_CH}ch`,
  };
  return (
    <div data-econ="absence-detail" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p data-econ="no-observation-axes" style={prose}>{t.noObservationAxes}</p>
      <p data-econ="no-observation-structure" style={prose}>{t.noObservationStructure}</p>
    </div>
  );
}

/**
 * ECON-UI-1 — FIXTURE DECLARATION.
 *
 * Deterministic fixtures are permitted so the surface is reachable and testable. The
 * condition attached to that permission is that they "must be clearly fixture/demo data in
 * code/tests and must not be exposed as authoritative production facts".
 *
 * In code that is the `fixtures.ts` module boundary and the FIXTURE capability value. ON
 * SCREEN it is this banner, which is not dismissible and is rendered above the frame — a
 * reader who lands on a fixture surface is told so before reading a single figure.
 */
export function FixtureBanner({ locale }: { locale: EconomyLocale }): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div
      data-econ="fixture-banner"
      role="note"
      style={{
        flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '10px 16px', background: ECON_SURFACE.raised,
        borderBottom: `1px solid ${ECON_LINE.emphasis}`,
      }}
    >
      <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
        {t.fixtureBannerTitle}
      </span>
      <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 12px)', lineHeight: 'var(--ar-lh, 1.5)', color: ECON_INK.secondary, maxWidth: `${PROSE_MAX_CH}ch` }}>
        {t.fixtureBannerBody}
      </span>
    </div>
  );
}

/**
 * The single decision every Economy surface makes about observation availability.
 *
 * ECON-UI-CONTRACT-ADAPT-1 renamed the middle member from `UNAVAILABLE` to `NO_SOURCE`. It was
 * never the freshness member of that name — this is a render mode, not a value axis — but
 * MAIN-ECON-CONTRACT-1's whole point is that "unavailable" was doing two jobs and should do
 * neither ambiguously. Two different concepts should not share a word inside one module.
 */
export type ObservationMode = 'OBSERVED' | 'NO_SOURCE' | 'FIXTURE';

export function observationMode(c: EconomyDataCapability): ObservationMode {
  switch (c.numericObservations) {
    case 'OBSERVED': return 'OBSERVED';
    case 'FIXTURE': return 'FIXTURE';
    default: return 'NO_SOURCE';
  }
}
