import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { ArticlePersistenceService } from './article-persistence.service';

/**
 * TRUST R1 (checkpoint 5, found on live Alpha) — THE RETAINED-COUNTRY KEY IS ISO3.
 *
 * `ArticleCountry.countryCode` is written as ISO3 (Alpha: MDG / KEN / RWA). The Ask mixed
 * answer passed ISO2 and so listed nothing for a place with nine relevant retained reports,
 * then said "none retained". This pins the contract against real PostgreSQL: the ISO3 read
 * finds the row; an ISO2 read does not.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('Retained-country live tests require a dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('retained-country read — the stored key is ISO3 (live PostgreSQL)', () => {
  let db: PrismaClient;
  let persistence: ArticlePersistenceService;
  const id = `rck-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 2 }) });
    await db.$connect();
    persistence = new ArticlePersistenceService(db as unknown as PrismaService);
    await db.article.create({
      data: {
        id,
        title: 'Madagascar retained report',
        summary: 'Retained summary',
        url: `https://retained.example/${id}`,
        sourceId: 'retained.example',
        sourceName: 'retained.example',
        category: 'world',
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        countryCode: 'MG',
        countryName: 'Madagascar',
      },
    });
    await db.articleCountry.create({
      data: {
        articleId: id,
        countryCode: 'MDG',
        countryName: 'Madagascar',
        relevanceScore: 9,
        isRelevant: true,
      },
    });
  });
  afterAll(async () => {
    await db?.articleCountry.deleteMany({ where: { articleId: id } });
    await db?.article.deleteMany({ where: { id } });
    await db?.$disconnect();
  });

  it('an ISO3 read finds the retained report; an ISO2 read finds nothing', async () => {
    const iso3 = await persistence.findRecentByCountry({
      countryCode: 'MDG',
      limit: 50,
      maxAgeMinutes: 14 * 24 * 60,
    });
    expect(iso3.map((a) => a.id)).toContain(id);
    /* the returned article carries its OWN primary country (ISO2), which the Ask boundary checks */
    expect(iso3.find((a) => a.id === id)?.countryCode).toBe('MG');
    const iso2 = await persistence.findRecentByCountry({
      countryCode: 'MG',
      limit: 50,
      maxAgeMinutes: 14 * 24 * 60,
    });
    expect(iso2.map((a) => a.id)).not.toContain(id);
  });
});
