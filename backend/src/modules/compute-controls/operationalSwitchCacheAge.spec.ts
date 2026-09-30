import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../database/prisma.service';
import type { ComputeMeterService } from './compute-meter.service';
import { OperationalSwitchService } from './operational-switch.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * M-A — A NEGATIVE CACHE AGE MUST NOT QUALIFY AN ENTRY AS FRESH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT, as Main reproduced it. `state()` decided freshness with
 *
 *     if (hit && now - hit.at < flagCacheMs) return hit.state;
 *
 * When `now` is EARLIER than the timestamp stored on the entry, `now - hit.at`
 * is negative, every negative number is less than `flagCacheMs`, and the entry
 * is served as fresh. The comparison was written for an age that only ever
 * grows, and an age that can go backwards makes it monotonically wrong: the
 * further behind the clock falls, the fresher the stale entry looks.
 *
 * WHY IT MATTERS MORE THAN A STALE READ. This is the read behind a kill switch.
 * An operator turning `ASK_PUBLIC_COMPUTE_ENABLED` off during an incident relies
 * on every replica noticing within `ASK_FLAG_CACHE_MS`. A replica holding a
 * future-dated entry never re-reads the store, so it serves the OLD value
 * indefinitely — a pause that never takes effect, on exactly the path where
 * "the switch is off" is the thing being trusted. It presents as the incident
 * continuing for no visible reason.
 *
 * HOW `hit.at` GETS AHEAD OF `now`. Two ways, and neither is exotic:
 *   - `state()` takes `now` as a parameter, and stores THAT value as the entry's
 *     timestamp. Any caller passing a forward-shifted `now` — a test, a
 *     simulation, or a deliberate cache-miss trick — poisons the entry for every
 *     later caller using the real clock. An earlier revision of the Admin
 *     operations read did exactly this, which is how the class of defect was
 *     first noticed.
 *   - `Date.now()` is not monotonic. An NTP step backwards, or a suspended and
 *     resumed container, moves the wall clock behind entries already cached.
 *
 * THE FIX IS ONE LINE and deliberately nothing more: an age below zero is not a
 * valid age, so it is not fresh, so the store is consulted. This spec is written
 * to FAIL on the unpatched source — it was run against it first.
 */

const FLAG_CACHE_MS = 5000;

/** A store that counts reads, so "did it consult the store" is measured, not assumed. */
function harness(options: { enabled?: boolean; failing?: boolean } = {}) {
  let reads = 0;
  let enabled = options.enabled ?? true;
  let failing = options.failing ?? false;
  const db = {
    operationalSwitch: {
      findUnique: () => {
        reads += 1;
        if (failing) return Promise.reject(new Error('store down'));
        return Promise.resolve({
          name: 'ASK_PUBLIC_COMPUTE_ENABLED',
          enabled,
          setBy: 'operator',
          setAt: new Date('2026-09-30T00:00:00.000Z'),
          reason: 'harness',
        });
      },
    },
  } as unknown as PrismaService;

  const config = {
    get: (key: string) => (key === 'ASK_PUBLIC_COMPUTE_ENABLED' ? 'true' : undefined),
  } as unknown as ConfigService;

  const meter = {
    config: { flagCacheMs: FLAG_CACHE_MS, storeDeadlineMs: 2000 },
  } as unknown as ComputeMeterService;

  return {
    service: new OperationalSwitchService(db, config, meter),
    reads: () => reads,
    setStoredValue: (value: boolean) => {
      enabled = value;
    },
    setFailing: (value: boolean) => {
      failing = value;
    },
  };
}

const NAME = 'ASK_PUBLIC_COMPUTE_ENABLED' as const;

describe('M-A — cache freshness when the clock moves backwards', () => {
  it('A BACKWARDS TIMESTAMP FORCES A STORE CHECK — it does not serve the cached entry', async () => {
    const h = harness({ enabled: true });
    const seeded = 1_000_000;
    expect(await h.service.isEnabled(NAME, seeded)).toBe(true);
    expect(h.reads()).toBe(1);

    /* The store changes under the entry, as an operator switching off would. */
    h.setStoredValue(false);

    /* A read at an EARLIER instant. Age = -1000 ms: not an age, therefore not fresh. */
    expect(await h.service.isEnabled(NAME, seeded - 1000)).toBe(false);
    expect(h.reads()).toBe(2);
  });

  it('the cached value is not merely refused once — a far-backwards clock never freezes it', async () => {
    const h = harness({ enabled: true });
    const seeded = 10_000_000;
    await h.service.isEnabled(NAME, seeded);
    h.setStoredValue(false);
    /* An hour behind. Under the defect this was the most "fresh"-looking case of all. */
    expect(await h.service.isEnabled(NAME, seeded - 3_600_000)).toBe(false);
  });

  it('STORE FAILURE REMAINS FAIL-CLOSED under a backwards timestamp, and does not fall back to the cache', async () => {
    /*
      The dangerous repair would be "negative age ⇒ consult the store, and if the
      store is unreachable keep the old entry". That reintroduces the defect for
      the case that matters most: an unreadable store during an incident.

      ONE SERVICE, ONE CACHE. A healthy entry is seeded first, THEN the store
      starts failing — which is the real sequence. Building a second service with
      a failing store from the start would never have a healthy entry to fall
      back to, so it would pass whatever the code did.
    */
    const h = harness({ enabled: true });
    const seeded = 2_000_000;
    expect(await h.service.isEnabled(NAME, seeded)).toBe(true);
    expect(h.reads()).toBe(1);

    h.setFailing(true);
    const state = await h.service.state(NAME, seeded - 5000);
    expect(h.reads()).toBe(2);
    /* NOT the cached healthy state: unreadable, and therefore off. */
    expect(state.readable).toBe(false);
    expect(state.effective).toBe(false);
    expect(state.row).toBeNull();
  });

  it('a poisoned entry self-repairs: the next read re-times it rather than staying ahead forever', async () => {
    const h = harness({ enabled: true });
    const real = 3_000_000;
    /* A caller passes a forward-shifted `now`, poisoning the entry's timestamp. */
    await h.service.isEnabled(NAME, real + 60_000);
    expect(h.reads()).toBe(1);
    /* Real clock: negative age ⇒ store read, and the entry is re-stamped at `real`. */
    await h.service.isEnabled(NAME, real);
    expect(h.reads()).toBe(2);
    /* Now inside the TTL from `real`, so this one is a hit — the entry is healthy again. */
    await h.service.isEnabled(NAME, real + 1000);
    expect(h.reads()).toBe(2);
  });
});

/**
 * PRESERVATION. The fix must change nothing about a forward-moving clock, so the
 * whole TTL behaviour is re-asserted here rather than assumed — including both
 * boundaries, which is where an off-by-one repair would land.
 */
describe('M-A — normal TTL behaviour is preserved', () => {
  it('a read inside the TTL is served from the cache', async () => {
    const h = harness();
    const t = 5_000_000;
    await h.service.isEnabled(NAME, t);
    await h.service.isEnabled(NAME, t + 1);
    await h.service.isEnabled(NAME, t + FLAG_CACHE_MS - 1);
    expect(h.reads()).toBe(1);
  });

  it('AGE EXACTLY ZERO IS FRESH — the repair must not turn `>= 0` into `> 0`', async () => {
    const h = harness();
    const t = 6_000_000;
    await h.service.isEnabled(NAME, t);
    await h.service.isEnabled(NAME, t);
    expect(h.reads()).toBe(1);
  });

  it('AGE EXACTLY THE TTL IS STALE — the comparison stays strict', async () => {
    const h = harness();
    const t = 7_000_000;
    await h.service.isEnabled(NAME, t);
    await h.service.isEnabled(NAME, t + FLAG_CACHE_MS);
    expect(h.reads()).toBe(2);
  });

  it('an operator switching off is still seen within the TTL, without a restart', async () => {
    const h = harness({ enabled: true });
    const t = 8_000_000;
    expect(await h.service.isEnabled(NAME, t)).toBe(true);
    h.setStoredValue(false);
    expect(await h.service.isEnabled(NAME, t + 1000)).toBe(true); // inside the cache
    expect(await h.service.isEnabled(NAME, t + FLAG_CACHE_MS)).toBe(false); // bitten
  });

  it('an unreadable store is OFF on a forward clock too — unchanged fail-closed baseline', async () => {
    const h = harness({ failing: true });
    expect(await h.service.isEnabled(NAME, 9_000_000)).toBe(false);
  });
});
