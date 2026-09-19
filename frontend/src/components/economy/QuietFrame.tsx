import type { JSX } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { STATEMENT_MAX_CH } from '@/lib/economy/economyConfig';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART VI · ECONOMY — THE DATA-NEUTRAL FRAME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING THIS FILE EXISTS TO SATISFY.
 *
 * *"Visual acceptance must not wait for live data. Missing data may be visually silenced
 * so the Product Owner can inspect and approve the intended final dashboard. This is not
 * permission to fabricate observations."*
 *
 * Before this file, the Economy frame answered an absent producer by REPLACING its
 * primary substrate with a no-observation panel: a 20px headline, three paragraphs of
 * explanation and a second copy of the indicator structure, sized `flex: 1 1 auto` so it
 * absorbed the whole region. Everything it said was true, and the composite effect was a
 * page about our plumbing rather than the dashboard we intend to ship. Missing data
 * dominated.
 *
 * So the geometry stays and the values go quiet. Every component here is the FINAL panel
 * a real observation will occupy, rendered with the absent glyph in the slot where the
 * figure goes. Nothing here computes, derives, formats or infers a number, and there is
 * no branch that can produce one: these components take no value parameter at all.
 *
 * ── WHY `—` AND NOT A SKELETON ────────────────────────────────────────────
 *
 * A shimmering grey bar shaped like a value says *a value is arriving*. Nothing is
 * arriving. `—` is the absent-figure glyph the accepted Economy surface already uses
 * (`DataAvailability` drew it in exactly this role), it is not a zero, and it carries no
 * axis line, no direction arrow and no unit — because release status, value kind and
 * freshness all describe an OBSERVATION, and there is none.
 *
 * ── THE COPY IS BORROWED, NEVER AUTHORED ──────────────────────────────────
 *
 * Every word rendered by this file comes from `economyStrings`, which the localisation
 * lane authored across all seven display locales. This lane authors no translation, so it
 * introduces no string key: where a label is needed it is either an existing authored
 * value or a GOVERNED DIMENSION NAME rendered as a machine-readable identifier, which is
 * the same token in every language.
 */

const microLabel = {
  fontFamily: ECON_MONO,
  fontSize: 'max(var(--ar-fs-min, 0px), 10px)',
  letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))',
  textTransform: 'uppercase' as const,
  color: ECON_INK.label,
};

/** The absent-figure glyph. Not a zero, not a placeholder, and never formatted. */
const ABSENT = '—';

/* ───────────────────────────────────────────────────────────────────────────
 * REGION C · the statement slot
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * The intelligence statement is DERIVED from the triad and the change state. With no
 * observation there is nothing to derive it from, so the slot renders its own absence at
 * the statement's own size and measure — the reader sees where the finding will sit.
 *
 * IT PRINTS THE GLYPH, NOT THE WORDS, AND THAT IS A CORRECTION MADE FROM A CAPTURE.
 *
 * The first build put `noObservationTitle` here. In the desktop capture the phrase *no
 * observation data* then appeared four times on one screen — the header badge, this slot,
 * the resident note's title and the note's sentence — and repetition is its own kind of
 * domination. The activation offers both forms, *"use `—` or a restrained `Awaiting
 * verified data`"*, and at 24px in the page's most prominent slot the glyph is the
 * restrained one. The words survive where they are read once: on the badge, and in the
 * note directly beneath, which is what tells a reader what the glyph means.
 */
export function QuietStatement({ locale, sizePx = 24 }: {
  locale: EconomyLocale; sizePx?: number;
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <p
      data-econ="statement"
      data-econ-quiet="statement"
      style={{
        margin: 0, fontSize: `${sizePx}px`, lineHeight: 'var(--ar-lh, 1.3)',
        letterSpacing: 'calc(-0.012em * var(--ar-ls-mul, 1))', fontWeight: 500,
        color: ECON_INK.reduced, maxWidth: `${STATEMENT_MAX_CH}ch`,
      }}
    >
      <span data-econ="figure-absent" aria-label={t.noObservationTitle}>{ABSENT}</span>
    </p>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION C · the triad slot
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * ACTUAL / EXPECTED / PREVIOUS, in the accepted geometry, with the figure withheld.
 *
 * The SURPRISE cell is deliberately absent rather than dashed. Surprise is DERIVED from
 * actual against expected; a cell for a derivation of two absences is a cell for nothing,
 * and Part VI's own rule — *"a chart never appears merely because data exists"* — cuts the
 * same way when it does not.
 *
 * No axes line is drawn beneath any cell. `FigureAxesLine` renders release status, value
 * kind and freshness; all three describe an observation, and an axis chip with nothing
 * behind it is the same untruth in smaller type.
 */
export function QuietTriad({ locale, cellBasisPx = 130 }: {
  locale: EconomyLocale; cellBasisPx?: number;
}): JSX.Element {
  const t = economyStrings(locale);
  const cell = {
    flex: `1 1 ${cellBasisPx}px`, background: ECON_SURFACE.raised,
    padding: '11px 13px', display: 'flex', flexDirection: 'column' as const, gap: '5px',
  };
  return (
    <div
      data-econ="triad"
      data-econ-quiet="triad"
      data-selected="false"
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '1px', background: ECON_LINE.hairline,
        border: `1px solid ${ECON_LINE.hairline}`,
      }}
    >
      {([['triad-actual', t.actual], ['triad-expected', t.expected], ['triad-previous', t.previous]] as const)
        .map(([hook, label]) => (
          <div key={hook} style={cell} data-econ={hook}>
            <span style={microLabel}>{label}</span>
            <span
              data-econ="figure-absent"
              aria-label={t.noObservationTitle}
              style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 26px)', fontWeight: 500, color: ECON_INK.reduced }}
            >
              {ABSENT}
            </span>
          </div>
        ))}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION C · the plot well
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * THE SERIES WELL, WITH NO SERIES IN IT — AND NO LINE DRAWN ACROSS IT.
 *
 * `SeriesChart` returns `null` on an empty history, which is correct and is why the
 * region used to collapse. This is the panel that holds its place: the same well, the
 * same caption row, the same window label, and inside it nothing but the absent glyph.
 *
 * NO BASELINE, NO AXIS, NO GRIDLINES, NO FLAT LINE AT ZERO. A horizontal rule across an
 * empty plot is read as a series that did not move, which is a claim about the economy.
 * The diagonal hatch is the same inert fill the accepted mini-map and corridor wells use
 * to mean *this is a plot area, and it is not plotting*.
 */
export function QuietPlot({ locale, caption, windowMonths }: {
  locale: EconomyLocale; caption: string; windowMonths: number;
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <figure
      data-econ="series-chart"
      data-econ-quiet="plot"
      data-window-months={windowMonths}
      data-bars={0}
      style={{
        margin: 0, flex: '1 1 auto', minHeight: '120px', border: `1px solid ${ECON_LINE.structure}`,
        background: ECON_SURFACE.panel, padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
      }}
    >
      <figcaption style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))' }}>
        {t.seriesLabel} · {caption} · {windowMonths}M
      </figcaption>
      <div
        data-econ="plot-well"
        role="img"
        aria-label={t.noObservationTitle}
        style={{
          flex: '1 1 auto', minHeight: '80px',
          backgroundImage: `repeating-linear-gradient(135deg, ${ECON_SURFACE.raised} 0 7px, ${ECON_SURFACE.panel} 7px 14px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span
          data-econ="figure-absent"
          style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 18px)', color: ECON_INK.reduced }}
        >
          {ABSENT}
        </span>
      </div>
    </figure>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION D · geography and comparison
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * THE GOVERNED GEOGRAPHY DISTINCTION, RENDERED AS THE CONTRACT HOLDS IT.
 *
 * Two accepted register entries decide what this region may say, and they agree:
 *
 *   MAIN-ECONOMY-LINEAGE-PROMOTION-CL1-R1 — *"Poland/EU/euro-area (`geo` stays an ordinary
 *   pinned dimension, so `geo=PL` and `geo=EA20` are different keys by construction)"*
 *
 *   G-ECONOMY-ALPHA-PRODUCER-CONVERGENCE-R2 — *"`geo=PL` only — no EU or euro-area
 *   aggregate may stand in for Poland."*
 *
 * So the distinction is not a preference a comparison control may blur: it is an IDENTITY
 * rule. Three geographies are three different series keys, and the affordance is built so
 * that no reading of it can present one as another. Each key is its own slot, each slot
 * carries its own absent figure, and NOTHING here aggregates, substitutes or defaults.
 *
 * THE LABELS ARE THE PINNED DIMENSION VALUES, NOT TRANSLATED NAMES. `PL`, `EU27_2020` and
 * `EA20` are the publisher's own codes. Rendering the codes rather than "Poland" and
 * "Euro area" is not terseness for its own sake: a translated display name is a second
 * spelling of an identity key, and a second spelling is where a substitution becomes
 * possible. It also means this region introduces no string a translator must author.
 *
 * NO SELECTION STATE. A selected geography with no observation behind it implies the
 * other two have observations that were not selected. Every slot is equally unbound, and
 * the region says so by giving none of them a selected treatment.
 *
 * THE KEYS ARE PLAIN TEXT, NOT `MachineReadable`, AND THAT IS A GUARD'S DECISION.
 *
 * `econContract.spec.ts` asserts that no Economy file matches `/arabicRunPolicy|runBoundary/`
 * — Economy consumes the shared LANG-UI-7 contract and imports nothing from the typography
 * lane. The first draft of this file wrapped the keys in `MachineReadable` and the guard bit,
 * correctly. Economy's own precedent is plain text for an identifier: `attentionRank` is
 * printed that way in both screens. The bidi isolation `MachineReadable` provides is also
 * moot here — `SELECTABLE_LOCALES` is EN and PL, so no RTL locale is served, and these
 * tokens are Latin letters and digits with no punctuation to reorder. If an RTL display
 * locale is ever offered, the isolation belongs in the route's `ScriptRun`, which already
 * wraps the frame, and not in an import this contract forbids.
 */
export const ECONOMY_GEOGRAPHY_KEYS: readonly string[] = ['PL', 'EU27_2020', 'EA20'];

export function GeographyKeys({ locale }: { locale: EconomyLocale }): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div
      data-econ="geography-keys"
      style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}
    >
      <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', textTransform: 'none', letterSpacing: 'calc(0.06em * var(--ar-ls-mul, 1))' }}>
        geo
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', background: ECON_LINE.hairline, minWidth: 0 }}>
        {ECONOMY_GEOGRAPHY_KEYS.map((key) => (
          <div
            key={key}
            data-econ="geography-key"
            data-geo={key}
            data-bound="false"
            style={{
              flex: '1 1 100px', minWidth: 0, background: ECON_SURFACE.raised,
              padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '4px',
            }}
          >
            <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', textTransform: 'none', letterSpacing: 'calc(0.04em * var(--ar-ls-mul, 1))', color: ECON_INK.tertiary }}>
              {key}
            </span>
            <span
              data-econ="figure-absent"
              aria-label={t.noObservationTitle}
              style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 14px)', color: ECON_INK.reduced }}
            >
              {ABSENT}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION E · period and frequency
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * PERIOD AND FREQUENCY CONTEXT, AND THE ONE THING IT IS ALLOWED TO ASSERT.
 *
 * `productionSubject.ts` states no cadence, deliberately, and its comment says why: the
 * shared contract requires cadence ABSENT rather than guessed, and a uniform MONTHLY was
 * measurably wrong for two of the six structural series. The contract's own resolution
 * for an absent cadence is the freshness member `UNDETERMINED`, which the localisation
 * lane authored in all seven locales as *"Cadence unknown"*.
 *
 * So this region prints the governed dimension name `freq`, the absent glyph for the
 * period, and that authored label. It asserts nothing a publisher has not published, and
 * it is the honest reason the freshness axis is silent everywhere else on the frame.
 */
export function PeriodContext({ locale }: { locale: EconomyLocale }): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div
      data-econ="period-context"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'baseline', minWidth: 0 }}
    >
      <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', textTransform: 'none', letterSpacing: 'calc(0.06em * var(--ar-ls-mul, 1))' }}>
        freq
      </span>
      <span
        data-econ="figure-absent"
        aria-label={t.noObservationTitle}
        style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', color: ECON_INK.reduced }}
      >
        {ABSENT}
      </span>
      <span
        data-econ="cadence"
        data-freshness="UNDETERMINED"
        style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', color: ECON_INK.tertiary }}
      >
        {t.freshness.UNDETERMINED}
      </span>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 * REGION F · provenance and source disclosure
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * WHERE A FIGURE WOULD HAVE COME FROM — RESIDENT, SUBORDINATE, AND ONE LINE LONG.
 *
 * Part VI's zoning model puts sources in the *"not resident, always reachable"* set, so a
 * source PANEL on the first viewport would be a redesign. What is resident is the slot: a
 * reader can see that this dashboard attributes its figures, and reach the explanation
 * without leaving the page.
 *
 * `sharedObservationBase` is the authored heading for exactly this idea — the base every
 * figure on the frame is read against — and it carries the absent glyph for the same
 * reason every other slot does. The control beside it opens the SOURCES drawer, which is
 * where the release-status / value-kind / freshness explanation now lives.
 *
 * NO SOURCE NAME IS PRINTED HERE, not even a greyed one. Naming a publisher beside an
 * absent figure is the one move on this region that would assert something untrue: it
 * would say this figure came from that publisher.
 */
export function ProvenanceLine({ locale, onOpenSources }: {
  locale: EconomyLocale; onOpenSources: () => void;
}): JSX.Element {
  const t = economyStrings(locale);
  return (
    <button
      type="button"
      data-econ="provenance-line"
      onClick={onOpenSources}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline',
        minWidth: 0, textAlign: 'start', cursor: 'pointer',
        border: `1px solid ${ECON_LINE.border}`, background: 'transparent',
        padding: '8px 11px', alignSelf: 'flex-start',
      }}
    >
      <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', color: ECON_INK.tertiary }}>
        {t.sharedObservationBase}
      </span>
      <span
        data-econ="figure-absent"
        aria-label={t.noObservationTitle}
        style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', color: ECON_INK.reduced }}
      >
        {ABSENT}
      </span>
      <span aria-hidden="true" style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', color: ECON_INK.label }}>→</span>
    </button>
  );
}
