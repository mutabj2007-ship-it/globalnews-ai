import { plTolerant } from '../pl-tolerant';
import {
  clauseFreshSignal,
  clauseStableShapeSignal,
  deriveKnowledgeRequirement,
  freshnessSources,
  genuineFreshness,
  inProgressSignal,
  isFuturePeriod,
  particularPhenomenon,
  type KnowledgeRequirementReading,
} from '../knowledge-requirement';
import { isBroadGlobalHeadlinesQuestion } from '../../analysis/query/broad-global-headlines.util';
import { readInstitutionalStatusQuestion } from '../../news/relevance/governed-institutions';
import type { BilateralRelationship } from '../bilateral-relationship';
import {
  readTemporalRoles,
  readUserJob,
  referencesPriorWork,
  REASONING_JOBS,
  type JobReading,
  type UserJob,
} from '../user-job';
import { EN_PUBLIC_EVENT, PL_PUBLIC_EVENT, yearRoles } from '../advisory-requirement';
import { normalizeTurn } from '../turn-normalization';
import {
  readTemporalSemantics,
  temporallyPastOnly,
  type TemporalSemantics,
} from '../temporal-semantics';
import { explanatoryClauseForm, splitClauses, stableClauseForm } from '../clause-intent';
import { readEvaluationKind } from '../decision-objective';
import type { QualifiedReading } from '../normalization/qualified-reading';
import { readCurrentnessMarkers, type CurrentnessMarker } from './currentness';
import { maskTimeDeterminers } from './time-determiners';
import { instructionSpans, maskInstructions } from './instruction-frames';
import { interpretSemanticFirstTurn, isSemanticFirstLanguage } from './semantic-first';
import { readEntityCandidates } from './entities';
import { assignRoles, toBilateralRelationship, type RoleAssignment } from './roles';
import { readChoiceQuestion, readObjectiveState, type ObjectiveState } from './objective-state';
import {
  completenessOf,
  SEMANTIC_IR_VERSION,
  shouldEscalate,
  type IrClause,
  type IrConflict,
  type IrEvidence,
  type IrFreshness,
  type IrMaterialField,
  type IrReferences,
  type IrTemporalRole,
  type SemanticTurnIR,
} from './semantic-turn-ir';
import type { SemanticResolution } from './semantic-interpreter';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §3 — ONE AUTHORITY FOR SEMANTIC MEANING
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   readers (candidate signals)              one composition (this file)          routing
 *   ───────────────────────────              ───────────────────────────          ───────
 *   knowledge requirement, user job,  ──►    conflicts resolved ONCE,      ──►    frozen C is handed
 *   temporal semantics, clause intent,       in a fixed precedence:               the composition this
 *   currentness function, Stage A            explicit currentness > shape;        decision names; it
 *   entities, Stage B roles, objective,      a completed past > a particular      never re-reads text
 *   choice / reference                       event; a city never an actor; …
 *
 * The composition produces the SemanticTurnIR AND the routing decision derived from it. Nothing
 * downstream may override an IR field with another reading of the raw text.
 *
 * DETERMINISTIC FAST PATH (§4): when the signals are complete and agree, the IR is final — no
 * model call. CONFLICTS (§19) are named; the executor then makes ONE bounded semantic call
 * (semantic-interpreter.ts) BEFORE any provider, and the route is recomposed with its validated
 * resolution. Without it (unavailable, invalid), the governed conservative default stands
 * (FALLBACK): an ambiguous turn is never sent to news by default (§6).
 */

/* ── the bounded conversation state the interpretation may use (§17) ───────────────────────── */
export interface BoundedConversationState {
  /** the latest ConversationArtifact's KIND and label (model work — never an objective) */
  readonly artifact?: { readonly kind: string; readonly label: string };
  /** the newest objective the READER stated (their words only) */
  readonly objective?: ObjectiveState | null;
  /** the options the reader named */
  readonly choiceSet?: readonly string[];
  /** the portable subject (the question the conversation currently means, reader's words) */
  readonly portableSubject?: string | null;
}

export interface TurnInterpretationInput {
  readonly reading: QualifiedReading;
  readonly namedPlace: boolean;
  readonly landedIntent: string;
  readonly eligibleInheritedScope: boolean;
  readonly mapOrStoryContext: boolean;
  readonly personal: boolean;
  readonly hasResolvedArticleAnchor: boolean;
  readonly priorQuestion?: string;
  readonly requestInstant?: string;
  readonly priorWork?: { readonly kind: string; readonly label: string };
  readonly conversation?: BoundedConversationState;
  /** CTO R4 fifth pass (compat) — a conversation objective as text */
  readonly conversationObjective?: string;
  /** the 0-based ordinal of this reader turn in the thread (objective provenance) */
  readonly turnIndex?: number;
  readonly resolution?: SemanticResolution;
}

export interface RoutingDecision {
  readonly knowledge: KnowledgeRequirementReading;
  readonly historicalOverride: boolean;
  readonly stableOrComputed: boolean;
  readonly placeReference: boolean;
  readonly advisory: boolean;
  readonly decision: boolean;
  readonly broadHeadlines: boolean;
  /** the two-country scope (current, historical or conceptual), from the IR's actors */
  readonly relationship: BilateralRelationship | null;
  readonly relationshipReasoning: boolean;
  readonly reasoning: boolean;
  readonly job: JobReading;
  readonly decisionObjective: string | null;
  readonly currentEvidenceNeeded: readonly string[];
  readonly temporalSemantics: TemporalSemantics;
  /** when the IR has a relationship whose actors the landed typed geography missed */
  readonly typedGeographyOverride: string | null;
  /**
   * HARDENING §5 — the interpretation was required but no valid verdict exists, and the safe
   * outcome is not stable reasoning: ask the reader one focused question (zero compute).
   */
  readonly semanticClarification: boolean;
}

/* CTO R4 third pass — the reader asks for the REPORTING itself (an archive / coverage request) */
const REPORT_REQUEST: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:report(?:ed|ing|s)?|coverage|covered|news|headlines|articles?|press|newspapers?|journalists?|media\s+(?:said|reported|coverage))\b/i,
  pl: plTolerant(
    /(?:relacj\p{L}*\s+medi\p{L}*|doniesie\p{L}*|doniesi\p{L}*|artykuł\p{L}*|pras\p{L}*|nagłówk\p{L}*|wiadomoś\p{L}*|dziennikar\p{L}*|media\s+(?:pisały|podawały))/iu,
  ),
};
/* an earlier turn ABOUT reported items: the conversation's subject is current reporting */
const PRIOR_REPORTED_SUBJECT: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:stor(?:y|ies)|articles?|reports?|reporting|coverage|headlines?|news)\b/i,
  pl: plTolerant(
    /(?:artykuł\p{L}*|wiadomoś\p{L}*|doniesie\p{L}*|nagłówk\p{L}*|relacj\p{L}*\s+(?:medi|pras)\p{L}*)/iu,
  ),
};
/* a relationship asked about in its present state */
const RELATION_PRESENT_STATE: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^\s*(?:how|what)\s+(?:is|are)\s+(?:the\s+)?(?:relations?|relationship|ties|trade|border)\b|\b(?:currently|these\s+days|at\s+the\s+moment|at\s+present|nowadays|today|right\s+now|this\s+(?:week|month|year))\b|\b(?:how|what)\s+is\s+(?:it|things)\s+(?:going|like)\b/i,
  pl: plTolerant(
    /^\s*(?:jak\s+(?:wygląda|wyglądają)|jaki\s+jest|jakie\s+są)(?![\p{L}])|(?:obecn\p{L}*|teraz|dziś|dzisiaj|aktualn\p{L}*|w\s+tym\s+(?:tygodniu|miesiącu|roku))(?![\p{L}])/iu,
  ),
};
/* a relationship asked about in its past: past forms, history, completed periods */
const RELATION_PAST: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:did|was|were|had|have\s+(?:had|been)|has\s+(?:had|been)|historically|history|historical|went|became|used\s+to|go\s+from|went\s+from|origins?|roots|over\s+the\s+(?:centuries|decades|years)|centur(?:y|ies)|decades)\b|\b(?:after|before|since|during)\s+(?:the\s+)?(?:[\p{L}]+\s+){0,3}(?:war|wars|independence|revolution|treaty|partition|colonial\s+era)\b/iu,
  pl: plTolerant(
    /(?:histori\p{L}*|w\s+przeszłości|skąd\s+wzi\p{L}*|(?:^|\s)\p{L}{3,}(?:ł|ła|ło|li|ły)(?![\p{L}])|na\s+przestrzeni|wiek\p{L}*|stuleci\p{L}*|(?:po|przed|w\s+czasie)\s+(?:\p{L}+\s+){0,2}wojn\p{L}*)/iu,
  ),
};
/* a past-tense causal / explanatory frame ("why did…", "how did…", "what led to…") */
const PAST_CAUSAL_FRAME: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^\s*(?:(?:so|and|but|ok(?:ay)?)[,]?\s+)?(?:why\s+(?:did|was|were|had)|how\s+did|how\s+come|what\s+(?:caused|led\s+to|triggered|sparked)|why['’]d)\b/i,
  pl: plTolerant(
    /^\s*(?:dlaczego|czemu|jak|co)\s+(?:\p{L}+\s+){0,3}?(?:doszło|spowodował\p{L}*|wywołał\p{L}*|\p{L}{3,}(?:ł|ła|ło|li|ły))(?![\p{L}])/iu,
  ),
};

const PRESENT_STRONG = (m: CurrentnessMarker) => m.strength === 'STRONG';
/* a clause that asks something (an unclassified QUESTION is routing-material; a modifier is not) */
const INTERROGATIVE_START: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^(?:what|which|who|whom|whose|how|why|where|when|whether|is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b|\?\s*$/i,
  pl: plTolerant(
    /^(?:czy|co|jak\p{L}*|kto|kiedy|gdzie|dlaczego|czemu|któr\p{L}*|ile|po\s+co)(?![\p{L}])|\?\s*$/iu,
  ),
};
const CURRENT_REQUIREMENTS = new Set([
  'EVENT_DISCOVERY',
  'OFFICIAL_REFERENCE',
  'MIXED_REFERENCE_CURRENT',
  'MIXED_ADVISORY_CURRENT',
]);

interface ClauseReading {
  readonly clause: IrClause;
  readonly text: string;
  /** the clause as the TIME readers read it (non-state time determiners masked) */
  readonly timeText: string;
  readonly kind: 'STABLE' | 'CURRENT' | 'HISTORICAL' | 'OTHER';
  readonly markers: readonly CurrentnessMarker[];
}

function readClauses(
  readerText: string,
  text: string,
  lang: 'en' | 'pl',
  year?: number,
): ClauseReading[] {
  /* defect 3 — clauses are segmented and time-read on the masked time text (same length); the
     currentness markers read the reader's own words (they report a masked determiner as WEAK) */
  const parts = splitClauses(text, lang);
  let cursor = 0;
  return parts.map((part, id) => {
    const at = text.indexOf(part, cursor);
    const start = at < 0 ? cursor : at;
    const end = at < 0 ? Math.min(text.length, cursor + part.length) : at + part.length;
    cursor = end;
    const markers = readCurrentnessMarkers(readerText.slice(start, end), lang);
    const strong = markers.some(PRESENT_STRONG);
    const current = strong || clauseFreshSignal(part, lang, year) || inProgressSignal(part, lang);
    const historical = !current && temporallyPastOnly(part, lang, year);
    const stable =
      !current &&
      !historical &&
      (clauseStableShapeSignal(part, lang) ||
        stableClauseForm(part, lang) ||
        explanatoryClauseForm(part, lang));
    const kind = current ? 'CURRENT' : historical ? 'HISTORICAL' : stable ? 'STABLE' : 'OTHER';
    const role: IrTemporalRole = current
      ? markers.find(PRESENT_STRONG)?.fn === 'RECENT'
        ? 'RECENT'
        : markers.find(PRESENT_STRONG)?.fn === 'SINCE_TO_NOW'
          ? 'SINCE_PAST_TO_PRESENT'
          : 'CURRENT_STATE'
      : historical
        ? 'HISTORICAL'
        : markers.some((m) => m.fn === 'CONTEMPORARY')
          ? 'CONTEMPORARY'
          : 'NONE';
    return {
      text: readerText.slice(start, end),
      timeText: part,
      kind,
      markers,
      clause: {
        id,
        span: [start, end] as const,
        job:
          kind === 'CURRENT'
            ? 'CURRENT_REPORTING'
            : kind === 'HISTORICAL'
              ? 'HISTORICAL_REFERENCE'
              : kind === 'STABLE'
                ? /^(?:i|we)\s|^(?:rozumiem|wiem|znam)/iu.test(part)
                  ? 'CONTEXT_STATEMENT'
                  : 'EXPLANATION'
                : 'UNRESOLVED',
        freshness: current ? 'CURRENT' : 'NONE',
        evidence: current ? 'CURRENT_REPORTING' : 'NONE',
        temporalRole: role,
      },
    };
  });
}

function temporalRoleOf(t: TemporalSemantics): IrTemporalRole {
  switch (t.currentness) {
    case 'CURRENT':
      return t.spans.some((s) => s.role === 'REPORTING_WINDOW')
        ? 'REPORTING_WINDOW'
        : t.spans.some((s) => s.role === 'RECENT_PERIOD')
          ? 'RECENT'
          : t.spans.some((s) => s.role === 'SINCE_PAST_TO_PRESENT')
            ? 'SINCE_PAST_TO_PRESENT'
            : 'CURRENT_STATE';
    case 'HISTORICAL':
      return 'HISTORICAL';
    case 'HISTORICAL_AND_CURRENT':
      return 'HISTORICAL_AND_CURRENT';
    case 'CONTEMPORARY':
      return 'CONTEMPORARY';
    default:
      return 'NONE';
  }
}

/** Apply a validated interpreter resolution to the role assignment (ids only; cities never actors). */
function resolvedRoles(roles: RoleAssignment, r: SemanticResolution | undefined): RoleAssignment {
  if (r?.relation === undefined) return roles;
  if (r.relation === null) return { ...roles, relationship: null };
  const byId = new Map(roles.entities.map((e) => [e.id, e]));
  const a = byId.get(r.relation.actorA);
  const b = byId.get(r.relation.actorB);
  /* the deterministic entity constraints cannot be overridden: only resolved states act */
  const canAct = (e: { type: string }) => e.type === 'COUNTRY' || e.type === 'TERRITORY';
  if (a === undefined || b === undefined || !canAct(a) || !canAct(b) || a.id === b.id) return roles;
  return {
    ...roles,
    entities: roles.entities.map((e) =>
      e.id === a.id
        ? { ...e, role: 'ACTOR' }
        : e.id === b.id
          ? { ...e, role: 'COUNTERPART' }
          : e.id === r.relation!.object
            ? { ...e, role: 'DISPUTED_OBJECT' }
            : e.id === r.relation!.venue && e.type !== 'COUNTRY'
              ? { ...e, role: 'VENUE' }
              : e.role === 'ACTOR' || e.role === 'COUNTERPART'
                ? { ...e, role: 'LOCATION' }
                : e,
    ),
    relationship: {
      actorA: a.id,
      actorB: b.id,
      relations:
        r.relation.type === null
          ? (roles.relationship?.relations ?? ['GENERAL'])
          : [r.relation.type],
      object: r.relation.object,
      venue: r.relation.venue,
      corridor: roles.relationship?.corridor ?? null,
      basis: 'SEMANTIC',
    },
    conflicts: [],
    rolesIncomplete: false,
  };
}

/**
 * THE ONE SEMANTIC COMPOSITION. Pure: no I/O, no clock (the request instant is supplied), no model.
 */
export function interpretTurn(input: TurnInterpretationInput): {
  readonly ir: SemanticTurnIR;
  readonly decision: RoutingDecision;
} {
  /* CTO R4 seven-language — FR / DE / ES / PT / AR enter the IR interpreter-first (semantic-first.ts):
     the EN / PL readers below are never applied to a language they do not read */
  if (isSemanticFirstLanguage(input.reading.sourceLanguage))
    return interpretSemanticFirstTurn(input);
  const { reading, namedPlace } = input;
  const resolution = input.resolution;
  const requestYear =
    input.requestInstant === undefined
      ? undefined
      : new Date(input.requestInstant).getUTCFullYear();
  const year = Number.isFinite(requestYear) ? requestYear : undefined;
  const lang: 'en' | 'pl' = reading.sourceLanguage === 'pl' ? 'pl' : 'en';
  /* harmless FORM normalized for the readers; frozen C, storage and display keep the original */
  const formText = normalizeTurn(reading.originalQuestion, reading.sourceLanguage).text;
  /* defect 1 (deterministic half) — sentences addressed to the SYSTEM are never read as the
     reader's question by any reader (masked, same length); the turn escalates (below) */
  const injected = instructionSpans(formText, lang);
  const readerText = maskInstructions(formText, injected);
  /* defect 3 — what the TIME readers read: possessive time determiners before a non-state head
     ("today's money") are masked, same length; identity / roles / objective read readerText */
  const timeText = maskTimeDeterminers(readerText, lang);
  const conflicts: IrConflict[] = [];

  /* ══ 1 · CANDIDATE SIGNALS ══════════════════════════════════════════════════════════════ */
  const statedYears =
    reading.statedTime === undefined
      ? null
      : yearRoles(reading.statedTime.statedPeriod, lang, year);
  const reportRequest = REPORT_REQUEST[lang].test(readerText);
  const ownKnowledge = deriveKnowledgeRequirement(
    timeText,
    reading.sourceLanguage,
    namedPlace,
    year,
  );
  const temporalSemantics = readTemporalSemantics(timeText, reading.sourceLanguage, year);
  const clauses = readClauses(readerText, timeText, lang, year);
  const markers = clauses.flatMap((c) => c.markers);
  const strongCurrent = markers.some(PRESENT_STRONG);
  const weakCurrent = !strongCurrent && markers.some((m) => m.strength === 'WEAK');
  const candidates = readEntityCandidates(readerText, lang);
  const roles0 = assignRoles(readerText, lang, candidates);
  const roles = resolvedRoles(roles0, resolution);
  conflicts.push(...roles0.conflicts.filter(() => resolution?.relation === undefined));
  const evaluationKind = readEvaluationKind(readerText, lang);
  /* a choice among options under discussion — never over an explicit present ("which is the best
     performing stock this week" asks for current figures, not a choice among earlier options) */
  const choiceQuestion =
    evaluationKind !== 'ARTIFACT_COMPONENT_EVALUATION' &&
    !strongCurrent &&
    !genuineFreshness(timeText, reading.sourceLanguage, year) &&
    /* per clause: a composed "Comparing A, B and C: so which one is best?" asks in its last clause */
    (readChoiceQuestion(readerText, lang) || clauses.some((c) => readChoiceQuestion(c.text, lang)));
  /* the objective: this turn's own, else the newest the reader stated earlier (bounded state) */
  const ownObjective = readObjectiveState(readerText, lang, input.turnIndex ?? 0, false);
  const carried =
    input.conversation?.objective ??
    (input.conversationObjective === undefined
      ? null
      : {
          criterion: input.conversationObjective,
          prefer: null,
          over: null,
          constraints: [],
          sourceTurn: 0,
          sourceSpan: [0, input.conversationObjective.length] as const,
          target: null,
          inherited: true,
        });
  const objective: ObjectiveState | null =
    ownObjective ?? (carried === null ? null : { ...carried, inherited: true });
  const choiceSet = input.conversation?.choiceSet ?? [];
  const artifact = input.conversation?.artifact ?? input.priorWork;
  const boundedStateHasWork =
    artifact !== undefined ||
    choiceSet.length > 0 ||
    carried !== null ||
    input.priorQuestion !== undefined;

  /* ══ 2 · RESOLUTION (one place, fixed precedence) ═══════════════════════════════════════ */
  /*
    HARDENING §12 — ONE clause holding BOTH a completed past anchor and a present marker, with no
    since-to-now / comparison structure joining them ("Tell me what happened in 1997 today"), is
    AMBIGUOUS: token precedence must not decide it. The interpreter decides; without it the
    governed default is the completed past (never news by accident).
  */
  const pastPresentClause = clauses.some((c) => {
    const t = readTemporalSemantics(c.timeText, lang, year);
    const past = t.spans.some((s) => s.role === 'PAST_COMPLETED' || s.role === 'HISTORICAL_PERIOD');
    const present = t.spans.some(
      (s) =>
        s.role === 'CURRENT_STATE' || s.role === 'RECENT_PERIOD' || s.role === 'REPORTING_WINDOW',
    );
    return past && present && t.currentness === 'CURRENT';
  });
  if (pastPresentClause) conflicts.push('TEMPORAL_AMBIGUOUS');
  const temporalHistoryDefault = pastPresentClause && resolution?.needsCurrentEvidence !== true;
  const historicalOverride =
    (statedYears !== null &&
      statedYears.historical.length > 0 &&
      !statedYears.current &&
      statedYears.future.length === 0 &&
      !reportRequest &&
      !(
        ownKnowledge.requirement === 'CURRENT_REPORTING' &&
        ownKnowledge.reason === 'a freshness marker'
      ) &&
      ownKnowledge.requirement !== 'MIXED_REFERENCE_CURRENT') ||
    temporalHistoryDefault;
  /* a follow-up continues the KIND of question it follows (place background / advice) */
  const priorKnowledge =
    input.priorQuestion === undefined
      ? null
      : deriveKnowledgeRequirement(
          maskTimeDeterminers(
            normalizeTurn(input.priorQuestion, reading.sourceLanguage).text,
            lang,
          ),
          reading.sourceLanguage,
        ).requirement;
  const continuesKind =
    ownKnowledge.requirement === null ||
    (ownKnowledge.requirement === 'CURRENT_REPORTING' && ownKnowledge.reason === 'a named place');
  let knowledge: KnowledgeRequirementReading =
    priorKnowledge === 'PLACE_REFERENCE' && continuesKind
      ? { requirement: 'PLACE_REFERENCE', reason: 'continues a place-reference question' }
      : priorKnowledge === 'ADVISORY' && continuesKind
        ? { requirement: 'ADVISORY', reason: 'continues an advisory question' }
        : ownKnowledge;

  /* a reference to this conversation's earlier work (a status word inside it is not world-time) */
  const referencesWork =
    (input.priorWork !== undefined || artifact !== undefined) &&
    (referencesPriorWork(readerText, lang) || evaluationKind === 'ARTIFACT_COMPONENT_EVALUATION');

  /* §7 MIXED from the SET of clause intents (punctuation was only the segmentation hint) */
  const currentClauses = clauses.filter((c) => c.kind === 'CURRENT');
  const stableOrHistoricalClauses = clauses.filter(
    (c) => c.kind === 'STABLE' || c.kind === 'HISTORICAL',
  );
  const clauseMixed = currentClauses.length > 0 && stableOrHistoricalClauses.length > 0;
  const advisoryFamily =
    knowledge.requirement === 'ADVISORY' ||
    knowledge.requirement === 'MIXED_ADVISORY_CURRENT' ||
    knowledge.requirement === 'DECISION_SUPPORT';
  const semanticClauseMixed =
    resolution?.clauses !== undefined &&
    resolution.clauses.some((c) => c === 'CURRENT') &&
    resolution.clauses.some((c) => c === 'STABLE' || c === 'HISTORICAL');
  if (
    (clauseMixed || semanticClauseMixed) &&
    !advisoryFamily &&
    !referencesWork &&
    knowledge.requirement !== 'COMPUTATION' &&
    knowledge.requirement !== 'EVENT_DISCOVERY' &&
    knowledge.requirement !== 'OFFICIAL_REFERENCE' &&
    knowledge.requirement !== 'MIXED_REFERENCE_CURRENT'
  )
    knowledge = {
      requirement: 'MIXED_REFERENCE_CURRENT',
      reason: 'semantic IR: a stable / historical component plus a current component',
      currentClauses: currentClauses.map((c) => c.text),
    };
  /*
    HARDENING §3 — a CURRENT clause next to an interrogative clause that NO reader could classify:
    whether the turn is MIXED is not established. The interpreter decides; without it the governed
    default keeps BOTH components (MIXED), so a current failure can never erase the other half.
  */
  const mixedUnresolved =
    clauses.length >= 2 &&
    currentClauses.length > 0 &&
    stableOrHistoricalClauses.length === 0 &&
    clauses.some((c) => c.kind === 'OTHER' && INTERROGATIVE_START[lang].test(c.text)) &&
    !advisoryFamily &&
    !referencesWork &&
    knowledge.requirement !== 'MIXED_REFERENCE_CURRENT' &&
    knowledge.requirement !== 'COMPUTATION';
  if (mixedUnresolved && resolution?.path === 'FALLBACK')
    knowledge = {
      requirement: 'MIXED_REFERENCE_CURRENT',
      reason:
        'semantic IR (governed fallback): an unclassified component kept beside the current one',
      currentClauses: currentClauses.map((c) => c.text),
    };
  /* the completed past is the default reading of an ambiguous past + present clause */
  if (
    temporalHistoryDefault &&
    (knowledge.requirement === null || knowledge.requirement === 'CURRENT_REPORTING')
  )
    knowledge = {
      requirement: namedPlace ? 'PLACE_REFERENCE' : 'STABLE_REFERENCE',
      reason: 'semantic IR: a completed past anchor (the present marker is ambiguous)',
      frame: 'HISTORY',
    };

  /* HARDENING §11 — a current OFFICE ("the president of Turkey") or a governed institution's
     current STATUS ("the NBP policy rate") is current by nature: governed evidence the IR owns,
     never a second routing authority in the envelope composition */
  const currentOffice =
    reading.shape.officeConstruction === true ||
    readInstitutionalStatusQuestion(reading.originalQuestion) !== null;

  /* §8 EXPLICIT CURRENTNESS OUTRANKS QUESTION SHAPE (and so does a current office / status) */
  const shapeSaysStable =
    knowledge.requirement === 'STABLE_REFERENCE' || knowledge.requirement === 'PLACE_REFERENCE';
  const shapeSaysNothing =
    knowledge.requirement === null ||
    (knowledge.requirement === 'CURRENT_REPORTING' && knowledge.reason === 'a named place');
  let explicitCurrent = false;
  if (
    (strongCurrent || currentOffice) &&
    !referencesWork &&
    !temporalHistoryDefault &&
    !pastPresentClause &&
    (shapeSaysStable || shapeSaysNothing)
  ) {
    /* a governed current office / status is a FORM, not a conflict; a bare marker vs a shape is */
    if (shapeSaysStable && !currentOffice) conflicts.push('STABLE_SHAPE_WITH_CURRENT_MARKER');
    const confirmed = resolution?.needsCurrentEvidence ?? true;
    if (confirmed) {
      explicitCurrent = true;
      knowledge = { requirement: 'CURRENT_REPORTING', reason: 'semantic IR: explicit currentness' };
    }
  } else if (strongCurrent && referencesWork) {
    /* "Is that still the best option?" — a status word about the conversation's own work */
    conflicts.push('TEMPORAL_AMBIGUOUS');
  }
  /* a WEAK, present-era currentness inside an explanation ("why do firms still use COBOL") */
  if (weakCurrent && shapeSaysStable) {
    conflicts.push('WEAK_CURRENTNESS_IN_EXPLANATION');
    if (resolution?.needsCurrentEvidence === true) {
      explicitCurrent = true;
      knowledge = {
        requirement: 'CURRENT_REPORTING',
        reason: 'semantic IR: interpreter currentness',
      };
    }
  }

  /* §8 / §16 — a past-tense causal question about a particular event, undated, with nothing
     present: history by default (never news by default); the interpreter may confirm currentness */
  const pastOnly = temporalSemantics.currentness === 'HISTORICAL';
  const publicEventRaw =
    !pastOnly &&
    particularPhenomenon(
      timeText,
      reading.sourceLanguage,
      lang === 'pl' ? PL_PUBLIC_EVENT : EN_PUBLIC_EVENT,
      namedPlace,
      year,
    );
  const pastCausal =
    PAST_CAUSAL_FRAME[lang].test(readerText) &&
    !strongCurrent &&
    reading.statedTime === undefined &&
    !inProgressSignal(timeText, lang);
  let publicEvent = publicEventRaw && !temporalHistoryDefault;
  if (pastCausal && publicEventRaw) {
    conflicts.push('TEMPORAL_AMBIGUOUS');
    publicEvent = resolution?.needsCurrentEvidence === true;
  }

  /*
    HARDENING §2–§4 — FRESHNESS ON A LEXICAL BASIS ONLY. The turn would be routed to current
    reporting, but the ONLY thing that says "current" is a definite reference to a particular event
    or state ("the outcome", "the deal", "the situation", "the war") — no time, no status / present
    marker, no place, no inherited scope, no earlier subject, no article, no request for news, no
    progressive, no governed current form. That is not established freshness: an unfamiliar form
    with routing consequences, so it escalates. The interpreter decides; if it cannot, the governed
    outcome is a focused clarification — never news by accident, never a timeless assertion.
  */
  const fsrc = freshnessSources(timeText, reading.sourceLanguage, year);
  const strongFreshnessBasis =
    currentOffice ||
    strongCurrent ||
    fsrc.explicit ||
    reading.statedTime !== undefined ||
    readTemporalRoles(timeText, lang, year).some((t) => t.role === 'REPORTING_WINDOW') ||
    temporalSemantics.currentness === 'CURRENT' ||
    temporalSemantics.currentness === 'HISTORICAL_AND_CURRENT' ||
    namedPlace ||
    /* a place Stage A resolved (an alias the landed reader missed: "eastern DRC") locates the
       instance — "the situation in eastern DRC" is a particular, current situation */
    candidates.length > 0 ||
    (input.eligibleInheritedScope && input.mapOrStoryContext) ||
    input.priorQuestion !== undefined ||
    input.hasResolvedArticleAnchor ||
    reportRequest ||
    inProgressSignal(timeText, lang) ||
    RELATION_PRESENT_STATE[lang].test(timeText) ||
    (knowledge.requirement !== null && CURRENT_REQUIREMENTS.has(knowledge.requirement));
  const freshnessWeak =
    !temporalHistoryDefault &&
    !referencesWork &&
    !strongFreshnessBasis &&
    (fsrc.lexicalEventOnly || publicEventRaw) &&
    (knowledge.requirement === null || knowledge.requirement === 'CURRENT_REPORTING');
  /* the interpreter said: not current → a stable reading (the place, when one is named) */
  const notCurrentByInterpreter =
    freshnessWeak && resolution?.path === 'SEMANTIC' && resolution.needsCurrentEvidence === false;
  if (notCurrentByInterpreter) {
    knowledge = {
      requirement: namedPlace ? 'PLACE_REFERENCE' : 'STABLE_REFERENCE',
      reason: 'semantic IR: the bounded interpreter found no current-state request',
    };
    publicEvent = false;
  }
  /* no interpreter verdict → a focused clarification (governed fallback) */
  const semanticClarification =
    (freshnessWeak || injected.length > 0) && resolution?.path === 'FALLBACK';

  /* the decision family (§18): a choice resolved against the bounded state */
  if (choiceQuestion && !advisoryFamily) {
    knowledge = {
      requirement: 'DECISION_SUPPORT',
      reason: 'semantic IR: a choice among options already under discussion',
      objective: null,
    };
  }
  /* a reference with no deterministic target, while the bounded state DOES hold something it may
     point at (an earlier subject, options, an objective) — never when the state is empty: then
     there is nothing to resolve and no call is spent */
  const stateWithoutArtifact =
    artifact === undefined &&
    (input.priorQuestion !== undefined ||
      (input.conversation?.portableSubject ?? null) !== null ||
      choiceSet.length > 0 ||
      carried !== null);
  if (
    !choiceQuestion &&
    referencesPriorWork(readerText, lang) &&
    stateWithoutArtifact &&
    readerText.length <= 120
  )
    conflicts.push('REFERENCE_UNRESOLVED');

  /*
    CTO R4 SEVEN-LANGUAGE §13 — DEFECT 2: VERDICT AUTHORITY.
    ROOT CAUSE: each escalated branch consumed the interpreter's currentness verdict on its own, and
    one did not (a status word about the conversation's own work: "does that recommendation still
    make sense after recent events?" named TEMPORAL_AMBIGUOUS, escalated, and then ignored the
    verdict). INVARIANT: an ACCEPTED semantic verdict that current evidence is required is applied
    on EVERY escalated branch — never a timeless answer after the interpreter said "current". The
    other component the deterministic reading established is KEPT: advice / a decision / earlier work
    becomes the mixed form whose current part is named; anything else is current reporting.
  */
  const verdictCurrent =
    resolution?.path === 'SEMANTIC' && resolution.needsCurrentEvidence === true;
  const currentRequirement =
    knowledge.requirement !== null &&
    (knowledge.requirement === 'CURRENT_REPORTING' ||
      CURRENT_REQUIREMENTS.has(knowledge.requirement));
  const mixedFamily =
    knowledge.requirement === 'MIXED_REFERENCE_CURRENT' ||
    knowledge.requirement === 'MIXED_ADVISORY_CURRENT';
  /* earlier work re-examined against the present keeps BOTH components (the work and the current
     evidence) even when a reader already said "current" — never one dropped for the other */
  if (
    verdictCurrent &&
    ((!currentRequirement && !explicitCurrent) || (referencesWork && !mixedFamily))
  ) {
    const interpretedCurrent = (resolution?.clauses ?? [])
      .map((k, i) => (k === 'CURRENT' ? clauses[i]?.text : undefined))
      .filter((t): t is string => t !== undefined);
    const parts =
      currentClauses.length > 0
        ? currentClauses.map((c) => c.text)
        : interpretedCurrent.length > 0
          ? interpretedCurrent
          : [readerText];
    if (knowledge.requirement === 'DECISION_SUPPORT')
      knowledge = { ...knowledge, currentClauses: parts };
    else if (knowledge.requirement === 'ADVISORY' || (referencesWork && advisoryFamily))
      knowledge = {
        requirement: 'MIXED_ADVISORY_CURRENT',
        reason: 'semantic IR: the interpreter requires current evidence for this advice',
        currentClauses: parts,
      };
    else if (referencesWork)
      knowledge = {
        requirement: 'MIXED_REFERENCE_CURRENT',
        reason: 'semantic IR: earlier work re-examined against current evidence (interpreter)',
        currentClauses: parts,
      };
    else {
      explicitCurrent = true;
      knowledge = {
        requirement: 'CURRENT_REPORTING',
        reason: 'semantic IR: the interpreter requires current evidence',
      };
    }
  }

  const decision = knowledge.requirement === 'DECISION_SUPPORT';
  const placeFreeIntent = [
    'CURRENT_EVENT',
    'EXPLANATION',
    'ENTITY_BACKGROUND',
    'CLARIFICATION_REQUIRED',
  ].includes(input.landedIntent);
  const stableOrComputed =
    (knowledge.requirement === 'STABLE_REFERENCE' || knowledge.requirement === 'COMPUTATION') &&
    (reading.statedTime === undefined || historicalOverride) &&
    !namedPlace &&
    placeFreeIntent &&
    !(input.eligibleInheritedScope && input.mapOrStoryContext) &&
    input.priorQuestion === undefined &&
    !input.personal;
  const placeReference =
    !stableOrComputed &&
    knowledge.requirement === 'PLACE_REFERENCE' &&
    (reading.statedTime === undefined ||
      historicalOverride ||
      ('frame' in knowledge &&
        knowledge.frame === 'TRAVEL' &&
        isFuturePeriod(reading.statedTime.statedPeriod, reading.sourceLanguage, year))) &&
    !input.hasResolvedArticleAnchor &&
    !input.personal;
  const advisory =
    !stableOrComputed &&
    !placeReference &&
    (knowledge.requirement === 'ADVISORY' ||
      knowledge.requirement === 'MIXED_ADVISORY_CURRENT' ||
      decision) &&
    !input.hasResolvedArticleAnchor &&
    !input.personal;
  const broadHeadlines =
    !stableOrComputed &&
    !placeReference &&
    !advisory &&
    injected.length === 0 &&
    isBroadGlobalHeadlinesQuestion(reading.originalQuestion, reading.sourceLanguage) &&
    input.priorQuestion === undefined &&
    !namedPlace &&
    !(input.eligibleInheritedScope && input.mapOrStoryContext) &&
    !input.personal;

  /* §11–§14 — the relationship from Stage A identities + Stage B roles (never a venue / object) */
  const relationshipAny = advisory ? null : toBilateralRelationship(roles);
  const fresh =
    (genuineFreshness(timeText, reading.sourceLanguage, year) &&
      !temporalHistoryDefault &&
      !notCurrentByInterpreter) ||
    explicitCurrent;
  const formJob0 = readUserJob(timeText, reading.sourceLanguage, {
    requirement: knowledge.requirement,
    requirementReason: knowledge.reason,
    namedPlace,
    statedPeriod: reading.statedTime !== undefined && !historicalOverride,
    fresh,
    hasPriorWork: input.priorWork !== undefined || artifact !== undefined,
    publicEvent,
    requestYear: year,
    reportRequest,
    inheritedScope: input.eligibleInheritedScope && input.mapOrStoryContext,
  });
  /* a choice resolved against the bounded state refers to that earlier work (§17); a reference
     the interpreter resolved to a target in the bounded state does too */
  const interpretedReference =
    resolution?.reference !== undefined &&
    resolution.reference !== 'NONE' &&
    boundedStateHasWork &&
    formJob0.discourseReference === 'NONE';
  const formJob: JobReading =
    choiceQuestion && boundedStateHasWork
      ? {
          ...formJob0,
          job: 'DECISION_SUPPORT',
          discourseReference: 'PRIOR_WORK',
          source: 'DETERMINISTIC',
          basis: 'FORM',
          confidence: 'HIGH',
          reason: 'a choice among the options / objective already in this conversation',
        }
      : interpretedReference
        ? { ...formJob0, discourseReference: 'PRIOR_WORK' }
        : formJob0;
  const inheritedScope = input.eligibleInheritedScope && input.mapOrStoryContext;
  const currentStated = reading.statedTime !== undefined && !historicalOverride;
  const relationCurrent =
    relationshipAny !== null &&
    (fresh ||
      currentStated ||
      formJob.temporal.some((t) => t.role === 'REPORTING_WINDOW') ||
      RELATION_PRESENT_STATE[lang].test(timeText) ||
      /* hardening §12 — a CURRENT clause ("…and whether it is still active") makes the relation
         current even when another clause is historical (the turn is then MIXED) */
      (currentClauses.length > 0 && !temporalHistoryDefault && !notCurrentByInterpreter) ||
      /* an escalated turn: the interpreter's currentness verdict decides */
      (resolution?.path === 'SEMANTIC' && resolution.needsCurrentEvidence === true));
  const relationshipReasoning =
    relationshipAny !== null &&
    !relationCurrent &&
    !input.hasResolvedArticleAnchor &&
    !input.personal &&
    (historicalOverride ||
      pastOnly ||
      RELATION_PAST[lang].test(readerText) ||
      formJob.analysis === 'CAUSAL' ||
      formJob.job === 'DEEP_CONCEPTUAL_ANALYSIS' ||
      placeReference ||
      stableOrComputed);
  const relationshipRead = relationCurrent ? relationshipAny : null;
  const otherwiseDecided =
    ((stableOrComputed || placeReference) && !relationshipReasoning) ||
    relationshipReasoning ||
    advisory ||
    broadHeadlines ||
    relationshipRead !== null ||
    input.hasResolvedArticleAnchor ||
    input.personal;
  const clarificationHolds =
    input.landedIntent === 'CLARIFICATION_REQUIRED' &&
    formJob.discourseReference !== 'PRIOR_WORK' &&
    !(formJob.job === 'COMPARISON' && formJob.basis === 'FORM' && !namedPlace);
  const reasoningByForm =
    /* defect 2 — a FORM reasoning job never outranks an accepted "current" verdict */
    !verdictCurrent &&
    !otherwiseDecided &&
    !clarificationHolds &&
    formJob.basis === 'FORM' &&
    formJob.job !== null &&
    REASONING_JOBS.has(formJob.job) &&
    formJob.freshness === 'NONE';
  const timeAnchored = formJob.temporal.some(
    (t) =>
      t.role !== 'PLAN_HORIZON' && t.role !== 'TRIP_DURATION' && t.role !== 'HISTORICAL_PERIOD',
  );
  const priorCurrent =
    input.priorQuestion !== undefined &&
    (() => {
      const p = maskTimeDeterminers(
        normalizeTurn(input.priorQuestion, reading.sourceLanguage).text,
        lang,
      );
      const k = deriveKnowledgeRequirement(p, reading.sourceLanguage, false, year);
      return (
        genuineFreshness(p, reading.sourceLanguage, year) ||
        PRIOR_REPORTED_SUBJECT[lang].test(p) ||
        k.requirement === 'MIXED_REFERENCE_CURRENT' ||
        k.requirement === 'MIXED_ADVISORY_CURRENT' ||
        k.requirement === 'EVENT_DISCOVERY' ||
        k.requirement === 'OFFICIAL_REFERENCE' ||
        (k.requirement === 'CURRENT_REPORTING' && k.reason !== 'a named place')
      );
    })();
  const governedCurrent =
    (knowledge.requirement === 'CURRENT_REPORTING' && knowledge.reason !== 'a named place') ||
    (knowledge.requirement !== null && CURRENT_REQUIREMENTS.has(knowledge.requirement));
  const currentnessEvidence: string[] = [
    ...(currentOffice ? ['CURRENT_OFFICE_OR_STATUS'] : []),
    ...(fresh ? ['EXPLICIT_TIME_OR_CHANGE'] : []),
    ...(explicitCurrent ? ['EXPLICIT_CURRENTNESS_MARKER'] : []),
    ...(currentStated ? ['STATED_CURRENT_PERIOD'] : []),
    ...(timeAnchored ? ['REPORTING_WINDOW'] : []),
    ...(publicEvent ? ['PARTICULAR_EVENT'] : []),
    ...(governedCurrent ? ['GOVERNED_CURRENT_FORM'] : []),
    ...(relationCurrent ? ['RELATIONSHIP_PRESENT_STATE'] : []),
    ...(inheritedScope ? ['INHERITED_SURFACE_SCOPE'] : []),
    ...(priorCurrent ? ['PRIOR_CURRENT_SUBJECT'] : []),
    ...(input.hasResolvedArticleAnchor ? ['ARTICLE_ANCHOR'] : []),
    ...(broadHeadlines ? ['HEADLINES_REQUEST'] : []),
  ];
  const unresolvedEligible =
    !otherwiseDecided &&
    !clarificationHolds &&
    !reasoningByForm &&
    (knowledge.requirement === null ||
      (knowledge.requirement === 'CURRENT_REPORTING' && knowledge.reason === 'a named place')) &&
    currentnessEvidence.length === 0;
  if (unresolvedEligible) conflicts.push('JOB_UNRESOLVED');
  const semanticJob =
    resolution?.job === undefined
      ? undefined
      : { job: resolution.job, needsCurrentEvidence: resolution.needsCurrentEvidence === true };
  const reasoningBySemantics =
    unresolvedEligible && semanticJob !== undefined && !semanticJob.needsCurrentEvidence;
  const reasoning = reasoningByForm || reasoningBySemantics || relationshipReasoning;
  const resolvedJob: JobReading = relationshipReasoning
    ? {
        ...formJob,
        job: 'RELATIONSHIP_ANALYSIS',
        freshness: 'NONE',
        evidence: 'NONE',
        source: 'DETERMINISTIC',
        basis: 'FORM',
        confidence: 'HIGH',
        reason: 'a historical / conceptual relationship between two countries (both kept as scope)',
      }
    : reasoningBySemantics
      ? {
          ...formJob,
          job: semanticJob!.job,
          source: resolution?.path === 'FALLBACK' ? 'FALLBACK' : 'SEMANTIC',
          confidence: 'MEDIUM',
          reason: 'resolved by the bounded semantic interpreter',
        }
      : unresolvedEligible && semanticJob !== undefined
        ? {
            ...formJob,
            job: semanticJob.job,
            freshness: 'CURRENT',
            evidence: 'CURRENT_REPORTING',
            source: 'SEMANTIC',
            confidence: 'MEDIUM',
            reason: 'the semantic interpreter requires current evidence',
          }
        : unresolvedEligible
          ? { ...formJob, job: null, source: 'UNRESOLVED', confidence: 'LOW' }
          : formJob.source === 'UNRESOLVED'
            ? {
                ...formJob,
                job: 'CURRENT_REPORTING',
                freshness: 'CURRENT',
                evidence: 'CURRENT_REPORTING',
                source: 'DETERMINISTIC',
                basis: 'KNOWLEDGE',
                confidence: 'MEDIUM',
                reason:
                  'scoped as current reporting by its time, event, inherited scope or prior subject',
              }
            : formJob;
  const job: JobReading = { ...resolvedJob, currentnessEvidence };

  /* §18 — the objective: this turn's own, else the conversation's (reader's words), else a
     DECISION_CRITERIA artifact; "best for what?" only when none exists */
  const decisionObjective =
    advisory && decision
      ? (('objective' in knowledge ? (knowledge.objective ?? null) : null) ??
        objective?.criterion ??
        (input.priorWork?.kind === 'DECISION_CRITERIA' ? input.priorWork.label : null))
      : null;

  /*
    CTO R4 SEVEN-LANGUAGE §13 — DEFECT 4: A TIME-ANCHORED OBJECTIVE IS A CURRENT PART.
    ROOT CAUSE: only the turn's own words were time-read. An objective stated earlier ("lowest
    corporate tax rate right now", "obecnie najniższe ryzyko podróży") was inherited as a bare
    criterion, so "So which one should I go with?" was weighed from timeless knowledge.
    INVARIANT: a decision is weighed against its criterion, and the criterion is part of the turn's
    meaning wherever it was stated: when the criterion is itself time-anchored (STRONG currentness in
    the reader's own words of it), the decision keeps its reasoning AND names the criterion as the
    part that needs current sourced evidence (the MIXED_ADVISORY_CURRENT contract).
  */
  if (advisory && decision && decisionObjective !== null) {
    const anchored = readCurrentnessMarkers(decisionObjective, lang).some(PRESENT_STRONG);
    const named = ('currentClauses' in knowledge ? knowledge.currentClauses : undefined) ?? [];
    if (anchored && !named.includes(decisionObjective))
      knowledge = { ...knowledge, currentClauses: [...named, decisionObjective] };
  }

  /* the typed scope: when the IR has two actors and the landed typed place is not one of them
     (a venue city's country, a disputed object), the first actor is the typed place */
  const actorIsos: readonly string[] = relationshipAny?.countries ?? [];
  const landedTyped = reading.geography.find(
    (g) => g.provenance !== 'SUPPLIED_BY_SURFACE' && g.value !== 'CONTESTED',
  )?.value;
  const typedGeographyOverride =
    relationshipAny !== null && (landedTyped === undefined || !actorIsos.includes(landedTyped))
      ? relationshipAny.countries[0]
      : null;

  /* ══ 3 · THE IR ══════════════════════════════════════════════════════════════════════════ */
  /* an unresolved job the interpreter found CURRENT is planned as current reporting */
  const willPlanNews =
    !stableOrComputed &&
    !placeReference &&
    !advisory &&
    !reasoning &&
    !(unresolvedEligible && semanticJob?.needsCurrentEvidence !== true);
  /* advice / a decision with a time-anchored part keeps BOTH components (the current part is named
     as needing current sourced evidence) */
  const mixed =
    knowledge.requirement === 'MIXED_REFERENCE_CURRENT' ||
    knowledge.requirement === 'MIXED_ADVISORY_CURRENT' ||
    (advisory &&
      (('currentClauses' in knowledge ? knowledge.currentClauses : undefined)?.length ?? 0) > 0);
  const freshness: IrFreshness = semanticClarification
    ? 'NONE'
    : mixed
      ? 'MIXED'
      : willPlanNews && job.freshness !== 'NONE'
        ? 'CURRENT'
        : willPlanNews && (governedCurrent || currentnessEvidence.length > 0)
          ? 'CURRENT'
          : 'NONE';
  const evidence: IrEvidence =
    freshness === 'NONE'
      ? job.evidence === 'DETERMINISTIC'
        ? 'DETERMINISTIC'
        : 'NONE'
      : job.evidence === 'OFFICIAL' || knowledge.requirement === 'OFFICIAL_REFERENCE'
        ? 'OFFICIAL'
        : 'CURRENT_REPORTING';
  const references: IrReferences = {
    artifact: artifact?.kind ?? null,
    objective: objective !== null,
    choiceSet: choiceSet.length > 0,
    target:
      choiceQuestion && boundedStateHasWork
        ? choiceSet.length > 0 || carried !== null
          ? 'CHOICE_SET'
          : 'ARTIFACT'
        : evaluationKind === 'ARTIFACT_COMPONENT_EVALUATION' &&
            job.discourseReference === 'PRIOR_WORK'
          ? 'ARTIFACT_COMPONENT'
          : job.discourseReference === 'PRIOR_WORK'
            ? 'ARTIFACT'
            : 'NONE',
    confidence: conflicts.includes('REFERENCE_UNRESOLVED') ? 'LOW' : 'HIGH',
  };
  const uniqueConflicts = [...new Set(conflicts)];
  /*
    HARDENING §2–§3 — the routing-material fields the deterministic reading did NOT establish.
    "No reader matched" is never COMPLETE: a field with routing consequences that only a lexical
    accident (or nothing) decided is named here, and an interpretable one escalates.
  */
  const unresolvedFields: IrMaterialField[] = [];
  if (unresolvedEligible || injected.length > 0) unresolvedFields.push('JOB');
  if (freshnessWeak) unresolvedFields.push('FRESHNESS', 'EVIDENCE');
  if (mixedUnresolved) unresolvedFields.push('MIXED');
  if (roles0.rolesIncomplete && resolution?.relation === undefined)
    unresolvedFields.push('ACTOR_ROLES', 'RELATIONSHIP');
  if (uniqueConflicts.includes('REFERENCE_UNRESOLVED'))
    unresolvedFields.push('PRIOR_WORK_REFERENCE');
  if (advisory && decision && decisionObjective === null)
    unresolvedFields.push('DECISION_OBJECTIVE');
  const completeness = completenessOf(uniqueConflicts, unresolvedFields);
  const path: SemanticTurnIR['resolution']['path'] =
    resolution === undefined ? 'DETERMINISTIC' : resolution.path;
  const irRelationship =
    roles.relationship === null || advisory
      ? []
      : [
          {
            actorA: roles.relationship.actorA,
            actorB: roles.relationship.actorB,
            relation: roles.relationship.relations,
            object: roles.relationship.object,
            venue: roles.relationship.venue,
            temporalRole: relationCurrent
              ? temporalRoleOf(temporalSemantics) === 'NONE'
                ? ('CURRENT_STATE' as const)
                : temporalRoleOf(temporalSemantics)
              : relationshipReasoning
                ? ('HISTORICAL' as const)
                : temporalRoleOf(temporalSemantics),
            basis: roles.relationship.basis,
          },
        ];
  const ir: SemanticTurnIR = {
    version: SEMANTIC_IR_VERSION,
    language: lang,
    turn: {
      primaryJob: (job.job as UserJob | null) ?? null,
      depth: job.depth,
      freshness,
      evidence,
      transformation: job.transformation,
      temporalRole:
        mixed && temporalSemantics.currentness === 'HISTORICAL_AND_CURRENT'
          ? 'HISTORICAL_AND_CURRENT'
          : explicitCurrent
            ? (clauses.find((c) => c.kind === 'CURRENT')?.clause.temporalRole ?? 'CURRENT_STATE')
            : temporalRoleOf(temporalSemantics),
      confidence: job.confidence,
    },
    clauses: clauses.map((c) => c.clause),
    entities: roles.entities.map((e) => ({
      id: e.id,
      type: e.type,
      iso3: e.iso3,
      parentIso3: e.parentIso3,
      surface: e.surface,
      span: [e.start, e.end] as const,
      role: e.role,
    })),
    relationships: irRelationship,
    references,
    objective,
    resolution: {
      path,
      needsSemanticResolution:
        path === 'DETERMINISTIC' && shouldEscalate(uniqueConflicts, unresolvedFields),
      conflicts: uniqueConflicts,
      completeness,
      unresolvedFields,
    },
  };

  return {
    ir,
    decision: {
      knowledge,
      historicalOverride,
      stableOrComputed,
      placeReference,
      advisory,
      decision,
      broadHeadlines,
      relationship: relationshipAny,
      relationshipReasoning,
      reasoning,
      job,
      decisionObjective,
      currentEvidenceNeeded:
        ('currentClauses' in knowledge ? knowledge.currentClauses : undefined) ?? [],
      temporalSemantics,
      typedGeographyOverride,
      semanticClarification,
    },
  };
}

/** The reader text the semantic layer reads (exported for diagnostics / tests). */
export function semanticReaderText(question: string, language: string): string {
  return normalizeTurn(question, language).text;
}
