/**
 * ════════════════════════════════════════════════════════════════════════════
 * ECONOMY ROUTE ELIGIBILITY — WHAT MUST EXIST BEFORE `/economy` OPENS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-ECONOMY-LINEAGE-PROMOTION-CL1-R1, Objective C.
 * Home: `shared/src/economy/route-eligibility.ts`.
 *
 * `MAIN-ECONOMY-LINEAGE-ROUTE-R1` stated seven conditions in prose and claimed they were
 * all machine-checkable. This is that claim made good: the conditions become a closed
 * vocabulary and one predicate, so "is /economy eligible" stops being a judgement someone
 * makes while reading a document.
 *
 * ── WHAT THIS FILE IS NOT ──────────────────────────────────────────────────
 *
 * It does not MEASURE anything, and it must not. `economy-capability.contract.ts` states
 * the rule this file obeys: "A MEASURED DEPLOYMENT STATE IS NOT A CONTRACT." Which
 * observations exist, which sources are enabled, which copy is translated — those are
 * facts about a deployment and they live in the backend. This file declares what the
 * facts must BE, and takes them as an argument.
 *
 * ── THE DISTINCTION OBJECTIVE C EXISTS TO DRAW ─────────────────────────────
 *
 * G's P-2 asks to "register Eurostat in OFFICIAL_SOURCES so E-4 can hold". Registration is
 * necessary and is NOT sufficient, and the codebase already proves the difference:
 * canonical seeds FOUR institutions — National Bank of Rwanda, Central Bank of Kenya,
 * Narodowy Bank Polski, Główny Urząd Statystyczny — and every one of them ships
 * `enabled: false`, `ingestionMethod: 'none'`. Measured: 4 registered, 0 enabled, 0 with an
 * ingestion method. If registration opened the route, canonical would have been
 * route-eligible with four sources and no data.
 *
 * The registry's own file header calls it "a HOST-LOOKUP table for provenance — not a
 * source". Three different things are being conflated when a route is opened on it:
 *
 *   REGISTERED   the institution is known, so a figure attributed to it can be resolved
 *                to a host and an authority class. Says nothing about permission or data.
 *   ACTIVATED    `enabled: true`, an `ingestionMethod` that is not `'none'`, and a
 *                recorded E-5 rights grade naming its instrument. PERMISSION to fetch.
 *   ADMITTED     bytes were fetched, passed the canonical admission evaluator, were
 *                retained, parsed, and produced an observation that satisfies
 *                `economyObservationIsPublishable`. EVIDENCE.
 *
 * A route may open on the third. The first two are prerequisites of the third and are
 * never a substitute for it. **Frontend readiness is not on this list at all** — every
 * visual item was already true when the route was correctly shut.
 */

/**
 * The seven conditions, closed. `E-4` is split because registration and activation were
 * the two halves being conflated, and a condition that can be half-true is a condition
 * that gets reported as true.
 */
export const ECONOMY_ROUTE_CONDITIONS = [
  /** E-1 · At least one observation satisfies `economyObservationIsPublishable`. */
  'E1_PUBLISHABLE_OBSERVATION',
  /** E-2 · Every figure the surface publishes carries its lineage. No exceptions, no partial rows. */
  'E2_LINEAGE_ON_EVERY_FIGURE',
  /** E-3 · Every published figure's vintage basis is the one its retrieval supports. */
  'E3_HONEST_VINTAGE_BASIS',
  /** E-4a · The source is REGISTERED in the official-source registry. */
  'E4A_SOURCE_REGISTERED',
  /** E-4b · The source is ACTIVATED: enabled, an ingestion method, and a recorded E-5 grade with an instrument. */
  'E4B_SOURCE_ACTIVATED_WITH_RIGHTS',
  /** E-5 · The gap path is preserved: a missing figure still renders as a stated gap, never as zero, blank or omitted. */
  'E5_GAP_PATH_PRESERVED',
  /** E-6 · No provider execution and no AI execution on page load. */
  'E6_NO_EXECUTION_ON_LOAD',
  /** E-7 · Dashboard copy exists in EN and PL. */
  'E7_BILINGUAL_COPY',
] as const;

export type EconomyRouteCondition = (typeof ECONOMY_ROUTE_CONDITIONS)[number];

/**
 * The measured facts, supplied by the deployment. Every field is something a backend can
 * count or observe; none is a judgement.
 */
export interface EconomyRouteEvidence {
  /**
   * How many observations currently satisfy `economyObservationIsPublishable`.
   * NOT "how many figures the page has slots for".
   */
  readonly publishableObservationCount: number;
  /** Published figures that carry no lineage. Must be zero. */
  readonly publishedFiguresWithoutLineage: number;
  /** Published figures whose declared vintage basis is not the one their retrieval supports. Must be zero. */
  readonly figuresWithOverstatedVintage: number;
  /** Source ids registered in the official-source registry. */
  readonly registeredSourceIds: readonly string[];
  /** Source ids that are enabled, have an ingestion method, and carry a recorded rights grade with an instrument. */
  readonly activatedSourceIds: readonly string[];
  /** Whether a figure with no observation still renders as a stated gap. */
  readonly gapPathPreserved: boolean;
  /** Whether page load executes any provider or any AI. Must be false. */
  readonly executesOnLoad: boolean;
  /** Language tags in which the dashboard copy exists. */
  readonly copyLanguages: readonly string[];
}

/** The conditions this evidence does NOT satisfy. Empty means eligible. */
export function economyRouteBlockers(
  evidence: EconomyRouteEvidence,
): readonly EconomyRouteCondition[] {
  const blockers: EconomyRouteCondition[] = [];

  if (evidence.publishableObservationCount < 1) blockers.push('E1_PUBLISHABLE_OBSERVATION');
  if (evidence.publishedFiguresWithoutLineage !== 0) blockers.push('E2_LINEAGE_ON_EVERY_FIGURE');
  if (evidence.figuresWithOverstatedVintage !== 0) blockers.push('E3_HONEST_VINTAGE_BASIS');
  if (evidence.registeredSourceIds.length < 1) blockers.push('E4A_SOURCE_REGISTERED');

  /* Activation is checked as a SUBSET relation, not a count. An activated id that is not
     registered is not a stronger state — it is an id nothing can resolve to a host, which
     is how a figure ends up attributed to an institution the registry has never heard of. */
  const registered = new Set(evidence.registeredSourceIds);
  const activatedAndRegistered = evidence.activatedSourceIds.filter((id) => registered.has(id));
  if (activatedAndRegistered.length < 1) blockers.push('E4B_SOURCE_ACTIVATED_WITH_RIGHTS');

  if (!evidence.gapPathPreserved) blockers.push('E5_GAP_PATH_PRESERVED');
  if (evidence.executesOnLoad) blockers.push('E6_NO_EXECUTION_ON_LOAD');

  const langs = new Set(evidence.copyLanguages.map((l) => l.toLowerCase().slice(0, 2)));
  if (!langs.has('en') || !langs.has('pl')) blockers.push('E7_BILINGUAL_COPY');

  return blockers;
}

/**
 * Eligible when nothing blocks. Deliberately derived from `economyRouteBlockers` rather
 * than restated: a second list of conditions would drift from the first the day one was
 * added, and both would look correct in isolation.
 *
 * ELIGIBLE IS NOT ACTIVE. This answers "may the route open", never "open it". Opening it
 * is a Product Owner act, and `b4aEconomySubstrate.spec.ts`'s absence assertion is
 * RETIRED AND REPLACED by a presence assertion with the same teeth — never deleted.
 * Deleting the tripwire and adding the route converts a control into nothing.
 */
export function economyRouteIsEligible(evidence: EconomyRouteEvidence): boolean {
  return economyRouteBlockers(evidence).length === 0;
}
