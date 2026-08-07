import type { NewsArticle } from '@globalnews-ai/shared';
import { ArticlePersistenceService } from './article-persistence.service';

describe('ArticlePersistenceService', () => {
  const articleUpsert = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    article: {
      upsert: articleUpsert,
    },
    $transaction: transaction,
  };

  let service: ArticlePersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();

    articleUpsert.mockImplementation((args) => args);
    transaction.mockResolvedValue([]);

    service = new ArticlePersistenceService(prisma as never);
  });

  function makeArticle(
    overrides: Partial<NewsArticle> = {},
  ): NewsArticle {
    return {
      id: 'article-1',
      title: 'Test headline',
      summary: 'Test summary',
      url: 'https://example.com/test',
      sourceId: 'test-provider',
      sourceName: 'Test Provider',
      category: 'world',
      sourcesCount: 1,
      publishedAt: '2026-08-07T08:00:00.000Z',
      ...overrides,
    };
  }

  it('does nothing when there are no articles', async () => {
    await service.persistMany([]);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('upserts articles by URL', async () => {
    const article = makeArticle();

    await service.persistMany([article]);

    expect(articleUpsert).toHaveBeenCalledTimes(1);

    expect(articleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          url: article.url,
        },
      }),
    );

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('maps optional values safely', async () => {
    const article = makeArticle({
      imageUrl: undefined,
      confidence: undefined,
    });

    await service.persistMany([article]);

    expect(articleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          imageUrl: null,
          confidenceScore: null,
        }),
        update: expect.objectContaining({
          imageUrl: null,
          confidenceScore: null,
        }),
      }),
    );
  });

  it('converts publishedAt to a Date', async () => {
    const article = makeArticle({
      publishedAt: '2026-08-07T08:00:00.000Z',
    });

    await service.persistMany([article]);

    expect(articleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          publishedAt: new Date('2026-08-07T08:00:00.000Z'),
        }),
      }),
    );
  });

  it('does not throw when database persistence fails', async () => {
    transaction.mockRejectedValueOnce(
      new Error('Simulated database failure'),
    );

    await expect(
      service.persistMany([makeArticle()]),
    ).resolves.toBeUndefined();
  });
});