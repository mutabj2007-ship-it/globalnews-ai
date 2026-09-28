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
  /**
   * GATE H — the server-held instant of the request (ISO), supplied by the executor. The
   * route never reads a clock; with no instant, a stated absolute period is never HISTORICAL.
   */
  readonly requestInstant?: string;
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
    /* The domains the reader's words carry: the reading's, plus a specialist domain the
       reader explicitly NAMED (GATE H S6 — frozen D3a/R1 key such a leg on this axis). */
    const readDomains: string[] = route.outcome.reading.domains.map((d) => d.value);
    for (const d of route.source.explicitSpecialistDomains ?? [])
      if (!readDomains.includes(d)) readDomains.push(d);
    const read = readDomains.join(',');
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
export function composeEnvelopeSource(
  reading: QualifiedReading,
  landed: ReturnType<typeof readLandedClassifiers>['reading'],
  eligibility: InheritedContextEligibility,
  ctx: AskRouteContext,
  capability: ReturnType<typeof readCapabilityRequests>['source'] = {},
): EnvelopeSource {
  const typed = typedGeographyOf(reading);
  const entity = typed === undefined ? entityGeographyOf(reading) : undefined;
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
    ...capability,
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
          capability: null,
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
  const source = composeEnvelopeSource(reading, landedReading, eligibility, ctx, capability.source);

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
        capability: [...new Set(capability.trace.map((t) => t.kind))],
      },
      landedOverride: personalMemberSet ? 'PERSONAL_MEMBER_SET' : null,
    },
  };
}
