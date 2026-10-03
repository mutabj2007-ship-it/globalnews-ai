import type { KnowledgeRequirementReading } from '../knowledge-requirement';
import { normalizeTurn } from '../turn-normalization';
import type { JobReading, UserJob } from '../user-job';
import type { TemporalSemantics } from '../temporal-semantics';
import type { RoutingDecision, TurnInterpretationInput } from './interpret-turn';
import { readLocalizedEntityCandidates } from './localized-entities';
import type { LocalizedLanguage } from './localized-country-names';
import type { ObjectiveState } from './objective-state';
import { toBilateralRelationship, type RoleAssignment, type RoledEntity } from './roles';
import { CURRENT_TEMPORAL_ROLES, type InterpretedClauseKind } from './semantic-interpreter';
import {
  completenessOf,
  SEMANTIC_IR_VERSION,
  shouldEscalate,
  type IrClause,
  type IrConflict,
  type IrEvidence,
  type IrFreshness,
  type IrMaterialField,
  type SemanticTurnIR,
} from './semantic-turn-ir';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEVEN-LANGUAGE RULING — OPTION 1: INTERPRETER-FIRST FOR FR / DE / ES / PT / AR
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   raw text (original, never translated)
 *     │  Stage A (language-independent, governed): declared language · localized canonical
 *     │  country / region / place identity (localized-entities.ts) · bounded conversation state ·
 *     │  known artifact / objective references · schema validation
 *     ▼
 *   SemanticTurnIR  completeness UNRESOLVED (JOB · FRESHNESS · EVIDENCE · MIXED [· ACTOR_ROLES ·
 *     │             RELATIONSHIP] [· PRIOR_WORK_REFERENCE]) → needsSemanticResolution
 *     ▼
 *   ONE bounded interpreter call (semantic-interpreter.ts, interpreter-first contract)
 *     │  closed, language-neutral IR: job · freshness · evidence · depth · parts · actor roles ·
 *     │  relation · temporal role · objective (verbatim) · reference · transformation · confidence
 *     ▼
 *   this composition → the SAME RoutingDecision the EN / PL composition produces → the same route,
 *   the same frozen C, the same executor. There is no second Ask engine and no per-language stack.
 *
 * The EN / PL deterministic readers are NOT applied: they do not understand these languages and
 * pretending they do is the defect this ruling forbids. Without a valid verdict (interpreter
 * unavailable, breaker open, malformed, contradictory) the governed outcome is the focused
 * clarification — nothing was read, so neither news nor a timeless answer is safe to assume.
 */
export const SEMANTIC_FIRST_LANGUAGES: readonly LocalizedLanguage[] = [
  'fr',
  'de',
  'es',
  'pt',
  'ar',
];

export function isSemanticFirstLanguage(language: string): language is LocalizedLanguage {
  return (SEMANTIC_FIRST_LANGUAGES as readonly string[]).includes(language);
}

const ADVISORY_JOBS: ReadonlySet<UserJob> = new Set(['ADVISORY', 'DECISION_SUPPORT']);

function clauseOf(
  id: number,
  start: number,
  end: number,
  kind: InterpretedClauseKind | null,
): IrClause {
  const current = kind === 'CURRENT';
  return {
    id,
    span: [start, end] as const,
    job:
      kind === null || kind === 'OTHER'
        ? 'UNRESOLVED'
        : current
          ? 'CURRENT_REPORTING'
          : kind === 'HISTORICAL'
            ? 'HISTORICAL_REFERENCE'
            : 'EXPLANATION',
    freshness: current ? 'CURRENT' : 'NONE',
    evidence: current ? 'CURRENT_REPORTING' : 'NONE',
    temporalRole: current ? 'CURRENT_STATE' : kind === 'HISTORICAL' ? 'HISTORICAL' : 'NONE',
  };
}

/** THE INTERPRETER-FIRST COMPOSITION. Pure: no I/O, no clock, no model (the verdict is supplied). */
export function interpretSemanticFirstTurn(input: TurnInterpretationInput): {
  readonly ir: SemanticTurnIR;
  readonly decision: RoutingDecision;
} {
  const { reading } = input;
  const lang = reading.sourceLanguage as LocalizedLanguage;
  const readerText = normalizeTurn(reading.originalQuestion, lang).text;
  const r = input.resolution;

  /* ══ STAGE A — identity only ════════════════════════════════════════════════════════════ */
  const candidates = readLocalizedEntityCandidates(readerText, lang);
  const states = candidates.filter((c) => c.type === 'COUNTRY' || c.type === 'TERRITORY');
  const artifact = input.conversation?.artifact ?? input.priorWork;
  const boundedStateHasWork =
    artifact !== undefined ||
    (input.conversation?.choiceSet?.length ?? 0) > 0 ||
    input.conversation?.objective != null ||
    input.priorQuestion !== undefined;

  /* the deterministic interpretation: nothing about meaning was read — every routing-material
     field is unresolved, so the ONE bounded call is required (never a guess) */
  const conflicts: IrConflict[] = ['JOB_UNRESOLVED'];
  const unresolvedFields: IrMaterialField[] = ['JOB', 'FRESHNESS', 'EVIDENCE', 'MIXED'];
  if (states.length >= 2) unresolvedFields.push('ACTOR_ROLES', 'RELATIONSHIP');
  if (boundedStateHasWork) unresolvedFields.push('PRIOR_WORK_REFERENCE');
  const completeness = completenessOf(conflicts, unresolvedFields);

  const semantic = r?.path === 'SEMANTIC' ? r : undefined;
  /* the one call was required and produced no valid verdict: the focused clarification */
  const semanticClarification = r?.path === 'FALLBACK';

  /* ══ ROLES — only from the validated verdict (ids Stage A resolved; only states act) ═══════ */
  const rel = semantic?.relation ?? null;
  const roled: RoledEntity[] = candidates.map((c) => ({
    ...c,
    role:
      rel !== null && c.id === rel.actorA
        ? 'ACTOR'
        : rel !== null && c.id === rel.actorB
          ? 'COUNTERPART'
          : rel !== null && c.id === rel.object
            ? 'DISPUTED_OBJECT'
            : rel !== null && c.id === rel.venue && c.type !== 'COUNTRY'
              ? 'VENUE'
              : c.type === 'COUNTRY' || c.type === 'TERRITORY'
                ? 'SCOPE'
                : 'LOCATION',
  }));
  const roles: RoleAssignment = {
    entities: roled,
    relationship:
      rel === null
        ? null
        : {
            actorA: rel.actorA,
            actorB: rel.actorB,
            relations: [rel.type ?? 'GENERAL'],
            object: rel.object,
            venue: rel.venue,
            corridor: null,
            basis: 'SEMANTIC',
          },
    conflicts: [],
    rolesIncomplete: false,
  };

  /* ══ CLAUSES — the interpreter's verbatim parts, else the whole turn ════════════════════ */
  const needs = semantic?.needsCurrentEvidence === true;
  const role = semantic?.temporalRole ?? 'NONE';
  const segments = semantic?.segments;
  const clauses: IrClause[] =
    segments !== undefined && segments.length >= 2
      ? segments.map((s, i) => clauseOf(i, s.start, s.end, s.kind))
      : [
          clauseOf(
            0,
            0,
            readerText.length,
            semantic === undefined
              ? null
              : needs
                ? 'CURRENT'
                : role === 'HISTORICAL'
                  ? 'HISTORICAL'
                  : 'STABLE',
          ),
        ];
  const kinds = segments?.map((s) => s.kind) ?? [];
  const mixed =
    needs &&
    (semantic?.job === 'MIXED' ||
      /* a CURRENT part beside ANY other part (stable, historical or an unclassified ask such as
         advice) keeps BOTH components — a current part never erases the other half (the EN / PL
         mixedUnresolved invariant) */
      (kinds.includes('CURRENT') && kinds.some((k) => k !== 'CURRENT')) ||
      role === 'HISTORICAL_AND_CURRENT');
  const currentParts =
    segments !== undefined && segments.some((s) => s.kind === 'CURRENT')
      ? segments.filter((s) => s.kind === 'CURRENT').map((s) => readerText.slice(s.start, s.end))
      : [readerText];

  /* ══ OBJECTIVE — the reader's own words (this turn, an earlier turn, or the bounded state) ═ */
  const verbatim = semantic?.objective ?? null;
  const objective: ObjectiveState | null =
    verbatim !== null
      ? {
          criterion: verbatim.text,
          prefer: null,
          over: null,
          constraints: [],
          sourceTurn: input.turnIndex ?? 0,
          sourceSpan: verbatim.span ?? [0, verbatim.text.length],
          target: null,
          inherited: verbatim.source === 'EARLIER_TURN',
        }
      : input.conversation?.objective != null
        ? { ...input.conversation.objective, inherited: true }
        : null;

  /* ══ DECISION — the same families the EN / PL composition decides ═══════════════════════ */
  const job: UserJob | null = semantic?.job ?? null;
  const advisory = semantic !== undefined && job !== null && ADVISORY_JOBS.has(job);
  const decision = advisory && job === 'DECISION_SUPPORT';
  const decisionObjective = decision
    ? (objective?.criterion ??
      (input.priorWork?.kind === 'DECISION_CRITERIA' ? input.priorWork.label : null))
    : null;
  const relationship = advisory ? null : toBilateralRelationship(roles);
  const relationshipReasoning = semantic !== undefined && relationship !== null && !needs;
  const reasoning =
    semantic !== undefined &&
    !needs &&
    !advisory; /* incl. a historical / conceptual relationship */
  let knowledge: KnowledgeRequirementReading;
  if (semantic === undefined)
    knowledge = {
      requirement: null,
      reason: semanticClarification
        ? 'interpreter-first: no valid interpretation (governed clarification)'
        : 'interpreter-first: pending the one bounded interpretation',
    };
  else if (decision)
    knowledge = {
      requirement: 'DECISION_SUPPORT',
      reason: 'interpreter-first: a decision',
      objective: decisionObjective,
      ...(needs ? { currentClauses: currentParts } : {}),
    };
  else if (advisory)
    knowledge = needs
      ? {
          requirement: 'MIXED_ADVISORY_CURRENT',
          reason: 'interpreter-first: advice with a current part',
          currentClauses: currentParts,
        }
      : { requirement: 'ADVISORY', reason: 'interpreter-first: advice' };
  else if (mixed)
    knowledge = {
      requirement: 'MIXED_REFERENCE_CURRENT',
      reason: 'interpreter-first: a stable / historical part and a current part',
      currentClauses: currentParts,
    };
  else if (needs)
    knowledge = {
      requirement:
        job === 'OFFICIAL_CURRENT_REFERENCE' ? 'OFFICIAL_REFERENCE' : 'CURRENT_REPORTING',
      reason: 'interpreter-first: current evidence required',
    };
  else
    knowledge = {
      requirement: 'STABLE_REFERENCE',
      reason: 'interpreter-first: answerable from stable knowledge',
      ...(role === 'HISTORICAL' ? { frame: 'HISTORY' as const } : {}),
    };

  const discourseReference =
    semantic?.reference !== undefined && semantic.reference !== 'NONE' && boundedStateHasWork
      ? 'PRIOR_WORK'
      : 'NONE';
  const jobReading: JobReading = {
    job: relationshipReasoning ? 'RELATIONSHIP_ANALYSIS' : job,
    freshness: semanticClarification || !needs ? 'NONE' : mixed ? 'PARTIAL' : 'CURRENT',
    evidence: !needs
      ? 'NONE'
      : job === 'OFFICIAL_CURRENT_REFERENCE'
        ? 'OFFICIAL'
        : 'CURRENT_REPORTING',
    depth: semantic?.depth ?? 'STANDARD',
    transformation: semantic?.transformation ?? null,
    discourseReference,
    temporal: [],
    source: semantic !== undefined ? 'SEMANTIC' : semanticClarification ? 'FALLBACK' : 'UNRESOLVED',
    confidence: semantic?.confidence ?? 'LOW',
    reason:
      semantic !== undefined
        ? 'interpreter-first: the bounded semantic interpreter read the original text'
        : semanticClarification
          ? 'interpreter-first: no valid interpretation'
          : 'interpreter-first: pending the one bounded interpretation',
    basis: 'NONE',
    currentnessEvidence: needs ? ['SEMANTIC_INTERPRETER'] : [],
  };
  const temporalSemantics: TemporalSemantics = {
    spans: [],
    currentness: !needs
      ? role === 'HISTORICAL'
        ? 'HISTORICAL'
        : 'NONE'
      : role === 'HISTORICAL_AND_CURRENT'
        ? 'HISTORICAL_AND_CURRENT'
        : 'CURRENT',
  };

  /* ══ THE IR ═════════════════════════════════════════════════════════════════════════════ */
  const advisoryCurrent = advisory && needs;
  const twoComponents =
    clauses.length >= 2 || role === 'HISTORICAL_AND_CURRENT' || objective !== null;
  const freshness: IrFreshness =
    semanticClarification || !needs
      ? 'NONE'
      : (mixed || advisoryCurrent) && twoComponents
        ? 'MIXED'
        : 'CURRENT';
  const evidence: IrEvidence =
    freshness === 'NONE'
      ? 'NONE'
      : job === 'OFFICIAL_CURRENT_REFERENCE'
        ? 'OFFICIAL'
        : 'CURRENT_REPORTING';
  const path: SemanticTurnIR['resolution']['path'] = r === undefined ? 'DETERMINISTIC' : r.path;
  const ir: SemanticTurnIR = {
    version: SEMANTIC_IR_VERSION,
    language: lang,
    turn: {
      primaryJob: jobReading.job,
      depth: jobReading.depth,
      freshness,
      evidence,
      transformation: jobReading.transformation,
      temporalRole: semantic === undefined ? 'NONE' : role,
      confidence: jobReading.confidence,
    },
    clauses,
    entities: roled.map((e) => ({
      id: e.id,
      type: e.type,
      iso3: e.iso3,
      parentIso3: e.parentIso3,
      surface: e.surface,
      span: [e.start, e.end] as const,
      role: e.role,
    })),
    relationships:
      roles.relationship === null || advisory
        ? []
        : [
            {
              actorA: roles.relationship.actorA,
              actorB: roles.relationship.actorB,
              relation: roles.relationship.relations,
              object: roles.relationship.object,
              venue: roles.relationship.venue,
              temporalRole: needs ? (role === 'NONE' ? 'CURRENT_STATE' : role) : role,
              basis: 'SEMANTIC',
            },
          ],
    references: {
      artifact: artifact?.kind ?? null,
      objective: objective !== null,
      choiceSet: (input.conversation?.choiceSet?.length ?? 0) > 0,
      target: boundedStateHasWork ? (semantic?.reference ?? 'NONE') : 'NONE',
      confidence: semantic === undefined ? 'LOW' : 'MEDIUM',
    },
    objective,
    resolution: {
      path,
      needsSemanticResolution:
        path === 'DETERMINISTIC' && shouldEscalate(conflicts, unresolvedFields),
      conflicts,
      completeness,
      unresolvedFields,
    },
  };

  const landedTyped = reading.geography.find(
    (g) => g.provenance !== 'SUPPLIED_BY_SURFACE' && g.value !== 'CONTESTED',
  )?.value;
  return {
    ir,
    decision: {
      knowledge,
      historicalOverride: false,
      stableOrComputed: false,
      placeReference: false,
      advisory,
      decision,
      broadHeadlines: false,
      relationship,
      relationshipReasoning,
      reasoning: reasoning || semantic === undefined,
      job: jobReading,
      decisionObjective,
      currentEvidenceNeeded:
        ('currentClauses' in knowledge ? knowledge.currentClauses : undefined) ?? [],
      temporalSemantics,
      typedGeographyOverride:
        relationship !== null &&
        (landedTyped === undefined || !relationship.countries.includes(landedTyped))
          ? relationship.countries[0]
          : null,
      semanticClarification,
    },
  };
}

/** Whether the IR is in a current-needing temporal role (exported for the scorer / specs). */
export function currentTemporalRole(role: string): boolean {
  return CURRENT_TEMPORAL_ROLES.has(role as never);
}
