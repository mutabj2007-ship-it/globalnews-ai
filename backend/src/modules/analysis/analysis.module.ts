import { HistoryModule } from '../history/history.module';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsModule } from '../news/news.module';
import { AuthModule } from '../auth/auth.module';
import { AnalysisController } from './controller/analysis.controller';
import { AnalysisService } from './service/analysis.service';
import { MockAnalysisProvider } from './providers/mock-analysis.provider';
import { OpenAiAnalysisProvider } from './providers/openai-analysis.provider';
import { ANALYSIS_PROVIDER, resolveActiveAnalysisProvider } from './providers/provider.tokens';
import {
  GENERAL_BACKGROUND_PROVIDER,
  MockGeneralBackgroundProvider,
  OpenAiGeneralBackgroundProvider,
  resolveActiveGeneralBackgroundProvider,
} from './providers/general-background.provider';
import { AnalysisConfigService } from './config/analysis-config.service';
import { AnalysisStartupValidator } from './startup/analysis-startup-validator';
import { AnalysisRateLimitGuard } from './security/analysis-rate-limit.guard';
import type { AnalysisProvider, GeneralBackgroundProvider } from './interfaces';

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
  imports: [NewsModule, AuthModule, HistoryModule],
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
    // ASK GENERAL BACKGROUND EXECUTION R1 — a seam of its own, never AnalysisProvider
    // (see general-background-provider.interface.ts for why). Same boot-time
    // deterministic OpenAI-key-gated selection as ANALYSIS_PROVIDER above.
    MockGeneralBackgroundProvider,
    OpenAiGeneralBackgroundProvider,
    {
      provide: GENERAL_BACKGROUND_PROVIDER,
      useFactory: (
        config: ConfigService,
        mock: MockGeneralBackgroundProvider,
        openai: OpenAiGeneralBackgroundProvider,
      ): GeneralBackgroundProvider =>
        resolveActiveGeneralBackgroundProvider(config.get<string>('OPENAI_API_KEY'), mock, openai),
      inject: [ConfigService, MockGeneralBackgroundProvider, OpenAiGeneralBackgroundProvider],
    },
  ],
  // ASK R2 INTEGRATION R1 · Gate E: the Ask execution adapter reads the active provider id
  // (breaker and meter scope) and the analysis limits (unit estimate). ASK GENERAL
  // BACKGROUND EXECUTION R1 adds GENERAL_BACKGROUND_PROVIDER for the same adapter.
  exports: [AnalysisService, ANALYSIS_PROVIDER, GENERAL_BACKGROUND_PROVIDER, AnalysisConfigService],
})
export class AnalysisModule {}
