/**
 * SHARED · TYPED RELATIONSHIP EDGES — THE MINIMUM SUBSTRATE, AND NO MORE.
 *
 *     baseline   C37  37FDBB150AB1C5DF30D80B788C7094B9600779BE5613F592CE4C6889A48CC891
 *     authority  MAIN-POLITICS-V1-AUDIT (bbc6d7450793e777015a5bf268d20fc15986ef108954ae234c1774b7ea4d1011)
 *                  finding F-05: 0 relationship or edge types exist in canonical
 *                Part VIII Politics Intelligence v1.0 R01 O8 / R04 "Relationship graph"
 *
 * ── WHY THIS IS NOT A GRAPH PLATFORM ────────────────────────────────────────
 *
 * The task that authorised this file says: "Design the minimum shared relationship substrate
 * required for Politics. Do not build a universal graph platform." So there is no traversal, no
 * path finding, no reachability, no centrality, no degree, no clustering and no query language in
 * this module — and there is no place to add one without adding the first such function, which a
 * test asserts does not exist.
 *
 * What a graph platform would buy is answers the platform cannot presently justify. Part VIII R11
 * is explicit that materiality feeds the shared assessment service and that the frontend never
 * ranks; a traversal function here would be a second, unaccountable place where "who matters" gets
 * decided. An edge set that can be READ and CITED is what Governance State needs (Part VIII D-02:
 * coalition composition is derivable from typed edges between actors plus lifecycle events). That
 * is what this file provides.
 *
 * ── EVERY EDGE CITES EVIDENCE. THAT IS THE WHOLE POINT ──────────────────────
 *
 * R01 O8: "each edge cites evidence". An edge with no evidence reference is not a weak edge, it is
 * an assertion the platform cannot account for, so `evidenceRefs` is REQUIRED and a non-empty
 * check is exported rather than left to each consumer. R03 C-10 and R11 forbid an edge carrying
 * its own colour or severity; nothing here carries either.
 *
 * ── VALIDITY IS A CLOSED-OPEN INTERVAL, AND ABSENCE IS NOT ZERO ─────────────
 *
 * `validFrom` is required and `validTo` is optional-and-meaningful: absent means "still holding as
 * far as the evidence says", never "ended at an unknown time" and never "ends now". A coalition
 * that has not collapsed and a coalition whose end nobody recorded are different states, and the
 * second is expressed by CONTESTED / evidence, not by a null date pretending to be a fact.
 */

/*
  CF-D1 RESOLVED · repointed at the canonical owner.

  The second of the two imports the Politics R1 landing was held on, and the one Main's
  own instruction was sharpest about: "do not stub it. A stubbed provenance type is a
  second evidence system arriving by the back door."

  It is not stubbed. `MAIN-CONFLICT-CANONICAL-FOUNDATION-R2` promoted
  `LOCATION_PROVENANCES` / `LocationProvenance` into `shared/src/spatial/precision.ts`,
  beside the precision ladder and deliberately distinct from it — PRECISION IS NOT
  PROVENANCE. One says how finely a location is known; this says who said so.
*/
import type { LocationProvenance } from '../spatial/precision';

/* ───────────────────────────── EDGE IDENTITY ───────────────────────────── */

/**
 * Deterministic and content-addressed, exactly as `WatchSubject.subjectId` already is in
 * `shared/src/watch.ts`, and for the same stated reason: two callers who assert the same
 * relationship must agree they are asserting the same one, before any table exists to issue ids.
 *
 * THE KEY IS (type, source, target, validFrom). Two edges of the same type between the same
 * endpoints that begin at different times are different edges — a party that joins a coalition,
 * leaves, and rejoins has two memberships and not one with a rewritten date.
 */
export const RELATIONSHIP_KEY_ENCODING_VERSION = 'rel:1';

/**
 * Length-prefixed, for the reason MAIN-ECON-CONTRACT-1 length-prefixes economy keys: a plain
 * separator join is not injective over values that may themselves contain the separator, so
 * `{'A:B','C'}` and `{'A','B:C'}` would collide. This is the same general string-encoding property,
 * applied again — not a reuse of Economy or Situation identity semantics.
 */
function lengthPrefixed(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('');
}

export interface RelationshipEndpoint {
  /**
   * The kind of thing at this end. Deliberately an open string: the platform does not own a closed
   * register of object types, and inventing one here would make every future domain edit this file.
   */
  readonly objectType: string;
  /** The endpoint's own identifier, in that object type's own identity space. */
  readonly objectId: string;
}

export function relationshipEndpointKey(endpoint: RelationshipEndpoint): string {
  return lengthPrefixed([endpoint.objectType, endpoint.objectId]);
}

export function relationshipEdgeKey(edge: {
  readonly edgeType: string;
  readonly source: RelationshipEndpoint;
  readonly target: RelationshipEndpoint;
  readonly validFrom: string;
}): string {
  return `${RELATIONSHIP_KEY_ENCODING_VERSION}:${lengthPrefixed([
    edge.edgeType,
    relationshipEndpointKey(edge.source),
    relationshipEndpointKey(edge.target),
    edge.validFrom,
  ])}`;
}

/* ─────────────────────────── DIRECTION AND STATE ────────────────────────── */

/**
 * DIRECTION IS A PROPERTY OF THE EDGE TYPE, NOT OF AN INSTANCE.
 *
 * "supports government" is directed and "coalition member with" is not, and that is decided once,
 * where the type is declared, so two instances of one type can never disagree about whether the
 * ends may be swapped.
 */
export type RelationshipDirectionality = 'DIRECTED' | 'SYMMETRIC';

/**
 * Whether the relationship itself is disputed — NOT whether its endpoints are.
 *
 * `CONTESTED` reuses the word `LocationProvenance` already uses for incompatible source locations,
 * and means the same thing one layer up: credible sources disagree that this edge holds. Part VIII
 * R03 C-06 routes that disagreement to Competing Readings; this field only records that it exists
 * so a reader is never shown a contested edge as a settled one.
 */
export type RelationshipAssertionState = 'STATED' | 'INTERPRETED' | 'CONTESTED';

/**
 * DECLARED, AND DELIBERATELY NOT PRODUCED TODAY.
 *
 * `shared/src/news.ts` states the rule this follows: "DECLARING A MEMBER IS NOT CLAIMING A PRODUCER
 * FOR IT." No assessment service currently emits a verification level for an edge, so
 * `verification` is optional and `PRODUCIBLE_RELATIONSHIP_VERIFICATION` is empty. A consumer reads
 * the empty array and knows not to wait for a value that will not arrive.
 */
export type RelationshipVerification = 'UNVERIFIED' | 'CORROBORATED' | 'AUTHORITATIVE_RECORD';

/** Nothing produces any of them yet. This is a measurement, not a placeholder. */
export const PRODUCIBLE_RELATIONSHIP_VERIFICATION: readonly RelationshipVerification[] = [];

/* ──────────────────────────────── THE EDGE ─────────────────────────────── */

export interface RelationshipEdge {
  /** `relationshipEdgeKey(...)` of this edge. Content-addressed, never a sequence. */
  readonly edgeId: string;
  /** A symbolic type owned by the registering domain, e.g. `POLITICS:COALITION_MEMBER`. */
  readonly edgeType: string;
  readonly directionality: RelationshipDirectionality;
  readonly source: RelationshipEndpoint;
  readonly target: RelationshipEndpoint;
  /** ISO-8601. Required: an edge with no beginning cannot be placed on a Timeline. */
  readonly validFrom: string;
  /** ISO-8601. ABSENT MEANS STILL HOLDING, never "ended at an unknown time". */
  readonly validTo?: string;
  readonly assertion: RelationshipAssertionState;
  /**
   * REQUIRED AND NON-EMPTY. Opaque evidence identifiers — this module never dereferences them and
   * never holds evidence itself, so it cannot become a second evidence store.
   */
  readonly evidenceRefs: readonly string[];
  /** Where the assertion came from, at the level the source stated it. Never inferred here. */
  readonly provenance?: LocationProvenance;
  readonly verification?: RelationshipVerification;
}

/** An edge that cites nothing is not accountable, so this is a validity test, not a hint. */
export function edgeCitesEvidence(edge: RelationshipEdge): boolean {
  return edge.evidenceRefs.length > 0;
}

/** `validTo` before `validFrom` is not a short edge; it is a broken record. */
export function edgeIntervalIsCoherent(edge: RelationshipEdge): boolean {
  if (edge.validTo === undefined) return true;
  return Date.parse(edge.validTo) >= Date.parse(edge.validFrom);
}

/**
 * THE ONE CANONICAL IDENTITY FOR AN EDGE, SELECTED BY ITS DIRECTIONALITY.
 *
 * E1-POLITICS-PLATFORM-1 B-1, corrected here. `edgeIsValid` previously compared against
 * `relationshipEdgeKey` UNCONDITIONALLY, while `symmetricEdgeKey` defines order-independent identity
 * for the symmetric case. The two disagreed whenever a symmetric edge's endpoints were not already
 * in sorted order, which left a conforming implementer two choices and both were defects: store the
 * canonical id and half of all symmetric edges fail validation, or satisfy validation and one
 * coalition membership becomes two rows depending on which party the caller named first — the exact
 * outcome `symmetricEdgeKey` exists to prevent.
 *
 * WHY THE SELECTION LIVES HERE AND NOT IN THE CALLER. Requiring callers to pre-sort endpoints would
 * be a rule enforced by discipline in every producer, forever, and unenforceable at read time. The
 * directionality is already carried on the edge, so the contract can decide, and a caller writing
 * B -> A gets the same identity as one writing A -> B without knowing the rule exists.
 *
 * WHY MAIN'S OWN SUITE MISSED IT, recorded because the gap is the instructive part: both key
 * functions were tested and both were correct in isolation, but every `edgeIsValid` fixture was
 * declared DIRECTED, so the two were never composed. The contradiction lived in the space between
 * two passing tests. The R1 suite now pins a SYMMETRIC fixture in both orientations.
 */
export function canonicalEdgeKey(edge: {
  readonly edgeType: string;
  readonly directionality: RelationshipDirectionality;
  readonly source: RelationshipEndpoint;
  readonly target: RelationshipEndpoint;
  readonly validFrom: string;
}): string {
  return edge.directionality === 'SYMMETRIC' ? symmetricEdgeKey(edge) : relationshipEdgeKey(edge);
}

export function edgeIsValid(edge: RelationshipEdge): boolean {
  return (
    edge.edgeId === canonicalEdgeKey(edge) &&
    edgeCitesEvidence(edge) &&
    edgeIntervalIsCoherent(edge)
  );
}

/**
 * A SYMMETRIC edge must give the same key whichever way it is written, or the same coalition
 * membership would be two rows depending on which party a caller happened to name first.
 */
export function symmetricEdgeKey(edge: {
  readonly edgeType: string;
  readonly source: RelationshipEndpoint;
  readonly target: RelationshipEndpoint;
  readonly validFrom: string;
}): string {
  const [first, second] = [relationshipEndpointKey(edge.source), relationshipEndpointKey(edge.target)].sort();
  return `${RELATIONSHIP_KEY_ENCODING_VERSION}:${lengthPrefixed([edge.edgeType, first, second, edge.validFrom])}`;
}
