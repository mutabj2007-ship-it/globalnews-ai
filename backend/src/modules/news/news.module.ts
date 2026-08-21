import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { MockNewsProvider } from './providers/mock-news.provider';
import { GNewsProvider } from './providers/gnews.provider';
import {
  ALL_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
  isUsableGNewsApiKey,
} from './providers/provider.tokens';
import {
  collectRegisteredNewsProviders,
  selectActiveNewsProviders,
  type NewsProviderSelectionInput,
  type RealNewsProviderCandidate,
} from './providers/news-provider-registry';
import { CountryNewsController } from './country/country-news.controller';
import { CountryNewsService } from './country/country-news.service';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { NewsStartupValidator } from './startup/news-startup-validator';
import type { NewsProvider } from './interfaces';

/**
 * E1 — the single place that declares which REAL news providers this
 * build knows how to run, and whether this deployment has configured
 * each of them.
 *
 * ORDER IS MEANINGFUL. This array is the deployment's declared
 * preference order: it decides the order providers are called and
 * reported in, and it is the second tiebreaker when two providers
 * carry the same story (see cross-provider-dedup.util.ts).
 *
 * ADDING A SECOND REAL PROVIDER is now genuinely one entry here plus
 * one `NewsProvider` implementation — no change to this module's
 * factories, to NewsService, to NewsController, or to any endpoint.
 * E1 deliberately adds NO new external provider; this is the seam
 * being made ready, not the provider being added.
 *
 * MockNewsProvider is NOT in this list and must never be added to it:
 * it is passed separately as `mockProvider` below, and
 * selectActiveNewsProviders throws if anything reporting isMock=true
 * appears among the real candidates.
 */
function buildProviderSelectionInput(
  config: ConfigService,
  mockNewsProvider: MockNewsProvider,
  gnewsProvider: GNewsProvider,
): NewsProviderSelectionInput {
  const realCandidates: RealNewsProviderCandidate[] = [
    {
      provider: gnewsProvider,
      // Milestone #33: the same whitespace-safe isUsableGNewsApiKey()
      // check NewsStartupValidator uses, so provider selection and the
      // fail-closed production guard can never disagree about whether
      // GNEWS_API_KEY is usable.
      isConfigured: isUsableGNewsApiKey(config.get<string>('GNEWS_API_KEY')),
    },
  ];

  return {
    realCandidates,
    mockProvider: mockNewsProvider,
  };
}

/**
 * Provider selection:
 *
 * E1 — the active set now ACCUMULATES real providers instead of
 * choosing exactly one. The rule itself lives in
 * providers/news-provider-registry.ts and is unchanged in substance:
 *
 * - one or more real providers configured -> every configured real
 *   provider is active, in registration order; the mock provider is
 *   excluded entirely;
 * - zero real providers configured        -> MockNewsProvider only.
 *
 * MockNewsProvider is therefore never silently mixed with a real
 * provider. With a single real candidate (today's shipped
 * configuration) the active set is identical to what the previous
 * `hasGNewsKey ? [gnewsProvider] : [mockNewsProvider]` ternary
 * produced, so live behaviour is unchanged by E1.
 *
 * ALL_NEWS_PROVIDERS still contains every registered provider so that
 * provider health can be reported independently of the active set.
 *
 * Milestone #33: NewsStartupValidator makes this fail-closed in
 * production — NODE_ENV=production with an unusable GNEWS_API_KEY
 * refuses to boot rather than silently serving mock news as live.
 *
 * DI: ConfigModule is imported explicitly (bare, NOT .forRoot() again)
 * so this module declares its own real dependency on ConfigService
 * rather than relying on AppModule's isGlobal:true as a side effect —
 * the same repair already applied to SignalsModule. This is what lets
 * news.module.spec.ts compile NewsModule standalone and assert the
 * registration contract directly.
 */
@Module({
  imports: [ConfigModule],
  controllers: [NewsController, CountryNewsController],
  providers: [
    NewsService,
    CountryNewsService,
    ArticlePersistenceService,
    MockNewsProvider,
    GNewsProvider,
    // Milestone #33: fail-closed startup guard. Registered as a plain
    // provider so Nest's OnApplicationBootstrap lifecycle invokes it
    // automatically — nothing else needs to reference it directly
    // (same registration pattern as AnalysisStartupValidator).
    NewsStartupValidator,
    {
      provide: NEWS_PROVIDERS,
      useFactory: (
        config: ConfigService,
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
      ): NewsProvider[] =>
        selectActiveNewsProviders(
          buildProviderSelectionInput(config, mockNewsProvider, gnewsProvider),
        ),
      inject: [ConfigService, MockNewsProvider, GNewsProvider],
    },
    {
      provide: ALL_NEWS_PROVIDERS,
      useFactory: (
        config: ConfigService,
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
      ): NewsProvider[] =>
        collectRegisteredNewsProviders(
          buildProviderSelectionInput(config, mockNewsProvider, gnewsProvider),
        ),
      inject: [ConfigService, MockNewsProvider, GNewsProvider],
    },
  ],
  exports: [NewsService, CountryNewsService],
})
export class NewsModule {}
