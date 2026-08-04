import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CountryNewsResponse } from '@globalnews-ai/shared';
import { CountryNewsService } from './country-news.service';
import { CountryNewsQueryDto, CountryParamsDto } from './country-news.dto';

@Controller('news/country')
export class CountryNewsController {
  constructor(private readonly countryNewsService: CountryNewsService) {}

  /** GET /news/country/:countryCode?category=...&limit=... */
  @Get(':countryCode')
  getCountryNews(
    @Param() { countryCode }: CountryParamsDto,
    @Query() { category, limit }: CountryNewsQueryDto,
  ): Promise<CountryNewsResponse> {
    return this.countryNewsService.getCountryNews(countryCode, category, limit);
  }
}
