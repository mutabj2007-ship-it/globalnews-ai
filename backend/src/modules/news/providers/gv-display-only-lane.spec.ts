import { readFileSync } from 'fs';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';
/*
  E1 V7 (ADDENDUM-26) — the Global Voices lane end to end, against a SYNTHETIC registry in which the
  GV row alone is marked CLEARED (the real row is not: CLEARED is a PO/CTO act, C-GV9). The real
  governed state is asserted at the bottom against the unmocked registry.
*/
jest.mock('./feed-source-registry', () => {
  const actual = jest.requireActual('./feed-source-registry');
  return {
    ...actual,
    FEED_SOURCES: actual.FEED_SOURCES.map((row: { sourceId: string; rights: { state: string } }) =>
      row.sourceId === 'feed:globalvoices'
        ? { ...row, rights: { ...row.rights, state: 'CLEARED' } }
        : row,
    ),
  };
});
import { RssFeedProvider } from './rss-feed.provider';
import { FEED_SOURCES } from './feed-source-registry';
import { sourceUseDecision, isDisplayOnlyFeedArticle } from '../rights/source-use-policy';
import { withholdThirdPartyArticles } from '../rights/reader-rights';
import { __setReaderRightsFixtureModeForTests } from '../rights/reader-rights';
import { newsRoleOf } from '../evidence/evidence-candidate';
import { readerSafeNewsResponse } from '../news.controller';
import { admitGlobalVoicesPage } from '../rights/gv-v6-admission';

const GV = FEED_SOURCES.find((row) => row.sourceId === 'feed:globalvoices')!;
const VENEZUELA =
  'https://globalvoices.org/2026/10/22/venezuela-faces-a-deepening-energy-crisis-as-protests-grow/';
const FURNITURE = readFileSync(
  join(__dirname, '../rights/__fixtures__/gv-venezuela-20261022.furniture.html'),
  'utf8',
);
const BY3 = 'https://creativecommons.org/licenses/by/3.0/';

const credited = {
  id: 'rss-1',
  title: 'Venezuela faces a deepening energy crisis as protests grow',
  url: VENEZUELA,
  sourceId: 'feed:globalvoices',
  sourceName: 'Global Voices',
  authorName: 'Gabriela Mesones Rojo',
  licenseId: 'CC-BY-3.0',
  licenseUrl: BY3,
};

/* Synthetic feed: the real item link plus a second item whose page is a content-sharing republication. */
const OTHER = 'https://globalvoices.org/2026/10/23/a-synthetic-shared-report/';
const FEED = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Global Voices</title>
<item><title>Venezuela faces a deepening energy crisis as protests grow</title><link>${VENEZUELA}</link>
<dc:creator>Wrong Feed Creator</dc:creator><pubDate>Wed, 22 Oct 2026 20:06:00 +0000</pubDate><description>Power cuts spread.</description>
<content:encoded><![CDATA[<p>FULL BODY THAT MUST NEVER BE CARRIED</p>]]></content:encoded></item>
<item><title>A shared report</title><link>${OTHER}</link><pubDate>Thu, 23 Oct 2026 22:05:00 +0000</pubDate><description>Shared.</description></item>
</channel></rss>`;
const SHARED_PAGE = FURNITURE.split(VENEZUELA)
  .join(OTHER)
  .replace(
    '</body>',
    '<p>It is being published on Global Voices as part of a content-sharing agreement.</p></body>',
  );

function provider(fetchImpl: jest.Mock) {
  global.fetch = fetchImpl as unknown as typeof fetch;
  const config = {
    get: (key: string) =>
      key === 'RSS_FEEDS_ENABLED'
        ? 'true'
        : key === 'RSS_FEED_SOURCES'
          ? 'feed:globalvoices'
          : undefined,
  } as unknown as ConfigService;
  return new RssFeedProvider(config);
}

const response = (body: string) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => body,
  }) as unknown as Response;

describe('E1 V7 · the Global Voices display-only lane', () => {
  const realFetch = global.fetch;
  beforeAll(() => __setReaderRightsFixtureModeForTests(false));
  afterAll(() => {
    global.fetch = realFetch;
    __setReaderRightsFixtureModeForTests(true);
  });

  it('C-GV7b: the furniture-only Venezuela fixture still ADMITS (durable positive control)', () => {
    expect(admitGlobalVoicesPage(VENEZUELA, FURNITURE)).toMatchObject({
      outcome: 'ADMIT',
      author: { name: 'Gabriela Mesones Rojo' },
      publishedOn: '2026-10-22',
      licence: { url: BY3 },
    });
    /* T5 on the real furniture: relabel the byline and the verdict must change */
    const relabelled = FURNITURE.split('>Written by<').join('>Written (Español) by<');
    expect(admitGlobalVoicesPage(VENEZUELA, relabelled).outcome).not.toBe('ADMIT');
  });

  it('emits only page-admitted items, credited from the page — never dc:creator, never a body or image', async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      response(url === GV.feedUrl ? FEED : url === VENEZUELA ? FURNITURE : SHARED_PAGE),
    );
    const lane = provider(fetchImpl);
    const first = await lane.topHeadlines();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      url: VENEZUELA,
      sourceId: 'feed:globalvoices',
      authorName: 'Gabriela Mesones Rojo',
      licenseId: 'CC-BY-3.0',
      licenseUrl: BY3,
      summary: 'Power cuts spread.',
    });
    expect(JSON.stringify(first)).not.toMatch(/Wrong Feed Creator|FULL BODY/);
    expect(first[0]).not.toHaveProperty('imageUrl');
    /* one page per call: the second item has no verdict yet and is not emitted */
    expect(fetchImpl.mock.calls.map(([u]) => u)).toEqual([GV.feedUrl, VENEZUELA]);
  });

  it('C-FR3: a query (the Ask / analysis path) never receives a display-only item', async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      response(url === GV.feedUrl ? FEED : FURNITURE),
    );
    expect(await provider(fetchImpl).search('venezuela')).toEqual([]);
  });

  describe('one rights authority', () => {
    it('METADATA only with the full credit; AI_INPUT never (display-only)', () => {
      expect(sourceUseDecision(credited, 'METADATA', { enforcement: 'enforce' })).toEqual({
        allowed: true,
        basis: 'FEED_CLEARED',
      });
      expect(sourceUseDecision(credited, 'AI_INPUT', { enforcement: 'enforce' })).toEqual({
        allowed: false,
        reason: 'DISPLAY_ONLY_SOURCE',
      });
    });

    it.each([
      ['no author', { authorName: undefined }],
      ['blank author', { authorName: '  ' }],
      ['no licence id', { licenseId: undefined }],
      [
        'the 4.0 deed (a wrong licence link is itself a breach)',
        { licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
      ],
    ])('%s → ATTRIBUTION_MISSING, even on a CLEARED row', (_case, patch) => {
      expect(
        sourceUseDecision({ ...credited, ...patch }, 'METADATA', { enforcement: 'enforce' }),
      ).toEqual({
        allowed: false,
        reason: 'ATTRIBUTION_MISSING',
      });
    });

    it('the interceptor admits a credited article ONLY inside creditedArticles; withheld everywhere else', () => {
      const { authorName: _a, licenseId: _l, licenseUrl: _u, ...stored } = credited;
      const mapped = {
        title: credited.title,
        url: credited.url,
        sourceName: 'Global Voices',
        publishedAt: '2026-10-22',
      };
      const out = withholdThirdPartyArticles({
        creditedArticles: [credited, stored],
        articles: [credited],
        story: { lead: credited },
        recentReporting: { items: [mapped] },
      });
      expect(out.value).toEqual({
        creditedArticles: [credited],
        articles: [],
        story: {},
        recentReporting: { items: [] },
      });
      expect(out.withheld).toBe(4);
    });

    it('readerSafeNewsResponse moves a credited article out of articles into creditedArticles', () => {
      const other = { ...credited, id: 'g1', sourceId: 'bbc', url: 'https://www.bbc.co.uk/news/x' };
      const out = readerSafeNewsResponse({ articles: [credited, other], totalResults: 2 } as never);
      expect(out.articles.map((x) => x.id)).toEqual(['g1']);
      expect(out.creditedArticles?.map((x) => x.id)).toEqual(['rss-1']);
      expect(out.totalResults).toBe(1);
    });
  });

  it('C-FR2: never persisted; §4.2: role INTERNATIONAL_REPORTING, never LOCAL_REPORTING', () => {
    expect(isDisplayOnlyFeedArticle(credited)).toBe(true);
    expect(isDisplayOnlyFeedArticle({ sourceId: 'feed:ktpress-rw' })).toBe(false);
    expect(newsRoleOf({ sourceId: 'feed:globalvoices', url: VENEZUELA })).toBe(
      'INTERNATIONAL_REPORTING',
    );
  });
});

describe('E1 V7 · the REAL governed row (unmocked)', () => {
  it('is not CLEARED in code, is international with no country, and declares the gate, credit and display-only', () => {
    const real = jest
      .requireActual('./feed-source-registry')
      .FEED_SOURCES.find((row: { sourceId: string }) => row.sourceId === 'feed:globalvoices');
    expect(real.rights.state).not.toBe('CLEARED');
    expect(real).toMatchObject({
      scope: 'INTERNATIONAL',
      canonicalHost: 'globalvoices.org',
      articlePageGate: 'GV_V6',
      attribution: { licenseId: 'CC-BY-3.0', licenseUrl: BY3 },
      displayOnly: true,
      enabled: false,
    });
    expect(real.countryCode).toBeUndefined();
  });
});
