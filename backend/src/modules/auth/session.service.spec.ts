import { SessionService } from './session.service';
import { hashSessionToken } from './session-token.util';
import type { PrismaService } from '../../database/prisma.service';

describe('SessionService (Milestone #57)', () => {
  function makeFakePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      session: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        ...overrides,
      },
    } as unknown as PrismaService;
  }

  it('createSession stores only the hash of the raw token, never the raw token itself', async () => {
    const createSpy = jest.fn().mockResolvedValue(undefined);
    const prisma = makeFakePrisma({ create: createSpy });
    const service = new SessionService(prisma);

    const { rawToken } = await service.createSession('user-1');

    const createCallArgs = createSpy.mock.calls[0][0];
    expect(createCallArgs.data.tokenHash).toBe(hashSessionToken(rawToken));
    expect(createCallArgs.data.tokenHash).not.toBe(rawToken);
    expect(createCallArgs.data).not.toHaveProperty('rawToken');
    expect(createCallArgs.data).not.toHaveProperty('token');
  });

  it('createSession returns the raw token exactly once, for the caller to set as the cookie value', async () => {
    const prisma = makeFakePrisma();
    const service = new SessionService(prisma);

    const result = await service.createSession('user-1');

    expect(typeof result.rawToken).toBe('string');
    expect(result.rawToken).toHaveLength(64);
  });

  it('validateSession resolves to the userId for a real, unexpired session', async () => {
    const prisma = makeFakePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });
    const service = new SessionService(prisma);

    const result = await service.validateSession('some-raw-token');

    expect(result).toEqual({ userId: 'user-1' });
  });

  it('validateSession returns null for an unknown token', async () => {
    const prisma = makeFakePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const service = new SessionService(prisma);

    expect(await service.validateSession('unknown-token')).toBeNull();
  });

  it('validateSession rejects (returns null) an expired session, even though the row exists', async () => {
    const deleteSpy = jest.fn().mockResolvedValue(undefined);
    const prisma = makeFakePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 60_000),
      }),
      delete: deleteSpy,
    });
    const service = new SessionService(prisma);

    const result = await service.validateSession('expired-token');

    expect(result).toBeNull();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('deleteSession (sign-out) deletes by the hash of the provided raw token', async () => {
    const deleteManySpy = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makeFakePrisma({ deleteMany: deleteManySpy });
    const service = new SessionService(prisma);

    await service.deleteSession('some-raw-token');

    expect(deleteManySpy).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken('some-raw-token') } });
  });
});
