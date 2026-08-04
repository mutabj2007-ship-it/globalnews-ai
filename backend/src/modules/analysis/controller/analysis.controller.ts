import { Body, Controller, Post } from '@nestjs/common';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisService } from '../service/analysis.service';
import { AnalyzeNewsDto } from '../dto';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /** POST /analysis/news */
  @Post('news')
  analyzeNews(@Body() { query }: AnalyzeNewsDto): Promise<AnalysisApiResponse> {
    return this.analysisService.analyzeNews(query);
  }
}
