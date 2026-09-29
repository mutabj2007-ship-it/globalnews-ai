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

interface CountArgs {
  where?: { failureCode?: { startsWith?: string; not?: null } | null };
}

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
    /**
     * Numerators for the two ruled rates. The plain `counts` map is per MODEL, which cannot
     * express "19 observations of which 3 carried a BUDGET_ failure" — so the stub inspects
     * the `where` clause and answers the numerator when it recognises one. Without this a
     * rate test can only ever produce 0 or 1, which is precisely the range in which a
     * threshold ruling is not being tested at all.
     */
    rateFailures?: number;
    rateBudgetRejections?: number;
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
            get: (_inner, op: string) => async (args?: CountArgs) => {
              seen.push(`${model}.${op}`);
              if (options.failModel === model) throw new Error('read failed');
              if (op === 'aggregate') return { ...EMPTY_AGGREGATE, ...(options.aggregate ?? {}) };
              if (op === 'count') {
                /* `failureCode: null` is a real predicate here (the completions count), so
                   the guard has to survive it rather than assume an object. */
                const failureCode = args?.where?.failureCode;
                if (failureCode !== null && typeof failureCode === 'object') {
                  if (typeof failureCode.startsWith === 'string')
                    return options.rateBudgetRejections ?? 0;
                  if ('not' in failureCode) return options.rateFailures ?? 0;
                }
                return options.counts?.[model] ?? 0;
              }
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

  it('the two rate thresholds declare themselves RULED rather than derived or pending', async () => {
    const { service } = harness({});
    const alerts = (await service.askIntelligence(NOW)).alerts;
    ['BUDGET_REJECTION_RATE', 'FAILURE_RATE'].forEach((id) => {
      const alert = alerts?.alerts.find((candidate) => candidate.id === id);
      expect({ id, source: alert?.thresholdSource }).toEqual({
        id,
        source: 'PRODUCT_OWNER_RULED',
      });
    });
  });

  /**
   * THE PRODUCT OWNER RULING, ASSERTED AS NUMBERS.
   *
   * Written out rather than left implicit, so that a future edit to a threshold has to
   * change a test that names the ruling it came from.
   */
  it('carries the ruled windows, minimum samples and thresholds exactly', async () => {
    const { service } = harness({});
    const alerts = (await service.askIntelligence(NOW)).alerts;

    const rejection = alerts?.alerts.find((a) => a.id === 'BUDGET_REJECTION_RATE');
    expect(rejection?.windowMinutes).toBe(15);
    expect(rejection?.minimumSampleCount).toBe(20);
    expect(rejection?.warnAt).toBeCloseTo(0.05, 6);
    expect(rejection?.criticalAt).toBeCloseTo(0.15, 6);

    const failure = alerts?.alerts.find((a) => a.id === 'FAILURE_RATE');
    expect(failure?.windowMinutes).toBe(15);
    expect(failure?.minimumSampleCount).toBe(20);
    expect(failure?.warnAt).toBeCloseTo(0.05, 6);
    expect(failure?.criticalAt).toBeCloseTo(0.1, 6);
  });

  it('BELOW the minimum sample it is INSUFFICIENT_SAMPLE — never OK, and never UNKNOWN', async () => {
    /* 19 attempts, 0 refusals: a measurable 0% over too small a denominator. The ruling is
       explicit that this must not read as OK merely because nothing has gone wrong yet. */
    const { service } = harness({ counts: { computeOperation: 19, askObservation: 19 } });
    const alerts = (await service.askIntelligence(NOW)).alerts;

    ['BUDGET_REJECTION_RATE', 'FAILURE_RATE'].forEach((id) => {
      const alert = alerts?.alerts.find((candidate) => candidate.id === id);
      expect({ id, severity: alert?.severity }).toEqual({ id, severity: 'INSUFFICIENT_SAMPLE' });
      /* The figure IS present — this is not an unmeasurable line. */
      expect({ id, measured: alert?.observed !== null }).toEqual({ id, measured: true });
      expect({ id, samples: alert?.sampleCount }).toEqual({ id, samples: 19 });
    });
    /* And the page-level chip cannot be green while one of them is thin. */
    expect(alerts?.worstSeverity).not.toBe('OK');
  });

  it('AT the minimum sample the ruling takes effect and a clean rate is OK', async () => {
    const { service } = harness({ counts: { computeOperation: 20, askObservation: 20 } });
    const alerts = (await service.askIntelligence(NOW)).alerts;
    ['BUDGET_REJECTION_RATE', 'FAILURE_RATE'].forEach((id) => {
      const alert = alerts?.alerts.find((candidate) => candidate.id === id);
      expect({ id, severity: alert?.severity, observed: alert?.observed }).toEqual({
        id,
        severity: 'OK',
        observed: 0,
      });
    });
  });

  it('the ruled BUDGET_REJECTION_RATE bands, at their exact boundaries', async () => {
    /* denominator = ATTEMPTS, as the ruling words it: 100 attempts. */
    const at = async (rejections: number) =>
      (
        await harness({
          counts: { computeOperation: 100, askObservation: 100 },
          rateBudgetRejections: rejections,
        }).service.askIntelligence(NOW)
      ).alerts?.alerts.find((a) => a.id === 'BUDGET_REJECTION_RATE');

    expect((await at(4))?.severity).toBe('OK'); //            4%  — below warn
    expect((await at(5))?.severity).toBe('WARNING'); //       5%  — warn boundary, inclusive
    expect((await at(14))?.severity).toBe('WARNING'); //     14%  — below critical
    expect((await at(15))?.severity).toBe('CRITICAL'); //    15%  — critical boundary
    expect((await at(40))?.severity).toBe('CRITICAL');
  });

  it('the ruled FAILURE_RATE bands, at their exact boundaries', async () => {
    /* denominator = EXECUTED attempts, as the ruling words it: 100 executions. */
    const at = async (failures: number) =>
      (
        await harness({
          counts: { computeOperation: 100, askObservation: 100 },
          rateFailures: failures,
        }).service.askIntelligence(NOW)
      ).alerts?.alerts.find((a) => a.id === 'FAILURE_RATE');

    expect((await at(4))?.severity).toBe('OK'); //            4%  — below warn
    expect((await at(5))?.severity).toBe('WARNING'); //       5%  — warn boundary, inclusive
    expect((await at(9))?.severity).toBe('WARNING'); //       9%  — below critical
    expect((await at(10))?.severity).toBe('CRITICAL'); //    10%  — critical boundary
  });

  it('the two rates use DIFFERENT denominators, exactly as the ruling words them', async () => {
    /*
      40 attempts, 20 of which executed. 4 budget refusals and 4 failures.
      rejection rate = 4/40 = 10%  (attempts)        -> WARNING under 5/15
      failure rate   = 4/20 = 20%  (executions)      -> CRITICAL under 5/10
      If both read the same denominator, one of these two verdicts would be wrong.
    */
    const { service } = harness({
      counts: { computeOperation: 40, askObservation: 20 },
      rateBudgetRejections: 4,
      rateFailures: 4,
    });
    const alerts = (await service.askIntelligence(NOW)).alerts;

    const rejection = alerts?.alerts.find((a) => a.id === 'BUDGET_REJECTION_RATE');
    expect(rejection?.sampleCount).toBe(40);
    expect(rejection?.observed).toBeCloseTo(0.1, 6);
    expect(rejection?.severity).toBe('WARNING');

    const failure = alerts?.alerts.find((a) => a.id === 'FAILURE_RATE');
    expect(failure?.sampleCount).toBe(20);
    expect(failure?.observed).toBeCloseTo(0.2, 6);
    expect(failure?.severity).toBe('CRITICAL');

    expect(alerts?.worstSeverity).toBe('CRITICAL');
  });

  it('an unmeasurable rate is still UNKNOWN, which is a different fact from a thin one', async () => {
    /* Zero attempts: the denominator does not exist, so there is no figure at all. */
    const { service } = harness({});
    const rejection = (await service.askIntelligence(NOW)).alerts?.alerts.find(
      (a) => a.id === 'BUDGET_REJECTION_RATE',
    );
    expect(rejection?.observed).toBeNull();
    expect(rejection?.severity).toBe('UNKNOWN');
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
