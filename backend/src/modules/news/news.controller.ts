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

  /** GET /news/top-headlines?limit=... */
  @Get('top-headlines')
  topHeadlines(@Query() { limit }: TopHeadlinesQueryDto): Promise<NewsResponse> {
    return this.newsService.topHeadlines(limit);
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
