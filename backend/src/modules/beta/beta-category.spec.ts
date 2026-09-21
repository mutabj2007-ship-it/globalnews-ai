import { Test } from '@nestjs/testing';
import { BETA_CATEGORIES, type BetaCategory } from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { FakePrisma, resetFakePrismaIds } from '../compute/testing/fake-prisma.testing';
import { BetaCategoryService } from './category/beta-category.service';
import { BETA_CATEGORY_MAPPINGS, matchesBetaCategory } from './category/beta-category.mapping';

/**
 * BETA-SIMPLE-ASK-SAND-1 §16/§17 — the simple public category surface.
 *
 * §30 "AI-cost protection": category click does not auto-run AI.
 */

let articleCounter = 0;

function seedArticle(
  prisma: FakePrisma,
  overrides: Partial<{
    title: string;
    summary: string;
    category: string;
    countryCode: string | null;
    countryName: string | null;
    sourceName: string;
    publishedAt: Date;
  }> = {},
): void {
  articleCounter += 1;
  prisma.article.create({
    data: {
      id: `article-${articleCounter}`,
      title: `Article ${articleCounter}`,
      summary: 'A summary',
      url: `https://example.test/${articleCounter}`,
      sourceName: 'Example Source',
      category: 'world',
      countryCode: null,
      countryName: null,
      publishedAt: new Date(Date.now() - 60 * 60 * 1000),
      fetchedAt: new Date(),
      ...overrides,
    },
  });
}

async function buildService(): Promise<{ service: BetaCategoryService; prisma: FakePrisma }> {
  resetFakePrismaIds();
  articleCounter = 0;
  const prisma = new FakePrisma();

  const moduleRef = await Test.createTestingModule({
    providers: [BetaCategoryService, { provide: PrismaService, useValue: prisma }],
  }).compile();

  return { service: moduleRef.get(BetaCategoryService), prisma };
}

describe('§16 — a category click never runs AI', () => {
  it('constructs BetaCategoryService with the database and nothing else', () => {
    // The structural guarantee: an injected retrieval or analysis
    // service would be an invitation for a later change to call it.
    // Nest records constructor param types under this metadata key.
    const params: unknown[] = Reflect.getMetadata('design:paramtypes', BetaCategoryService) ?? [];
    expect(params).toHaveLength(1);
    expect(params[0]).toBe(PrismaService);
  });

  it('always reports CONTEXTUAL, whatever the corpus contains', async () => {
    const { service, prisma } = await buildService();
    for (let i = 0; i < 50; i += 1) {
      seedArticle(prisma, { countryCode: `C${i}`, category: 'business' });
    }

    for (const category of BETA_CATEGORIES) {
      const view = await service.getCategoryView(category);
      expect(view.computeClass).toBe('CONTEXTUAL');
    }
  });

  it('does not generate a narrative assessment', async () => {
    // Producing one would be exactly the "expensive new synthesis"
    // §16 forbids. The field stays absent until a stored assessment
    // exists to attach.
    const { service } = await buildService();
    expect((await service.getCategoryView('energy')).assessment).toBeUndefined();
  });
});

describe('§17 — one reusable template serves all five categories', () => {
  it.each(BETA_CATEGORIES)('returns a complete view for %s', async (category) => {
    const { service } = await buildService();
    const view = await service.getCategoryView(category);

    expect(view.category).toBe(category);
    expect(view.title).toBeTruthy();
    expect(Array.isArray(view.developments)).toBe(true);
    expect(typeof view.evidenceCount).toBe('number');
    expect(typeof view.distinctSourceCount).toBe('number');
    expect(Array.isArray(view.mapCountryCodes)).toBe(true);
    expect(view.entries).toEqual({ ask: true, analysis: true, watch: false });
  });

  it('§19 — offers Ask and Analysis generously, and gates only Watch', async () => {
    const { service } = await buildService();
    const view = await service.getCategoryView('economy');

    // §19: "Do not implement Professional as 'all useful information
    // is locked.'"
    expect(view.entries.ask).toBe(true);
    expect(view.entries.analysis).toBe(true);
    // Watch is Professional, and no tier grants it yet, so it is
    // reported honestly rather than shown and then refused.
    expect(view.entries.watch).toBe(false);
  });
});

describe('§17 — the view reflects the stored corpus honestly', () => {
  it('returns an empty but valid view when nothing is stored', async () => {
    const { service } = await buildService();
    const view = await service.getCategoryView('energy');

    expect(view.developments).toEqual([]);
    expect(view.evidenceCount).toBe(0);
    expect(view.distinctSourceCount).toBe(0);
    expect(view.lastUpdatedAt).toBeUndefined();
  });

  it('selects stored articles matching the category', async () => {
    const { service, prisma } = await buildService();
    seedArticle(prisma, { title: 'Solar power expansion announced', category: 'business' });
    seedArticle(prisma, { title: 'Local football result', category: 'business' });

    const view = await service.getCategoryView('energy');
    expect(view.developments).toHaveLength(1);
    expect(view.developments[0].title).toBe('Solar power expansion announced');
  });

  it('counts distinct sources across the whole matched pool, not the rendered slice', async () => {
    const { service, prisma } = await buildService();
    for (let i = 0; i < 30; i += 1) {
      seedArticle(prisma, {
        title: `Energy story ${i}`,
        category: 'business',
        sourceName: `Source ${i % 7}`,
      });
    }

    const view = await service.getCategoryView('energy');
    // Only 12 are rendered...
    expect(view.developments).toHaveLength(12);
    // ...but the counts describe all 30, so "N sources" is not a lie.
    expect(view.evidenceCount).toBe(30);
    expect(view.distinctSourceCount).toBe(7);
  });

  it('reports freshness from the newest matched article', async () => {
    const { service, prisma } = await buildService();
    const newest = new Date(Date.now() - 30 * 60 * 1000);
    seedArticle(prisma, {
      title: 'Oil pipeline update',
      category: 'business',
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    });
    seedArticle(prisma, { title: 'Gas supply update', category: 'business', publishedAt: newest });

    const view = await service.getCategoryView('energy');
    expect(view.lastUpdatedAt).toBe(newest.toISOString());
  });

  it('excludes articles older than the freshness window', async () => {
    const { service, prisma } = await buildService();
    seedArticle(prisma, {
      title: 'Ancient energy news',
      category: 'business',
      publishedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });

    const view = await service.getCategoryView('energy');
    // A surface that reaches further back the staler it gets would
    // make its own freshness signal meaningless.
    expect(view.developments).toHaveLength(0);
  });

  it('collects the countries with activity, for the simple map', async () => {
    const { service, prisma } = await buildService();
    seedArticle(prisma, {
      title: 'Energy grid in Rwanda',
      category: 'business',
      countryCode: 'RW',
    });
    seedArticle(prisma, { title: 'Solar in Kenya', category: 'business', countryCode: 'KE' });
    seedArticle(prisma, { title: 'More solar in Kenya', category: 'business', countryCode: 'KE' });

    const view = await service.getCategoryView('energy');
    expect([...view.mapCountryCodes].sort()).toEqual(['KE', 'RW']);
  });

  it('filters by country when one is selected', async () => {
    const { service, prisma } = await buildService();
    seedArticle(prisma, { title: 'Energy grid story', category: 'business', countryCode: 'RW' });
    seedArticle(prisma, { title: 'Energy oil story', category: 'business', countryCode: 'KE' });

    const view = await service.getCategoryView('energy', 'RW');
    expect(view.developments).toHaveLength(1);
    expect(view.countryCode).toBe('RW');
  });

  it('returns an empty view rather than throwing when the database fails', async () => {
    const { service, prisma } = await buildService();
    jest.spyOn(prisma.article, 'findMany').mockImplementation(() => {
      throw new Error('database unreachable');
    });

    // A public entry surface that errors because the database
    // hiccuped is worse than one that honestly shows nothing.
    const view = await service.getCategoryView('energy');
    expect(view.developments).toEqual([]);
    expect(view.computeClass).toBe('CONTEXTUAL');
  });
});

describe('§15 — the Beta vocabulary is not the provider vocabulary', () => {
  it('maps every Beta category', () => {
    for (const category of BETA_CATEGORIES) {
      expect(BETA_CATEGORY_MAPPINGS[category]).toBeDefined();
      expect(BETA_CATEGORY_MAPPINGS[category].title).toBeTruthy();
    }
  });

  it('treats world as a breadth surface, not a subject filter', async () => {
    const { service, prisma } = await buildService();
    seedArticle(prisma, { title: 'Sports result', category: 'sports' });
    seedArticle(prisma, { title: 'Energy story', category: 'business' });

    // Narrowing the broadest surface would make it the emptiest one.
    const view = await service.getCategoryView('world');
    expect(view.developments).toHaveLength(2);
  });

  it.each<[BetaCategory, string]>([
    ['economy', 'Inflation rises sharply'],
    ['energy', 'New solar capacity online'],
    ['security', 'Ceasefire holds along the border'],
    ['humanitarian', 'Refugee arrivals increase'],
  ])('recognises a representative %s headline', (category, title) => {
    expect(matchesBetaCategory(category, { title, summary: '' })).toBe(true);
  });

  it('matches word stems, so inflections do not need enumerating', () => {
    for (const title of ['economy', 'economic outlook', 'economics report']) {
      expect(matchesBetaCategory('economy', { title, summary: '' })).toBe(true);
    }
    for (const title of ['displaced families', 'mass displacement', 'people displace']) {
      expect(matchesBetaCategory('humanitarian', { title, summary: '' })).toBe(true);
    }
  });

  it('matches against the summary as well as the title', () => {
    expect(
      matchesBetaCategory('energy', {
        title: 'Cabinet meets',
        summary: 'Discussed the power grid.',
      }),
    ).toBe(true);
  });

  it('does not match an unrelated story', () => {
    expect(
      matchesBetaCategory('energy', { title: 'Local football result', summary: 'A draw.' }),
    ).toBe(false);
  });
});
