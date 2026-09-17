import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { EconomyDataCapability } from '@/lib/economy/economyConfig';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { PROSE_MAX_CH, STATEMENT_MAX_CH } from '@/lib/economy/economyConfig';

/**
 * ECON-UI-1 — THE HONEST UNAVAILABLE STATE (ECON-DATA-1).
 *
 * ECON-DATA-1 measured the producer surface: there is NO CURRENT NUMERIC ECONOMIC
 * TIME-SERIES PRODUCER. No live CPI, GDP, policy-rate, debt or trade observation exists
 * to consume.
 *
 * The design frames are figure-bearing throughout, and the tempting move is to keep them
 * populated with the design's illustrative Rwanda / Kenya / Poland numbers so the surface
 * "looks finished". That would publish fabricated economic facts. This component is the
 * alternative the ruling requires: when no observation source exists, the production-shaped
 * UI renders an honest UNAVAILABLE / NO OBSERVATION DATA state.
 *
 * What it deliberately does NOT do:
 *   - print a zero, a dash-with-a-trend, or a "0.0%" placeholder that reads as a value;
 *   - keep the triad, the chart or the surprise cell present-but-empty, which would imply
 *     an observation exists and merely failed to load;
 *   - carry release status, value kind or freshness. All three describe an OBSERVATION.
 *     With no observation, none of the three axes applies, and showing an axis chip with
 *     nothing behind it is the same lie in smaller type.
 *
 * What it DOES do: keep the frame's structure visible and labelled, so the reader can see
 * what this surface will report, and say plainly that the figures are absent rather than
 * zero.
 */
export function NoObservationData({
  locale, subjectName, seriesNames = [],
}: {
  locale: EconomyLocale;
  subjectName: string;
  /** Structure only — the names of the series this surface reports, never their values. */
  seriesNames?: readonly string[];
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <section
      data-econ="no-observation-data"
      data-observation-source="absent"
      aria-live="polite"
      style={{
        flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px',
        border: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel, padding: '20px',
      }}
    >
      <span
        style={{
          fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))',
          textTransform: 'uppercase', color: ECON_INK.secondary,
        }}
      >
        {t.noObservationTitle}
      </span>

      <p
        data-econ="no-observation-statement"
        style={{
          margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 20px)', lineHeight: 'var(--ar-lh, 1.3)', letterSpacing: 'calc(-0.012em * var(--ar-ls-mul, 1))', fontWeight: 500,
          color: ECON_INK.primary, maxWidth: `${STATEMENT_MAX_CH}ch`,
        }}
      >
        {subjectName} — {t.noObservationTitle.toLowerCase()}
      </p>

      <p style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.55)', color: ECON_INK.secondary, maxWidth: `${PROSE_MAX_CH}ch` }}>
        {t.noObservationBody}
      </p>

      {/* The three axes are named and explicitly withheld — never rendered as empty chips. */}
      <p
        data-econ="no-observation-axes"
        style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 12px)', lineHeight: 'var(--ar-lh, 1.55)', color: ECON_INK.tertiary, maxWidth: `${PROSE_MAX_CH}ch` }}
      >
        {t.noObservationAxes}
      </p>

      {seriesNames.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
            {t.noObservationStructure}
          </span>
          <ul
            data-econ="no-observation-structure"
            style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '1px', background: ECON_LINE.hairline }}
          >
            {seriesNames.map((name) => (
              <li
                key={name}
                data-econ="no-observation-cell"
                style={{
                  flex: '1 1 120px', minWidth: 0, background: ECON_SURFACE.raised, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: '5px',
                }}
              >
                <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
                  {name}
                </span>
                {/* The absent-figure glyph. Not a zero, and it carries no axis line. */}
                <span aria-label={t.noObservationTitle} style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 15px)', color: ECON_INK.reduced }}>
                  —
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
