import { SecurityObservationRepository } from './persistence/security-observation.repository';
import { buildSecurityObservation } from './provenance/security-observation.factory';
import { classifySecurityCandidate } from './classification/security-candidate.classifier';
import { decideSecuritySourceEligibility } from './security-source-eligibility';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { SecurityProducerService } from './security-producer.service';
import type { PrismaService } from '../../database/prisma.service';
import type { NewsArticle } from '@globalnews-ai/shared';
const article: NewsArticle = {
  id: 'a',
  title: 'A shooting was committed by an unaffiliated individual acting alone.',
  summary: 'Reported incident',
  url: 'https://example.test/a',
  sourceId: 'publisher',
  sourceName: 'Publisher',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date().toISOString(),
  firstSeenAt: new Date().toISOString(),
  publishedAtBasis: 'publisher',
  confidence: 99,
};
function fixture() {
  const result = buildSecurityObservation(
    article,
    { countryCode: 'RW', countryName: 'RW', relevanceScore: 17 },
    classifySecurityCandidate(article),
  );
  if (!result.built) throw Error('Fixture refused');
  const run = { id: 1, geographyId: 'RW', maxAgeMinutes: 1440, startedAt: new Date() };
  const row = {
    id: 2,
    runId: 1,
    observationKey: result.observation.observationKey,
    geographyId: 'RW',
    revisionOrdinal: 0,
    supersedesRevisionOrdinal: null,
    ownershipT1: true,
    ownershipT2: false,
    resolvedOwner: 'SECURITY',
    payload: result.observation,
    run,
  };
  const member = {
    runId: 1,
    observationId: 2,
    observationKey: row.observationKey,
    observation: row,
  };
  const stored = { ...run, completion: { status: 'OK' }, members: [member] };
  const tx = {
    securityProjectionRun: { findUnique: jest.fn().mockResolvedValue(run) },
    securityObservation: { findFirst: jest.fn().mockResolvedValue(row), create: jest.fn() },
    securityProjectionMember: { create: jest.fn() },
    securityProjectionCompletion: { create: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const prisma = {
    securityProjectionRun: { findFirst: jest.fn().mockResolvedValue(stored) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return {
    row,
    run,
    stored,
    tx,
    repo: new SecurityObservationRepository(prisma as unknown as PrismaService),
    observation: result.observation,
  };
}
describe('Security correction boundaries', () => {
  test('valid sealed evidence remains readable', async () => {
    const h = fixture();
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(true);
  });
  test('24-hour projection cannot satisfy 60-minute request', async () => {
    const h = fixture();
    expect((await h.repo.findByGeography({ geographyId: 'RW', maxAgeMinutes: 60 })).succeeded).toBe(
      false,
    );
  });
  test('evidence ageing out of the same requested interval fails closed', async () => {
    const h = fixture();
    (h.row.payload as any).corpusPublishedAt = new Date(Date.now() - 1441 * 60000).toISOString();
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
  });
  test.each(['identity', 'geography', 'ownership', 'revision', 'run', 'membership', 'eligibility'])(
    'read rejects %s disagreement',
    async (kind) => {
      const h = fixture();
      if (kind === 'identity') h.row.observationKey = 'other';
      if (kind === 'geography') h.row.geographyId = 'KE';
      if (kind === 'ownership') h.row.ownershipT2 = true;
      if (kind === 'revision') h.row.revisionOrdinal = 1;
      if (kind === 'run') h.row.run = { ...h.run, id: 99 };
      if (kind === 'membership') h.stored.members[0].observationId = 99;
      if (kind === 'eligibility')
        (h.row.payload as any).sourceEligibility.publicEvidencePermitted = true;
      expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
    },
  );
  test.each(['identity', 'geography', 'ownership', 'revision', 'run'])(
    'write refuses corrupt prior %s before reuse',
    async (kind) => {
      const h = fixture();
      if (kind === 'identity') h.row.observationKey = 'other';
      if (kind === 'geography') h.row.geographyId = 'KE';
      if (kind === 'ownership') h.row.ownershipT2 = true;
      if (kind === 'revision') h.row.revisionOrdinal = 1;
      if (kind === 'run')
        h.tx.securityProjectionRun.findUnique.mockResolvedValue({
          ...h.run,
          id: 99,
          geographyId: 'KE',
        });
      expect(await h.repo.completeRun(h.run, [h.observation], 'OK')).toBe(false);
      expect(h.tx.securityProjectionMember.create).not.toHaveBeenCalled();
    },
  );
  test('write refuses nonzero draft revision instead of silently rewriting it', async () => {
    const h = fixture();
    (h.observation as any).revision = {
      ...h.observation.revision,
      revisionOrdinal: 7,
      supersedesRevisionOrdinal: 6,
    };
    expect(await h.repo.completeRun(h.run, [h.observation], 'OK')).toBe(false);
  });
  test.each(['identity', 'geography', 'ownership'])(
    'write rejects corrupt draft %s',
    async (kind) => {
      const h = fixture();
      const draft = JSON.parse(JSON.stringify(h.observation));
      if (kind === 'identity') draft.observationKey = 'wrong';
      if (kind === 'geography') draft.subjectId = draft.geography.geographyId = 'KE';
      if (kind === 'ownership') draft.claim.ownership.organisedArmedActorParticipates = true;
      expect(await h.repo.completeRun(h.run, [draft], 'OK')).toBe(false);
      expect(h.tx.securityObservation.create).not.toHaveBeenCalled();
    },
  );
  test('retention never authorizes public source eligibility', () => {
    const e = decideSecuritySourceEligibility(article);
    expect(e.internalReviewPermitted).toBe(true);
    expect(e.publicEvidencePermitted).toBe(false);
    expect(e.sourceRights).toBe('UNVERIFIED');
    expect(e.policyVersion).toBe('SECURITY-RETAINED-REVIEW-1');
  });
  test('missing source identity refuses internal review', () => {
    expect(
      decideSecuritySourceEligibility({ ...article, sourceId: '' }).internalReviewPermitted,
    ).toBe(false);
  });
  test('eligibility decision is persisted in the observation payload', () => {
    expect((fixture().observation as any).sourceEligibility).toEqual(
      decideSecuritySourceEligibility(article),
    );
  });
  test('real corpus boundary preserves ArticleCountry score independently of confidence', async () => {
    const db = {
      articleCountry: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              countryCode: 'RW',
              relevanceScore: 17,
              article: {
                ...article,
                confidenceScore: 99,
                publishedAt: new Date(article.publishedAt),
                fetchedAt: new Date(article.firstSeenAt!),
              },
            },
          ]),
      },
    };
    const corpus = new ArticlePersistenceService(db as unknown as PrismaService);
    const result = await corpus.readRecentForSecurity({ countryCode: 'RW' });
    expect(result.articles[0]).toMatchObject({
      confidence: 99,
      securityCountryAttribution: {
        countryCode: 'RW',
        relevanceScore: 17,
        basis: 'ArticleCountry',
      },
    });
    expect((await corpus.findRecentByCountry({ countryCode: 'RW' }))[0]).not.toHaveProperty(
      'securityCountryAttribution',
    );
    const repo = {
      startRun: jest.fn().mockResolvedValue({ id: 1, geographyId: 'RW', maxAgeMinutes: 1440 }),
      completeRun: jest.fn().mockResolvedValue(true),
    };
    const producer = new SecurityProducerService(
      corpus,
      repo as unknown as SecurityObservationRepository,
    );
    expect(await producer.produce('RW')).toBe('OK');
    expect(repo.completeRun.mock.calls[0][1][0].geography.attributionScore).toBe(17);
  });
  test('missing attribution does not substitute article confidence', async () => {
    const repo = {
      startRun: jest.fn().mockResolvedValue({ id: 1, geographyId: 'RW', maxAgeMinutes: 1440 }),
      completeRun: jest.fn().mockResolvedValue(true),
    };
    const corpus = {
      readRecentForSecurity: jest.fn().mockResolvedValue({ status: 'OK', articles: [article] }),
    };
    expect(
      await new SecurityProducerService(
        corpus as unknown as ArticlePersistenceService,
        repo as unknown as SecurityObservationRepository,
      ).produce('RW'),
    ).toBe('SOURCE_UNAVAILABLE');
  });
});
