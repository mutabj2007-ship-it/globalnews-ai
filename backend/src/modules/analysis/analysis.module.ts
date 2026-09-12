import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsModule } from '../news/news.module';
import { AuthModule } from '../auth/auth.module';
import { AnalysisController } from './controller/analysis.controller';
import { AnalysisService } from './service/analysis.service';
import { MockAnalysisProvider } from './providers/mock-analysis.provider';
import { OpenAiAnalysisProvider } from './providers/openai-analysis.provider';
import { ANALYSIS_PROVIDER, resolveActiveAnalysisProvider } from './providers/provider.tokens';
import { AnalysisConfigService } from './config/analysis-config.service';
import { AnalysisStartupValidator } from './startup/analysis-startup-validator';
import { AnalysisRateLimitGuard } from './security/analysis-rate-limit.guard';
import type { AnalysisProvider } from './interfaces';

/**
 * To add a real provider alongside OpenAI later: implement
 * AnalysisProvider, add it to the `providers` array below, and extend
 * the ANALYSIS_PROVIDER factory's selection logic (currently: OpenAI
 * when OPENAI_API_KEY is set, Mock otherwise). AnalysisService and
 * AnalysisController never need to change.
 */
@Module({
  // PH-1 — AuthModule exports SessionService, which AnalysisRateLimitGuard uses
  // to resolve an EXISTING session server-side. No new auth mechanism is
  // introduced and the route does not become authenticated.
  imports: [NewsModule, AuthModule],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisRateLimitGuard,
    AnalysisConfigService,
    MockAnalysisProvider,
    OpenAiAnalysisProvider,
    // Milestone #30: fail-closed startup guard. Registered as a plain
    // provider so Nest's OnApplicationBootstrap lifecycle invokes it
    // automatically — nothing else needs to reference it directly.
    AnalysisStartupValidator,
    {
      provide: ANALYSIS_PROVIDER,
      useFactory: (
        config: ConfigService,
        mock: MockAnalysisProvider,
        openai: OpenAiAnalysisProvider,
      ): AnalysisProvider =>
        resolveActiveAnalysisProvider(config.get<string>('OPENAI_API_KEY'), mock, openai),
      inject: [ConfigService, MockAnalysisProvider, OpenAiAnalysisProvider],
    },
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
