import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';

/**
 * PAF-R1.2 (P1) — the separation between what retrieval AIMED AT and what
 * the evidence SUPPORTS.
 *
 * THE CONTRACT SETTLES THIS, IT IS NOT A JUDGEMENT CALL.
 * `AnalysisRetrievalContext.city`'s own doc comment reads: "Present only
 * when country-aware retrieval was used AND **the query** resolved via a
 * curated city … rather than the country name itself." It is a
 * query-resolution field. It records the retrieval target. It says nothing
 * about what the retained reporting establishes.
 *
 * The country is different, and genuinely evidential: CountryNewsService
 * filters the retained pool through scoreCountryRelevance() at
 * `isRelevant >= 35`. Every article the reader sees passed a
 * country-relevance test. That is one level of geography, backed by the
 * retrieval filter itself.
 *
 * SO: evidence precision on this path is `country`, always — never `city`.
 * `evidencePrecision` is nevertheless a real field with a `city` member,
 * because the map must honour city precision correctly IF a future
 * per-source geographic signal ever supplies it. What this module will not
 * do is manufacture one: there is no code path from `context.city` to
 * `evidencePrecision: 'city'`, and a spec asserts it.
 */

export type EvidencePrecision = 'city' | 'country' | 'unresolved';

export interface GeographicEvidenceState {
  /**
   * The locality retrieval was aimed at, when the QUESTION named a curated
   * one. Display-only, and never a precision claim.
   */
  readonly queryTargetCity: string | null;
  /** Fuzzy-correction disclosure, carried through unchanged. */
  readonly matchedFrom: string | null;
  readonly canonicalLocation: string | null;

  /** The country the retained reporting supports. */
  readonly evidenceCountryName: string | null;
  readonly evidenceCountryCode: string | null;

  /** What the evidence actually establishes. See the doc comment. */
  readonly evidencePrecision: EvidencePrecision;

  /**
   * True when the question named a locality the evidence does not reach.
   * This is the state the rail must make visible rather than smooth over —
   * the Kigali and Musanze cases both land here.
   */
  readonly targetExceedsEvidence: boolean;
}

export const UNRESOLVED_GEOGRAPHIC_EVIDENCE: GeographicEvidenceState = {
  queryTargetCity: null,
  matchedFrom: null,
  canonicalLocation: null,
  evidenceCountryName: null,
  evidenceCountryCode: null,
  evidencePrecision: 'unresolved',
  targetExceedsEvidence: false,
};

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function buildGeographicEvidenceState(
  context: AnalysisRetrievalContext | undefined,
): GeographicEvidenceState {
  if (context === undefined) return UNRESOLVED_GEOGRAPHIC_EVIDENCE;

  const countryName = nonEmpty(context.countryName);
  const countryCode = nonEmpty(context.countryCode);
  const queryTargetCity = nonEmpty(context.city);

  // The ONLY place precision is decided. `queryTargetCity` is deliberately
  // not consulted: a retrieval target cannot promote evidence precision.
  const evidencePrecision: EvidencePrecision = countryCode === null ? 'unresolved' : 'country';

  return {
    queryTargetCity,
    matchedFrom: nonEmpty(context.matchedFrom),
    canonicalLocation: nonEmpty(context.canonicalLocation),
    evidenceCountryName: countryName,
    evidenceCountryCode: countryCode,
    evidencePrecision,
    targetExceedsEvidence: exceedsEvidence(queryTargetCity, evidencePrecision),
  };
}

/**
 * A named locality outranks the evidence whenever the question supplied one
 * and the evidence did not reach city level.
 *
 * Written as a function taking the WIDE type on purpose. Inline, TypeScript
 * narrows `evidencePrecision` to `'country' | 'unresolved'` and rejects the
 * comparison against `'city'` as unreachable — which is the compiler
 * independently confirming this module's central claim. Keeping the general
 * form here means the rule stays correct if a future per-source signal ever
 * makes `'city'` reachable, instead of silently hard-coding today's ceiling.
 */
export function exceedsEvidence(
  queryTargetCity: string | null,
  precision: EvidencePrecision,
): boolean {
  return queryTargetCity !== null && precision !== 'city';
}

/** Display casing for a canonical lowercase place key. Never transliterates. */
export function formatPlace(place: string): string {
  return place
    .split(' ')
    .map((word) => (word.length === 0 ? word : word[0].toLocaleUpperCase() + word.slice(1)))
    .join(' ');
}
