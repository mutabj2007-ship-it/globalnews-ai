import { decideSecuritySourceEligibility } from '../security-source-eligibility';
/** Internal retained-report projection. Source identity and eligibility decisions are
 * persisted; public eligibility remains denied. Publisher prose is retained only behind
 * the unconditional public-content gate. Publication time is never occurrence time. */

import {
  securityObservationKey,
  SECURITY_CLAIM_AUTHORSHIP,
  SECURITY_OBSERVATION_SUBJECT_TYPE,
  SECURITY_OBSERVED_AXIS,
  securityObservationIdentity,
  type NewsArticle,
  type ObservationTemporal,
  type SecurityObservation,
  type SourceProvenance,
  type StageVerdict,
} from '@globalnews-ai/shared';
/*
  THE REGISTRY IS THE BACKEND'S, AND IT IS READ RATHER THAN RE-DECLARED.

  `getOfficialSourceById` lives in `modules/official-sources`, not in shared: the
  VOCABULARY (`OfficialSourceClass`) is shared and the ENTRIES are the backend's. This lane
  adds no entry and changes none — it asks the existing registry whether it happens to know
  the publisher, and accepts "no" as an answer.
*/
import { getOfficialSourceById } from '../../official-sources/official-source-registry';
import type { SecurityCandidateDecision } from '../classification/security-candidate.classifier';

/**
 * The geography attribution this observation is built for, as the retained corpus holds it.
 *
 * It comes from `ArticleCountry` — the relevance-gated (article, country) relation — and
 * not from `Article.countryCode`, because the relation is the one the corpus itself treats
 * as the country attribution and it carries the score that attribution was made on.
 */
export interface RetainedGeographyAttribution {
  readonly countryCode: string;
  readonly countryName: string;
  readonly relevanceScore: number;
}

export type SecurityObservationBuildOutcome =
  | { readonly built: true; readonly observation: SecurityObservation }
  | { readonly built: false; readonly refusal: string; readonly stage: StageVerdict | null };

/**
 * THE PUBLISHER IS THE CLAIMANT.
 *
 * Not the provider. GNews and GDELT DELIVERED the record; the outlet named in it is who
 * made the claim, and `SEC-EVID-1` asks for the claimant. Attributing the claim to the
 * aggregator would make every article in the corpus share one claimant, which would defeat
 * the corroboration rule that counts DISTINCT source classes.
 */
/**
 * The provenance of one retained record.
 *
 * `institution` is deliberately never set. `SourceProvenance` says why: it is the
 * publishing institution *"as the registry names it — 'National Bank of Rwanda', not a
 * domain. Absent for an ordinary news publisher, because a publisher name is not an
 * institution and inventing one would be a guess."*
 *
 * `authorityClass` is set ONLY where the official-source registry actually holds the
 * publisher. A registry miss leaves it absent — never `OTHER`, which is a class the
 * registry assigns deliberately and not a synonym for "we did not find it".
 */
function sourceProvenanceFor(article: NewsArticle): SourceProvenance {
  const registryEntry = getOfficialSourceById(article.sourceId);
  return {
    sourceType: 'NEWS_PROVIDER',
    providerId: article.providerId ?? article.sourceId,
    jurisdiction: undefined,
    language: article.sourceLanguage,
    sourceUrl: article.url,
    retrievedAt: article.firstSeenAt,
    evidenceRole: 'REPORTING',
    authorityClass: registryEntry?.authorityClass,
  };
}

/**
 * The temporal record. See the file docblock for why `occurredAt` is absent.
 *
 * `retrievedAt` is `firstSeenAt` — the immutable first-observation timestamp the corpus
 * never rewrites — and NOT the current clock. `ObservationTemporal` requires it present
 * ("we always know this one"), so a record without it cannot produce an observation at
 * all; that refusal is in `buildSecurityObservation` and not papered over with `new Date()`,
 * which would record the moment of this projection as the moment we learned the fact.
 */
function temporalFor(article: NewsArticle, retrievedAt: string): ObservationTemporal {
  const publisherAsserted = (article.publishedAtBasis ?? 'publisher') === 'publisher';
  return {
    occurredAt: undefined,
    publisherVintage: publisherAsserted ? article.publishedAt : undefined,
    retrievedAt,
    temporalBasis: publisherAsserted ? 'PUBLISHER_VINTAGE' : 'RETRIEVAL_ONLY',
  };
}

/**
 * BUILD ONE OBSERVATION, OR REFUSE AND SAY WHY.
 *
 * It returns a refusal rather than throwing for the refusals that are ORDINARY — an
 * unadmitted artifact, a missing timestamp — because those are the expected shape of a
 * corpus and a caller iterating thousands of rows must not be stopped by one.
 *
 * It does NOT catch `assertSecurityObservationIsWellFormed`. A record that clears every
 * gate and still fails the contract guard is a defect in THIS file, not a property of the
 * corpus, and swallowing it would hide the one failure mode worth crashing on.
 */
export function buildSecurityObservation(
  article: NewsArticle,
  geography: RetainedGeographyAttribution,
  decision: SecurityCandidateDecision,
): SecurityObservationBuildOutcome {
  if (decision.verdict !== 'ADMITTED_TO_SECURITY') {
    return {
      built: false,
      refusal: `Not admitted by classification (${decision.verdict}): ${decision.reason}`,
      stage: null,
    };
  }

  /* Retained internal review only. This does not promote a record to public evidence. */
  const sourceEligibility = decideSecuritySourceEligibility(article);
  const evidenceVerdict: StageVerdict = {
    stage: 'EVIDENCE',
    permitted: sourceEligibility.internalReviewPermitted,
    reasons: sourceEligibility.reasons,
  };
  if (!evidenceVerdict.permitted) {
    return {
      built: false,
      refusal: evidenceVerdict.reasons.join(' '),
      stage: evidenceVerdict,
    };
  }

  /*
    `firstSeenAt` is written by the persistence layer and is absent only where the record
    was never persisted — in which case there is no retained evidence to project, and the
    honest answer is no observation rather than an observation timed by this process's clock.
  */
  const retrievedAt = article.firstSeenAt;
  if (retrievedAt === undefined || retrievedAt.trim().length === 0) {
    return {
      built: false,
      refusal:
        'SEC-FACTORY-1: the retained record carries no first-observation timestamp, so the ' +
        'observation could state when we retrieved it only by reading the current clock. ' +
        'Every observation states when we retrieved it, and none invents it.',
      stage: null,
    };
  }

  const identity = securityObservationIdentity(
    article.sourceId,
    article.url,
    geography.countryCode,
  );

  const observation: SecurityObservation & {
    sourceEligibility: typeof sourceEligibility;
    corpusPublishedAt: string;
  } = {
    sourceEligibility,
    corpusPublishedAt: article.publishedAt,
    /* The publisher, which `mayPromoteToEvidence` has already refused to admit as blank. */
    claimant: article.sourceName,
    observationKey: securityObservationKey(article.sourceId, article.url, geography.countryCode),
    identity,
    observationKind: 'SECURITY_INCIDENT_REPORT',
    subjectType: SECURITY_OBSERVATION_SUBJECT_TYPE,
    subjectId: geography.countryCode.trim().toUpperCase(),
    claim: {
      claimType: 'INCIDENT_REPORTED',
      axis: SECURITY_OBSERVED_AXIS,
      /* VERBATIM. Nothing is summarised, shortened, cleaned or rephrased. */
      headline: article.title,
      summary: article.summary,
      admittedByTerms: decision.admittedByTerms,
      ownership: decision.ownership,
    },
    temporal: temporalFor(article, retrievedAt),
    provenance: sourceProvenanceFor(article),
    sourceReference: {
      /*
        `citation` is left absent, not filled with the publisher's name. It is *"the
        publisher's own citation text, verbatim"* — a thing a statistical release carries
        and a news article does not — and `sourceName` already reaches the reader through
        the read model. Putting a name here would be a second, weaker home for attribution.
      */
      citation: undefined,
      sourceUrl: article.url,
    },
    attributeAuthorship: SECURITY_CLAIM_AUTHORSHIP,
    revision: {
      /*
        ORDINAL 0 AND NO SUPERSEDES LINK. Revision is APPEND-ONLY and a later correction
        arrives as ordinal 1 with `supersedesRevisionOrdinal: 0` and a stated
        `revisionKind` — `assertObservationRevisionAppends` enforces all three. The factory emits draft ordinal zero; the repository owns append-only revision allocation.
      */
      revisionOrdinal: 0,
      supersedesRevisionOrdinal: null,
      revisionKind: undefined,
      recordedAt: retrievedAt,
    },
    geography: {
      geographyId: geography.countryCode.trim().toUpperCase(),
      geographyName: geography.countryName,
      /*
        COUNTRY, and nothing finer. The retained corpus attributes an article to a country;
        it does not locate the reported incident. Claiming CITY from a city name in a
        headline would be precision inferred from text — and the precision authority exists
        to refuse exactly that inference.
      */
      precision: 'COUNTRY',
      /*
        INTERPRETED, not STATED. The country came from the corpus's own relevance gate,
        which is our reading of the text, not a location the publisher declared. Calling it
        STATED would raise the provenance to match a precision nobody established.
      */
      provenance: 'INTERPRETED',
      attributionScore: geography.relevanceScore,
    },
  };

  return { built: true, observation };
}
