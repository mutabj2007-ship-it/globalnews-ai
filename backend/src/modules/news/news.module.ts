import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { MockNewsProvider } from './providers/mock-news.provider';
import { GNewsProvider } from './providers/gnews.provider';
import { ALL_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { CountryNewsController } from './country/country-news.controller';
import { CountryNewsService } from './country/country-news.service';
import type { NewsProvider } from './interfaces';

/**
 * Provider selection (Sprint 4.1):
 *
 * Exactly one provider is ever active for reads at a time, chosen once
 * at startup based on whether GNEWS_API_KEY is configured:
 *   - key present  -> GNewsProvider serves search/topHeadlines/category
 *   - key missing  -> MockNewsProvider serves them instead
 *
 * This is deliberate, not a limitation: mixing mock and real articles
 * in the same response would misrepresent mock data as live reporting.
 * Both providers are still registered under ALL_NEWS_PROVIDERS, so
 * /news/providers/health always reports GNews's status (e.g. "not
 * configured") even while it's inactive.
 *
 * To add another real provider (Reuters, AP News, BBC, NewsAPI, GDELT,
 * Google News, ...):
 *   1. Create `providers/<name>-news.provider.ts` implementing NewsProvider.
 *   2. Add it to the `providers` array below.
 *   3. Add it to both factories below (ALL_NEWS_PROVIDERS always; decide
 *      its priority relative to GNews/Mock in the NEWS_PROVIDERS factory).
 *
 * NewsService and NewsController never need to change.
 */
@Module({
  controllers: [NewsController, CountryNewsController],
  providers: [
    NewsService,
    CountryNewsService,
    MockNewsProvider,
    GNewsProvider,
    {
      provide: NEWS_PROVIDERS,
      useFactory: (
        config: ConfigService,
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
      ): NewsProvider[] => {
        const hasGNewsKey = Boolean(config.get<string>('GNEWS_API_KEY'));
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
  exports: [NewsService],
})
export class NewsModule {}
