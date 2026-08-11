import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { MockNewsProvider } from './providers/mock-news.provider';
import { GNewsProvider } from './providers/gnews.provider';
import {
  ALL_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
  isUsableGNewsApiKey,
} from './providers/provider.tokens';
import { CountryNewsController } from './country/country-news.controller';
import { CountryNewsService } from './country/country-news.service';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { NewsStartupValidator } from './startup/news-startup-validator';
import type { NewsProvider } from './interfaces';

/**
 * Provider selection:
 *
 * Exactly one provider is active for reads at a time.
 * If GNEWS_API_KEY is usable (non-blank — see isUsableGNewsApiKey),
 * GNews is used. Otherwise the mock provider is used.
 *
 * ALL_NEWS_PROVIDERS still contains every registered provider so that
 * provider health can be reported independently of the active provider.
 *
 * Milestone #33: NewsStartupValidator makes this fail-closed in
 * production — NODE_ENV=production with an unusable GNEWS_API_KEY
 * refuses to boot rather than silently serving mock news as live.
 */
@Module({
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
      ): NewsProvider[] => {
        // Milestone #33: uses the same whitespace-safe
        // isUsableGNewsApiKey() check as NewsStartupValidator, so
        // provider selection and the fail-closed production guard can
        // never disagree about whether GNEWS_API_KEY is usable.
        const hasGNewsKey = isUsableGNewsApiKey(config.get<string>('GNEWS_API_KEY'));

        return hasGNewsKey ? [gnewsProvider] : [mockNewsProvider];
      },
      inject: [ConfigService, MockNewsProvider, GNewsProvider],
    },
    {
      provide: ALL_NEWS_PROVIDERS,
      useFactory: (
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
      ): NewsProvider[] => [mockNewsProvider, gnewsProvider],
      inject: [MockNewsProvider, GNewsProvider],
    },
  ],
  exports: [NewsService, CountryNewsService],
})
export class NewsModule {}
