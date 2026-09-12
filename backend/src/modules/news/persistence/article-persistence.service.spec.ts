import type { NewsArticle } from '@globalnews-ai/shared';
import { ArticlePersistenceService } from './article-persistence.service';

describe('ArticlePersistenceService', () => {
  const articleUpsert = jest.fn();
  const articleCountryUpsert = jest.fn();
  const articleCountryFindMany = jest.fn();
  const articleFindMany = jest.fn();
  const articleFindUnique = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    article: {
      upsert: articleUpsert,
      findMany: articleFindMany,
      findUnique: articleFindUnique,
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
    articleFindUnique.mockReset();
    transaction.mockReset();

    articleUpsert.mockImplementation((args) => args);
    articleCountryUpsert.mockImplementation((args) => args);
    articleCountryFindMany.mockResolvedValue([]);
    articleFindMany.mockResolvedValue([]);
    articleFindUnique.mockResolvedValue(null);
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

  /**
   * ── R4 GDELT — THE TIMESTAMP BASIS SURVIVES THE ROUND TRIP ────────────
   *
   * An earlier cut of this milestone REFUSED to persist an observed-basis
   * article, because `Article` had no column able to say what kind of time
   * it held. The CTO approved the additive column, so these tests replace
   * that refusal: the basis is now written, read back, and — because the
   * column is TEXT rather than an enum — VALIDATED on the way out.
   *
   * The one-way rule is the point. A recognized value round-trips. An
   * unrecognized one becomes UNDEFINED, never 'publisher': trusting an
   * unvouched-for string would turn it into a positive claim that an outlet
   * asserted this publication time, which is the exact failure the field
   * exists to prevent.
   */
  describe('R4 GDELT — publishedAtBasis round trip', () => {
    it('AA — a default/legacy publisher row restores publisher', async () => {
      articleFindMany.mockResolvedValue([makeDatabaseRow({ publishedAtBasis: 'publisher' })]);

      const [restored] = await service.findRecent({ limit: 5 });

      expect(restored.publishedAtBasis).toBe('publisher');
    });

    it('AA — an article with NO basis is STORED as publisher, matching the column default', async () => {
      await service.persistMany([makeArticle({ id: 'legacy-1' })]);

      expect(articleUpsert).toHaveBeenCalledTimes(1);
      const call = articleUpsert.mock.calls[0][0];
      expect(call.create.publishedAtBasis).toBe('publisher');
      expect(call.update.publishedAtBasis).toBe('publisher');
    });

    it('AB — an observed GDELT article is WRITTEN and round-trips as observed', async () => {
      await service.persistMany([
        makeArticle({
          id: 'gdelt-doc-1',
          url: 'https://outlet.example/gdelt',
          publishedAtBasis: 'observed',
        }),
      ]);

      // It is no longer skipped — that was the pre-migration behaviour.
      expect(articleUpsert).toHaveBeenCalledTimes(1);
      expect(articleUpsert.mock.calls[0][0].create.publishedAtBasis).toBe('observed');

      articleFindMany.mockResolvedValue([makeDatabaseRow({ publishedAtBasis: 'observed' })]);

      const [restored] = await service.findRecent({ limit: 5 });
      expect(restored.publishedAtBasis).toBe('observed');
    });

    it('AC — an INVALID stored basis fails safely: undefined, never publisher', async () => {
      for (const stored of ['Publisher', ' observed', 'PUBLISHER', 'guessed', '', 'null', 42]) {
        articleFindMany.mockResolvedValue([makeDatabaseRow({ publishedAtBasis: stored })]);

        const [restored] = await service.findRecent({ limit: 5 });

        expect({ stored, basis: restored.publishedAtBasis }).toEqual({
          stored,
          basis: undefined,
        });
      }
    });

    it('AC — a MISSING column value is also undefined rather than publisher', async () => {
      articleFindMany.mockResolvedValue([makeDatabaseRow({ publishedAtBasis: undefined })]);

      const [restored] = await service.findRecent({ limit: 5 });

      expect(restored.publishedAtBasis).toBeUndefined();
    });

    it('AD — a persisted GDELT article resolves by id WITH its observed provenance', async () => {
      articleFindUnique.mockResolvedValue(
        makeDatabaseRow({ id: 'gdelt-doc-1', publishedAtBasis: 'observed' }),
      );

      const anchor = await service.findById('gdelt-doc-1');

      expect(anchor).not.toBeNull();
      expect(anchor?.publishedAtBasis).toBe('observed');
    });

    it('AD — findById validates the basis on the same one-way rule as findRecent', async () => {
      articleFindUnique.mockResolvedValue(
        makeDatabaseRow({ id: 'gdelt-doc-1', publishedAtBasis: 'observed-ish' }),
      );

      expect((await service.findById('gdelt-doc-1'))?.publishedAtBasis).toBeUndefined();
    });
  });

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
      // R0 — deliberately DIFFERENT from publishedAt, so no assertion
      // below can pass by accidentally reading publishedAt in its place.
      fetchedAt: new Date(
        '2026-08-07T10:05:00.000Z',
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

  // R0.5 SUPERSESSION — this test previously asserted
  // `resolves.toBeUndefined()`, which was correct while persistMany() was
  // declared Promise<void>. R0.5 gives it a return value, so the OLD
  // assertion is now factually wrong. The test's INTENT is unchanged and is
  // what is re-proved below: a database failure must stay non-fatal. R0.5
  // strengthens it — it is no longer enough not to throw; the method must
  // also answer with something that makes firstSeenAt ABSENT rather than
  // guessed.
  it('does not throw when database persistence fails, and reports no observations', async () => {
    transaction.mockRejectedValueOnce(
      new Error('Simulated database failure'),
    );

    const observed = await service.persistMany([makeArticle()]);

    // Non-fatal: resolves rather than rejects.
    expect(observed).toBeInstanceOf(Map);

    // And empty, which is what a caller renders as an absent firstSeenAt.
    expect(observed.size).toBe(0);
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
        firstSeenAt: '2026-08-07T10:05:00.000Z',
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
        firstSeenAt: '2026-08-07T10:05:00.000Z',
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

  /**
   * Milestone #51 Phase B (CTO final correction) — findById is the
   * server-side lookup AnalysisService uses to resolve a
   * storyContext.articleId into a trusted evidence anchor. It must
   * behave exactly like every other read method here: never throw,
   * return null (not an empty array or fabricated value) on a miss or
   * a database failure.
   */
  describe('findById', () => {
    it('resolves a real article by its stored id', async () => {
      articleFindUnique.mockResolvedValueOnce(makeDatabaseRow());

      const result = await service.findById('article-1');

      expect(articleFindUnique).toHaveBeenCalledWith({
        where: { id: 'article-1' },
      });
      expect(result).toEqual({
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
        firstSeenAt: '2026-08-07T10:05:00.000Z',
        confidence: 87,
      });
    });

    it('returns null when the id does not exist \u2014 never fabricates an article', async () => {
      articleFindUnique.mockResolvedValueOnce(null);

      const result = await service.findById('does-not-exist');

      expect(result).toBeNull();
    });

    it('returns null (never throws) when the database read fails', async () => {
      articleFindUnique.mockRejectedValueOnce(new Error('Simulated database failure'));

      await expect(service.findById('article-1')).resolves.toBeNull();
    });

    it('returns null for an empty/whitespace-only id without querying the database', async () => {
      const result = await service.findById('   ');

      expect(result).toBeNull();
      expect(articleFindUnique).not.toHaveBeenCalled();
    });

    it('maps nullable values safely, matching findRecent/findRecentByCountry\u2019s own convention', async () => {
      articleFindUnique.mockResolvedValueOnce(
        makeDatabaseRow({ imageUrl: null, confidenceScore: null }),
      );

      const result = await service.findById('article-1');

      expect(result?.imageUrl).toBeUndefined();
      expect(result?.confidence).toBeUndefined();
    });
  });

  /**
   * R0 — Return/Today first-observation contract.
   *
   * These tests defend one claim: NewsArticle.firstSeenAt means "the time
   * GlobalNews AI first persisted/observed this article", and cannot
   * silently come to mean anything else. Each test corresponds to a
   * specific way that meaning could be lost.
   */
  describe('R0 — firstSeenAt / Article.fetchedAt', () => {
    it('does NOT rewrite fetchedAt when an existing URL is re-observed — the whole contract rests on this', async () => {
      await service.persistMany([makeArticle()]);

      const call = articleUpsert.mock.calls[0][0];

      expect(Object.keys(call.update)).not.toContain('fetchedAt');
    });

    it('does NOT set fetchedAt on create either, leaving it to the database @default(now()) so it is stamped exactly once', async () => {
      await service.persistMany([makeArticle()]);

      const call = articleUpsert.mock.calls[0][0];

      expect(Object.keys(call.create)).not.toContain('fetchedAt');
    });

    it('never writes fetchedAt on ANY persisted field set, however many articles are upserted', async () => {
      await service.persistMany([
        makeArticle({ url: 'https://example.com/a' }),
        makeArticle({ url: 'https://example.com/b' }),
      ]);

      for (const [call] of articleUpsert.mock.calls) {
        expect(Object.keys(call.create)).not.toContain('fetchedAt');
        expect(Object.keys(call.update)).not.toContain('fetchedAt');
      }
    });

    it('exposes firstSeenAt from the persisted row on findRecent', async () => {
      articleFindMany.mockResolvedValueOnce([makeDatabaseRow()]);

      const [article] = await service.findRecent();

      expect(article.firstSeenAt).toBe('2026-08-07T10:05:00.000Z');
    });

    it('exposes firstSeenAt from the persisted row on findRecentByCountry', async () => {
      articleCountryFindMany.mockResolvedValueOnce([makeCountryDatabaseRow()]);

      const [article] = await service.findRecentByCountry({ countryCode: 'ESP' });

      expect(article.firstSeenAt).toBe('2026-08-07T10:05:00.000Z');
    });

    it('exposes firstSeenAt from the persisted row on findById', async () => {
      articleFindUnique.mockResolvedValueOnce(makeDatabaseRow());

      const article = await service.findById('article-1');

      expect(article?.firstSeenAt).toBe('2026-08-07T10:05:00.000Z');
    });

    it('serializes firstSeenAt as an ISO-8601 string, matching publishedAt’s existing convention', async () => {
      articleFindMany.mockResolvedValueOnce([makeDatabaseRow()]);

      const [article] = await service.findRecent();

      expect(typeof article.firstSeenAt).toBe('string');
      expect(article.firstSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('is STABLE across re-retrieval: the same stored row read twice yields the same firstSeenAt', async () => {
      articleFindMany.mockResolvedValueOnce([makeDatabaseRow()]);
      const [first] = await service.findRecent();

      articleFindMany.mockResolvedValueOnce([makeDatabaseRow()]);
      const [second] = await service.findRecent();

      expect(second.firstSeenAt).toBe(first.firstSeenAt);
    });

    it('is INDEPENDENT of publishedAt: a row whose publishedAt changed keeps its original firstSeenAt', async () => {
      articleFindMany.mockResolvedValueOnce([
        makeDatabaseRow({ publishedAt: new Date('2026-08-09T23:59:00.000Z') }),
      ]);

      const [article] = await service.findRecent();

      expect(article.publishedAt).toBe('2026-08-09T23:59:00.000Z');
      expect(article.firstSeenAt).toBe('2026-08-07T10:05:00.000Z');
      expect(article.firstSeenAt).not.toBe(article.publishedAt);
    });

    it('never derives firstSeenAt from publishedAt — a row observed BEFORE its own publication timestamp reports what the database holds', async () => {
      articleFindMany.mockResolvedValueOnce([
        makeDatabaseRow({
          publishedAt: new Date('2026-08-07T12:00:00.000Z'),
          fetchedAt: new Date('2026-08-07T09:00:00.000Z'),
        }),
      ]);

      const [article] = await service.findRecent();

      expect(article.firstSeenAt).toBe('2026-08-07T09:00:00.000Z');
    });

    it('does not expose the database updatedAt (the change timestamp) under any field name', async () => {
      articleFindMany.mockResolvedValueOnce([
        makeDatabaseRow({ updatedAt: new Date('2026-08-20T00:00:00.000Z') }),
      ]);

      const [article] = await service.findRecent();

      expect(JSON.stringify(article)).not.toContain('2026-08-20T00:00:00.000Z');
      expect(article).not.toHaveProperty('updatedAt');
    });
  });
});

/**
 * R0.5 — persistMany() returns what the DATABASE observed.
 *
 * The R0 tests above prove the READ mappers surface Article.fetchedAt as
 * firstSeenAt. These prove the WRITE path hands the same column back to its
 * caller, so a live response can be annotated without a second query.
 *
 * The contract being proved, in full:
 *   - the returned map is keyed by `url` and valued with the ROW's fetchedAt;
 *   - the upsert asks the database for exactly those two columns;
 *   - the R0 invariant survives — fetchedAt is still written by neither
 *     `create` nor `update`;
 *   - every failure mode answers with an EMPTY map, never a guess.
 */
describe('R0.5 — persistMany returns database-observed first-seen data', () => {
  const articleUpsert = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    article: { upsert: articleUpsert, findMany: jest.fn(), findUnique: jest.fn() },
    articleCountry: { upsert: jest.fn(), findMany: jest.fn() },
    $transaction: transaction,
  };

  let service: ArticlePersistenceService;

  const FETCHED_AT = new Date('2026-08-07T10:05:00.000Z');
  const FETCHED_AT_ISO = '2026-08-07T10:05:00.000Z';

  beforeEach(() => {
    articleUpsert.mockReset();
    transaction.mockReset();
    articleUpsert.mockImplementation((args) => args);
    transaction.mockResolvedValue([]);

    service = new ArticlePersistenceService(prisma as never);
  });

  function article(overrides: Partial<NewsArticle> = {}): NewsArticle {
    return {
      id: 'article-1',
      title: 'Test headline',
      summary: 'Test summary',
      url: 'https://example.com/one',
      sourceId: 'test-provider',
      sourceName: 'Test Provider',
      category: 'world',
      sourcesCount: 1,
      // Deliberately 5 minutes apart from FETCHED_AT, so no assertion below
      // can pass by accidentally reading publishedAt in fetchedAt's place.
      publishedAt: '2026-08-07T10:00:00.000Z',
      ...overrides,
    };
  }

  it('returns a Map keyed by url whose value is the row fetchedAt as an ISO string', async () => {
    transaction.mockResolvedValueOnce([{ url: 'https://example.com/one', fetchedAt: FETCHED_AT }]);

    const observed = await service.persistMany([article()]);

    expect(observed).toBeInstanceOf(Map);
    expect(observed.size).toBe(1);
    expect(observed.get('https://example.com/one')).toBe(FETCHED_AT_ISO);
  });

  it('asks the database for exactly url and fetchedAt, and nothing else', async () => {
    await service.persistMany([article()]);

    const call = articleUpsert.mock.calls[0][0];

    expect(call.select).toEqual({ url: true, fetchedAt: true });
  });

  it('still never writes fetchedAt — the R0 invariant survives R0.5', async () => {
    await service.persistMany([article()]);

    const call = articleUpsert.mock.calls[0][0];

    expect(Object.keys(call.update)).not.toContain('fetchedAt');
    expect(Object.keys(call.create)).not.toContain('fetchedAt');
  });

  it('still upserts on url, so the returned key is the database key', async () => {
    await service.persistMany([article()]);

    const call = articleUpsert.mock.calls[0][0];

    expect(call.where).toEqual({ url: 'https://example.com/one' });
  });

  it('the value is the row fetchedAt and NEVER the article publishedAt', async () => {
    transaction.mockResolvedValueOnce([{ url: 'https://example.com/one', fetchedAt: FETCHED_AT }]);

    const observed = await service.persistMany([article()]);

    expect(observed.get('https://example.com/one')).toBe(FETCHED_AT_ISO);
    expect(observed.get('https://example.com/one')).not.toBe('2026-08-07T10:00:00.000Z');
  });

  it('the value is NEVER a timestamp minted during the call', async () => {
    transaction.mockResolvedValueOnce([{ url: 'https://example.com/one', fetchedAt: FETCHED_AT }]);

    const before = Date.now();
    const observed = await service.persistMany([article()]);
    const after = Date.now();

    const reported = Date.parse(observed.get('https://example.com/one') as string);

    // The fixture is historical, so a value minted from the local clock would
    // necessarily land inside [before, after]. This one cannot.
    expect(reported).toBeLessThan(before);
    expect(reported).toBeLessThan(after);
  });

  it('two articles sharing one url collapse to a single entry with the correct value', async () => {
    // One URL, two provider ids — the cross-provider case that makes index
    // keying and id keying both unsafe.
    transaction.mockResolvedValueOnce([
      { url: 'https://example.com/shared', fetchedAt: FETCHED_AT },
      { url: 'https://example.com/shared', fetchedAt: FETCHED_AT },
    ]);

    const observed = await service.persistMany([
      article({ id: 'gnews-1', url: 'https://example.com/shared' }),
      article({ id: 'gdelt-1', url: 'https://example.com/shared' }),
    ]);

    expect(observed.size).toBe(1);
    expect(observed.get('https://example.com/shared')).toBe(FETCHED_AT_ISO);
  });

  it('maps several articles independently, each to its own row value', async () => {
    transaction.mockResolvedValueOnce([
      { url: 'https://example.com/one', fetchedAt: new Date('2026-08-01T00:00:00.000Z') },
      { url: 'https://example.com/two', fetchedAt: new Date('2026-08-02T00:00:00.000Z') },
    ]);

    const observed = await service.persistMany([
      article({ url: 'https://example.com/one' }),
      article({ id: 'article-2', url: 'https://example.com/two' }),
    ]);

    expect(observed.get('https://example.com/one')).toBe('2026-08-01T00:00:00.000Z');
    expect(observed.get('https://example.com/two')).toBe('2026-08-02T00:00:00.000Z');
  });

  it('returns an empty map for an empty batch, without opening a transaction', async () => {
    const observed = await service.persistMany([]);

    expect(observed.size).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns an empty map when the transaction rejects', async () => {
    transaction.mockRejectedValueOnce(new Error('Simulated database failure'));

    const observed = await service.persistMany([article()]);

    expect(observed.size).toBe(0);
  });

  it('returns an empty map when the transaction resolves to nothing at all', async () => {
    transaction.mockResolvedValueOnce(undefined as never);

    const observed = await service.persistMany([article()]);

    expect(observed.size).toBe(0);
  });

  it('DROPS a row whose fetchedAt is not a real Date rather than coercing it', async () => {
    transaction.mockResolvedValueOnce([
      { url: 'https://example.com/one', fetchedAt: null },
      { url: 'https://example.com/two', fetchedAt: '2026-08-02T00:00:00.000Z' },
      { url: 'https://example.com/three', fetchedAt: FETCHED_AT },
    ]);

    const observed = await service.persistMany([
      article({ url: 'https://example.com/one' }),
      article({ url: 'https://example.com/two' }),
      article({ url: 'https://example.com/three' }),
    ]);

    // Only the genuine Date survives. A string that merely LOOKS like a
    // timestamp is not evidence the database produced it.
    expect(observed.size).toBe(1);
    expect(observed.has('https://example.com/one')).toBe(false);
    expect(observed.has('https://example.com/two')).toBe(false);
    expect(observed.get('https://example.com/three')).toBe(FETCHED_AT_ISO);
  });

  it('the returned map carries no key for a url that was not written back', async () => {
    transaction.mockResolvedValueOnce([{ url: 'https://example.com/one', fetchedAt: FETCHED_AT }]);

    const observed = await service.persistMany([
      article({ url: 'https://example.com/one' }),
      article({ id: 'article-2', url: 'https://example.com/missing' }),
    ]);

    expect(observed.has('https://example.com/missing')).toBe(false);
    expect(observed.get('https://example.com/missing')).toBeUndefined();
  });
});
