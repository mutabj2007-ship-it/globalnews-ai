import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import { FollowsService } from './follows.service';
import { MAX_COUNTRY_FOLLOWS } from './follows.constants';

/**
 * R1/T3 — the follow service, exercised against an in-memory double that
 * ENFORCES THE COMPOSITE UNIQUE, in the style S2 established.
 *
 * The double enforcing the constraint is what makes an idempotency test
 * meaningful: a double that silently allowed duplicates would let a
 * broken implementation pass. It does not, however, prove PostgreSQL
 * enforces it — that is a property of the database and is verified by
 * the live gate, not here.
 */
export interface FollowRow {
  id: string;
  userId: string;
  countryCode: string;
  createdAt: Date;
}

/**
 * The two shapes a PostgreSQL serialization failure was OBSERVED to take
 * in S2's live gate, reproduced exactly. The commit-time one carries no
 * error code at all, which is what made it escape a naive filter.
 */
function buildConflict(kind: 'P2034' | 'commit-time' | 'other'): Error {
  if (kind === 'P2034') {
    const error = new Error('Invalid `tx.countryFollow.create()` invocation') as Error & {
      code: string;
      meta: unknown;
    };
    error.code = 'P2034';
    error.meta = {
      driverAdapterError: {
        cause: { originalCode: '40001', kind: 'TransactionWriteConflict' },
      },
    };
    return error;
  }
  if (kind === 'commit-time') {
    const error = new Error('TransactionWriteConflict') as Error & { name: string };
    error.name = 'DriverAdapterError';
    return error;
  }
  const error = new Error('ConnectionClosed') as Error & { name: string };
  error.name = 'DriverAdapterError';
  return error;
}

export function buildFollowDouble(
  rows: FollowRow[],
  options: { failAttempts?: Array<'P2034' | 'commit-time' | 'other'> } = {},
) {
  let sequence = 0;
  let attempts = 0;
  const isolationLevels: Array<string | undefined> = [];
  const events: Array<{ name: string; userId: string; countryCode?: string }> = [];

  const client = {
    countryFollow: {
      findUnique: ({
        where,
      }: {
        where: { userId_countryCode: { userId: string; countryCode: string } };
      }): Promise<FollowRow | null> =>
        Promise.resolve(
          rows.find(
            (row) =>
              row.userId === where.userId_countryCode.userId &&
              row.countryCode === where.userId_countryCode.countryCode,
          ) ?? null,
        ),

      findMany: ({
        where,
        take,
      }: {
        where: { userId: string };
        take: number;
      }): Promise<FollowRow[]> =>
        Promise.resolve(
          rows
            .filter((row) => row.userId === where.userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, take),
        ),

      count: ({ where }: { where: { userId: string } }): Promise<number> =>
        Promise.resolve(rows.filter((row) => row.userId === where.userId).length),

      create: ({ data }: { data: { userId: string; countryCode: string } }): Promise<FollowRow> => {
        const duplicate = rows.some(
          (row) => row.userId === data.userId && row.countryCode === data.countryCode,
        );
        if (duplicate) {
          // What PostgreSQL raises for @@unique([userId, countryCode]).
          const error = new Error('Unique constraint failed') as Error & { code: string };
          error.code = 'P2002';
          return Promise.reject(error);
        }
        sequence += 1;
        const row: FollowRow = {
          id: `follow-${sequence}`,
          userId: data.userId,
          countryCode: data.countryCode,
          createdAt: new Date(Date.UTC(2026, 7, 23, 10, 0, sequence)),
        };
        rows.push(row);
        return Promise.resolve(row);
      },

      deleteMany: ({
        where,
      }: {
        where: { userId: string; countryCode: string };
      }): Promise<{ count: number }> => {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (
            rows[index].userId === where.userId &&
            rows[index].countryCode === where.countryCode
          ) {
            rows.splice(index, 1);
          }
        }
        return Promise.resolve({ count: before - rows.length });
      },
    },

    $transaction: <T>(
      fn: (tx: unknown) => Promise<T>,
      opts?: { isolationLevel?: string },
    ): Promise<T> => {
      attempts += 1;
      isolationLevels.push(opts?.isolationLevel);
      const injected = options.failAttempts?.[attempts - 1];
      if (injected) {
        return Promise.reject(buildConflict(injected));
      }
      return fn(client);
    },
  };

  const telemetry = {
    recordAccountEvent: (
      name: string,
      userId: string,
      dimensions?: { countryCode?: string },
    ): Promise<void> => {
      events.push({ name, userId, countryCode: dimensions?.countryCode });
      return Promise.resolve();
    },
  } as unknown as TelemetryService;

  return {
    service: new FollowsService(client as unknown as PrismaService, telemetry),
    events: () => events,
    stats: () => ({ attempts, isolationLevels }),
  };
}

describe('R1/T3 — following a country', () => {
  it('stores the follow for the calling user', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);

    const view = await service.follow('user-1', 'POL');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'user-1', countryCode: 'POL' });
    expect(view.countryCode).toBe('POL');
  });

  it('IS IDEMPOTENT — a repeat follow is a no-op, not an error', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);

    const first = await service.follow('user-1', 'POL');
    const second = await service.follow('user-1', 'POL');

    expect(rows).toHaveLength(1);
    // The ORIGINAL createdAt survives. A double-clicked button must not
    // rewrite when the user first followed a country.
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('emits follow_created ONLY on a real state change', async () => {
    const rows: FollowRow[] = [];
    const { service, events } = buildFollowDouble(rows);

    await service.follow('user-1', 'POL');
    await service.follow('user-1', 'POL');

    expect(events()).toEqual([{ name: 'follow_created', userId: 'user-1', countryCode: 'POL' }]);
  });

  it('two users may follow the same country', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);

    await service.follow('user-1', 'POL');
    await service.follow('user-2', 'POL');

    expect(rows).toHaveLength(2);
  });
});

describe('R1/T3 — the resource ceiling', () => {
  const fill = (rows: FollowRow[], userId: string, count: number): void => {
    for (let index = 0; index < count; index += 1) {
      rows.push({
        id: `seed-${userId}-${index}`,
        userId,
        countryCode: `X${String(index).padStart(2, '0')}`,
        createdAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index)),
      });
    }
  };

  it('refuses the follow that would exceed it', async () => {
    const rows: FollowRow[] = [];
    fill(rows, 'user-1', MAX_COUNTRY_FOLLOWS);
    const { service } = buildFollowDouble(rows);

    await expect(service.follow('user-1', 'POL')).rejects.toBeInstanceOf(HttpException);
    expect(rows.filter((row) => row.userId === 'user-1')).toHaveLength(MAX_COUNTRY_FOLLOWS);
  });

  it('is per user — one account at the ceiling does not block another', async () => {
    const rows: FollowRow[] = [];
    fill(rows, 'user-1', MAX_COUNTRY_FOLLOWS);
    const { service } = buildFollowDouble(rows);

    await expect(service.follow('user-2', 'POL')).resolves.toMatchObject({ countryCode: 'POL' });
  });

  it('a REPEAT follow still succeeds at the ceiling — capacity must not make an existing follow unrepeatable', async () => {
    const rows: FollowRow[] = [];
    fill(rows, 'user-1', MAX_COUNTRY_FOLLOWS);
    const existing = rows[0].countryCode;
    const { service } = buildFollowDouble(rows);

    await expect(service.follow('user-1', existing)).resolves.toMatchObject({
      countryCode: existing,
    });
  });

  /**
   * THE ASSERTION THIS REPLACED WAS TRUE AND INSUFFICIENT, AND THAT IS
   * WORTH RECORDING.
   *
   * It checked only that the count and the insert share a transaction.
   * They did — and a live PostgreSQL 16 probe still drove the count to
   * 51, because Prisma's default isolation inside `$transaction` is READ
   * COMMITTED, under which two concurrent follows can both observe 49
   * and both commit. The same probe at SERIALIZABLE ended at 50 with one
   * transaction aborted by SQLSTATE 40001.
   *
   * A shared transaction is NECESSARY AND NOT SUFFICIENT. What follows
   * asserts the thing that actually holds the ceiling.
   */
  it('the count and the insert share one transaction AT SERIALIZABLE', async () => {
    const rows: FollowRow[] = [];
    const { service, stats } = buildFollowDouble(rows);

    await service.follow('user-1', 'POL');

    expect(stats().isolationLevels).toEqual(['Serializable']);

    const source = readFollowSource();
    const block = source.slice(source.indexOf('runFollowTransaction('), source.length);
    const txAt = block.indexOf('$transaction');
    expect(txAt).toBeGreaterThan(-1);
    expect(block.indexOf('.count(')).toBeGreaterThan(txAt);
    expect(block.indexOf('.create(')).toBeGreaterThan(txAt);
  });

  it('retries a serialization failure detected MID-STATEMENT (P2034)', async () => {
    const rows: FollowRow[] = [];
    const { service, stats } = buildFollowDouble(rows, { failAttempts: ['P2034'] });

    await expect(service.follow('user-1', 'POL')).resolves.toMatchObject({ countryCode: 'POL' });
    expect(stats().attempts).toBe(2);
  });

  it('retries a serialization failure detected AT COMMIT — the shape that carries no error code', async () => {
    const rows: FollowRow[] = [];
    const { service, stats } = buildFollowDouble(rows, { failAttempts: ['commit-time'] });

    // This is the shape that escaped S2's first retry filter and reached
    // users as an unhandled error. It has no `code` at all.
    await expect(service.follow('user-1', 'POL')).resolves.toMatchObject({ countryCode: 'POL' });
    expect(stats().attempts).toBe(2);
  });

  it('does NOT retry an unrelated driver error — narrowness is the point', async () => {
    const rows: FollowRow[] = [];
    const { service, stats } = buildFollowDouble(rows, { failAttempts: ['other'] });

    // A closed connection retried into silence is worse than a failure.
    await expect(service.follow('user-1', 'POL')).rejects.toThrow('ConnectionClosed');
    expect(stats().attempts).toBe(1);
  });

  it('the retry budget is bounded — it does not loop forever', async () => {
    const rows: FollowRow[] = [];
    const { service, stats } = buildFollowDouble(rows, {
      failAttempts: ['P2034', 'P2034', 'P2034', 'P2034', 'P2034', 'P2034', 'P2034'],
    });

    await expect(service.follow('user-1', 'POL')).rejects.toBeDefined();
    expect(stats().attempts).toBeLessThanOrEqual(5);
  });
});

describe('R1/T3 — unfollowing', () => {
  it('removes the caller’s own follow', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);
    await service.follow('user-1', 'POL');

    await service.unfollow('user-1', 'POL');

    expect(rows).toHaveLength(0);
  });

  it('emits follow_removed only when something was actually removed', async () => {
    const rows: FollowRow[] = [];
    const { service, events } = buildFollowDouble(rows);
    await service.follow('user-1', 'POL');

    await service.unfollow('user-1', 'POL');
    await service.unfollow('user-1', 'POL');

    expect(events().filter((event) => event.name === 'follow_removed')).toHaveLength(1);
  });

  it('unfollowing something never followed is a silent no-op', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);

    await expect(service.unfollow('user-1', 'POL')).resolves.toBeUndefined();
  });
});

describe('R1/T3 — the list', () => {
  it('returns the caller’s follows newest first, with the ceiling echoed', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);
    await service.follow('user-1', 'POL');
    await service.follow('user-1', 'DEU');

    const response = await service.listForUser('user-1');

    expect(response.follows.map((follow) => follow.countryCode)).toEqual(['DEU', 'POL']);
    expect(response.maxFollows).toBe(MAX_COUNTRY_FOLLOWS);
  });

  it('carries no user identifier and no row id', async () => {
    const rows: FollowRow[] = [];
    const { service } = buildFollowDouble(rows);
    await service.follow('user-secret', 'POL');

    const response = await service.listForUser('user-secret');

    expect(Object.keys(response.follows[0]).sort()).toEqual(['countryCode', 'createdAt']);
    expect(JSON.stringify(response)).not.toContain('user-secret');
  });
});

function readFollowSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('path') as typeof import('path');
  return readFileSync(join(__dirname, 'follows.service.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
