import { readFileSync } from 'fs';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';
import { parseFeed } from './parse-feed.util';
import { RssFeedProvider, isRssFeedsEnabled } from './rss-feed.provider';
import {
  FEED_SOURCES,
  REJECTED_FEED_CANDIDATES,
  getEnabledFeedSources,
  resolveActiveFeedSources,
} from './feed-source-registry';

/**
 * S1 ACCEPTANCE — FIXTURE-FIRST, AGAINST BYTES REAL PUBLISHERS SERVED.
 *
 * The parser is tested against captures taken from KT Press and Statistics
 * Poland on 2026-08-31 (see __fixtures__/README.md for how each was obtained
 * and which is byte-accurate). That is the discipline the three unverified
 * providers in this repository never got: their tests assert what someone
 * assumed a response looks like, and this one asserts what one actually is.
 */

const FIXTURES = join(__dirname, '__fixtures__');
const KTPRESS = readFileSync(join(FIXTURES, 'ktpress-feed.sample.xml'), 'utf-8');
const GUS = readFileSync(join(FIXTURES, 'gus-feed.sample.xml'), 'utf-8');
const TAARIFA = readFileSync(join(FIXTURES, 'taarifa-feed.sample.xml'), 'utf-8');

function configWith(enabled: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'RSS_FEEDS_ENABLED' ? enabled : undefined),
  } as unknown as ConfigService;
}

/* ------------------------------------------------------------------ */

describe('parsing the KT Press capture (byte-accurate, WordPress RSS 2.0)', () => {
  const parsed = parseFeed(KTPRESS);

  it('reads the channel title without picking up an item title', () => {
    expect(parsed.channelTitle).toBe('KT PRESS');
  });

  it('extracts every item', () => {
    expect(parsed.items).toHaveLength(3);
    expect(parsed.droppedItemCount).toBe(0);
  });

  it('DECODES HTML ENTITIES that appear in real titles', () => {
    // The capture contains &#8217; and &#8220;/&#8221; — a title rendered with
    // the raw entities would reach the reader looking broken.
    expect(parsed.items[0].title).toBe(
      'Rising with Dignity: Joy Uwanziga’s Stoic Discovery of Ancient Philosophy in Rwandan Homes',
    );
    expect(parsed.items[2].title).toContain('“He Drank Like the Rich”');
  });

  it('STRIPS HTML from a CDATA description rather than emitting markup', () => {
    expect(parsed.items[0].summary).toContain('When Joy Uwanziga began studying stoicism');
    expect(parsed.items[0].summary).not.toContain('<p>');
    expect(parsed.items[0].summary).not.toContain('<a href');
  });

  it('is not confused by NAMESPACED SIBLINGS', () => {
    /*
     * The capture carries <atom:link href=...>, <dc:creator>, <wfw:commentRss>
     * and <slash:comments>. A naive <link> match would take the atom self-link
     * or the comments URL as the article URL.
     */
    expect(parsed.items[0].link).toBe(
      'https://www.ktpress.rw/2026/08/rising-with-dignity-joy-uwanzigas-stoic-discovery-of-ancient-philosophy-in-rwandan-homes/',
    );
    for (const item of parsed.items) {
      expect(item.link).not.toContain('/feed/');
      expect(item.link).not.toContain('#respond');
    }
  });

  it('reads multiple categories from one item', () => {
    expect(parsed.items[0].categories).toEqual(['Society', 'latestnews']);
  });

  it('keeps the publication date as published, for the caller to parse', () => {
    expect(parsed.items[0].publishedAt).toBe('Sun, 30 Aug 2026 20:36:51 +0000');
  });
});

describe('parsing the Statistics Poland capture (a structurally different feed)', () => {
  const parsed = parseFeed(GUS);

  it('TRIMS CDATA THAT CARRIES ITS OWN WHITESPACE', () => {
    // GUS writes `<title>\n<![CDATA[ Text ]]>\n</title>` — the padding is both
    // outside and inside the CDATA, and an untrimmed title would carry it into
    // the evidence surface.
    expect(parsed.items[0].title).toBe(
      'Domestic deliveries and consumption of selected consumer goods per capita in 2025',
    );
    expect(parsed.items[0].publishedAt).toBe('Mon, 31 Aug 2026 15:00:00 +0200');
  });

  it('is not confused by a self-closing channel <description/>', () => {
    expect(parsed.channelTitle).toBe('Statistics Poland');
    expect(parsed.items).toHaveLength(3);
  });

  it('AN EMPTY DESCRIPTION STAYS EMPTY — no summary is synthesized from the title', () => {
    // The third GUS item's description CDATA contains only whitespace.
    expect(parsed.items[2].summary).toBe('');
    expect(parsed.items[2].title).toContain('Infographic');
  });

  it('an item with no category yields an empty list, not a guess', () => {
    expect(parsed.items[2].categories).toEqual([]);
  });
});

describe('the parser drops what it cannot honestly normalize', () => {
  it('drops an item with no link, and counts it', () => {
    const parsed = parseFeed(
      '<rss><channel><title>T</title><item><title>Headline</title></item></channel></rss>',
    );

    expect(parsed.items).toHaveLength(0);
    expect(parsed.droppedItemCount).toBe(1);
  });

  it('drops an item with no title', () => {
    const parsed = parseFeed(
      '<rss><channel><item><link>https://e.example/a</link></item></channel></rss>',
    );

    expect(parsed.items).toHaveLength(0);
    expect(parsed.droppedItemCount).toBe(1);
  });

  it('never throws on junk, and reports zero items instead', () => {
    for (const junk of ['', 'not xml at all', '<rss>', '<html><body>hi</body></html>']) {
      expect(() => parseFeed(junk)).not.toThrow();
      expect(parseFeed(junk).items).toHaveLength(0);
    }
  });

  it('reads an Atom entry, taking the href from the alternate link', () => {
    const parsed = parseFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry>
         <title>Atom headline</title>
         <link rel="alternate" href="https://e.example/atom-1"/>
         <updated>2026-08-31T10:00:00Z</updated>
         <summary>Body text</summary>
       </entry></feed>`,
    );

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].link).toBe('https://e.example/atom-1');
    expect(parsed.items[0].publishedAt).toBe('2026-08-31T10:00:00Z');
  });
});

/* ------------------------------------------------------------------ */

describe('THE ARCHITECTURE RULE — RSS is the transport, the PUBLISHER is the source', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  function enabledProvider(): RssFeedProvider {
    const provider = new RssFeedProvider(configWith('true'));
    // Enable exactly one registry entry for the duration of the test.
    jest
      .spyOn(provider as unknown as { enabledSources: () => unknown }, 'enabledSources')
      .mockReturnValue([
        {
          sourceId: 'feed:ktpress-rw',
          displayName: 'KT Press',
          countryCode: 'RW',
          sourceType: 'NEWS_PROVIDER',
          feedUrl: 'https://www.ktpress.rw/feed/',
          canonicalHost: 'ktpress.rw',
          language: 'en',
          enabled: true,
          provenanceNote: 'fixture',
          verifiedAt: '2026-08-31',
        },
      ] as never);
    return provider;
  }

  it('EVERY article carries the PUBLISHER identity, never the connector id', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => KTPRESS } as never);

    const articles = await enabledProvider().topHeadlines();

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      // The publisher is the source...
      expect(article.sourceId).toBe('feed:ktpress-rw');
      expect(article.sourceName).toBe('KT Press');
      // ...and the connector is only the transport.
      expect(article.sourceId).not.toBe('rss-feeds');
      expect(article.sourceName).not.toBe('Publisher Feeds');
      expect(article.providerId).toBe('rss-feeds');
    }
  });

  it("keeps the PUBLISHER'S url, so downstream identity and locality still work", async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => KTPRESS } as never);

    const articles = await enabledProvider().topHeadlines();

    for (const article of articles) {
      expect(article.url).toContain('ktpress.rw');
    }
  });

  it("uses the PUBLISHER'S own timestamp basis, not an observed one", async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => KTPRESS } as never);

    const [article] = await enabledProvider().topHeadlines();

    // A feed's pubDate is the publisher asserting when it ran — unlike GDELT's
    // seendate, which is an aggregator recording when it saw the item.
    expect(article.publishedAtBasis).toBe('publisher');
    expect(article.publishedAt).toBe(new Date('Sun, 30 Aug 2026 20:36:51 +0000').toISOString());
  });

  it('DROPS a link that does not belong to the registered publisher', async () => {
    // A feed that starts carrying third-party links must not launder them into
    // this publisher's verified identity.
    const foreignLink = KTPRESS.replace(
      'https://www.ktpress.rw/2026/08/rising-with-dignity-joy-uwanzigas-stoic-discovery-of-ancient-philosophy-in-rwandan-homes/',
      'https://unrelated.example/hijacked',
    );

    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => foreignLink } as never);

    const articles = await enabledProvider().topHeadlines();

    expect(articles.every((article) => article.url.includes('ktpress.rw'))).toBe(true);
    expect(articles.some((article) => article.url.includes('unrelated.example'))).toBe(false);
  });

  it('never synthesizes a summary', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200, text: async () => GUS } as never);

    const provider = new RssFeedProvider(configWith('true'));
    jest
      .spyOn(provider as unknown as { enabledSources: () => unknown }, 'enabledSources')
      .mockReturnValue([
        {
          sourceId: 'feed:gus-pl',
          displayName: 'Statistics Poland',
          countryCode: 'PL',
          sourceType: 'OFFICIAL_SOURCE',
          feedUrl: 'https://stat.gov.pl/rss/en/3/3.xml',
          canonicalHost: 'stat.gov.pl',
          language: 'en',
          enabled: true,
          provenanceNote: 'fixture',
          verifiedAt: '2026-08-31',
        },
      ] as never);

    const articles = await provider.topHeadlines();
    const infographic = articles.find((a) => a.title.includes('Infographic'));

    expect(infographic).toBeDefined();
    expect(infographic?.summary).toBe('');
  });

  it('one failing publisher does not fail the batch', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503, text: async () => '' } as never);

    // The only enabled source fails; the provider returns nothing rather than throwing.
    await expect(enabledProvider().topHeadlines()).resolves.toEqual([]);
  });
});

describe('OFF BY DEFAULT, and off twice over', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  it('makes NO request when RSS_FEEDS_ENABLED is unset', async () => {
    const articles = await new RssFeedProvider(configWith(undefined)).topHeadlines();

    expect(articles).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('only the exact literal "true" enables it', () => {
    for (const value of ['true', 'TRUE', ' True ']) {
      expect(isRssFeedsEnabled(value)).toBe(true);
    }
    for (const value of ['1', 'yes', 'on', 'TRUE!', '', '   ', undefined]) {
      expect(isRssFeedsEnabled(value)).toBe(false);
    }
  });

  it('EVERY registry entry ships disabled — the flag alone activates nothing', () => {
    expect(FEED_SOURCES.length).toBeGreaterThan(0);
    for (const entry of FEED_SOURCES) {
      expect(entry.enabled).toBe(false);
    }
    expect(getEnabledFeedSources()).toHaveLength(0);
  });

  it('so even with the env flag on, nothing is fetched', async () => {
    const articles = await new RssFeedProvider(configWith('true')).topHeadlines();

    expect(articles).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('HEALTH DOES NOT HAMMER PUBLISHER FEEDS', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  it('ten health checks make ZERO requests — these are somebody else’s newsrooms', async () => {
    const provider = new RssFeedProvider(configWith('true'));

    for (let i = 0; i < 10; i += 1) {
      await provider.health();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a switched-off provider is DISABLED, not broken', async () => {
    const health = await new RssFeedProvider(configWith(undefined)).health();

    expect(health.enabled).toBe(false);
    expect(health.message).toContain('switched off');
  });

  it('reports NO counters until something was actually measured', async () => {
    const health = await new RssFeedProvider(configWith('true')).health();

    expect(health.requestCount).toBeUndefined();
    expect(health.failureCount).toBeUndefined();
    expect(health.lastSuccessAt).toBeUndefined();
  });
});

describe('the registry records what was verified, and what was rejected', () => {
  it('every entry carries provenance and a verification date', () => {
    for (const entry of FEED_SOURCES) {
      expect(entry.provenanceNote).toMatch(/Fetched \d{4}-\d{2}-\d{2}/);
      expect(entry.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.feedUrl).toMatch(/^https:\/\//);
      expect(entry.canonicalHost).not.toContain('/');
    }
  });

  it('covers all three markets, with both news and official sources', () => {
    const markets = new Set(FEED_SOURCES.map((entry) => entry.countryCode));

    expect(markets).toEqual(new Set(['RW', 'KE', 'PL']));
    expect(FEED_SOURCES.some((e) => e.sourceType === 'OFFICIAL_SOURCE')).toBe(true);
    expect(FEED_SOURCES.some((e) => e.sourceType === 'NEWS_PROVIDER')).toBe(true);
  });

  it('NBP is absent — its JSON rates API is PUBLIC_DATA, excluded from S1', () => {
    expect(FEED_SOURCES.some((e) => e.canonicalHost.includes('nbp.pl'))).toBe(false);
  });

  it('rejected candidates are named so they are not re-proposed', () => {
    expect(REJECTED_FEED_CANDIDATES.length).toBeGreaterThan(0);

    const rejectedText = REJECTED_FEED_CANDIDATES.join(' ');
    for (const name of ['New Times', 'IGIHE', 'National Bank of Rwanda', 'PAP', 'tvn24']) {
      expect(rejectedText).toContain(name);
    }

    // And none of them leaked into the live registry.
    for (const host of ['newtimes.co.rw', 'igihe', 'bnr.rw', 'pap.pl', 'tvn24.pl', 'rp.pl']) {
      expect(FEED_SOURCES.some((e) => e.canonicalHost.includes(host))).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */

describe('parsing the Taarifa Rwanda capture — constructs the other fixtures lack', () => {
  const parsed = parseFeed(TAARIFA);

  it('extracts both items', () => {
    expect(parsed.items).toHaveLength(2);
    expect(parsed.droppedItemCount).toBe(0);
  });

  it('does NOT mistake <content:encoded> for <description>', () => {
    /*
     * Both elements exist on every item and both hold article prose, so a
     * parser that took the wrong one would look right at a glance. The
     * description is the short teaser; content:encoded is the full body.
     */
    expect(parsed.items[0].summary).toContain('after completing the group stage');
    expect(parsed.items[0].summary).not.toContain('The victory capped an impressive run');
  });

  it('is not derailed by an element carrying its own default xmlns', () => {
    // <post-id xmlns="com-wordpress:feed-additions:1">103262</post-id>
    expect(parsed.items[0].link).toBe(
      'https://taarifa.rw/2026/08/30/rwanda-storm-into-african-volleyball-championship-quarterfinals-unbeaten/',
    );
    expect(parsed.items[0].link).not.toContain('#respond');
  });

  it('ignores a self-closing namespaced element', () => {
    // <media:thumbnail url="..." /> must not be read as content.
    for (const item of parsed.items) {
      expect(item.summary).not.toContain('wp-content/uploads');
      expect(item.summary).not.toContain('media:thumbnail');
    }
  });

  it('decodes numeric entities that appear inside CDATA', () => {
    expect(parsed.items[0].summary).toContain('Women\u2019s');
    expect(parsed.items[0].summary).not.toContain('&#8217;');
  });
});

/* ------------------------------------------------------------------ */

describe("REGRESSION — WordPress's self-referential trailer must not become evidence", () => {
  /*
   * MEASURED, NOT HYPOTHETICAL. Relevance scoring reads the summary. The
   * trailer "The post <headline> appeared first on <Publisher>." carries the
   * publisher's own name, and for a publisher whose name contains a country
   * that manufactures a country mention the journalism never made. A real KT
   * Press item with no Rwanda signal scored 15 and was refused; with the
   * trailer appended it scored 45 and was ADMITTED, citing "country reference
   * appears in summary".
   */
  it('removes the trailer from a real capture', () => {
    const parsed = parseFeed(TAARIFA);

    for (const item of parsed.items) {
      expect(item.summary).not.toContain('appeared first on');
      expect(item.summary).not.toContain('Taarifa Rwanda:');
    }
  });

  it('removes it from the KT Press capture too', () => {
    const parsed = parseFeed(KTPRESS);

    for (const item of parsed.items) {
      expect(item.summary).not.toContain('appeared first on');
    }
  });

  it('keeps the article text that precedes the trailer', () => {
    const parsed = parseFeed(TAARIFA);

    expect(parsed.items[0].summary).toContain('Rwanda have advanced to the quarterfinals');
    expect(parsed.items[0].summary.length).toBeGreaterThan(100);
  });

  it('does NOT strip an article that merely begins a sentence with "The post"', () => {
    const feed = `<rss><channel><item>
      <title>Mail delays</title>
      <link>https://p.example/a</link>
      <pubDate>Sun, 30 Aug 2026 11:45:56 +0000</pubDate>
      <description>The post office confirmed the backlog will clear by Friday.</description>
    </item></channel></rss>`;

    expect(parseFeed(feed).items[0].summary).toBe(
      'The post office confirmed the backlog will clear by Friday.',
    );
  });

  it('leaves a description with no trailer completely untouched', () => {
    const feed = `<rss><channel><item>
      <title>Budget read</title>
      <link>https://p.example/b</link>
      <pubDate>Sun, 30 Aug 2026 11:45:56 +0000</pubDate>
      <description>Lawmakers debated the allocation for three hours.</description>
    </item></channel></rss>`;

    expect(parseFeed(feed).items[0].summary).toBe(
      'Lawmakers debated the allocation for three hours.',
    );
  });
});

/* ------------------------------------------------------------------ */

describe('PER-SOURCE ACTIVATION BY ENVIRONMENT — RSS_FEED_SOURCES', () => {
  const SIX = [
    'feed:ktpress-rw',
    'feed:taarifa-rw',
    'feed:standardmedia-ke',
    'feed:cbk-ke',
    'feed:gus-pl',
    'feed:wp-pl',
  ];

  it('activates nothing when the variable is unset — the shipped state', () => {
    for (const value of [undefined, '', '   ', ',,', ' , ']) {
      const selection = resolveActiveFeedSources(FEED_SOURCES, value);

      expect(selection.sources).toHaveLength(0);
      expect(selection.overridden).toBe(false);
    }
  });

  it('activates exactly the ids named, and no others', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, SIX.join(','));

    expect(selection.sources.map((source) => source.sourceId)).toEqual(SIX);
    expect(selection.unknownIds).toHaveLength(0);
    expect(selection.overridden).toBe(true);
  });

  it('activates a subset without dragging the rest along', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'feed:ktpress-rw');

    expect(selection.sources).toHaveLength(1);
    expect(selection.sources[0].sourceId).toBe('feed:ktpress-rw');
  });

  it('uses the REGISTRY entry verbatim — environment decides only enablement', () => {
    const [activated] = resolveActiveFeedSources(FEED_SOURCES, 'feed:ktpress-rw').sources;
    const shipped = FEED_SOURCES.find((source) => source.sourceId === 'feed:ktpress-rw');

    expect(activated).toEqual({ ...shipped, enabled: true });
    // No feed URL, host or identity can be introduced from configuration.
    expect(activated.feedUrl).toBe(shipped!.feedUrl);
    expect(activated.canonicalHost).toBe(shipped!.canonicalHost);
    expect(activated.verifiedAt).toBe(shipped!.verifiedAt);
  });

  it('accepts whitespace and newline separation, and de-duplicates', () => {
    const selection = resolveActiveFeedSources(
      FEED_SOURCES,
      ' feed:ktpress-rw \n feed:taarifa-rw, feed:ktpress-rw ',
    );

    expect(selection.sources.map((source) => source.sourceId)).toEqual([
      'feed:ktpress-rw',
      'feed:taarifa-rw',
    ]);
  });

  it('REPORTS an unrecognised id instead of silently ignoring it', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'feed:ktpress-rw,feed:typo-xx');

    expect(selection.sources).toHaveLength(1);
    expect(selection.unknownIds).toEqual(['feed:typo-xx']);
  });

  it('never falls back to another source when every id is unrecognised', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'nonsense');

    expect(selection.sources).toHaveLength(0);
    expect(selection.unknownIds).toEqual(['nonsense']);
    // Emphatically not "all of them".
    expect(selection.sources).not.toEqual(FEED_SOURCES);
  });

  it('has NO WILDCARD — "*" activates nothing', () => {
    /*
     * A wildcard would mean the next entry appended to this registry activates
     * itself in every environment already carrying the variable. Naming ids is
     * the point: six ids activate six sources, permanently.
     */
    for (const value of ['*', 'all', '"*"']) {
      const selection = resolveActiveFeedSources(FEED_SOURCES, value);

      expect(selection.sources).toHaveLength(0);
      expect(selection.unknownIds).toEqual([value]);
    }
  });

  it('leaves the SHIPPED registry entirely disabled regardless of the override', () => {
    resolveActiveFeedSources(FEED_SOURCES, SIX.join(','));

    // The override returns copies; it must never mutate the registry.
    expect(FEED_SOURCES.every((source) => source.enabled === false)).toBe(true);
    expect(getEnabledFeedSources()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */

describe('TWO GATES — the global flag and the source list are both required', () => {
  function providerWith(flag: string | undefined, sources: string | undefined): RssFeedProvider {
    return new RssFeedProvider({
      get: (key: string) =>
        key === 'RSS_FEEDS_ENABLED' ? flag : key === 'RSS_FEED_SOURCES' ? sources : undefined,
    } as unknown as ConfigService);
  }

  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => KTPRESS,
    } as never);
  });

  afterEach(() => fetchSpy.mockRestore());

  it('fetches nothing when the source list is set but the flag is not', async () => {
    expect(await providerWith(undefined, 'feed:ktpress-rw').topHeadlines()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches nothing when the flag is set but no source is named', async () => {
    expect(await providerWith('true', undefined).topHeadlines()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches only once BOTH gates are open', async () => {
    const articles = await providerWith('true', 'feed:ktpress-rw').topHeadlines();

    expect(articles.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(articles[0].sourceName).toBe('KT Press');
  });

  it('opens one gate per named publisher and fetches each exactly once', async () => {
    await providerWith('true', 'feed:ktpress-rw,feed:taarifa-rw').topHeadlines();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------------ */

describe('HEALTH TRUTHFULNESS after activation', () => {
  function providerWith(flag: string | undefined, sources: string | undefined): RssFeedProvider {
    return new RssFeedProvider({
      get: (key: string) =>
        key === 'RSS_FEEDS_ENABLED' ? flag : key === 'RSS_FEED_SOURCES' ? sources : undefined,
    } as unknown as ConfigService);
  }

  it('marks a switched-off lane as NOT ENABLED rather than claiming it failed', async () => {
    const health = await providerWith(undefined, undefined).health();

    expect(health.enabled).toBe(false);
    expect(health.message).toContain('switched off');
    /*
     * `status` is 'down' only because ProviderHealthState has no 'disabled'
     * member — ok, degraded, down. The honest signal is `enabled`, which the
     * contract documents as "distinct from health/reachability". Widening the
     * union is Main's lane and rendering the difference is H's; this test pins
     * that the data layer at least tells the truth.
     */
    expect(health.status).toBe('down');
  });

  it('OMITS counters that have never moved — UNKNOWN, not zero', async () => {
    const health = await providerWith('true', 'feed:ktpress-rw').health();

    expect(health.requestCount).toBeUndefined();
    expect(health.failureCount).toBeUndefined();
    expect(health.recordsRetrieved).toBeUndefined();
    expect(health.lastLatencyMs).toBeUndefined();
    expect(health.lastSuccessAt).toBeUndefined();
  });

  it('reports counters once the lane has actually served a request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => KTPRESS,
    } as never);

    const provider = providerWith('true', 'feed:ktpress-rw');

    await provider.topHeadlines();

    const health = await provider.health();

    expect(health.enabled).toBe(true);
    expect(health.status).toBe('ok');
    expect(health.requestCount).toBe(1);
    expect(health.failureCount).toBe(0);
    expect(health.recordsRetrieved).toBe(3);
    expect(typeof health.lastSuccessAt).toBe('string');

    fetchSpy.mockRestore();
  });

  it('says so plainly when the lane is on but no publisher is activated', async () => {
    const health = await providerWith('true', undefined).health();

    expect(health.enabled).toBe(true);
    expect(health.message).toContain('no feed source is activated');
  });

  it('surfaces an unrecognised id in the health message', async () => {
    const health = await providerWith('true', 'feed:typo-xx').health();

    expect(health.message).toContain('feed:typo-xx');
  });

  it('STILL performs no live probe, however many sources are active', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const provider = providerWith(
      'true',
      'feed:ktpress-rw,feed:taarifa-rw,feed:standardmedia-ke,feed:cbk-ke,feed:gus-pl,feed:wp-pl',
    );

    for (let i = 0; i < 10; i += 1) await provider.health();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */

describe('REGRESSIONS THE CONTRIBUTION HARNESS CAUGHT ON ITS FIRST ACTIVATED RUN', () => {
  function providerWith(sources: string): RssFeedProvider {
    return new RssFeedProvider({
      get: (key: string) =>
        key === 'RSS_FEEDS_ENABLED' ? 'true' : key === 'RSS_FEED_SOURCES' ? sources : undefined,
    } as unknown as ConfigService);
  }

  const SIX =
    'feed:ktpress-rw,feed:taarifa-rw,feed:standardmedia-ke,feed:cbk-ke,feed:gus-pl,feed:wp-pl';

  let fetchSpy: jest.SpyInstance;

  afterEach(() => fetchSpy?.mockRestore());

  /**
   * DEFECT 1 — a six-feed run reported TWELVE failures.
   *
   * `failureCount` was incremented both where the non-ok status was detected
   * and again where the resulting throw was caught, so the Admin screen would
   * have shown a 200% failure rate. One attempt can produce at most one
   * failure.
   */
  it('counts ONE failure per failed feed, not two', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 403, text: async () => '' } as never);

    const provider = providerWith(SIX);

    await provider.topHeadlines();

    const health = await provider.health();

    expect(health.requestCount).toBe(6);
    expect(health.failureCount).toBe(6);
    expect(health.failureCount).toBeLessThanOrEqual(health.requestCount!);
  });

  it('counts one failure per feed when the connection throws outright', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED') as never);

    const provider = providerWith(SIX);

    await provider.topHeadlines();

    const health = await provider.health();

    expect(health.requestCount).toBe(6);
    expect(health.failureCount).toBe(6);
  });

  /**
   * DEFECT 2 — the lane reported `ok` while every publisher had refused.
   *
   * `status` was computed from configuration alone, under a message that
   * claimed it reflected observed request outcomes. That is the same class of
   * untruth as labelling a disabled provider DOWN, pointed the other way.
   */
  it('reports DOWN when every feed fetch failed, not ok', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 403, text: async () => '' } as never);

    const provider = providerWith(SIX);

    await provider.topHeadlines();

    const health = await provider.health();

    expect(health.status).toBe('down');
    // Still enabled — "switched off" and "retrieving nothing" stay distinct.
    expect(health.enabled).toBe(true);
    expect(health.message).toContain('retrieving nothing');
  });

  it('reports DEGRADED when some publishers fail and others serve', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation((async (url: string) =>
        String(url).includes('ktpress.rw')
          ? { ok: true, status: 200, text: async () => KTPRESS }
          : { ok: false, status: 403, text: async () => '' }) as never);

    const provider = providerWith('feed:ktpress-rw,feed:taarifa-rw');

    const articles = await provider.topHeadlines();

    expect(articles.length).toBeGreaterThan(0);

    const health = await provider.health();

    expect(health.status).toBe('degraded');
    expect(health.failureCount).toBe(1);
    expect(health.requestCount).toBe(2);
    expect(health.message).toContain('1 of 2');
  });

  it('reports OK when every feed served', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, text: async () => KTPRESS } as never);

    const provider = providerWith('feed:ktpress-rw');

    await provider.topHeadlines();

    const health = await provider.health();

    expect(health.status).toBe('ok');
    expect(health.failureCount).toBe(0);
    expect(health.message).toContain('succeeded');
  });

  it('does not claim an outcome before any fetch has been attempted', async () => {
    const health = await providerWith(SIX).health();

    expect(health.status).toBe('ok');
    expect(health.message).toContain('No fetch has been attempted yet');
    expect(health.requestCount).toBeUndefined();
  });

  /**
   * One dead publisher must never fail the batch — the property the harness
   * run depended on when all six refused and the process still completed.
   */
  it('attempts every activated feed even when the first ones fail', async () => {
    const attempted: string[] = [];

    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      attempted.push(String(url));
      throw new Error('network down');
    }) as never);

    await providerWith(SIX).topHeadlines();

    expect(attempted).toHaveLength(6);
    expect(attempted.some((url) => url.includes('ktpress.rw'))).toBe(true);
    expect(attempted.some((url) => url.includes('wiadomosci.wp.pl'))).toBe(true);
  });
});
