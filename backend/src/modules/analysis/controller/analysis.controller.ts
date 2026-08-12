import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisService } from '../service/analysis.service';
import { AnalyzeNewsDto } from '../dto';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * POST /analysis/news
   * Milestone #34: overrides the global 20/60s default with a
   * stricter 5/60s limit — this route triggers a real, cost-bearing AI
   * provider call (see AnalysisService.analyzeNews).
   *
   * Milestone #47: `requestedLanguage` is already validated by
   * AnalyzeNewsDto's @IsIn(SUPPORTED_LANGUAGE_CODES) — an unsupported
   * value never reaches this method body at all (rejected by the
   * existing global ValidationPipe, the same mechanism that already
   * rejects an invalid `query`). When absent, AnalysisService.analyzeNews()
   * itself defaults to 'en' — this method does not invent its own
   * separate default, so there is exactly one place or the other,
   * never a third, that decides the English fallback.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('news')
  analyzeNews(@Body() { query, requestedLanguage }: AnalyzeNewsDto): Promise<AnalysisApiResponse> {
    return this.analysisService.analyzeNews(query, requestedLanguage);
  }
}
