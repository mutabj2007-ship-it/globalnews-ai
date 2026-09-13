import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  FEED_SOURCES,
  REJECTED_FEED_CANDIDATES,
  resolveActiveFeedSources,
  getEnabledFeedSources,
} from './feed-source-registry';
import { isRssFeedsEnabled } from './rss-feed.provider';
import {
  CLASSIFIED_FEED_IDS,
  classifiedFeedSources,
  contributesJournalisticCorroboration,
  corroborationClassForFeed,
} from './feed-corroboration';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLISHER FEEDS — REGRESSION-PROTECTED LANE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS FILE EXISTS, AND IT IS NOT THE USUAL REASON.
 *
 * This lane was accepted, canonical and named in the Master Authority's own
 * regression-protected list — *"KT Press/Publisher Feeds behavior"* — and it
 * still vanished. Not by deletion: no commit anywhere removes it. The C907
 * Alpha candidate was created as an ORPHAN ROOT (`c9473e3` has no parents), and
 * an orphan re-root silently discards every lane the extracted tree did not
 * happen to contain. There is no diff, no conflict and no warning, which is
 * exactly why it went unnoticed across five candidates and was only found when
 * the Product Owner challenged a triage that had wrongly reported it absent.
 *
 * A LINEAGE CANNOT PROTECT ITSELF. Git could not raise this, because a root
 * commit has nothing to compare against. So the protection has to live INSIDE
 * the tree, where it travels with any snapshot of it: a test that fails loudly
 * the moment the lane is missing. If a future extraction drops these files
 * again, the suite goes red on the next run instead of the defect surviving to
 * production and being rediscovered by a Product Owner in a live session.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It asserts PRESENCE and IDENTITY, never
 * activation. Every feed ships disabled and this file proves that too — a
 * regression gate that quietly required a feed to be live would be a worse
 * defect than the one it guards against.
 */

const PROVIDERS_DIR = __dirname;
const FIXTURES_DIR = join(PROVIDERS_DIR, '__fixtures__');

describe('PUBLISHER FEEDS LANE — presence (guards against a silent orphan re-root omission)', () => {
  /**
   * The lane's own files. A missing entry here means the lane was dropped,
   * whatever else still compiles.
   */
  const REQUIRED_LANE_FILES = [
    'rss-feed.provider.ts',
    'feed-source-registry.ts',
    'parse-feed.util.ts',
    'syndicated-body.ts',
  ] as const;

  it.each(REQUIRED_LANE_FILES)('%s is present in the tree', (file) => {
    expect(existsSync(join(PROVIDERS_DIR, file))).toBe(true);
  });

  /**
   * The captured feeds are evidence, not test scaffolding: they are the
   * byte-accurate 2026-08-31 captures the registry's provenance notes refer to.
   * Losing them would make every provenance note unverifiable.
   */
  const REQUIRED_FIXTURES = [
    'ktpress-feed.sample.xml',
    'taarifa-feed.sample.xml',
    'gus-feed.sample.xml',
  ] as const;

  it.each(REQUIRED_FIXTURES)('the captured feed %s is retained', (fixture) => {
    const path = join(FIXTURES_DIR, fixture);

    expect(existsSync(path)).toBe(true);
    /* Non-empty and actually a feed — a zero-byte sweep at file granularity. */
    expect(readFileSync(path, 'utf8').length).toBeGreaterThan(500);
  });

  it('the provider is registered in NewsModule at the FALLBACK tier', () => {
    /*
      Read as source rather than by booting Nest: this asserts the REGISTRATION
      DECISION, which is a fact about the file, and it keeps the gate runnable
      without a DI container. The tier matters — at `primary` this provider
      would be called on every request worldwide while covering three countries.
    */
    const moduleSource = readFileSync(join(PROVIDERS_DIR, '..', 'news.module.ts'), 'utf8');

    expect(moduleSource).toContain('RssFeedProvider');
    expect(moduleSource).toContain('isRssFeedsEnabled');

    /*
      The window is generous on purpose. A 200-character slice passed for this
      entry and FAILED for GDELT DOC, whose own tier sits 317 characters after
      its provider line — a measurement artefact that would have read as a
      regression. The window is sized to the file, not to the shortest case.
    */
    const entry = moduleSource.slice(
      moduleSource.indexOf('provider: rssFeedProvider'),
      moduleSource.indexOf('provider: rssFeedProvider') + 400,
    );

    expect(entry).toContain("tier: 'fallback'");
    expect(entry).not.toContain("tier: 'primary'");
  });

  it('the existing tiers are untouched — GNews primary, GDELT DOC fallback', () => {
    /*
      The recovery must ADD a fallback provider, never re-tier an existing one.
      Both windows are sized past the inline commentary that separates each
      provider line from its own `tier:`.
    */
    const moduleSource = readFileSync(join(PROVIDERS_DIR, '..', 'news.module.ts'), 'utf8');

    expect(moduleSource).toMatch(/provider: gnewsProvider,[\s\S]{0,600}?tier: 'primary'/);
    expect(moduleSource).toMatch(/provider: gdeltDocProvider,[\s\S]{0,600}?tier: 'fallback'/);
  });

  it('the lane is shipped off in .env.example, both switches', () => {
    const env = readFileSync(join(PROVIDERS_DIR, '..', '..', '..', '..', '..', '.env.example'), 'utf8');

    expect(env).toContain('RSS_FEEDS_ENABLED=false');
    expect(env).toMatch(/^RSS_FEED_SOURCES=\s*$/m);
  });
});

describe('PUBLISHER FEEDS LANE — the six recovered publishers, by identity', () => {
  /**
   * Named individually and not merely counted. A count passes while the wrong
   * six publishers are present; these are the exact entries recovered from
   * canonical C55, and KT Press is named in the Master Authority itself.
   */
  const EXPECTED = [
    { sourceId: 'feed:ktpress-rw', country: 'RW', type: 'NEWS_PROVIDER' },
    { sourceId: 'feed:taarifa-rw', country: 'RW', type: 'NEWS_PROVIDER' },
    { sourceId: 'feed:standardmedia-ke', country: 'KE', type: 'NEWS_PROVIDER' },
    { sourceId: 'feed:cbk-ke', country: 'KE', type: 'OFFICIAL_SOURCE' },
    { sourceId: 'feed:gus-pl', country: 'PL', type: 'OFFICIAL_SOURCE' },
    { sourceId: 'feed:wp-pl', country: 'PL', type: 'NEWS_PROVIDER' },
  ] as const;

  it.each(EXPECTED)('$sourceId is present with its recovered identity', (expected) => {
    const entry = FEED_SOURCES.find((source) => source.sourceId === expected.sourceId);

    expect(entry).toBeDefined();
    expect(entry!.countryCode).toBe(expected.country);
    expect(entry!.sourceType).toBe(expected.type);
    expect(entry!.feedUrl.length).toBeGreaterThan(0);
    expect(entry!.canonicalHost.length).toBeGreaterThan(0);
    expect(entry!.verifiedAt).toBe('2026-08-31');
  });

  it('KT Press keeps its exact recovered feed URL', () => {
    /* Quoted in the Master Authority and in the recovery ruling. */
    const ktpress = FEED_SOURCES.find((source) => source.sourceId === 'feed:ktpress-rw');

    expect(ktpress!.feedUrl).toBe('https://www.ktpress.rw/feed/');
    expect(ktpress!.displayName).toBe('KT Press');
  });

  it('the registry has exactly these six and no silently added seventh', () => {
    expect(FEED_SOURCES.map((source) => source.sourceId).sort()).toEqual(
      EXPECTED.map((e) => e.sourceId).slice().sort(),
    );
  });

  it('the verified-and-rejected candidates are retained so they are not re-proposed', () => {
    /*
      The absence of Rwanda's largest outlets is a DOCUMENTED FINDING. Losing
      this list would turn it back into an apparent oversight and invite a
      re-proposal of feeds already proven dead.
    */
    expect(REJECTED_FEED_CANDIDATES.length).toBeGreaterThanOrEqual(7);
    expect(REJECTED_FEED_CANDIDATES.join(' ')).toContain('The New Times');
    expect(REJECTED_FEED_CANDIDATES.join(' ')).toContain('IGIHE');
  });
});

describe('PUBLISHER FEEDS LANE — ships disabled, and nothing can switch it on by accident', () => {
  it('every recovered entry ships enabled: false', () => {
    expect(FEED_SOURCES.every((source) => source.enabled === false)).toBe(true);
    expect(getEnabledFeedSources()).toHaveLength(0);
  });

  it('the master switch is fail-closed and strictly literal', () => {
    expect(isRssFeedsEnabled('true')).toBe(true);
    expect(isRssFeedsEnabled('TRUE')).toBe(true);
    expect(isRssFeedsEnabled(' true ')).toBe(true);

    /* Everything else is OFF — "1", "yes", "on" and a typo must not activate a lane. */
    for (const value of ['1', 'yes', 'on', 'TRUE!', 'false', '', '  ', undefined]) {
      expect(isRssFeedsEnabled(value)).toBe(false);
    }
  });

  it('per-feed activation is an explicit allowlist with NO wildcard', () => {
    /*
      A `*` would mean the next entry added to the registry activates itself in
      every environment that already carries the variable — a source going live
      because someone appended to an array.
    */
    expect(resolveActiveFeedSources(FEED_SOURCES, '*').sources).toHaveLength(0);
    expect(resolveActiveFeedSources(FEED_SOURCES, 'all').sources).toHaveLength(0);
    expect(resolveActiveFeedSources(FEED_SOURCES, '*').unknownIds).toEqual(['*']);
  });

  it('unset or blank means "use the shipped flags", which are all false', () => {
    expect(resolveActiveFeedSources(FEED_SOURCES, undefined).sources).toHaveLength(0);
    expect(resolveActiveFeedSources(FEED_SOURCES, '   ').sources).toHaveLength(0);
    expect(resolveActiveFeedSources(FEED_SOURCES, undefined).overridden).toBe(false);
  });

  it('a mistyped id activates nothing and is reported rather than swallowed', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'feed:ktpres-rw');

    expect(selection.sources).toHaveLength(0);
    expect(selection.unknownIds).toEqual(['feed:ktpres-rw']);
  });

  it('naming an id activates exactly that id, and only through `enabled`', () => {
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'feed:ktpress-rw');

    expect(selection.sources).toHaveLength(1);
    expect(selection.sources[0].sourceId).toBe('feed:ktpress-rw');
    expect(selection.sources[0].enabled).toBe(true);
    /* The environment can flip `enabled` and NOTHING else — no URL, no identity. */
    expect(selection.sources[0].feedUrl).toBe('https://www.ktpress.rw/feed/');
    expect(selection.sources[0].canonicalHost).toBe('ktpress.rw');
  });
});

describe('PUBLISHER FEEDS LANE — corroboration class is declared per feed, never inferred', () => {
  it('the four verified newsrooms are LOCAL_JOURNALISM', () => {
    for (const id of [
      'feed:ktpress-rw',
      'feed:taarifa-rw',
      'feed:standardmedia-ke',
      'feed:wp-pl',
    ]) {
      expect(corroborationClassForFeed(id)).toBe('LOCAL_JOURNALISM');
      expect(contributesJournalisticCorroboration(id)).toBe(true);
    }
  });

  it('CBK and Statistics Poland are OFFICIAL_PUBLIC and contribute NO journalistic corroboration', () => {
    /*
      A central bank's own release is one institution speaking about its OWN
      acts. Often better evidence than journalism — and precisely for that
      reason never a second, independent confirmation of it. Counting it as one
      would let an institution appear to corroborate itself.
    */
    for (const id of ['feed:cbk-ke', 'feed:gus-pl']) {
      expect(corroborationClassForFeed(id)).toBe('OFFICIAL_PUBLIC');
      expect(contributesJournalisticCorroboration(id)).toBe(false);
    }
  });

  it('every registry entry is classified, and nothing else is', () => {
    expect(classifiedFeedSources()).toHaveLength(FEED_SOURCES.length);
    expect(CLASSIFIED_FEED_IDS.slice().sort()).toEqual(
      FEED_SOURCES.map((source) => source.sourceId).sort(),
    );
  });
});

describe('NEGATIVE CONTROLS — R1 REV A, the defect this correction closes', () => {
  /*
    ══════════════════════════════════════════════════════════════════════════
    WHY THESE ARE THE MOST IMPORTANT ASSERTIONS IN THE FILE
    ══════════════════════════════════════════════════════════════════════════

    R1 derived the corroboration class from `SourceType`, mapping
    `NEWS_PROVIDER -> LOCAL_JOURNALISM`. The recovered C55 definition of that
    member reads, verbatim: "a news aggregator or wire API — GNews, GDELT DOC,
    Event Registry articles." So R1 classified two global aggregators as local
    newsrooms.

    The consequence was not theoretical. Wire copy reaches this pipeline through
    more than one aggregator; had aggregators counted as local journalism, one
    agency filing arriving via GNews and again via GDELT DOC would have read as
    two independent newsrooms confirming each other.

    These tests fail if that inference ever returns.
  */

  it("'gnews' cannot be classified as LOCAL_JOURNALISM through this contract", () => {
    expect(corroborationClassForFeed('gnews')).toBeUndefined();
    expect(contributesJournalisticCorroboration('gnews')).toBe(false);
  });

  it("'gdelt-doc' cannot be classified as LOCAL_JOURNALISM through this contract", () => {
    expect(corroborationClassForFeed('gdelt-doc')).toBeUndefined();
    expect(contributesJournalisticCorroboration('gdelt-doc')).toBe(false);
  });

  it('an UNKNOWN or FUTURE source cannot silently inherit LOCAL_JOURNALISM', () => {
    /*
      Fail-closed is the whole design: there is no rule in the authority that
      could be applied to a source nobody has assessed, so absence is the
      default and the six curated feeds are the exception.
    */
    for (const id of [
      'feed:not-yet-assessed',
      'event-registry',
      'mock-wire',
      'some-future-aggregator',
      '',
      undefined,
    ]) {
      expect(corroborationClassForFeed(id)).toBeUndefined();
      expect(contributesJournalisticCorroboration(id)).toBe(false);
    }
  });

  it('a slugified aggregator sourceId cannot collide with a curated feed id', () => {
    /*
      GNews sets sourceId by slugifying the publisher NAME and GDELT DOC by
      slugifying the DOMAIN, so an aggregator could in principle emit
      'kt-press' or 'ktpress-rw'. The registry namespaces every id with a
      'feed:' prefix precisely so it "cannot collide" — asserted here rather
      than trusted.
    */
    for (const slug of ['kt-press', 'ktpress-rw', 'ktpress', 'taarifa-rw', 'the-standard']) {
      expect(corroborationClassForFeed(slug)).toBeUndefined();
      expect(contributesJournalisticCorroboration(slug)).toBe(false);
    }

    expect(FEED_SOURCES.every((source) => source.sourceId.startsWith('feed:'))).toBe(true);
  });

  it('the predicate consumes FEED IDENTITY and no SourceType inference survives in shared', () => {
    /*
      The scope correction itself, asserted against the shipped bytes: `shared`
      carries the vocabulary and no function over it.
    */
    const sharedSource = readFileSync(
      join(PROVIDERS_DIR, '..', '..', '..', '..', '..', 'shared', 'src', 'source-type.ts'),
      'utf8',
    );

    expect(sharedSource).toContain('export type SourceType');
    expect(sharedSource).toContain('export type SourceCorroborationClass');
    expect(sharedSource).not.toContain('export function corroborationClassFor');
    expect(sharedSource).not.toContain('export function contributesJournalisticCorroboration');
  });
});

describe('PUBLISHER FEEDS LANE — registry country scope never becomes article geography', () => {
  it('the provider never writes countryCode, countryName or geographicPrecision', () => {
    /*
      C907 REV B PRECISION RULE, ASSERTED AGAINST THE SHIPPED BYTES.

      "Registry country scope may constrain retrieval but must not be written
       into article evidence geography unless supported by the article itself.
       Do not make feed country = event country."

      A Rwandan outlet reporting on Congo is a Congo story. The registry's
      `countryCode` is a fact about the PUBLISHER, and letting it reach an
      article's geography would be exactly the borrowed precision Rev B's
      producer was restored to prevent.

      Comment-stripped, because the provider discusses its own country handling
      at length in order to say it never writes it — and a guard that could not
      tell prose from code would forbid the file explaining itself.
    */
    const source = readFileSync(join(PROVIDERS_DIR, 'rss-feed.provider.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).not.toMatch(/\bcountryCode\s*:/);
    expect(source).not.toMatch(/\bcountryName\s*:/);
    expect(source).not.toMatch(/\bgeographicPrecision\s*:/);
  });

  it('the registry country is used for retrieval scope only', () => {
    /* It reads `source.countryCode` to decide relevance of a query, and that is all. */
    const source = readFileSync(join(PROVIDERS_DIR, 'rss-feed.provider.ts'), 'utf8');

    expect(source).toContain('isOwnCountryQuery');
    expect(source).toContain('source.countryCode');
  });

  it('publisher identity comes from the registry, never from the connector', () => {
    /*
      "RSS is the transport, not the publisher." If the connector stamped its own
      id, distinct-publisher counts would collapse to one and cross-provider
      dedup would stop recognising the same story arriving twice.
    */
    const source = readFileSync(join(PROVIDERS_DIR, 'rss-feed.provider.ts'), 'utf8');

    expect(source).toContain('sourceId: source.sourceId');
    expect(source).toContain('sourceName: source.displayName');
  });
});
