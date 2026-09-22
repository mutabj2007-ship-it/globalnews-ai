import {
  assertSecurityObservationIsWellFormed,
  mayAdmitArtifact,
  mayPromoteToEvidence,
  type NewsArticle,
} from '@globalnews-ai/shared';
import { classifySecurityCandidate } from '../classification/security-candidate.classifier';
import {
  buildSecurityObservation,
  type RetainedGeographyAttribution,
} from './security-observation.factory';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE FACTORY — ADMISSION GATES, PROVENANCE, AND THE TIMESTAMP THAT IS NOT THERE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Three things are asserted here that would each be a real defect if they regressed, and none
 * of which throws when it breaks:
 *
 *   1. `occurredAt` IS ALWAYS ABSENT. A publication date is not an occurrence time. Setting
 *      it would put a false event time on a Security surface, and every honesty marker on
 *      that surface would still read as correct.
 *   2. `temporalBasis` FOLLOWS `publishedAtBasis`. An aggregator's observation time is an
 *      UPPER BOUND on publication, not a publisher vintage; spelling it PUBLISHER_VINTAGE
 *      would make our ingestion schedule look like the publisher's revision history.
 *   3. `retrievedAt` IS `firstSeenAt`, NEVER THE CLOCK. Reading the clock would restate the
 *      moment of this projection as the moment we learned the fact.
 *
 * The admission gates are asserted through the ACCEPTED functions rather than by checking
 * the factory's output shape, so a gate that stopped being called fails here.
 */

const RETAINED: NewsArticle = {
  id: 'article-1',
  title: 'Man shot dead in Kigali robbery',
  summary: 'Police said the shooting was committed by an unaffiliated individual acting alone.',
  url: 'https://example.test/a/1',
  sourceId: 'rwanda-times',
  sourceName: 'The Rwanda Times',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-09-20T08:00:00.000Z',
  publishedAtBasis: 'publisher',
  firstSeenAt: '2026-09-20T09:00:00.000Z',
  providerId: 'gnews',
  confidence: 82,
  countryCode: 'RW',
  countryName: 'Rwanda',
};

const GEOGRAPHY: RetainedGeographyAttribution = {
  countryCode: 'RW',
  countryName: 'Rwanda',
  relevanceScore: 82,
};

function decisionFor(article: NewsArticle) {
  return classifySecurityCandidate({ title: article.title, summary: article.summary });
}

function build(article: NewsArticle, geography: RetainedGeographyAttribution = GEOGRAPHY) {
  return buildSecurityObservation(article, geography, decisionFor(article));
}

describe('buildSecurityObservation — the admissible case', () => {
  it('builds an observation that passes the contract guard', () => {
    const outcome = build(RETAINED);

    expect(outcome.built).toBe(true);
    if (!outcome.built) return;
    expect(() => assertSecurityObservationIsWellFormed(outcome.observation)).not.toThrow();
  });

  it('attributes the claim to the PUBLISHER, not to the aggregator that delivered it', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.claimant).toBe('The Rwanda Times');
    // The aggregator is recorded as the provider, which is a different question.
    expect(outcome.observation.provenance.providerId).toBe('gnews');
    expect(outcome.observation.identity.upstreamAuthority).toBe('rwanda-times');
  });

  it('carries the publisher text VERBATIM — nothing is summarised or rewritten', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.claim.headline).toBe(RETAINED.title);
    expect(outcome.observation.claim.summary).toBe(RETAINED.summary);
  });

  it('records the terms that admitted it, so the admission is auditable from the row', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.claim.admittedByTerms).toContain('shot dead');
    expect(outcome.observation.claim.admittedByTerms.length).toBeGreaterThan(1);
  });

  it('never claims an institution for an ordinary news publisher', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    // "a publisher name is not an institution and inventing one would be a guess"
    expect(outcome.observation.provenance.institution).toBeUndefined();
  });

  it('leaves authorityClass absent when the official-source registry does not hold the publisher', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    // Absent, never 'OTHER' — that is a class the registry assigns deliberately.
    expect(outcome.observation.provenance.authorityClass).toBeUndefined();
  });

  it('attributes at COUNTRY precision and INTERPRETED provenance, and keeps them apart', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.geography.precision).toBe('COUNTRY');
    // The country came from our relevance gate, not from a location the publisher stated.
    expect(outcome.observation.geography.provenance).toBe('INTERPRETED');
    expect(outcome.observation.geography.attributionScore).toBe(82);
  });

  it('writes a first observation: ordinal 0, no supersedes link, no revision kind', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.revision.revisionOrdinal).toBe(0);
    expect(outcome.observation.revision.supersedesRevisionOrdinal).toBeNull();
    // A revisionKind on ordinal 0 would claim a correction path this lane does not have.
    expect(outcome.observation.revision.revisionKind).toBeUndefined();
  });
});

describe('the temporal model — the three axes, never collapsed', () => {
  it('never sets occurredAt, whatever the publication date says', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    // "Absent is not 'the publication date'."
    expect(outcome.observation.temporal.occurredAt).toBeUndefined();
  });

  it('maps a publisher-asserted time to PUBLISHER_VINTAGE', () => {
    const outcome = build({ ...RETAINED, publishedAtBasis: 'publisher' });
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.temporal.temporalBasis).toBe('PUBLISHER_VINTAGE');
    expect(outcome.observation.temporal.publisherVintage).toBe('2026-09-20T08:00:00.000Z');
  });

  /**
   * ══ THE ONE THAT WOULD SILENTLY LIE ══
   *
   * An aggregator recorded SEEING the article at that time. That is an upper bound on
   * publication, and it is not the publisher's vintage.
   */
  it('maps an aggregator-observed time to RETRIEVAL_ONLY and drops the vintage', () => {
    const outcome = build({ ...RETAINED, publishedAtBasis: 'observed' });
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.temporal.temporalBasis).toBe('RETRIEVAL_ONLY');
    expect(outcome.observation.temporal.publisherVintage).toBeUndefined();
    expect(() => assertSecurityObservationIsWellFormed(outcome.observation)).not.toThrow();
  });

  it('uses firstSeenAt as retrievedAt, never the current clock', () => {
    const outcome = build(RETAINED);
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.temporal.retrievedAt).toBe(RETAINED.firstSeenAt);
    expect(outcome.observation.revision.recordedAt).toBe(RETAINED.firstSeenAt);
  });

  it('refuses a record with no first-observation timestamp rather than inventing one', () => {
    const outcome = build({ ...RETAINED, firstSeenAt: undefined });

    expect(outcome.built).toBe(false);
    if (outcome.built) return;
    expect(outcome.refusal).toMatch(/SEC-FACTORY-1/);
  });
});

describe('the accepted admission gates are actually called', () => {
  it('refuses an anonymous record — it may be retained and may not be evidence', () => {
    const anonymous = { ...RETAINED, sourceName: '' };

    // Stage 1 ADMITS it: losing the fact that it was said would itself lose evidence.
    expect(
      mayAdmitArtifact({
        artifactId: anonymous.url,
        provenance: { sourceType: 'NEWS_PROVIDER' },
        evidenceRole: 'REPORTING',
        dataTier: 'OPEN',
        claimantId: '',
        isAiSynthesis: false,
      }).permitted,
    ).toBe(true);

    // Stage 2 REFUSES it, and so must the factory.
    const outcome = build(anonymous);
    expect(outcome.built).toBe(false);
    if (outcome.built) return;
    expect(outcome.refusal).toMatch(/SEC-EVID-1/);
    expect(outcome.stage?.stage).toBe('EVIDENCE');
  });

  it('positive control — the accepted evidence gate still refuses what it should', () => {
    const base = {
      artifactId: 'a',
      provenance: { sourceType: 'NEWS_PROVIDER' as const },
      evidenceRole: 'REPORTING' as const,
      dataTier: 'OPEN' as const,
      claimantId: 'A Publisher',
      isAiSynthesis: false,
    };

    expect(mayPromoteToEvidence(base).permitted).toBe(true);
    expect(mayPromoteToEvidence({ ...base, claimantId: '' }).permitted).toBe(false);
    expect(mayPromoteToEvidence({ ...base, dataTier: 'UNAVAILABLE' }).permitted).toBe(false);
    expect(mayPromoteToEvidence({ ...base, isAiSynthesis: true }).permitted).toBe(false);
    expect(mayPromoteToEvidence({ ...base, artifactId: '' }).permitted).toBe(false);
  });
});

describe('the factory builds nothing the classifier did not admit', () => {
  it.each([
    ['CONFLICT', 'Rebel fighters killed 12 civilians', 'The army deployed troops.'],
    ['POLITICS', 'Thousands join protest march', 'Demonstrators gathered peacefully.'],
    ['UNRESOLVED', 'Explosion damages road bridge', 'Engineers assessed the structure.'],
    ['NOT A CANDIDATE', 'Central bank holds rates', 'Inflation eased slightly.'],
    ['HAZARD', 'Curfew imposed as flooding spreads', 'An evacuation order covers four districts.'],
  ])('refuses a %s record and says which verdict refused it', (_label, title, summary) => {
    const outcome = build({ ...RETAINED, title, summary });

    expect(outcome.built).toBe(false);
    if (outcome.built) return;
    expect(outcome.refusal).toMatch(/Not admitted by classification/);
    // The refusal names the verdict, so a boundary exclusion is never mistaken for a
    // lexicon miss — those two facts call for opposite fixes.
    expect(outcome.stage).toBeNull();
  });
});

describe('identity is derived, never minted', () => {
  it('produces the same key for the same publisher and URL', () => {
    const a = build(RETAINED);
    const b = build({ ...RETAINED, id: 'article-2', title: RETAINED.title });
    if (!a.built || !b.built) throw new Error('expected built observations');

    // Identity is publisher + canonical URL. The local primary key has no part in it, which
    // is why re-projecting a row the corpus re-persisted under a new id is still one
    // observation.
    expect(a.observation.observationKey).toBe(b.observation.observationKey);
  });

  it('produces different keys for different URLs from the same publisher', () => {
    const a = build(RETAINED);
    const b = build({ ...RETAINED, url: 'https://example.test/a/2' });
    if (!a.built || !b.built) throw new Error('expected built observations');

    expect(a.observation.observationKey).not.toBe(b.observation.observationKey);
  });

  it('normalises the geography id to upper case on both the subject and the geography', () => {
    const outcome = build(RETAINED, { ...GEOGRAPHY, countryCode: 'rw' });
    if (!outcome.built) throw new Error('expected a built observation');

    expect(outcome.observation.subjectId).toBe('RW');
    expect(outcome.observation.geography.geographyId).toBe('RW');
  });
});
