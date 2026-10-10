import {
  containsUnresolvedTemplatePlaceholder,
  stripUnresolvedTemplatePlaceholders,
} from './article-metadata-hygiene.util';
import { GNewsProvider } from './providers/gnews.provider';
import { parseFeed } from './providers/parse-feed.util';
import { ArticlePersistenceService } from './persistence/article-persistence.service';

/**
 * ARTICLE METADATA HYGIENE R1.
 *
 * The Namibia fixture reproduces the placeholder sequence observed on the live
 * Home card (a namibian.com.na item served through GNews). The live payload was
 * not re-fetched — doing so would spend provider quota — so the prose after the
 * template is illustrative; the template run is the observed one.
 */
const NAMIBIA_TEMPLATE = '%%title%% %%sep%% %%primary_category%% %%sep%% %%sitename%%';
const NAMIBIA_PROSE =
  'The ministry said the new water allocation plan will be presented to regional councils next week.';
const NAMIBIA_DESCRIPTION = `${NAMIBIA_TEMPLATE} ${NAMIBIA_PROSE}`;

describe('stripUnresolvedTemplatePlaceholders', () => {
  describe('removes unresolved template placeholders', () => {
    it('Namibia fixture — keeps only the genuine prose after the template', () => {
      expect(stripUnresolvedTemplatePlaceholders(NAMIBIA_DESCRIPTION)).toBe(NAMIBIA_PROSE);
    });

    it('a template-only description becomes an empty summary, never a replacement', () => {
      expect(stripUnresolvedTemplatePlaceholders(NAMIBIA_TEMPLATE)).toBe('');
      expect(stripUnresolvedTemplatePlaceholders('%%title%% - %%sitename%%')).toBe('');
      expect(stripUnresolvedTemplatePlaceholders('  %%excerpt%%  |  ')).toBe('');
    });

    it('removes multiple tokens wherever they sit, including adjacent and custom ones', () => {
      expect(
        stripUnresolvedTemplatePlaceholders(
          '%%title%%%%sep%% Talks resumed on Monday. %%cf_region%% Officials declined to comment. %%page%%',
        ),
      ).toBe('Talks resumed on Monday. Officials declined to comment.');
    });

    it('drops separator punctuation the template leaves dangling at an edge', () => {
      expect(stripUnresolvedTemplatePlaceholders('%%title%% | Windhoek council approves budget')).toBe(
        'Windhoek council approves budget',
      );
      expect(stripUnresolvedTemplatePlaceholders('Windhoek council approves budget %%sep%% %%sitename%%')).toBe(
        'Windhoek council approves budget',
      );
    });

    it('keeps interior punctuation belonging to the prose', () => {
      expect(stripUnresolvedTemplatePlaceholders('%%sitename%% Prices rose - again - in May.')).toBe(
        'Prices rose - again - in May.',
      );
    });
  });

  describe('never touches legitimate percent text', () => {
    const untouched = [
      'Inflation rose 5% in August.',
      'The grid now runs on 100% renewable power.',
      'Analysts expect 20% growth next year.',
      'The quoted figure was "50%%" in the leaked draft.',
      'Error rate fell from 3.2% to 1.1% (p < 0.05), a 65% relative drop.',
      'See https://example.com/search?q=water%20plan&ratio=50%25 for details.',
      'The share is 10 % of the total, or x % y in the notation.',
      'Rates: 5%%10% spread, and 50%%sep%% glued to a digit.',
      'Upper-case %%TITLE%% and spaced %% title %% are not the governed shape.',
    ];

    it.each(untouched)('%s', (text) => {
      expect(containsUnresolvedTemplatePlaceholder(text)).toBe(false);
      expect(stripUnresolvedTemplatePlaceholders(text)).toBe(text);
    });
  });

  describe('clean descriptions are returned byte-for-byte', () => {
    const clean = [
      'A short summary of the story.',
      '  Leading and trailing whitespace is not ours to normalize.  ',
      'Line one.\n\nLine two with   internal spacing.',
      'Kraków — władze miasta ogłosiły nowy plan; wzrost o 7%.',
      '',
    ];

    it.each(clean)('%j', (text) => {
      expect(stripUnresolvedTemplatePlaceholders(text)).toBe(text);
    });
  });

  it('is stable when applied twice (provider boundary, then read-back)', () => {
    const once = stripUnresolvedTemplatePlaceholders(NAMIBIA_DESCRIPTION);
    expect(stripUnresolvedTemplatePlaceholders(once)).toBe(once);
  });
});

describe('Article Metadata Hygiene R1 — the shared boundaries apply it', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function gnewsWith(description: string | undefined): GNewsProvider {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        totalArticles: 1,
        articles: [
          {
            title: 'Namibia outlines water allocation plan',
            description,
            url: 'https://www.namibian.com.na/example-story',
            publishedAt: '2026-09-20T08:00:00Z',
            source: { name: 'The Namibian', url: 'https://www.namibian.com.na' },
          },
        ],
      }),
    } as unknown as Response);

    /* T1 — 'test-key' is now a recognised placeholder (not configured); use a non-placeholder fixture. */
    return new GNewsProvider({ get: jest.fn().mockReturnValue('gnews-spec-fixture-key-7f3a') } as never);
  }

  it('GNews — the Namibia description reaches summary as prose only', async () => {
    const [article] = await gnewsWith(NAMIBIA_DESCRIPTION).search('Namibia');

    expect(article.summary).toBe(NAMIBIA_PROSE);
  });

  it('GNews — a template-only description yields an empty summary', async () => {
    const [article] = await gnewsWith(NAMIBIA_TEMPLATE).search('Namibia');

    expect(article.summary).toBe('');
  });

  it('GNews — a clean description is unchanged and makes exactly one provider request', async () => {
    const provider = gnewsWith('Inflation rose 5% in August.');
    const [article] = await provider.search('Namibia');

    expect(article.summary).toBe('Inflation rose 5% in August.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('RSS/Atom feeds — the description is cleaned by the shared parser', () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>Feed</title>
      <item>
        <title>Namibia outlines water allocation plan</title>
        <link>https://example.com/a</link>
        <description><![CDATA[<p>${NAMIBIA_DESCRIPTION}</p>]]></description>
      </item>
      <item>
        <title>Template only</title>
        <link>https://example.com/b</link>
        <description>${NAMIBIA_TEMPLATE}</description>
      </item>
    </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items.map((item) => item.summary)).toEqual([NAMIBIA_PROSE, '']);
  });

  it('A.1 — the syndicated <content:encoded> body is NOT rewritten; only the description is cleaned', () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>Feed</title>
      <item>
        <title>Configuration guide</title>
        <link>https://example.com/c</link>
        <description>%%title%% %%sep%% A short guide to the configuration.</description>
        <content:encoded><![CDATA[<p>The configuration uses <code>%%example%%</code> as a literal token.</p>
          <p>Nothing else &amp; nothing more.</p>]]></content:encoded>
      </item>
    </channel></rss>`;

    const [item] = parseFeed(xml).items;

    expect(item.summary).toBe('A short guide to the configuration.');
    // Ordinary HTML/entity/whitespace normalization only — the token survives exactly.
    expect(item.syndicatedBody).toBe(
      'The configuration uses %%example%% as a literal token. Nothing else & nothing more.',
    );
    expect(item.bodySource).toBe('content-encoded');
  });

  describe('persisted rows written before the fix are cleaned on read-back', () => {
    const storedRow = {
      id: 'article-1',
      title: 'Stored headline',
      summary: NAMIBIA_DESCRIPTION,
      url: 'https://example.com/stored',
      imageUrl: null,
      sourceId: 'the-namibian',
      sourceName: 'The Namibian',
      sourcesCount: 1,
      category: 'world',
      publishedAt: new Date('2026-09-20T08:00:00.000Z'),
      fetchedAt: new Date('2026-09-20T08:05:00.000Z'),
      confidenceScore: 80,
    };

    function serviceReturning(rows: { article?: unknown[]; country?: unknown[] }) {
      const prisma = {
        article: {
          findMany: jest.fn().mockResolvedValue(rows.article ?? []),
          findFirst: jest.fn().mockResolvedValue(rows.article?.[0] ?? null),
        },
        articleCountry: { findMany: jest.fn().mockResolvedValue(rows.country ?? []) },
      };

      return new ArticlePersistenceService(prisma as never);
    }

    it('findRecent', async () => {
      const [article] = await serviceReturning({ article: [storedRow] }).findRecent({ limit: 5 });
      expect(article.summary).toBe(NAMIBIA_PROSE);
    });

    it('findById', async () => {
      const article = await serviceReturning({ article: [storedRow] }).findById('article-1');
      expect(article?.summary).toBe(NAMIBIA_PROSE);
    });

    it('findRecentByCountry', async () => {
      const [article] = await serviceReturning({
        country: [{ countryCode: 'NAM', relevanceScore: 80, isRelevant: true, article: storedRow }],
      }).findRecentByCountry({ countryCode: 'NAM' });
      expect(article.summary).toBe(NAMIBIA_PROSE);
    });
  });
});
