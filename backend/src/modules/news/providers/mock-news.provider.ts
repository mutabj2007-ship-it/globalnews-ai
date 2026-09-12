import { Injectable, Logger } from '@nestjs/common';
import type { NewsArticle, NewsCategory, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { NewsProvider, NewsSearchOptions } from '../interfaces';

interface MockArticleSeed extends Omit<NewsArticle, 'publishedAt'> {
  /** Minutes before "now" this article was published, computed per-request. */
  publishedMinutesAgo: number;
}

const DEFAULT_LIMIT = 20;
const TOP_HEADLINES_DEFAULT_LIMIT = 12;

/**
 * MockNewsProvider is a stand-in for a real wire service. It implements
 * the full NewsProvider contract so the rest of the news module (and the
 * frontend consuming it) can be built and tested against a realistic
 * shape today, then swapped for Reuters/AP/BBC/NewsAPI/GDELT/Google News
 * providers later without any other code changing.
 *
 * All data here is clearly synthetic. Timestamps are computed relative
 * to the current request time so the demo stays visually "live".
 */
@Injectable()
export class MockNewsProvider implements NewsProvider {
  readonly id = 'mock-wire';
  readonly displayName = 'GlobalNews Mock Wire';
  readonly isMock = true;

  private readonly logger = new Logger(MockNewsProvider.name);

  private readonly seeds: MockArticleSeed[] = [
    {
      id: 'mock-markets-central-banks',
      title: 'Global markets steady after coordinated central bank statement',
      summary:
        'A joint statement from major central banks helped calm early volatility, with analysts pointing to aligned language on rates as the key reassurance for investors.',
      url: 'https://example.com/news/global-markets-steady',
      imageUrl: '/images/featured-global-markets.jpg',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'world',
      tag: 'breaking',
      sourcesCount: 32,
      publishedMinutesAgo: 18,
    },
    {
      id: 'mock-ai-open-source-model',
      title: 'Open-source model claims parity with frontier systems',
      summary:
        'Independent benchmarks are still rolling in, but early results have researchers taking notice of the new release.',
      url: 'https://example.com/news/open-source-model-parity',
      imageUrl: '/images/trending-ai-chip.jpg',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'technology',
      tag: 'trending',
      sourcesCount: 15,
      publishedMinutesAgo: 25,
    },
    {
      id: 'mock-trade-negotiators-reconvene',
      title: 'Trade negotiators reconvene after week-long recess',
      summary:
        'Delegations return to the table with a narrower set of sticking points and a firmer deadline.',
      url: 'https://example.com/news/trade-negotiators-reconvene',
      imageUrl: '/images/trending-trade-talks.jpg',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'world',
      sourcesCount: 31,
      publishedMinutesAgo: 60,
    },
    {
      id: 'mock-ocean-current-mapped',
      title: 'Researchers map a previously unknown ocean current system',
      summary:
        'The discovery could change long-standing models of how heat moves through the Pacific.',
      url: 'https://example.com/news/ocean-current-mapped',
      imageUrl: '/images/trending-ocean-current.jpg',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'science',
      sourcesCount: 9,
      publishedMinutesAgo: 120,
    },
    {
      id: 'mock-retail-holiday-season',
      title: 'Retailers report a split holiday season across price tiers',
      summary:
        'Discount chains outperform expectations while premium brands see softer foot traffic.',
      url: 'https://example.com/news/retail-holiday-season',
      imageUrl: '/images/trending-retail-season.jpg',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'business',
      sourcesCount: 21,
      publishedMinutesAgo: 180,
    },
    {
      id: 'mock-sleep-recovery-study',
      title: 'New study links sleep patterns to recovery times',
      summary:
        'Researchers found a stronger-than-expected correlation between deep sleep windows and injury recovery.',
      url: 'https://example.com/news/sleep-recovery-study',
      imageUrl: '/images/trending-sleep-health.jpg',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'health',
      sourcesCount: 7,
      publishedMinutesAgo: 240,
    },
    {
      id: 'mock-coastal-evacuation-drills',
      title: 'Coastal cities begin evacuation drills ahead of storm season',
      summary:
        'Local authorities are running coordinated readiness tests across five port cities this week.',
      url: 'https://example.com/news/coastal-evacuation-drills',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'world',
      sourcesCount: 14,
      publishedMinutesAgo: 5,
    },
    {
      id: 'mock-cloud-outage',
      title: 'Cloud providers report brief outage across two regions',
      summary:
        'Engineers traced the disruption to a routing configuration change; services have since been restored.',
      url: 'https://example.com/news/cloud-outage',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'technology',
      sourcesCount: 9,
      publishedMinutesAgo: 24,
    },
    {
      id: 'mock-currency-markets-steady',
      title: 'Currency markets steady after finance ministers\u2019 call',
      summary:
        'A joint statement followed this morning\u2019s scheduled coordination call between finance ministries.',
      url: 'https://example.com/news/currency-markets-steady',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'business',
      sourcesCount: 1,
      publishedMinutesAgo: 48,
    },
    {
      id: 'mock-cross-border-data-vote',
      title: 'Committee schedules vote on cross-border data proposal',
      summary:
        'The proposal has moved through two rounds of amendments since it was introduced last month.',
      url: 'https://example.com/news/cross-border-data-vote',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'politics',
      sourcesCount: 11,
      publishedMinutesAgo: 76,
    },
    {
      id: 'mock-telescope-early-galaxy',
      title: 'New telescope data adds detail to early-galaxy models',
      summary: 'Astronomers say the readings refine existing timelines rather than overturn them.',
      url: 'https://example.com/news/telescope-early-galaxy',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'science',
      sourcesCount: 6,
      publishedMinutesAgo: 101,
    },
    {
      id: 'mock-travel-guidance-alignment',
      title: 'Regional health agencies align on updated travel guidance',
      summary:
        'The revised guidance standardizes recommendations that previously varied by country.',
      url: 'https://example.com/news/travel-guidance-alignment',
      sourceId: 'mock-wire',
      sourceName: 'GlobalNews AI Desk',
      category: 'health',
      sourcesCount: 8,
      publishedMinutesAgo: 119,
    },
  ];

  async search(query: string, options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const limit = this.clampLimit(options?.limit);
    const tokens = this.tokenizeQuery(query);

    const matches = tokens.length
      ? this.getArticles().filter((article) => {
          const haystack = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
          return tokens.some((token) => haystack.includes(token));
        })
      : this.getArticles();

    this.logger.debug(`search("${query}") matched ${matches.length} article(s)`);
    return matches.slice(0, limit);
  }

  /**
   * Breaks a natural-language question ("What's happening in Ceuta?")
   * into meaningful search tokens: lowercased, punctuation stripped so
   * it can never break matching, common filler words removed, and
   * very short tokens discarded.
   */
  private tokenizeQuery(query: string): string[] {
    const STOP_WORDS = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'what',
      'whats',
      'when',
      'where',
      'who',
      'why',
      'how',
      'happening',
      'tell',
      'me',
      'about',
      'today',
      'latest',
      'news',
      'in',
      'on',
      'of',
      'to',
      'for',
      'and',
      'or',
      'with',
      'this',
      'that',
      'give',
      'show',
    ]);

    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  }

  async topHeadlines(options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const limit = this.clampLimit(options?.limit, TOP_HEADLINES_DEFAULT_LIMIT);
    // Returned in fixed editorial priority order (not strict recency),
    // which mirrors how real top-headlines endpoints typically behave.
    return this.getArticles().slice(0, limit);
  }

  async category(category: NewsCategory, options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const limit = this.clampLimit(options?.limit);
    return this.getArticles()
      .filter((article) => article.category === category)
      .slice(0, limit);
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      message: 'Mock provider operating normally. No external dependency.',
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Materializes the seed data into NewsArticle[] with fresh timestamps.
   *
   * E1 — provider provenance is stamped here rather than repeated on
   * every seed, so no seed can ever be added without it. The value is
   * this provider's real id ('mock-wire'), never a real provider's:
   * an article that came from the demo wire says so.
   *
   * providerRecordId is deliberately NOT set — the seeds have no
   * identifier distinct from their own `id`, and inventing one would
   * be a fabricated provenance claim.
   */
  private getArticles(): NewsArticle[] {
    const now = Date.now();
    return this.seeds.map(({ publishedMinutesAgo, ...seed }) => ({
      ...seed,
      providerId: this.id,
      publishedAt: new Date(now - publishedMinutesAgo * 60_000).toISOString(),
    }));
  }

  private clampLimit(requested: number | undefined, fallback = DEFAULT_LIMIT): number {
    if (!requested || requested < 1) return fallback;
    return Math.min(requested, this.seeds.length);
  }
}
