import { Controller, Get, Optional, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CountryNewsResponse } from '@globalnews-ai/shared';
import {
  NO_ACTIVATION,
  countrySourceCoverageDisclosure,
  sourceActivationFromConfig,
} from '../../global-reach/source-coverage.authority';
import { CountryNewsService } from './country-news.service';
import { CountryNewsQueryDto, CountryParamsDto } from './country-news.dto';

@Controller('news/country')
export class CountryNewsController {
  constructor(
    private readonly countryNewsService: CountryNewsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

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
    return this.countryNewsService
      .getCountryNews(countryCode, category, limit, undefined, lang)
      .then((response) => this.withSourceCoverage(response));
  }

  /**
   * T1 COVERAGE TRUTHFULNESS — the canonical local-source coverage fact for the
   * country, and the locality of the articles in THIS response, stamped on the
   * reader response. Computed from registries + configuration + the articles
   * already retrieved: no provider call, no extra quota. A new object is
   * returned so the service's cached response is never mutated.
   */
  private withSourceCoverage(response: CountryNewsResponse): CountryNewsResponse {
    if (!response || typeof response.countryCode !== 'string') return response;
    try {
      const activation = this.config
        ? sourceActivationFromConfig((key) => this.config?.get<string>(key))
        : NO_ACTIVATION;
      return {
        ...response,
        sourceCoverage: countrySourceCoverageDisclosure({
          iso3: response.countryCode,
          evidenceUrls: (response.articles ?? []).map((article) => article.url),
          contributingProviderIds: response.providers ?? [],
          activation,
        }),
      };
    } catch {
      /* Coverage accounting must never fail a reader's country read. */
      return response;
    }
  }
}
