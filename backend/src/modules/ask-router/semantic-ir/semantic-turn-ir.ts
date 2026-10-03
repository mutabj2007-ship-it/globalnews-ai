import { DISPLAY_LOCALES, findCountryByIso3, type DisplayLocale } from '@globalnews-ai/shared';
import type { RelationKind } from '../bilateral-relationship';
import {
  TRANSFORMATIONS,
  USER_JOBS,
  type Depth,
  type TransformationKind,
  type UserJob,
} from '../user-job';
import type { EntityType } from './entities';
import type { ObjectiveState } from './objective-state';
import type { IrEntityRole, RelationBasis } from './roles';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §2 — THE SEMANTIC TURN INTERPRETATION (one closed, validated structure)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The ONE authority for what a reader's turn means. Readers (knowledge requirement, user job,
 * temporal semantics, clause intent, entities, roles, objective, references) contribute
 * CANDIDATE signals; one composition step (interpret-turn.ts) resolves them into this structure;
 * routing consumes it and never re-reads the raw text to override it.
 *
 * It holds MEANING and ROUTING METADATA only: closed codes, canonical ids, and spans / surfaces
 * that are verbatim substrings of the reader's own words. It never holds an external fact, a
 * model's prose, an answer, a citation or a source claim. `validateSemanticTurnIR` enforces it.
 */
export const SEMANTIC_IR_VERSION = 1;

export type IrFreshness = 'NONE' | 'CURRENT' | 'MIXED';
export type IrEvidence = 'NONE' | 'CURRENT_REPORTING' | 'OFFICIAL' | 'DETERMINISTIC';
export type IrTemporalRole =
  | 'NONE'
  | 'CURRENT_STATE'
  | 'RECENT'
  | 'REPORTING_WINDOW'
  | 'SINCE_PAST_TO_PRESENT'
  | 'HISTORICAL'
  | 'HISTORICAL_AND_CURRENT'
  | 'CONTEMPORARY'
  | 'FUTURE'
  | 'PLAN_HORIZON';
export type IrClauseJob =
  | 'EXPLANATION'
  | 'CURRENT_REPORTING'
  | 'HISTORICAL_REFERENCE'
  | 'REQUEST'
  | 'CONTEXT_STATEMENT'
  | 'UNRESOLVED';
export type IrReferenceTarget =
  'NONE' | 'ARTIFACT' | 'ARTIFACT_COMPONENT' | 'CHOICE_SET' | 'PORTABLE_SUBJECT';
export type IrConflict =
  /** a stable question frame + an explicit current marker (the frame lost; confirm) */
  | 'STABLE_SHAPE_WITH_CURRENT_MARKER'
  /** a weak (present-era) currentness inside an explanation */
  | 'WEAK_CURRENTNESS_IN_EXPLANATION'
  /** a past-tense causal question about a particular event, with no date and no present marker */
  | 'TEMPORAL_AMBIGUOUS'
  /** several clauses, one of which no reader could classify */
  | 'CLAUSE_INTENT_UNRESOLVED'
  /** a third place with no grammatical role besides two actors */
  | 'GEO_ROLES_UNRESOLVED'
  /** a relation predicate between places whose roles are not recoverable */
  | 'RELATION_ROLES_UNCLEAR'
  /** a reference ("which one", "that") with no target in the bounded state */
  | 'REFERENCE_UNRESOLVED'
  /** no governed form and no currentness evidence (the R4 UNRESOLVED job) */
  | 'JOB_UNRESOLVED';
export const IR_CONFLICTS: readonly IrConflict[] = [
  'STABLE_SHAPE_WITH_CURRENT_MARKER',
  'WEAK_CURRENTNESS_IN_EXPLANATION',
  'TEMPORAL_AMBIGUOUS',
  'CLAUSE_INTENT_UNRESOLVED',
  'GEO_ROLES_UNRESOLVED',
  'RELATION_ROLES_UNCLEAR',
  'REFERENCE_UNRESOLVED',
  'JOB_UNRESOLVED',
];

export interface IrClause {
  readonly id: number;
  /** [start, end) in the text the readers read (the normalized reader text) */
  readonly span: readonly [number, number];
  readonly job: IrClauseJob;
  readonly freshness: 'NONE' | 'CURRENT';
  readonly evidence: 'NONE' | 'CURRENT_REPORTING';
  readonly temporalRole: IrTemporalRole;
}

export interface IrEntity {
  /** canonical id (COUNTRY:ISO3 · TERRITORY:ISO3 · REGION:KEY · CITY:ISO2:Name) */
  readonly id: string;
  readonly type: EntityType;
  readonly iso3: string | null;
  readonly parentIso3: string | null;
  /** verbatim from the reader's text */
  readonly surface: string;
  readonly span: readonly [number, number];
  readonly role: IrEntityRole;
}

export interface IrRelationship {
  readonly actorA: string;
  readonly actorB: string;
  readonly relation: readonly RelationKind[];
  readonly object: string | null;
  readonly venue: string | null;
  readonly temporalRole: IrTemporalRole;
  readonly basis: RelationBasis;
}

export interface IrReferences {
  /** the KIND of earlier model work referenced (never its content) */
  readonly artifact: string | null;
  readonly objective: boolean;
  readonly choiceSet: boolean;
  readonly target: IrReferenceTarget;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SemanticTurnIR {
  readonly version: typeof SEMANTIC_IR_VERSION;
  /** CTO R4 seven-language — the declared product language (never inferred, never translated) */
  readonly language: DisplayLocale;
  readonly turn: {
    readonly primaryJob: UserJob | null;
    readonly depth: Depth;
    readonly freshness: IrFreshness;
    readonly evidence: IrEvidence;
    readonly transformation: TransformationKind | null;
    readonly temporalRole: IrTemporalRole;
    readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  readonly clauses: readonly IrClause[];
  readonly entities: readonly IrEntity[];
  readonly relationships: readonly IrRelationship[];
  readonly references: IrReferences;
  readonly objective: ObjectiveState | null;
  readonly resolution: {
    /** DETERMINISTIC fast path · SEMANTIC (the bounded interpreter decided) · FALLBACK (the
     *  interpreter was needed but unavailable / invalid → the governed conservative default) */
    readonly path: 'DETERMINISTIC' | 'SEMANTIC' | 'FALLBACK';
    readonly needsSemanticResolution: boolean;
    readonly conflicts: readonly IrConflict[];
    /**
     * HARDENING §2 — how complete the DETERMINISTIC interpretation is (before any interpreter):
     *   COMPLETE     every routing-material field is established by structure
     *   PARTIAL      no reader disagrees, but a routing-material field is not established
     *   AMBIGUOUS    the words admit two readings (a time anchor + a present marker, a weak
     *                present-era claim, a reference with no target)
     *   CONFLICTING  readers disagree (stable shape vs explicit present; roles)
     *   UNRESOLVED   no governed form and no currentness evidence: the job itself is unknown
     * "No reader matched" never equals COMPLETE.
     */
    readonly completeness: IrCompleteness;
    /** the routing-material fields the deterministic interpretation could not establish */
    readonly unresolvedFields: readonly IrMaterialField[];
  };
}

export type IrCompleteness = 'COMPLETE' | 'PARTIAL' | 'AMBIGUOUS' | 'CONFLICTING' | 'UNRESOLVED';
export const IR_COMPLETENESS: readonly IrCompleteness[] = [
  'COMPLETE',
  'PARTIAL',
  'AMBIGUOUS',
  'CONFLICTING',
  'UNRESOLVED',
];
export type IrMaterialField =
  | 'JOB'
  | 'FRESHNESS'
  | 'EVIDENCE'
  | 'ACTOR_ROLES'
  | 'RELATIONSHIP'
  | 'MIXED'
  | 'PRIOR_WORK_REFERENCE'
  | 'DECISION_OBJECTIVE';
export const IR_MATERIAL_FIELDS: readonly IrMaterialField[] = [
  'JOB',
  'FRESHNESS',
  'EVIDENCE',
  'ACTOR_ROLES',
  'RELATIONSHIP',
  'MIXED',
  'PRIOR_WORK_REFERENCE',
  'DECISION_OBJECTIVE',
];
/**
 * Fields the ONE bounded interpreter can establish from the turn and the bounded state. The
 * decision objective cannot be: it comes only from the reader's own words, which the interpreter
 * never receives beyond the bounded state — when it is missing, the governed outcome is the
 * focused "best for what?" clarification, at zero compute.
 */
export const INTERPRETABLE_FIELDS: ReadonlySet<IrMaterialField> = new Set([
  'JOB',
  'FRESHNESS',
  'EVIDENCE',
  'ACTOR_ROLES',
  'RELATIONSHIP',
  'MIXED',
  'PRIOR_WORK_REFERENCE',
]);

const FRESHNESS: readonly IrFreshness[] = ['NONE', 'CURRENT', 'MIXED'];
const EVIDENCE: readonly IrEvidence[] = ['NONE', 'CURRENT_REPORTING', 'OFFICIAL', 'DETERMINISTIC'];
const ROLES: readonly IrEntityRole[] = [
  'ACTOR',
  'COUNTERPART',
  'LOCATION',
  'DISPUTED_OBJECT',
  'CORRIDOR',
  'VENUE',
  'INSTITUTION',
  'COMPARISON_MEMBER',
  'SCOPE',
];

/** Does a deterministic interpretation need the ONE bounded semantic call? */
export function shouldEscalate(
  conflicts: readonly IrConflict[],
  unresolvedFields: readonly IrMaterialField[],
): boolean {
  return conflicts.length > 0 || unresolvedFields.some((f) => INTERPRETABLE_FIELDS.has(f));
}

/** The completeness of a deterministic interpretation, from its conflicts and gaps. */
export function completenessOf(
  conflicts: readonly IrConflict[],
  unresolvedFields: readonly IrMaterialField[],
): IrCompleteness {
  if (conflicts.includes('JOB_UNRESOLVED')) return 'UNRESOLVED';
  if (
    conflicts.some(
      (c) =>
        c === 'STABLE_SHAPE_WITH_CURRENT_MARKER' ||
        c === 'GEO_ROLES_UNRESOLVED' ||
        c === 'RELATION_ROLES_UNCLEAR',
    )
  )
    return 'CONFLICTING';
  if (conflicts.length > 0) return 'AMBIGUOUS';
  return unresolvedFields.length > 0 ? 'PARTIAL' : 'COMPLETE';
}

/**
 * Validate an IR against its closed schema and its invariants. Returns every violation (empty =
 * valid). `text` is the reader text the spans index into.
 */
export function validateSemanticTurnIR(ir: SemanticTurnIR, text: string): string[] {
  const v: string[] = [];
  if (ir.version !== SEMANTIC_IR_VERSION) v.push('VERSION');
  if (!(DISPLAY_LOCALES as readonly string[]).includes(ir.language)) v.push('LANGUAGE');
  const t = ir.turn;
  if (t.primaryJob !== null && !(USER_JOBS as readonly string[]).includes(t.primaryJob))
    v.push('JOB_VOCABULARY');
  if (!FRESHNESS.includes(t.freshness)) v.push('FRESHNESS_VOCABULARY');
  if (!EVIDENCE.includes(t.evidence)) v.push('EVIDENCE_VOCABULARY');
  if (
    t.transformation !== null &&
    !(TRANSFORMATIONS as readonly string[]).includes(t.transformation)
  )
    v.push('TRANSFORMATION_VOCABULARY');
  /* freshness and evidence agree */
  if (t.freshness !== 'NONE' && t.evidence === 'NONE') v.push('CURRENT_WITHOUT_EVIDENCE');
  if (t.freshness === 'NONE' && t.evidence === 'CURRENT_REPORTING')
    v.push('EVIDENCE_WITHOUT_CURRENTNESS');
  if (
    t.freshness === 'MIXED' &&
    ir.clauses.length < 2 &&
    t.temporalRole !== 'HISTORICAL_AND_CURRENT' &&
    /* defect 4 — a decision whose criterion is time-anchored: the criterion is the current part */
    ir.objective === null &&
    /* defect 2 — earlier work re-examined against the present: the work is the other component */
    (ir.references.artifact === null || ir.references.target === 'NONE')
  )
    v.push('MIXED_WITHOUT_TWO_COMPONENTS');
  for (const c of ir.clauses)
    if (c.span[0] < 0 || c.span[1] > text.length || c.span[0] > c.span[1])
      v.push(`CLAUSE_SPAN:${c.id}`);
  const ids = new Set<string>();
  for (const e of ir.entities) {
    ids.add(e.id);
    if (!ROLES.includes(e.role)) v.push(`ROLE_VOCABULARY:${e.id}`);
    /* surfaces are the reader's own words, never added text */
    if (text.slice(e.span[0], e.span[1]) !== e.surface) v.push(`ENTITY_SURFACE:${e.id}`);
    if (
      (e.type === 'COUNTRY' || e.type === 'TERRITORY') &&
      (e.iso3 === null || findCountryByIso3(e.iso3) === undefined)
    )
      v.push(`ENTITY_IDENTITY:${e.id}`);
    /* §12 — a city is never an actor; an unresolved PLACE candidate never either (§9) */
    if (e.type === 'CITY' && (e.role === 'ACTOR' || e.role === 'COUNTERPART'))
      v.push(`CITY_AS_ACTOR:${e.id}`);
    if (e.type === 'PLACE' && (e.role === 'ACTOR' || e.role === 'COUNTERPART'))
      v.push(`UNRESOLVED_PLACE_AS_ACTOR:${e.id}`);
    if (e.type === 'PLACE' && (e.iso3 !== null || e.parentIso3 !== null))
      v.push(`UNRESOLVED_PLACE_WITH_IDENTITY:${e.id}`);
  }
  for (const r of ir.relationships) {
    if (!ids.has(r.actorA) || !ids.has(r.actorB)) v.push('RELATION_ACTOR_UNKNOWN');
    if (r.actorA === r.actorB) v.push('RELATION_SELF');
    const a = ir.entities.find((e) => e.id === r.actorA);
    const b = ir.entities.find((e) => e.id === r.actorB);
    if (a?.type === 'CITY' || b?.type === 'CITY') v.push('RELATION_CITY_ACTOR');
    if (a?.type === 'PLACE' || b?.type === 'PLACE') v.push('RELATION_UNRESOLVED_PLACE_ACTOR');
    if (r.object !== null && (r.object === r.actorA || r.object === r.actorB))
      v.push('OBJECT_REPLACES_ACTOR');
    if (r.venue !== null && (r.venue === r.actorA || r.venue === r.actorB))
      v.push('VENUE_REPLACES_ACTOR');
  }
  for (const c of ir.resolution.conflicts)
    if (!IR_CONFLICTS.includes(c)) v.push(`CONFLICT_VOCABULARY:${c}`);
  /* HARDENING §3 — the bounded interpreter is needed, while the IR is still deterministic, for a
     conflict OR for an interpretable routing-material field left unestablished */
  const escalate = shouldEscalate(ir.resolution.conflicts, ir.resolution.unresolvedFields);
  if (
    ir.resolution.needsSemanticResolution !== (ir.resolution.path === 'DETERMINISTIC' && escalate)
  )
    v.push('RESOLUTION_FLAG');
  if (!IR_COMPLETENESS.includes(ir.resolution.completeness)) v.push('COMPLETENESS_VOCABULARY');
  for (const f of ir.resolution.unresolvedFields)
    if (!IR_MATERIAL_FIELDS.includes(f)) v.push(`FIELD_VOCABULARY:${f}`);
  /* COMPLETE means nothing is unresolved and nothing conflicts — never "no reader matched" */
  if (
    ir.resolution.completeness === 'COMPLETE' &&
    (ir.resolution.conflicts.length > 0 || ir.resolution.unresolvedFields.length > 0)
  )
    v.push('COMPLETE_WITH_GAPS');
  if (
    ir.resolution.completeness !== 'COMPLETE' &&
    ir.resolution.conflicts.length === 0 &&
    ir.resolution.unresolvedFields.length === 0
  )
    v.push('INCOMPLETE_WITHOUT_REASON');
  if (
    ir.objective !== null &&
    (ir.objective.criterion.trim().length === 0 || ir.objective.sourceTurn < 0)
  )
    v.push('OBJECTIVE');
  return v;
}
