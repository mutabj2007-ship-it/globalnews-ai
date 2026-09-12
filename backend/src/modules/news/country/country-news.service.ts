import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveCountryByAnyIdentifier,
  type CountryMeta,
  type CountryNewsResponse,
  type LanguageCode,
  type NewsArticle,
  type NewsCategory,
  type NewsDataMode,
  type NewsFeedTier,
} from '@globalnews-ai/shared';
import { NewsService } from '../news.service';
import { scoreArticleConfidence } from '../analysis/article-confidence.util';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { deduplicateArticles } from './deduplicate-articles.util';
import {
  articleMentionsCity,
  resolvePrimaryCountry,
  scoreCountryRelevance,
} from './country-relevance.util';
import { assessCountryDevelopment } from './country-development-eligibility.util';

interface CacheEntry {
  value: CountryNewsResponse;
  expiresAt: number;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_CACHE_TTL_SECONDS = 300;
const DATABASE_FALLBACK_MAX_AGE_MINUTES = 1440;

/**
 * G-SEARCH-QUALITY-POST-AUTH-PREP-1 (B).
 *
 * True only when the article itself positively resolves to a country OTHER
 * than the one the reader asked about. Undefined — a tie, or no country
 * evidence at all — is NOT a different country, and returns false.
 *
 * Compares ISO 3166-1 alpha-2 on both sides: PrimaryCountryResult.countryCode
 * is alpha-2 and CountryMeta.iso2 is alpha-2. Comparing it against iso3 would
 * make this predicate true for every article and empty every country feed,
 * which is exactly the kind of silent catastrophe the test below exists to
 * catch.
 */
function resolvesToADifferentCountry(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  country: CountryMeta,
): boolean {
  const primary = resolvePrimaryCountry(article);

  return primary !== undefined && primary.countryCode !== country.iso2;
}

@Injectable()
export class CountryNewsService {
  private readonly logger = new Logger(CountryNewsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly newsService: NewsService,
    private readonly config: ConfigService,
    private readonly articlePersistence: ArticlePersistenceService,
  ) {}

  /**
   * Milestone #49 (World Map EN/PL integration) — `lang` is new and
   * optional, added as a 5th parameter after the existing `city`. Every
   * pre-existing caller (none currently pass a 5th argument) continues
   * to behave exactly as before, with `lang` left `undefined`.
   *
   * Milestone #49 Phase C (country map language containment) — root
   * cause, confirmed from real runtime evidence: this method had TWO
   * cache-fallback trigger points (the live-call catch block, and the
   * "zero results after filtering" branch) that BOTH called
   * getStoredArticles() unconditionally, regardless of whether `lang`
   * was requested. getStoredArticles() draws from
   * ArticlePersistenceService's persisted pool, which — exactly like
   * the Milestone #48 Phase A root cause for the homepage — has no
   * reliable per-article language metadata (persistMany() never wrote
   * sourceLanguage). A Polish-constrained request whose live call
   * failed was therefore silently served this language-unverified
   * cached pool, which in practice contained the same English articles
   * as the English request.
   *
   * Fix, applied at this country-specific boundary only (NOT inside
   * NewsService.search() or GNewsProvider.search(), both left
   * completely unchanged):
   *   1. When `lang` is set, BOTH cache-fallback trigger points are
   *      skipped entirely — a language-constrained request that can't
   *      get a verified-language live result returns the safe
   *      "unavailable" state instead of guessing.
   *   2. When `lang` is set, LIVE results are filtered to only articles
   *      whose own `sourceLanguage` matches — mirroring the exact
   *      Milestone #48 Phase C policy for topHeadlines(), including
   *      discarding articles with no reported language at all (treated
   *      as unconfirmed, not assumed to match).
   * A caller with no `lang` (none currently exists, but the method
   * doesn't forbid it) retains the original fallback behavior,
   * completely unchanged.
   */
  async getCountryNews(
    countryIdentifier: string,
    category?: NewsCategory,
    limit?: number,
    city?: string,
    lang?: string,
  ): Promise<CountryNewsResponse> {
    const resolvedLimit = this.clampLimit(limit);
    const country = resolveCountryByAnyIdentifier(countryIdentifier);

    if (!country) {
      this.logger.debug(`Could not resolve country identifier "${countryIdentifier}"`);

      throw new BadRequestException(`Unknown country identifier: "${countryIdentifier}"`);
    }

    // Milestone #49: `lang` is folded into the existing cache key so an
    // English response can never be silently reused after the user
    // switches to Polish, or vice versa. An unset `lang` uses 'en' as
    // its key segment, matching the de facto behavior every existing
    // caller already had — this does not change caching behavior for
    // any caller that never passes `lang`.
    const cacheKey = `${country.iso3}:${category ?? 'all'}:${resolvedLimit}:${city ?? 'all'}:${lang ?? 'en'}`;
    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug(`Serving cached country news for ${country.iso3}`);

      return cached;
    }

    const fetchLimit = Math.max(resolvedLimit * 2, 20);

    let searchResponse;

    try {
      searchResponse = await this.newsService.search(
        this.buildSearchTerm(country, city),
        fetchLimit,
        undefined,
        lang ? { lang } : undefined,
      );
    } catch (error) {
      this.logger.warn(
        `Live country news provider failed for ${country.iso3}; attempting database fallback`,
        error instanceof Error ? error : undefined,
      );

      // Milestone #49 Phase C: a language-constrained request never
      // falls back to the language-unverified stored pool — see this
      // method's own doc comment above for the verified root cause.
      // Returns a clean, structured "unavailable" response (matching
      // the equivalent bounded.length===0 branch below) rather than
      // re-throwing, so this safe behavior doesn't depend on whatever
      // upstream error handling may or may not gracefully format an
      // uncaught exception.
      if (lang) {
        const emptyResponse: CountryNewsResponse = {
          countryCode: country.iso3,
          countryName: country.name,
          articles: [],
          totalResults: 0,
          providers: [],
          dataMode: 'unavailable',
          feedTier: 'delayed',
          providerDisplayName: 'Unavailable',
          fallbackReason: 'provider-error',
          category,
          ...(city ? { city } : {}),
          generatedAt: new Date().toISOString(),
        };

        this.setCached(cacheKey, emptyResponse);

        return emptyResponse;
      }

      const storedArticles = await this.getStoredArticles(country, category, resolvedLimit, city);

      if (storedArticles.length > 0) {
        const response: CountryNewsResponse = {
          countryCode: country.iso3,
          countryName: country.name,
          articles: storedArticles,
          totalResults: storedArticles.length,
          providers: [],
          dataMode: 'cached',
          feedTier: 'delayed',
          providerDisplayName: 'Stored reporting',
          fallbackReason: 'provider-error',
          newestArticlePublishedAt: this.getNewestArticlePublishedAt(storedArticles),
          category,
          ...(city ? { city } : {}),
          generatedAt: new Date().toISOString(),
        };

        this.setCached(cacheKey, response);

        return response;
      }

      throw error;
    }

    // Milestone #49 Phase C: when a specific language was requested,
    // only articles whose OWN sourceLanguage matches survive — an
    // article with no reported language is discarded too, since there
    // is no way to confirm it matches the request. Applied before
    // relevance scoring/sorting so every downstream step (persistence,
    // category filtering, dedup) already operates on a language-pure
    // set.
    const languageFilteredArticles = lang
      ? searchResponse.articles.filter((article) => article.sourceLanguage === lang)
      : searchResponse.articles;

    const scoredEntries = languageFilteredArticles
      .map((article) => ({
        article,
        // Milestone #50 Phase C: `lang` is already validated upstream
        // (TopHeadlinesQueryDto's @IsIn check) to only ever be a real
        // LanguageCode when present — this cast reflects that existing
        // guarantee, not a new assumption.
        relevance: scoreCountryRelevance(article, country, lang as LanguageCode | undefined),
        matchesCity: city ? articleMentionsCity(article, city) : false,
      }))
      .sort((left, right) => {
        if (left.matchesCity !== right.matchesCity) {
          return left.matchesCity ? -1 : 1;
        }

        const scoreDifference = right.relevance.score - left.relevance.score;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const rightPublishedAt = Date.parse(right.article.publishedAt);

        const leftPublishedAt = Date.parse(left.article.publishedAt);

        return rightPublishedAt - leftPublishedAt;
      });

    if (searchResponse.dataMode === 'live') {
      await this.articlePersistence.persistCountryRelations(
        scoredEntries.map(({ article, relevance }) => ({
          articleId: article.id,
          countryCode: country.iso3,
          countryName: country.name,
          relevanceScore: relevance.score,
          isRelevant: relevance.isRelevant,
        })),
      );
    }

    // Milestone #50 Phase B (country relevance enforcement) — root
    // cause, confirmed in Phase A: scoredEntries was sorted by
    // relevance but never FILTERED by it, so when a country had fewer
    // genuinely relevant live results than the requested limit, the
    // response was silently padded with score-0/isRelevant:false
    // entries purely to fill the count (the exact reported "Canada
    // FIFA"/"ITC Infotech" articles appearing in a Poland feed).
    //
    // Filter runs AFTER persistCountryRelations (above) so persistence
    // semantics are completely unchanged — every scored entry is still
    // recorded with its correct isRelevant flag, whether or not it
    // ends up displayed. This mirrors the cached-fallback path, which
    // already enforces relevantOnly: true at the database layer (see
    // getStoredArticles() below) — this brings the live path to parity
    // rather than introducing new semantics.
    //
    // Qualification is `isRelevant || matchesCity`, not `isRelevant`
    // alone: a city-driven query's articles are correctly prioritized
    // by matchesCity in the sort above, but scoreCountryRelevance()
    // itself has no city signal, so a genuine city-only match (e.g.
    // "Warsaw hosts summit" with no "Poland" mention) legitimately
    // scores 0 there — the OR-condition protects exactly this case
    // from being wrongly stripped out.
    //
    // Deliberately does NOT touch scoreCountryRelevance()'s formula,
    // does NOT add a new numeric threshold, and does NOT expand
    // demonym coverage — this is strictly an enforcement gap fix, per
    // explicit Phase B scope.
    /*
      G-SEARCH-QUALITY-POST-AUTH-PREP-1 (B) — QUERY GEOGRAPHY IS NOT ARTICLE
      GEOGRAPHY.

      MEASURED FAILURE. "What are the latest developments in France?" retained
      an article whose own subject is Israel: it names France once (the French
      foreign ministry urging restraint) and so scores 85 against France and
      passes isRelevant. The frontend's evidence model then reads BOTH
      admissible bases — the retrieval filter (France) and the article's own
      resolvePrimaryCountry() (Israel) — and, correctly by its own contract,
      SHOWS BOTH AND STATES THE DISAGREEMENT. The reader asked about France and
      was given "France • Israel".

      The frontend is not wrong. It is faithfully reporting a disagreement the
      backend should never have produced: on the country-aware path the user
      NAMED the country, so an article that positively resolves to a DIFFERENT
      country is not a development in the country that was asked about.

      NO NEW SCORING, NO NEW THRESHOLD, NO NEW TABLE. This reuses
      resolvePrimaryCountry() — the same function news.service already runs
      over every article to populate NewsArticle.countryCode, and the same one
      the frontend's evidence model reads. It cannot disagree with them,
      because it is them.

      FAIL-CLOSED IS PRESERVED IN BOTH DIRECTIONS. resolvePrimaryCountry()
      returns the UNIQUE maximum or nothing, so an article that resolves to
      nothing — a tie, or no country evidence at all — is NOT excluded here:
      absence of a competing country is not evidence of a competing country.
      Only a positive resolution to a different country excludes.

      IT IS NOT A SALIENCE GATE, and must not be mistaken for one. Class A —
      stories that merely MENTION France while being about football, films or a
      visiting head of government — is untouched by this, because those stories
      resolve their primary country to FRANCE and are geographically correct.
      See the package's Class A analysis: no signal in this repository
      separates them today, and a keyword gate measurably fails on the corpus.
    */
    const relevantEntries = scoredEntries.filter(
      (entry) =>
        (entry.relevance.isRelevant || entry.matchesCity) &&
        !resolvesToADifferentCountry(entry.article, country),
    );

    const scoredArticles = relevantEntries.map(({ article, relevance }) => ({
      ...article,
      confidence: scoreArticleConfidence(article, relevance.score).confidence,
    }));

    const categoryFilteredArticles = category
      ? scoredArticles.filter((article) => article.category === category)
      : scoredArticles;

    const deduplicated = deduplicateArticles(categoryFilteredArticles);

    /*
      G-SEARCH-COUNTRY-DEVELOPMENT-SALIENCE-1 — NATIONAL DEVELOPMENTS LEAD.

      A STABLE PARTITION, NOT A FILTER. Every article that reached this line
      still reaches the next one; only the ORDER changes, and within each tier
      the existing order is preserved exactly. Nothing is dropped, so the
      bounded slice below still fills, and a country with no national
      development that day still answers -- with precisely what it answers
      with today.

      WHY ORDERING AND NOT EXCLUSION. The model is measured wrong twice on a
      26-item corpus and will be wrong again on headlines nobody has written.
      A gate that is wrong loses a national emergency; an ordering that is
      wrong ranks it second. See country-development-eligibility.util.ts for
      the four approaches that were falsified before this one, including the
      two that each lost a real development.

      LANGUAGE. The eligibility signal reads English country forms, so a
      non-English feed lands wholly in the second tier and this partition
      becomes a no-op for it -- the fallback behaves as though the signal did
      not exist, which is the correct degradation and is measured.

      CITY-SCOPED QUESTIONS ARE EXEMPT, AND THAT IS THE SAME RULE, NOT AN
      EXCEPTION TO IT. The model's load-bearing claim is that A CITY IS NOT THE
      COUNTRY. Its mirror is that when the reader asked about a CITY, the
      national tier is the wrong axis to order by: Milestone 27 established
      that a city-mentioning article outranks a higher-scored country-wide one,
      and it is right -- someone asking about Kigali wants Kigali. Applying the
      national partition there inverted that accepted ordering, and Milestone
      27's own tests caught it. The partition therefore runs only for
      COUNTRY-scoped retrieval.
    */
    const articles = city
      ? deduplicated
      : [
          ...deduplicated.filter(
            (article) => assessCountryDevelopment(article, country).tier === 'NATIONAL_DEVELOPMENT',
          ),
          ...deduplicated.filter(
            (article) => assessCountryDevelopment(article, country).tier !== 'NATIONAL_DEVELOPMENT',
          ),
        ];

    const bounded = articles.slice(0, resolvedLimit);

    if (bounded.length === 0) {
      // Milestone #49 Phase C: same language-constrained fallback skip
      // as the catch block above — a zero-result language-filtered
      // live response must not be silently backfilled from the
      // language-unverified stored pool.
      if (lang) {
        const emptyResponse: CountryNewsResponse = {
          countryCode: country.iso3,
          countryName: country.name,
          articles: [],
          totalResults: 0,
          providers: searchResponse.providers,
          dataMode: 'unavailable',
          feedTier: 'delayed',
          providerDisplayName: 'Unavailable',
          fallbackReason: searchResponse.fallbackReason ?? 'no-live-results',
          category,
          ...(city ? { city } : {}),
          generatedAt: new Date().toISOString(),
        };

        this.setCached(cacheKey, emptyResponse);

        return emptyResponse;
      }

      const storedArticles = await this.getStoredArticles(country, category, resolvedLimit, city);

      if (storedArticles.length > 0) {
        const response: CountryNewsResponse = {
          countryCode: country.iso3,
          countryName: country.name,
          articles: storedArticles,
          totalResults: storedArticles.length,
          providers: [],
          dataMode: 'cached',
          feedTier: 'delayed',
          providerDisplayName: 'Stored reporting',
          fallbackReason: searchResponse.fallbackReason ?? 'no-live-results',
          newestArticlePublishedAt: this.getNewestArticlePublishedAt(storedArticles),
          category,
          ...(city ? { city } : {}),
          generatedAt: new Date().toISOString(),
        };

        this.setCached(cacheKey, response);

        return response;
      }
    }

    const { feedTier, providerDisplayName } = this.describeFeed(
      searchResponse.providers,
      searchResponse.dataMode,
    );

    const response: CountryNewsResponse = {
      countryCode: country.iso3,
      countryName: country.name,
      articles: bounded,
      totalResults: bounded.length,
      providers: searchResponse.providers,
      dataMode: searchResponse.dataMode,
      feedTier,
      providerDisplayName,
      ...(searchResponse.dataMode === 'cached' || searchResponse.dataMode === 'unavailable'
        ? {
            fallbackReason: searchResponse.fallbackReason,
            newestArticlePublishedAt: searchResponse.fallbackReason
              ? this.getNewestArticlePublishedAt(bounded)
              : undefined,
          }
        : {}),
      category,
      ...(city ? { city } : {}),
      generatedAt: new Date().toISOString(),
    };

    this.setCached(cacheKey, response);

    return response;
  }

  /**
   * Builds the term sent to the underlying news provider. When a
   * curated city is present, the city is combined with the country
   * name (e.g. "kigali Rwanda") rather than replacing it — this keeps
   * the request grounded in the country while giving the provider a
   * chance to surface city-specific stories. MockNewsProvider matches
   * on an OR of tokens, so this is guaranteed not to over-filter in
   * mock/dev/test mode; live provider (GNews) semantics for a
   * multi-word query are outside this codebase's control and worth a
   * one-time manual check in staging, but nothing here depends on a
   * particular interpretation — the city-first sort below re-ranks
   * whatever comes back regardless.
   */
  private buildSearchTerm(country: CountryMeta, city: string | undefined): string {
    return city ? `${city} ${country.name}` : country.name;
  }

  /**
   * Reads stored/cached articles for a country, preferring
   * city-specific stored reporting when a city is present, with the
   * normal country-wide stored reporting as fallback fill.
   *
   * This does not require any database schema change: the
   * articleCountry table (queried via findRecentByCountry) has no
   * per-city column, so city-specific stored articles are instead
   * found via the generic, country-agnostic full-text search already
   * exposed by findRecent (title/summary/sourceName contains `city`).
   * Because that lookup isn't scoped to a country, each hit is
   * re-checked with a freshly-computed scoreCountryRelevance(...).
   * isRelevant before being trusted, to reject unrelated same-name
   * matches (e.g. a business named after the city, in an unrelated
   * country). City-matching results are placed first so the
   * order-preserving deduplicateArticles keeps them over any
   * duplicate found in the country-wide pool.
   *
   * Known, deliberate limitation: a stored article that genuinely is
   * about the city but never mentions the country by name (e.g. a
   * purely locally-datelined story) can fail that relevance re-check
   * and be excluded from this stored-fallback pool specifically. This
   * does not affect the live retrieval path above, which never
   * filters by isRelevant — only the rarer cached/database-fallback
   * path is affected.
   */
  private async getStoredArticles(
    country: CountryMeta,
    category: NewsCategory | undefined,
    limit: number,
    city: string | undefined,
  ): Promise<NewsArticle[]> {
    const countryStored = await this.articlePersistence.findRecentByCountry({
      countryCode: country.iso3,
      category,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
      relevantOnly: true,
    });

    if (!city) {
      return countryStored;
    }

    const cityStoredCandidates = await this.articlePersistence.findRecent({
      query: city,
      category,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    const cityStored = cityStoredCandidates.filter(
      (article) => scoreCountryRelevance(article, country).isRelevant,
    );

    return deduplicateArticles([...cityStored, ...countryStored]).slice(0, limit);
  }

  private getNewestArticlePublishedAt(articles: NewsArticle[]): string | undefined {
    let newestTimestamp = Number.NEGATIVE_INFINITY;

    for (const article of articles) {
      const timestamp = Date.parse(article.publishedAt);

      if (Number.isFinite(timestamp) && timestamp > newestTimestamp) {
        newestTimestamp = timestamp;
      }
    }

    if (!Number.isFinite(newestTimestamp)) {
      return undefined;
    }

    return new Date(newestTimestamp).toISOString();
  }

  private describeFeed(
    providerIds: string[],
    dataMode: NewsDataMode,
  ): {
    feedTier: NewsFeedTier;
    providerDisplayName: string;
  } {
    if (dataMode === 'mock') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Mock',
      };
    }

    if (dataMode === 'cached') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Stored reporting',
      };
    }

    if (dataMode === 'unavailable') {
      return {
        feedTier: 'delayed',
        providerDisplayName: 'Unavailable',
      };
    }

    const activeProviderId = providerIds[0];

    if (activeProviderId === 'gnews') {
      const configuredTier = this.config.get<string>('GNEWS_FEED_TIER');

      const feedTier: NewsFeedTier = configuredTier === 'live' ? 'live' : 'delayed';

      const providerDisplayName =
        this.config.get<string>('GNEWS_PROVIDER_DISPLAY_NAME') || 'GNews Free';

      return {
        feedTier,
        providerDisplayName,
      };
    }

    return {
      feedTier: 'live',
      providerDisplayName: activeProviderId ? this.titleCase(activeProviderId) : 'Live provider',
    };
  }

  private titleCase(value: string): string {
    return value
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private clampLimit(requested: number | undefined): number {
    if (!requested || requested < 1) {
      return DEFAULT_LIMIT;
    }

    return Math.min(requested, 30);
  }

  private getCacheTtlSeconds(): number {
    const raw = this.config.get<string>('COUNTRY_NEWS_CACHE_TTL_SECONDS');

    const parsed = raw ? parseInt(raw, 10) : NaN;

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_TTL_SECONDS;
  }

  private getCached(key: string): CountryNewsResponse | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);

      return null;
    }

    return entry.value;
  }

  private setCached(key: string, value: CountryNewsResponse): void {
    const ttlSeconds = this.getCacheTtlSeconds();

    if (ttlSeconds <= 0) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
