import type { NewsArticle } from '@globalnews-ai/shared';
import { ArticlePersistenceService } from './article-persistence.service';

describe('ArticlePersistenceService', () => {
  const articleUpsert = jest.fn();
  const articleFindMany = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    article: {
      upsert: articleUpsert,
      findMany: articleFindMany,
    },
    $transaction: transaction,
  };

  let service: ArticlePersistenceService;

  beforeEach(() => {
    articleUpsert.mockReset();
    articleFindMany.mockReset();
    transaction.mockReset();

    articleUpsert.mockImplementation((args) => args);
    articleFindMany.mockResolvedValue([]);
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

  function makeDatabaseRow(
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'article-1',
      title: 'Stored headline',
      summary: 'Stored summary',
      url: 'https://example.com/stored',
      imageUrl: 'https://example.com/image.jpg',
      sourceId: 'stored-provider',
      sourceName: 'Stored Provider',
      sourcesCount: 1,
      category: 'world',
      publishedAt: new Date(
        '2026-08-07T10:00:00.000Z',
      ),
      confidenceScore: 87,
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

  it('persists sourcesCount in both create and update data', async () => {
    const article = makeArticle({
      sourcesCount: 5,
    });

    await service.persistMany([article]);

    expect(articleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourcesCount: 5,
        }),
        update: expect.objectContaining({
          sourcesCount: 5,
        }),
      }),
    );
  });

  it('maps optional values safely when persisting', async () => {
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

  it('converts publishedAt to a Date when persisting', async () => {
    const article = makeArticle({
      publishedAt: '2026-08-07T08:00:00.000Z',
    });

    await service.persistMany([article]);

    expect(articleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          publishedAt: new Date(
            '2026-08-07T08:00:00.000Z',
          ),
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

  it('reads recent articles using the default 24-hour freshness window', async () => {
    const now = new Date(
      '2026-08-07T12:00:00.000Z',
    ).getTime();

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(now);

    articleFindMany.mockResolvedValueOnce([
      makeDatabaseRow(),
    ]);

    const result = await service.findRecent();

    expect(articleFindMany).toHaveBeenCalledTimes(1);

    expect(articleFindMany).toHaveBeenCalledWith({
      where: {
        publishedAt: {
          gte: new Date(
            '2026-08-06T12:00:00.000Z',
          ),
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 20,
    });

    expect(result).toEqual([
      {
        id: 'article-1',
        title: 'Stored headline',
        summary: 'Stored summary',
        url: 'https://example.com/stored',
        imageUrl: 'https://example.com/image.jpg',
        sourceId: 'stored-provider',
        sourceName: 'Stored Provider',
        category: 'world',
        sourcesCount: 1,
        publishedAt: '2026-08-07T10:00:00.000Z',
        confidence: 87,
      },
    ]);

    nowSpy.mockRestore();
  });

  it('restores the stored sourcesCount when reading cached articles', async () => {
    articleFindMany.mockResolvedValueOnce([
      makeDatabaseRow({
        sourcesCount: 5,
      }),
    ]);

    const result = await service.findRecent();

    expect(result).toHaveLength(1);
    expect(result[0].sourcesCount).toBe(5);
  });

  it('filters recent articles by category', async () => {
    const now = new Date(
      '2026-08-07T12:00:00.000Z',
    ).getTime();

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(now);

    articleFindMany.mockResolvedValueOnce([]);

    await service.findRecent({
      category: 'technology',
      limit: 5,
      maxAgeMinutes: 60,
    });

    expect(articleFindMany).toHaveBeenCalledWith({
      where: {
        publishedAt: {
          gte: new Date(
            '2026-08-07T11:00:00.000Z',
          ),
        },
        category: 'technology',
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 5,
    });

    nowSpy.mockRestore();
  });

  it('caps database read limits at 100', async () => {
    articleFindMany.mockResolvedValueOnce([]);

    await service.findRecent({
      limit: 500,
    });

    expect(articleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('maps nullable database values safely', async () => {
    articleFindMany.mockResolvedValueOnce([
      makeDatabaseRow({
        imageUrl: null,
        confidenceScore: null,
      }),
    ]);

    const result = await service.findRecent();

    expect(result[0].imageUrl).toBeUndefined();
    expect(result[0].confidence).toBeUndefined();
    expect(result[0].sourcesCount).toBe(1);
  });

  it('returns an empty array when database reading fails', async () => {
    articleFindMany.mockRejectedValueOnce(
      new Error('Simulated database read failure'),
    );

    await expect(
      service.findRecent(),
    ).resolves.toEqual([]);
  });
});