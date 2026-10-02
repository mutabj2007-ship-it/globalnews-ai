import type { PrismaService } from '../../database/prisma.service';
import { DataRetentionService } from './data-retention.service';
import { resolveRetentionPolicy } from './retention-policy';

/** CTO checkpoint 2 — destructive retention is FAIL-CLOSED: only an explicit "true" enables it. */
describe('retention sweep switch', () => {
  it.each([
    ['unset', {}, false],
    ['"false"', { RETENTION_SWEEP_ENABLED: 'false' }, false],
    ['"true"', { RETENTION_SWEEP_ENABLED: 'true' }, true],
    ['empty string', { RETENTION_SWEEP_ENABLED: '' }, false],
    ['"TRUE" (not exact)', { RETENTION_SWEEP_ENABLED: 'TRUE' }, false],
    ['"1"', { RETENTION_SWEEP_ENABLED: '1' }, false],
  ])('%s → enabled=%s', (_label, env, expected) => {
    expect(resolveRetentionPolicy(env as NodeJS.ProcessEnv).enabled).toBe(expected);
  });

  it('a disabled sweep touches no table and arms no timer', async () => {
    const prisma = new Proxy(
      {},
      {
        get: () => {
          throw new Error('database touched while retention is OFF');
        },
      },
    ) as unknown as PrismaService;
    const off = new DataRetentionService(prisma, resolveRetentionPolicy({}));
    const result = await off.sweep(new Date('2026-10-03T12:00:00Z'));
    expect(Object.values(result).every((n) => n === 0)).toBe(true);
    const spy = jest.spyOn(global, 'setInterval');
    off.onApplicationBootstrap();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('defaults are the ruled Beta policy', () => {
    const p = resolveRetentionPolicy({});
    expect([
      p.accountConversationDays,
      p.supportResolvedDays,
      p.usageDays,
      p.rateLimitGraceDays,
    ]).toEqual([365, 730, 90, 7]);
  });
});
