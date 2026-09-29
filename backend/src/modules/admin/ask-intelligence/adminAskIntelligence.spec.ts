import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../database/prisma.service';
import type { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { AdminAskIntelligenceService } from './admin-ask-intelligence.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS R1 — THE READER'S BEHAVIOUR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The property that matters most on an operations page is the one that is easiest to get
 * wrong: A FAILED READ MUST NOT LOOK LIKE A HEALTHY ZERO. A panel that renders 0 failures
 * because the database was unreachable is worse than a panel that renders nothing, because
 * an operator believes it.
 */
type Op = 'count' | 'groupBy' | 'findMany' | 'aggregate';

const EMPTY_AGGREGATE = {
  _count: { latencyMs: 0, promptTokens: 0, reportingItemCount: 0 },
  _avg: { latencyMs: null, reportingItemCount: null },
  _min: { latencyMs: null, reportingItemCount: null },
  _max: { latencyMs: null, reportingItemCount: null },
  _sum: {
    promptTokens: null,
    completionTokens: null,
    modelInvocationCount: null,
    providerCallCount: null,
  },
};

function harness(
  options: {
    failModel?: string;
    rows?: Record<string, unknown[]>;
    counts?: Record<string, number>;
    switchReadable?: boolean;
    aggregate?: Record<string, unknown>;
  } = {},
) {
  const seen: string[] = [];
  const prisma = new Proxy(
    {},
    {
      get: (_target, model: string) =>
        new Proxy(
          {},
          {
            get: (_inner, op: string) => async () => {
              seen.push(`${model}.${op}`);
              if (options.failModel === model) throw new Error('read failed');
              if (op === 'aggregate') return { ...EMPTY_AGGREGATE, ...(options.aggregate ?? {}) };
              if (op === 'count') return options.counts?.[model] ?? 0;
              if (op === 'findMany' || op === 'groupBy') return options.rows?.[model] ?? [];
              throw new Error(`unexpected non-read operation: ${model}.${op}`);
            },
          },
        ),
    },
  ) as PrismaService;

  const switches = {
    state: jest.fn(async (name: string) => ({
      name,
      deploymentValueIsLiteralTrue: false,
      row: null,
      effective: false,
      readable: options.switchReadable ?? true,
    })),
  } as unknown as OperationalSwitchService;

  const config = { get: () => undefined } as unknown as ConfigService;

  return { service: new AdminAskIntelligenceService(prisma, switches, config), seen };
}

const NOW = new Date('2026-09-29T12:00:00.000Z');

describe('R1 — a failed read is null, never a fabricated zero', () => {
  it('a broken observation store nulls the sections that depend on it and keeps the rest', async () => {
    const { service } = harness({ failModel: 'askObservation' });
    const response = await service.askIntelligence(NOW);

    expect(response.health).toBeNull();
    expect(response.evidence).toBeNull();
    expect(response.improvement).toBeNull();
    expect(response.alerts).toBeNull();
    /* The structural disclosures are properties of the build and survive a failed read. */
    expect(response.disclosures.rawQuestionStored).toBe(false);
    expect(response.retention.enforced).toBe(true);
    expect(response.generatedAt).toBe(NOW.toISOString());
  });

  it('a broken operation store nulls health without nulling operations', async () => {
    const { service } = harness({ failModel: 'computeOperation' });
    const response = await service.askIntelligence(NOW);
    expect(response.health).toBeNull();
    expect(response.operations).not.toBeNull();
  });

  it('a healthy but EMPTY store reports measured zeroes and omits every absent aggregate', async () => {
    const { service } = harness({});
    const response = await service.askIntelligence(NOW);

    expect(response.health).not.toBeNull();
    expect(response.health?.executionsLast24h).toBe(0);
    /* A zero COUNT is a measurement. A mean over zero rows is not, so it is absent. */
    expect(response.health?.latency).toEqual({ sampleCount: 0 });
    expect(response.health?.tokens).toEqual({ sampleCount: 0 });
    expect(response.health?.latency.averageMs).toBeUndefined();
    expect(response.health?.tokens.totalTokens).toBeUndefined();
  });

  it('every database call it makes is a read', async () => {
    const { service, seen } = harness({});
    await service.askIntelligence(NOW);
    expect(seen.length).toBeGreaterThan(10);
    seen.forEach((call) => {
      const op = call.split('.')[1] as Op;
      expect({ call, read: ['count', 'groupBy', 'findMany', 'aggregate'].includes(op) }).toEqual({
        call,
        read: true,
      });
    });
  });

  it('it never touches the tables that hold the reader’s words', async () => {
    const { service, seen } = harness({});
    await service.askIntelligence(NOW);
    const models = new Set(seen.map((call) => call.split('.')[0]));
    ['askTurn', 'askThread', 'searchHistoryEntry', 'storedResult', 'user'].forEach((model) => {
      expect({ model, touched: models.has(model) }).toEqual({ model, touched: false });
    });
  });
});

describe('R1 — the operator alert mechanism', () => {
  it('an empty Beta is UNKNOWN rather than OK — a rate over no attempts is not a rate', async () => {
    const { service } = harness({});
    const alerts = (await service.askIntelligence(NOW)).alerts;

    const failureRate = alerts?.alerts.find((alert) => alert.id === 'FAILURE_RATE');
    expect(failureRate?.observed).toBeNull();
    expect(failureRate?.severity).toBe('UNKNOWN');
    expect(alerts?.worstSeverity).toBe('UNKNOWN');
  });

  it('an OPEN breaker is CRITICAL, and needs no threshold to say so', async () => {
    const { service } = harness({
      rows: { circuitBreakerState: [{ provider: 'openai', state: 'OPEN' }] },
    });
    const alerts = (await service.askIntelligence(NOW)).alerts;

    const breaker = alerts?.alerts.find((alert) => alert.id === 'PROVIDER_BREAKER_OPEN');
    expect(breaker?.observed).toBe(1);
    expect(breaker?.severity).toBe('CRITICAL');
    expect(breaker?.thresholdSource).toBe('LANDED_BREAKER_STATE');
    expect(alerts?.worstSeverity).toBe('CRITICAL');
  });

  it('a CLOSED breaker is OK, which is the control proving it can also be quiet', async () => {
    const { service } = harness({
      rows: { circuitBreakerState: [{ provider: 'openai', state: 'CLOSED' }] },
    });
    const breaker = (await service.askIntelligence(NOW)).alerts?.alerts.find(
      (alert) => alert.id === 'PROVIDER_BREAKER_OPEN',
    );
    expect(breaker?.severity).toBe('OK');
  });

  it('saturation is a ratio of a MEASURED meter to a LANDED ceiling, and names the ceiling', async () => {
    const { service } = harness({
      /* 300 000 is the landed ASK_GLOBAL_UNITS_PER_HOUR default; 285 000 is 95% of it. */
      rows: { computeMeter: [{ units: BigInt(285_000) }] },
    });
    const alerts = (await service.askIntelligence(NOW)).alerts;
    const hour = alerts?.alerts.find((alert) => alert.id === 'BUDGET_SATURATION_HOUR');

    expect(hour?.ceiling).toBe(300_000);
    expect(hour?.observed).toBeCloseTo(0.95, 5);
    expect(hour?.severity).toBe('CRITICAL');
    expect(hour?.thresholdSource).toBe('LANDED_ASK_GLOBAL_UNITS_PER_HOUR');
  });

  it('a meter well inside the ceiling is OK', async () => {
    const { service } = harness({ rows: { computeMeter: [{ units: BigInt(30_000) }] } });
    const hour = (await service.askIntelligence(NOW)).alerts?.alerts.find(
      (alert) => alert.id === 'BUDGET_SATURATION_HOUR',
    );
    expect(hour?.observed).toBeCloseTo(0.1, 5);
    expect(hour?.severity).toBe('OK');
  });

  it('the call-volume ceiling is derived from two landed knobs, never chosen', async () => {
    const { service } = harness({});
    const modelVolume = (await service.askIntelligence(NOW)).alerts?.alerts.find(
      (alert) => alert.id === 'MODEL_CALL_VOLUME_HOUR',
    );
    /* floor(ASK_GLOBAL_UNITS_PER_HOUR / ASK_UNITS_PER_REQUEST_MAX) = floor(300000 / 16000) */
    expect(modelVolume?.ceiling).toBe(18);
    /* `observed` IS A RATIO — what the CEILING counts is the separate fact. Conflating the
       two made a screen round 0.44 to `0` and call a three-quarters-full hour empty. */
    expect(modelVolume?.unit).toBe('RATIO');
    expect(modelVolume?.ceilingUnit).toBe('CALLS_PER_HOUR');
    expect(modelVolume?.thresholdSource).toContain('LANDED_');
  });

  it('latency is judged against the landed analysis time budget, not an invented number', async () => {
    const { service } = harness({});
    const latency = (await service.askIntelligence(NOW)).alerts?.alerts.find(
      (alert) => alert.id === 'LATENCY_P95',
    );
    expect(latency?.unit).toBe('MS');
    expect(latency?.ceilingUnit).toBe('MS');
    expect(latency?.ceiling).toBe(32_000);
    expect(latency?.thresholdSource).toBe('LANDED_ANALYSIS_TOTAL_BUDGET_MS');
    expect(latency?.warnAt).toBeLessThan(latency?.criticalAt ?? 0);
  });

  it('the two rate thresholds declare themselves owner-pending rather than derived', async () => {
    const { service } = harness({});
    const alerts = (await service.askIntelligence(NOW)).alerts;
    ['BUDGET_REJECTION_RATE', 'FAILURE_RATE'].forEach((id) => {
      const alert = alerts?.alerts.find((candidate) => candidate.id === id);
      expect({ id, source: alert?.thresholdSource }).toEqual({ id, source: 'PO_PENDING' });
    });
  });

  it('it points at the runbook rather than paraphrasing a procedure in two languages', async () => {
    const { service } = harness({});
    const alerts = (await service.askIntelligence(NOW)).alerts;
    expect(alerts?.procedureKey).toBe('ASK_BETA_OPERATOR_RUNBOOK_R1');
    expect(alerts?.procedureDocument).toMatch(/^docs\/.*\.md$/);
  });
});

describe('R1 — what the operations panel states rather than implies', () => {
  it('an unreadable switch is reported unreadable, and is NOT reported as off', async () => {
    const { service } = harness({ switchReadable: false });
    const switches = (await service.askIntelligence(NOW)).operations?.switches ?? [];
    expect(switches.length).toBeGreaterThan(0);
    switches.forEach((row) => {
      expect(row.readable).toBe(false);
      /* `effective:false` is the fail-closed answer; `readable:false` is why. The screen
         needs both to say "unknown" instead of "off". */
      expect(row.effective).toBe(false);
    });
  });

  it('the legacy rollback path is declared and reported as NOT instrumented', async () => {
    const { service } = harness({});
    const operations = (await service.askIntelligence(NOW)).operations;
    expect(operations?.declaredRoutePaths).toEqual(['ASK_R2', 'LEGACY_ANALYSIS']);
    expect(operations?.instrumentedRoutePaths).toEqual(['ASK_R2']);
    expect(operations?.legacyInstrumented).toBe(false);
  });

  it('no switch row carries the person who set it', async () => {
    const { service } = harness({});
    const switches = (await service.askIntelligence(NOW)).operations?.switches ?? [];
    switches.forEach((row) => {
      expect(Object.keys(row)).not.toContain('setBy');
    });
  });

  it('every saturation line reports a RATIO, so none of them can be rounded away to zero', async () => {
    const { service } = harness({ rows: { computeMeter: [{ units: BigInt(222_000) }] } });
    const alerts = (await service.askIntelligence(NOW)).alerts;

    [
      'BUDGET_SATURATION_HOUR',
      'BUDGET_SATURATION_DAY',
      'MODEL_CALL_VOLUME_HOUR',
      'PROVIDER_CALL_VOLUME_HOUR',
      'TOKEN_VOLUME_HOUR',
    ].forEach((id) => {
      const alert = alerts?.alerts.find((candidate) => candidate.id === id);
      expect({ id, unit: alert?.unit }).toEqual({ id, unit: 'RATIO' });
      expect({ id, ceilingUnit: alert?.ceilingUnit }).not.toEqual({ id, ceilingUnit: 'RATIO' });
    });
  });
});
