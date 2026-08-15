import { UsersService } from './users.service';
import type { PrismaService } from '../../database/prisma.service';

describe('UsersService (Milestone #57)', () => {
  function makeFakePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      },
    } as unknown as PrismaService;
  }

  it('getById returns the user summary for an existing user', async () => {
    const findUniqueSpy = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const prisma = makeFakePrisma({ findUnique: findUniqueSpy });
    const service = new UsersService(prisma);

    const result = await service.getById('user-1');

    expect(result?.email).toBe('user@example.com');
  });

  it('getById never selects a raw session token or any field outside the intended summary shape', async () => {
    const findUniqueSpy = jest.fn().mockResolvedValue(null);
    const prisma = makeFakePrisma({ findUnique: findUniqueSpy });
    const service = new UsersService(prisma);

    await service.getById('user-1');

    const callArgs = findUniqueSpy.mock.calls[0][0];
    expect(callArgs.select).toEqual({ id: true, email: true, displayName: true, createdAt: true });
  });

  it('deleteAccount relies on a single Prisma delete of the User row \u2014 the same operation the schema\u2019s onDelete: Cascade declarations use to remove all related identities/sessions/history in one step', async () => {
    const deleteSpy = jest.fn().mockResolvedValue(undefined);
    const prisma = makeFakePrisma({ delete: deleteSpy });
    const service = new UsersService(prisma);

    await service.deleteAccount('user-1');

    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
