import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewsArticle, NewsCategory, ProviderHealthStatus } from '@globalnews-ai/shared';
import { findCountryByIso2 } from '@globalnews-ai/shared';
import { logWithRequestId } from '../../../observability/log-with-request-id';
import type { NewsProvider, NewsProviderCapability, NewsSearchOptions } from '../interfaces';
import { attachSyndicatedBody } from './syndicated-body';
import { classifyCategory } from '../classification/classify-category.util';
import { parseFeed, type ParsedFeedItem } from './parse-feed.util';
import {
  FEED_SOURCES,
  resolveActiveFeedSources,
  type ActiveFeedSelection,
  type FeedSourceEntry,
} from './feed-source-registry';

/**
 * S1 — A GENERIC RSS/ATOM CONNECTOR OVER A CURATED PUBLISHER REGISTRY.
 *
 * THE RULE THAT SHAPES EVERYTHING HERE: **RSS is the transport, not the
 * publisher.** One provider fetches many feeds, but every article it emits
 * carries the identity of the PUBLISHER that wrote it — `sourceId` and
 * `sourceName` come from the registry entry, and `url` is the publisher's own
 * article URL.
 *
 * That is not cosmetic. Downstream, `url` drives the dedup identity ladder, the
 * registrable-domain publisher identity, and the ccTLD local-publisher
 * attribution. Had this provider stamped its own id onto every record, all six
 * publishers would have counted as one source, no article would have resolved
 * as locally published, and cross-provider dedup would have stopped seeing the
 * same story arriving from two places. The connector is plumbing; the publisher
 * is the source.
 *
 * NO PARALLEL PIPELINE. Articles are ordinary `NewsArticle` values and flow
 * through the same normalization, canonicalization, dedup, clustering,
 * provenance and Analysis admission as GNews and GDELT DOC. Nothing here scores
 * relevance, and nothing here decides evidence.
 *
 * OFF BY DEFAULT, twice over: the provider is only configured when
 * `RSS_FEEDS_ENABLED` is the exact literal "true", and each registry entry
 * additionally carries its own `enabled` flag. Landing this code changes no
 * deployment's behaviour.
 */

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ITEMS_PER_FEED = 25;

/**
 * Health does NOT probe. Publisher feeds are somebody else's bandwidth, and an
 * Admin page load must never fan out a request to six newsrooms — the same
 * lesson GNews's health cache exists for, applied before it can become a
 * defect. Health reports observed counters only.
 */
export function isRssFeedsEnabled(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

@Injectable()
export class RssFeedProvider implements NewsProvider {
  readonly id = 'rss-feeds';
  readonly displayName = 'Publisher Feeds';
  readonly isMock = false;

  /**
   * A feed is a publisher's latest output, not a search index. `category` is
   * not supported and is declared as such rather than faked — the registry has
   * feed-level topics, not the product's category taxonomy.
   */
  readonly capabilities: readonly NewsProviderCapability[] = ['search', 'top-headlines'];

  private readonly logger = new Logger(RssFeedProvider.name);

  private requestCount = 0;
  private failureCount = 0;
  private lastLatencyMs: number | undefined;
  private lastSuccessAt: string | undefined;
  private lastRecordsRetrieved: number | undefined;
  private droppedItemCount = 0;
  private warnedUnknownIds = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * TWO GATES, BOTH REQUIRED. The global flag decides whether this lane runs at
   * all; `RSS_FEED_SOURCES` decides which publishers it may fetch. Setting the
   * flag alone activates nothing, because the shipped registry is entirely off
   * — turning the lane on is a deliberate two-part act, not a single switch
   * someone can flip by accident.
   */
  private selection(): ActiveFeedSelection {
    if (!isRssFeedsEnabled(this.config.get<string>('RSS_FEEDS_ENABLED'))) {
      return { sources: [], unknownIds: [], overridden: false };
    }

    return resolveActiveFeedSources(FEED_SOURCES, this.config.get<string>('RSS_FEED_SOURCES'));
  }

  private enabledSources(): readonly FeedSourceEntry[] {
    const selection = this.selection();

    if (selection.unknownIds.length > 0 && !this.warnedUnknownIds) {
      this.warnedUnknownIds = true;
      logWithRequestId(
        this.logger,
        'warn',
        `RSS_FEED_SOURCES names ${selection.unknownIds.length} id(s) that are not in the feed ` +
          `registry and were ignored: ${selection.unknownIds.join(', ')}. ` +
          'A mistyped id activates nothing; it does not fall back to another source.',
      );
    }

    return selection.sources;
  }

  async topHeadlines(options?: NewsSearchOptions): Promise<NewsArticle[]> {
    return this.collect(undefined, options);
  }

  /**
   * A feed cannot be queried, so the query is applied as a LOCAL FILTER over
   * what the publisher just published — a substring match on title and summary.
   *
   * This is deliberately not dressed up as search. It is honest about what it
   * is: the connector fetched the publisher's latest items and kept the ones
   * mentioning the term. Real relevance is decided downstream by the same
   * unmodified gates every other provider's results pass through.
   */
  async search(query: string, options?: NewsSearchOptions): Promise<NewsArticle[]> {
    return this.collect(query, options);
  }

  async category(): Promise<NewsArticle[]> {
    throw new Error(
      'RssFeedProvider does not support category browsing. Declare it via capabilities.',
    );
  }

  /**
   * C2 - IS THIS QUERY ASKING THIS PUBLISHER ABOUT ITS OWN COUNTRY?
   *
   * THE DEFECT THIS EXISTS TO FIX. CountryNewsService searches for the literal
   * country name, and this lane, having no search index, answered by
   * substring-matching its own items. So a Rwandan paper writing for Rwandan
   * readers - which is to say, not naming Rwanda - was never OFFERED to the
   * relevance scorer at all. Measured on the real KT Press capture: one of
   * three genuine Rwandan stories was dropped here, before anything could
   * judge it.
   *
   * That is the Alpha complaint one layer earlier than we fixed it. A publisher
   * verified as serving a country is a legitimate candidate source for a
   * question about that country; whether any particular story is RELEVANT
   * remains entirely the scorer's decision, downstream, unchanged.
   *
   * DELIBERATELY NARROW:
   *   - matches only the registered country's own name or its ISO code, from
   *     the shared country catalogue - never a demonym, never a keyword, never
   *     a guess;
   *   - applies per source, so a Rwanda query relaxes nothing for the Kenyan or
   *     Polish feeds;
   *   - admits NOTHING. It widens the candidate pool this lane offers. Every
   *     record still faces the unchanged relevance gate at the unchanged
   *     threshold, and a local story that is not about its own country is
   *     rejected there exactly as any other record would be.
   */
  private isOwnCountryQuery(query: string, source: FeedSourceEntry): boolean {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) return false;

    const iso2 = source.countryCode.trim().toLowerCase();

    if (needle === iso2) return true;

    const country = findCountryByIso2(source.countryCode);

    if (!country) return false;

    if (needle === country.iso3.toLowerCase()) return true;

    /*
     * `includes`, not equality, because CountryNewsService builds a city-scoped
     * term as `${city} ${country.name}` - "Kigali Rwanda" is still a Rwanda
     * question. Guarded by a word boundary so "Chad" cannot match inside
     * another word.
     */
    const name = country.name.toLowerCase();

    return new RegExp(`(^|\\W)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(needle);
  }

  private async collect(
    query: string | undefined,
    options?: NewsSearchOptions,
  ): Promise<NewsArticle[]> {
    const sources = this.enabledSources();

    if (sources.length === 0) return [];

    const limit = options?.limit ?? MAX_ITEMS_PER_FEED;
    const collected: NewsArticle[] = [];

    /*
     * Feeds are fetched in PARALLEL because they are six different hosts —
     * unlike a single rate-limited API, they do not queue behind one another.
     * One failing publisher never fails the batch: its error is counted and the
     * others still contribute.
     */
    const results = await Promise.all(
      sources.map(async (source) => {
        try {
          return { source, articles: await this.fetchSource(source) };
        } catch (error) {
          this.failureCount += 1;
          logWithRequestId(
            this.logger,
            'warn',
            `Feed fetch failed for ${source.displayName} (${source.feedUrl}); continuing without it`,
            error instanceof Error ? error : undefined,
          );
          return { source, articles: [] as NewsArticle[] };
        }
      }),
    );

    const needle = query?.trim().toLowerCase();

    /*
     * C2 - THE TERM FILTER IS NOW DECIDED PER PUBLISHER, NOT OVER THE MERGED
     * POOL, because whether a term is a "search" depends on who is being asked.
     *
     *   own-country query  -> this publisher's recent items are all offered,
     *                         because a paper that serves this country is a
     *                         legitimate candidate source for a question about
     *                         it. Relevance is still decided downstream.
     *   any other query    -> the previous substring behaviour, unchanged.
     *   no query           -> topHeadlines, unchanged.
     *
     * Deciding per source is what keeps a Rwanda question from relaxing
     * anything for the Kenyan or Polish feeds.
     */
    for (const { source, articles } of results) {
      if (!needle) {
        collected.push(...articles);
        continue;
      }

      if (this.isOwnCountryQuery(needle, source)) {
        logWithRequestId(
          this.logger,
          'debug',
          `${source.displayName}: "${needle}" is this publisher's own country; ` +
            `offering ${articles.length} recent record(s) for downstream relevance scoring.`,
        );
        collected.push(...articles);
        continue;
      }

      collected.push(
        ...articles.filter(
          (article) =>
            article.title.toLowerCase().includes(needle) ||
            article.summary.toLowerCase().includes(needle),
        ),
      );
    }

    this.lastRecordsRetrieved = collected.length;

    return collected.slice(0, limit);
  }

  private async fetchSource(source: FeedSourceEntry): Promise<NewsArticle[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    this.requestCount += 1;
    const startedAt = Date.now();

    let body: string;

    try {
      const response = await fetch(source.feedUrl, { signal: controller.signal });

      this.lastLatencyMs = Date.now() - startedAt;

      if (!response.ok) {
        /*
         * COUNTED ONCE, IN ONE PLACE. This throw is caught by `collect`, which
         * is what increments `failureCount` — incrementing here as well made a
         * six-feed run report twelve failures, a 200% failure rate that the
         * harness caught on its first activated run. One attempt, at most one
         * failure.
         */
        throw new Error(`${source.displayName} feed responded with status ${response.status}.`);
      }

      body = await response.text();
      this.lastSuccessAt = new Date().toISOString();
    } finally {
      clearTimeout(timeout);
    }

    const parsed = parseFeed(body);
    this.droppedItemCount += parsed.droppedItemCount;

    if (parsed.droppedItemCount > 0) {
      logWithRequestId(
        this.logger,
        'debug',
        `${source.displayName}: dropped ${parsed.droppedItemCount} unusable item(s) — ` +
          'an item without a title or link cannot be normalized honestly.',
      );
    }

    const articles: NewsArticle[] = [];

    for (const item of parsed.items.slice(0, MAX_ITEMS_PER_FEED)) {
      const article = this.toArticle(item, source);

      if (article) articles.push(article);
    }

    return articles;
  }

  /**
   * Maps one feed item onto the shared article record.
   *
   * DROPS RATHER THAN GUESSES, matching GdeltDocProvider: an unparseable date
   * or a link that does not belong to the registered publisher is discarded,
   * never patched with a substitute.
   */
  private toArticle(item: ParsedFeedItem, source: FeedSourceEntry): NewsArticle | null {
    const publishedAt = this.parsePublishedAt(item.publishedAt);

    if (publishedAt === null) return null;

    /*
     * THE LINK MUST BELONG TO THE REGISTERED PUBLISHER.
     *
     * A feed that begins carrying third-party links — an aggregator block, a
     * syndication partner, a compromised endpoint — must not launder those
     * records into this publisher's verified identity, which downstream treats
     * as evidence of locality and, for an OFFICIAL_SOURCE, of institutional
     * authority. Host mismatch is dropped.
     */
    if (!this.belongsToPublisher(item.link, source)) {
      logWithRequestId(
        this.logger,
        'debug',
        `${source.displayName}: dropped an item whose link host is not ${source.canonicalHost}.`,
      );
      return null;
    }

    /*
     * THE LARGEST LAWFUL EVIDENCE-DEPTH GAIN AVAILABLE, AND ITS LIMITS.
     *
     * When the publisher syndicated a body in <content:encoded>, the article
     * carries whichever of body and description is longer, plus a record of
     * WHICH it was. Nothing is fetched from the publisher's site.
     *
     * MEASURED ON THE CAPTURED FEEDS, AND HONESTLY: Taarifa syndicates a body of
     * 289 and 240 characters against descriptions of 349 and 362 - so for these
     * publishers content:encoded is NOT a depth win. What it is is a PROVENANCE
     * win: we can now say that text is the publisher's own article body rather
     * than a feed blurb, which is what lets the evidence assessment stop treating
     * the two as interchangeable. KT Press and GUS syndicate no body at all.
     */
    const syndicated = item.syndicatedBody ?? '';
    const evidenceText = syndicated.length > item.summary.length ? syndicated : item.summary;

    return attachSyndicatedBody(
      {
        id: this.buildStableId(item.link),
        title: item.title,
        // Whatever the feed supplied, plain-texted. Empty stays empty — no
        // summary is ever synthesized from the title.
        summary: evidenceText,
        url: item.link,
        // PUBLISHER IDENTITY, from the registry — never this connector's own id.
        sourceId: source.sourceId,
        sourceName: source.displayName,
        category: classifyCategory({ title: item.title, summary: evidenceText }) as NewsCategory,
        sourcesCount: 1,
        publishedAt,
        /*
         * A feed's pubDate is the PUBLISHER'S OWN assertion of when it ran —
         * unlike GDELT's seendate, which is when an aggregator observed it. This
         * is the honest 'publisher' basis, and it is what makes the strict
         * identity ladder's corroborated tier reachable for these records.
         */
        publishedAtBasis: 'publisher' as const,
        providerId: this.id,
        sourceLanguage: source.language,
      } as NewsArticle,
      {
        /*
         * PUBLISHER ATTRIBUTION, ORIGINAL URL, LANGUAGE, TIMESTAMP AND SOURCE
         * IDENTITY ARE ALL PRESERVED ABOVE - sourceId and sourceName come from the
         * registry, url is the publisher's own link, sourceLanguage is the
         * registry's declared language, and publishedAt carries the publisher's own
         * pubDate on the 'publisher' basis. The body provenance travels alongside
         * them rather than replacing any of them.
         */
        text: item.syndicatedBody,
        source: item.bodySource,
      },
    );
  }

  private belongsToPublisher(link: string, source: FeedSourceEntry): boolean {
    try {
      const host = new URL(link).hostname.toLowerCase().replace(/^www\./, '');
      const canonical = source.canonicalHost.toLowerCase().replace(/^www\./, '');

      return host === canonical || host.endsWith(`.${canonical}`);
    } catch {
      return false;
    }
  }

  private parsePublishedAt(raw: string | undefined): string | null {
    if (!raw) return null;

    const parsed = Date.parse(raw);

    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  private buildStableId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i += 1) {
      hash = (hash * 31 + url.charCodeAt(i)) | 0;
    }
    return `rss-${Math.abs(hash)}`;
  }

  /**
   * NO LIVE PROBE, BY DESIGN. Reports what was observed while serving real
   * requests. An Admin page load must not fan out fetches to six newsrooms, and
   * a counter that has never moved stays absent so it renders as UNKNOWN rather
   * than as a fabricated zero.
   */
  /**
   * THE MESSAGE SAYS "reflects observed request outcomes" — SO IT MUST.
   *
   * Computing this from configuration alone let the lane report `ok` while
   * every one of its six publishers had just refused the connection, which is
   * the same class of untruth as labelling a disabled provider DOWN, only
   * pointed the other way. It now reads what actually happened:
   *
   *   never ran        ok        nothing has been observed to be wrong
   *   all attempts ok  ok
   *   some failed      degraded  the lane works; a publisher did not
   *   all failed       down      the lane retrieved nothing from anyone
   */
  private observedStatus(enabled: boolean, activeCount: number): ProviderHealthStatus['status'] {
    if (!enabled || activeCount === 0) return 'down';

    if (this.requestCount === 0) return 'ok';

    if (this.failureCount >= this.requestCount) return 'down';

    return this.failureCount > 0 ? 'degraded' : 'ok';
  }

  /**
   * A STATUS WITHOUT ITS REASON IS HALF A REPORT. When the lane reads down or
   * degraded, the message says which observation produced that, so nobody has
   * to open a log to learn whether the lane is misconfigured or the publishers
   * are simply refusing.
   */
  private activeMessage(activeCount: number): string {
    const base = `${activeCount} publisher feed(s) active.`;

    if (this.requestCount === 0) {
      return `${base} No fetch has been attempted yet; status reflects observed outcomes, not a live probe.`;
    }

    if (this.failureCount >= this.requestCount) {
      return `${base} Every one of the last ${this.requestCount} feed fetch(es) failed; this lane is retrieving nothing.`;
    }

    if (this.failureCount > 0) {
      return `${base} ${this.failureCount} of ${this.requestCount} feed fetch(es) failed; the lane is serving from the rest.`;
    }

    return `${base} All ${this.requestCount} feed fetch(es) succeeded. Status reflects observed outcomes, not a live probe.`;
  }

  /**
   * Which OFFICIAL-SOURCE hosts this lane is currently ingesting, as
   * `canonical host -> feed sourceId`.
   *
   * Two of the verified feeds are institutions the official-source registry
   * also lists. Those registry entries carry `ingestionMethod: 'none'` and
   * their health message said "it is not a retrieval source" — true until this
   * lane was activated, false the moment it was. This is how the official lane
   * learns what is actually happening without either lane guessing about the
   * other, and it reports only what is active right now.
   */
  officialSourceHostsInUse(): Record<string, string> {
    const byHost: Record<string, string> = {};

    for (const source of this.selection().sources) {
      if (source.sourceType !== 'OFFICIAL_SOURCE') continue;

      byHost[source.canonicalHost.toLowerCase().replace(/^www\./, '')] = source.sourceId;
    }

    return byHost;
  }

  async health(): Promise<ProviderHealthStatus> {
    const enabled = isRssFeedsEnabled(this.config.get<string>('RSS_FEEDS_ENABLED'));
    const selection = this.selection();
    const activeCount = selection.sources.length;

    /*
     * DELIBERATELY OFF IS NOT THE SAME CONDITION AS BROKEN — and the shared
     * `ProviderHealthState` union still has no member that says so. It has ok,
     * degraded and down, so a switched-off lane and an unreachable one both
     * land on 'down'.
     *
     * The same reasoning as G-ALPHA-1 D3 applies here, and so does the same
     * resolution: `status` keeps the value it already had, so no consumer
     * changes behaviour, and `enabled` — which the contract declares as
     * "distinct from health/reachability" — carries the truth. A reader that
     * wants the difference can find it.
     *
     * Adding a 'disabled' member is a change to the shared contract, which is
     * Main's lane, and rendering it is H's. Reported, not reached into.
     */
    const message = !enabled
      ? 'RSS_FEEDS_ENABLED is not set to "true". This provider is switched off.'
      : activeCount === 0
        ? selection.overridden
          ? 'RSS_FEED_SOURCES named no id that matches the feed registry. No publisher is being fetched.'
          : 'The lane is enabled but no feed source is activated. Set RSS_FEED_SOURCES to activate specific publishers.'
        : this.activeMessage(activeCount);

    const base: ProviderHealthStatus = {
      providerId: this.id,
      displayName: this.displayName,
      enabled,
      status: this.observedStatus(enabled, activeCount),
      message:
        selection.unknownIds.length > 0
          ? `${message} Ignored unrecognised id(s): ${selection.unknownIds.join(', ')}.`
          : message,
      checkedAt: new Date().toISOString(),
    };

    /*
     * A COUNTER THAT HAS NEVER MOVED IS UNKNOWN, NOT ZERO. Emitting
     * requestCount: 0 would tell the Admin screen "this lane ran and did
     * nothing", which is a different and false claim from "this lane has not
     * run". Omitted fields render as UNKNOWN; a fabricated zero would not.
     */
    if (this.requestCount === 0) return base;

    return {
      ...base,
      requestCount: this.requestCount,
      failureCount: this.failureCount,
      ...(this.lastLatencyMs !== undefined ? { lastLatencyMs: this.lastLatencyMs } : {}),
      ...(this.lastSuccessAt !== undefined ? { lastSuccessAt: this.lastSuccessAt } : {}),
      ...(this.lastRecordsRetrieved !== undefined
        ? { recordsRetrieved: this.lastRecordsRetrieved }
        : {}),
    };
  }
}
