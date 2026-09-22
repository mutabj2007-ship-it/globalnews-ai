/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SECURITY OBSERVATION — BETA-SECURITY-EVIDENCE-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS CLOSES. `MAIN-SECURITY-PLATFORM-1-R1` landed the Security platform
 * contract — coverage, assessment, admission, ownership — and landed it as a
 * CONTRACT: no record type, no producer, nothing a surface could read. The
 * consequence is the one Part IX's own reader surface shows today, where every
 * zone renders `NOT_ASSESSED` because there is no observation type for a
 * Security finding to be.
 *
 * This file is that record type, and it is deliberately the smallest one that
 * can be honest.
 *
 * ── IT IS A `DomainObservation`, NOT A SECOND OBSERVATION MODEL ───────────
 *
 * `shared/src/observation/domain-observation.ts` already carries the platform's
 * non-numeric observation: identity, the three temporal axes, revision,
 * provenance and per-attribute authorship. Security is its second consumer, not
 * a second author. Everything below EXTENDS that record; nothing re-declares any
 * part of it.
 *
 * The one field Security adds is GEOGRAPHY, and it is added rather than folded
 * into `subjectId` because CF-D1 ruled precision, provenance, geometry and
 * denotation are independent axes. `subjectId` can carry a geography's IDENTITY;
 * it cannot carry how finely that geography is known or who said so.
 *
 * ── THE ONE AXIS A RETAINED REPORT CAN REACH ──────────────────────────────
 *
 * Part IX's coverage contract declares five axes — OCCURRENCE, CAUSE, ACTOR,
 * POSTURE, SEVERITY — and states that they are covered independently and must
 * never be collapsed. A retained journalistic report reaches EXACTLY ONE of
 * them: that something happened, at a place and time.
 *
 *   CAUSE      "established by a named authority. Never inferred from occurrence."
 *   ACTOR      "Never inferred from cause."
 *   POSTURE    "a declared, dated, scoped, expiring state issued by an external
 *               authority" — a newspaper does not issue one.
 *   SEVERITY   `SEVERITY_IS_NEVER_IMPORTED_PREGRADED = true`.
 *
 * So `SecurityIncidentClaim` carries no cause, no actor, no posture and no
 * severity — not as nullable fields, but as fields THAT DO NOT EXIST. A nullable
 * `severity` is a field a later producer fills; an absent one is a specification
 * change. The four uncovered axes are reported by the COVERAGE declaration,
 * which is where Part IX puts them, and a consumer reads them there.
 *
 * ── AND NO NATURAL PERSON, STRUCTURALLY ───────────────────────────────────
 *
 * §3's finding was that the protection for named private individuals existed as
 * a note and not as a shape. PO-1 permits a named natural person on no reader
 * surface at all. There is therefore no person field here, no optional one, and
 * no free-text field a name could be written into by a producer that meant well:
 * `headline` and `summary` are the PUBLISHER'S OWN WORDS carried verbatim, and
 * `assertSecurityObservationIsWellFormed` refuses a claim that adds any narrative
 * this side of the seam.
 */

import {
  assertDomainObservationIsWellFormed,
  domainObservationKey,
  type AttributeAuthorship,
  type DomainObservation,
  type DomainObservationIdentity,
} from '../observation/domain-observation';
import type { LocationProvenance, SpatialPrecision } from '../spatial/precision';
import { SECURITY_DOMAIN_ID, type SecurityCoverageAxis } from './index';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE DOMAIN'S OWN KIND REGISTRY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DomainObservation` requires one: *"`observationKind` is drawn from a
 * per-domain registry that the domain declares. A domain with no registry cannot
 * construct an observation at all."*
 *
 * ONE MEMBER, AND THE COUNT IS THE POINT. Part IX's rail shows incidents,
 * postures, exposures, corridors and attributions. Exactly one of them has a
 * producer, so exactly one is declared. A second member is a specification
 * change that arrives WITH its producer, not a slot left open for one.
 */
export const SECURITY_OBSERVATION_KINDS = ['SECURITY_INCIDENT_REPORT'] as const;
export type SecurityObservationKind = (typeof SECURITY_OBSERVATION_KINDS)[number];

/**
 * WHAT A SECURITY OBSERVATION IS ABOUT.
 *
 * A geography, and not an incident id. The platform has no canonical occurrence
 * registry yet — §7's `OccurrenceReference` references one that no producer
 * mints — so minting an incident identity here would assert a sameness across
 * reports that nobody established. Two reports of one event are two
 * observations about one geography, which is true, rather than one incident
 * built by a deduplication nobody reviewed.
 */
export const SECURITY_OBSERVATION_SUBJECT_TYPE = 'GEOGRAPHY' as const;
export type SecurityObservationSubjectType = typeof SECURITY_OBSERVATION_SUBJECT_TYPE;

/**
 * The single axis this observation kind is evidence on. Named as a constant so a
 * guard asserts against it, and typed as `SecurityCoverageAxis` so a rename of
 * the accepted axis vocabulary breaks this file rather than silently orphaning it.
 */
export const SECURITY_OBSERVED_AXIS: SecurityCoverageAxis = 'OCCURRENCE';

/**
 * The axes a retained report can NEVER reach, carried as data so the refusal is
 * checkable rather than remembered.
 */
export const SECURITY_AXES_NOT_REACHABLE_FROM_REPORTING: readonly SecurityCoverageAxis[] = [
  'CAUSE',
  'ACTOR',
  'POSTURE',
  'SEVERITY',
];

export const SECURITY_CLAIM_TYPES = ['INCIDENT_REPORTED'] as const;
export type SecurityClaimType = (typeof SECURITY_CLAIM_TYPES)[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · OWNERSHIP EVIDENCE — SUPPLIED, NEVER DECIDED HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §7 is explicit about who decides: *"Conflict's accepted contract does, against
 * its own criteria. Security never assigns this value from its own evidence, and
 * this file provides no function that computes one."*
 *
 * `resolveConflictEventOwner` in `conflict/observation.ts` IS that function, and
 * it is the one this domain calls. What Security supplies is the two THRESHOLD
 * OBSERVATIONS the resolver consumes, and it records them on the observation so
 * that a reviewer can see what the ownership decision was made from without
 * re-deriving it.
 *
 * BOTH ARE TRI-STATE, AND `undefined` IS THE COMMON CASE. Conflict's own words:
 * *"`undefined` means the upstream record does not say — which is not the same
 * as saying no, and must not resolve ownership."* A report that does not mention
 * an organised armed actor has not established that none was involved, and the
 * producer that fills these fields must never write `false` for a silence.
 */
export interface SecurityOwnershipEvidence {
  /** T1 — violence occurred, or a protective security posture was taken. */
  readonly violenceOrProtectivePosture: boolean | undefined;
  /** T2 — an organised armed actor is a participant in the violence. */
  readonly organisedArmedActorParticipates: boolean | undefined;
  /**
   * The terms in the retained evidence that established each threshold, verbatim
   * and lower-cased. Carried so the decision is auditable from the row: a
   * threshold with no supporting term is a threshold somebody guessed.
   */
  readonly violenceTerms: readonly string[];
  readonly organisedArmedActorTerms: readonly string[];
  readonly politicalActivityTerms: readonly string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · GEOGRAPHY — FOUR AXES, KEPT APART
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * WHERE THE OBSERVATION IS ATTRIBUTED, AND HOW WELL THAT IS KNOWN.
 *
 * `precision` and `provenance` are separate fields and neither is derived from
 * the other — `assertProvenanceDoesNotRaisePrecision` exists in the precision
 * authority precisely so a future attempt has to delete a named guard.
 *
 * At this foundation `precision` is `COUNTRY` and `provenance` is `INTERPRETED`,
 * and both are honest rather than modest: the country attribution comes from the
 * retained corpus's own relevance gate, which is an interpretation of the text,
 * not a location the publisher stated.
 */
export interface SecurityObservationGeography {
  /** ISO 3166-1 alpha-2, upper case. The subject's identity. */
  readonly geographyId: string;
  /** The display name as the retained record carries it. Never re-derived. */
  readonly geographyName: string;
  /** How finely the location is known. */
  readonly precision: SpatialPrecision;
  /** Who established it — STATED by the source, or INTERPRETED by us. */
  readonly provenance: LocationProvenance;
  /**
   * The retained corpus's own relevance score for this (article, country) pair.
   * Carried as the BASIS of the attribution, never as a confidence in the
   * incident: how sure we are that a report concerns Rwanda says nothing about
   * whether the reported thing happened.
   */
  readonly attributionScore: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE CLAIM
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ONE SECURITY CLAIM, IN THE DOMAIN'S OWN CLOSED SHAPE.
 *
 * `headline` and `summary` are the retained record's own text, VERBATIM. They are
 * not a generated description, not a summarisation and not an extraction: §6's
 * `SEC-ADMIT-2` refuses model synthesis outright — *"it has no publisher, no
 * source class and nothing to correct against, and admitting it would make the
 * corpus self-citing"* — and the only way to guarantee no synthesis reaches a
 * Security surface is for the producer to have nothing to write but a copy.
 */
export interface SecurityIncidentClaim {
  readonly claimType: SecurityClaimType;
  /** Always `OCCURRENCE`. The claim cannot be evidence on an axis it never saw. */
  readonly axis: SecurityCoverageAxis;
  /** The publisher's own headline, verbatim. */
  readonly headline: string;
  /** The publisher's own summary, verbatim. */
  readonly summary: string;
  /**
   * The deterministic lexicon terms that admitted this record as a Security
   * candidate. Non-empty by construction: an admission with no term behind it is
   * an admission nobody can reproduce.
   */
  readonly admittedByTerms: readonly string[];
  readonly ownership: SecurityOwnershipEvidence;
}

/**
 * ONE SECURITY OBSERVATION.
 *
 * It IS a `DomainObservation` — every platform guard applies to it unchanged —
 * plus the geography axis Security needs and the generic record deliberately
 * does not carry.
 */
export interface SecurityObservation extends DomainObservation<SecurityIncidentClaim> {
  readonly geography: SecurityObservationGeography;
  /**
   * WHO MADE THE CLAIM, BY NAME. Required, never empty.
   *
   * ── WHY THIS IS ITS OWN FIELD AND NOT `provenance.institution` ──────────
   *
   * Because `SourceProvenance` says so, in its own words: `institution` is the publishing
   * institution *"as the registry names it — 'National Bank of Rwanda', not a domain.
   * Absent for an ordinary news publisher, because a publisher name is not an institution
   * and inventing one would be a guess."* Writing a newspaper's masthead into that field
   * would put a guess where the platform deliberately left a hole.
   *
   * ── AND WHY IT IS REQUIRED ──────────────────────────────────────────────
   *
   * `SEC-EVID-1` is the gate an anonymous artifact fails: it may remain in the record —
   * the fact that it was said is real — and it *"must not enter the evidence set, because
   * a claim shown 'only with its claimant attached' has no claimant to attach."*
   *
   * An observation IS in the evidence set. So the claimant is not optional here: making it
   * optional would let an artifact that failed stage 2 be represented anyway, with the
   * refusal expressed as a blank byline on a reader's screen.
   *
   * It is the PUBLISHER, never the aggregator. GNews and GDELT deliver records; the outlet
   * named in one is who made the claim. Attributing it to the aggregator would give every
   * record in the corpus one claimant and defeat any rule that counts distinct ones.
   */
  readonly claimant: string;
}

export class SecurityObservationRefused extends Error {}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · IDENTITY
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The identity of a Security observation drawn from one retained record.
 *
 * `upstreamAuthority` is the PUBLISHER, not the aggregator that delivered it:
 * the publisher is who assigned the identifier, and two aggregators carrying one
 * article must produce one identity rather than two. `upstreamId` is the
 * record's canonical URL, which is what the retained corpus itself treats as the
 * identity — `ArticlePersistenceService` upserts on `url` and says so.
 *
 * Nothing is minted. `domainObservationKey` refuses an empty upstream id rather
 * than generating one, and that refusal is passed through here unchanged.
 */
export function securityObservationIdentity(
  publisherId: string,
  canonicalUrl: string,
  countryCode?: string,
): DomainObservationIdentity {
  return {
    domainId: SECURITY_DOMAIN_ID,
    upstreamAuthority: publisherId,
    upstreamId: countryCode
      ? JSON.stringify([canonicalUrl, countryCode.trim().toUpperCase()])
      : canonicalUrl,
  };
}

export function securityObservationKey(
  publisherId: string,
  canonicalUrl: string,
  countryCode?: string,
): string {
  return domainObservationKey(securityObservationIdentity(publisherId, canonicalUrl, countryCode));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · THE GUARD
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Which attributes of a Security claim are AUTHORED by whom.
 *
 * PL-B2's model, used for what it is for. `headline` and `summary` are
 * `PUBLISHER_STATED` because they are the publisher's words; `admittedByTerms`
 * and the ownership thresholds are `LOCALLY_ASSERTED` because we derived them.
 * Keeping the two apart is what stops a locally-derived threshold later being
 * cited as something the publisher said.
 */
export const SECURITY_CLAIM_AUTHORSHIP: readonly AttributeAuthorship[] = [
  { attribute: 'headline', authorship: 'PUBLISHER_STATED' },
  { attribute: 'summary', authorship: 'PUBLISHER_STATED' },
  { attribute: 'admittedByTerms', authorship: 'LOCALLY_ASSERTED' },
  { attribute: 'ownership', authorship: 'LOCALLY_ASSERTED' },
];

/**
 * THE ONE ENTRY POINT, composing the platform guard rather than restating it.
 *
 * Every invariant is checked here so a producer cannot construct a
 * partially-validated observation by calling three of four guards — the same
 * rule, and the same sentence, as `assertDomainObservationIsWellFormed`.
 */
export function assertSecurityObservationIsWellFormed(o: SecurityObservation): void {
  /* The platform's own invariants first: key/identity agreement, temporal basis, authorship. */
  assertDomainObservationIsWellFormed(o);

  if (o.identity.domainId !== SECURITY_DOMAIN_ID) {
    throw new SecurityObservationRefused(
      `SEC-OBS-1: observation claims domain '${o.identity.domainId}'. A Security observation ` +
        `carries '${SECURITY_DOMAIN_ID}' and one owner, always.`,
    );
  }

  if ((SECURITY_OBSERVATION_KINDS as readonly string[]).indexOf(o.observationKind) === -1) {
    throw new SecurityObservationRefused(
      `SEC-OBS-2: '${o.observationKind}' is not a declared Security observation kind. A kind ` +
        'without a producer is a slot left open for one.',
    );
  }

  if (o.subjectType !== SECURITY_OBSERVATION_SUBJECT_TYPE) {
    throw new SecurityObservationRefused(
      `SEC-OBS-3: subject type '${o.subjectType}' is not '${SECURITY_OBSERVATION_SUBJECT_TYPE}'.`,
    );
  }

  if (o.claim.axis !== SECURITY_OBSERVED_AXIS) {
    throw new SecurityObservationRefused(
      `SEC-OBS-4: the claim declares axis '${o.claim.axis}'. A retained report is evidence on ` +
        `${SECURITY_OBSERVED_AXIS} and on nothing else — cause is never inferred from ` +
        'occurrence, and actor is never inferred from cause.',
    );
  }

  if (o.claim.headline.trim().length === 0) {
    throw new SecurityObservationRefused(
      "SEC-OBS-5: the claim carries no headline. The publisher's own words are the whole of " +
        'what this observation asserts; with none, there is no claim to make.',
    );
  }

  if (o.claimant.trim().length === 0) {
    throw new SecurityObservationRefused(
      'SEC-OBS-5b: the observation names no claimant. An anonymous artifact may stay in the ' +
        'record and may never enter the evidence set, and an observation IS in the evidence ' +
        'set. A claim shown only with its claimant attached has no claimant to attach.',
    );
  }

  if (o.claim.admittedByTerms.length === 0) {
    throw new SecurityObservationRefused(
      'SEC-OBS-6: the claim names no admitting term. An admission nobody can reproduce is not ' +
        'a deterministic admission.',
    );
  }

  /*
    THE OWNERSHIP REFUSAL. A stored Security observation exists only where the
    accepted resolver returned SECURITY, and the resolver needs T1 true and T2
    decided-false. Recording the thresholds without them supporting the outcome
    would leave a row whose own evidence contradicts its existence.
  */
  const { violenceOrProtectivePosture, organisedArmedActorParticipates } = o.claim.ownership;
  if (violenceOrProtectivePosture !== true) {
    throw new SecurityObservationRefused(
      'SEC-OBS-7: a Security observation whose T1 threshold is not met. Below T1 the accepted ' +
        'ownership rule gives the occurrence to POLITICS, and this domain does not hold it.',
    );
  }
  if (organisedArmedActorParticipates !== false) {
    throw new SecurityObservationRefused(
      'SEC-OBS-8: a Security observation whose T2 threshold is not a decided false. UNDETERMINED ' +
        'is not NOT_MET: an occurrence whose armed-hostility criteria have not been assessed has ' +
        'no incident owner yet, and must not be routed to Security merely because Conflict has ' +
        'not claimed it.',
    );
  }

  if (o.geography.geographyId.trim().length === 0) {
    throw new SecurityObservationRefused(
      'SEC-OBS-9: the observation is attributed to no geography. A Security finding with no ' +
        'place is not a finding a reader can act on.',
    );
  }
  if (o.geography.geographyId !== o.subjectId) {
    throw new SecurityObservationRefused(
      `SEC-OBS-10: subject '${o.subjectId}' and geography '${o.geography.geographyId}' disagree. ` +
        'The subject IS the geography; two spellings of it can drift.',
    );
  }
  if (o.geography.precision === 'UNKNOWN') {
    throw new SecurityObservationRefused(
      'SEC-OBS-11: geographic precision UNKNOWN. An observation that cannot say how well it ' +
        'knows where it happened is not admissible to a Security surface.',
    );
  }
}
