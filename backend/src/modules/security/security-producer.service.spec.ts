import { SecurityProducerService } from './security-producer.service';
import { SecurityObservationRepository } from './persistence/security-observation.repository';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { PrismaService } from '../../database/prisma.service';
import { buildSecurityObservation } from './provenance/security-observation.factory';
import { classifySecurityCandidate } from './classification/security-candidate.classifier';
import { assertSecurityObservationIsWellFormed, type NewsArticle } from '@globalnews-ai/shared';
const article: NewsArticle = {
  id: 'a',
  title: 'A shooting was committed by an unaffiliated individual acting alone.',
  summary: 'A retained report.',
  url: 'https://example.test/a',
  sourceId: 'publisher',
  sourceName: 'Publisher',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date().toISOString(),
  firstSeenAt: new Date().toISOString(),
  publishedAtBasis: 'publisher',
};
function harness() {
  const articles = {
    readRecentForSecurity: jest
      .fn()
      .mockResolvedValue({
        status: 'OK',
        articles: [
          {
            ...article,
            securityCountryAttribution: {
              countryCode: 'RW',
              relevanceScore: 73,
              basis: 'ArticleCountry',
            },
          },
        ],
      }),
  };
  const repo = {
    startRun: jest.fn().mockResolvedValue({ id: 1, geographyId: 'RW', maxAgeMinutes: 1440 }),
    completeRun: jest.fn().mockResolvedValue(true),
  };
  const producer = new SecurityProducerService(
    articles as unknown as ArticlePersistenceService,
    repo as unknown as SecurityObservationRepository,
  );
  return { articles, repo, producer };
}
describe('R2 internal production', () => {
  test('produces admitted evidence internally', async () => {
    const h = harness();
    expect(await h.producer.produce('RW')).toBe('OK');
    expect(h.repo.completeRun.mock.calls[0][1]).toHaveLength(1);
  });
  test('bounds the corpus scan at 100', async () => {
    const h = harness();
    await h.producer.produce('RW');
    expect(h.articles.readRecentForSecurity).toHaveBeenCalledWith({
      countryCode: 'RW',
      limit: 100,
      maxAgeMinutes: 1440,
      relevantOnly: true,
    });
  });
  test('records intent before consulting the corpus', async () => {
    const h = harness();
    await h.producer.produce('RW');
    expect(h.repo.startRun.mock.invocationCallOrder[0]).toBeLessThan(
      h.articles.readRecentForSecurity.mock.invocationCallOrder[0]!,
    );
  });
  test('cannot treat a failed intent write as an empty assessment', async () => {
    const h = harness();
    h.repo.startRun.mockResolvedValue(null);
    expect(await h.producer.produce('RW')).toBe('SOURCE_UNAVAILABLE');
    expect(h.articles.readRecentForSecurity).not.toHaveBeenCalled();
  });
  test('cannot treat a failed completion write as an empty assessment', async () => {
    const h = harness();
    h.repo.completeRun.mockResolvedValue(false);
    expect(await h.producer.produce('RW')).toBe('SOURCE_UNAVAILABLE');
  });
  test('preserves structured corpus failures', async () => {
    const h = harness();
    h.articles.readRecentForSecurity.mockResolvedValue({
      status: 'SOURCE_UNAVAILABLE',
      articles: [],
    });
    expect(await h.producer.produce('RW')).toBe('SOURCE_UNAVAILABLE');
    expect(h.repo.completeRun).toHaveBeenCalledWith(expect.anything(), [], 'SOURCE_UNAVAILABLE');
  });
  test('handles unexpected corpus exceptions without a success completion', async () => {
    const h = harness();
    h.articles.readRecentForSecurity.mockRejectedValue(new Error('failed'));
    expect(await h.producer.produce('RW')).toBe('SOURCE_UNAVAILABLE');
  });
  test('a completed empty scan is NO_RESULTS', async () => {
    const h = harness();
    h.articles.readRecentForSecurity.mockResolvedValue({ status: 'NO_RESULTS', articles: [] });
    expect(await h.producer.produce('RW')).toBe('NO_RESULTS');
  });
  test('a new reclassified scan seals an empty projection', async () => {
    const h = harness();
    await h.producer.produce('RW');
    h.articles.readRecentForSecurity.mockResolvedValue({
      status: 'OK',
      articles: [
        {
          ...article,
          title: 'Army troops opened fire.',
          securityCountryAttribution: {
            countryCode: 'RW',
            relevanceScore: 73,
            basis: 'ArticleCountry',
          },
        },
      ],
    });
    expect(await h.producer.produce('RW')).toBe('NO_RESULTS');
    expect(h.repo.completeRun.mock.calls[1][1]).toEqual([]);
  });
  test.each(['', '../admin', 'JOHN EXAMPLE', 'RWA'])(
    'invalid geography never starts production: %s',
    async (code) => {
      const h = harness();
      expect(await h.producer.produce(code)).toBe('SOURCE_UNAVAILABLE');
      expect(h.repo.startRun).not.toHaveBeenCalled();
    },
  );
  test.each([0, -1, 43201, NaN, 1.5])('invalid age never starts production: %s', async (age) => {
    const h = harness();
    expect(await h.producer.produce('RW', age)).toBe('SOURCE_UNAVAILABLE');
    expect(h.repo.startRun).not.toHaveBeenCalled();
  });
  test('country projections have distinct canonical keys', () => {
    const decision = classifySecurityCandidate(article);
    const a = buildSecurityObservation(
      article,
      { countryCode: 'RW', countryName: 'RW', relevanceScore: 80 },
      decision,
    );
    const b = buildSecurityObservation(
      article,
      { countryCode: 'KE', countryName: 'KE', relevanceScore: 80 },
      decision,
    );
    if (!a.built || !b.built) throw new Error('fixture refused');
    expect(a.observation.observationKey).not.toBe(b.observation.observationKey);
    expect(() => assertSecurityObservationIsWellFormed(a.observation)).not.toThrow();
    expect(() => assertSecurityObservationIsWellFormed(b.observation)).not.toThrow();
  });
});
describe('real ArticlePersistence boundary, not a throwing replacement', () => {
  test('a database rejection becomes SOURCE_UNAVAILABLE; old callers still get []', async () => {
    const prisma = {
      articleCountry: { findMany: jest.fn().mockRejectedValue(new Error('database read failed')) },
    };
    const reader = new ArticlePersistenceService(prisma as unknown as PrismaService);
    expect(await reader.readRecentForSecurity({ countryCode: 'RW' })).toEqual({
      status: 'SOURCE_UNAVAILABLE',
      articles: [],
    });
    expect(await reader.findRecentByCountry({ countryCode: 'RW' })).toEqual([]);
  });
  test('a successful empty query becomes NO_RESULTS', async () => {
    const reader = new ArticlePersistenceService({
      articleCountry: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService);
    expect(await reader.readRecentForSecurity({ countryCode: 'RW' })).toEqual({
      status: 'NO_RESULTS',
      articles: [],
    });
  });
});
