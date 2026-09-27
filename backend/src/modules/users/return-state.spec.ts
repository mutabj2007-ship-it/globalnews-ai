import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { UsersService } from './users.service';
import {
  RETURN_VISIT_MIN_INTERVAL_MS,
  VISIT_ACTIVITY_TOUCH_INTERVAL_MS,
} from './return-state.constants';
import type { TelemetryService } from '../telemetry/telemetry.service';

/**
 * R1/T2 + MY INTELLIGENCE R1 — the return-state contract with the stable
 * visit boundary, exercised against an in-memory double that implements
 * updateMany as a real COMPARE-AND-SET on lastSeenAt.
 *
 * The double counts writes and events, because the write count and the
 * "rotates exactly once" property are the point — a test that only checked
 * returned values would pass against an implementation that rewrote the
 * boundary on every tab.
 */
interface UserRow {
  id: string;
  lastSeenAt: Date | null;
  visitBoundaryAt: Date | null;
}

function buildDouble(rows: UserRow[]) {
  let writes = 0;
  const events: Array<{ name: string; userId: string }> = [];

  const sameInstant = (a: Date | null, b: Date | null) =>
    a === null || b === null ? a === b : a.getTime() === b.getTime();

  const prisma = {
    user: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        return Promise.resolve(
          row ? { lastSeenAt: row.lastSeenAt, visitBoundaryAt: row.visitBoundaryAt } : null,
        );
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; lastSeenAt: Date | null };
        data: { lastSeenAt: Date; visitBoundaryAt?: Date };
      }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row || !sameInstant(row.lastSeenAt, where.lastSeenAt)) return Promise.resolve({ count: 0 });
        writes += 1;
        row.lastSeenAt = data.lastSeenAt;
        if (data.visitBoundaryAt !== undefined) row.visitBoundaryAt = data.visitBoundaryAt;
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaService;

  const telemetry = {
    recordAccountEvent: (name: string, userId: string): Promise<void> => {
      events.push({ name, userId });
      return Promise.resolve();
    },
  } as unknown as TelemetryService;

  return { service: new UsersService(prisma, telemetry), stats: () => ({ writes, events }) };
}

const at = (iso: string): Date => new Date(iso);
const plus = (date: Date, ms: number): Date => new Date(date.getTime() + ms);
const MIN = 60_000;
const user = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user-1',
  lastSeenAt: null,
  visitBoundaryAt: null,
  ...overrides,
});

describe('first-ever visit', () => {
  it('reports previousSeenAt = null, firstVisit, and records lastSeenAt', async () => {
    const rows = [user()];
    const { service } = buildDouble(rows);
    const t0 = at('2026-09-27T10:00:00.000Z');

    const result = await service.recordSeen('user-1', t0);

    expect(result).toEqual({ previousSeenAt: null, firstVisit: true, recorded: true });
    expect(rows[0].lastSeenAt).toEqual(t0);
    expect(rows[0].visitBoundaryAt).toBeNull();
  });

  it('a reload inside the first visit still makes no return claim', async () => {
    const rows = [user()];
    const { service } = buildDouble(rows);
    const t0 = at('2026-09-27T10:00:00.000Z');

    await service.recordSeen('user-1', t0);
    const reload = await service.recordSeen('user-1', plus(t0, 2 * MIN));

    expect(reload.previousSeenAt).toBeNull();
    expect(reload.firstVisit).toBe(true);
  });
});

describe('same visit — the boundary never moves', () => {
  it('a same-visit reload reports the SAME boundary, not the start of this visit', async () => {
    const boundary = at('2026-09-26T08:00:00.000Z');
    const visitStart = at('2026-09-27T10:00:00.000Z');
    const rows = [user({ lastSeenAt: visitStart, visitBoundaryAt: boundary })];
    const { service } = buildDouble(rows);

    const first = await service.recordSeen('user-1', plus(visitStart, 1 * MIN));
    const second = await service.recordSeen('user-1', plus(visitStart, 20 * MIN));

    expect(first.previousSeenAt).toBe(boundary.toISOString());
    expect(second.previousSeenAt).toBe(boundary.toISOString());
    expect(rows[0].visitBoundaryAt).toEqual(boundary);
  });

  it('a second tab inside the visit reads the same boundary and does not rotate it', async () => {
    const boundary = at('2026-09-26T08:00:00.000Z');
    const visitStart = at('2026-09-27T10:00:00.000Z');
    const rows = [user({ lastSeenAt: visitStart, visitBoundaryAt: boundary })];
    const { service, stats } = buildDouble(rows);

    const [tabA, tabB] = await Promise.all([
      service.recordSeen('user-1', plus(visitStart, 3 * MIN)),
      service.recordSeen('user-1', plus(visitStart, 3 * MIN)),
    ]);

    expect(tabA.previousSeenAt).toBe(boundary.toISOString());
    expect(tabB.previousSeenAt).toBe(boundary.toISOString());
    expect(rows[0].visitBoundaryAt).toEqual(boundary);
    expect(stats().events).toEqual([]);
  });

  it('lastSeenAt is touched at most every 5 minutes inside a visit', async () => {
    const visitStart = at('2026-09-27T10:00:00.000Z');
    const rows = [user({ lastSeenAt: visitStart, visitBoundaryAt: at('2026-09-26T08:00:00.000Z') })];
    const { service, stats } = buildDouble(rows);

    const early = await service.recordSeen('user-1', plus(visitStart, 4 * MIN));
    expect(early.recorded).toBe(false);
    expect(stats().writes).toBe(0);

    const later = await service.recordSeen('user-1', plus(visitStart, VISIT_ACTIVITY_TOUCH_INTERVAL_MS));
    expect(later.recorded).toBe(true);
    expect(rows[0].lastSeenAt).toEqual(plus(visitStart, VISIT_ACTIVITY_TOUCH_INTERVAL_MS));
  });

  it('30+ minutes of CONTINUOUS activity is one visit, never a return', async () => {
    const boundary = at('2026-09-26T08:00:00.000Z');
    const visitStart = at('2026-09-27T10:00:00.000Z');
    const rows = [user({ lastSeenAt: visitStart, visitBoundaryAt: boundary })];
    const { service, stats } = buildDouble(rows);

    for (let minute = 5; minute <= 90; minute += 5) {
      const result = await service.recordSeen('user-1', plus(visitStart, minute * MIN));
      expect(result.previousSeenAt).toBe(boundary.toISOString());
    }
    expect(rows[0].visitBoundaryAt).toEqual(boundary);
    expect(stats().events).toEqual([]);
    /* Bounded writes: one per 5 minutes of activity, never one per request. */
    expect(stats().writes).toBeLessThanOrEqual(18);
  });
});

describe('a real new visit', () => {
  it('after a ≥30-minute gap, the old lastSeenAt becomes the boundary exactly once', async () => {
    const lastActivity = at('2026-09-27T10:00:00.000Z');
    const rows = [user({ lastSeenAt: lastActivity, visitBoundaryAt: at('2026-09-26T08:00:00.000Z') })];
    const { service, stats } = buildDouble(rows);
    const returnAt = plus(lastActivity, RETURN_VISIT_MIN_INTERVAL_MS);

    const result = await service.recordSeen('user-1', returnAt);

    expect(result).toEqual({ previousSeenAt: lastActivity.toISOString(), firstVisit: false, recorded: true });
    expect(rows[0].visitBoundaryAt).toEqual(lastActivity);
    expect(rows[0].lastSeenAt).toEqual(returnAt);
    expect(stats().events).toEqual([{ name: 'return_visit', userId: 'user-1' }]);

    const reload = await service.recordSeen('user-1', plus(returnAt, 1 * MIN));
    expect(reload.previousSeenAt).toBe(lastActivity.toISOString());
  });

  it('CONCURRENT new-visit tabs rotate the boundary exactly once (compare-and-set)', async () => {
    const lastActivity = at('2026-09-27T10:00:00.000Z');
    const rows = [user({ lastSeenAt: lastActivity, visitBoundaryAt: at('2026-09-26T08:00:00.000Z') })];
    const { service, stats } = buildDouble(rows);
    const returnAt = plus(lastActivity, 2 * 60 * MIN);

    const results = await Promise.all([
      service.recordSeen('user-1', returnAt),
      service.recordSeen('user-1', plus(returnAt, 10)),
      service.recordSeen('user-1', plus(returnAt, 20)),
    ]);

    /* Every tab reports the SAME boundary: the pre-visit lastSeenAt. */
    for (const result of results) expect(result.previousSeenAt).toBe(lastActivity.toISOString());
    expect(results.filter((result) => result.recorded)).toHaveLength(1);
    expect(rows[0].visitBoundaryAt).toEqual(lastActivity);
    expect(stats().events).toHaveLength(1);
  });

  it('concurrent first-ever tabs also record exactly once', async () => {
    const rows = [user()];
    const { service, stats } = buildDouble(rows);
    const t0 = at('2026-09-27T10:00:00.000Z');

    const results = await Promise.all([service.recordSeen('user-1', t0), service.recordSeen('user-1', t0)]);

    for (const result of results) expect(result.previousSeenAt).toBeNull();
    expect(stats().writes).toBe(1);
    expect(stats().events).toHaveLength(1);
  });
});

describe('semantic independence from the article contract', () => {
  it('the visit clock comes from the server clock, never from content', () => {
    const source = readSource();
    expect(source).not.toContain('publishedAt');
    expect(source).not.toContain('firstSeenAt');
    expect(source).not.toContain('fetchedAt');
  });

  it('the intervals are exported constants, not scattered literals', () => {
    const source = readSource();
    expect(source).toContain('RETURN_VISIT_MIN_INTERVAL_MS');
    expect(source).toContain('VISIT_ACTIVITY_TOUCH_INTERVAL_MS');
    expect(RETURN_VISIT_MIN_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(VISIT_ACTIVITY_TOUCH_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(source).not.toMatch(/1800000|300000|30 \* 60 \* 1000|5 \* 60 \* 1000/);
  });

  it('no client-side clock: the service is the only writer of the boundary', () => {
    expect(readSource()).toContain('visitBoundaryAt: lastSeenAt');
  });
});

describe('a user that does not exist', () => {
  it('is a bare 404 rather than a silently created row', async () => {
    const { service, stats } = buildDouble([]);
    await expect(service.recordSeen('ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(stats().writes).toBe(0);
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
