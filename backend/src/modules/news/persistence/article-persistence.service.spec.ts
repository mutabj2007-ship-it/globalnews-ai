import type { NewsArticle } from '@globalnews-ai/shared';
import { ArticlePersistenceService } from './article-persistence.service';

describe('ArticlePersistenceService', () => {
  const articleUpsert = jest.fn();
  const articleCountryUpsert = jest.fn();
  const articleCountryFindMany = jest.fn();
  const articleFindMany = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    article: {
      upsert: articleUpsert,
      findMany: articleFindMany,
    },
    articleCountry: {
      upsert: articleCountryUpsert,
      findMany: articleCountryFindMany,
    },
    $transaction: transaction,
  };

  let service: ArticlePersistenceService;

  beforeEach(() => {
    articleUpsert.mockReset();
    articleCountryUpsert.mockReset();
    articleCountryFindMany.mockReset();
    articleFindMany.mockReset();
    transaction.mockReset();

    articleUpsert.mockImplementation((args) => args);
    articleCountryUpsert.mockImplementation((args) => args);
    articleCountryFindMany.mockResolvedValue([]);
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

  function makeCountryDatabaseRow(
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'relation-1',
      articleId: 'article-1',
      countryCode: 'ESP',
      countryName: 'Spain',
      relevanceScore: 82,
      isRelevant: true,
      createdAt: new Date(
        '2026-08-07T10:00:00.000Z',
      ),
      updatedAt: new Date(
        '2026-08-07T10:00:00.000Z',
      ),
      article: makeDatabaseRow(),
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

  it('does nothing when there are no country relations', async () => {
    await service.persistCountryRelations([]);

    expect(articleCountryUpsert).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('upserts article-country relations by articleId and countryCode', async () => {
    await service.persistCountryRelations([
      {
        articleId: 'article-1',
        countryCode: 'ESP',
        countryName: 'Spain',
        relevanceScore: 82,
        isRelevant: true,
      },
    ]);

    expect(articleCountryUpsert).toHaveBeenCalledTimes(1);

    expect(articleCountryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          articleId_countryCode: {
            articleId: 'article-1',
            countryCode: 'ESP',
          },
        },
      }),
    );

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('persists article-country relevance data in create and update', async () => {
    await service.persistCountryRelations([
      {
        articleId: 'article-1',
        countryCode: 'RWA',
        countryName: 'Rwanda',
        relevanceScore: 91,
        isRelevant: true,
      },
    ]);

    expect(articleCountryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          articleId: 'article-1',
          countryCode: 'RWA',
          countryName: 'Rwanda',
          relevanceScore: 91,
          isRelevant: true,
        }),
        update: expect.objectContaining({
          countryName: 'Rwanda',
          relevanceScore: 91,
          isRelevant: true,
        }),
      }),
    );
  });

  it('supports updating an existing article-country relation', async () => {
    await service.persistCountryRelations([
      {
        articleId: 'article-1',
        countryCode: 'COD',
        countryName: 'Democratic Republic of the Congo',
        relevanceScore: 45,
        isRelevant: true,
      },
    ]);

    expect(articleCountryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          articleId_countryCode: {
            articleId: 'article-1',
            countryCode: 'COD',
          },
        },
        update: {
          countryName: 'Democratic Republic of the Congo',
          relevanceScore: 45,
          isRelevant: true,
        },
      }),
    );
  });

  it('does not throw when country relation persistence fails', async () => {
    transaction.mockRejectedValueOnce(
      new Error('Simulated country relation database failure'),
    );

    await expect(
      service.persistCountryRelations([
        {
          articleId: 'article-1',
          countryCode: 'ESP',
          countryName: 'Spain',
          relevanceScore: 70,
          isRelevant: true,
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it('reads recent relevant articles for a country', async () => {
    const now = new Date(
      '2026-08-07T12:00:00.000Z',
    ).getTime();

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(now);

    articleCountryFindMany.mockResolvedValueOnce([
      makeCountryDatabaseRow(),
    ]);

    const result = await service.findRecentByCountry({
      countryCode: 'ESP',
    });

    expect(articleCountryFindMany).toHaveBeenCalledTimes(1);

    expect(articleCountryFindMany).toHaveBeenCalledWith({
      where: {
        countryCode: 'ESP',
        isRelevant: true,
        article: {
          publishedAt: {
            gte: new Date(
              '2026-08-06T12:00:00.000Z',
            ),
          },
        },
      },
      include: {
        article: true,
      },
      orderBy: [
        {
          relevanceScore: 'desc',
        },
        {
          article: {
            publishedAt: 'desc',
          },
        },
      ],
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

  it('normalizes country code to uppercase when reading country articles', async () => {
    articleCountryFindMany.mockResolvedValueOnce([]);

    await service.findRecentByCountry({
      countryCode: 'esp',
    });

    expect(articleCountryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          countryCode: 'ESP',
        }),
      }),
    );
  });

  it('filters country articles by category', async () => {
    articleCountryFindMany.mockResolvedValueOnce([]);

    await service.findRecentByCountry({
      countryCode: 'ESP',
      category: 'technology',
    });

    expect(articleCountryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          article: expect.objectContaining({
            category: 'technology',
          }),
        }),
      }),
    );
  });

  it('includes non-relevant country relations when relevantOnly is false', async () => {
    articleCountryFindMany.mockResolvedValueOnce([]);

    await service.findRecentByCountry({
      countryCode: 'ESP',
      relevantOnly: false,
    });

    const call =
      articleCountryFindMany.mock.calls[0][0];

    expect(call.where.countryCode).toBe('ESP');
    expect(call.where.isRelevant).toBeUndefined();
  });

  it('caps country article read limits at 100', async () => {
    articleCountryFindMany.mockResolvedValueOnce([]);

    await service.findRecentByCountry({
      countryCode: 'ESP',
      limit: 500,
    });

    expect(articleCountryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('returns an empty array for an empty country code', async () => {
    const result = await service.findRecentByCountry({
      countryCode: '   ',
    });

    expect(result).toEqual([]);
    expect(articleCountryFindMany).not.toHaveBeenCalled();
  });

  it('maps nullable country article values safely', async () => {
    articleCountryFindMany.mockResolvedValueOnce([
      makeCountryDatabaseRow({
        article: makeDatabaseRow({
          imageUrl: null,
          confidenceScore: null,
          sourcesCount: 5,
        }),
      }),
    ]);

    const result = await service.findRecentByCountry({
      countryCode: 'ESP',
    });

    expect(result).toHaveLength(1);
    expect(result[0].imageUrl).toBeUndefined();
    expect(result[0].confidence).toBeUndefined();
    expect(result[0].sourcesCount).toBe(5);
  });

  it('returns an empty array when country database reading fails', async () => {
    articleCountryFindMany.mockRejectedValueOnce(
      new Error(
        'Simulated country database read failure',
      ),
    );

    await expect(
      service.findRecentByCountry({
        countryCode: 'ESP',
      }),
    ).resolves.toEqual([]);
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