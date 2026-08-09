import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { MockNewsProvider } from './providers/mock-news.provider';
import { GNewsProvider } from './providers/gnews.provider';
import {
  ALL_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { CountryNewsController } from './country/country-news.controller';
import { CountryNewsService } from './country/country-news.service';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import type { NewsProvider } from './interfaces';

/**
 * Provider selection:
 *
 * Exactly one provider is active for reads at a time.
 * If GNEWS_API_KEY exists, GNews is used.
 * Otherwise the mock provider is used.
 *
 * ALL_NEWS_PROVIDERS still contains every registered provider so that
 * provider health can be reported independently of the active provider.
 */
@Module({
  controllers: [
    NewsController,
    CountryNewsController,
  ],
  providers: [
    NewsService,
    CountryNewsService,
    ArticlePersistenceService,
    MockNewsProvider,
    GNewsProvider,
    {
      provide: NEWS_PROVIDERS,
      useFactory: (
        config: ConfigService,
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
      ): NewsProvider[] => {
        const hasGNewsKey = Boolean(
          config.get<string>(
            'GNEWS_API_KEY',
          ),
        );

        return hasGNewsKey
          ? [gnewsProvider]
          : [mockNewsProvider];
      },
      inject: [
        ConfigService,
        MockNewsProvider,
        GNewsProvider,
      ],
    },
    {
      provide: ALL_NEWS_PROVIDERS,
      useFactory: (
        mockNewsProvider: MockNewsProvider,
        gnewsProvider: GNewsProvider,
      ): NewsProvider[] => [
        mockNewsProvider,
        gnewsProvider,
      ],
      inject: [
        MockNewsProvider,
        GNewsProvider,
      ],
    },
  ],
  exports: [
    NewsService,
    CountryNewsService,
  ],
})
export class NewsModule {}