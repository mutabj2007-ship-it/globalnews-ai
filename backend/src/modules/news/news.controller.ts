import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { NewsResponse, ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import { CategoryParamsDto, SearchNewsDto, TopHeadlinesQueryDto } from './dto';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /** GET /news/search?q=...&limit=... */
  @Get('search')
  search(@Query() { q, limit }: SearchNewsDto): Promise<NewsResponse> {
    return this.newsService.search(q, limit);
  }

  /**
   * GET /news/top-headlines?limit=...&lang=...
   * Milestone #47 (homepage feed language correction): `lang` is new
   * and optional — already validated by TopHeadlinesQueryDto's
   * @IsIn(TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES) before this method
   * body ever runs, so an unsupported value never reaches NewsService.
   * Omitted (every pre-existing caller): passed through as
   * `undefined`, and NewsService.topHeadlines() itself decides what an
   * absent language means (currently: unfiltered, per that method's
   * own doc comment) — fully backward compatible.
   *
   * Milestone #48 (Phase D — controller language handoff correction):
   * this was previously `{ limit }`, silently discarding `lang` before
   * it ever reached NewsService — meaning neither the Phase B
   * (NewsService) nor Phase C (GNewsProvider) language-containment
   * corrections could ever activate for a real HTTP request, since
   * both are conditioned on `options?.lang` being present. This was
   * the actual root cause of the observed runtime multilingual mixing
   * for both lang=en and lang=pl, confirmed directly against real
   * compiled JS evidence — not a defect in either downstream fix
   * itself.
   */
  /**
   * B-1 - defensive per-handler override, NOT the primary control.
   *
   * This is the homepage's only backend request, and it is issued by the
   * Next.js SERVER runtime rather than by the visitor's browser (see
   * frontend/src/lib/homeFeed.ts, which fetches with cache: 'no-store', so
   * every render is a real request). When client-address resolution is
   * working - TRUST_PROXY configured, and the visitor's address forwarded
   * across the SSR hop - the global 20/60s applies per visitor and this
   * override is irrelevant.
   *
   * When it is NOT working, every homepage render in the world shares one
   * rate-limit identity, and the global limit would refuse the 21st render
   * in any 60-second window. The frontend degrades that 429 into its honest
   * "feed unavailable" banner, so the site would tell visitors it is broken
   * while being perfectly healthy.
   *
   * 120/60s bounds that degraded case at roughly two renders per second
   * instead of twenty per minute, while still refusing a genuinely abusive
   * single client. It is deliberately NOT an exemption: this endpoint reaches
   * a rate-limited third-party provider, so unlimited access here would trade
   * a self-inflicted outage for a provider-inflicted one.
   *
   * Scoped to this handler by decorator placement. POST /analysis/news keeps
   * its own stricter 5/60s override and must never inherit this one.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('top-headlines')
  topHeadlines(@Query() { limit, lang }: TopHeadlinesQueryDto): Promise<NewsResponse> {
    return this.newsService.topHeadlines(limit, { lang });
  }

  /**
   * ════════════════════════════════════════════════════════════════════════
   * GET /news/top-headlines/retained — R5, AND THE ROUTE THE MAP USES
   * ════════════════════════════════════════════════════════════════════════
   *
   * The same `limit:language` corpus as the route above, read WITHOUT the
   * ability to execute a provider. On a miss it answers
   * `dataMode: 'unavailable'` with no articles; it never calls GNews, never
   * calls a fallback provider, and never writes to the cache.
   *
   * ── WHY A SEPARATE ROUTE RATHER THAN A FLAG ON THE EXISTING ONE ────────
   *
   * A `?cacheOnly=true` parameter would put the invariant in the hands of
   * every caller, and the invariant is exactly what R4 showed cannot be left
   * to call-site discipline: the map reached the executing path for months
   * without anyone intending it to. A separate route means the map is
   * INCAPABLE of spending quota rather than merely instructed not to, and a
   * future caller has to choose the executing route by name.
   *
   * The same `TopHeadlinesQueryDto` validates it, so `limit` and `lang` carry
   * identical constraints and the two routes cannot drift into requesting
   * different corpora — which would silently break the cache-key match that
   * makes a warm Home serve the Map.
   *
   * ── THE THROTTLE IS MATCHED TO THE ROUTE ABOVE, AND NOT FOR ITS REASON ──
   *
   * My first cut left this on the ordinary global limit, reasoning that a
   * route which cannot reach a provider needs no exemption. That is true about
   * COST and wrong about BEHAVIOUR. This route is called from the browser on
   * every map mount, and a reader — or a visual-testing session — reloading
   * `/map` briskly would cross the global 20/60s and be answered 429. The map
   * fails soft, so the consequence is not an error the reader can act on: it
   * is an EMPTY WORLD that looks exactly like a product defect and costs a
   * round of investigation to tell apart from one.
   *
   * 120/60s therefore matches the executing route, for the opposite reason.
   * There is no third party behind this one to protect, so the limit exists
   * only to bound abuse of an in-memory read, and it still does.
   */
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('top-headlines/retained')
  retainedTopHeadlines(@Query() { limit, lang }: TopHeadlinesQueryDto): NewsResponse {
    return this.newsService.topHeadlinesCacheOnly(limit, { lang });
  }

  /** GET /news/category/:category?limit=... */
  @Get('category/:category')
  byCategory(
    @Param() { category }: CategoryParamsDto,
    @Query() { limit }: TopHeadlinesQueryDto,
  ): Promise<NewsResponse> {
    return this.newsService.byCategory(category, limit);
  }

  /** GET /news/providers/health */
  @Get('providers/health')
  providersHealth(): Promise<ProviderHealthStatus[]> {
    return this.newsService.providersHealth();
  }
}
