import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MY_INTELLIGENCE_INTERESTS,
  MY_INTELLIGENCE_INTEREST_MAPPING,
  NEWS_CATEGORIES,
  interestsForStory,
  type NewsArticle,
} from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import type { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { ANALYTICAL_DOMAINS, detectArticleDomains, detectRepresentedDomains } from '../analysis/query/detect-analytical-domains.util';
import { MyIntelligenceFeedService } from './my-intelligence-feed.service';
import { MyIntelligenceInterestsService, ordered } from './my-intelligence-interests.service';
import { UpdateInterestsDto } from './dto/update-interests.dto';

/**
 * MY INTELLIGENCE — INTEREST + SELECTION HOOK R1 · EXPLICIT INTERESTS, ASSERTED.
 */

const ROOT = join(__dirname, '..', '..', '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const article = (id: string, title: string, overrides: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id,
    title,
    summary: '',
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-27T08:00:00.000Z',
    ...overrides,
  }) as NewsArticle;

describe('ONE canonical classifier — no third taxonomy', () => {
  it("the shared mapping's domain ids are exactly the classifier's ANALYTICAL_DOMAINS", () => {
    const used = new Set(Object.values(MY_INTELLIGENCE_INTEREST_MAPPING).flatMap((rule) => rule.domains));
    for (const domain of used) expect(ANALYTICAL_DOMAINS).toContain(domain);
  });

  it("the mapping's categories are governed NewsCategory values", () => {
    for (const rule of Object.values(MY_INTELLIGENCE_INTEREST_MAPPING)) {
      for (const category of rule.categories) expect(NEWS_CATEGORIES).toContain(category);
    }
  });

  it('every interest maps to at least one category or domain', () => {
    for (const interest of MY_INTELLIGENCE_INTERESTS) {
      const rule = MY_INTELLIGENCE_INTEREST_MAPPING[interest];
      expect(rule.categories.length + rule.domains.length).toBeGreaterThan(0);
    }
  });

  it('detectRepresentedDomains is unchanged: it is the union of detectArticleDomains', () => {
    const set = [
      { title: 'Parliament debates the budget', summary: 'The minister spoke' },
      { title: 'Military exercise near the border', summary: 'cross-border tension' },
      { title: 'New railway opens' },
    ];
    const union = new Set(set.flatMap((a) => [...detectArticleDomains(a)]));
    expect([...detectRepresentedDomains(set)].sort()).toEqual([...union].sort());
    expect([...detectArticleDomains({ title: 'Parliament debates', summary: '' })]).toEqual(['political']);
  });
});

describe('DETERMINISTIC MAPPING — the Egypt football case', () => {
  const football = article('eg-1', 'Al Ahly president hails security at derby as club wins league', { category: 'sports' });
  const politics = article('eg-2', 'Egypt parliament approves new government budget', { category: 'politics' });
  const security = article('eg-3', 'Military boosts security along the Sinai border', { category: 'world' });

  it('a sports story matches ONLY Sports, even when its text mentions "president" and "security"', () => {
    expect(interestsForStory('sports', detectArticleDomains(football))).toEqual(['sports']);
  });

  it('politics and security stories match their interests from category and classifier', () => {
    expect(interestsForStory('politics', detectArticleDomains(politics))).toEqual(
      expect.arrayContaining(['politics_governance']),
    );
    expect(interestsForStory('world', detectArticleDomains(security))).toContain('security_conflict');
  });

  it('entertainment is category-exclusive too', () => {
    expect(interestsForStory('entertainment', new Set(['political', 'security']))).toEqual(['entertainment']);
  });
});

describe('FEED — category carried, interests derived server-side, retained only', () => {
  const harness = (articles: NewsArticle[]) => {
    const persistence = { findRecentByCountry: jest.fn(async () => articles) } as unknown as ArticlePersistenceService;
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ visitBoundaryAt: null })) },
      countryFollow: { findMany: jest.fn(async () => [{ countryCode: 'EGY' }]) },
    } as unknown as PrismaService;
    return new MyIntelligenceFeedService(prisma, persistence);
  };

  it("each story carries its real category (never 'Following') and its matched interests", async () => {
    const feed = await harness([
      article('a', 'Al Ahly president hails security at derby', { category: 'sports' }),
      article('b', 'Egypt parliament approves budget', { category: 'politics' }),
    ]).feed('u1');
    const byId = Object.fromEntries(feed.stories.map((s) => [s.id, s]));
    expect(byId.a.category).toBe('sports');
    expect(byId.a.interests).toEqual(['sports']);
    expect(byId.b.category).toBe('politics');
    expect(byId.b.interests).toContain('politics_governance');
    expect(feed.source).toBe('retained');
  });

  it('the feed service imports no AI, provider or network client', () => {
    const body = code(read('src/modules/my-intelligence/my-intelligence-feed.service.ts'));
    expect(body).not.toMatch(/openai|anthropic|AnalysisService|gnews|GNews|NewsProvider|fetch\(|axios|HttpService/);
    const interests = code(read('src/modules/my-intelligence/my-intelligence-interests.service.ts'));
    expect(interests).not.toMatch(/openai|anthropic|Analysis|gnews|fetch\(|axios|HttpService|searchHistory|SearchHistory/);
  });
});

describe('INTERESTS SERVICE — explicit, governed, one mutation', () => {
  const prismaMock = (stored: string[]) => {
    const calls: { deleteMany?: unknown; createMany?: unknown } = {};
    const prisma = {
      userIntelligenceInterest: {
        findMany: jest.fn(async () => stored.map((interest) => ({ interest }))),
        deleteMany: jest.fn((args: unknown) => {
          calls.deleteMany = args;
          return args;
        }),
        createMany: jest.fn((args: unknown) => {
          calls.createMany = args;
          return args;
        }),
      },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    } as unknown as PrismaService;
    return { prisma, calls };
  };

  it('GET returns governed ids in vocabulary order; unknown stored values are dropped', async () => {
    const { prisma } = prismaMock(['sports', 'security_conflict', 'free text']);
    await expect(new MyIntelligenceInterestsService(prisma).get('u1')).resolves.toEqual({
      interests: ['security_conflict', 'sports'],
    });
  });

  it('PUT replaces the set in ONE transaction; duplicates collapse (a no-op, not an error)', async () => {
    const { prisma, calls } = prismaMock([]);
    const result = await new MyIntelligenceInterestsService(prisma).replace('u1', ['diplomacy', 'diplomacy', 'technology']);
    expect(result).toEqual({ interests: ['diplomacy', 'technology'] });
    expect((prisma as unknown as { $transaction: jest.Mock }).$transaction).toHaveBeenCalledTimes(1);
    expect(calls.createMany).toEqual({
      data: [
        { userId: 'u1', interest: 'diplomacy' },
        { userId: 'u1', interest: 'technology' },
      ],
      skipDuplicates: true,
    });
    expect(calls.deleteMany).toEqual({ where: { userId: 'u1', interest: { notIn: ['diplomacy', 'technology'] } } });
  });

  it('an empty list clears the set', async () => {
    const { prisma, calls } = prismaMock(['sports']);
    await expect(new MyIntelligenceInterestsService(prisma).replace('u1', [])).resolves.toEqual({ interests: [] });
    expect(calls.deleteMany).toEqual({ where: { userId: 'u1', interest: { notIn: [] } } });
  });

  it('ordered() keeps governed ids only', () => {
    expect(ordered(['sports', 'nope', 'politics_governance'])).toEqual(['politics_governance', 'sports']);
  });
});

describe('DTO — no free text', () => {
  const errors = async (body: unknown) => validate(plainToInstance(UpdateInterestsDto, body));

  it('accepts governed ids', async () => {
    expect(await errors({ interests: ['security_conflict', 'sports'] })).toHaveLength(0);
    expect(await errors({ interests: [] })).toHaveLength(0);
  });

  it('rejects free text, unknown ids and a non-array', async () => {
    expect((await errors({ interests: ['football'] })).length).toBeGreaterThan(0);
    expect((await errors({ interests: ['Security & conflict'] })).length).toBeGreaterThan(0);
    expect((await errors({ interests: 'sports' })).length).toBeGreaterThan(0);
  });
});

describe('SCHEMA / MIGRATION — account-owned, cascading, governed', () => {
  const schema = read('prisma/schema.prisma');
  const block = schema.slice(schema.indexOf('model UserIntelligenceInterest '));
  const migration = read('prisma/migrations/20260928120000_my_intelligence_interests/migration.sql');

  it('cascades on account deletion and is unique per (user, interest)', () => {
    expect(block).toMatch(/onDelete:\s*Cascade/);
    expect(block).toContain('@@unique([userId, interest])');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).toContain('"UserIntelligenceInterest_userId_interest_key"');
  });

  it("the migration's CHECK list is exactly the governed vocabulary", () => {
    const listed = [...migration.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual([...MY_INTELLIGENCE_INTERESTS].sort());
  });

  it('the migration is additive only', () => {
    const sql = migration.replace(/--.*$/gm, '');
    /* Statement-level only: `ON UPDATE CASCADE` in the FK clause is not an UPDATE statement. */
    expect(sql).not.toMatch(/^\s*(DROP|UPDATE|DELETE)\b/im);
    expect(sql).not.toMatch(/ALTER TABLE "(?!UserIntelligenceInterest")/);
  });
});
