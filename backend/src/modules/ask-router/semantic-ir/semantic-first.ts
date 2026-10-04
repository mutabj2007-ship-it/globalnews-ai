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
import { segmentTurn } from './segmentation';
import { ANSWER_RECORD_KINDS } from './prior-claim';
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
  /* R4 ALPHA R-3 SCOPE — a server ANSWER RECORD is bound only by a claim reference
     (ARTIFACT_PROPOSITION); ARTIFACT / ARTIFACT_COMPONENT keep binding model-built structures only,
     exactly as the EN / PL composition (interpret-turn.ts) */
  const structureArtifact =
    artifact !== undefined && ANSWER_RECORD_KINDS.includes(artifact.kind) ? undefined : artifact;
  const boundedStateHasWork =
    artifact !== undefined ||
    (input.conversation?.choiceSet?.length ?? 0) > 0 ||
    input.conversation?.objective != null ||
    input.priorQuestion !== undefined;
  /*
    CLAUDE F · R4 (C-3) — the reference the CALLER resolved against bounded state.

    Measured at 782b175: `readConversationalTurn` returns null for all five of these languages, so
    `boundedStateHasWork` was false, `PRIOR_WORK_REFERENCE` never entered `unresolvedFields`, the
    one bounded call was never asked to resolve a reference, and the line at the bottom of this
    function then forced `discourseReference` back to 'NONE' even when a verdict had named one.
    Five of the seven display languages could not refer to their own earlier work at all, and no
    interpreter, however good, could have changed that. `readInterpreterFirstContainer` supplies
    the container; this reads what the resolver made of it.
  */
  const priorRef = input.priorReference;

  /* the deterministic interpretation: nothing about meaning was read — every routing-material
     field is unresolved, so the ONE bounded call is required (never a guess) */
  const conflicts: IrConflict[] = ['JOB_UNRESOLVED'];
  const unresolvedFields: IrMaterialField[] = ['JOB', 'FRESHNESS', 'EVIDENCE', 'MIXED'];
  if (states.length >= 2) unresolvedFields.push('ACTOR_ROLES', 'RELATIONSHIP');
  if (boundedStateHasWork || priorRef?.needsInterpretation === true)
    unresolvedFields.push('PRIOR_WORK_REFERENCE');
  const completeness = completenessOf(conflicts, unresolvedFields);

  const semantic = r?.path === 'SEMANTIC' ? r : undefined;
  /*
    CTO RUN-3 RULING C — an event the reader does not identify ("what came out of the talks?" with no
    parties, place, time or conversation subject) cannot be answered from news or from timeless
    knowledge: the interpreter marks it LOW confidence and the reader is asked one focused question.
  */
  const unidentifiedCurrentEvent =
    semantic !== undefined &&
    semantic.needsCurrentEvidence === true &&
    semantic.confidence === 'LOW' &&
    candidates.length === 0 &&
    !boundedStateHasWork;
  /*
    CTO R4 ALPHA DEFECT RULING R-4 / R-5 — the interpreter-first equivalent of the EN / PL
    prior-claim decision (interpret-turn.ts), driven by the one verdict, not by a regex bank:
      R-4  the verdict points back at an earlier ANSWER (ARTIFACT / ARTIFACT_COMPONENT /
           ARTIFACT_PROPOSITION) but this thread holds no bindable earlier answer → clarification;
      R-5  it re-examines a CLAIM (ARTIFACT_PROPOSITION) whose earlier answer was model reasoning
           → not a news-verifiable fact: no current evidence is planned for it.
  */
  const pointsBackToAnswer =
    semantic !== undefined &&
    (semantic.reference === 'ARTIFACT' ||
      semantic.reference === 'ARTIFACT_COMPONENT' ||
      semantic.reference === 'ARTIFACT_PROPOSITION');
  const priorReferenceUnresolved =
    pointsBackToAnswer && artifact === undefined && priorRef?.resolved !== true;
  const priorClaimIsReasoning =
    semantic?.reference === 'ARTIFACT_PROPOSITION' &&
    artifact !== undefined &&
    input.priorWork?.provenance !== 'SOURCED_REPORTING';
  /* the one call was required and produced no valid verdict: the focused clarification */
  const semanticClarification =
    r?.path === 'FALLBACK' || unidentifiedCurrentEvent || priorReferenceUnresolved;

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

  /* ══ CLAUSES — the shared seven-language segmentation layer (RULING B), classified by the one
     interpreter call; one clause = the whole turn ══════════════════════════════════════════ */
  const needs = semantic?.needsCurrentEvidence === true && !priorClaimIsReasoning;
  const role = semantic?.temporalRole ?? 'NONE';
  const spans = segmentTurn(readerText, lang);
  const singleKind: InterpretedClauseKind | null =
    semantic === undefined
      ? null
      : needs
        ? 'CURRENT'
        : role === 'HISTORICAL'
          ? 'HISTORICAL'
          : 'STABLE';
  const given =
    semantic?.clauses !== undefined && semantic.clauses.length === spans.length
      ? semantic.clauses
      : undefined;
  const kinds: (InterpretedClauseKind | null)[] = spans.map((_, i) =>
    given !== undefined
      ? given[i]
      : spans.length === 1
        ? singleKind
        : semantic === undefined
          ? null
          : 'OTHER',
  );
  const clauses: IrClause[] = spans.map((sp, i) => clauseOf(i, sp.start, sp.end, kinds[i]));
  /*
    MIXED (RULING D): only when DISTINCT clauses coexist — a CURRENT clause beside any other clause
    (stable, historical, or an unclassified ask such as advice: a current clause never erases the
    other half). One clause is never MIXED, whatever its temporal role: "since X up to now" is ONE
    change analysis (CHANGE_ANALYSIS, SINCE_PAST_TO_PRESENT), its present endpoint needing evidence.
  */
  const mixed =
    needs && clauses.length >= 2 && kinds.includes('CURRENT') && kinds.some((k) => k !== 'CURRENT');
  const currentParts = kinds.some((k) => k === 'CURRENT')
    ? spans.filter((_, i) => kinds[i] === 'CURRENT').map((sp) => readerText.slice(sp.start, sp.end))
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
  /* RULING D — a "MIXED" label on a turn that is not two coexisting clauses is not MIXED: a present
     endpoint over a past period is a change analysis; anything else current is current reporting */
  const job: UserJob | null =
    semantic?.job === 'MIXED' && !mixed
      ? needs
        ? role === 'SINCE_PAST_TO_PRESENT' || role === 'HISTORICAL_AND_CURRENT'
          ? 'CHANGE_ANALYSIS'
          : 'CURRENT_REPORTING'
        : 'EXPLANATION'
      : (semantic?.job ?? null);
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
  if (semantic === undefined || unidentifiedCurrentEvent)
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

  /*
    CLAUDE F · R4 — a RESOLVED reference is a reference. `boundedStateHasWork` is kept as the
    fallback for the paths that have no resolver outcome yet, so nothing that worked before
    changes; what is new is that a resolution carrying a source turn is no longer overruled by a
    container the EN/PL readers could not build.
  */
  const discourseReference =
    priorRef?.resolved === true ||
    (semantic?.reference !== undefined &&
      semantic.reference !== 'NONE' &&
      boundedStateHasWork &&
      ((semantic.reference !== 'ARTIFACT' && semantic.reference !== 'ARTIFACT_COMPONENT') ||
        structureArtifact !== undefined))
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
      target:
        priorRef?.resolved === true
          ? priorRef.target
          : boundedStateHasWork
            ? (semantic?.reference ?? 'NONE')
            : 'NONE',
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
      reasoning: reasoning || semantic === undefined || unidentifiedCurrentEvent,
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
      priorReferenceUnresolved,
      /* FR / DE / ES / PT / AR reach an earlier answer through the interpreter verdict (R-5 recheck) */
      priorAnswerRequest: null,
    },
  };
}

/** Whether the IR is in a current-needing temporal role (exported for the scorer / specs). */
export function currentTemporalRole(role: string): boolean {
  return CURRENT_TEMPORAL_ROLES.has(role as never);
}
