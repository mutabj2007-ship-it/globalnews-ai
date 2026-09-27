import { HistoryService } from './history.service';
import type { PrismaService } from '../../database/prisma.service';

describe('HistoryService (Milestone #57)', () => {
  function makeFakePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      searchHistoryEntry: {
        create: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        ...overrides,
      },
    } as unknown as PrismaService;
  }

  /*
    MY INTELLIGENCE R1.1 — create() is gone: the ONE writer is
    recordExplicitQuestion(), reached only from the verified analysis boundary.
    The same "never anything AI-response-shaped" guarantee is pinned on it.
  */
  it('the one writer persists only query, countryCode and userId — never anything AI-response-shaped', async () => {
    const createSpy = jest.fn().mockResolvedValue({});
    const prisma = makeFakePrisma({ create: createSpy });
    const service = new HistoryService(prisma);

    await service.recordExplicitQuestion('user-1', 'Rwanda migration policy', 'RWA', new Date('2026-09-27T10:00:00.000Z'));

    const callArgs = createSpy.mock.calls[0][0];
    expect(Object.keys(callArgs.data).sort()).toEqual(['countryCode', 'createdAt', 'query', 'userId']);
    expect(callArgs.data).toMatchObject({ userId: 'user-1', query: 'Rwanda migration policy', countryCode: 'RWA' });
    for (const forbidden of ['analysis', 'response', 'articleId', 'evidence']) {
      expect(callArgs.data).not.toHaveProperty(forbidden);
    }
  });

  it('the one writer stores a null country for a plain generic question', async () => {
    const createSpy = jest.fn().mockResolvedValue({});
    const prisma = makeFakePrisma({ create: createSpy });
    const service = new HistoryService(prisma);

    await service.recordExplicitQuestion('user-1', 'What happened in the markets today?');

    expect(createSpy.mock.calls[0][0].data.countryCode).toBeNull();
  });

  it('there is no create(): nothing but the verified analysis boundary can write history', () => {
    expect((HistoryService.prototype as unknown as Record<string, unknown>).create).toBeUndefined();
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
