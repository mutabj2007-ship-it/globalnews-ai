import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { PrismaService } from '../../database/prisma.service';
import { NewsModule } from '../news/news.module';
import { ALL_NEWS_PROVIDERS } from '../news/providers/provider.tokens';
import type { NewsProvider } from '../news/interfaces';
import { AdminReadonlyController } from './admin-readonly.controller';
import { AdminSystemService } from './system/admin-system.service';
import { AdminNewsService } from './news/admin-news.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminPlatformEnabledGuard } from './admin-platform.guard';
import { AdminGuard } from './admin.guard';
import { RequireAuthGuard } from '../auth/require-auth.guard';

const reads: string[] = [];
const retainedDatabase = new Proxy(
  {},
  {
    get: (_, model: string) => {
      if (model === '$queryRaw') return async () => [{ ok: 1 }];
      return new Proxy(
        {},
        {
          get: (_, operation: string) => async () => {
            reads.push(model + '.' + operation);
            if (operation === 'findMany' || operation === 'groupBy') return [];
            if (operation === 'count') return 0;
            if (operation === 'aggregate')
              return {
                _count: { latencyMs: 0, totalTokens: 0 },
                _avg: { latencyMs: null },
                _min: { latencyMs: null },
                _max: { latencyMs: null, fetchedAt: null },
                _sum: { promptTokens: null, completionTokens: null, totalTokens: null },
              };
            throw new Error('Unexpected database operation');
          },
        },
      );
    },
  },
);
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: retainedDatabase }],
  exports: [PrismaService],
})
class RetainedDatabaseModule {}

it('real Nest HTTP Admin refreshes with real news providers perform zero acquisition', async () => {
  const transport = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('External transport forbidden'));
  const config = {
    get: (key: string) =>
      (
        ({
          NODE_ENV: 'test',
          GNEWS_API_KEY: 'offline-sentinel-not-a-credential',
          GDELT_DOC_ENABLED: 'false',
          RSS_FEEDS_ENABLED: 'false',
          ADMIN_PLATFORM_ENABLED: 'true',
        }) as Record<string, string>
      )[key],
  };
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule, RetainedDatabaseModule, NewsModule],
    controllers: [AdminReadonlyController],
    providers: [AdminSystemService, AdminNewsService, AdminAnalyticsService],
  })
    .overrideProvider(ConfigService)
    .useValue(config)
    .overrideGuard(AdminPlatformEnabledGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RequireAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(AdminGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = moduleRef.createNestApplication();
  try {
    const providers = moduleRef.get<NewsProvider[]>(ALL_NEWS_PROVIDERS);
    const acquisition = providers.flatMap((provider) =>
      (['search', 'topHeadlines'] as const).map((method) =>
        jest.spyOn(provider, method).mockRejectedValue(new Error('Provider acquisition forbidden')),
      ),
    );
    await app.init();
    for (let refresh = 0; refresh < 3; refresh++) {
      const health = await request(app.getHttpServer()).get('/admin/system/health').expect(200);
      expect(
        health.body.components.find((c: { component: string }) => c.component === 'NEWS_PROVIDER')
          .status,
      ).toBe('UNKNOWN');
      const status = await request(app.getHttpServer()).get('/admin/news/providers').expect(200);
      expect(status.body.inventory.articleCount).toBe(0);
      await request(app.getHttpServer()).get('/admin/analytics/usage').expect(200);
      await request(app.getHttpServer()).get('/admin/analytics/coverage-geography').expect(200);
      await request(app.getHttpServer()).get('/admin/users').expect(200);
      await request(app.getHttpServer()).get('/news/providers/health').expect(200);
    }
    expect(transport).not.toHaveBeenCalled();
    for (const spy of acquisition) expect(spy).not.toHaveBeenCalled();
    expect(reads.length).toBeGreaterThan(0);
  } finally {
    await app.close();
    jest.restoreAllMocks();
  }
});
