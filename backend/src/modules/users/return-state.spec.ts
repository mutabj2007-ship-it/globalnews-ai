import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { UsersService } from './users.service';
import { RETURN_VISIT_MIN_INTERVAL_MS } from './return-state.constants';
import type { TelemetryService } from '../telemetry/telemetry.service';

/**
 * R1/T2 — the return-state contract, exercised against an in-memory
 * double in the style S2 established.
 *
 * The double COUNTS WRITES, because the write count is the point. A test
 * that only checked the returned value would pass just as happily
 * against an implementation that wrote on every single call, which is
 * precisely the write amplification this design exists to avoid.
 */
interface UserRow {
  id: string;
  lastSeenAt: Date | null;
}

function buildDouble(rows: UserRow[]) {
  let updates = 0;
  const events: Array<{ name: string; userId: string }> = [];

  const prisma = {
    user: {
      findUnique: ({
        where,
      }: {
        where: { id: string };
      }): Promise<{ lastSeenAt: Date | null } | null> => {
        const row = rows.find((candidate) => candidate.id === where.id);
        return Promise.resolve(row ? { lastSeenAt: row.lastSeenAt } : null);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { lastSeenAt: Date };
      }): Promise<UserRow> => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) return Promise.reject(new Error('no such user'));
        updates += 1;
        row.lastSeenAt = data.lastSeenAt;
        return Promise.resolve(row);
      },
    },
  } as unknown as PrismaService;

  const telemetry = {
    recordAccountEvent: (name: string, userId: string): Promise<void> => {
      events.push({ name, userId });
      return Promise.resolve();
    },
  } as unknown as TelemetryService;

  return {
    service: new UsersService(prisma, telemetry),
    stats: () => ({ updates, events }),
  };
}

const at = (isoLike: string): Date => new Date(isoLike);

describe('R1/T2 — the first-ever visit', () => {
  it('reports NULL and makes no claim about what is new', async () => {
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: null }];
    const { service } = buildDouble(rows);

    const result = await service.recordSeen('user-1', at('2026-08-23T10:00:00.000Z'));

    expect(result.previousSeenAt).toBeNull();
    expect(result.firstVisit).toBe(true);
  });

  it('records the visit, so the SECOND visit has something to compare against', async () => {
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: null }];
    const { service, stats } = buildDouble(rows);

    await service.recordSeen('user-1', at('2026-08-23T10:00:00.000Z'));

    expect(stats().updates).toBe(1);
    expect(rows[0].lastSeenAt).toEqual(at('2026-08-23T10:00:00.000Z'));
  });

  it('NULL is never reported as "everything is new"', async () => {
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: null }];
    const { service } = buildDouble(rows);

    const result = await service.recordSeen('user-1', at('2026-08-23T10:00:00.000Z'));

    // There is no field here that could be read as a window start. The
    // caller is told there is no previous visit, full stop.
    expect(result.previousSeenAt).toBeNull();
    expect(Object.keys(result).sort()).toEqual(['firstVisit', 'previousSeenAt', 'recorded']);
  });
});

describe('R1/T2 — read before write', () => {
  it('returns the value AS IT WAS BEFORE this visit, not the value it just wrote', async () => {
    const previous = at('2026-08-23T08:00:00.000Z');
    const now = at('2026-08-23T10:00:00.000Z');
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: previous }];
    const { service } = buildDouble(rows);

    const result = await service.recordSeen('user-1', now);

    // The whole contract in one assertion: the caller receives 08:00,
    // the stored value becomes 10:00. An implementation that read after
    // writing would return 10:00 and every surface would conclude that
    // nothing had happened since the user was last here.
    expect(result.previousSeenAt).toBe(previous.toISOString());
    expect(rows[0].lastSeenAt).toEqual(now);
    expect(result.firstVisit).toBe(false);
  });
});

describe('R1/T2 — the write throttle', () => {
  it('does NOT write when the interval has not elapsed', async () => {
    const previous = at('2026-08-23T10:00:00.000Z');
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: previous }];
    const { service, stats } = buildDouble(rows);

    const soon = new Date(previous.getTime() + RETURN_VISIT_MIN_INTERVAL_MS - 1000);
    const result = await service.recordSeen('user-1', soon);

    expect(stats().updates).toBe(0);
    expect(rows[0].lastSeenAt).toEqual(previous);
    expect(result.recorded).toBe(false);
    // The caller still gets a correct answer — the throttle saves a
    // write, it does not degrade the response.
    expect(result.previousSeenAt).toBe(previous.toISOString());
  });

  it('DOES write once the interval has elapsed', async () => {
    const previous = at('2026-08-23T10:00:00.000Z');
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: previous }];
    const { service, stats } = buildDouble(rows);

    const later = new Date(previous.getTime() + RETURN_VISIT_MIN_INTERVAL_MS + 1000);
    const result = await service.recordSeen('user-1', later);

    expect(stats().updates).toBe(1);
    expect(result.recorded).toBe(true);
  });

  it('NO WRITE AMPLIFICATION: twenty visits in an hour produce at most two writes', async () => {
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: null }];
    const { service, stats } = buildDouble(rows);

    const start = at('2026-08-23T10:00:00.000Z').getTime();
    const oneHour = 60 * 60 * 1000;

    for (let visit = 0; visit < 20; visit += 1) {
      await service.recordSeen('user-1', new Date(start + (visit * oneHour) / 20));
    }

    // One for the first-ever visit, one when the interval elapses. Not
    // twenty. This is the assertion the whole throttle exists for.
    expect(stats().updates).toBeLessThanOrEqual(2);
  });
});

describe('R1/T2 — semantic independence from the article contract', () => {
  it('the service derives lastSeenAt from the clock, never from content', () => {
    const source = readSource();

    // R0.5 — exposing firstSeenAt on the live path — is E1's, and this
    // lane must not pre-empt it by inventing a first observation.
    expect(source).not.toContain('publishedAt');
    expect(source).not.toContain('firstSeenAt');
    expect(source).not.toContain('fetchedAt');
  });

  it('the interval is one exported constant, not a scattered literal', () => {
    const source = readSource();

    expect(source).toContain('RETURN_VISIT_MIN_INTERVAL_MS');
    expect(RETURN_VISIT_MIN_INTERVAL_MS).toBe(30 * 60 * 1000);
    // A raw millisecond literal in the service would mean the test and
    // the code could disagree about what "thirty minutes" is.
    expect(source).not.toMatch(/1800000|30 \* 60 \* 1000/);
  });
});

describe('R1/T2 — return_visit is emitted only for a real recorded visit', () => {
  it('emits on a first visit and on a recorded return', async () => {
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: null }];
    const { service, stats } = buildDouble(rows);

    await service.recordSeen('user-1', at('2026-08-23T10:00:00.000Z'));
    await service.recordSeen('user-1', at('2026-08-23T12:00:00.000Z'));

    expect(stats().events).toEqual([
      { name: 'return_visit', userId: 'user-1' },
      { name: 'return_visit', userId: 'user-1' },
    ]);
  });

  it('emits NOTHING on a throttled refresh — the count is visits, not page loads', async () => {
    const previous = at('2026-08-23T10:00:00.000Z');
    const rows: UserRow[] = [{ id: 'user-1', lastSeenAt: previous }];
    const { service, stats } = buildDouble(rows);

    await service.recordSeen('user-1', new Date(previous.getTime() + 60_000));

    expect(stats().events).toEqual([]);
  });
});

describe('R1/T2 — a user that does not exist', () => {
  it('is a bare 404 rather than a silently created row', async () => {
    const { service, stats } = buildDouble([]);

    await expect(service.recordSeen('ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(stats().updates).toBe(0);
  });
});

function readSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('path') as typeof import('path');
  return readFileSync(join(__dirname, 'users.service.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
