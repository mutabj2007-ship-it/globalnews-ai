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
 * ADMIN OPERATIONS R1 — WHAT THE PROPAGATION DELAY ACTUALLY IS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * An earlier revision reported "5002 ms against a 5000 ms bound" and treated
 * that as a pass. It was not a pass, because 5000 ms was never the bound.
 *
 * THE MECHANISM. A reading is cached per instance, and the predicate is
 *
 *     hit && now - hit.at < flagCacheMs
 *
 * so an entry cached at C is served until C + flagCacheMs. If a change lands
 * at X with C <= X < C + flagCacheMs, that instance keeps serving the old
 * value until C + flagCacheMs. The delay from change to enforcement is
 * therefore
 *
 *     (C + flagCacheMs) - X          which ranges over [0, flagCacheMs)
 *
 * plus the store read that refreshes the entry. The worst case is a change
 * landing immediately after a refresh — which is exactly what the earlier
 * measurement constructed without saying so. 5002 ms was the worst case plus
 * two milliseconds of read, not a 2 ms overrun of a 5 s limit.
 *
 * SO THE DEFENSIBLE BOUND IS DERIVED, NOT ASSERTED:
 *
 *     enforcementDelay  <=  flagCacheMs + storeReadMax + observerGranularity
 *
 * This file measures each term separately and checks the bound it derives,
 * so the number cannot drift into a magic constant again.
 *
 * WHAT PROPAGATION IS NOT. A request already past the control is unaffected —
 * the switch gates admission, not work in flight. That is a different
 * property, and it is covered in askReadableDuringPause.postgres.spec.ts.
 */

const url = process.env.ASK_OBSERVATION_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/[a-z_]+@127\.0\.0\.1:\d+\/[a-z0-9_]+$/.test(url)) {
  throw new Error('Propagation measurement requires a dedicated loopback test database');
}
jest.setTimeout(120000);
const live = url ? describe : describe.skip;

const OBSERVER_POLL_MS = 5;

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

live('ADMIN OPERATIONS R1 — propagation delay, measured', () => {
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

  const instance = (db: PrismaClient, flagCacheMs: number) => {
    const cfg = config({
      ASK_PUBLIC_COMPUTE_ENABLED: 'true',
      ASK_R2_ENABLED: 'true',
      [DEPLOYMENT_ENVIRONMENT_VAR]: 'ALPHA',
      ASK_FLAG_CACHE_MS: String(flagCacheMs),
    });
    const meter = new ComputeMeterService(db as unknown as PrismaService, cfg);
    const switches = new OperationalSwitchService(db as unknown as PrismaService, cfg, meter);
    return {
      switches,
      operations: new AdminOperationsService(db as unknown as PrismaService, switches, cfg),
    };
  };

  /** Time one uncached store read, repeatedly, so the read term is a measurement. */
  async function storeReadMs(samples: number): Promise<number[]> {
    const out: number[] = [];
    for (let i = 0; i < samples; i += 1) {
      const fresh = instance(b, 0); // flagCacheMs 0 ⇒ every call reads the store
      const t0 = Date.now();
      await fresh.switches.state('ASK_PUBLIC_COMPUTE_ENABLED');
      out.push(Date.now() - t0);
    }
    return out;
  }

  /**
   * Warm the reader, wait `offsetMs` into its cache window, change the value,
   * then poll until the reader enforces it. Returns the observed delay.
   */
  async function trial(flagCacheMs: number, offsetMs: number): Promise<number> {
    const writer = instance(a, flagCacheMs);
    const reader = instance(b, flagCacheMs);
    await writer.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'w', 'warm');
    expect(await reader.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);

    if (offsetMs > 0) await new Promise((r) => setTimeout(r, offsetMs));

    const changedAt = Date.now();
    await writer.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'w', 'change');

    const deadline = changedAt + flagCacheMs + 30_000;
    while (Date.now() < deadline) {
      if ((await reader.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')) === false) {
        return Date.now() - changedAt;
      }
      await new Promise((r) => setTimeout(r, OBSERVER_POLL_MS));
    }
    throw new Error('the change never propagated');
  }

  const stats = (xs: number[]) => {
    const s = [...xs].sort((p, q) => p - q);
    return { min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
  };

  it('THE STORE READ TERM — measured, not assumed', async () => {
    const reads = await storeReadMs(30);
    const r = stats(reads);
    console.log(`[propagation] store read ms  min=${r.min} median=${r.median} max=${r.max} (n=30)`);
    expect(r.max).toBeLessThan(2000); // the landed store deadline
  });

  it('WORST CASE — a change landing just after a refresh waits out the whole window', async () => {
    const flagCacheMs = 1000;
    const reads = stats(await storeReadMs(20));
    const delays: number[] = [];
    for (let i = 0; i < 5; i += 1) delays.push(await trial(flagCacheMs, 0));
    const d = stats(delays);
    const bound = flagCacheMs + reads.max + OBSERVER_POLL_MS;
    console.log(
      `[propagation] worst case flagCacheMs=${flagCacheMs} delay min=${d.min} median=${d.median} max=${d.max} ` +
        `derivedBound=${bound} (= flagCacheMs + storeReadMax ${reads.max} + poll ${OBSERVER_POLL_MS})`,
    );
    /* The delay must reach the window — this is the worst case, so it should be close to it — */
    expect(d.min).toBeGreaterThanOrEqual(flagCacheMs - OBSERVER_POLL_MS);
    /* — and must not exceed the bound the mechanism implies. */
    expect(d.max).toBeLessThanOrEqual(bound);
  });

  it('TYPICAL CASE — a change landing mid-window waits only the remainder', async () => {
    const flagCacheMs = 1000;
    const reads = stats(await storeReadMs(20));
    const delays: number[] = [];
    for (const offset of [200, 400, 600, 800]) delays.push(await trial(flagCacheMs, offset));
    const d = stats(delays);
    console.log(
      `[propagation] mid-window offsets 200/400/600/800 delay min=${d.min} median=${d.median} max=${d.max}`,
    );
    /* Each waits out only what is left of its own window, so all are below the worst case. */
    expect(d.max).toBeLessThanOrEqual(flagCacheMs + reads.max + OBSERVER_POLL_MS);
    expect(d.min).toBeLessThan(flagCacheMs);
  });

  it('THE BOUND SCALES WITH THE CONFIGURED TTL, which is what makes it a mechanism and not a constant', async () => {
    const reads = stats(await storeReadMs(20));
    const records: Array<{ ttl: number; delay: number; bound: number }> = [];
    for (const ttl of [250, 500, 2000]) {
      const delay = await trial(ttl, 0);
      records.push({ ttl, delay, bound: ttl + reads.max + OBSERVER_POLL_MS });
    }
    records.forEach((r) =>
      console.log(`[propagation] ttl=${r.ttl} worstCaseDelay=${r.delay} derivedBound=${r.bound}`),
    );
    records.forEach((r) => {
      expect(r.delay).toBeLessThanOrEqual(r.bound);
      expect(r.delay).toBeGreaterThanOrEqual(r.ttl - OBSERVER_POLL_MS);
    });
  });

  it('THE WRITING INSTANCE IS NOT SUBJECT TO THE DELAY — set() clears its own entry', async () => {
    const one = instance(a, 5000);
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'w', 'warm');
    expect(await one.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);
    const t0 = Date.now();
    await one.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'w', 'change');
    expect(await one.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(false);
    const elapsed = Date.now() - t0;
    console.log(`[propagation] writing instance observed its own change after ${elapsed} ms`);
    expect(elapsed).toBeLessThan(2000);
  });
});
