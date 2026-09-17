import {
  type EconomyCategory,
  type EconomyFigureGapReason,
  type EconomyObservationAvailability,
  economyHasObservationSource,
} from '@globalnews-ai/shared';
import { OFFICIAL_SOURCES } from '../official-sources/official-source-registry';

/**
 * ECON-DATA-CONTRACT-ADAPT-1 - WHAT THIS DEPLOYMENT CAN HONESTLY SUPPLY.
 *
 * STAYS BACKEND-OWNED, by Main's ruling, and the reason is worth stating: a
 * MEASURED DEPLOYMENT STATE IS NOT A CONTRACT. The shared contract declares the
 * availability VOCABULARY (`OBSERVED | NO_OBSERVATION_SOURCE | FIXTURE`) and
 * the gap-reason vocabulary; which state this deployment is in is a fact about
 * providers, environment and transport, and those live here.
 *
 * -- THE MEASURED STATE, RE-MEASURED ON THE STAGED BASELINE ----------------
 *
 * `NO_OBSERVATION_SOURCE`. Every Economy category is unavailable for production
 * values, and the reason is the same for all of them: THERE IS NO NUMERIC
 * ECONOMIC TIME-SERIES PRODUCER IN THIS CODEBASE.
 *
 *   - `OFFICIAL_SOURCES` names four institutions - National Bank of Rwanda,
 *     Central Bank of Kenya, Narodowy Bank Polski, Glowny Urzad Statystyczny.
 *     ALL FOUR ship `enabled: false` and `ingestionMethod: 'none'`, and each
 *     entry's own note says "Ingestion not implemented or enabled." Measured:
 *     4 entries, 0 enabled, 0 with an ingestion method. The registry is a
 *     HOST-LOOKUP table for provenance, by its own file header - not a source.
 *
 *   - The providers are news (GNews, GDELT DOC, RSS, mock), signals (GDELT,
 *     Event Registry) and analysis (OpenAI, mock). None returns a statistical
 *     series; none has an indicator, period or vintage concept.
 *
 *   - The words "inflation", "gdp", "unemployment" and "trade" DO appear in the
 *     codebase - in `article-entities.util.ts`, `classify-category.util.ts` and
 *     `detect-analytical-domains.util.ts`. They are KEYWORD LISTS THAT CLASSIFY
 *     NEWS TEXT. A classifier that recognises the word "inflation" in a
 *     headline is not a source of inflation data, and treating it as one is the
 *     exact fabrication this gate forbids.
 *
 * `FIXTURE` is in the shared vocabulary and is NOT this deployment's state:
 * nothing here serves fixtures as observations. Naming it and not claiming it
 * is the point of a declared vocabulary.
 *
 * WHAT WOULD CHANGE IT. Not this module. Activating an official source is a
 * deployment decision with its own authorization, exactly as it is for GDELT
 * DOC, and this lane is forbidden from activating providers or adding secrets.
 */

/**
 * This deployment's measured availability. One value, not a per-category guess:
 * the absence is systemic, not category-specific.
 */
export const ECONOMY_OBSERVATION_AVAILABILITY: EconomyObservationAvailability =
  'NO_OBSERVATION_SOURCE';

/** True only when a real producer exists. Delegates to the shared rule. */
export function economyDeploymentHasObservationSource(): boolean {
  return economyHasObservationSource(ECONOMY_OBSERVATION_AVAILABILITY);
}

export type EconomyCapabilityState =
  /** A producer exists and can supply observations. Nothing is AVAILABLE today. */
  | 'AVAILABLE'
  /** No producer exists in this deployment. */
  | 'UNAVAILABLE_NO_PRODUCER'
  /** A source is registered that could supply it, but ingestion is not enabled. */
  | 'UNAVAILABLE_SOURCE_DISABLED';

export interface EconomyCapabilityFact {
  readonly category: EconomyCategory;
  readonly state: EconomyCapabilityState;
  /**
   * The SHARED gap reason a surface must render for this category's figures.
   * Both unavailable states map to `NO_PRODUCER`, because both are facts about
   * US rather than about the publisher - the publisher collects and releases
   * these figures perfectly well.
   */
  readonly gapReason: EconomyFigureGapReason;
  /**
   * Registry ids of institutions that WOULD be the honest publisher for this
   * category, when any are registered. Naming them is not claiming them: every
   * one is disabled, and `state` says so.
   */
  readonly candidateSourceIds: readonly string[];
  /** Why, in terms of what was measured. Never a placeholder. */
  readonly evidence: string;
}

const REGISTERED = new Set(OFFICIAL_SOURCES.map((s) => s.id));

/** Only ids that are actually in the registry, so the table cannot drift from it. */
function registered(...ids: readonly string[]): readonly string[] {
  return ids.filter((id) => REGISTERED.has(id));
}

const NO_SERIES_PRODUCER =
  'No numeric economic time-series producer exists at this baseline. The registered central ' +
  'banks and statistics offices are all enabled:false / ingestionMethod:none, and no provider ' +
  'returns indicator, period or vintage data.';

export const ECONOMY_CAPABILITY_FACTS: readonly EconomyCapabilityFact[] = [
  {
    category: 'INFLATION_CPI',
    state: 'UNAVAILABLE_SOURCE_DISABLED',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('rw-bnr', 'ke-cbk', 'pl-nbp', 'pl-gus'),
    evidence:
      NO_SERIES_PRODUCER +
      ' Four candidate publishers are registered for CPI and monetary statistics; all disabled.',
  },
  {
    category: 'POLICY_RATE',
    state: 'UNAVAILABLE_SOURCE_DISABLED',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('rw-bnr', 'ke-cbk', 'pl-nbp'),
    evidence:
      NO_SERIES_PRODUCER +
      ' The three registered central banks are the honest publishers of a policy rate; all disabled.',
  },
  {
    category: 'GROWTH_GDP',
    state: 'UNAVAILABLE_SOURCE_DISABLED',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('pl-gus'),
    evidence:
      NO_SERIES_PRODUCER +
      ' Only one national statistics office is registered, and it is disabled. No national ' +
      'accounts publisher is registered for Rwanda or Kenya at all.',
  },
  {
    category: 'EMPLOYMENT',
    state: 'UNAVAILABLE_NO_PRODUCER',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('pl-gus'),
    evidence:
      NO_SERIES_PRODUCER +
      ' Labour-force statistics have no registered publisher beyond the single disabled ' +
      'statistics office, and no labour-market concept exists anywhere in the backend.',
  },
  {
    category: 'PUBLIC_DEBT_FISCAL',
    state: 'UNAVAILABLE_NO_PRODUCER',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: [],
    evidence:
      NO_SERIES_PRODUCER +
      ' No finance ministry or debt-management office is registered for any country.',
  },
  {
    category: 'TRADE_EXTERNAL_BALANCE',
    state: 'UNAVAILABLE_NO_PRODUCER',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: [],
    evidence:
      NO_SERIES_PRODUCER +
      ' No customs, revenue or trade-statistics authority is registered for any country.',
  },
  {
    category: 'FX_CONDITIONS',
    state: 'UNAVAILABLE_SOURCE_DISABLED',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('rw-bnr', 'ke-cbk', 'pl-nbp'),
    evidence:
      NO_SERIES_PRODUCER +
      ' The registered central banks publish exchange-rate statistics - the National Bank of ' +
      'Rwanda entry says so explicitly - but all are disabled and no rate is retrieved.',
  },
];

export function economyCapability(category: EconomyCategory): EconomyCapabilityFact {
  const fact = ECONOMY_CAPABILITY_FACTS.find((f) => f.category === category);

  if (!fact) {
    throw new Error(`ECON-CAPABILITY-1: no capability fact declared for category ${category}.`);
  }

  return fact;
}

/** Categories with a live producer. Empty at this baseline, asserted by test. */
export const AVAILABLE_ECONOMY_CATEGORIES: readonly EconomyCategory[] =
  ECONOMY_CAPABILITY_FACTS.filter((f) => f.state === 'AVAILABLE').map((f) => f.category);

/**
 * GUARD - refuse to serve a value for a category with no producer.
 *
 * This is the executable form of "do not fabricate data". A caller that
 * acquires an observation for an unavailable category has got it from somewhere
 * this module cannot account for, and the honest response is to stop rather
 * than to render it.
 */
export function assertCategoryProducible(category: EconomyCategory): void {
  const fact = economyCapability(category);

  if (fact.state !== 'AVAILABLE') {
    throw new Error(
      `ECON-CAPABILITY-2: ${category} is ${fact.state} at this baseline and must be rendered ` +
        `as a ${fact.gapReason} gap, not populated. ${fact.evidence}`,
    );
  }
}
