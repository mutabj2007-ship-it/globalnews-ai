/**
 * ASK R2 CORE ROUTER — THE QUESTION ENVELOPE PRODUCER
 *
 * Server-derived. Never on the wire. `AnalyzeNewsDto` unchanged.
 *
 * THIS MODULE CLASSIFIES NOTHING. It composes an envelope from facts the server
 * already holds plus the six landed classifier readings. Main's ruling is that a
 * seventh classifier would be the worst available answer, so the only judgement this
 * module makes is about DERIVATION COVERAGE — whether an axis was read at all.
 */

import type {
  AskQuestionEnvelope,
  DerivationState,
  DomainAxis,
  GeographyAxis,
  GeographyCandidate,
  IdentityAxis,
  LandedClassifierReading,
  LanguageAxis,
  LanguageClassification,
  MultiStoryAction,
  PersonalScope,
  SpatialPrecision,
  TemporalRequirement,
  TimeAxis,
  TopicAxis,
} from './ports.js';

/**
 * The languages the axis-derivation vocabulary actually covers.
 *
 * L measured the landed vocabulary as English by construction: 59/59 keywords and
 * 24/24 patterns ASCII, 22/24 patterns using `\b`. So this list is `en` and nothing
 * else, and it is a DECLARATION rather than a limit discovered at runtime.
 *
 * This is the whole mechanism behind the CTO's multilingual ruling: an axis is read
 * only in a covered language, so an unclassified or uncovered question can never
 * arrive at "current news" by having an empty domain vector.
 */
export const DERIVATION_COVERAGE: readonly string[] = ['en'];

/** Display languages. `pl` is half the display set and is NOT a derivation language. */
export const DISPLAY_LANGUAGES: readonly string[] = ['en', 'pl'];

export interface EnvelopeSource {
  readonly rawQuestion: string;
  readonly questionLanguage: string | null;
  readonly languageClassification: LanguageClassification;

  readonly identityVerified?: boolean;
  readonly computeConsent?: 'ABSENT' | 'GRANTED';

  readonly declaredRegion?: string;
  readonly typedGeography?: { value: string; precision: SpatialPrecision };
  readonly entityGeography?: { value: string; precision: SpatialPrecision };
  readonly storyAnchorCountry?: string;
  readonly mapContextCountry?: string;

  readonly topicTerms?: readonly string[];
  readonly statedPeriod?: string;
  readonly temporalRequirement?: TemporalRequirement;

  readonly selectionAction?: MultiStoryAction;
  readonly articleRefs?: readonly string[];

  readonly personalRequested?: boolean;
  readonly personalScope?: PersonalScope;

  readonly attachmentCount?: number;
  readonly computationRequested?: boolean;
  readonly officialRequested?: boolean;
  readonly officialTerms?: readonly string[];
  readonly currentStatusRequested?: boolean;
  readonly currentStatusTerms?: readonly string[];

  /**
   * CTO correction 2. NO LANDED PRODUCER EXISTS for either field; both are declared
   * server-side inputs, recorded as such in `corpus/baseline-facts.ts`.
   */
  readonly explicitSpecialistDomains?: readonly string[];
  readonly materiallySpecialistDomains?: readonly string[];

  readonly reading: LandedClassifierReading;

  /**
   * The producible-precision ceiling, from `administrative-ladder.contract.ts`.
   * COUNTRY in this baseline. Passed in rather than assumed so a call site can never
   * widen it — E1's standing rule.
   */
  readonly producibleCeiling?: SpatialPrecision;
}

/**
 * Derivation state for one axis, decided by LANGUAGE COVERAGE and never by how many
 * keywords happened to match.
 *
 * This is the answer to L's strongest finding — "the presence of accidental
 * multilingual detection that nobody declared and no test covers". `region` matching
 * inside a Polish word is not Polish coverage, so a match in an uncovered language is
 * discarded rather than believed.
 */
function deriveState(
  language: string | null,
  classification: LanguageClassification,
  hasValue: boolean,
): DerivationState {
  if (classification === 'UNCLASSIFIED' || language === null) return 'NOT_DERIVED_UNREADABLE';
  if (!DERIVATION_COVERAGE.includes(language)) return 'NOT_DERIVED_LANGUAGE';
  if (classification === 'UNSUPPORTED') return 'NOT_DERIVED_LANGUAGE';
  return hasValue ? 'DERIVED' : 'DERIVED_EMPTY';
}

/** True when an axis carries a value the planner is entitled to act on. */
export function isRead(state: DerivationState): boolean {
  return state === 'DERIVED' || state === 'DERIVED_EMPTY';
}

export function buildEnvelope(source: EnvelopeSource): AskQuestionEnvelope {
  const lang = source.questionLanguage;
  const cls = source.languageClassification;

  const language: LanguageAxis = {
    questionLanguage: lang,
    classification: cls,
    normalizationLanguage: 'EN',
    // This router never sets the display language. `responseLanguage` stays canonical.
    responseLanguage: lang !== null && DISPLAY_LANGUAGES.includes(lang) ? lang : null,
  };

  const identity: IdentityAxis = {
    state: source.identityVerified === true ? 'VERIFIED_ANALYSIS_USER' : 'ANONYMOUS',
    // Opaque and server-resolved. Never a caller-supplied value.
    subjectRef: source.identityVerified === true ? 'session:verified' : null,
  };

  const candidates: GeographyCandidate[] = [];
  if (source.declaredRegion !== undefined) {
    candidates.push({
      source: 'DECLARED_REGION',
      value: source.declaredRegion,
      // A requested region is a SCOPE, never a precision — G's wording, kept.
      precision: 'REGION',
    });
  }
  if (source.typedGeography !== undefined) {
    candidates.push({
      source: 'TYPED_GEOGRAPHY',
      value: source.typedGeography.value,
      precision: source.typedGeography.precision,
    });
  }
  if (source.entityGeography !== undefined) {
    candidates.push({
      source: 'ENTITY_GEOGRAPHY',
      value: source.entityGeography.value,
      precision: source.entityGeography.precision,
    });
  }
  if (source.storyAnchorCountry !== undefined) {
    candidates.push({
      source: 'STORY_ANCHOR',
      value: source.storyAnchorCountry,
      precision: 'COUNTRY',
    });
  }
  if (source.mapContextCountry !== undefined) {
    candidates.push({
      source: 'MAP_GEOGRAPHY_CONTEXT',
      value: source.mapContextCountry,
      precision: 'COUNTRY',
    });
  }

  const geography: GeographyAxis = {
    candidates,
    producibleCeiling: source.producibleCeiling ?? 'COUNTRY',
  };

  const topicTerms = source.topicTerms ?? [];
  const topicState = deriveState(lang, cls, topicTerms.length > 0);
  const topic: TopicAxis = {
    // Reader's own words only. Never a resolved `NewsCategory` member — E1 area 7
    // forbids this axis importing the news taxonomy, and CTO rules topic and
    // analytical domain are separate axes.
    readerTerms: isRead(topicState) ? topicTerms : [],
    derivedIn: isRead(topicState) ? lang : null,
    derivation: topicState,
  };

  const readDomains = source.reading.analyticalDomains;
  const domainState = deriveState(lang, cls, readDomains.length > 0);
  const domains: DomainAxis = {
    // Suppressed when the language is not covered, EVEN IF the landed English matcher
    // returned members. An undeclared accidental capability is not a capability.
    domains: isRead(domainState) ? readDomains : [],
    derivedIn: isRead(domainState) ? lang : null,
    derivation: domainState,
  };

  const statedPeriod = source.statedPeriod ?? null;
  const timeState = deriveState(lang, cls, statedPeriod !== null);
  const time: TimeAxis = {
    // TEXT at the reader's own precision. Main finding 4: the storage type must never
    // be more precise than the fact. No parsing, no normalisation, no ISO coercion.
    statedPeriod: isRead(timeState) ? statedPeriod : null,
    requirement: isRead(timeState) ? (source.temporalRequirement ?? 'NONE') : 'NONE',
    derivedIn: isRead(timeState) ? lang : null,
    derivation: timeState,
  };

  return {
    rawQuestion: source.rawQuestion,
    identity,
    language,
    geography,
    topic,
    domains,
    time,
    selection: {
      action: source.selectionAction ?? null,
      articleRefs: source.articleRefs ?? [],
    },
    followUp: {
      hasConversationContext: source.reading.conversationSubject.hasPriorQuestion,
    },
    personal: {
      requested: source.personalRequested === true,
      scope: source.personalScope ?? null,
    },
    attachments: { count: source.attachmentCount ?? 0 },
    computation: { requested: source.computationRequested === true },
    official: {
      requested: source.officialRequested === true,
      readerTerms: source.officialTerms ?? [],
    },
    currentStatus: {
      requested: source.currentStatusRequested === true,
      readerTerms: source.currentStatusTerms ?? [],
    },
    specialistRequest: {
      // Suppressed with the domain axis when the language is not covered: a requiredness
      // claim about a domain that was never read would be a claim about nothing.
      explicitDomains: isRead(domainState) ? (source.explicitSpecialistDomains ?? []) : [],
      materiallyRequiredDomains: isRead(domainState)
        ? (source.materiallySpecialistDomains ?? [])
        : [],
    },
    classifiers: source.reading,
    computeConsent: source.computeConsent ?? 'GRANTED',
  };
}
