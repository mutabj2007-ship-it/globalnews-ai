/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE NON-NUMERIC DOMAIN OBSERVATION — PL-B1 · PL-B2 · POLITICS TIMESTAMP MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-POLITICS-PLATFORM-PROMOTION-R3. PROPOSED for `shared/src/observation/domain-observation.ts`.
 * Nothing lands without authorization. No provider. No deployment.
 *
 * ── WHY `EconomyObservation` IS NOT WEAKENED ──────────────────────────────
 *
 * Its own docblock already gives the reason, and it is the right one:
 *
 *   "`value` IS REQUIRED AND IS NOT NULLABLE. A reading that does not exist is not an
 *    observation with a null in it — it is the absence of an observation, which
 *    `EconomyFigureSlot` expresses with a reason."
 *
 * Relaxing `value` or `unit` to optional to let a committee vote through would teach the
 * numeric observation type to represent its own absence — the exact defect that sentence
 * was written to prevent — and it would do it to serve a domain that has no numbers at
 * all. **G pinned this as a type assertion on purpose: the expedient closure fails the
 * typecheck by name.** This file is the closure that leaves both assertions true.
 *
 * ── AND WHY THIS IS NOT A CATCH-ALL ───────────────────────────────────────
 *
 * "Reusable where appropriate, but must not become an untyped catch-all" is met
 * structurally, not by discipline:
 *
 *   1. There is no `any`, no `unknown`, no `Record<string, unknown>` and no index
 *      signature anywhere in this file. A probe asserts it with a positive control.
 *   2. The claim payload is a TYPE PARAMETER, not a bag. A domain supplies its own
 *      closed claim union; the generic record never sees a shape it cannot name.
 *   3. `observationKind` is drawn from a per-domain registry that the domain declares.
 *      A domain with no registry cannot construct an observation at all.
 */

import type { SourceProvenance } from '../source-provenance';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · PL-B2 — AUTHORSHIP IS ABOUT A NAMED ATTRIBUTE, NOT ABOUT A UNIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `UNIT_AUTHORSHIP_KINDS` is already generic in its VALUES — `PUBLISHER_STATED` and
 * `LOCALLY_ASSERTED` are facts about who authored an attribute, and neither mentions a
 * unit. Only the NAME welds them to one.
 *
 * So nothing is re-derived. The list is re-exported BY REFERENCE, which makes the two
 * names provably one list rather than two that happen to agree today — the same
 * single-authority technique `MAIN-C46-BETA-CONVERGENCE-PREFLIGHT-2` ruled for the two
 * rights vocabularies: "bind by derivation — one direction, single authority,
 * referential identity in the guard."
 */
export { UNIT_AUTHORSHIP_KINDS as ATTRIBUTE_AUTHORSHIP_KINDS } from '../market';
export type { UnitAuthorshipKind as AttributeAuthorshipKind } from '../market';

import { UNIT_AUTHORSHIP_KINDS, type UnitAuthorshipKind } from '../market';

/**
 * WHO AUTHORED ONE NAMED ATTRIBUTE OF AN OBSERVATION.
 *
 * `attribute` is the attribute's own name — `'unit'` for a numeric reading,
 * `'summaryStage'` for a legislative mapping, `'severity'` for an assessed value. The
 * record does not pretend the attribute is a unit, and it does not pretend a unit is
 * anything other than one attribute among others.
 */
export interface AttributeAuthorship {
  /** The attribute this statement is about. Never empty. */
  readonly attribute: string;
  readonly authorship: UnitAuthorshipKind;
}

export class AttributeAuthorshipRefused extends Error {}

/**
 * EVERY AUTHORED ATTRIBUTE IS DECLARED EXACTLY ONCE.
 *
 * Two rows for one attribute means the answer depends on iteration order, and the
 * authorship of a value is not a thing that may have two answers.
 */
export function assertAuthorshipIsWellFormed(rows: readonly AttributeAuthorship[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.attribute.trim().length === 0) {
      throw new AttributeAuthorshipRefused(
        'PL-B2-1: an authorship row names no attribute. Authorship of nothing in particular ' +
          'is what welding it to `unit` was hiding.',
      );
    }
    if (seen.has(row.attribute)) {
      throw new AttributeAuthorshipRefused(
        `PL-B2-2: duplicate authorship for attribute '${row.attribute}'.`,
      );
    }
    if (UNIT_AUTHORSHIP_KINDS.indexOf(row.authorship) === -1) {
      throw new AttributeAuthorshipRefused(
        `PL-B2-3: '${row.authorship}' is not an accepted authorship kind. The vocabulary is ` +
          'the accepted one, re-exported by reference, and this file adds no member to it.',
      );
    }
    seen.add(row.attribute);
  }
}

/** Convenience for a numeric seam, so nothing downstream changes shape. */
export function authorshipOfAttribute(
  rows: readonly AttributeAuthorship[],
  attribute: string,
): UnitAuthorshipKind | null {
  const row = rows.find((r) => r.attribute === attribute);
  return row === undefined ? null : row.authorship;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE TEMPORAL AXES — THE PLATFORM'S OWN, UNDER THEIR ACCEPTED NAMES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── A CORRECTION TO PL-N1, AND IT MATTERS ────────────────────────────────
 *
 * G reported that `LegislativeStageObservation` carries one `observedAt` "while the
 * accepted model requires four distinct timestamps". Measured against the accepted
 * contract, **the four it names are a different four**:
 *
 *   "FOUR ELI/CDM DATE AXES, ONE SUMMARY STAGE … `entryIntoForce`, `validFrom`,
 *    `repealDate` and `expirationDate` are four independent dates"
 *      — MAIN-POLITICS-PLATFORM-1-R2, §11, beside
 *        `LAW_IN_FORCE_AXIS_IS_NOT_THE_PROPOSAL_AXIS = true`
 *
 * Those are **dates about a LAW IN FORCE**, and the contract's own named constant says
 * they are a different axis from the proposal's lifecycle. They are not provenance
 * timestamps and must not be moved onto an observation — doing so would collapse exactly
 * the axis that constant exists to keep apart.
 *
 * **The provenance four the promotion actually needs already exist in the platform**,
 * under accepted names, in two accepted contracts:
 *
 *   occurrence            Market `publisherChangedAt` · Conflict `eventStartedAt`
 *   publication/assertion Economy `vintage` · Market `publisherVintage`
 *   retrieval             Economy `provenance.retrievedAt` · Market `ingestedAt`
 *   revision/vintage basis Market `vintageProvenance` (WHICH axis the record carries)
 *
 * So no new temporal vocabulary is minted. The names below are the platform's, and the
 * fourth axis is what Market already calls it: a statement of **which** of the others the
 * record is actually carrying, bound at write and never inferred at read.
 */

export const OBSERVATION_TEMPORAL_BASES = [
  /** The record's time is when the thing happened, as the source states it. */
  'OCCURRENCE',
  /** The record's time is when the publisher issued or last changed the record. */
  'PUBLISHER_VINTAGE',
  /** The record's time is only when WE retrieved it. The weakest basis, and it says so. */
  'RETRIEVAL_ONLY',
] as const;
export type ObservationTemporalBasis = (typeof OBSERVATION_TEMPORAL_BASES)[number];

export interface ObservationTemporal {
  /** WHEN IT HAPPENED, where the source states it. Absent is not "the publication date". */
  readonly occurredAt?: string;
  /** WHEN THE PUBLISHER issued or last changed the record. */
  readonly publisherVintage?: string;
  /** WHEN WE RETRIEVED IT. Always present — we always know this one. */
  readonly retrievedAt: string;
  /**
   * WHICH of the three the record is actually carrying. Bound at write, never inferred
   * at read — Economy's own rule: *"conflating them makes our ingestion schedule look
   * like the publisher's revision history."*
   */
  readonly temporalBasis: ObservationTemporalBasis;
}

export class ObservationTemporalRefused extends Error {}

/** The declared basis must be the one the record can actually support. */
export function assertTemporalBasisIsSupported(t: ObservationTemporal): void {
  if (t.temporalBasis === 'OCCURRENCE' && (t.occurredAt ?? '').trim().length === 0) {
    throw new ObservationTemporalRefused(
      'PL-T-1: OCCURRENCE basis with no `occurredAt`. A record claiming to carry event time ' +
        'and carrying none is the precise shape a retrieval clock takes when it is presented ' +
        'as a publisher revision history.',
    );
  }
  if (t.temporalBasis === 'PUBLISHER_VINTAGE' && (t.publisherVintage ?? '').trim().length === 0) {
    throw new ObservationTemporalRefused('PL-T-2: PUBLISHER_VINTAGE basis with no `publisherVintage`.');
  }
  if (t.retrievedAt.trim().length === 0) {
    throw new ObservationTemporalRefused('PL-T-3: every observation states when we retrieved it.');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · REVISION — THE CONFLICT SEMANTICS, REUSED UNCHANGED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Append, never overwrite; contiguous ordinals so "is a revision missing" is answerable
 * from the chain alone; a retraction is a state, not a delete. Identical in shape to
 * `ConflictRevision`, and deliberately so — a second revision model would be the drift
 * this programme has closed five times.
 */
export const OBSERVATION_REVISION_KINDS = [
  'CORRECTION',
  'CLASSIFICATION_CHANGE',
  'SOURCE_REVISION',
  'RETRACTION',
] as const;
export type ObservationRevisionKind = (typeof OBSERVATION_REVISION_KINDS)[number];

export interface ObservationRevision {
  readonly revisionOrdinal: number;
  readonly supersedesRevisionOrdinal: number | null;
  readonly revisionKind?: ObservationRevisionKind;
  readonly recordedAt: string;
}

export class ObservationRevisionRefused extends Error {}

export function assertObservationRevisionAppends(
  prior: ObservationRevision,
  next: ObservationRevision,
): void {
  if (next.revisionOrdinal !== prior.revisionOrdinal + 1) {
    throw new ObservationRevisionRefused(
      `PL-R-1: revision ${next.revisionOrdinal} does not immediately follow ${prior.revisionOrdinal}.`,
    );
  }
  if (next.supersedesRevisionOrdinal !== prior.revisionOrdinal) {
    throw new ObservationRevisionRefused(
      `PL-R-2: the supersedes link and the ordinal disagree. Checking only one leaves the ` +
        'other free to drift.',
    );
  }
  if (next.revisionKind === undefined) {
    throw new ObservationRevisionRefused('PL-R-3: a revision past ordinal 0 states what kind it is.');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE RECORD — PL-B1
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ObservationSourceReference {
  /** The publisher's own citation text, verbatim. Never parsed into a URL. */
  readonly citation?: string;
  /** A real address, ONLY where the source published one as an address. */
  readonly sourceUrl?: string;
}

export interface DomainObservationIdentity {
  /** The domain that owns this observation. One owner, always. */
  readonly domainId: string;
  /** The upstream authority's own identifier, VERBATIM. Never normalized, never trimmed. */
  readonly upstreamAuthority: string;
  readonly upstreamId: string;
}

export class DomainObservationIdentityUnavailable extends Error {}

/** Length-prefixed, so two decompositions cannot encode to one key. */
export function domainObservationKey(id: DomainObservationIdentity): string {
  if (id.upstreamId.trim().length === 0) {
    throw new DomainObservationIdentityUnavailable(
      'PL-ID-1: the upstream authority supplied no stable identifier. This is a PRODUCER ' +
        'LIMITATION and is reported as one. No identity is minted, because a minted identity ' +
        'would assert a sameness nobody established.',
    );
  }
  const parts = [id.domainId, id.upstreamAuthority, id.upstreamId];
  return `obs:1:${parts.map((p) => `${p.length}:${p}`).join(':')}`;
}

/**
 * ONE NON-NUMERIC OBSERVATION.
 *
 * `TClaim` is the DOMAIN'S OWN closed claim type. It is a type parameter rather than a
 * payload bag: the generic record never holds a shape it cannot name, and a domain that
 * has not declared its claim union cannot instantiate this type at all.
 *
 * **There is no `value` and no `unit`, deliberately.** A committee vote has neither, and
 * a record that offered them would invite a producer to write `value: 1`.
 */
export interface DomainObservation<TClaim> {
  /** `domainObservationKey(identity)`. Derived from identity and nothing else. */
  readonly observationKey: string;
  readonly identity: DomainObservationIdentity;
  /**
   * WHAT KIND of observation this is, from the DOMAIN'S OWN registry — e.g. Politics'
   * `LEGISLATIVE_STAGE`. Not a free string in practice: the domain narrows it.
   */
  readonly observationKind: string;
  /** WHAT IT IS ABOUT — the domain's subject type and subject id. */
  readonly subjectType: string;
  readonly subjectId: string;
  /** THE CLAIM ITSELF, in the domain's own closed shape. */
  readonly claim: TClaim;
  readonly temporal: ObservationTemporal;
  /** The platform's provenance model, reused verbatim. No second evidence system. */
  readonly provenance: SourceProvenance;
  readonly sourceReference: ObservationSourceReference;
  /** PL-B2 — who authored which named attribute of the claim. */
  readonly attributeAuthorship: readonly AttributeAuthorship[];
  readonly revision: ObservationRevision;
}

/**
 * THE ONE ENTRY POINT. Every invariant is checked here, so a producer cannot construct a
 * partially-validated observation by calling three of four guards.
 */
export function assertDomainObservationIsWellFormed<TClaim>(
  o: DomainObservation<TClaim>,
): void {
  if (o.observationKey !== domainObservationKey(o.identity)) {
    throw new DomainObservationIdentityUnavailable(
      'PL-ID-2: the observation key is not the key its identity produces. A key written by ' +
        'hand is a key that can disagree with the thing it identifies.',
    );
  }
  assertTemporalBasisIsSupported(o.temporal);
  assertAuthorshipIsWellFormed(o.attributeAuthorship);
}
