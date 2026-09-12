import type { PrismaService } from '../../database/prisma.service';
import { TelemetryService } from './telemetry.service';
import { ACCOUNT_SCOPED_EVENTS } from './account-scoped-events';

/**
 * R3/T7 — the telemetry service, exercised against an in-memory double.
 *
 * The double RECORDS WHAT WOULD BE WRITTEN, because what reaches the
 * table is the entire question. A test that only checked "a write
 * happened" would pass against an implementation that stored a userId on
 * every event, which is the one thing this design exists to prevent.
 */
export interface EventRow {
  name: string;
  userId: string | null;
  countryCode: string | null;
  language: string | null;
  subjectId: string | null;
}

export interface RunRow {
  provider: string;
  model: string | null;
  status: string;
  failureReason: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cached: boolean;
}

export function buildTelemetryDouble(options: { failWrites?: boolean } = {}) {
  const events: EventRow[] = [];
  const runs: RunRow[] = [];

  const prisma = {
    productEvent: {
      create: ({ data }: { data: EventRow }): Promise<EventRow> => {
        if (options.failWrites) return Promise.reject(new Error('telemetry table is on fire'));
        events.push(data);
        return Promise.resolve(data);
      },
    },
    analysisRun: {
      create: ({ data }: { data: RunRow }): Promise<RunRow> => {
        if (options.failWrites) return Promise.reject(new Error('telemetry table is on fire'));
        runs.push(data);
        return Promise.resolve(data);
      },
    },
  } as unknown as PrismaService;

  return { service: new TelemetryService(prisma), events, runs };
}

describe('R3/T7 — account linkage', () => {
  it('the account-scoped list is EXACTLY the three the architecture permits', () => {
    expect([...ACCOUNT_SCOPED_EVENTS].sort()).toEqual([
      'follow_created',
      'follow_removed',
      'return_visit',
    ]);
  });

  it('an account-scoped event carries the userId', async () => {
    const { service, events } = buildTelemetryDouble();

    await service.recordAccountEvent('follow_created', 'user-1', { countryCode: 'POL' });

    expect(events[0]).toMatchObject({ name: 'follow_created', userId: 'user-1' });
  });

  it('EVERY OTHER EVENT IS ANONYMOUS — the ingest path has no user parameter at all', async () => {
    const { service, events } = buildTelemetryDouble();

    await service.recordProductEvent('today_view', { countryCode: 'POL' });
    await service.recordProductEvent('source_open', { subjectId: 'article-1' });

    events.forEach((event) => expect(event.userId).toBeNull());
    // recordProductEvent takes no user argument. There is no signature
    // through which a session could be attached to these names.
    expect(TelemetryService.prototype.recordProductEvent.length).toBeLessThanOrEqual(2);
  });

  it('the private writer drops an account for a name that is not account-scoped', async () => {
    const { service, events } = buildTelemetryDouble();

    // Bypasses the compile-time guard the way a future careless caller
    // might. The runtime rule still holds.
    await (
      service as unknown as {
        recordAccountEvent: (n: string, u: string) => Promise<void>;
      }
    ).recordAccountEvent('today_view', 'user-1');

    expect(events[0].name).toBe('today_view');
    expect(events[0].userId).toBeNull();
  });
});

describe('R3/T7 — analysis runs', () => {
  it('persists exactly the provenance fields the pipeline already produces', async () => {
    const { service, runs } = buildTelemetryDouble();

    await service.recordAnalysisRun({
      provider: 'openai',
      model: 'gpt-x',
      status: 'success',
      latencyMs: 1234,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cached: false,
    });

    expect(runs[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-x',
      status: 'success',
      latencyMs: 1234,
      totalTokens: 150,
      cached: false,
    });
  });

  it('an absent measurement is stored as NULL, never as a zero', async () => {
    const { service, runs } = buildTelemetryDouble();

    await service.recordAnalysisRun({
      provider: 'mock-analysis',
      status: 'not-attempted',
      cached: false,
    });

    // A zero here would be a measurement nobody took. The same rule the
    // admin surface applies to unpopulated provider counters.
    expect(runs[0].latencyMs).toBeNull();
    expect(runs[0].promptTokens).toBeNull();
    expect(runs[0].totalTokens).toBeNull();
    expect(runs[0].model).toBeNull();
  });

  it('has NO user field to populate', async () => {
    const { service, runs } = buildTelemetryDouble();

    await service.recordAnalysisRun({ provider: 'openai', status: 'success', cached: true });

    expect(Object.keys(runs[0])).not.toContain('userId');
  });

  it('records NO cost — there is no price table in this repository', async () => {
    const { service, runs } = buildTelemetryDouble();

    await service.recordAnalysisRun({ provider: 'openai', status: 'success', cached: false });

    expect(Object.keys(runs[0]).join(',')).not.toMatch(/cost|price|usd/i);
  });
});

describe('R3/T7 — a telemetry failure is swallowed', () => {
  it('a failing product-event write does not throw', async () => {
    const { service } = buildTelemetryDouble({ failWrites: true });

    await expect(service.recordProductEvent('today_view')).resolves.toBeUndefined();
  });

  it('a failing account-event write does not throw', async () => {
    const { service } = buildTelemetryDouble({ failWrites: true });

    await expect(service.recordAccountEvent('return_visit', 'user-1')).resolves.toBeUndefined();
  });

  it('a failing analysis-run write does not throw', async () => {
    const { service } = buildTelemetryDouble({ failWrites: true });

    await expect(
      service.recordAnalysisRun({ provider: 'openai', status: 'success', cached: false }),
    ).resolves.toBeUndefined();
  });
});
