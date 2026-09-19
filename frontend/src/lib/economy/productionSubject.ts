import type { EconomySubject, FigureSlot, Series } from './types';
import { seriesId, seriesName } from './types';
import type { EconomyCategory } from '@globalnews-ai/shared';
import { economyGap } from './economyAdapters';

/**
 * ECON-UI-1 — THE PRODUCTION-SHAPED SUBJECT UNDER ECON-DATA-1.
 *
 * ECON-DATA-1's measured verdict is that NO CURRENT NUMERIC ECONOMIC TIME-SERIES PRODUCER
 * EXISTS. This module is what the production route renders instead of figures.
 *
 * IT CONTAINS NO NUMBERS. Not one. Every observation value is `null`, every history is
 * empty, every triad is null, and there is no attention row — because an attention row
 * carries `attentionRank`, `attentionRank` comes from data, and A9 forbids this lane from
 * calculating, normalizing, approximating or ranking it. With no producer there is no
 * rank, so there is no row.
 *
 * WHAT IT IS NOT:
 *   - it is not a fixture. Fixtures live in `fixtures.ts`, carry deterministic values, and
 *     are reachable only from the self-declaring /economy/fixture-demo route;
 *   - it is not a provider, a scraper or a synthetic data source. It fetches nothing,
 *     computes nothing and derives nothing;
 *   - it is not a placeholder for numbers that will be filled in here later. When a real
 *     producer exists it supplies the subject and this module stops being rendered.
 *
 * WHAT IT IS: the STRUCTURE of a country economy surface — the series this surface will
 * report, named, so a reader can see what is absent rather than seeing an empty page. The
 * labels are generic economic indicator names, not any country's published figures.
 *
 * The Watch basket is present and DECOMPOSED (DEP-3): a country economy is a basket of
 * named members, never one aggregate economy score. Its members are disabled, because
 * nothing can be monitored while no producer emits releases.
 */

/**
 * ECON-UI-CONTRACT-ADAPT-1 — ABSENCE IS NOW A GAP, WITH THE RIGHT REASON.
 *
 * Previously this built an "observation-shaped hole": a real observation object carrying
 * `value: null` and `freshness: 'UNAVAILABLE'`. The shared contract removes both of those
 * moves, and it is a better fit for what this module actually represents.
 *
 * The reason is `NO_PRODUCER` — a member the old UI vocabulary DID NOT HAVE. Its three reasons
 * were NOT_COLLECTED, WITHHELD and DISCONTINUED, none of which is true here: the figure was not
 * withheld by anyone and nothing was discontinued. ECON-DATA-1's measured verdict is that no
 * producer exists at all, and the contract can now say exactly that.
 */
function absent(seriesId: string): FigureSlot {
  return economyGap(seriesId, `${seriesId}:no-period`, 'NO_PRODUCER');
}

function structuralSeries(id: string, name: string, shortLabel: string, unit: string, category: EconomyCategory): Series {
  return {
    model: {
      seriesId: id,
      label: name,
      economyIso2: 'ZZ',
      unit,
      category,
      /*
        ALPHA-ECONOMY-READINESS-R1 — NO CADENCE IS STATED, BECAUSE NO PUBLISHER STATES ONE.

        This previously read `cadence: 'MONTHLY'` on all six structural series. That is the same
        defect the assessment correction below removed: a real finding asserted over zero
        evidence. The shared contract says so twice — on the type, "The publisher's stated
        release cadence. ABSENT rather than guessed", and on the field itself, "Absent rather
        than guessed — freshness is UNDETERMINED without it".

        It was also WRONG, measurably, and not merely unfounded. Against the resolved Eurostat
        series catalogue two of these six are not monthly at all: GROWTH_GDP (`namq_10_gdp`) is
        QUARTERLY and PUBLIC_DEBT_FISCAL (`gov_10dd_edpt1`) is ANNUAL. A uniform MONTHLY would
        have made a healthy annual debt figure read as overdue the moment a producer was wired —
        the freshness false-alarm the gap-closure round named as a blocking prerequisite.

        Omitting it is the supported state, not a hole: freshness resolves to UNDETERMINED,
        which the contract defines as "we hold no cadence for this Series, so age cannot be
        judged". That is exactly true of a subject bound to no economy (`economyIso2: 'ZZ'`)
        and no producer. A real cadence arrives with the Series a real producer supplies.
      */
    },
    shortLabel,
    // FLAT is the no-movement value, and the arrow is suppressed entirely while observations
    // are absent — a direction between two absent figures is not a direction.
    direction: 'FLAT',
    latest: absent(id),
    triad: null,
    history: [],
  };
}

const SERIES: readonly Series[] = [
  structuralSeries('s-cpi', 'Consumer price index', 'CPI', '%', 'INFLATION_CPI'),
  structuralSeries('s-policy-rate', 'Policy rate', 'POLICY RATE', '%', 'POLICY_RATE'),
  structuralSeries('s-gdp', 'Gross domestic product', 'GDP', '%', 'GROWTH_GDP'),
  structuralSeries('s-fx', 'Exchange rate', 'FX', '', 'FX_CONDITIONS'),
  structuralSeries('s-trade', 'Trade balance', 'TRADE', '', 'TRADE_EXTERNAL_BALANCE'),
  structuralSeries('s-debt', 'Public debt', 'DEBT', '%', 'PUBLIC_DEBT_FISCAL'),
];

export const PRODUCTION_SHAPED_SUBJECT: EconomySubject = {
  id: 'economy-unbound',
  kind: 'COUNTRY',
  name: 'Economy',
  scopeLabel: 'No subject bound',
  contextLabel: 'No observation source',
  /*
    ECON-UI-ASSESSMENT-R1 — THERE IS NO ASSESSMENT HERE, AND THAT IS THE HONEST ANSWER.

    This previously read `changeState: 'NO_MATERIAL_CHANGE'` with `computedFromObservationIds: []`.
    That asserted a real finding — one of the two states this runtime can actually produce — over
    zero evidence, in a deployment whose measured capability is NO_OBSERVATION_SOURCE. Nothing
    downstream could have told it apart from a genuine "no material change".

    `model: null` says what is true: no producer formed an assessment, so none exists. The reason
    travels with the absence, so a later consumer cannot read silence as a default.
    `assessmentChangeState()` therefore returns null here, by construction rather than by care.
  */
  assessment: {
    id: 'a-unavailable',
    subjectId: 'economy-unbound',
    model: null,
    absentReason: 'NO_OBSERVATION_SOURCE',
    /*
      Presentation only. It asserts nothing about any economy and names no state; the header
      withholds it and prints the no-observation body instead.
    */
    statement: 'No observation source is connected.',
    confidence: 'LOW',
  },

  substrate: 'DATA_DOMINANT',
  primarySeries: null,
  corridor: null,
  indicators: SERIES,
  // A9: no rank exists without a producer, so no row is invented to hold one.
  attention: [],
  watch: {
    id: 'w-unbound',
    label: 'Country economy basket',
    // DECOMPOSED. Six named members, never one aggregate "economy score".
    members: SERIES.map((s) => ({ subjectId: seriesId(s), label: seriesName(s), enabled: false })),
    triggers: [],
  },
  policyLane: [],
};
