import type {
  GeoPrecision,
  GeoProvenance,
  GeoResolution,
} from '../../geo/geo-resolver';
import type { QuestionKind, SpecialistClaimRequest } from '@globalnews-ai/shared';

/**
 * P3 — CLAIM-REQUEST FORMATION / CANONICAL INTENT-CONTEXT RESOLUTION. THE CONTRACT.
 *
 * Executable form of P3-CONTRACT-R1
 * (sha256 50fc18660642bc8e8b8d0f46e597bd5b4f1955789b6a5bd04c86cba36a613072).
 *
 * P3 IS A SIBLING OF P2, NOT A PART OF IT. This module imports P2's CONTRACT TYPES from
 * `@globalnews-ai/shared` and nothing else of P2: not `SpecialistClaimRegistry`, not
 * `SpecialistModule`. IT NEVER CALLS P2. It returns a value and the caller carries it. So a defect
 * in formation can never be a defect in the registry, and P2 needed no edit for this to land.
 *
 * IT NEVER NAMES A DOMAIN. The output type cannot carry a domain id, nothing here imports
 * `modules/conflict-claim/`, and the former does not know that a domain called CONFLICT exists. It
 * emits CANONICAL question kinds; who owns them is P2's answer. A kind no domain claims resolves
 * UNCLAIMED — the honest state — so drift between a mapping and a registration degrades gracefully
 * instead of misrouting.
 *
 * AI CONTRIBUTION TO ROUTING IS ZERO. No model call, no provider call, no probability, no scoring
 * is reachable from this module or anything it imports.
 */

/**
 * The structured signals a mapping may read.
 *
 * `subjectIsHostility` IS POSITIVE-EVIDENCE ONLY, AND THE TYPE SAYS SO: it is `true` or ABSENT, and
 * there is deliberately no `false`. "No recognised evidence" is not a claim that the question is not
 * about hostility; it is the absence of evidence, and it produces no kinds. A boolean would have
 * invited `NOT_HOSTILITY` reasoning that the ruling forbids.
 */
export interface FormationSignals {
  readonly subjectIsHostility?: true;
  readonly objectType?: string;
  readonly geographyPrecision?: GeoPrecision;
  readonly geographyProvenance?: GeoProvenance;
}

/** What the navigator already has open. P3 re-derives none of it from text. */
export interface NavigatorObjectRef {
  /** What the navigator calls the open object. P3 validates it against NO vocabulary. */
  readonly objectType: string;
  readonly objectId?: string;
}

/**
 * `TTime` DEFAULTS TO `never`, so a time window CANNOT BE SUPPLIED until an authoritative shared
 * contract exists. Absence is the type, not a convention, and P3 defines no TimeWindow taxonomy.
 */
export interface NavigatorContext<TGeo = GeoResolution, TTime = never> {
  readonly object?: NavigatorObjectRef;
  /** Geography the navigator already resolved. Absent means "not resolved" — never "global". */
  readonly geography?: TGeo;
  readonly timeWindow?: TTime;
}

export interface ClaimRequestFormationInput<TGeo = GeoResolution, TTime = never> {
  /** The user's words, as typed. Consumed only by resolvers P3 does not own. */
  readonly rawText: string;
  readonly navigator: NavigatorContext<TGeo, TTime>;
}

export type MissingContext = 'GEOGRAPHY' | 'TIME_WINDOW' | 'OBJECT';

export type UnformedReason = 'NO_MAPPING_MATCHED';

export interface MappingProvenance {
  /** Which approved mapping version produced the kinds. Every formation is reproducible from this. */
  readonly mappingVersion: string;
  /** The exact structured signals the mapping saw. Audit only; never rendered. */
  readonly signals: FormationSignals;
}

/**
 * A ratified mapping version.
 *
 * `requiresContext` is what makes the CTO's clarification structural rather than prose: absent
 * geography, object or time does NOT by itself force INSUFFICIENT_CONTEXT. FORMED means the evidence
 * THIS mapping requires is present. A version that needs no structured context declares `[]`, and
 * INSUFFICIENT_CONTEXT is then unreachable for it — which is a fact about that version, not a
 * weakening of the status.
 */
export interface ApprovedKindMapping {
  readonly version: string;
  /** The document this version was approved against, by sha256. The filename is not the authority. */
  readonly approvedAgainstSha256: string;
  readonly requiresContext: readonly MissingContext[];
  /** Pure. Same signals, same kinds, always. No clock, no I/O, no model. */
  derive(signals: FormationSignals): readonly QuestionKind[];
}

/**
 * THREE STATUSES, AND ONLY ONE CARRIES A REQUEST.
 *
 * That is the ruling "partial context does not route" made structural: a caller holding
 * INSUFFICIENT_CONTEXT or INTENT_UNFORMED has nothing of type SpecialistClaimRequest to hand P2, so
 * the prohibition is enforced by the type rather than by discipline. INTENT_UNFORMED carries no
 * kinds either, so an empty-kinds call to P2 cannot be constructed.
 */
export type ClaimRequestFormation<TGeo = GeoResolution, TTime = never> =
  | {
      readonly status: 'FORMED';
      readonly request: SpecialistClaimRequest<TGeo, TTime>;
      readonly provenance: MappingProvenance;
    }
  | {
      readonly status: 'INSUFFICIENT_CONTEXT';
      readonly candidateKinds: readonly QuestionKind[];
      readonly missing: readonly MissingContext[];
      readonly provenance: MappingProvenance;
    }
  | {
      readonly status: 'INTENT_UNFORMED';
      readonly reason: UnformedReason;
    };
