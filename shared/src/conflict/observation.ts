/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CANONICAL CONFLICT OBSERVATION — CF-D2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-CONFLICT-CANONICAL-FOUNDATION-R2. PROPOSED for `shared/src/conflict/observation.ts`.
 * Nothing lands from this file without authorization. No provider. No deployment.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * It is not a news summary with coordinates bolted on. That failure mode is closed
 * STRUCTURALLY rather than by instruction: §0 below proves at compile time that this
 * interface carries no narrative field, so a contributor who wants one has to delete a
 * named assertion in public rather than add a field in private.
 *
 * ── WHAT IS REUSED RATHER THAN MINTED ─────────────────────────────────────
 *
 * Every axis this model needs already exists in accepted shared bytes. Minting a second
 * one is the drift this programme has closed four times.
 *
 *   SourceGeometryKind · GeometryDenotation · GeometryOrigin · GEOMETRY_CRS
 *   assertNotACoercion · PROHIBITED_GEOMETRY_COERCIONS · PartitionUnitLevel
 *                                       shared/src/humanitarian/spatial-geometry.ts
 *   SpatialPrecision · LocationProvenance      promoted by CF-D1 (this package)
 *   ConflictSeverity                           shared/src/conflict.ts
 *   SnapshotAdmissionRecord                    shared/src/official-data/snapshot-admission.ts
 *
 * Conflict mints exactly four things, and each is named here with its reason:
 * the event-type vocabulary, the ownership resolution, the severity STATE wrapper, and
 * the revision vocabulary. Nothing else.
 */

import {
  GEOMETRY_CRS,
  assertNotACoercion,
  type GeometryDenotation,
  type GeometryOrigin,
  type PartitionUnitLevel,
  type SourceAssertedGeometry,
  type SourceGeometryKind,
} from '../humanitarian/spatial-geometry';
import { CONFLICT_SEVERITIES, type ConflictSeverity } from '../conflict';
import type { SpatialPrecision, LocationProvenance } from '../spatial/precision';

/* ═══════════════════════════════════════════════════════════════════════════
 * 0 · THE ANTI-ARTICLE PROOF — CF-D2's FIRST REQUIREMENT, MADE STRUCTURAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "Do not create a news-summary object masquerading as a Conflict event."
 *
 * An instruction is not a contract. `NARRATIVE_FIELD_NAMES` names every field a news
 * summary would arrive wearing, and `ConflictObservationCarriesNoNarrative` fails to
 * compile if any of them appears on the observation. A narrative field is not
 * forbidden here — it is UNREPRESENTABLE, in the same way `attributedActor` is
 * unrepresentable in Part IX.
 */
export const NARRATIVE_FIELD_NAMES = [
  'title',
  'headline',
  'summary',
  'body',
  'description',
  'snippet',
  'excerpt',
  'articleId',
  'articleUrl',
  'content',
  'text',
  'narrative',
] as const;
export type NarrativeFieldName = (typeof NARRATIVE_FIELD_NAMES)[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · IDENTITY — UPSTREAM AND STABLE, OR WITHHELD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "Prefer stable upstream identifiers. Do not use fuzzy matching, AI similarity or
 * confidence scores to collapse events. If an upstream source lacks stable identity,
 * expose that as a producer limitation rather than fabricating canonical sameness."
 *
 * There is no merge function in this module, no similarity input, no threshold and no
 * confidence field. Sameness has exactly one source: an upstream authority's own
 * identifier, namespaced so two authorities cannot collide.
 */
export const CONFLICT_UPSTREAM_AUTHORITIES = ['UCDP_GED'] as const;
export type ConflictUpstreamAuthority = (typeof CONFLICT_UPSTREAM_AUTHORITIES)[number];

/** `cfl:1` — the Conflict subject-handle namespace, beside eco:1 · mkt:1 · sec:1 · ent:1. */
export const CONFLICT_KEY_ENCODING_VERSION = 'cfl:1' as const;

export interface ConflictEventIdentity {
  readonly authority: ConflictUpstreamAuthority;
  /** The authority's OWN identifier, verbatim. Never normalized, never re-minted. */
  readonly upstreamEventId: string;
}

export class ConflictIdentityUnavailable extends Error {}

/**
 * Length-prefixed, so `a:bc` and `ab:c` cannot encode to the same key.
 *
 * THE VALUE IS NOT TRIMMED. An earlier draft trimmed it, and a probe caught that this
 * silently normalized the one field the contract promises to carry verbatim: `'7'` and
 * `'7 '` would have encoded to the same key, asserting a sameness the authority never
 * stated. Emptiness is tested on the trimmed value; the KEY is built from the raw one.
 *
 * Throws rather than returning a fallback. A generated identity would make two
 * different events look different forever and the same event look different on every
 * run — and nothing downstream could tell.
 */
export function conflictEventKey(id: ConflictEventIdentity): string {
  const raw = id.upstreamEventId;
  if (raw.trim().length === 0) {
    throw new ConflictIdentityUnavailable(
      'CF-ID-1: the upstream authority supplied no stable event identifier. This is a ' +
        'PRODUCER LIMITATION and is reported as one. No canonical identity is minted, ' +
        'because a minted identity would assert a sameness nobody established.',
    );
  }
  return `${CONFLICT_KEY_ENCODING_VERSION}:${id.authority.length}:${id.authority}:${raw.length}:${raw}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · EVENT TYPE AND OWNERSHIP
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ORGANISED-VIOLENCE EVENT TYPES. Deliberately coarse and closed.
 *
 * These describe what KIND of organised-violence occurrence the upstream authority
 * recorded. They are NOT a severity, NOT an escalation ladder, and they carry no order:
 * `ARMED_CLASH` is not "worse than" `EXPLOSION_REMOTE_VIOLENCE`. An eighth member is a
 * specification change, not a configuration change — the same rule `CONFLICT_INDICATORS`
 * already carries.
 */
export const CONFLICT_EVENT_TYPES = [
  'ARMED_CLASH',
  'EXPLOSION_REMOTE_VIOLENCE',
  'VIOLENCE_AGAINST_CIVILIANS',
  'SIEGE_OR_ENCIRCLEMENT',
  'AERIAL_OR_NAVAL_ACTION',
  'CEASEFIRE_VIOLATION',
  'EVENT_TYPE_NOT_CLASSIFIED',
] as const;
export type ConflictEventType = (typeof CONFLICT_EVENT_TYPES)[number];

/**
 * OWNERSHIP — G's `CONFLICT_EVENT_OWNERS`, ratified, and now BOUND TO A RULE.
 *
 * G minted the vocabulary with `OWNERSHIP_UNRESOLVED` as the honest default and correctly
 * declined to invent the rule. The rule now exists:
 * MAIN-SECURITY-PARTIX-FINAL-VISUAL-AUTHORITY-R1 closed M-2 with two ordered thresholds
 * over one canonical occurrence —
 *
 *     below T1 (no violence, no protective security posture)   POLITICS
 *     at/above T1, below T2 (violence, no organised armed actor) SECURITY
 *     at/above T2 (an organised armed actor participates)        CONFLICT
 *
 * T2 is never reached without T1, so no occurrence has two owners.
 */
export const CONFLICT_EVENT_OWNERS = [
  'CONFLICT',
  'SECURITY',
  'POLITICS',
  'OWNERSHIP_UNRESOLVED',
] as const;
export type ConflictEventOwner = (typeof CONFLICT_EVENT_OWNERS)[number];

/**
 * The two thresholds as DATA the producer must supply, not as prose it must remember.
 *
 * Both are tri-state. `undefined` means the upstream record does not say — which is not
 * the same as saying no, and must not resolve ownership.
 */
export interface OwnershipThresholds {
  /** T1 — violence occurred, or a protective security posture was taken. */
  readonly violenceOrProtectivePosture: boolean | undefined;
  /** T2 — an organised armed actor is a participant in the violence. */
  readonly organisedArmedActorParticipates: boolean | undefined;
}

export function resolveConflictEventOwner(t: OwnershipThresholds): ConflictEventOwner {
  if (t.violenceOrProtectivePosture === undefined) return 'OWNERSHIP_UNRESOLVED';
  if (t.violenceOrProtectivePosture === false) return 'POLITICS';
  // T1 is met. T2 decides, and an unknown T2 does not default to CONFLICT.
  if (t.organisedArmedActorParticipates === undefined) return 'OWNERSHIP_UNRESOLVED';
  return t.organisedArmedActorParticipates ? 'CONFLICT' : 'SECURITY';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · ACTORS — REPRESENTED WHERE GOVERNED, AND NOWHERE ELSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Part IX's rule, reused without modification: institutions and organised groups only.
 * A natural person has no representation here and cannot acquire one —
 * `SUBJECT_IS_NATURAL_PERSON` is refused at the seam, and PO-1 (ruled) permits a named
 * natural person on no reader surface at all.
 *
 * An actor is never labelled by what it is suspected of. There is no `attributedActor`
 * field, deliberately, for the same reason Part IX has none: to make disagreement
 * unflattenable.
 */
export const CONFLICT_ACTOR_KINDS = [
  'ORGANISED_ARMED_GROUP',
  'STATE_MILITARY',
  'STATE_SECURITY_FORCE',
  'INSTITUTION',
  'ACTOR_UNIDENTIFIED',
] as const;
export type ConflictActorKind = (typeof CONFLICT_ACTOR_KINDS)[number];

export interface ConflictActorRef {
  readonly kind: ConflictActorKind;
  /**
   * The upstream authority's own name for the actor, VERBATIM, or absent.
   *
   * Absent is a first-class state: `ACTOR_UNIDENTIFIED` is a positive statement, not an
   * empty field. Nothing here resolves an actor to a shared entity — that is the Entity
   * primitive's job (`ent:1`) and it passes the person-risk seam, which this module does
   * not reimplement.
   */
  readonly upstreamName?: string;
  /** Set only where the shared Entity primitive resolved it. Never minted here. */
  readonly entityKey?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · GEOGRAPHY — FOUR INDEPENDENT AXES, AND THEY STAY INDEPENDENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CF-D1's rule, carried into the field layout rather than into a comment:
 *
 *     precision  ≠  geometry  ≠  denotation
 *     precision  ≠  provenance
 *
 * Four separate fields. No function in this module derives any one of them from any
 * other, and `assertPrecisionNotInferredFromGeometry` exists so that a future attempt
 * has to delete a named guard.
 */
export interface ConflictGeography {
  /** WHAT SHAPE the source published. */
  readonly geometryKind: SourceGeometryKind;
  /** Opaque. This module never reads, reprojects, simplifies or coerces coordinates. */
  readonly coordinates: unknown;
  readonly crs: typeof GEOMETRY_CRS;
  /** WHAT THE SHAPE MEANS. A point may denote a reported centroid; it never denotes an area. */
  readonly denotation: GeometryDenotation;
  /** WHETHER WE MADE IT. `DERIVED` never becomes `SOURCE_NATIVE` by being stored. */
  readonly origin: GeometryOrigin;
  /** HOW FINELY the location is known. Never raised by provenance, never read off coordinates. */
  readonly precision: SpatialPrecision;
  /** HOW WE CAME TO KNOW IT. Orthogonal to precision in both directions. */
  readonly locationProvenance: LocationProvenance;
  /** The administrative unit level, where the source published one. */
  readonly partitionUnitLevel?: PartitionUnitLevel;
  /** ISO 3166-1 alpha-3, where the source published one. Never inferred from coordinates. */
  readonly countryIso3?: string;
}

export class ConflictGeographyRefused extends Error {}

/**
 * EXACT IS NEVER ASSIGNED BECAUSE COORDINATES EXIST.
 *
 * This is the single most likely way a Conflict producer quietly lies: UCDP GED
 * publishes latitude and longitude for a great many events at `adm2` confidence, and a
 * naive adapter reads "there are coordinates" as "the location is exact". Coordinates
 * are a GEOMETRY fact. Exactness is a PRECISION fact. They are different axes.
 */
export function assertPrecisionNotInferredFromGeometry(g: ConflictGeography): void {
  if (g.precision === 'EXACT' && g.origin === 'DERIVED') {
    throw new ConflictGeographyRefused(
      'CF-GEO-1: EXACT precision on DERIVED geometry. A shape we produced cannot be ' +
        'evidence that the source knew the location exactly.',
    );
  }
  if (g.precision === 'EXACT' && g.locationProvenance !== 'STATED') {
    throw new ConflictGeographyRefused(
      `CF-GEO-2: EXACT precision with ${g.locationProvenance} provenance. Interpreted or ` +
        'contested geography may never upgrade itself to stronger evidence merely because ' +
        'it was normalized (Spatial Intelligence v1.7).',
    );
  }
  if (g.precision === 'EXACT' && g.denotation === 'SOURCE_REPORTED_CENTROID') {
    throw new ConflictGeographyRefused(
      'CF-GEO-3: EXACT precision on a reported centroid. A centroid is the middle of an ' +
        'area someone else chose; it is the definition of not-exact.',
    );
  }
  if (g.denotation === 'AFFECTED_AREA' && (g.geometryKind === 'POINT' || g.geometryKind === 'MULTIPOINT')) {
    throw new ConflictGeographyRefused(
      'CF-GEO-4: a point may not denote an AFFECTED_AREA. Area→point is a prohibited ' +
        'coercion, and doing it in the denotation field rather than in the coordinates ' +
        'is the same coercion wearing a different hat.',
    );
  }
}

/**
 * Coercion refusal is DELEGATED, not restated.
 *
 * `assertNotACoercion` is the accepted consumer of `PROHIBITED_GEOMETRY_COERCIONS`
 * (`POLYGON_TO_CENTROID_FOR_RENDERING`, `BBOX_TO_POINT`, `LINE_TO_ENDPOINT`,
 * `ANY_GEOMETRY_TO_POINT_TO_SATISFY_A_RENDERER` …). Conflict calls it. A second
 * coercion table is exactly the drift this module refuses.
 */
/*
  ── INTEGRATION RECONCILIATION · THE DELEGATION NOW ACTUALLY CALLS THE ACCEPTED GUARD ──

  As delivered this took two `SourceGeometryKind` values and passed them to
  `assertNotACoercion`. That does not compile against the landed
  `shared/src/humanitarian/spatial-geometry.ts`, whose accepted `assertNotACoercion` takes
  two `SourceAssertedGeometry` RECORDS.

  The mismatch is not cosmetic. `assertNotACoercion` carries the GX-11 repair, and its own
  docblock records what the repair WAS:

      "R1 compared `kind` only, was skipped entirely when the presented record was
       DERIVED, and was never called by the render path … All four are closed."

  A kind-only signature is exactly the shape GX-11 was repaired to stop relying on. A
  coercion cannot be decided from two kinds: the guard needs `origin` to know whether
  anything was transformed at all, `sourceId` to know a geometry did not change publisher
  on the way out, and the coordinates to catch a same-kind reshape.

  Of the two ways to make this compile, only one preserves an accepted safety property:

    · weaken `spatial-geometry` with a kind-level export  -> undoes the GX-11 repair
    · widen THIS signature to the records the guard needs -> preserves it in full

  The second is taken. It weakens nothing, adds no vocabulary and no second coercion table,
  and changes a signature nothing yet calls. **Main's CF-GEO-5 probe calls this with kinds
  and therefore fails against the real module — it passes only against
  `CF-probes.shared-stub.js`, whose `assertNotACoercion(from, to)` is labelled a "faithful
  stand-in" but takes kinds and performs none of the record-level checks.** That divergence
  is reported rather than absorbed, and the final shape is Main's to ratify.
*/
export function assertConflictGeometryTransformIsPermitted(
  presented: SourceAssertedGeometry,
  sourceNative: SourceAssertedGeometry,
): void {
  assertNotACoercion(presented, sourceNative);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · TIME — THREE TIMESTAMPS, NEVER COLLAPSED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Market discipline, reused: `publisherVintage` / `publisherChangedAt` /
 * `ingestedAt` with a field saying WHICH ONE the record is actually carrying, bound at
 * write and never inferred at read.
 *
 * Conflict adds one axis Market does not have: an event has its OWN time, distinct from
 * when anybody published anything about it.
 */
export const CONFLICT_TEMPORAL_PROVENANCES = [
  'EVENT_DATED_BY_SOURCE',
  'EVENT_DATE_RANGE_BY_SOURCE',
  'PUBLICATION_DATE_ONLY',
] as const;
export type ConflictTemporalProvenance = (typeof CONFLICT_TEMPORAL_PROVENANCES)[number];

export interface ConflictTemporal {
  /** When the EVENT happened, as the source states it. ISO-8601. */
  readonly eventStartedAt: string;
  /** Set only where the source publishes a range. Absent is not "same day". */
  readonly eventEndedAt?: string;
  /** When the SOURCE recorded or last changed the record. */
  readonly publisherRecordedAt?: string;
  /** When WE saw it. */
  readonly ingestedAt: string;
  /** WHICH of the above the event time is actually carrying. Bound at write. */
  readonly temporalProvenance: ConflictTemporalProvenance;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · SEVERITY — CF-D5. THREE STATES, AND THE MIDDLE ONE IS UNREACHABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "If the accepted system does not yet have sufficient deterministic evidence for a
 * severity, the canonical value must remain unavailable. Do not infer severity from
 * article language or provider tone."
 */
export const SEVERITY_UNAVAILABLE_REASONS = [
  'NO_ACCEPTED_DERIVATION_RULE',
  'PUBLISHER_STATES_NONE',
  'INPUTS_INCOMPLETE',
  'SOURCE_SCALE_NOT_MAPPED',
] as const;
export type SeverityUnavailableReason = (typeof SEVERITY_UNAVAILABLE_REASONS)[number];

/**
 * THE ACCEPTED DERIVATION RULES. THE LIST IS EMPTY, AND THAT IS THE RULING.
 *
 * `GNAI_DERIVED` exists in the union so it can be refused — a state that cannot be named
 * cannot be refused — and its `ruleId` is typed against this registry. Because the
 * registry is empty, `AcceptedSeverityDerivationRuleId` is `never`, and **no
 * `GNAI_DERIVED` value can be constructed at all**. The refusal is the type system's,
 * not a reviewer's.
 */
export const ACCEPTED_SEVERITY_DERIVATION_RULES = [] as const;
export type AcceptedSeverityDerivationRuleId =
  (typeof ACCEPTED_SEVERITY_DERIVATION_RULES)[number];

export type ConflictSeverityState =
  | {
      /** The PUBLISHER said it, on the publisher's own scale, and we say whose scale it is. */
      readonly kind: 'PUBLISHER_STATED';
      readonly value: ConflictSeverity;
      readonly publisherAuthority: ConflictUpstreamAuthority;
      /** The publisher's own scale identifier. Without it the value has no meaning. */
      readonly publisherScaleRef: string;
    }
  | {
      /** Deterministic, GlobalNews AI-derived, from a NAMED ACCEPTED RULE. Unreachable today. */
      readonly kind: 'GNAI_DERIVED';
      readonly value: ConflictSeverity;
      readonly ruleId: AcceptedSeverityDerivationRuleId;
      /** The exact counted inputs the rule consumed. A rule with no inputs is a guess. */
      readonly inputs: Readonly<Record<string, number>>;
    }
  | {
      readonly kind: 'UNAVAILABLE';
      readonly reason: SeverityUnavailableReason;
    };

/** The only severity any Conflict producer may construct today. */
export const SEVERITY_UNAVAILABLE_NO_RULE: ConflictSeverityState = Object.freeze({
  kind: 'UNAVAILABLE',
  reason: 'NO_ACCEPTED_DERIVATION_RULE',
});

export function severityIsDisplayable(s: ConflictSeverityState): boolean {
  return s.kind !== 'UNAVAILABLE';
}

/** Total, so a new member cannot be added without deciding what it displays as. */
export function severityValueOrNull(s: ConflictSeverityState): ConflictSeverity | null {
  switch (s.kind) {
    case 'PUBLISHER_STATED':
      return s.value;
    case 'GNAI_DERIVED':
      return s.value;
    case 'UNAVAILABLE':
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7 · SOURCE REFERENCE — A CITATION IS NOT AN ADDRESS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G's third control caught this and it is adopted verbatim: UCDP's `source_article` is
 * `"Radio Dabanga, 2026-03-15"` — a bibliographic citation, not a URL. A field named
 * `sourceUrl` holding a citation produces a link that goes nowhere and a provenance
 * claim that is false.
 */
export interface ConflictSourceReference {
  /** The publisher's own citation text, VERBATIM. Never parsed into a URL. */
  readonly citation?: string;
  /** The reporting office or desk, where the source names one. */
  readonly reportingOffice?: string;
  /** A real address, ONLY where the source published one as an address. */
  readonly sourceUrl?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 · ACQUISITION PROVENANCE — THE PLATFORM'S, NOT A SECOND ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CF-D6 rules reuse of the accepted snapshot/admission substrate. The observation
 * therefore cites a RETRIEVAL, not bytes — `SNAP-R2-6` / `S-3`, the same pair Market
 * uses, for the same reason: two providers can serve byte-identical JSON and one may
 * fail the provenance check, so an address-only citation lets one provider's admission
 * launder the other's refusal.
 *
 * NULLABLE, and per-row. The lesson from MAIN-MARKET-SOURCECLASS-SNAPSHOT-CLOSEOUT-R1 is
 * carried in: "the seam is final" and "this row rests on an admitted capture" are two
 * different statements, and only the second is per-observation.
 */
export interface ConflictAcquisitionProvenance {
  readonly snapshotRetrievalId: string | null;
  /** Pinned to 'ADMITTED' by the composite key. Read, never re-derived. */
  readonly snapshotAdmissibility: 'ADMITTED' | null;
  /** The ingest run that wrote this row. */
  readonly runId: string;
}

export function observationRestsOnAdmittedCapture(p: ConflictAcquisitionProvenance): boolean {
  return p.snapshotRetrievalId !== null && p.snapshotAdmissibility === 'ADMITTED';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9 · REVISION — APPEND, NEVER OVERWRITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "A Conflict event may change over time. Preserve history for location corrections,
 * event classification, casualty/impact metadata, source revisions, retractions where
 * supported. Do not silently overwrite prior evidence."
 */
export const CONFLICT_REVISION_KINDS = [
  'LOCATION_CORRECTION',
  'CLASSIFICATION_CHANGE',
  'IMPACT_METADATA_CHANGE',
  'SOURCE_REVISION',
  'RETRACTION',
] as const;
export type ConflictRevisionKind = (typeof CONFLICT_REVISION_KINDS)[number];

export interface ConflictRevision {
  /** 0 for the first observation of an event. Strictly increasing, never reused. */
  readonly revisionOrdinal: number;
  /** The revision this one supersedes. `null` only at ordinal 0. */
  readonly supersedesRevisionOrdinal: number | null;
  /** Absent at ordinal 0: the first record of an event revises nothing. */
  readonly revisionKind?: ConflictRevisionKind;
  /** The upstream authority's own version/edition marker, where it publishes one. */
  readonly upstreamVersion?: string;
  readonly recordedAt: string;
}

export class ConflictRevisionRefused extends Error {}

/**
 * A RETRACTION IS A STATE, NOT A DELETE — the `WITHDRAWN` precedent, reused.
 *
 * A retracted event keeps every prior revision exactly where it was. The retraction is
 * the newest revision, and it says so. Nothing is rewritten and nothing is removed,
 * because "this was reported and later retracted" is itself evidence.
 */
export function assertRevisionAppends(prior: ConflictRevision, next: ConflictRevision): void {
  if (next.revisionOrdinal <= prior.revisionOrdinal) {
    throw new ConflictRevisionRefused(
      `CF-REV-1: revision ${next.revisionOrdinal} does not follow ${prior.revisionOrdinal}. ` +
        'Revisions append; an ordinal that does not increase is an overwrite wearing a ' +
        'revision number.',
    );
  }
  if (next.revisionOrdinal !== prior.revisionOrdinal + 1) {
    throw new ConflictRevisionRefused(
      `CF-REV-2: revision ${next.revisionOrdinal} does not immediately follow ` +
        `${prior.revisionOrdinal}. Ordinals are CONTIGUOUS so that "is a revision ` +
        'missing" is answerable from the chain alone. A linked chain with a gap in its ' +
        'numbering cannot distinguish a lost record from a skipped label.',
    );
  }
  if (next.supersedesRevisionOrdinal !== prior.revisionOrdinal) {
    throw new ConflictRevisionRefused(
      `CF-REV-2b: revision ${next.revisionOrdinal} claims to supersede ` +
        `${String(next.supersedesRevisionOrdinal)}, but the prior revision is ` +
        `${prior.revisionOrdinal}. The link and the ordinal must agree; checking only one ` +
        'leaves the other free to drift.',
    );
  }
  if (next.revisionKind === undefined) {
    throw new ConflictRevisionRefused(
      'CF-REV-3: a revision past ordinal 0 states what KIND of change it is. An ' +
        'unexplained change is indistinguishable from a correction of a correction.',
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10 · THE OBSERVATION
 * ═══════════════════════════════════════════════════════════════════════════ */

export const CONFLICT_WITHHOLD_REASONS = [
  'EVENT_IDENTITY_DEPENDENCY',
  'OWNERSHIP_UNRESOLVED',
  'GEOGRAPHY_UNUSABLE',
  'DATE_UNUSABLE',
  'SCHEMA_FIELD_ABSENT',
  'SCHEMA_NOT_CONFIRMED_BY_CAPTURE',
] as const;
export type ConflictWithholdReason = (typeof CONFLICT_WITHHOLD_REASONS)[number];

export interface ConflictObservation {
  /** `conflictEventKey(identity)`. The row's own key, derived from nothing else. */
  readonly observationKey: string;
  readonly identity: ConflictEventIdentity;
  readonly eventType: ConflictEventType;
  readonly owner: ConflictEventOwner;
  readonly actors: readonly ConflictActorRef[];
  readonly geography: ConflictGeography;
  readonly temporal: ConflictTemporal;
  readonly severity: ConflictSeverityState;
  readonly sourceReference: ConflictSourceReference;
  readonly acquisition: ConflictAcquisitionProvenance;
  readonly revision: ConflictRevision;
}

/**
 * §0's proof. If a narrative field is ever added to `ConflictObservation`, this type
 * resolves to `never` and every file importing it fails to compile.
 */
export type ConflictObservationCarriesNoNarrative =
  Extract<keyof ConflictObservation, NarrativeFieldName> extends never ? true : never;
export const CONFLICT_OBSERVATION_CARRIES_NO_NARRATIVE: ConflictObservationCarriesNoNarrative = true;

/**
 * THE SCHEMA GATE — G's `assertRecordShapeWasCaptured`, carried into the canonical layer.
 *
 * No UCDP field name appears anywhere in this module. The canonical model is defined in
 * its own terms and an adapter maps onto it, so a later validated UCDP adapter binds
 * without this contract changing. `UCDP_GED` appears once, as an AUTHORITY IDENTIFIER
 * for namespacing identity — which is not a field shape and is not a claim about one.
 */
/**
 * CF-D4 CLOSED on Alpha, 2026-09-20.
 *
 * Captured directly from UCDP Candidate GED 26.0.7 over HTTPS:
 *   Content-Type  text/csv
 *   bytes         1,357,690
 *   sha256        9fc2c6dd85eee91845512e8ef1055281d9fd028fb98748a6f2a27c6e8aa8c562
 *   columns       49
 *
 * The provider adapter pins the exact captured header; this flag therefore means
 * "real bytes measured", not "the codebook looked plausible".
 */
export const CONFLICT_SCHEMA_CAPTURE_EVIDENCE = Object.freeze({
  UCDP_GED: Object.freeze({
    datasetVersion: '26.0.7',
    capturedAt: '2026-09-20',
    byteLength: 1_357_690,
    sha256: '9fc2c6dd85eee91845512e8ef1055281d9fd028fb98748a6f2a27c6e8aa8c562',
    columnCount: 49,
  }),
});

export const CONFLICT_SCHEMA_CONFIRMED_BY_CAPTURE: Readonly<
  Record<ConflictUpstreamAuthority, boolean>
> = Object.freeze({ UCDP_GED: true });

export class ConflictSchemaNotConfirmed extends Error {}

export function assertSchemaConfirmedByCapture(authority: ConflictUpstreamAuthority): void {
  if (!CONFLICT_SCHEMA_CONFIRMED_BY_CAPTURE[authority]) {
    throw new ConflictSchemaNotConfirmed(
      `CF-CAP-1: ${authority}'s record shape has not been confirmed by a captured ` +
        'response. The canonical model is defined without reference to its field names, ' +
        'so it is safe to hold; an adapter that binds to it is not safe to run until ' +
        'bytes exist. CF-D4 owns the capture.',
    );
  }
}

/** Every vocabulary this module minted, in one place, for the integration doc to cite. */
export const CONFLICT_OBSERVATION_VOCABULARIES = Object.freeze({
  CONFLICT_EVENT_TYPES,
  CONFLICT_EVENT_OWNERS,
  CONFLICT_ACTOR_KINDS,
  CONFLICT_TEMPORAL_PROVENANCES,
  SEVERITY_UNAVAILABLE_REASONS,
  CONFLICT_REVISION_KINDS,
  CONFLICT_WITHHOLD_REASONS,
  CONFLICT_SEVERITIES,
});
