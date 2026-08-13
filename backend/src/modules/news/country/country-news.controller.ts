import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CountryNewsResponse } from '@globalnews-ai/shared';
import { CountryNewsService } from './country-news.service';
import { CountryNewsQueryDto, CountryParamsDto } from './country-news.dto';

@Controller('news/country')
export class CountryNewsController {
  constructor(private readonly countryNewsService: CountryNewsService) {}

  /**
   * GET /news/country/:countryCode?category=...&limit=...&lang=...
   * Milestone #49 (World Map EN/PL integration) — `lang` is new and
   * optional, already validated by CountryNewsQueryDto's
   * @IsIn(TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES) before this method
   * body ever runs. Omitted (every pre-existing caller): passed through
   * as `undefined`, and CountryNewsService itself decides what an
   * absent language means — fully backward compatible. This mirrors
   * the exact Milestone #48 Phase D controller-handoff correction for
   * topHeadlines(), applied here to close the same class of gap before
   * it can recur.
   */
  @Get(':countryCode')
  getCountryNews(
    @Param() { countryCode }: CountryParamsDto,
    @Query() { category, limit, lang }: CountryNewsQueryDto,
  ): Promise<CountryNewsResponse> {
    return this.countryNewsService.getCountryNews(countryCode, category, limit, undefined, lang);
  }
}
