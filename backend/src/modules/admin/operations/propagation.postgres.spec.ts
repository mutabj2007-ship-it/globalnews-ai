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
 * ── ALPHA FINISH: WHAT IS ASSERTED, AND WHAT IS ONLY MEASURED ─────────────────
 *
 * The previous revision asserted the end-to-end delay against
 * `flagCacheMs + storeReadMax + 5 ms`. That total contains two terms the service
 * does not control — how late the observer's timer wakes (≈15.6 ms granularity
 * on Windows, so `setTimeout(5)` sleeps ~15 ms), and the gap between the cache
 * stamp and the moment the test sampled `changedAt` — so it failed by ≤10 ms on
 * a Windows host while the mechanism was exactly right.
 *
 * The cache stamps `hit.at = now` at the START of the reading call. The test
 * brackets that call: `warmStart <= C <= warmEnd`. That makes the two properties
 * that matter exact, with no tolerance at all:
 *
 *   NOT EARLY   the fresh value is never observed before C + flagCacheMs:
 *                 observedAt - warmStart >= flagCacheMs
 *   NOT LATE    no read that STARTS at or after C + flagCacheMs returns the
 *               stale value (checked against warmEnd + flagCacheMs >= C + ttl):
 *                 staleAfterExpiry === 0
 *   DEADLINE    the refreshing read itself completes within the landed store
 *               deadline: observedAt - lastReadStart <= storeDeadlineMs
 *
 * Both cache bounds are STRICTER than the earlier `>= ttl - 5` / `<= ttl + read + 5`.
 * The end-to-end delay and the observer's real wake-up gaps are REPORTED, not
 * asserted: they measure the host, not the service. Screen copy stays "a reading
 * can be a few seconds old", never a number.
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

interface Trial {
  /** From the change being written to the reader enforcing it — REPORTED. */
  delay: number;
  /** From the start of the warm read (<= the cache stamp) to enforcement. */
  sinceWarmStart: number;
  /** Polls that started at or after warmEnd + ttl and still returned the stale value. */
  staleAfterExpiry: number;
  /** Duration of the read that returned the fresh value. */
  refreshReadMs: number;
  /** The observer's largest real gap between consecutive read starts — REPORTED. */
  maxPollGapMs: number;
  storeDeadlineMs: number;
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
      meter,
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
   * Warm the reader (bracketing the call that stamps its cache entry), wait
   * `offsetMs` into its window, change the value, then poll until the reader
   * enforces it, timing every poll.
   */
  async function trial(flagCacheMs: number, offsetMs: number): Promise<Trial> {
    const writer = instance(a, flagCacheMs);
    const reader = instance(b, flagCacheMs);
    await writer.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', true, 'w', 'warm');

    const warmStart = Date.now();
    expect(await reader.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED')).toBe(true);
    const warmEnd = Date.now();
    const expiryAtLatest = warmEnd + flagCacheMs; // >= C + flagCacheMs

    if (offsetMs > 0) await new Promise((r) => setTimeout(r, offsetMs));

    const changedAt = Date.now();
    await writer.operations.setSwitch('ASK_PUBLIC_COMPUTE_ENABLED', false, 'w', 'change');

    let staleAfterExpiry = 0;
    let maxPollGapMs = 0;
    let previousStart: number | null = null;
    const deadline = changedAt + flagCacheMs + 30_000;
    while (Date.now() < deadline) {
      const readStart = Date.now();
      if (previousStart !== null) maxPollGapMs = Math.max(maxPollGapMs, readStart - previousStart);
      previousStart = readStart;
      const enabled = await reader.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED');
      const observedAt = Date.now();
      if (enabled === false) {
        return {
          delay: observedAt - changedAt,
          sinceWarmStart: observedAt - warmStart,
          staleAfterExpiry,
          refreshReadMs: observedAt - readStart,
          maxPollGapMs,
          storeDeadlineMs: reader.meter.config.storeDeadlineMs,
        };
      }
      if (readStart >= expiryAtLatest) staleAfterExpiry += 1;
      await new Promise((r) => setTimeout(r, OBSERVER_POLL_MS));
    }
    throw new Error('the change never propagated');
  }

  /** The exact, host-independent properties of one trial. */
  function assertExact(t: Trial, flagCacheMs: number): void {
    expect({ notEarly: t.sinceWarmStart >= flagCacheMs, t }).toEqual({ notEarly: true, t });
    expect({ staleAfterExpiry: t.staleAfterExpiry, t }).toEqual({ staleAfterExpiry: 0, t });
    expect({ withinDeadline: t.refreshReadMs <= t.storeDeadlineMs, t }).toEqual({
      withinDeadline: true,
      t,
    });
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

  it('WORST CASE — a change landing just after a refresh waits out the whole window, and not a read longer', async () => {
    const flagCacheMs = 1000;
    const trials: Trial[] = [];
    for (let i = 0; i < 5; i += 1) trials.push(await trial(flagCacheMs, 0));
    const d = stats(trials.map((t) => t.delay));
    const gaps = stats(trials.map((t) => t.maxPollGapMs));
    const refresh = stats(trials.map((t) => t.refreshReadMs));
    console.log(
      `[propagation] worst case flagCacheMs=${flagCacheMs} delay min=${d.min} median=${d.median} max=${d.max} ` +
        `(REPORTED) · refresh read max=${refresh.max} · observer wake gap max=${gaps.max} (requested ${OBSERVER_POLL_MS})`,
    );
    trials.forEach((t) => assertExact(t, flagCacheMs));
  });

  it('TYPICAL CASE — a change landing mid-window waits only the remainder', async () => {
    const flagCacheMs = 1000;
    const trials: Trial[] = [];
    for (const offset of [200, 400, 600, 800]) trials.push(await trial(flagCacheMs, offset));
    const d = stats(trials.map((t) => t.delay));
    console.log(
      `[propagation] mid-window offsets 200/400/600/800 delay min=${d.min} median=${d.median} max=${d.max}`,
    );
    trials.forEach((t) => assertExact(t, flagCacheMs));
    /* Each waits out only what is left of its own window. */
    expect(d.min).toBeLessThan(flagCacheMs);
  });

  it('THE BOUND SCALES WITH THE CONFIGURED TTL, which is what makes it a mechanism and not a constant', async () => {
    const records: Array<{ ttl: number; t: Trial }> = [];
    for (const ttl of [250, 500, 2000]) records.push({ ttl, t: await trial(ttl, 0) });
    records.forEach(({ ttl, t }) =>
      console.log(
        `[propagation] ttl=${ttl} worstCaseDelay=${t.delay} sinceCacheStampAtMost=${t.sinceWarmStart} ` +
          `overhead=${t.sinceWarmStart - ttl} refreshRead=${t.refreshReadMs} wakeGapMax=${t.maxPollGapMs}`,
      ),
    );
    records.forEach(({ ttl, t }) => assertExact(t, ttl));
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
