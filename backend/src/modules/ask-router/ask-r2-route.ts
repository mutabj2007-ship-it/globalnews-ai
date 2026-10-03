/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — THE INTEGRATED ROUTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   question ──► L  normalizeAskQuestion        (qualified reading, no route/intent)
 *            ──► landed six readings            (landed-readings.ts)
 *            ──► G  producers                   (office geography, reader category,
 *                                                stated period, eligibility via QQ-10)
 *            ──► EnvelopeSource                 (this file — the ONLY composition)
 *            ──► frozen C  buildEnvelope + plan (unchanged bytes)
 *
 * Frozen C is the one routing authority (contract §1). Nothing here routes, classifies,
 * or picks a terminal: every decision is frozen C's, over inputs this file assembles.
 *
 * ── THE ONE ADAPTATION: THE NORMALIZATION VOCABULARY ────────────────────────────
 * Frozen C derives the topic/domain/time axes only when `questionLanguage` is in
 * `DERIVATION_COVERAGE = ['en']`, and its own `LanguageAxis` declares
 * `normalizationLanguage: 'EN'` (MA §8 layer 2): the axis vocabulary IS the English
 * concept vocabulary. L's boundary is exactly the layer that maps a Polish question onto
 * those English-keyed concepts (every PL resource is keyed by the EN concept it mirrors).
 *
 * So for a QUALIFIED or DEGRADED reading, the axes are derived in the normalization
 * vocabulary — `buildEnvelope` is called with the normalization language — and the
 * envelope's LANGUAGE axis is then restored to the truth: questionLanguage = the source
 * language, responseLanguage = the display language, normalizationLanguage 'EN'. Then the
 * frozen `plan()` runs. `derivedIn: 'en'` on the axes is literally true: that is the
 * vocabulary they were derived in.
 *
 * For a NOT_READ outcome nothing is substituted: frozen `route()` receives the source
 * language exactly, and frozen C's own LANGUAGE_UNSUPPORTED / UNCLASSIFIED clarification
 * results (its row L2 behaviour, unchanged).
 *
 * Both `buildEnvelope` and `plan` are frozen C's public exports; no frozen byte changes.
 * The alternative — editing DERIVATION_COVERAGE — is a frozen-semantics edit and is
 * recorded in the delivery as the seam it would have been (FS-2), not made.
 */

import { reportingWindowFor, type ReportingWindow } from './reporting-window';
import { type KnowledgeRequirement } from './knowledge-requirement';
import { buildEnvelope, type EnvelopeSource } from './frozen-c/src/envelope';
import { plan as frozenPlan, type PlannerDeps } from './frozen-c/src/planner';
import { route as frozenRoute } from './frozen-c/src/index';
import type {
  AskQuestionEnvelope,
  LanguageClassification,
  RoutingPlan,
  TemporalRequirement,
} from './frozen-c/src/ports';
import { detectOfficeGeography } from '../analysis/context-producers/office-geography.producer';
import type { InheritedContextEligibility } from '../analysis/context-producers/addendum.contract';
import {
  DEMONYM_SOURCE,
  normalizeAskQuestion,
  type NormalizationFailure,
  type NormalizationOutcome,
  type NormalizationRequest,
  type QualifiedReading,
} from './normalization/qualified-reading';
import { decideContextEligibility } from './normalization/semantic-subject';
import { readLandedClassifiers, type LandedReadingTrace } from './landed-readings';
import { readCapabilityRequests, type CapabilityRequestKind } from './capability-producers';
import { detectAmbiguousCountryMention } from '../analysis/anchor/event-anchor.util';
import { readInstitutionalStatusQuestion } from '../news/relevance/governed-institutions';
import { retainedCycleCovers } from '../ask-intelligence/contributor-selection';
import { type BilateralRelationship } from './bilateral-relationship';
import { type JobReading, type UserJob } from './user-job';
import { type TemporalSemantics } from './temporal-semantics';
import { interpretTurn, type BoundedConversationState } from './semantic-ir/interpret-turn';
import type { SemanticResolution } from './semantic-ir/semantic-interpreter';
import { SEMANTIC_IR_VERSION, type SemanticTurnIR } from './semantic-ir/semantic-turn-ir';
import { isDisplayLocale } from '@globalnews-ai/shared';

/** The vocabulary frozen C derives axes in (its `DERIVATION_COVERAGE`). */
export const NORMALIZATION_VOCABULARY = 'en';

export interface AskRouteContext {
  readonly priorQuestion?: string;
  /** The map's selected country (ISO3). Inherited context, never compulsory scope. */
  readonly mapContextCountry?: string;
  /** The anchored story's country (ISO3), when an article anchor resolved. */
  readonly storyAnchorCountry?: string;
  readonly hasResolvedArticleAnchor?: boolean;
  readonly articleRefs?: readonly string[];
  /**
   * UNIFIED INTELLIGENCE BINDING R2E — the question IS the server-resolved anchored story's own
   * headline (surface-supplied text). Places read from it are the story's, not typed by the
   * reader: they are carried with provenance SUPPLIED_BY_SURFACE and never become typed scope.
   */
  readonly questionIsStoryHeadline?: boolean;
  readonly declaredRegion?: string;
  readonly identityVerified?: boolean;
  readonly computeConsent?: 'ABSENT' | 'GRANTED';
  /**
   * GATE H — the server-held instant of the request (ISO), supplied by the executor. The
   * route never reads a clock; with no instant, a stated absolute period is never HISTORICAL.
   */
  readonly requestInstant?: string;
  /**
   * CTO R4 — the conversation holds work this assistant already produced (a ConversationArtifact
   * from an earlier answer in this owner-verified thread). Its presence lets "that idea", "which
   * part", "turn that into…" resolve to it. Conversation memory, never evidence or scope.
   */
  readonly priorWork?: { readonly kind: string; readonly label: string };
  /**
   * CTO R4 fifth pass — the objective the READER stated earlier in this thread (bounded semantic
   * state from their own words, newest wins). A decision with no objective of its own uses it
   * instead of asking "best for what?".
   */
  readonly conversationObjective?: string;
  /**
   * CTO R4 semantic IR §17 — the BOUNDED conversation state the interpretation may use: the latest
   * artifact (kind / label), the reader's structured objective, the options they named and the
   * portable subject. Never the transcript, never model prose as an objective.
   */
  readonly conversation?: BoundedConversationState;
  /** the 0-based ordinal of this reader turn in the thread (objective provenance) */
  readonly turnIndex?: number;
  /**
   * CTO R4 semantic IR §5 — the ONE bounded semantic interpretation's validated resolution, set
   * only by the executor after every control and before any provider (or its FALLBACK default).
   */
  readonly semanticResolution?: SemanticResolution;
  /**
   * CTO R4 — the bounded semantic classifier's verdict for an UNRESOLVED question (set only by the
   * executor, after every control): current evidence is required, so the reporting plan applies.
   * Kept for compatibility; read as a SemanticResolution.
   */
  readonly semanticJob?: { readonly job: UserJob; readonly needsCurrentEvidence: boolean };
}

/** IC-8: what fed what, recorded on every route so a missing seam is observable. */
export interface SeamTrace {
  readonly normalization: NormalizationOutcome['status'];
  readonly normalizationFailure?: NormalizationFailure;
  readonly sourceLanguage: string;
  readonly axesDerivedIn: string | null;
  readonly landed: LandedReadingTrace | null;
  readonly eligibility: InheritedContextEligibility['decision'] | 'NOT_EVALUATED';
  readonly producers: {
    readonly typedGeography: string | null;
    readonly statedPeriod: string | null;
    readonly readerCategory: string | null;
    readonly currentStatus: string | null;
    /** GATE H (S6) — the capability-request producers ran; the kinds whose marker fired. */
    readonly capability: readonly CapabilityRequestKind[] | null;
  };
  /**
   * ALPHA ENABLEMENT R1 (MC-055) — the one landed verdict the wrapper re-reads, and why:
   * a comparison whose members are the reader's own library is not member-less.
   */
  readonly landedOverride?: 'PERSONAL_MEMBER_SET' | null;
  /**
   * ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the DECLARED decoupling: for a
   * STABLE_REFERENCE / COMPUTATION question the read domains are deliberately NOT handed to
   * frozen C (a domain is not freshness). The wiring guard accepts empty frozen domains ONLY
   * when this says so; any undeclared loss of domains is still a missing seam.
   */
  readonly knowledgeDecoupling?:
    | 'STABLE_REFERENCE'
    | 'COMPUTATION'
    | 'PLACE_REFERENCE'
    | 'ADVISORY'
    | 'DECISION_SUPPORT'
    | 'REASONING'
    | null;
}

export interface AskR2Route {
  /**
   * ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — what kind of evidence / execution the
   * question needs (knowledge-requirement.ts), orthogonal to its analytical domain.
   */
  readonly knowledgeRequirement: KnowledgeRequirement | null;
  /**
   * PUBLIC BETA HARDENING R1B — an open-ended request for the current world headlines
   * (broad-global-headlines.util.ts): retrieved as headlines, never as a topic search.
   */
  readonly broadHeadlines: boolean;
  /**
   * BETA-ASK-005 — the bounded publication window the executor applies for a supported relative
   * period ("last 7 days"), anchored on the server request instant. Null otherwise.
   */
  readonly reportingWindow: ReportingWindow | null;
  /**
   * INTELLIGENCE BINDING R1 — the reader's own stated period, even when it is not carried as
   * a routing constraint (see statedPeriodIsConstraint): the executor still honours it, e.g.
   * current-status corroboration's 1-day window for "today". Null when none was stated.
   */
  readonly readerStatedPeriod: string | null;
  /** CTO P0 — for MIXED_ADVISORY_CURRENT, the reader's time-anchored clauses that need current sourced evidence. */
  readonly currentEvidenceNeeded: readonly string[];
  /** R3 §12 — for DECISION_SUPPORT: the reader's objective, null when none was stated. */
  readonly decisionObjective: string | null;
  /**
   * R3 §14 / PO-02 — a question about what happens BETWEEN two named countries
   * (bilateral-relationship.ts): both sides, the relation and its domain. Null otherwise.
   */
  readonly relationship: BilateralRelationship | null;
  /**
   * CTO R4 — the governed user-job reading (user-job.ts): what work the reader asked for, on its
   * own axis from whether current evidence is required. UNRESOLVED is decided at execution by the
   * bounded semantic classifier; it never means news.
   */
  readonly job: JobReading;
  /** CTO R4 fourth pass — the temporal interpretation of the reader's words (roles + currentness). */
  readonly temporalSemantics?: TemporalSemantics;
  /**
   * CTO R4 SEMANTIC IR — the ONE authoritative interpretation of this turn (semantic-turn-ir.ts).
   * Every R4 field above is derived from it; `resolution.needsSemanticResolution` tells the executor
   * to make the one bounded semantic call before any provider.
   */
  readonly semantic: SemanticTurnIR;
  /**
   * HARDENING §5 — interpretation was required, no valid verdict exists (interpreter unavailable,
   * breaker open, malformed / invalid answer) and stable reasoning is not clearly safe: the
   * governed outcome is a focused clarification, never a confident route.
   */
  readonly semanticClarification?: boolean;
  readonly outcome: NormalizationOutcome;
  readonly source: EnvelopeSource;
  readonly envelope: AskQuestionEnvelope;
  readonly plan: RoutingPlan;
  readonly eligibility: InheritedContextEligibility | null;
  readonly seam: SeamTrace;
}

/**
 * IC-8 · THE WIRING GUARD. Returns every seam a routed question should have crossed and
 * did not. Empty means wired. A Public-Beta qualification run asserts it is empty for
 * every row (contract §5): "an unwired producer returning a plausible default is a
 * failure" — so absence is reported by name, never defaulted.
 */
export function missingSeams(route: AskR2Route): readonly string[] {
  const missing: string[] = [];
  const s = route.seam;
  if (s.normalization === 'NOT_READ') {
    /* The one legitimate short-circuit: frozen C's own clarification, no retrieval. */
    if (route.plan.terminalState !== 'CLARIFICATION_REQUIRED')
      missing.push('NOT_READ_REACHED_EXECUTION');
    return missing;
  }
  if (s.landed === null) missing.push('LANDED_READINGS');
  else if (
    s.landed.queryIntent !==
    (s.normalization === 'SEMANTIC_FIRST' ? 'SEMANTIC_IR' : 'classifyQueryIntent')
  )
    missing.push('LANDED_INTENT');
  if (route.outcome.status !== 'NOT_READ') {
    /* The domains the reader's words carry: the reading's, plus a specialist domain the
       reader explicitly NAMED (GATE H S6 — frozen D3a/R1 key such a leg on this axis). */
    const readDomains: string[] = route.outcome.reading.domains.map((d) => d.value);
    for (const d of route.source.explicitSpecialistDomains ?? [])
      if (!readDomains.includes(d)) readDomains.push(d);
    const read = s.knowledgeDecoupling ? '' : readDomains.join(',');
    if (route.source.reading.analyticalDomains.join(',') !== read)
      missing.push('READING_TO_LANDED_DOMAINS');
    if (route.envelope.domains.domains.join(',') !== read)
      missing.push('READING_TO_FROZEN_DOMAINS');
    if (route.envelope.language.questionLanguage !== route.outcome.reading.sourceLanguage) {
      missing.push('SOURCE_LANGUAGE_TO_ENVELOPE');
    }
  }
  if (s.axesDerivedIn !== NORMALIZATION_VOCABULARY) missing.push('AXES_NOT_DERIVED');
  if (s.eligibility === 'NOT_EVALUATED') missing.push('QQ10_ELIGIBILITY');
  if (s.producers.capability === null) missing.push('CAPABILITY_PRODUCERS');
  return missing;
}

/* ── the reading → frozen input bindings ─────────────────────────────────── */

/** Every four-digit year the reader stated, e.g. "1994", "2019–2021". */
function statedYears(statedPeriod: string): number[] {
  return [...statedPeriod.matchAll(/(?<!\d)(1[5-9]\d{2}|20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
}

function temporalRequirementOf(
  reading: QualifiedReading,
  requestInstant?: string,
): TemporalRequirement {
  /* A current office/status is as-of-now by nature (frozen rows B2, W2). */
  if (reading.shape.officeConstruction) return 'AS_OF_NOW';
  /* A stated period: relative-to-ask → RECENT (frozen G1, L1, L2); an absolute date or
     range → EXPLICIT_WINDOW, or HISTORICAL when it closed before the request instant. */
  if (reading.statedTime !== undefined) {
    if (reading.statedTime.anchor === 'RELATIVE_TO_ASK') return 'RECENT';
    /* GATE H (Main MC-071) — a period CLOSED before the request's own year is HISTORICAL
       (frozen H1). Decided against the server-held request instant, never a clock read here;
       the current year stays an explicit window ("What were the results in 2026?"). */
    const askedIn =
      requestInstant === undefined ? Number.NaN : new Date(requestInstant).getUTCFullYear();
    const years = statedYears(reading.statedTime.statedPeriod);
    if (Number.isFinite(askedIn) && years.length > 0 && years.every((y) => y < askedIn))
      return 'HISTORICAL';
    return 'EXPLICIT_WINDOW';
  }
  if (reading.currentness.value === 'CURRENT') return 'RECENT';
  return 'NONE';
}

/** The first place the reader TYPED (read from the text), never a surface-supplied one. */
function typedGeographyOf(reading: QualifiedReading): string | undefined {
  const typed = reading.geography.find(
    (g) =>
      g.provenance !== 'SUPPLIED_BY_SURFACE' &&
      g.value !== 'CONTESTED' &&
      g.source !== DEMONYM_SOURCE,
  );
  if (typed !== undefined) return typed.value;
  /* G producer A: a current-office construction names its country ("the president of
     Turkey"). EN construction; PL office-of-country forms already arrive through the
     Polish country forms above. */
  if (reading.sourceLanguage === 'en') {
    return detectOfficeGeography(reading.originalQuestion)?.countryCode ?? undefined;
  }
  return undefined;
}

/**
 * GATE H (G V4-C1/V4-C4) — a country reached through a demonym ("Rwandan") is ENTITY
 * geography: the landed demonym resolver is its producer, and frozen C ranks it below a
 * typed place and makes it effective only when reporting requires geography.
 */
function entityGeographyOf(reading: QualifiedReading): string | undefined {
  return reading.geography.find((g) => g.source === DEMONYM_SOURCE)?.value;
}

function classificationFor(failure: NormalizationFailure): LanguageClassification {
  return failure === 'LANGUAGE_NOT_READABLE' ? 'UNSUPPORTED' : 'UNCLASSIFIED';
}

/**
 * Compose frozen C's `EnvelopeSource` from the reading, the landed readings and G's
 * producers. Every field is either a reading, a producer output, or the request's own
 * server-held context. Nothing is guessed.
 */
/*
  ════════════════════════════════════════════════════════════════════════════
  INTELLIGENCE BINDING R1 — TWO COMPOSITION CORRECTIONS (contract §11B, §6C)
  ════════════════════════════════════════════════════════════════════════════

  Frozen C drops a stated period and a topic term as UNTRANSPORTABLE constraints (no time or
  topic channel reaches retrieval) and offers broadening. That is right for a constraint the
  executor cannot honour, and wrong for one it already honours:

   1  "today" (and its same-day PL forms). Current reporting IS the most recent reporting, and
      the temporal requirement stays RECENT; the phrase itself still reaches the executor
      (AskR2Route.readerStatedPeriod) for current-status corroboration's 1-day window. Every
      other relative or absolute period stays a constraint exactly as before.
   2  a closed evaluation cycle that a governed retained artifact covers EXACTLY, when the
      question is about that artifact ("Ngoma's 2024/2025 Imihigo result") — the retained
      NISR evaluation IS that period; nothing needs to be transported to news retrieval.
   3  a reader category word that the reading ALSO carries as an analytical domain
      ("political" → domain political): one constraint, not a duplicate untransportable topic.

  Frozen C's bytes and rules are untouched: this only decides what the composition hands it.
*/
const SAME_DAY_PERIODS: ReadonlySet<string> = new Set([
  'today',
  'tonight',
  'this morning',
  'this evening',
  'dzisiaj',
  'dziś',
  'dzis',
]);
/** The reader's category word (or its category) → the analytical domain that already carries it. */
const CATEGORY_DOMAIN: Readonly<Record<string, string>> = {
  political: 'political',
  politics: 'political',
  economic: 'economic',
  economy: 'economic',
  business: 'economic',
  technology: 'technology',
  tech: 'technology',
};

export function statedPeriodIsConstraint(
  reading: QualifiedReading,
  requestInstant?: string,
): boolean {
  const stated = reading.statedTime;
  if (stated === undefined) return false;
  const phrase = stated.statedPeriod.trim().toLowerCase();
  if (stated.anchor === 'RELATIVE_TO_ASK' && SAME_DAY_PERIODS.has(phrase)) return false;
  /* BETA-ASK-005 — a supported relative window is honoured by the executor (reporting-window.ts). */
  if (reportingWindowFor(stated.statedPeriod, stated.anchor, requestInstant) !== null) return false;
  if (retainedCycleCovers(reading.originalQuestion, stated.statedPeriod)) return false;
  return true;
}

/** PUBLIC BETA HARDENING R1B — the composed source without its topic axis. */
function withoutTopic(source: EnvelopeSource): EnvelopeSource {
  const { topicTerms: _topic, ...rest } = source;
  void _topic;
  return rest;
}

/** TRUST & CONVERSATIONAL EXPERIENCE R1 — the composed source without its time requirement. */
function withoutTime(source: EnvelopeSource): EnvelopeSource {
  const { temporalRequirement: _time, ...rest } = source;
  void _time;
  return rest;
}

/** TRUST R1 §14 — the composed source without the reader's stated period (a trip's timing). */
function withoutStatedPeriod(source: EnvelopeSource): EnvelopeSource {
  const { statedPeriod: _period, ...rest } = source;
  void _period;
  return rest;
}

export function topicCarriedByDomain(reading: QualifiedReading): boolean {
  const category = reading.readerCategory?.value;
  const domain = category === undefined ? undefined : CATEGORY_DOMAIN[category];
  return domain !== undefined && reading.domains.some((d) => d.value === domain);
}

export function composeEnvelopeSource(
  reading: QualifiedReading,
  landed: ReturnType<typeof readLandedClassifiers>['reading'],
  eligibility: InheritedContextEligibility,
  ctx: AskRouteContext,
  capability: ReturnType<typeof readCapabilityRequests>['source'] = {},
  /** CTO R4 semantic IR — the first ACTOR, when the landed typed place is a venue / object */
  typedOverride?: string,
): EnvelopeSource {
  const typed =
    ctx.questionIsStoryHeadline === true ? undefined : (typedOverride ?? typedGeographyOf(reading));
  const entity = typed === undefined ? entityGeographyOf(reading) : undefined;
  /* CURRENT STATUS CORROBORATION R1 — the M2 governed shape (institution AND status subject). */
  const institutional = readInstitutionalStatusQuestion(reading.originalQuestion);
  /* GATE H (Main MC-069) — the reader typed a place that names several countries. An
     inherited Map country may settle it only when it IS one of them; otherwise it would
     silently answer for a place the reader did not name. */
  const contested = reading.geography.some((g) => g.value === 'CONTESTED')
    ? detectAmbiguousCountryMention(reading.originalQuestion)
    : undefined;
  const mapCountry =
    eligibility.suppresses.includes('MAP_GEOGRAPHY_CONTEXT') ||
    (contested !== undefined &&
      (ctx.mapContextCountry === undefined ||
        !contested.candidates.includes(ctx.mapContextCountry)))
      ? undefined
      : ctx.mapContextCountry;
  const storyCountry = eligibility.suppresses.includes('STORY_COUNTRY_HINT')
    ? undefined
    : ctx.storyAnchorCountry;
  const requirement = temporalRequirementOf(reading, ctx.requestInstant);

  return {
    rawQuestion: reading.originalQuestion,
    questionLanguage: reading.sourceLanguage,
    languageClassification: 'CLASSIFIED',
    ...(ctx.identityVerified === undefined ? {} : { identityVerified: ctx.identityVerified }),
    ...(ctx.computeConsent === undefined ? {} : { computeConsent: ctx.computeConsent }),
    ...(ctx.declaredRegion === undefined ? {} : { declaredRegion: ctx.declaredRegion }),
    ...(typed === undefined
      ? {}
      : { typedGeography: { value: typed, precision: 'COUNTRY' as const } }),
    ...(entity === undefined
      ? {}
      : { entityGeography: { value: entity, precision: 'COUNTRY' as const } }),
    ...(storyCountry === undefined ? {} : { storyAnchorCountry: storyCountry }),
    ...(mapCountry === undefined ? {} : { mapContextCountry: mapCountry }),
    /* Frozen B3: the topic axis carries the category the reader NAMED — G producer B's
       categoryTerm (its PL mirror for Polish). G's INTERPRETED reader words are not a
       constraint the reader imposed and are not bound here (FS-1). */
    ...(reading.readerCategory === undefined || topicCarriedByDomain(reading)
      ? {}
      : { topicTerms: [reading.readerCategory.value] }),
    ...(reading.statedTime === undefined || !statedPeriodIsConstraint(reading, ctx.requestInstant)
      ? {}
      : { statedPeriod: reading.statedTime.statedPeriod }),
    ...(requirement === 'NONE' ? {} : { temporalRequirement: requirement }),
    ...(ctx.articleRefs === undefined ? {} : { articleRefs: ctx.articleRefs }),
    ...(reading.shape.officeConstruction
      ? {
          currentStatusRequested: true,
          currentStatusTerms:
            reading.shape.officeTerm === undefined ? [] : [reading.shape.officeTerm],
        }
      : institutional !== null
        ? {
            /*
              CURRENT STATUS CORROBORATION R1 — a governed institution's current policy
              rate ("What is the current policy interest rate of the NBP?") is a status
              whose truth depends on the time of asking, exactly like an office. It now
              carries frozen C's CURRENT_STATUS contract, so the executor's deterministic
              corroboration decides PARTIAL vs INSUFFICIENT for it.
            */
            currentStatusRequested: true,
            currentStatusTerms: [institutional.subject.id],
          }
        : {}),
    ...capability,
    reading: landed,
  };
}

/**
 * CTO R4 seven-language — the landed reading of an interpreter-first turn: language-neutral facts
 * only (an earlier question exists; an article anchor resolved). No EN classifier reads FR–AR text.
 */
function semanticFirstLanded(ctx: AskRouteContext): ReturnType<typeof readLandedClassifiers> {
  const prior = ctx.priorQuestion?.trim() ?? '';
  return {
    reading: {
      queryIntent: 'EXPLANATION',
      analyticalDomains: [],
      sourceAttributed: { parsed: false, namedPublisher: null },
      eventAnchor: { hasEventAnchor: false, aspectCount: 0 },
      conversationSubject: { hasPriorQuestion: prior.length > 0, focusFromPriorQuestion: [] },
      questionAsksAboutCoverage: false,
    },
    trace: {
      queryIntent: 'SEMANTIC_IR',
      analyticalDomains: [],
      sourceAttributed: 'SEMANTIC_FIRST',
      eventAnchor: 'SEMANTIC_FIRST',
      conversationSubject: prior.length > 0 ? 'SEMANTIC_FIRST' : 'NO_PRIOR_QUESTION',
      questionAsksAboutCoverage: 'SEMANTIC_FIRST',
    },
  };
}

/** A question that was not read has an empty interpretation: frozen C's clarification decides. */
function unreadIR(language: string): SemanticTurnIR {
  return {
    version: SEMANTIC_IR_VERSION,
    language: isDisplayLocale(language) ? language : 'en',
    turn: {
      primaryJob: null,
      depth: 'STANDARD',
      freshness: 'NONE',
      evidence: 'NONE',
      transformation: null,
      temporalRole: 'NONE',
      confidence: 'LOW',
    },
    clauses: [],
    entities: [],
    relationships: [],
    references: {
      artifact: null,
      objective: false,
      choiceSet: false,
      target: 'NONE',
      confidence: 'LOW',
    },
    objective: null,
    resolution: {
      path: 'DETERMINISTIC',
      needsSemanticResolution: false,
      conflicts: [],
      /* not read: frozen C's own clarification decides; nothing to interpret */
      completeness: 'COMPLETE',
      unresolvedFields: [],
    },
  };
}

/**
 * THE INTEGRATED ASK R2 ROUTE. Pure: no I/O, no clock, no provider, no model call.
 */
export function routeAskR2(
  request: NormalizationRequest,
  ctx: AskRouteContext,
  deps: PlannerDeps,
): AskR2Route {
  const outcome = normalizeAskQuestion(request);

  if (outcome.status === 'NOT_READ') {
    /* Frozen C's own clarification path, fed the true language and the REAL landed
       readings of the raw text — never a placeholder standing in for a reading (IC-8).
       The domain axis is empty because nothing was read; frozen C suppresses every axis
       anyway, because the language was not covered. */
    const unread = readLandedClassifiers(request.originalQuestion, [], {
      ...(ctx.priorQuestion === undefined ? {} : { priorQuestion: ctx.priorQuestion }),
      hasResolvedArticleAnchor: ctx.hasResolvedArticleAnchor === true,
    });
    const source: EnvelopeSource = {
      rawQuestion: request.originalQuestion,
      questionLanguage: request.sourceLanguage,
      languageClassification: classificationFor(outcome.failure),
      reading: unread.reading,
    };
    const routed = frozenRoute(source, deps);
    return {
      knowledgeRequirement: null,
      broadHeadlines: false,
      reportingWindow: null,
      readerStatedPeriod: null,
      currentEvidenceNeeded: [],
      decisionObjective: null,
      relationship: null,
      job: {
        job: null,
        freshness: 'NONE',
        evidence: 'NONE',
        depth: 'STANDARD',
        transformation: null,
        discourseReference: 'NONE',
        temporal: [],
        source: 'UNRESOLVED',
        confidence: 'LOW',
        reason: 'question not read',
        basis: 'NONE',
      },
      semantic: unreadIR(request.sourceLanguage),
      outcome,
      source,
      envelope: routed.envelope,
      plan: routed.plan,
      eligibility: null,
      seam: {
        normalization: 'NOT_READ',
        normalizationFailure: outcome.failure,
        sourceLanguage: request.sourceLanguage,
        axesDerivedIn: null,
        landed: unread.trace,
        eligibility: 'NOT_EVALUATED',
        producers: {
          typedGeography: null,
          statedPeriod: null,
          readerCategory: null,
          currentStatus: null,
          capability: null,
        },
      },
    };
  }

  /* R2E — a story headline used as the question: its places are SURFACE-supplied, not typed. */
  const reading =
    ctx.questionIsStoryHeadline === true
      ? {
          ...outcome.reading,
          geography: outcome.reading.geography.map((g) => ({
            ...g,
            provenance: 'SUPPLIED_BY_SURFACE' as const,
          })),
        }
      : outcome.reading;
  /* CTO R4 seven-language — an interpreter-first turn (FR / DE / ES / PT / AR) never meets the EN
     landed classifiers: its landed reading is language-neutral and its intent is the IR's (below) */
  const semanticFirst = outcome.status === 'SEMANTIC_FIRST';
  const landed = semanticFirst
    ? semanticFirstLanded(ctx)
    : readLandedClassifiers(reading.originalQuestion, reading.domains, {
        ...(ctx.priorQuestion === undefined ? {} : { priorQuestion: ctx.priorQuestion }),
        hasResolvedArticleAnchor: ctx.hasResolvedArticleAnchor === true,
      });

  const typed = ctx.questionIsStoryHeadline === true ? undefined : typedGeographyOf(reading);
  const eligibility = decideContextEligibility(reading.subject, {
    typedGeographyPresent: typed !== undefined || ctx.declaredRegion !== undefined,
    resolvedArticleAnchorPresent: ctx.hasResolvedArticleAnchor === true,
    intentClass: landed.reading.queryIntent,
  });

  const capability = semanticFirst
    ? { source: {}, trace: [] }
    : readCapabilityRequests(reading.originalQuestion, reading.sourceLanguage, {
        hasResolvedArticleAnchor: ctx.hasResolvedArticleAnchor === true,
      });
  /* A specialist the reader explicitly named keys its leg on the domain axis (frozen D3a:
     the requested domain is both read and explicit). Appended, never substituted. */
  const namedDomains = (capability.source.explicitSpecialistDomains ?? []).filter(
    (d) => !landed.reading.analyticalDomains.includes(d),
  );
  /*
    ASK R2 ALPHA ENABLEMENT R1 (MC-055) — "Compare my saved stories". The landed classifier
    reads a comparison that names no members and asks which (CLARIFICATION_REQUIRED); frozen
    C honours that before the personal class (its row V1), so the reader was asked an
    irrelevant question instead of being told what is actually missing. But the reader DID
    name the members: their own library. When the personal producer has read that, the
    landed verdict is carried as COMPARISON_RESEARCH — exactly the reading frozen C's own
    row B7a gives this question — and frozen C then decides: IDENTITY_REQUIRED without a
    verified identity, the personal-library requirement with one. Frozen bytes unchanged;
    recorded on the seam trace.
  */
  const personalMemberSet =
    capability.source.personalRequested === true &&
    landed.reading.queryIntent === 'CLARIFICATION_REQUIRED';
  const landedReading = {
    ...landed.reading,
    ...(namedDomains.length === 0
      ? {}
      : { analyticalDomains: [...landed.reading.analyticalDomains, ...namedDomains] }),
    ...(personalMemberSet ? { queryIntent: 'COMPARISON_RESEARCH' as const } : {}),
  };
  /* A place the reader NAMED (its words appear in the question) makes it a place question. A
     resolver match the reader never wrote — "used together in TLS" resolved via the ISO code to
     "timor leste" — is an acronym collision in a technical question, not a country. */
  const fold = (value: string): string =>
    ` ${value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()} `;
  const questionFolded = fold(reading.originalQuestion);
  const namedPlace = reading.geography.some(
    (g) =>
      g.provenance !== 'SUPPLIED_BY_SURFACE' &&
      g.value !== 'CONTESTED' &&
      /* no matched text: conservatively a place the reader named */
      (g.matchedText === undefined || questionFolded.includes(fold(g.matchedText))),
  );
  /*
    ════════════════════════════════════════════════════════════════════════════
    CTO R4 SEMANTIC IR — ONE AUTHORITY FOR SEMANTIC MEANING (semantic-ir/interpret-turn.ts)
    ════════════════════════════════════════════════════════════════════════════
    Every R4 reader (knowledge requirement, user job, temporal semantics, clause intent, the
    currentness function, Stage A entities, Stage B roles, the objective, choice / reference) is a
    CANDIDATE signal. ONE composition resolves them into the SemanticTurnIR and the routing decision
    below; this route only hands frozen C the composition that decision names, and never re-reads
    the raw text to override an IR field. A turn with a named conflict carries
    needsSemanticResolution: the executor makes ONE bounded semantic call before any provider and
    recomposes with its validated resolution (ctx.semanticResolution).
  */
  const resolution: SemanticResolution | undefined =
    ctx.semanticResolution ??
    (ctx.semanticJob === undefined
      ? undefined
      : {
          path: 'SEMANTIC',
          job: ctx.semanticJob.job,
          needsCurrentEvidence: ctx.semanticJob.needsCurrentEvidence,
        });
  const { ir: semantic, decision: d } = interpretTurn({
    reading,
    namedPlace,
    landedIntent: landedReading.queryIntent,
    eligibleInheritedScope: eligibility.decision === 'ELIGIBLE',
    mapOrStoryContext: ctx.mapContextCountry !== undefined || ctx.storyAnchorCountry !== undefined,
    personal: capability.source.personalRequested === true,
    hasResolvedArticleAnchor: ctx.hasResolvedArticleAnchor === true,
    ...(ctx.priorQuestion === undefined ? {} : { priorQuestion: ctx.priorQuestion }),
    ...(ctx.requestInstant === undefined ? {} : { requestInstant: ctx.requestInstant }),
    ...(ctx.priorWork === undefined ? {} : { priorWork: ctx.priorWork }),
    ...(ctx.conversation === undefined ? {} : { conversation: ctx.conversation }),
    ...(ctx.conversationObjective === undefined
      ? {}
      : { conversationObjective: ctx.conversationObjective }),
    ...(ctx.turnIndex === undefined ? {} : { turnIndex: ctx.turnIndex }),
    ...(resolution === undefined ? {} : { resolution }),
  });
  /* interpreter-first: the landed intent IS the IR's decision (current evidence → a current event) */
  const composedLanded = semanticFirst
    ? {
        ...landedReading,
        queryIntent: (d.knowledge.requirement !== null &&
        d.knowledge.requirement !== 'STABLE_REFERENCE' &&
        d.knowledge.requirement !== 'ADVISORY' &&
        d.knowledge.requirement !== 'DECISION_SUPPORT'
          ? 'CURRENT_EVENT'
          : 'EXPLANATION') as typeof landedReading.queryIntent,
      }
    : landedReading;
  const composedSource = composeEnvelopeSource(
    reading,
    composedLanded,
    eligibility,
    ctx,
    capability.source,
    d.typedGeographyOverride ?? undefined,
  );
  const {
    knowledge,
    historicalOverride,
    stableOrComputed,
    placeReference,
    advisory,
    decision,
    broadHeadlines,
    relationshipReasoning,
    reasoning,
    job,
    temporalSemantics,
  } = d;
  const relationshipAny = d.relationship;
  const {
    temporalRequirement: _time,
    topicTerms: _topic,
    typedGeography: _code,
    ...unconstrained
  } = composedSource;
  void _time;
  void _topic;
  void _code;
  let source: EnvelopeSource =
    stableOrComputed && !relationshipReasoning
      ? {
          ...(historicalOverride
            ? withoutStatedPeriod(unconstrained as EnvelopeSource)
            : unconstrained),
          reading: { ...composedSource.reading, queryIntent: 'EXPLANATION', analyticalDomains: [] },
          ...(knowledge.requirement === 'COMPUTATION' ? { computationRequested: true } : {}),
        }
      : placeReference && !relationshipReasoning
        ? {
            /* a stated period that passed the gate above is the trip's timing (TRUST R1 §14), no
             reporting constraint for frozen C; readerStatedPeriod still carries the words. */
            ...withoutStatedPeriod(withoutTopic(withoutTime(composedSource))),
            reading: {
              ...composedSource.reading,
              queryIntent: 'ENTITY_BACKGROUND',
              analyticalDomains: [],
            },
          }
        : advisory || reasoning
          ? namedPlace
            ? {
                ...withoutStatedPeriod(withoutTopic(withoutTime(composedSource))),
                reading: {
                  ...composedSource.reading,
                  queryIntent: 'ENTITY_BACKGROUND',
                  analyticalDomains: [],
                },
              }
            : {
                ...withoutStatedPeriod(unconstrained as EnvelopeSource),
                reading: {
                  ...composedSource.reading,
                  queryIntent: 'EXPLANATION',
                  analyticalDomains: [],
                },
              }
          : broadHeadlines
            ? withoutTopic(composedSource)
            : composedSource;

  /* Axes derived in the normalization vocabulary; language axis restored to the truth. */
  /*
    HARDENING §11 — THE IR IS THE ONLY CURRENTNESS AUTHORITY. The envelope producers (the office /
    institution status readers) never request current status on their own: when the final IR
    establishes no freshness, the request is removed before frozen C plans.
  */
  const irNotCurrent =
    semantic.turn.freshness === 'NONE' && !semantic.resolution.needsSemanticResolution;
  if (irNotCurrent && source.currentStatusRequested === true) {
    const {
      currentStatusRequested: _requested,
      currentStatusTerms: _terms,
      ...rest
    } = source as EnvelopeSource & { currentStatusTerms?: readonly string[] };
    void _requested;
    void _terms;
    source = rest as EnvelopeSource;
  }
  const derived = buildEnvelope({ ...source, questionLanguage: NORMALIZATION_VOCABULARY });
  const envelope: AskQuestionEnvelope = {
    ...derived,
    rawQuestion: reading.originalQuestion,
    language: {
      questionLanguage: reading.sourceLanguage,
      classification: 'CLASSIFIED',
      normalizationLanguage: 'EN',
      responseLanguage: reading.displayLanguage,
    },
  };

  return {
    knowledgeRequirement: knowledge.requirement,
    broadHeadlines,
    reportingWindow: reportingWindowFor(
      reading.statedTime?.statedPeriod,
      reading.statedTime?.anchor,
      ctx.requestInstant,
    ),
    readerStatedPeriod: reading.statedTime?.statedPeriod ?? null,
    currentEvidenceNeeded: d.currentEvidenceNeeded,
    /* CTO R4 semantic IR — the turn's own objective, else the conversation's (reader's words), else
       a DECISION_CRITERIA artifact's label: "best for what?" only when none exists */
    decisionObjective: d.decisionObjective,
    /* R3 §14 / CTO R4 — the two-country scope from the IR's ACTORS (never a venue / object) */
    relationship: relationshipAny,
    job,
    temporalSemantics,
    semantic,
    semanticClarification: d.semanticClarification,
    outcome,
    source,
    envelope,
    plan: frozenPlan(envelope, deps),
    eligibility,
    seam: {
      normalization: outcome.status,
      sourceLanguage: reading.sourceLanguage,
      axesDerivedIn: derived.domains.derivedIn,
      landed: landed.trace,
      eligibility: eligibility.decision,
      producers: {
        typedGeography: typed ?? null,
        statedPeriod: reading.statedTime?.source ?? null,
        readerCategory: reading.readerCategory?.source ?? null,
        currentStatus: reading.shape.officeConstruction
          ? (reading.shape.officeTerm ?? 'office')
          : null,
        capability: [...new Set(capability.trace.map((t) => t.kind))],
      },
      landedOverride: personalMemberSet ? 'PERSONAL_MEMBER_SET' : null,
      knowledgeDecoupling:
        stableOrComputed && !relationshipReasoning
          ? (knowledge.requirement as 'STABLE_REFERENCE' | 'COMPUTATION')
          : placeReference && !relationshipReasoning
            ? 'PLACE_REFERENCE'
            : advisory
              ? decision
                ? 'DECISION_SUPPORT'
                : 'ADVISORY'
              : reasoning
                ? 'REASONING'
                : null,
    },
  };
}
