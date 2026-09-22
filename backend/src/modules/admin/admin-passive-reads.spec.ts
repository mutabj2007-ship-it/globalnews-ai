import { AdminReadonlyController } from './admin-readonly.controller';
import { AdminSystemService } from './system/admin-system.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminNewsService } from './news/admin-news.service';
import { PrismaService } from '../../database/prisma.service';
import { NewsService } from '../news/news.service';
import { ConfigService } from '@nestjs/config';

it('repeated R2 system-health route reads never enter provider acquisition or health fan-out', async () => {
  const providerCalls = jest.fn(() => {
    throw new Error('provider access forbidden');
  });
  const news = new Proxy({}, { get: () => providerCalls }) as NewsService;
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    article: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _max: { fetchedAt: null } }),
    },
  } as unknown as PrismaService;
  const config = { get: () => undefined } as unknown as ConfigService;
  const system = new AdminSystemService(prisma, news, config);
  const controller = new AdminReadonlyController(
    system,
    {} as AdminNewsService,
    {} as AdminAnalyticsService,
  );
  for (let i = 0; i < 3; i++) {
    const result = await controller.systemHealth();
    expect(result.ingestion?.articleCount).toBe(0);
    expect(result.components.find((c) => c.component === 'NEWS_PROVIDER')).toMatchObject({
      status: 'UNKNOWN',
      lastProbeAt: null,
      detail: 'no-probe-configured',
    });
  }
  expect(providerCalls).not.toHaveBeenCalled();
});

it('usage, coverage and bounded users read through database methods only on refresh', async () => {
  const reads: string[] = [];
  const prisma = new Proxy(
    {},
    {
      get: (_, model: string) =>
        new Proxy(
          {},
          {
            get: (_, op: string) => async () => {
              reads.push(model + '.' + op);
              if (op === 'findMany' || op === 'groupBy') return [];
              if (op === 'aggregate')
                return {
                  _count: { latencyMs: 0, totalTokens: 0 },
                  _avg: { latencyMs: null },
                  _min: { latencyMs: null },
                  _max: { latencyMs: null },
                  _sum: { promptTokens: null, completionTokens: null, totalTokens: null },
                };
              if (op === 'count') return 0;
              throw new Error('unexpected non-read operation');
            },
          },
        ),
    },
  ) as PrismaService;
  const service = new AdminAnalyticsService(prisma);
  const controller = new AdminReadonlyController(
    {} as AdminSystemService,
    {} as AdminNewsService,
    service,
  );
  const transport = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('network forbidden'));
  try {
    for (let i = 0; i < 3; i++) {
      const usage = await controller.analyticsUsage();
      expect(usage.accounts).not.toBeNull();
      expect(usage.analysis?.tokens.sampleCount).toBe(0);
      expect(usage.analysis?.tokens.totalTokens).toBeUndefined();
      expect((await controller.coverageGeography()).countries).toEqual([]);
      const users = await controller.users('1', '99999');
      expect(users.accounts).toEqual([]);
      expect(users.pageSize).toBeLessThanOrEqual(100);
    }
    expect(transport).not.toHaveBeenCalled();
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((r) => /\.(count|groupBy|findMany|aggregate)$/.test(r))).toBe(true);
  } finally {
    transport.mockRestore();
  }
});

it('support queue and missing-ticket reads use retained data without network acquisition', async () => {
  const { AdminSupportService } = await import('../support/admin-support.service');
  const prisma = {
    supportTicket: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaService;
  const service = new AdminSupportService(prisma);
  const transport = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('network forbidden'));
  try {
    for (let i = 0; i < 3; i++) {
      expect((await service.queue()).tickets).toEqual([]);
      await expect(service.ticket('missing')).rejects.toThrow();
    }
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    expect(transport).not.toHaveBeenCalled();
  } finally {
    transport.mockRestore();
  }
});
