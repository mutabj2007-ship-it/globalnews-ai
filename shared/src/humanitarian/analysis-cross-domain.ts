import type { ConflictObservation } from '../conflict/observation';
import {
  HUMANITARIAN_WORKSPACE_DIMENSIONS,
  type AdmittedRecordPointer,
  type HumanitarianAnalysisWorkspace,
  type HumanitarianWorkspaceClaim,
} from './analysis-workspace';
import type { HumanitarianRetainedRecord } from './retained-read';
import type { HumanitarianClaim, HumanitarianHazardType } from './observation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CROSS-DOMAIN HUMANITARIAN ANALYSIS — THE HUMANITARIAN CONSEQUENCES OF CONFLICT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE QUESTION THIS ANSWERS, AND THE ONE IT REFUSES.
 *
 * It answers: *"what admitted humanitarian evidence exists alongside this conflict
 * evidence, and on what basis are the two connected?"*
 *
 * It refuses: *"what humanitarian consequences did this conflict have?"* — because no
 * admitted record answers that, and the shape of a convincing answer is exactly the shape
 * of a fabrication. A conflict record states that violence occurred. It does not state that
 * anyone was displaced, and the step between those two sentences is the one this file exists
 * to make impossible.
 *
 * ── THREE PROHIBITIONS, EACH STRUCTURAL RATHER THAN REMEMBERED ────────────
 *
 * 1. **Conflict severity is never read.** `CrossDomainConflictFact` has no severity field,
 *    this module never calls `severityValueOrNull` or `severityIsDisplayable`, and a source
 *    scan in the suite proves the word does not appear. It would not help if it did:
 *    `ACCEPTED_SEVERITY_DERIVATION_RULES` is empty, so `GNAI_DERIVED` is unconstructible and
 *    the only severity a producer can build today is `UNAVAILABLE / NO_ACCEPTED_DERIVATION_RULE`.
 *    There is nothing to infer from, and this file could not infer from it if there were.
 *
 * 2. **No impact claim can originate on the conflict side.** Every humanitarian assertion in
 *    a cross-domain context is a POINTER into the humanitarian workspace, which only ever
 *    carries claims built from `HUMANITARIAN_IMPACT_ASSERTION` records. There is no
 *    constructor here that takes a conflict observation and returns a humanitarian claim.
 *    `assertNoImpactAttributedToConflict` proves the boundary held after the fact.
 *
 * 3. **Co-occurrence is not consequence.** Two records in one country in one week are two
 *    records in one country in one week. That relation is `CO_OCCURRENCE_ONLY`, it is
 *    labelled as establishing no consequence, and it can never be upgraded by adding more
 *    co-occurrences — `relationFor` has no counting path.
 *
 * ── THE ONE LINK THE EVIDENCE CAN STATE ITSELF ────────────────────────────
 *
 * `SOURCE_LINKED` exists for the case where the HUMANITARIAN publisher did the linking:
 * Main's hazard registry contains `ARMED_CONFLICT_DISPLACEMENT`, so a humanitarian source
 * can scope its own event to conflict displacement. That is the source's sentence, not ours,
 * and it is the only basis on which this module will say the two domains are about one
 * situation. Even then the figures stay on the humanitarian side and the conflict facts stay
 * on the conflict side: a `SOURCE_LINKED` context is still two lists, never one merged story.
 */

/** The hazard type on which a humanitarian source has itself scoped an event to conflict. */
export const CONFLICT_LINKED_HAZARD =
  'ARMED_CONFLICT_DISPLACEMENT' as const satisfies HumanitarianHazardType;

export const CROSS_DOMAIN_RELATIONS = ['SOURCE_LINKED', 'CO_OCCURRENCE_ONLY', 'NONE'] as const;
export type CrossDomainRelation = (typeof CROSS_DOMAIN_RELATIONS)[number];

/**
 * WHAT EACH RELATION ENTITLES A READER TO CONCLUDE. Carried as data so a surface cannot
 * quietly present the weaker relation as the stronger one, and so a reviewer can see the
 * entitlement the contract is held to.
 */
export const RELATION_ESTABLISHES_CONSEQUENCE: Readonly<Record<CrossDomainRelation, false>> =
  Object.freeze({
    /* Even here: the humanitarian source linked its own event to conflict displacement. That
       is a statement about the event's own hazard type, not a causal finding about a
       particular conflict record, and this contract does not promote it to one. */
    SOURCE_LINKED: false,
    CO_OCCURRENCE_ONLY: false,
    NONE: false,
  });

export class CrossDomainRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrossDomainRefused';
  }
}

/**
 * A conflict observation as the humanitarian workspace may reference it.
 *
 * NO severity. NO narrative (`ConflictObservation` carries none by type-level proof, and
 * this projection would drop one anyway). NO coordinates: the precision and the denotation
 * are carried so a reader knows how finely the place is known, and the shape is not.
 */
export interface CrossDomainConflictFact {
  readonly observationKey: string;
  readonly eventType: string;
  readonly owner: string;
  /** ISO3 only where the conflict record carries a join code. Never read off coordinates. */
  readonly countryIso3: string | null;
  readonly spatialPrecision: string;
  readonly eventStartedAt: string;
  readonly temporalProvenance: string;
  readonly upstreamAuthority: string;
}

/** A humanitarian claim, by reference into the workspace that owns it. */
export interface CrossDomainHumanitarianRef {
  readonly dimension: string;
  readonly measure: string;
  readonly claimClass: string;
  readonly value: number | string;
  readonly unit: string | null;
  readonly records: readonly AdmittedRecordPointer[];
}

export interface HumanitarianCrossDomainContext {
  readonly relation: CrossDomainRelation;
  /** Why the relation is what it is, in vocabulary rather than prose. */
  readonly relationBasis:
    'HUMANITARIAN_SOURCE_STATED_CONFLICT_HAZARD' | 'SHARED_COUNTRY_AND_WINDOW' | 'NONE';
  readonly establishesConsequence: false;
  /** The conflict side. Facts only. */
  readonly conflictFacts: readonly CrossDomainConflictFact[];
  /** The humanitarian side. Sourced assertions only, by reference. */
  readonly humanitarianAssertions: readonly CrossDomainHumanitarianRef[];
  /** Dimensions that came back empty on the humanitarian side, carried across unchanged. */
  readonly unknownDimensions: readonly string[];
  readonly projectedAt: string;
}

const CONTEXT_FIELDS = [
  'conflictFacts',
  'establishesConsequence',
  'humanitarianAssertions',
  'projectedAt',
  'relation',
  'relationBasis',
  'unknownDimensions',
] as const;

function conflictFact(observation: ConflictObservation): CrossDomainConflictFact {
  return {
    observationKey: observation.observationKey,
    eventType: observation.eventType,
    owner: observation.owner,
    countryIso3: observation.geography.countryIso3 ?? null,
    spatialPrecision: observation.geography.precision,
    eventStartedAt: observation.temporal.eventStartedAt,
    temporalProvenance: observation.temporal.temporalProvenance,
    upstreamAuthority: observation.identity.authority,
  };
}

/** Only the dimensions that carry a stated figure. A FACT is not an assertion. */
function humanitarianRefs(
  workspace: HumanitarianAnalysisWorkspace,
): readonly CrossDomainHumanitarianRef[] {
  const refs: CrossDomainHumanitarianRef[] = [];
  for (const dimension of workspace.dimensions) {
    for (const claim of dimension.claims) {
      if (claim.claimClass === 'FACT') continue;
      if (claim.value === null) {
        throw new CrossDomainRefused(
          `HUM_XD_ASSERTION_WITHOUT_VALUE: '${claim.attribute}' in '${dimension.id}'.`,
        );
      }
      refs.push({
        dimension: dimension.id,
        measure: claim.attribute,
        claimClass: claim.claimClass,
        value: claim.value,
        unit: claim.unit,
        records: claim.records,
      });
    }
  }
  return refs;
}

function humanitarianCountries(
  records: readonly HumanitarianRetainedRecord[],
): ReadonlySet<string> {
  const iso = new Set<string>();
  for (const record of records) {
    for (const code of (record.observation.claim as HumanitarianClaim).countryIso3) iso.add(code);
  }
  return iso;
}

function sourceStatedConflictHazard(records: readonly HumanitarianRetainedRecord[]): boolean {
  return records.some((record) => {
    const claim = record.observation.claim as HumanitarianClaim;
    return claim.claimType === 'HUMANITARIAN_EVENT' && claim.hazardType === CONFLICT_LINKED_HAZARD;
  });
}

/** Inclusive day-window overlap on the dates the sources themselves state. */
function withinWindow(at: string, windowStart: string, windowEnd: string): boolean {
  const t = Date.parse(at);
  const a = Date.parse(windowStart);
  const b = Date.parse(windowEnd);
  if (Number.isNaN(t) || Number.isNaN(a) || Number.isNaN(b)) return false;
  return t >= a && t <= b;
}

/**
 * THE PROJECTION. Pure, deterministic, no clock, no fetch, no model.
 *
 * `records` is the humanitarian side (the same admitted rows the workspace was built from,
 * because the relation is decided on the records' own claims and the workspace carries only
 * pointers). `conflict` is the conflict side. The window is the caller's bounded question,
 * not a default: there is no "recent" here, because "recent" would be our judgement.
 */
export function projectHumanitarianCrossDomain(input: {
  readonly workspace: HumanitarianAnalysisWorkspace;
  readonly records: readonly HumanitarianRetainedRecord[];
  readonly conflict: readonly ConflictObservation[];
  readonly window: { readonly from: string; readonly to: string };
  readonly projectedAt: string;
}): HumanitarianCrossDomainContext {
  const { workspace, records, conflict, window, projectedAt } = input;

  const countries = humanitarianCountries(records);
  /* A conflict record joins the context only on the two axes both sides state themselves:
     the publisher's own country join code, and the source's own event date. */
  const adjacent = conflict.filter(
    (observation) =>
      observation.geography.countryIso3 !== undefined &&
      countries.has(observation.geography.countryIso3) &&
      withinWindow(observation.temporal.eventStartedAt, window.from, window.to),
  );

  const relation: CrossDomainRelation =
    adjacent.length === 0
      ? 'NONE'
      : sourceStatedConflictHazard(records)
        ? 'SOURCE_LINKED'
        : 'CO_OCCURRENCE_ONLY';

  const relationBasis =
    relation === 'SOURCE_LINKED'
      ? 'HUMANITARIAN_SOURCE_STATED_CONFLICT_HAZARD'
      : relation === 'CO_OCCURRENCE_ONLY'
        ? 'SHARED_COUNTRY_AND_WINDOW'
        : 'NONE';

  const unknownDimensions = workspace.dimensions
    .filter((d) => d.state === 'EMPTY')
    .map((d) => d.id);

  return {
    relation,
    relationBasis,
    establishesConsequence: false,
    conflictFacts: adjacent
      .map(conflictFact)
      .sort((a, b) => (a.observationKey < b.observationKey ? -1 : 1)),
    humanitarianAssertions: humanitarianRefs(workspace),
    unknownDimensions,
    projectedAt,
  };
}

/** Closed field set, in both directions. */
export function assertCrossDomainContextIsClosed(context: HumanitarianCrossDomainContext): void {
  const fields = Object.keys(context).sort().join(',');
  if (fields !== CONTEXT_FIELDS.join(',')) {
    throw new CrossDomainRefused(
      `HUM_XD_FIELD_SET_OPEN: got [${fields}], expected [${CONTEXT_FIELDS.join(',')}].`,
    );
  }
  if (context.establishesConsequence !== false) {
    throw new CrossDomainRefused(
      'HUM_XD_CLAIMS_CONSEQUENCE: no relation in this contract establishes a humanitarian ' +
        'consequence of a conflict event.',
    );
  }
  if (RELATION_ESTABLISHES_CONSEQUENCE[context.relation] !== false) {
    throw new CrossDomainRefused(`HUM_XD_RELATION_OVERCLAIMS: '${context.relation}'.`);
  }
  for (const id of context.unknownDimensions) {
    if (!(HUMANITARIAN_WORKSPACE_DIMENSIONS as readonly string[]).includes(id)) {
      throw new CrossDomainRefused(`HUM_XD_UNKNOWN_DIMENSION_FOREIGN: '${id}'.`);
    }
  }
}

/**
 * THE BOUNDARY PROOF.
 *
 * Every humanitarian assertion in the context must trace to a record the HUMANITARIAN
 * workspace admitted, and no conflict observation key may appear among those records. A
 * future edit that reached across the seam would pass the closure check and fail this one.
 */
export function assertNoImpactAttributedToConflict(
  context: HumanitarianCrossDomainContext,
  workspace: HumanitarianAnalysisWorkspace,
): void {
  const admitted = new Set(workspace.records.map((r) => r.observationKey));
  const conflictKeys = new Set(context.conflictFacts.map((f) => f.observationKey));
  for (const ref of context.humanitarianAssertions) {
    if (ref.records.length === 0) {
      throw new CrossDomainRefused(`HUM_XD_ASSERTION_WITHOUT_RECORD: '${ref.measure}'.`);
    }
    for (const pointer of ref.records) {
      if (!admitted.has(pointer.observationKey)) {
        throw new CrossDomainRefused(
          `HUM_XD_ASSERTION_NOT_ADMITTED: '${ref.measure}' cites '${pointer.observationKey}', which ` +
            'the humanitarian workspace did not admit.',
        );
      }
      if (conflictKeys.has(pointer.observationKey)) {
        throw new CrossDomainRefused(
          `HUM_XD_IMPACT_FROM_CONFLICT: '${ref.measure}' cites conflict record ` +
            `'${pointer.observationKey}'. A conflict event never asserts a humanitarian figure.`,
        );
      }
    }
  }
}

/**
 * Every claim the context carries on the humanitarian side, with its own record, so a caller
 * can show the two sides without flattening them. Returned as a pair rather than merged,
 * because a merged list is where the distinction is lost.
 */
export function crossDomainSides(context: HumanitarianCrossDomainContext): {
  readonly conflict: readonly CrossDomainConflictFact[];
  readonly humanitarian: readonly CrossDomainHumanitarianRef[];
} {
  return { conflict: context.conflictFacts, humanitarian: context.humanitarianAssertions };
}

/** Claims a workspace carries that are figures. Exported for the brief projection. */
export function statedFigures(
  workspace: HumanitarianAnalysisWorkspace,
): readonly HumanitarianWorkspaceClaim[] {
  return workspace.dimensions.flatMap((d) => d.claims.filter((c) => c.claimClass !== 'FACT'));
}
