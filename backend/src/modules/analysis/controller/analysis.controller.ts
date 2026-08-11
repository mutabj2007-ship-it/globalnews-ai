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
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('news')
  analyzeNews(@Body() { query }: AnalyzeNewsDto): Promise<AnalysisApiResponse> {
    return this.analysisService.analyzeNews(query);
  }
}
