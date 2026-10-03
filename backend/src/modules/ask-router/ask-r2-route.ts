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

import { plTolerant } from './pl-tolerant';
import { reportingWindowFor, type ReportingWindow } from './reporting-window';
import {
  deriveKnowledgeRequirement,
  genuineFreshness,
  isFuturePeriod,
  particularPhenomenon,
  type KnowledgeRequirement,
} from './knowledge-requirement';
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
import { isBroadGlobalHeadlinesQuestion } from '../analysis/query/broad-global-headlines.util';
import { readBilateralRelationship, type BilateralRelationship } from './bilateral-relationship';
import { readUserJob, REASONING_JOBS, type JobReading, type UserJob } from './user-job';
import { EN_PUBLIC_EVENT, PL_PUBLIC_EVENT, yearRoles } from './advisory-requirement';
import { normalizeTurn } from './turn-normalization';
import { readTemporalSemantics, type TemporalSemantics } from './temporal-semantics';

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
   * CTO R4 — the bounded semantic classifier's verdict for an UNRESOLVED question (set only by the
   * executor, after every control): current evidence is required, so the reporting plan applies.
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
  else if (s.landed.queryIntent !== 'classifyQueryIntent') missing.push('LANDED_INTENT');
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
): EnvelopeSource {
  const typed = ctx.questionIsStoryHeadline === true ? undefined : typedGeographyOf(reading);
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
 * THE INTEGRATED ASK R2 ROUTE. Pure: no I/O, no clock, no provider, no model call.
 */
/* CTO R4 third pass — the reader asks for the REPORTING itself (an archive / coverage request) */
const REPORT_REQUEST: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:report(?:ed|ing|s)?|coverage|covered|news|headlines|articles?|press|newspapers?|journalists?|media\s+(?:said|reported|coverage))\b/i,
  pl: plTolerant(
    /(?:relacj\p{L}*\s+medi\p{L}*|doniesie\p{L}*|doniesi\p{L}*|artykuł\p{L}*|pras\p{L}*|nagłówk\p{L}*|wiadomoś\p{L}*|dziennikar\p{L}*|media\s+(?:pisały|podawały))/iu,
  ),
};
/* an earlier turn ABOUT reported items ("Compare the selected stories", "the latest articles"): the
   conversation's subject is current reporting, so a follow-up about it carries that evidence */
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
  const landed = readLandedClassifiers(reading.originalQuestion, reading.domains, {
    ...(ctx.priorQuestion === undefined ? {} : { priorQuestion: ctx.priorQuestion }),
    hasResolvedArticleAnchor: ctx.hasResolvedArticleAnchor === true,
  });

  const typed = ctx.questionIsStoryHeadline === true ? undefined : typedGeographyOf(reading);
  const eligibility = decideContextEligibility(reading.subject, {
    typedGeographyPresent: typed !== undefined || ctx.declaredRegion !== undefined,
    resolvedArticleAnchorPresent: ctx.hasResolvedArticleAnchor === true,
    intentClass: landed.reading.queryIntent,
  });

  const capability = readCapabilityRequests(reading.originalQuestion, reading.sourceLanguage, {
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
  const composedSource = composeEnvelopeSource(
    reading,
    landedReading,
    eligibility,
    ctx,
    capability.source,
  );
  /*
    ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the knowledge requirement, derived
    BEFORE frozen C (knowledge-requirement.ts). A DOMAIN says what a question is about, never
    that it needs today's news, and a stable concept with two names is not a comparison of
    members. For a STABLE_REFERENCE or COMPUTATION question (no stated period, not personal),
    frozen C is handed a stable, non-present-tense reading with no domain / topic / time
    constraint — so it plans REFERENCE_BACKGROUND_ONLY (or COMPUTATION) instead of requiring
    NEWS_REPORTING. Frozen C's bytes are untouched; every other question is composed exactly as
    before. The domains stay on the seam trace.
  */
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
  const requestYear =
    ctx.requestInstant === undefined ? undefined : new Date(ctx.requestInstant).getUTCFullYear();
  /*
    CTO R4 THIRD PASS — the R4 readers (knowledge requirement, currentness, job, relationship) read
    the reader's words with harmless FORM normalized (turn-normalization.ts: "whats" → "what is",
    a discourse "Now," removed). Frozen C, storage and display keep the original words.
  */
  const year = Number.isFinite(requestYear) ? requestYear : undefined;
  const lang2: 'en' | 'pl' = reading.sourceLanguage === 'pl' ? 'pl' : 'en';
  const readerText = normalizeTurn(reading.originalQuestion, reading.sourceLanguage).text;
  /*
    CTO R4 THIRD PASS — A COMPLETED HISTORICAL PERIOD IS NOT A REPORTING WINDOW. A stated period
    whose years are all in the past ("in 2008", "the 1918 pandemic"), with no window reaching the
    present ("since 2008") and no request for the reporting itself ("what did the press report in
    2008"), is historical / reference analysis: it never makes the question current.
  */
  const statedYears =
    reading.statedTime === undefined
      ? null
      : yearRoles(reading.statedTime.statedPeriod, lang2, year);
  const reportRequest = REPORT_REQUEST[lang2].test(readerText);
  const ownKnowledge = deriveKnowledgeRequirement(
    readerText,
    reading.sourceLanguage,
    namedPlace,
    year,
  );
  const historicalOverride =
    statedYears !== null &&
    statedYears.historical.length > 0 &&
    !statedYears.current &&
    statedYears.future.length === 0 &&
    !reportRequest &&
    /* a marker reaching the present anywhere ("…what happened there since?") keeps it current */
    !(
      ownKnowledge.requirement === 'CURRENT_REPORTING' &&
      ownKnowledge.reason === 'a freshness marker'
    ) &&
    ownKnowledge.requirement !== 'MIXED_REFERENCE_CURRENT';
  /* TRUST & CONVERSATIONAL EXPERIENCE R1 — a follow-up continues the KIND of question it follows:
     "Compare it with Kenya" after a Tanzania safari question is still travel preparation. Only
     when the service supplied a prior (a recognised follow-up) and this turn asserts no freshness
     of its own (a CURRENT_REPORTING reading by place alone is not freshness). */
  const priorKnowledge =
    ctx.priorQuestion === undefined
      ? null
      : deriveKnowledgeRequirement(
          normalizeTurn(ctx.priorQuestion, reading.sourceLanguage).text,
          reading.sourceLanguage,
        ).requirement;
  const continuesKind =
    ownKnowledge.requirement === null ||
    (ownKnowledge.requirement === 'CURRENT_REPORTING' && ownKnowledge.reason === 'a named place');
  const knowledge =
    priorKnowledge === 'PLACE_REFERENCE' && continuesKind
      ? { requirement: 'PLACE_REFERENCE' as const, reason: 'continues a place-reference question' }
      : /* CTO P0 — "And for enterprise customers?" after an advisory question is still advice */
        priorKnowledge === 'ADVISORY' && continuesKind
        ? { requirement: 'ADVISORY' as const, reason: 'continues an advisory question' }
        : ownKnowledge;
  /* R3 §12 — a decision is answered on the advisory path (reasoning, no news call). */
  const decision = knowledge.requirement === 'DECISION_SUPPORT';
  /* The landed classifier stays authoritative: a place-bearing or anchored reading (one country,
     several, a comparison with members, an article anchor) and an ELIGIBLE inherited context are
     never re-read as stable reference. */
  const placeFreeIntent = [
    'CURRENT_EVENT',
    'EXPLANATION',
    'ENTITY_BACKGROUND',
    'CLARIFICATION_REQUIRED',
  ].includes(landedReading.queryIntent);
  const stableOrComputed =
    (knowledge.requirement === 'STABLE_REFERENCE' || knowledge.requirement === 'COMPUTATION') &&
    (reading.statedTime === undefined || historicalOverride) &&
    !namedPlace &&
    placeFreeIntent &&
    /* an inherited Map / story context that the landed reading made ELIGIBLE scopes the answer */
    !(
      eligibility.decision === 'ELIGIBLE' &&
      (ctx.mapContextCountry !== undefined || ctx.storyAnchorCountry !== undefined)
    ) &&
    /* FINAL STAGE 2 CONVERGENCE R1 — a context-dependent follow-up ("How does this affect
       ordinary households?" after "What has changed in Kenya's economy?") is about the PRIOR
       subject, not a free-standing concept: its stable shape never detaches it from that
       subject. The service supplies `priorQuestion` only for subject / anaphoric follow-ups. */
    ctx.priorQuestion === undefined &&
    capability.source.personalRequested !== true;
  /*
    PUBLIC BETA HARDENING R1B — an open-ended request for the current world headlines ("Any
    global news can you share?", "What is happening around the world?", "Co się dzieje na
    świecie?"). Its whole vocabulary is closed (no place, organisation, topic, source or period
    can occur in it), so the reader category it may carry ("world") is the breadth of the request,
    not a topic constraint frozen C would have to transport: it is not bound. Never for a
    follow-up, a named place, an inherited Map / story scope or a personal request.
  */
  /*
    TRUST & CONVERSATIONAL EXPERIENCE R1 — PLACE_REFERENCE (knowledge-requirement.ts): a named
    place asked about for its history or a journey, with no stated period, no article anchor and
    no personal request. Frozen C is handed a background reading (no domain, no time requirement)
    that KEEPS the place, so it plans REFERENCE_BACKGROUND_ONLY scoped to it — exactly the plan
    "Tell me about Madagascar" already receives. Frozen bytes untouched; recorded on the seam.
  */
  const placeReference =
    !stableOrComputed &&
    knowledge.requirement === 'PLACE_REFERENCE' &&
    /* TRUST R1 §14 — a forward-pointing period in a TRAVEL request is the trip's timing, never a
       reporting window ("Going to Tanzania next year, any tips?"). Any other stated period keeps
       the existing path. */
    (reading.statedTime === undefined ||
      historicalOverride ||
      ('frame' in knowledge &&
        knowledge.frame === 'TRAVEL' &&
        isFuturePeriod(reading.statedTime.statedPeriod, reading.sourceLanguage, requestYear))) &&
    ctx.hasResolvedArticleAnchor !== true &&
    capability.source.personalRequested !== true;
  /*
    CTO P0 — ADVISORY / DECISION SUPPORT (advisory-requirement.ts). Advice is general guidance
    from reasoning: frozen C is handed the same background reading a stable question receives (no
    domain, topic or time constraint; a named place is KEPT as the subject), so it plans
    REFERENCE_BACKGROUND_ONLY and the existing background/reasoning provider answers it. No news
    provider is called, so a news outage cannot turn advice into INSUFFICIENT. MIXED keeps the same
    path; the time-anchored part is named on the answer as needing current sourced evidence.
    Never for an article-anchored or personal-library question.
  */
  const advisory =
    !stableOrComputed &&
    !placeReference &&
    (knowledge.requirement === 'ADVISORY' ||
      knowledge.requirement === 'MIXED_ADVISORY_CURRENT' ||
      decision) &&
    ctx.hasResolvedArticleAnchor !== true &&
    capability.source.personalRequested !== true;
  const broadHeadlines =
    !stableOrComputed &&
    !placeReference &&
    !advisory &&
    isBroadGlobalHeadlinesQuestion(reading.originalQuestion, reading.sourceLanguage) &&
    ctx.priorQuestion === undefined &&
    !namedPlace &&
    !(
      eligibility.decision === 'ELIGIBLE' &&
      (ctx.mapContextCountry !== undefined || ctx.storyAnchorCountry !== undefined)
    ) &&
    capability.source.personalRequested !== true;
  /*
    CTO R4 — THE GOVERNED USER JOB (user-job.ts), on its own axis from freshness. Two changes to
    what frozen C is handed, nothing else:
      · a REASONING job (deep conceptual analysis, explanation, planning, a transformation of
        earlier work, decision support…) that needs no current evidence is answered by reasoning —
        the same background composition advice already receives (a named place stays the subject);
      · an UNRESOLVED question (no governed form, no place, no period, no event, no inherited Map /
        story scope) is no longer defaulted to news: it is planned as reasoning and the executor's
        bounded semantic classifier decides, behind every control. Its verdict "current evidence
        is required" comes back as ctx.semanticJob and restores the reporting plan below.
    Never for a relationship, an article anchor, a personal-library question, broad headlines, or
    any path already decided above.
  */
  /* CTO R4 THIRD PASS — a two-country relationship is a scope object read independently of
     freshness (and of the place / stable paths, which would collapse it to one country) */
  const relationshipAny = advisory
    ? null
    : readBilateralRelationship(readerText, reading.sourceLanguage);
  /* a completed historical period in the text (a dated past event is not current affairs) */
  /* CTO R4 fourth pass — the temporal interpretation layer (temporal-semantics.ts): a completed
     dated event / historical period is history, resolved BEFORE the particular-event rule */
  const temporalSemantics = readTemporalSemantics(readerText, reading.sourceLanguage, year);
  const pastOnly = temporalSemantics.currentness === 'HISTORICAL';
  /* CTO R4 CLOSEOUT — a public-event noun is current affairs only for a PARTICULAR event (a named
     place, "the war", "this election", "obecny kryzys"); "how can a war reshape an economy" and
     "w czasie kryzysu" are conceptual subjects (knowledge-requirement.ts particularPhenomenon). */
  const publicEvent =
    !pastOnly &&
    particularPhenomenon(
      readerText,
      reading.sourceLanguage,
      reading.sourceLanguage === 'pl' ? PL_PUBLIC_EVENT : EN_PUBLIC_EVENT,
      namedPlace,
      year,
    );
  const fresh = genuineFreshness(readerText, reading.sourceLanguage, year);
  const formJob = readUserJob(readerText, reading.sourceLanguage, {
    requirement: knowledge.requirement,
    requirementReason: knowledge.reason,
    namedPlace,
    statedPeriod: reading.statedTime !== undefined && !historicalOverride,
    fresh,
    hasPriorWork: ctx.priorWork !== undefined,
    publicEvent,
    requestYear: year,
    reportRequest,
    inheritedScope:
      eligibility.decision === 'ELIGIBLE' &&
      (ctx.mapContextCountry !== undefined || ctx.storyAnchorCountry !== undefined),
  });
  const inheritedScope =
    eligibility.decision === 'ELIGIBLE' &&
    (ctx.mapContextCountry !== undefined || ctx.storyAnchorCountry !== undefined);
  /*
    CTO R4 THIRD PASS — A RELATIONSHIP IS CURRENT, HISTORICAL OR CONCEPTUAL; ITS SCOPE IS ALWAYS
    BOTH COUNTRIES. Current (a time, a window, a stated current period, a present-state form:
    "how are relations between…", "what is the relationship…") → the R3 per-side evidence path.
    Historical / conceptual (a past form, a completed period, a causal / conceptual question) —
    or one the place / stable paths would collapse to one country → reasoning, both countries
    kept as the relationship scope. Otherwise the bounded classifier decides (never news by
    default), the relationship travelling with the route either way.
  */
  const currentStated = reading.statedTime !== undefined && !historicalOverride;
  const relationCurrent =
    relationshipAny !== null &&
    (fresh ||
      currentStated ||
      formJob.temporal.some((t) => t.role === 'REPORTING_WINDOW') ||
      RELATION_PRESENT_STATE[lang2].test(readerText));
  const relationshipReasoning =
    relationshipAny !== null &&
    !relationCurrent &&
    ctx.hasResolvedArticleAnchor !== true &&
    capability.source.personalRequested !== true &&
    (historicalOverride ||
      pastOnly ||
      RELATION_PAST[lang2].test(readerText) ||
      formJob.analysis === 'CAUSAL' ||
      formJob.job === 'DEEP_CONCEPTUAL_ANALYSIS' ||
      placeReference ||
      stableOrComputed);
  /* the R3 current relationship path */
  const relationshipRead = relationCurrent ? relationshipAny : null;

  /* paths decided above, and scopes that are never re-read as reasoning */
  const otherwiseDecided =
    ((stableOrComputed || placeReference) && !relationshipReasoning) ||
    relationshipReasoning ||
    advisory ||
    broadHeadlines ||
    relationshipRead !== null ||
    ctx.hasResolvedArticleAnchor === true ||
    capability.source.personalRequested === true;
  /* frozen C's own clarification stays the authority, except for an explicit operation on this
     conversation's earlier work */
  const clarificationHolds =
    landedReading.queryIntent === 'CLARIFICATION_REQUIRED' &&
    formJob.discourseReference !== 'PRIOR_WORK' &&
    /* CTO R4 third pass — "Compare a 4-day week with a 5-day week": an imperative comparison of
       two named things that are not places is answered, not asked "which countries?" */
    !(formJob.job === 'COMPARISON' && formJob.basis === 'FORM' && !namedPlace);
  /* 1 · an R4 governed form that needs no current evidence */
  const reasoningByForm =
    !otherwiseDecided &&
    !clarificationHolds &&
    formJob.basis === 'FORM' &&
    formJob.job !== null &&
    REASONING_JOBS.has(formJob.job) &&
    formJob.freshness === 'NONE';
  /*
    2 · UNRESOLVED — no governed form, and nothing (time, event, inherited scope, a follow-up's
    prior subject) says this is current reporting. A place alone is scope, not freshness. The
    frozen plan is kept for routing; the executor asks the bounded semantic classifier BEFORE any
    news provider is spent, and falls back to reasoning — never to news — if it cannot.
  */
  const timeAnchored = formJob.temporal.some(
    (t) =>
      t.role !== 'PLAN_HORIZON' && t.role !== 'TRIP_DURATION' && t.role !== 'HISTORICAL_PERIOD',
  );
  /*
    CTO R4 THIRD PASS §13 — THE SAFETY RAIL: positive CURRENTNESS EVIDENCE. A turn enters current
    reporting deterministically only with at least one; with none it goes to the bounded semantic
    classifier (then reasoning / clarification) — never ambiguous → news.
  */
  const priorCurrent =
    ctx.priorQuestion !== undefined &&
    (() => {
      const p = normalizeTurn(ctx.priorQuestion, reading.sourceLanguage).text;
      const k = deriveKnowledgeRequirement(p, reading.sourceLanguage, false, year);
      return (
        genuineFreshness(p, reading.sourceLanguage, year) ||
        PRIOR_REPORTED_SUBJECT[lang2].test(p) ||
        k.requirement === 'MIXED_REFERENCE_CURRENT' ||
        k.requirement === 'MIXED_ADVISORY_CURRENT' ||
        k.requirement === 'EVENT_DISCOVERY' ||
        k.requirement === 'OFFICIAL_REFERENCE' ||
        (k.requirement === 'CURRENT_REPORTING' && k.reason !== 'a named place')
      );
    })();
  const governedCurrent =
    (knowledge.requirement === 'CURRENT_REPORTING' && knowledge.reason !== 'a named place') ||
    knowledge.requirement === 'EVENT_DISCOVERY' ||
    knowledge.requirement === 'OFFICIAL_REFERENCE' ||
    knowledge.requirement === 'MIXED_REFERENCE_CURRENT' ||
    knowledge.requirement === 'MIXED_ADVISORY_CURRENT';
  const currentnessEvidence: string[] = [
    ...(fresh ? ['EXPLICIT_TIME_OR_CHANGE'] : []),
    ...(currentStated ? ['STATED_CURRENT_PERIOD'] : []),
    ...(timeAnchored ? ['REPORTING_WINDOW'] : []),
    ...(publicEvent ? ['PARTICULAR_EVENT'] : []),
    ...(governedCurrent ? ['GOVERNED_CURRENT_FORM'] : []),
    ...(relationCurrent ? ['RELATIONSHIP_PRESENT_STATE'] : []),
    ...(inheritedScope ? ['INHERITED_SURFACE_SCOPE'] : []),
    ...(priorCurrent ? ['PRIOR_CURRENT_SUBJECT'] : []),
    ...(ctx.hasResolvedArticleAnchor === true ? ['ARTICLE_ANCHOR'] : []),
    ...(broadHeadlines ? ['HEADLINES_REQUEST'] : []),
  ];
  const unresolvedEligible =
    !otherwiseDecided &&
    !clarificationHolds &&
    !reasoningByForm &&
    (knowledge.requirement === null ||
      (knowledge.requirement === 'CURRENT_REPORTING' && knowledge.reason === 'a named place')) &&
    currentnessEvidence.length === 0;
  /* 3 · the executor's semantic verdict for an UNRESOLVED question */
  const reasoningBySemantics =
    unresolvedEligible && ctx.semanticJob !== undefined && !ctx.semanticJob.needsCurrentEvidence;
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
          job: ctx.semanticJob!.job,
          source: 'SEMANTIC',
          confidence: 'MEDIUM',
          reason: 'resolved by the bounded semantic classifier',
        }
      : unresolvedEligible && ctx.semanticJob !== undefined
        ? {
            ...formJob,
            job: ctx.semanticJob.job,
            freshness: 'CURRENT',
            evidence: 'CURRENT_REPORTING',
            source: 'SEMANTIC',
            confidence: 'MEDIUM',
            reason: 'the semantic classifier requires current evidence',
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
  const {
    temporalRequirement: _time,
    topicTerms: _topic,
    typedGeography: _code,
    ...unconstrained
  } = composedSource;
  void _time;
  void _topic;
  void _code;
  const source: EnvelopeSource =
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
    currentEvidenceNeeded:
      ('currentClauses' in knowledge ? knowledge.currentClauses : undefined) ?? [],
    decisionObjective:
      advisory && decision && 'objective' in knowledge ? (knowledge.objective ?? null) : null,
    /* R3 §14 / CTO R4 third pass — the two-country scope, current, historical or conceptual */
    relationship: relationshipAny,
    job,
    temporalSemantics,
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
