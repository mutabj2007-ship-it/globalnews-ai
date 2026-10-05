import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { MULTI_STORY_MIN_STORIES, type AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisService } from '../service/analysis.service';
import { AnalyzeNewsDto } from '../dto';
import {
  AnalysisRateLimitGuard,
  readVerifiedAnalysisUserId,
} from '../security/analysis-rate-limit.guard';
import { HistoryService } from '../../history/history.service';
import { LegacyRouteUsageInterceptor } from '../../legacy-usage/legacy-route-usage.interceptor';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly history: HistoryService,
  ) {}

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
  /**
   * MY INTELLIGENCE R1 — THE ONE EXPLICIT-COMPUTE BOUNDARY, AND THE ONE
   * HISTORY WRITER.
   *
   * Every surface (Home Ask, the Ask dock, /ask, /search Run, My Intelligence
   * "Ask about selected" and the other multi-story actions) reaches analysis
   * only here, and only on an explicit Send / Run / Confirm. So this is where
   * the reader's question is recorded — once, for a verified signed-in caller,
   * before the analysis runs (a no-evidence or failed analysis is still a
   * question the reader asked). Staging, typing, opening Ask and reopening a
   * history entry never reach this route, so they never write.
   *
   * A selection that asks an action to run on fewer stories than it needs is
   * refused (400) BEFORE anything is recorded or computed.
   */
  /**
   * STAGE 2 / T4 — LEGACY-USE MEASUREMENT. No mounted Ask surface at Alpha or Production calls
   * this route any more (every one uses Ask V2, which reaches AnalysisService internally, not
   * through here). The interceptor records a PII-free usage event — route, caller class,
   * signed-in-or-anonymous, user-agent family, time — so remaining callers are proven, not
   * assumed, before the route is made internal-only. It never sees the body and never stores the
   * verified user id; behaviour of this handler is unchanged.
   */
  @UseGuards(AnalysisRateLimitGuard)
  @UseInterceptors(
    new LegacyRouteUsageInterceptor('POST /analysis/news', (request) =>
      readVerifiedAnalysisUserId(request) !== undefined ? 'signed-in' : 'anonymous',
    ),
  )
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('news')
  async analyzeNews(
    @Body() { query, requestedLanguage, storyContext, priorQuestion, selection, geographyContext }: AnalyzeNewsDto,
    @Req() request: Request,
  ): Promise<AnalysisApiResponse> {
    if (selection) {
      const minimum = MULTI_STORY_MIN_STORIES[selection.action];
      const distinct = new Set(selection.stories.map((story) => story.articleRef)).size;
      if (distinct < minimum) {
        throw new BadRequestException(
          `${selection.action} needs at least ${minimum} selected ${minimum === 1 ? 'story' : 'stories'}.`,
        );
      }
    }

    const userId = readVerifiedAnalysisUserId(request);
    if (userId) {
      /* The story anchor is the more specific context; the map country applies only without one. */
      await this.history.recordExplicitQuestion(
        userId,
        query,
        storyContext ? storyContext.countryCode : geographyContext?.countryCode,
      );
    }

    return this.analysisService.analyzeNews(
      query,
      requestedLanguage,
      storyContext,
      priorQuestion,
      selection,
      geographyContext,
      undefined,
      /* ASK R2 ALPHA ENABLEMENT R1 (MC-055): server-resolved identity, never the body. */
      { verified: userId !== undefined && userId !== null },
    );
  }
}
