import { Controller, Get, Param, Query } from '@nestjs/common';
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
  @Get('top-headlines')
  topHeadlines(@Query() { limit, lang }: TopHeadlinesQueryDto): Promise<NewsResponse> {
    return this.newsService.topHeadlines(limit, { lang });
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
