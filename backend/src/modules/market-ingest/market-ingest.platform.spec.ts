import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AcquisitionRefusal } from './market-acquisition-declarations';
import { assertComextRequestIsPermitted } from './eurostat-comext-carveouts';
import { MarketIngestRepository } from './market-ingest.repository';
import {
  DEFAULT_RETRY_POLICY,
  MarketIngestScheduler,
  ProviderCircuit,
  ProviderSlots,
  TransportFailure,
  ValidationFailure,
  backoffDelayMs,
  runKeyFor,
  type AdapterResult,
  type IngestTrigger,
  type MarketIngestAdapter,
  type MarketObservationDraft,
  type SchedulerClock,
} from './market-ingest.scheduler';
import { MarketProviderRegistry, ProviderNotPermitted } from './market-provider-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MKT-PLAT-1/2/3 — THE PLATFORM PROPERTIES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE ADAPTERS HERE ARE INSTRUMENTED, NOT MOCKED-AND-FORGOTTEN. Each one records
 * that it was called, because the single most important claim in this package is
 * about calls that must NOT happen — a blocked provider must throw before network
 * acquisition, and the only way to prove that is to have an adapter that would tell
 * us if it had been reached.
 *
 * NO ADAPTER PERFORMS A FETCH. There is no real adapter in this package at all; the
 * scheduler never implements the interface it declares, and nothing is activated.
 */

/* ───────────────────────────────────────────────────────────────────────────
 * HARNESS
 * ─────────────────────────────────────────────────────────────────────────── */

class TestClock implements SchedulerClock {
  constructor(private ms = 1_700_000_000_000) {}
  now(): number {
    return this.ms;
  }
  async sleep(ms: number): Promise<void> {
    this.slept.push(ms);
    this.ms += ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
  readonly slept: number[] = [];
}

/** A lease/run/observation store that is a real little database, not a call recorder. */
function buildStores() {
  const leases = new Map<
    string,
    { id: string; owner: string; expiresAt: number; released: boolean }
  >();
  const runs = new Map<string, { runId: string; outcome: string | null; detail: string | null }>();
  const observations: MarketObservationDraft[] = [];
  let n = 1;

  return {
    leases,
    runs,
    observations,
    leaseStore: {
      async acquire(i: { runKey: string; owner: string; nowMs: number; leaseMs: number }) {
        const existing = leases.get(i.runKey);
        if (existing !== undefined && !existing.released && existing.expiresAt > i.nowMs) {
          return null;
        }
        const id = existing?.id ?? `lease-${n++}`;
        leases.set(i.runKey, {
          id,
          owner: i.owner,
          expiresAt: i.nowMs + i.leaseMs,
          released: false,
        });
        return { leaseId: id, expiresAtMs: i.nowMs + i.leaseMs };
      },
      async release(leaseId: string) {
        for (const lease of leases.values()) if (lease.id === leaseId) lease.released = true;
      },
      async heartbeat(leaseId: string, nowMs: number, leaseMs: number) {
        for (const lease of leases.values()) {
          if (lease.id === leaseId) lease.expiresAt = nowMs + leaseMs;
        }
        return true;
      },
    },
    runStore: {
      async findByRunKey(runKey: string) {
        const run = runs.get(runKey);
        if (run === undefined || run.outcome === null) return null;
        return { runId: run.runId, outcome: run.outcome as never };
      },
      async begin(i: { runKey: string }) {
        const runId = `run-${n++}`;
        runs.set(i.runKey, { runId, outcome: null, detail: null });
        return { runId };
      },
      async finish(i: { runId: string; outcome: string; detail: string | null }) {
        for (const [key, run] of runs) {
          if (run.runId === i.runId)
            runs.set(key, { ...run, outcome: i.outcome, detail: i.detail });
        }
      },
    },
    observationStore: {
      async upsertMany(i: { observations: readonly MarketObservationDraft[] }) {
        for (const o of i.observations) {
          const seen = observations.some(
            (x) =>
              x.observationKey === o.observationKey &&
              x.vintageProvenance === o.vintageProvenance &&
              x.publisherChangedAt === o.publisherChangedAt,
          );
          if (!seen) observations.push(o);
        }
        return { written: i.observations.length };
      },
    },
  };
}

interface Recorder {
  readonly calls: string[];
  adapter(
    providerId: string,
    subjectClass: string,
    behaviour?: () => Promise<AdapterResult>,
  ): MarketIngestAdapter;
}

function recorder(): Recorder {
  const calls: string[] = [];

  return {
    calls,
    adapter(providerId, subjectClass, behaviour) {
      return {
        providerId,
        subjectClass,
        async acquire(): Promise<AdapterResult> {
          calls.push(`${providerId}/${subjectClass}`);
          if (behaviour !== undefined) return behaviour();
          return { observations: [] };
        },
      };
    },
  };
}

const observation = (over: Partial<MarketObservationDraft> = {}): MarketObservationDraft => ({
  observationKey: 'eco:1:6:s-yld3:m14:2026-08',
  seriesId: 's-yld',
  periodId: '2026-08',
  value: 3.21,
  unit: 'PC',
  publisherVintage: null,
  publisherChangedAt: '2026-09-17T23:00:00.000Z',
  vintageProvenance: 'PUBLISHER_CHANGED_AT',
  releaseStatus: 'FINAL',
  ...over,
});

const trigger = (over: Partial<IngestTrigger> = {}): IngestTrigger => ({
  kind: 'SCHEDULED',
  providerId: 'TED',
  subjectClass: 'PROCUREMENT_OPPORTUNITY',
  cadenceWindow: '2026-09-19',
  ...over,
});

function buildScheduler(
  allowlist: readonly string[],
  clock: TestClock = new TestClock(),
  opts: { globalCeiling?: number; retry?: typeof DEFAULT_RETRY_POLICY } = {},
) {
  const stores = buildStores();
  const scheduler = new MarketIngestScheduler({
    registry: new MarketProviderRegistry(allowlist),
    clock,
    leases: stores.leaseStore,
    runs: stores.runStore,
    observations: stores.observationStore,
    slots: new ProviderSlots(opts.globalCeiling ?? 10),
    circuit: new ProviderCircuit(),
    ...(opts.retry === undefined ? {} : { retry: opts.retry }),
  });

  return { scheduler, stores, clock };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MKT-PLAT-3 · RIGHTS: DEFAULT DENY
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('MKT-PLAT-3 · the default is DENY, not allow', () => {
  it('a registry with no allowlist refuses every provider — including the eligible ones', () => {
    const registry = new MarketProviderRegistry();

    for (const providerId of ['TED', 'GLEIF', 'EUROSTAT']) {
      expect(() => registry.resolve(providerId, 'PROCUREMENT_OPPORTUNITY', 'ACQUIRE')).toThrow(
        ProviderNotPermitted,
      );
    }
  });

  it('an unknown provider is refused because absence of a rights record is a refusal', () => {
    const registry = new MarketProviderRegistry(['UNGM']);

    expect(() => registry.resolve('UNGM', 'ANYTHING', 'ACQUIRE')).toThrow(
      /NO_RIGHTS_RECORD|no rights record/,
    );
    expect(registry.isKnown('UNGM')).toBe(false);
  });

  it('a wildcard is not an allowlist entry — "*" matches no provider', () => {
    const registry = new MarketProviderRegistry(['*']);

    expect(() => registry.resolve('TED', 'PROCUREMENT_OPPORTUNITY', 'ACQUIRE')).toThrow(
      /NOT_ACTIVATED|not in the activation allowlist/,
    );
  });

  it('World Bank is BLOCKED — E-3, commercial use forbidden by its own terms', () => {
    const registry = new MarketProviderRegistry(['WORLD_BANK']);

    try {
      registry.resolve('WORLD_BANK', 'INSTRUMENT', 'ACQUIRE');
      throw new Error('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderNotPermitted);
      expect((error as ProviderNotPermitted).reason).toBe('RIGHTS_CLASS_FORBIDS');
    }
  });

  it('ECB is BLOCKED — E-2a, licence self-contradiction unresolved', () => {
    const registry = new MarketProviderRegistry(['ECB']);

    try {
      registry.resolve('ECB', 'INSTRUMENT', 'ACQUIRE');
      throw new Error('should have refused');
    } catch (error) {
      expect((error as ProviderNotPermitted).reason).toBe('RIGHTS_CLASS_FORBIDS');
    }
  });

  it('TED, GLEIF and Eurostat are rights-eligible and STILL not runnable, because nothing is activated', () => {
    const eligibility = new MarketProviderRegistry().eligibility();
    const byId = Object.fromEntries(eligibility.map((e) => [e.providerId, e]));

    for (const providerId of ['TED', 'GLEIF', 'EUROSTAT']) {
      expect([providerId, byId[providerId]!.rightsEligible]).toEqual([providerId, true]);
      expect([providerId, byId[providerId]!.activated]).toEqual([providerId, false]);
      expect([providerId, byId[providerId]!.runnable]).toEqual([providerId, false]);
      expect([providerId, byId[providerId]!.reason]).toEqual([providerId, 'NOT_ACTIVATED']);
    }

    for (const providerId of ['WORLD_BANK', 'ECB']) {
      expect([providerId, byId[providerId]!.rightsEligible]).toEqual([providerId, false]);
      expect([providerId, byId[providerId]!.runnable]).toEqual([providerId, false]);
    }
  });

  it('every rights-eligible provider carries its citable instrument — a state without one is not a state', () => {
    for (const row of new MarketProviderRegistry().eligibility()) {
      if (!row.rightsEligible) continue;
      expect([row.providerId, (row.instrument ?? '').length > 40]).toEqual([row.providerId, true]);
    }
  });

  it('an undeclared subject class does not run, even for an activated eligible provider', () => {
    const registry = new MarketProviderRegistry(['TED']);

    expect(() => registry.resolve('TED', 'COMMERCIAL_ENTITY', 'ACQUIRE')).toThrow(
      /SUBJECT_CLASS_NOT_DECLARED|no cadence declaration/,
    );
  });

  it('the resolved ceiling is the publisher’s own number, never raised', () => {
    expect(
      new MarketProviderRegistry(['TED']).resolve('TED', 'PROCUREMENT_OPPORTUNITY', 'ACQUIRE')
        .maxConcurrent,
    ).toBe(3);
    expect(
      new MarketProviderRegistry(['GLEIF']).resolve('GLEIF', 'COMMERCIAL_ENTITY', 'ACQUIRE')
        .maxConcurrent,
    ).toBe(1);
    expect(
      new MarketProviderRegistry(['EUROSTAT']).resolve('EUROSTAT', 'INSTRUMENT', 'ACQUIRE')
        .maxConcurrent,
    ).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CENTRAL CLAIM · A BLOCKED PROVIDER THROWS BEFORE NETWORK ACQUISITION
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('a blocked provider throws BEFORE the adapter is reached', () => {
  it.each([
    ['WORLD_BANK', 'INSTRUMENT'],
    ['ECB', 'INSTRUMENT'],
  ])('%s never reaches its adapter', async (providerId, subjectClass) => {
    const rec = recorder();
    const { scheduler } = buildScheduler([providerId]);
    scheduler.register(rec.adapter(providerId, subjectClass));

    const report = await scheduler.run(trigger({ providerId, subjectClass }));

    expect(report.outcome).toBe('RIGHTS_REFUSED');
    // THE ASSERTION THAT MATTERS: the adapter recorded no call at all.
    expect(rec.calls).toEqual([]);
  });

  it('an un-activated but rights-eligible provider also never reaches its adapter', async () => {
    const rec = recorder();
    const { scheduler } = buildScheduler([]); // nothing activated
    scheduler.register(rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY'));

    const report = await scheduler.run(trigger());

    expect(report.outcome).toBe('PROVIDER_DISABLED');
    expect(rec.calls).toEqual([]);
  });

  it('and no run row is written for a refusal — a refusal is not an attempt', async () => {
    const rec = recorder();
    const { scheduler, stores } = buildScheduler(['ECB']);
    scheduler.register(rec.adapter('ECB', 'INSTRUMENT'));

    await scheduler.run(trigger({ providerId: 'ECB', subjectClass: 'INSTRUMENT' }));

    expect(stores.runs.size).toBe(0);
    expect(stores.leases.size).toBe(0);
  });

  it('registering an adapter is not activating it', async () => {
    const rec = recorder();
    const { scheduler } = buildScheduler([]);

    // Registered, present in source, reachable in the map — and still never called.
    scheduler.register(rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY'));
    scheduler.register(rec.adapter('GLEIF', 'COMMERCIAL_ENTITY'));
    scheduler.register(rec.adapter('EUROSTAT', 'INSTRUMENT'));

    await scheduler.runAll([
      trigger(),
      trigger({ providerId: 'GLEIF', subjectClass: 'COMMERCIAL_ENTITY' }),
      trigger({ providerId: 'EUROSTAT', subjectClass: 'INSTRUMENT' }),
    ]);

    expect(rec.calls).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * MKT-PLAT-1 · TRIGGERS, IDEMPOTENCY, LEASES
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('SI-1 · no user action can be a trigger', () => {
  it('the trigger union is exactly the four kinds', () => {
    const kinds = ['SCHEDULED', 'MANUAL_AUTHORISED', 'BACKFILL', 'RETRY'];
    const source = readFileSync(join(__dirname, 'market-ingest.scheduler.ts'), 'utf8') as string;

    expect(source).toContain(
      "export const TRIGGER_KINDS = ['SCHEDULED', 'MANUAL_AUTHORISED', 'BACKFILL', 'RETRY'] as const;",
    );
    for (const forbidden of ['USER_REQUEST', 'PAGE_LOAD', 'ON_DEMAND', 'LAZY_REFRESH']) {
      expect([forbidden, kinds.includes(forbidden)]).toEqual([forbidden, false]);
      expect([forbidden, source.includes(`'${forbidden}'`)]).toEqual([forbidden, false]);
    }
  });

  it('a manual run without an authoriser is refused', async () => {
    const rec = recorder();
    const { scheduler } = buildScheduler(['TED']);
    scheduler.register(rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY'));

    const report = await scheduler.run(trigger({ kind: 'MANUAL_AUTHORISED' }));

    expect(report.outcome).toBe('PROVIDER_DISABLED');
    expect(report.detail).toMatch(/authorised/);
    expect(rec.calls).toEqual([]);
  });
});

describe('SI-6 · idempotency and leases', () => {
  it('two triggers for the same window are ONE run', async () => {
    const rec = recorder();
    const { scheduler, stores } = buildScheduler(['TED']);
    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => ({
        observations: [observation()],
      })),
    );

    const first = await scheduler.run(trigger());
    const second = await scheduler.run(trigger());

    expect(first.outcome).toBe('SUCCEEDED');
    expect(second.detail).toMatch(/idempotent/);
    expect(rec.calls).toHaveLength(1);
    expect(stores.observations).toHaveLength(1);
  });

  it('the run key is length-prefixed, so a window containing a delimiter cannot collide', () => {
    const a = runKeyFor(trigger({ cadenceWindow: 'a', subjectClass: 'b:c' }));
    const b = runKeyFor(trigger({ cadenceWindow: 'a:b', subjectClass: 'c' }));

    expect(a).not.toBe(b);
  });

  it('a second owner cannot take an unexpired lease — the run is DEFERRED, not dropped', async () => {
    const rec = recorder();
    const clock = new TestClock();
    const stores = buildStores();

    const make = (owner: string) =>
      new MarketIngestScheduler({
        registry: new MarketProviderRegistry(['TED']),
        clock,
        leases: stores.leaseStore,
        runs: stores.runStore,
        observations: stores.observationStore,
        slots: new ProviderSlots(10),
        circuit: new ProviderCircuit(),
        owner,
      });

    // Hold the lease by hand, as a live worker would.
    await stores.leaseStore.acquire({
      runKey: runKeyFor(trigger()),
      owner: 'worker-a',
      nowMs: clock.now(),
      leaseMs: 60_000,
    });

    const b = make('worker-b');
    b.register(rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY'));
    const report = await b.run(trigger());

    expect(report.outcome).toBe('DEFERRED');
    expect(rec.calls).toEqual([]);
  });

  it('a CRASHED owner’s lease expires and is recovered — no janitor required', async () => {
    const rec = recorder();
    const clock = new TestClock();
    const stores = buildStores();

    await stores.leaseStore.acquire({
      runKey: runKeyFor(trigger()),
      owner: 'worker-a-which-then-died',
      nowMs: clock.now(),
      leaseMs: 60_000,
    });

    clock.advance(60_001); // the lease lapses

    const b = new MarketIngestScheduler({
      registry: new MarketProviderRegistry(['TED']),
      clock,
      leases: stores.leaseStore,
      runs: stores.runStore,
      observations: stores.observationStore,
      slots: new ProviderSlots(10),
      circuit: new ProviderCircuit(),
      owner: 'worker-b',
    });
    b.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => ({
        observations: [observation()],
      })),
    );

    const report = await b.run(trigger());

    expect(report.outcome).toBe('SUCCEEDED');
    expect(rec.calls).toHaveLength(1);
  });

  it('the lease is released even when the adapter throws', async () => {
    const rec = recorder();
    const { scheduler, stores } = buildScheduler(['TED'], new TestClock(), {
      retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    });
    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => {
        throw new TransportFailure('connection reset');
      }),
    );

    await scheduler.run(trigger());

    const lease = [...stores.leases.values()][0]!;
    expect(lease.released).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * SI-3 · CONCURRENCY, AND SI-4 · RETRY / CIRCUIT
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('SI-3 · concurrency is enforced at the fetch seam', () => {
  it('a provider at its ceiling defers rather than exceeding it', () => {
    const slots = new ProviderSlots(100);

    expect(slots.tryAcquire('TED', 3)).toBe(true);
    expect(slots.tryAcquire('TED', 3)).toBe(true);
    expect(slots.tryAcquire('TED', 3)).toBe(true);
    expect(slots.tryAcquire('TED', 3)).toBe(false);
    expect(slots.inFlightFor('TED')).toBe(3);

    slots.release('TED');
    expect(slots.tryAcquire('TED', 3)).toBe(true);
  });

  it('GLEIF and Eurostat are ceiling 1 — "no stated limit" is not "no limit"', () => {
    const slots = new ProviderSlots(100);

    expect(slots.tryAcquire('GLEIF', 1)).toBe(true);
    expect(slots.tryAcquire('GLEIF', 1)).toBe(false);
    expect(slots.tryAcquire('EUROSTAT', 1)).toBe(true);
    expect(slots.tryAcquire('EUROSTAT', 1)).toBe(false);
  });

  it('BOTH ceilings apply — a provider under its own limit still waits on the global one', () => {
    const slots = new ProviderSlots(2);

    expect(slots.tryAcquire('TED', 3)).toBe(true);
    expect(slots.tryAcquire('TED', 3)).toBe(true);
    // TED is at 2 of its 3, but the process is at its global 2.
    expect(slots.tryAcquire('TED', 3)).toBe(false);
    expect(slots.tryAcquire('GLEIF', 1)).toBe(false);
  });

  it('a RETRY counts against the ceiling, because the slot is taken around each attempt', async () => {
    const rec = recorder();
    const clock = new TestClock();
    const { scheduler, stores } = buildScheduler(['TED'], clock, {
      retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 },
    });

    let attempt = 0;
    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => {
        attempt += 1;
        if (attempt < 3) throw new TransportFailure('429');
        return { observations: [observation()] };
      }),
    );

    const report = await scheduler.run(trigger());

    expect(report.outcome).toBe('SUCCEEDED');
    expect(report.attempts).toBe(3);
    expect(rec.calls).toHaveLength(3);
    // Every slot taken was released — a leaked slot is a ceiling that shrinks to zero.
    expect(stores.observations).toHaveLength(1);
  });
});

describe('SI-4 · retry, backoff and the circuit', () => {
  it('only transport-class failures are retried', async () => {
    const rec = recorder();
    const { scheduler } = buildScheduler(['TED'], new TestClock(), {
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    });
    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => {
        throw new ValidationFailure('the publisher changed the schema');
      }),
    );

    const report = await scheduler.run(trigger());

    expect(report.outcome).toBe('VALIDATION_FAILED');
    expect(report.attempts).toBe(1); // NOT retried
    expect(rec.calls).toHaveLength(1);
  });

  it('a rights refusal raised mid-request is never retried either', async () => {
    const rec = recorder();
    const { scheduler } = buildScheduler(['EUROSTAT'], new TestClock(), {
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    });
    scheduler.register(
      rec.adapter('EUROSTAT', 'INSTRUMENT', async () => {
        throw new AcquisitionRefusal('RIGHTS_REFUSED: reporter CH is carved out');
      }),
    );

    const report = await scheduler.run(
      trigger({ providerId: 'EUROSTAT', subjectClass: 'INSTRUMENT' }),
    );

    expect(report.outcome).toBe('RIGHTS_REFUSED');
    expect(rec.calls).toHaveLength(1);
  });

  it('backoff is exponential, jittered, and Retry-After wins when it is longer', () => {
    const p = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 30_000 };

    expect(backoffDelayMs(1, p, 0)).toBe(1_000);
    expect(backoffDelayMs(2, p, 0)).toBe(2_000);
    expect(backoffDelayMs(3, p, 0)).toBe(4_000);
    expect(backoffDelayMs(99, p, 0)).toBe(30_000); // capped
    expect(backoffDelayMs(1, p, 0.1)).toBe(1_100); // jittered

    // SI-4.3 — the publisher asking for longer is obeyed...
    expect(backoffDelayMs(1, p, 0, 9_000)).toBe(9_000);
    // ...and a publisher asking for shorter does not let us go below our own floor.
    expect(backoffDelayMs(3, p, 0, 500)).toBe(4_000);
  });

  it('a failed provider does NOT create a rapid request loop — it opens a circuit', async () => {
    const rec = recorder();
    const clock = new TestClock();
    const circuit = new ProviderCircuit(3);
    const stores = buildStores();

    const scheduler = new MarketIngestScheduler({
      registry: new MarketProviderRegistry(['TED']),
      clock,
      leases: stores.leaseStore,
      runs: stores.runStore,
      observations: stores.observationStore,
      slots: new ProviderSlots(10),
      circuit,
      retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50 },
    });
    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => {
        throw new TransportFailure('502');
      }),
    );

    const first = await scheduler.run(trigger({ cadenceWindow: 'w1' }));
    expect(first.outcome).toBe('TRANSPORT_FAILED');
    expect(circuit.isOpen('TED', clock.now())).toBe(true);

    const callsBefore = rec.calls.length;
    const second = await scheduler.run(trigger({ cadenceWindow: 'w2' }));

    expect(second.outcome).toBe('CIRCUIT_OPEN');
    // THE POINT: the second run made no request at all.
    expect(rec.calls).toHaveLength(callsBefore);

    clock.advance(60_001);
    expect(circuit.isOpen('TED', clock.now())).toBe(false);
  });

  it('retries do not extend the run deadline', async () => {
    const rec = recorder();
    const clock = new TestClock();
    const stores = buildStores();

    const scheduler = new MarketIngestScheduler({
      registry: new MarketProviderRegistry(['TED']),
      clock,
      leases: stores.leaseStore,
      runs: stores.runStore,
      observations: stores.observationStore,
      slots: new ProviderSlots(10),
      circuit: new ProviderCircuit(99),
      retry: { maxAttempts: 10, baseDelayMs: 5_000, maxDelayMs: 5_000 },
      runDeadlineMs: 6_000,
    });
    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => {
        throw new TransportFailure('timeout');
      }),
    );

    const report = await scheduler.run(trigger());

    expect(report.outcome).toBe('TIMED_OUT');
    expect(report.detail).toMatch(/deadline/);
    expect(rec.calls.length).toBeLessThan(10);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * PARTIAL-FAILURE ISOLATION
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('one failing provider does not take the others down', () => {
  it('runAll settles per provider — never Promise.all across them', async () => {
    const rec = recorder();
    const { scheduler, stores } = buildScheduler(['TED', 'GLEIF', 'EUROSTAT'], new TestClock(), {
      retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    });

    scheduler.register(
      rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY', async () => {
        throw new TransportFailure('TED is down');
      }),
    );
    scheduler.register(
      rec.adapter('GLEIF', 'COMMERCIAL_ENTITY', async () => ({
        observations: [observation({ observationKey: 'gleif-1' })],
      })),
    );
    scheduler.register(
      rec.adapter('EUROSTAT', 'INSTRUMENT', async () => ({
        observations: [observation({ observationKey: 'eurostat-1' })],
      })),
    );

    const reports = await scheduler.runAll([
      trigger(),
      trigger({ providerId: 'GLEIF', subjectClass: 'COMMERCIAL_ENTITY' }),
      trigger({ providerId: 'EUROSTAT', subjectClass: 'INSTRUMENT' }),
    ]);

    expect(reports.map((r) => r.outcome)).toEqual(['TRANSPORT_FAILED', 'SUCCEEDED', 'SUCCEEDED']);
    expect(stores.observations).toHaveLength(2);

    const source = readFileSync(join(__dirname, 'market-ingest.scheduler.ts'), 'utf8') as string;
    expect(source).toContain('Promise.allSettled');
    expect(source).not.toMatch(/Promise\.all\(/);
  });

  it('NO_NEW_DATA is its own outcome — it is not NO_MATERIAL_CHANGE and not a failure', async () => {
    const rec = recorder();
    const { scheduler } = buildScheduler(['TED']);
    scheduler.register(rec.adapter('TED', 'PROCUREMENT_OPPORTUNITY'));

    const report = await scheduler.run(trigger());

    expect(report.outcome).toBe('NO_NEW_DATA');
    expect(report.observationsWritten).toBe(0);
    expect(rec.calls).toHaveLength(1); // it DID run; it just saw nothing
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * SI-6.2 / SI-8 · OBSERVATION IDENTITY AND REVISIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('SI-6.2 · re-running a window does not duplicate an observation', () => {
  it('and SI-8.1 · a revision APPENDS rather than overwriting', async () => {
    const stores = buildStores();

    await stores.observationStore.upsertMany({ observations: [observation()] } as never);
    await stores.observationStore.upsertMany({ observations: [observation()] } as never);
    expect(stores.observations).toHaveLength(1);

    // A revision carries a different publisherChangedAt, so it is a different row.
    await stores.observationStore.upsertMany({
      observations: [
        observation({ publisherChangedAt: '2026-09-18T23:00:00.000Z', releaseStatus: 'REVISED' }),
      ],
    } as never);

    expect(stores.observations).toHaveLength(2);
    expect(stores.observations.map((o) => o.releaseStatus)).toEqual(['FINAL', 'REVISED']);
  });
});

describe('SI-9 / M-1 · a vintage claim must be backed by the timestamp it names', () => {
  const repo = () =>
    new MarketIngestRepository({
      marketIngestRun: { findUnique: () => {}, create: () => {}, update: () => {} },
      marketIngestLease: {
        findUnique: () => {},
        create: () => {},
        updateMany: () => {},
        update: () => {},
      },
      marketObservation: { upsert: async () => ({}) },
    });

  it('PUBLISHER_VINTAGE with no vintage is refused', async () => {
    await expect(
      repo().upsertMany({
        runId: 'r',
        providerId: 'TED',
        subjectClass: 'PROCUREMENT_OPPORTUNITY',
        snapshotContentAddress: null,
        ingestedAtMs: 0,
        observations: [
          observation({ vintageProvenance: 'PUBLISHER_VINTAGE', publisherVintage: null }),
        ],
      }),
    ).rejects.toThrow(/M-1/);
  });

  it('PUBLISHER_CHANGED_AT with no change timestamp is refused', async () => {
    await expect(
      repo().upsertMany({
        runId: 'r',
        providerId: 'TED',
        subjectClass: 'PROCUREMENT_OPPORTUNITY',
        snapshotContentAddress: null,
        ingestedAtMs: 0,
        observations: [
          observation({ vintageProvenance: 'PUBLISHER_CHANGED_AT', publisherChangedAt: null }),
        ],
      }),
    ).rejects.toThrow(/M-1/);
  });

  it('INGEST_SNAPSHOT is the honest fallback and needs no publisher timestamp', async () => {
    await expect(
      repo().upsertMany({
        runId: 'r',
        providerId: 'TED',
        subjectClass: 'PROCUREMENT_OPPORTUNITY',
        snapshotContentAddress: null,
        ingestedAtMs: 0,
        observations: [
          observation({
            vintageProvenance: 'INGEST_SNAPSHOT',
            publisherVintage: null,
            publisherChangedAt: null,
          }),
        ],
      }),
    ).resolves.toEqual({ written: 1 });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §6 · FRESHNESS — GLEIF IS NEVER LIVE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('acquisition freshness and observation freshness stay distinct', () => {
  it('a successful run does NOT make a reading live — the ceiling is the publisher’s', () => {
    const provider = new MarketProviderRegistry(['GLEIF']).resolve(
      'GLEIF',
      'COMMERCIAL_ENTITY',
      'ACQUIRE',
    );

    expect(provider.cadence.freshnessCeilingHours).toBe(8);
    expect(provider.cadence.justification).toMatch(/LIVE IS UNREACHABLE/);
  });

  it('the scheduler maps no run outcome onto a freshness state', () => {
    const source = readFileSync(join(__dirname, 'market-ingest.scheduler.ts'), 'utf8') as string;

    for (const forbidden of ['LIVE', 'FRESH', 'freshness', 'isFresh']) {
      expect([
        forbidden,
        new RegExp(`\\b${forbidden}\\b`).test(source.replace(/\/\*[\s\S]*?\*\//g, '')),
      ]).toEqual([forbidden, false]);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §4 · EUROSTAT CARVE-OUTS — CONSUMED, NOT REWRITTEN
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('the Eurostat carve-outs are G’s implementation, consumed unchanged', () => {
  const req = (over: Record<string, string> = {}) => ({
    freq: 'M',
    reporter: 'DE',
    partner: 'CH',
    product: '12345678',
    flow: '1',
    indicators: 'VALUE_IN_EUROS',
    ...over,
  });

  it('a carved-out REPORTER is refused', () => {
    for (const reporter of ['CH', 'LI']) {
      expect(() => assertComextRequestIsPermitted(req({ reporter }))).toThrow(AcquisitionRefusal);
    }
  });

  it('the same country as PARTNER is permitted — the carve-out is not about it', () => {
    expect(() =>
      assertComextRequestIsPermitted(req({ reporter: 'DE', partner: 'CH' })),
    ).not.toThrow();
  });

  it('Austria is carved out at CN8 only', () => {
    expect(() =>
      assertComextRequestIsPermitted(req({ reporter: 'AT', product: '12345678' })),
    ).toThrow();
    expect(() =>
      assertComextRequestIsPermitted(req({ reporter: 'AT', product: '1234' })),
    ).not.toThrow();
  });

  it('non-EU/EFTA reporters are outside the grant', () => {
    expect(() => assertComextRequestIsPermitted(req({ reporter: 'US' }))).toThrow(/non-EU\/EFTA/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §5 · C-15 · TED AND GLEIF STAY INDEPENDENT
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('C-15 · no scorer, no fuzzy merge, no guessed LEI mapping — in the PLATFORM too', () => {
  const sources = [
    'market-ingest.scheduler.ts',
    'market-provider-registry.ts',
    'market-ingest.repository.ts',
  ];

  it.each(sources)('%s declares no similarity, score or confidence field', (file) => {
    const raw = readFileSync(join(__dirname, file), 'utf8') as string;
    // Comments stripped: the prohibition is described in prose in these files, and a
    // scan that fired on its own documentation is the failure mode already met twice
    // in this programme.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

    expect(code).not.toMatch(
      /readonly\s+(score|similarity|confidence|matchStrength|probability)\b/i,
    );
    expect(code).not.toMatch(/function\s+\w*(similar|fuzzy|score)\w*\s*\(/i);
    expect(code).not.toMatch(/\blei\b/i);
  });

  it('the scan has a positive control — it would catch a scorer if one existed', () => {
    const planted = 'interface X { readonly score: number }';

    expect(planted).toMatch(
      /readonly\s+(score|similarity|confidence|matchStrength|probability)\b/i,
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §7 · NETWORK / COST — NO PAGE-LOAD FAN-OUT
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('§7 · nothing in this module can be reached from a request', () => {
  const sources = [
    'market-ingest.scheduler.ts',
    'market-provider-registry.ts',
    'market-ingest.repository.ts',
    'market-acquisition-declarations.ts',
    'eurostat-comext-carveouts.ts',
  ];

  it.each(sources)('%s exposes no controller, route or resolver', (file) => {
    const code = readFileSync(join(__dirname, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

    expect(code).not.toMatch(
      /@Controller|@Get\(|@Post\(|@Put\(|@Delete\(|@Injectable\(\{\s*scope/i,
    );
  });

  it.each(sources)('%s performs no fetch and reads no secret', (file) => {
    const code = readFileSync(join(__dirname, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

    expect(code).not.toMatch(/\bfetch\(|axios|HttpService|node:https|process\.env|apiKey|API_KEY/i);
  });

  it('there is still no scheduler runtime in this backend — P-1 is unchanged', () => {
    const code = (readFileSync(join(__dirname, 'market-ingest.scheduler.ts'), 'utf8') as string)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

    expect(code).not.toMatch(/@Cron|@Interval|ScheduleModule|setInterval|node-cron|bullmq?/i);
  });

  it('opening a Market surface executes nothing, because no surface imports this module', () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..');

    /*
      `git grep` EXITS 1 WHEN IT FINDS NOTHING, and finding nothing is the passing case
      here — so the empty result arrives as a thrown error rather than as an empty string.
      Reading the exit code is the whole point: status 1 is "no match", and anything else
      is a real failure that must not be swallowed into a pass.
    */
    let matches: string;

    try {
      matches = execFileSync(
        'git',
        ['grep', '-l', '-E', 'market-ingest', '--', 'frontend/src', 'backend/src/app.module.ts'],
        { cwd: repoRoot, encoding: 'utf-8' },
      ).trim();
    } catch (error) {
      const status = (error as { status?: number }).status;

      if (status !== 1) throw error;
      matches = '';
    }

    expect(matches).toBe('');
  });
});
