import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { AdminOperationsService } from './admin-operations.service';
import { DEPLOYMENT_ENVIRONMENT_VAR } from './deployment-environment';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — THE BEHAVIOUR A STUB CANNOT PROVE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Four properties need a real database and, for one of them, two real service
 * instances:
 *
 *   ATOMICITY      the switch row and its audit row commit together, or not
 *                  at all. A failure that leaves one without the other makes
 *                  the audit trail a guess.
 *   CONCURRENCY    two administrators changing the same switch must both
 *                  appear in the history, and the final state must be the
 *                  later write — not a merge, and not a silent loss.
 *   PROPAGATION    a second instance has its own in-process cache. The delay
 *                  before it sees a change is MEASURED here, not asserted to
 *                  be instantaneous, because the honest operator-facing claim
 *                  depends on the number.
 *   FAIL-CLOSED    an unreadable store yields effective=false, never a
 *                  healthy-looking ON.
 */

const url = process.env.ASK_OBSERVATION_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/[a-z_]+@127\.0\.0\.1:\d+\/[a-z0-9_]+$/.test(url)) {
  throw new Error('Admin operations live tests require a dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

live('ADMIN OPERATIONS R1 — live PostgreSQL', () => {
  let a: PrismaClient;
  let b: PrismaClient;

  beforeAll(async () => {
    a = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    b = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await a.$connect();
    await b.$connect();
  });
  afterAll(async () => {
    await a.$disconnect();
    await b.$disconnect();
  });
  beforeEach(async () => {
    await a.$executeRawUnsafe('TRUNCATE "OperationalSwitch", "OperationalSwitchAudit"');
  });

  /** One simulated application instance: its own services, its own switch cache. */
  const instance = (db: PrismaClient, values: Record<string, string | undefined>) => {
    const cfg = config(values);
    const meter = new ComputeMeterService(db as unknown as PrismaService, cfg);
    const switches = new OperationalSwitchService(db as unknown as PrismaService, cfg, meter);
    const operations = new AdminOperationsService(db as unknown as PrismaService, switches, cfg);
    return { switches, operations };
  };

  const ON = {
    ASK_PUBLIC_COMPUTE_ENABLED: 'true',
    ASK_R2_ENABLED: 'true',
    [DEPLOYMENT_ENVIRONMENT_VAR]: 'ALPHA',
    ASK_FLAG_CACHE_MS: '5000',
  };

  it('a change writes the switch row and the audit row together', async () => {
    const { operations } = instance(a, ON);
    await operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'admin-1', 'provider degraded');

    const row = await a.operationalSwitch.findUnique({
      where: { name: 'ASK_PUBLIC_COMPUTE_ENABLED' },
    });
    const audit = await a.operationalSwitchAudit.findMany({
      where: { name: 'ASK_PUBLIC_COMPUTE_ENABLED' },
    });

    expect(row).toMatchObject({ enabled: false, setBy: 'admin-1', reason: 'provider degraded' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      enabled: false,
      setBy: 'admin-1',
      reason: 'provider degraded',
    });
  });

  it('ATOMICITY — a refused change writes NEITHER row', async () => {
    const { operations } = instance(a, ON);
    await expect(
      operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'admin-1', '  '),
    ).rejects.toThrow();
    expect(await a.operationalSwitch.count()).toBe(0);
    expect(await a.operationalSwitchAudit.count()).toBe(0);
  });

  it('ATOMICITY — an unconfirmed environment writes NEITHER row', async () => {
    const { operations } = instance(a, { ...ON, [DEPLOYMENT_ENVIRONMENT_VAR]: undefined });
    await expect(
      operations.setSwitch(
        'ASK_PUBLIC_COMPUTE_ENABLED',
        false,
        'admin-1',
        'attempt while unconfirmed',
      ),
    ).rejects.toThrow();
    expect(await a.operationalSwitch.count()).toBe(0);
    expect(await a.operationalSwitchAudit.count()).toBe(0);
  });

  it('every change is retained: the audit is append-only across a pause and a resume', async () => {
    const { operations } = instance(a, ON);
    await operations.setSwitch(
      'ASK_PUBLIC_COMPUTE_ENABLED',
      false,
      'admin-1',
      'pause for incident',
    );
    await operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'admin-2', 'incident resolved');

    const audit = await a.operationalSwitchAudit.findMany({ orderBy: { setAt: 'asc' } });
    expect(audit).toHaveLength(2);
    expect(audit.map((r) => [r.enabled, r.setBy])).toEqual([
      [false, 'admin-1'],
      [true, 'admin-2'],
    ]);
    /* One switch row, two history rows: the current value never overwrites the record. */
    expect(await a.operationalSwitch.count()).toBe(1);
  });

  it('CONCURRENCY — two administrators both appear, and the final state is the later write', async () => {
    const one = instance(a, ON);
    const two = instance(b, ON);

    await Promise.all([
      one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'admin-1', 'admin one pauses'),
      two.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'admin-2', 'admin two resumes'),
    ]);

    const audit = await a.operationalSwitchAudit.findMany({ orderBy: { setAt: 'asc' } });
    expect(audit).toHaveLength(2);
    expect(audit.map((r) => r.setBy).sort()).toEqual(['admin-1', 'admin-2']);

    const row = await a.operationalSwitch.findUnique({
      where: { name: 'ASK_PUBLIC_COMPUTE_ENABLED' },
    });
    /* Last writer wins on a single-row primary key, and BOTH attempts are recorded. */
    const last = audit[audit.length - 1];
    expect(row?.setBy).toBe(last.setBy);
    expect(row?.enabled).toBe(last.enabled);
  });

  it('PROPAGATION — a second instance observes the change, and the delay is measured', async () => {
    const writer = instance(a, ON);
    const reader = instance(b, ON);

    /* Warm the reader's cache so this measures propagation, not a cold first read. */
    await writer.operations.setSwitch(
      'ASK_PUBLIC_COMPUTE_ENABLED',
      true,
      'admin-1',
      'enable before measuring',
    );
    expect(await reader.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);

    const changedAt = Date.now();
    await writer.operations.setSwitch(
      'ASK_PUBLIC_COMPUTE_ENABLED',
      false,
      'admin-1',
      'pause for measurement',
    );

    let observedAt: number | null = null;
    const deadline = changedAt + 30_000;
    while (Date.now() < deadline) {
      if ((await reader.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')) === false) {
        observedAt = Date.now();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(observedAt).not.toBeNull();
    const delayMs = observedAt! - changedAt;
    /*
      REPORTED, NOT ASSERTED AS ZERO. The bound is the other instance's flag
      cache (ASK_FLAG_CACHE_MS, 5000 here) plus one read. The assertion is that
      it lands inside that bound with headroom — the exact number is printed so
      the operator-facing copy can quote a measurement instead of a guess.
    */
    console.log(`[propagation] second instance observed the change after ${delayMs} ms`);
    expect(delayMs).toBeLessThan(5000 + 2000);
  });

  it('the writing instance itself sees its own change immediately — set() clears its cache', async () => {
    const one = instance(a, ON);
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'admin-1', 'enable');
    expect(await one.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'admin-1', 'pause');
    expect(await one.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false);
  });

  it('the reported state does not poison the switch cache the executor reads', async () => {
    const one = instance(a, ON);
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'admin-1', 'enable');
    /* Read the operator view, then confirm the executor path still resolves correctly. */
    await one.operations.state(true);
    expect(await one.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'admin-1', 'pause');
    await one.operations.state(true);
    expect(await one.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false);
  });

  it('DEPLOYMENT HALF — an operator cannot turn a switch on when the deployment says otherwise', async () => {
    const off = instance(a, { ...ON, ASK_PUBLIC_COMPUTE_ENABLED: 'false' });
    const result = await off.operations.setSwitch(
      'ASK_PUBLIC_COMPUTE_ENABLED',
      true,
      'admin-1',
      'operator requests on while deployment is off',
    );
    /* The request is recorded and honoured as a REQUEST; the effect still needs both keys. */
    expect(result.applied).toBe(true);
    expect(result.switch.requested).toBe(true);
    expect(result.switch.effective).toBe(false);
    expect(result.switch.blockedReason).toBe('DEPLOYMENT_VALUE_NOT_TRUE');
    expect(await off.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false);
  });

  it('the state view reports both switches with their real effective values', async () => {
    const one = instance(a, ON);
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'admin-1', 'enable compute');
    await one.operations.setSwitch('ASK_R2_ENABLED', false, 'admin-1', 'stop r2 execution');

    const state = await one.operations.state(true);
    expect(state.environment).toMatchObject({ confirmed: true, environment: 'ALPHA' });
    const compute = state.switches.find((s) => s.name === 'ASK_PUBLIC_COMPUTE_ENABLED')!;
    const r2 = state.switches.find((s) => s.name === 'ASK_R2_ENABLED')!;
    expect(compute).toMatchObject({
      effective: true,
      requested: true,
      readable: true,
      blockedReason: null,
    });
    expect(r2).toMatchObject({ effective: false, requested: false, readable: true });
    expect(state.history).toHaveLength(2);
    expect(state.history[0].setAt >= state.history[1].setAt).toBe(true);
  });

  it('FAIL-CLOSED — an unreadable store reports not-readable and effective false, never a healthy ON', async () => {
    const broken = {
      operationalSwitch: {
        findUnique: async () => {
          throw new Error('store unreachable');
        },
      },
      operationalSwitchAudit: {
        findMany: async () => {
          throw new Error('store unreachable');
        },
      },
    } as unknown as PrismaClient;
    const one = instance(broken, ON);
    const state = await one.operations.state(true);
    const compute = state.switches.find((s) => s.name === 'ASK_PUBLIC_COMPUTE_ENABLED')!;
    expect(compute.readable).toBe(false);
    expect(compute.effective).toBe(false);
    expect(compute.blockedReason).toBe('STORE_UNREADABLE');
    /* History degrades to empty rather than inventing rows. */
    expect(state.history).toEqual([]);
  });
});
