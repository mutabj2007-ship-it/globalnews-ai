import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import {
  TelemetryService,
  ANONYMOUS_INGEST_CEILING_PER_WINDOW,
  ANONYMOUS_INGEST_WINDOW_MS,
} from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import type { RecordEventDto } from './dto/record-event.dto';

/**
 * R3 SECURITY REPAIR — the abuse contract for POST /events.
 *
 * E1's review found two problems that no rate-limit NUMBER could fix, and
 * this file proves both are closed. It asserts the CONTRACT rather than
 * the constant, because the constant is the least important thing here:
 *
 *   FINDING 1  the public write was AWAITED, so a public unauthenticated
 *              endpoint held one of the backend's ten shared PostgreSQL
 *              connections for the duration of every accepted request.
 *              Telemetry FAILURE was handled; telemetry LOAD was not.
 *   FINDING 2  one INSERT per request into an append-only table nothing
 *              prunes, with no bound an attacker cannot defeat by using
 *              more source addresses.
 *
 * The tests below are written so they would fail if either regressed.
 */
interface EventRow {
  name: string;
  userId: string | null;
  countryCode: string | null;
  language: string | null;
  subjectId: string | null;
}

function buildDouble(options: { failWrites?: boolean; blockWrites?: boolean } = {}) {
  const events: EventRow[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let release: (() => void) | null = null;

  const prisma = {
    productEvent: {
      create: async ({ data }: { data: EventRow }): Promise<EventRow> => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          if (options.blockWrites) {
            // Never resolves until released — stands in for a write that
            // is holding a database connection.
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          }
          if (options.failWrites) throw new Error('telemetry table is on fire');
          events.push(data);
          return data;
        } finally {
          inFlight -= 1;
        }
      },
    },
    analysisRun: { create: (): Promise<unknown> => Promise.resolve({}) },
  } as unknown as PrismaService;

  const service = new TelemetryService(prisma);

  return {
    service,
    controller: new TelemetryController(service),
    events,
    releaseWrite: () => release?.(),
    stats: () => ({ maxInFlight }),
  };
}

const body = (over: Partial<RecordEventDto> = {}): RecordEventDto =>
  ({ name: 'today_view', ...over }) as RecordEventDto;

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('R3 REPAIR — POST /events returns without waiting for the write', () => {
  it('the handler is SYNCHRONOUS — there is no promise for Nest to await', () => {
    const { controller } = buildDouble();

    // If this returned a promise, Nest would wait on it and the response
    // would once again be coupled to a database INSERT.
    expect(controller.record(body())).toBeUndefined();
  });

  it('returns while the write is still in flight and has not completed', async () => {
    const { controller, events, releaseWrite } = buildDouble({ blockWrites: true });

    const returned = controller.record(body());

    // The handler is already done. The INSERT has not been.
    expect(returned).toBeUndefined();
    expect(events).toHaveLength(0);

    releaseWrite();
    await settle();
    expect(events).toHaveLength(1);
  });

  it('a REJECTED write still yields a normal return and never throws', async () => {
    const { controller, events } = buildDouble({ failWrites: true });

    expect(() => controller.record(body())).not.toThrow();
    await settle();

    // Swallowed at both layers, and no unhandled rejection escaped: the
    // controller attaches an explicit .catch() and the service wraps its
    // own write.
    expect(events).toHaveLength(0);
  });

  it('the controller never awaits the telemetry call', () => {
    const source = readSource('telemetry.controller.ts');

    // WHITESPACE-TOLERANT ON PURPOSE. Prettier wraps this call across
    // lines, so a literal substring would assert a formatting decision
    // rather than the security property — the same brittleness that made
    // the F-S3 guard-chain assertion pass on LF and fail on CRLF.
    expect(source).toMatch(/void\s+this\.telemetry\s*\.\s*recordPublicEvent\s*\(/);
    expect(source).not.toMatch(/await\s+this\.telemetry/);
    expect(source).toMatch(/\.\s*catch\s*\(/);
  });
});

describe('R3 REPAIR — the GLOBAL anonymous ingest ceiling', () => {
  it('admits events up to the ceiling and DROPS the rest', async () => {
    const { service, events } = buildDouble();

    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW + 50; i += 1) {
      await service.recordPublicEvent('today_view');
    }

    expect(events).toHaveLength(ANONYMOUS_INGEST_CEILING_PER_WINDOW);
  });

  it('past the ceiling NO INSERT IS ATTEMPTED — a flood costs the database nothing', async () => {
    const { service, events } = buildDouble();

    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW; i += 1) {
      await service.recordPublicEvent('today_view');
    }
    const afterCeiling = events.length;

    // A write that merely failed would still have reached the database and
    // still have consumed a connection. These never get that far.
    const create = jest.spyOn(
      (service as unknown as { prisma: { productEvent: { create: () => Promise<unknown> } } })
        .prisma.productEvent,
      'create',
    );

    for (let i = 0; i < 200; i += 1) {
      await service.recordPublicEvent('today_view');
    }

    expect(create).not.toHaveBeenCalled();
    expect(events).toHaveLength(afterCeiling);
  });

  it('the ceiling is GLOBAL — it does not reset for a different payload', async () => {
    const { service, events } = buildDouble();

    // An attacker varying countryCode, language and subjectId is the
    // cheap version of varying source addresses. Neither helps.
    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW + 100; i += 1) {
      await service.recordPublicEvent('today_view', {
        countryCode: 'POL',
        subjectId: `article-${i}`,
      });
    }

    expect(events).toHaveLength(ANONYMOUS_INGEST_CEILING_PER_WINDOW);
  });

  it('the window rolls, and the next window admits again', async () => {
    const { service, events } = buildDouble();
    const admit = (
      service as unknown as { admitAnonymousEvent: (now: number) => boolean }
    ).admitAnonymousEvent.bind(service);

    const start = 1_000_000;
    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW; i += 1) admit(start);
    expect(admit(start)).toBe(false);

    // One window later.
    expect(admit(start + ANONYMOUS_INGEST_WINDOW_MS)).toBe(true);
    expect(events).toHaveLength(0);
  });

  it('logging is BOUNDED — a flood of writes must not become a flood of logs', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = buildDouble();

    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW + 5000; i += 1) {
      await service.recordPublicEvent('today_view');
    }

    // Five thousand drops, at most one line. The second line only arrives
    // when the window closes.
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('R3 REPAIR — server-side telemetry is NOT subject to the ceiling', () => {
  it('account-scoped events are written after the public path is exhausted', async () => {
    const { service, events } = buildDouble();

    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW + 100; i += 1) {
      await service.recordPublicEvent('today_view');
    }
    const afterFlood = events.length;

    await service.recordAccountEvent('follow_created', 'user-1', { countryCode: 'POL' });
    await service.recordAccountEvent('return_visit', 'user-1');

    // A user who follows a country during a flood must still have that
    // recorded: it is not attacker-controlled and it is the measurement
    // the product actually needs.
    expect(events).toHaveLength(afterFlood + 2);
    expect(events[events.length - 1]).toMatchObject({ name: 'return_visit', userId: 'user-1' });
  });

  it('server-side ANONYMOUS emissions are not dropped either', async () => {
    const { service, events } = buildDouble();

    for (let i = 0; i < ANONYMOUS_INGEST_CEILING_PER_WINDOW + 10; i += 1) {
      await service.recordPublicEvent('today_view');
    }
    const afterFlood = events.length;

    // The interceptor's events. POST /analysis/news is already bounded at
    // 5/60s on its own terms, so these are bounded by that route.
    await service.recordProductEvent('analysis_started');
    await service.recordProductEvent('analysis_completed');

    expect(events).toHaveLength(afterFlood + 2);
  });

  it('the ceiling is applied in the public method and NOWHERE else', () => {
    const source = readSource('telemetry.service.ts');
    const publicBlock = source.slice(
      source.indexOf('async recordPublicEvent('),
      source.indexOf('async recordProductEvent('),
    );
    const rest = source.slice(source.indexOf('async recordProductEvent('));

    expect(publicBlock).toContain('admitAnonymousEvent()');
    expect(rest.slice(0, rest.indexOf('private admitAnonymousEvent'))).not.toContain(
      'admitAnonymousEvent()',
    );
  });
});

describe('R3 REPAIR — no identity was introduced', () => {
  const controller = readSource('telemetry.controller.ts');
  const service = readSource('telemetry.service.ts');

  it('the endpoint is still anonymous — no guard, no session, no user parameter', () => {
    expect(controller).not.toContain('@CurrentUser');
    expect(controller).not.toContain('UseGuards');
    expect(controller).not.toContain('RequireAuthGuard');
    expect(controller).not.toContain('SessionService');
    expect(controller).not.toContain('userId');
  });

  it('the ceiling stores NOTHING that could identify a caller', () => {
    // The entire point of a GLOBAL ceiling is that it does not
    // distinguish between callers, so it needs nothing about them.
    ['ip', 'userAgent', 'fingerprint', 'visitorId', 'deviceId', 'sessionId', 'cookie'].forEach(
      (forbidden) => {
        expect({
          forbidden,
          present: service.toLowerCase().includes(forbidden.toLowerCase()),
        }).toEqual({ forbidden, present: false });
      },
    );
  });

  it('the repair added no import, no dependency and no persistence', () => {
    const imports = (service.match(/from '([^']+)'/g) ?? []).map((raw) =>
      raw.replace(/from '|'/g, ''),
    );

    imports.forEach((target) => {
      const allowed =
        target.startsWith('.') ||
        target.startsWith('@nestjs/') ||
        target === '@globalnews-ai/shared';
      expect({ target, allowed }).toEqual({ target, allowed: true });
    });

    // The ceiling's whole state is three numbers in this process.
    expect(service).toContain('private windowStartedAt');
    expect(service).toContain('private windowAdmitted');
    expect(service).toContain('private windowDropped');
  });

  it('the payload contract is unchanged and still bounded', () => {
    const dto = readSource('dto/record-event.dto.ts');

    expect(dto).toContain('@IsIn(PRODUCT_EVENT_NAMES)');
    expect(dto).toContain('@IsIn(ALL_ISO3_CODES)');
    expect(dto).toContain('@MaxLength(128)');
    ['userId', 'accountId', 'visitorId'].forEach((forbidden) => {
      expect({ forbidden, present: dto.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    });
  });

  it('the rate limit now matches the platform default rather than inverting it', () => {
    expect(controller).toContain('{ limit: 20, ttl: 60000 }');
    expect(controller).not.toContain('limit: 60');
  });
});

function readSource(name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('path') as typeof import('path');
  return readFileSync(join(__dirname, name), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
