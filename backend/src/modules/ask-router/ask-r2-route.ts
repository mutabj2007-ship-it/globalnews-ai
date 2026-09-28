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
  normalizeAskQuestion,
  type NormalizationFailure,
  type NormalizationOutcome,
  type NormalizationRequest,
  type QualifiedReading,
} from './normalization/qualified-reading';
import { decideContextEligibility } from './normalization/semantic-subject';
import { readLandedClassifiers, type LandedReadingTrace } from './landed-readings';

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
  readonly declaredRegion?: string;
  readonly identityVerified?: boolean;
  readonly computeConsent?: 'ABSENT' | 'GRANTED';
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
  };
}

export interface AskR2Route {
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
    const read = route.outcome.reading.domains.map((d) => d.value).join(',');
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
  return missing;
}

/* ── the reading → frozen input bindings ─────────────────────────────────── */

function temporalRequirementOf(reading: QualifiedReading): TemporalRequirement {
  /* A current office/status is as-of-now by nature (frozen rows B2, W2). */
  if (reading.shape.officeConstruction) return 'AS_OF_NOW';
  /* A stated period: relative-to-ask → RECENT (frozen G1, L1, L2); an absolute date or
     range → EXPLICIT_WINDOW. HISTORICAL is NOT produced: telling "1994" from "2026"
     needs the request instant, and no producer on this path holds a clock (G C). */
  if (reading.statedTime !== undefined) {
    return reading.statedTime.anchor === 'RELATIVE_TO_ASK' ? 'RECENT' : 'EXPLICIT_WINDOW';
  }
  if (reading.currentness.value === 'CURRENT') return 'RECENT';
  return 'NONE';
}

/** The first place the reader TYPED (read from the text), never a surface-supplied one. */
function typedGeographyOf(reading: QualifiedReading): string | undefined {
  const typed = reading.geography.find(
    (g) => g.provenance !== 'SUPPLIED_BY_SURFACE' && g.value !== 'CONTESTED',
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

function classificationFor(failure: NormalizationFailure): LanguageClassification {
  return failure === 'LANGUAGE_NOT_READABLE' ? 'UNSUPPORTED' : 'UNCLASSIFIED';
}

/**
 * Compose frozen C's `EnvelopeSource` from the reading, the landed readings and G's
 * producers. Every field is either a reading, a producer output, or the request's own
 * server-held context. Nothing is guessed.
 */
export function composeEnvelopeSource(
  reading: QualifiedReading,
  landed: ReturnType<typeof readLandedClassifiers>['reading'],
  eligibility: InheritedContextEligibility,
  ctx: AskRouteContext,
): EnvelopeSource {
  const typed = typedGeographyOf(reading);
  const mapCountry = eligibility.suppresses.includes('MAP_GEOGRAPHY_CONTEXT')
    ? undefined
    : ctx.mapContextCountry;
  const storyCountry = eligibility.suppresses.includes('STORY_COUNTRY_HINT')
    ? undefined
    : ctx.storyAnchorCountry;
  const requirement = temporalRequirementOf(reading);

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
    ...(storyCountry === undefined ? {} : { storyAnchorCountry: storyCountry }),
    ...(mapCountry === undefined ? {} : { mapContextCountry: mapCountry }),
    /* Frozen B3: the topic axis carries the category the reader NAMED — G producer B's
       categoryTerm (its PL mirror for Polish). G's INTERPRETED reader words are not a
       constraint the reader imposed and are not bound here (FS-1). */
    ...(reading.readerCategory === undefined ? {} : { topicTerms: [reading.readerCategory.value] }),
    ...(reading.statedTime === undefined ? {} : { statedPeriod: reading.statedTime.statedPeriod }),
    ...(requirement === 'NONE' ? {} : { temporalRequirement: requirement }),
    ...(ctx.articleRefs === undefined ? {} : { articleRefs: ctx.articleRefs }),
    ...(reading.shape.officeConstruction
      ? {
          currentStatusRequested: true,
          currentStatusTerms:
            reading.shape.officeTerm === undefined ? [] : [reading.shape.officeTerm],
        }
      : {}),
    reading: landed,
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
        },
      },
    };
  }

  const reading = outcome.reading;
  const landed = readLandedClassifiers(reading.originalQuestion, reading.domains, {
    ...(ctx.priorQuestion === undefined ? {} : { priorQuestion: ctx.priorQuestion }),
    hasResolvedArticleAnchor: ctx.hasResolvedArticleAnchor === true,
  });

  const typed = typedGeographyOf(reading);
  const eligibility = decideContextEligibility(reading.subject, {
    typedGeographyPresent: typed !== undefined || ctx.declaredRegion !== undefined,
    resolvedArticleAnchorPresent: ctx.hasResolvedArticleAnchor === true,
    intentClass: landed.reading.queryIntent,
  });

  const source = composeEnvelopeSource(reading, landed.reading, eligibility, ctx);

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
      },
    },
  };
}
