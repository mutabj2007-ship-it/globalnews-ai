import { HistoryService } from './history.service';
import type { PrismaService } from '../../database/prisma.service';

describe('HistoryService (Milestone #57)', () => {
  function makeFakePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      searchHistoryEntry: {
        create: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        ...overrides,
      },
    } as unknown as PrismaService;
  }

  it('create persists only query, countryCode, and userId \u2014 never anything AI-response-shaped', async () => {
    const createSpy = jest.fn().mockResolvedValue({
      id: 'h1',
      query: 'Rwanda migration policy',
      countryCode: 'RWA',
      createdAt: new Date(),
    });
    const prisma = makeFakePrisma({ create: createSpy });
    const service = new HistoryService(prisma);

    await service.create('user-1', 'Rwanda migration policy', 'RWA');

    const callArgs = createSpy.mock.calls[0][0];
    expect(callArgs.data).toEqual({ userId: 'user-1', query: 'Rwanda migration policy', countryCode: 'RWA' });
    expect(callArgs.data).not.toHaveProperty('analysis');
    expect(callArgs.data).not.toHaveProperty('response');
    expect(callArgs.data).not.toHaveProperty('articleId');
    expect(callArgs.data).not.toHaveProperty('evidence');
  });

  it('create works with countryCode omitted (a plain generic question)', async () => {
    const createSpy = jest.fn().mockResolvedValue({
      id: 'h1',
      query: 'What happened in the markets today?',
      countryCode: null,
      createdAt: new Date(),
    });
    const prisma = makeFakePrisma({ create: createSpy });
    const service = new HistoryService(prisma);

    await service.create('user-1', 'What happened in the markets today?', undefined);

    expect(createSpy.mock.calls[0][0].data.countryCode).toBeUndefined();
  });

  it('listForUser scopes strictly to the requesting user\u2019s own userId \u2014 the sole safeguard preventing cross-user history access', async () => {
    const findManySpy = jest.fn().mockResolvedValue([]);
    const prisma = makeFakePrisma({ findMany: findManySpy });
    const service = new HistoryService(prisma);

    await service.listForUser('user-1');

    expect(findManySpy.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
  });

  it('listForUser orders most-recent-first', async () => {
    const findManySpy = jest.fn().mockResolvedValue([]);
    const prisma = makeFakePrisma({ findMany: findManySpy });
    const service = new HistoryService(prisma);

    await service.listForUser('user-1');

    expect(findManySpy.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('clearForUser deletes only the requesting user\u2019s own history rows', async () => {
    const deleteManySpy = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = makeFakePrisma({ deleteMany: deleteManySpy });
    const service = new HistoryService(prisma);

    await service.clearForUser('user-1');

    expect(deleteManySpy).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
