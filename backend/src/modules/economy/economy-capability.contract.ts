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
 *   - `OFFICIAL_SOURCES` is a HOST-LOOKUP TABLE FOR PROVENANCE, by its own file
 *     header - not a source. Its entries are registered, and registration is
 *     neither activation nor rights approval. No entry is enabled.
 *
 *     THIS BULLET USED TO NAME FOUR INSTITUTIONS AND COUNT THEM, and every word
 *     of that was stale: the four named central banks and statistics offices
 *     were never in the registry, so the count described nothing. It is replaced
 *     by a qualitative claim, and the counting is done by the code below and by
 *     a test that reads the registry - see `cardinality` and `R-EA-LIN-4`. A
 *     count written into a comment cannot be kept true by anything.
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

/**
 * Keeps only ids that are actually in the registry.
 *
 * `R-EA-LIN-6` — THIS COMMENT USED TO SAY "so the table cannot drift from it", AND THAT
 * WAS HALF TRUE IN THE DANGEROUS DIRECTION. The ARRAY cannot drift. Everything WRITTEN
 * BESIDE the array drifted freely, and did: four ids were filtered away silently, and the
 * hand-written `state` and `evidence` next to them went on describing the four for a full
 * release cycle. A filter that silently discards is drift PREVENTION for the value and
 * drift CONCEALMENT for every claim about the value.
 *
 * So the filter stays, and nothing hand-written is allowed to describe its output. See
 * `deriveState` and `cardinality` below.
 */
function registered(...ids: readonly string[]): readonly string[] {
  return ids.filter((id) => REGISTERED.has(id));
}

/**
 * `R-EA-LIN-4` — THE STATE IS COMPUTED FROM THE ARRAY IT DESCRIBES, so the two cannot
 * disagree. This is the whole repair in one function.
 *
 * The union's own docstrings define the split and it is not a judgement call:
 * `UNAVAILABLE_SOURCE_DISABLED` means "a source IS registered that could supply it", and
 * `UNAVAILABLE_NO_PRODUCER` means "no producer exists in this deployment". An empty
 * candidate list is the second one. Written by hand, four rows claimed the first while
 * carrying an empty list.
 */
function deriveState(candidateSourceIds: readonly string[]): EconomyCapabilityState {
  return candidateSourceIds.length > 0 ? 'UNAVAILABLE_SOURCE_DISABLED' : 'UNAVAILABLE_NO_PRODUCER';
}

/**
 * The cardinality sentence, INTERPOLATED FROM THE DERIVED ARRAY — never typed out.
 *
 * `R-EA-LIN-4`: a cardinality assertion is derived and printed before it is written, or
 * it is not written. The prose beside each row is now generated from the same array the
 * row carries, which is why it cannot say "four" while the array holds none.
 */
export function candidateCardinalitySentence(ids: readonly string[]): string {
  if (ids.length === 0) return 'No candidate publisher is registered for this category.';
  return (
    `${ids.length} candidate publisher${ids.length === 1 ? ' is' : 's are'} registered for this ` +
    `category (${ids.join(', ')}); ${ids.length === 1 ? 'it is' : 'all are'} disabled.`
  );
}

const NO_SERIES_PRODUCER =
  'No numeric economic time-series producer exists at this baseline. Every registered official ' +
  'source ships enabled:false, and no provider returns indicator, period or vintage data.';

/**
 * The declared half of each row: everything that is a JUDGEMENT rather than a measurement.
 *
 * `state` and the cardinality half of `evidence` are absent here BY CONSTRUCTION — they
 * are not fields a table author can fill in wrongly, because they are not fields.
 */
interface EconomyCapabilityDeclaration {
  readonly category: EconomyCategory;
  readonly gapReason: EconomyFigureGapReason;
  readonly candidateSourceIds: readonly string[];
  /** Qualitative only. MUST NOT contain a count — `candidateCardinalitySentence()` supplies those. */
  readonly evidenceNote: string;
}

const ECONOMY_CAPABILITY_DECLARATIONS: readonly EconomyCapabilityDeclaration[] = [
  {
    category: 'INFLATION_CPI',
    gapReason: 'NO_PRODUCER',
    /* rw-nisr registered 2026-09-20 under the East Africa closeout; it is the honest CPI
       publisher for Rwanda and the artifact this round rehearsed against. The central
       banks stay out: registration is a provenance act, not a memory act (ruling G). */
    candidateSourceIds: registered('rw-nisr', 'rw-bnr', 'ke-cbk', 'pl-nbp', 'pl-gus'),
    evidenceNote:
      'Registration is not ingestion: the rights record does not resolve, host identity is not ' +
      'established to tier A, and no PO authorization by source id exists.',
  },
  {
    category: 'POLICY_RATE',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('rw-bnr', 'ke-cbk', 'pl-nbp'),
    evidenceNote:
      'A policy rate is a central-bank figure, and no central bank is registered. A statistics ' +
      'office is not a substitute publisher for it.',
  },
  {
    category: 'GROWTH_GDP',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('rw-nisr', 'pl-gus'),
    evidenceNote:
      'National accounts are published by a statistics office; the registered publisher is ' +
      'disabled, and its release is annual rather than monthly.',
  },
  {
    category: 'EMPLOYMENT',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('pl-gus'),
    evidenceNote:
      'No labour-market concept exists anywhere in the backend, independently of which publisher ' +
      'is registered.',
  },
  {
    category: 'PUBLIC_DEBT_FISCAL',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: [],
    evidenceNote: 'No finance ministry or debt-management office is registered for any country.',
  },
  {
    category: 'TRADE_EXTERNAL_BALANCE',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: [],
    evidenceNote:
      'No customs, revenue or trade-statistics authority is registered for any country.',
  },
  {
    category: 'FX_CONDITIONS',
    gapReason: 'NO_PRODUCER',
    candidateSourceIds: registered('rw-bnr', 'ke-cbk', 'pl-nbp'),
    evidenceNote:
      'Exchange-rate statistics are a central-bank publication, and no central bank is registered.',
  },
];

export const ECONOMY_CAPABILITY_FACTS: readonly EconomyCapabilityFact[] =
  ECONOMY_CAPABILITY_DECLARATIONS.map((d) => ({
    category: d.category,
    state: deriveState(d.candidateSourceIds),
    gapReason: d.gapReason,
    candidateSourceIds: d.candidateSourceIds,
    evidence: `${NO_SERIES_PRODUCER} ${candidateCardinalitySentence(d.candidateSourceIds)} ${d.evidenceNote}`,
  }));

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
