import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisService } from '../service/analysis.service';
import { AnalyzeNewsDto } from '../dto';
import { AnalysisRateLimitGuard } from '../security/analysis-rate-limit.guard';

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
   * Milestone #51 Phase B: `storyContext`, when present, is already
   * validated by AnalyzeNewsDto's nested @ValidateNested()/StoryContextDto
   * — passed straight through to AnalysisService.analyzeNews(), which
   * treats it as fully optional (absent for every pre-#51 caller).
   */
  /**
   * PH-1 — bounded anonymous analysis. The route STAYS PUBLIC; anonymous
   * analysis is an intentional product capability and this guard does not
   * authenticate the endpoint. It applies the CTO-approved MVP ceilings
   * (5 anonymous / 30 authenticated per 15 minutes, plus a 300-per-15-minutes
   * global emergency ceiling per instance) and, being a guard, rejects BEFORE
   * this method body runs — so before any news retrieval and before any
   * OpenAI call. The @Throttle below is untouched and remains the
   * short-window burst guard.
   */
  @UseGuards(AnalysisRateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('news')
  analyzeNews(
    @Body() { query, requestedLanguage, storyContext, priorQuestion }: AnalyzeNewsDto,
  ): Promise<AnalysisApiResponse> {
    return this.analysisService.analyzeNews(query, requestedLanguage, storyContext, priorQuestion);
  }
}
