import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { MockNewsProvider } from './providers/mock-news.provider';
import { GNewsProvider } from './providers/gnews.provider';
import { GdeltDocProvider } from './providers/gdelt-doc.provider';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
  isGdeltDocEnabled,
  isUsableGNewsApiKey,
} from './providers/provider.tokens';
import {
  collectRegisteredNewsProviders,
  selectActiveNewsProviders,
  selectProvidersByTier,
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
  gdeltDocProvider: GdeltDocProvider,
): NewsProviderSelectionInput {
  const realCandidates: RealNewsProviderCandidate[] = [
    {
      provider: gnewsProvider,
      // Milestone #33: the same whitespace-safe isUsableGNewsApiKey()
      // check NewsStartupValidator uses, so provider selection and the
      // fail-closed production guard can never disagree about whether
      // GNEWS_API_KEY is usable.
      isConfigured: isUsableGNewsApiKey(config.get<string>('GNEWS_API_KEY')),
      // R4 GDELT — explicit rather than relying on the 'primary' default,
      // because this array is where a reader looks to learn the retrieval
      // order and an implicit tier would make them go and find it.
      tier: 'primary',
    },
    {
      // R4 GDELT — THE SECOND REAL PROVIDER, AND THE REASON THIS ARRAY
      // EXISTS. GNews's Free plan reached 100/100 and live Analysis
      // stopped while cached headlines kept displaying; one real provider
      // is a single point of failure for the only thing this product does.
      //
      // FALLBACK TIER: consulted only when the primaries returned no
      // articles at all. It never corroborates a healthy GNews response,
      // because GDELT asks for one request every five seconds and a
      // second opinion nobody requested is not worth that budget.
      //
      // ORDER STILL MATTERS INDEPENDENTLY OF TIER: GNews sits first, so
      // when both providers do contribute and a story arrives twice, the
      // cross-provider winner rule prefers the GNews record — which is
      // also the one carrying a publisher-basis timestamp.
      provider: gdeltDocProvider,
      // No API key exists for GDELT DOC, so this is a plain toggle, and
      // it defaults OFF: landing this code changes no deployment's
      // behaviour until someone sets GDELT_DOC_ENABLED=true.
      isConfigured: isGdeltDocEnabled(config.get<string>('GDELT_DOC_ENABLED')),
      tier: 'fallback',
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
    GdeltDocProvider,
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
        gdeltDocProvider: GdeltDocProvider,
      ): NewsProvider[] =>
        selectActiveNewsProviders(
          buildProviderSelectionInput(config, mockNewsProvider, gnewsProvider, gdeltDocProvider),
        ),
      inject: [ConfigService, MockNewsProvider, GNewsProvider, GdeltDocProvider],
    },
    {
      provide: ALL_NEWS_PROVIDERS,
      useFactory: (
        config: ConfigService,
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
        gdeltDocProvider: GdeltDocProvider,
      ): NewsProvider[] =>
        collectRegisteredNewsProviders(
          buildProviderSelectionInput(config, mockNewsProvider, gnewsProvider, gdeltDocProvider),
        ),
      inject: [ConfigService, MockNewsProvider, GNewsProvider, GdeltDocProvider],
    },
    {
      // R4 GDELT — the fallback-tier subset of the ACTIVE set, built from
      // the same candidate list and the same isConfigured rule as
      // NEWS_PROVIDERS above, so the two factories cannot disagree about
      // which providers are live.
      provide: FALLBACK_NEWS_PROVIDERS,
      useFactory: (
        config: ConfigService,
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
        gdeltDocProvider: GdeltDocProvider,
      ): NewsProvider[] =>
        selectProvidersByTier(
          buildProviderSelectionInput(config, mockNewsProvider, gnewsProvider, gdeltDocProvider),
          'fallback',
        ),
      inject: [ConfigService, MockNewsProvider, GNewsProvider, GdeltDocProvider],
    },
  ],
  // MVP-G4 (G4-3), CTO-authorized cross-lane wiring, export-only.
  // AdminNewsService injects both token sets so it can report which
  // registered providers are ACTIVE and which are synthetic. Nothing
  // about provider selection, registration or behaviour changes: these
  // two entries make the existing factories' results visible to a
  // consuming module, and nothing else in this file was touched.
  exports: [NewsService, CountryNewsService, NEWS_PROVIDERS, ALL_NEWS_PROVIDERS],
})
export class NewsModule {}
