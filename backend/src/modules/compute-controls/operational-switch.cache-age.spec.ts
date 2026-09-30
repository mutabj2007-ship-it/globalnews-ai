import { OperationalSwitchService } from './operational-switch.service';

/**
 * M-A — A CACHE HIT REQUIRES A NON-NEGATIVE AGE THAT IS STILL BELOW THE TTL.
 *
 * The freshness test was `now - hit.at < flagCacheMs`, with no lower bound, so a
 * NEGATIVE age (a `now` earlier than the entry's stamp) counted as fresh — and the
 * further back the clock, the fresher it looked. This is the read behind the Ask
 * kill switch: an instance holding a future-dated entry stops re-reading the store,
 * so an operator's pause would never take effect there while Admin reports it off.
 *
 * Reachable by two ordinary routes — a caller passing a shifted `now`, and a
 * non-monotonic `Date.now()` (NTP step, container resume). No live incident is
 * demonstrated; no production caller passes `now` today.
 *
 * These run against the REAL service (only its three collaborators are faked).
 * D1–D4 fail on the unrepaired predicate and pass on the repair. P1–P5 pass on
 * both, so the repair cannot have bought correctness by giving up caching,
 * expiry or fail-closed behaviour. Main's independent reproduction
 * (MAIN-F-DELIVERIES-CONSOLIDATION-R1, probes/repro.mjs) has the same shape.
 */

const NAME = 'ASK_PUBLIC_COMPUTE_ENABLED';
const TTL = 30_000;
const T = 1_000_000_000_000;

function store(initial: boolean | 'THROW') {
  const state: { value: boolean | 'THROW' } = { value: initial };
  let reads = 0;
  const db = {
    operationalSwitch: {
      findUnique: async () => {
        reads += 1;
        if (state.value === 'THROW') throw new Error('store unreadable');
        return {
          name: NAME,
          enabled: state.value,
          setBy: 'po',
          setAt: new Date(T),
          reason: 'test',
        };
      },
    },
  };
  return {
    db,
    set: (value: boolean | 'THROW') => {
      state.value = value;
    },
    reads: () => reads,
  };
}

function service(s: ReturnType<typeof store>) {
  const config = { get: (key: string) => (key.startsWith('ASK_') ? 'true' : undefined) };
  const meter = { config: { flagCacheMs: TTL, storeDeadlineMs: 500 } };
  return new OperationalSwitchService(s.db as never, config as never, meter as never);
}

describe('M-A — negative cache age is stale (defect tests: fail unrepaired, pass repaired)', () => {
  it('D1 · a backwards timestamp forces a store check', async () => {
    const s = store(true);
    const svc = service(s);
    await svc.state(NAME, T);
    expect(s.reads()).toBe(1);
    await svc.state(NAME, T - 1);
    expect(s.reads()).toBe(2);
  });

  it('D2 · a far-backwards clock does not freeze the entry — the operator’s pause is seen', async () => {
    const s = store(true);
    const svc = service(s);
    expect((await svc.state(NAME, T)).effective).toBe(true);
    s.set(false);
    for (const past of [T - 1, T - 60_000, T - 3_600_000, T - 86_400_000]) {
      expect((await svc.state(NAME, past)).effective).toBe(false);
    }
  });

  it('D3 · store failure stays fail-closed under a backwards timestamp', async () => {
    const s = store(true);
    const svc = service(s);
    expect((await svc.state(NAME, T)).effective).toBe(true);
    s.set('THROW');
    const state = await svc.state(NAME, T - 1_000);
    expect(state.readable).toBe(false);
    expect(state.effective).toBe(false);
  });

  it('D4 · a poisoned entry self-repairs, and costs exactly one extra read', async () => {
    const s = store(true);
    const svc = service(s);
    await svc.state(NAME, T + 3_600_000); // an entry stamped in the future
    expect(s.reads()).toBe(1);
    await svc.state(NAME, T); // negative age ⇒ miss, re-stamped at T
    expect(s.reads()).toBe(2);
    await svc.state(NAME, T + 1_000); // ordinary age inside the TTL ⇒ hit
    expect(s.reads()).toBe(2);
  });
});

describe('M-A — ordinary caching, expiry and fail-closed are preserved (pass on both)', () => {
  it('P1 · an age inside the TTL is a hit', async () => {
    const s = store(true);
    const svc = service(s);
    await svc.state(NAME, T);
    await svc.state(NAME, T + 1_000);
    await svc.state(NAME, T + TTL - 1);
    expect(s.reads()).toBe(1);
  });

  it('P2 · an age of exactly 0 is fresh (>= 0, not > 0)', async () => {
    const s = store(true);
    const svc = service(s);
    await svc.state(NAME, T);
    await svc.state(NAME, T);
    expect(s.reads()).toBe(1);
  });

  it('P3 · an age of exactly the TTL is stale (the comparison stays strict)', async () => {
    const s = store(true);
    const svc = service(s);
    await svc.state(NAME, T);
    await svc.state(NAME, T + TTL);
    expect(s.reads()).toBe(2);
  });

  it('P4 · an operator switch-off is seen after the TTL, with no restart', async () => {
    const s = store(true);
    const svc = service(s);
    expect((await svc.state(NAME, T)).effective).toBe(true);
    s.set(false);
    expect((await svc.state(NAME, T + 1_000)).effective).toBe(true); // still inside the TTL
    expect((await svc.state(NAME, T + TTL)).effective).toBe(false);
  });

  it('P5 · an unreadable store is OFF on a forward clock — no fallback to the cached ON', async () => {
    const s = store(true);
    const svc = service(s);
    expect((await svc.state(NAME, T)).effective).toBe(true);
    s.set('THROW');
    const state = await svc.state(NAME, T + TTL);
    expect(state.readable).toBe(false);
    expect(state.effective).toBe(false);
  });

  it('a nonsense clock (NaN) falls through to the store rather than pinning the cache', async () => {
    const s = store(true);
    const svc = service(s);
    await svc.state(NAME, T);
    await svc.state(NAME, Number.NaN);
    expect(s.reads()).toBe(2);
  });
});
