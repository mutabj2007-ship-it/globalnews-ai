import { AcquisitionRefusal, type RunOutcome } from './market-acquisition-declarations';
import {
  MarketProviderRegistry,
  ProviderNotPermitted,
  type PermittedProvider,
} from './market-provider-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MKT-PLAT-1 — THE SCHEDULED INGEST RUNTIME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's D-10 execution shape, implemented:
 *
 *   scheduled trigger → provider lease → RIGHTS GATE → provider adapter → validation
 *                     → observation persistence → provenance → internal read path
 *
 * ── ONE DEVIATION FROM THE ARROW DIAGRAM, AND IT IS DELIBERATE ────────────
 *
 * The brief's sketch places the rights gate AFTER the adapter. It is placed BEFORE here,
 * because the brief's own acceptance criterion says *"tests must prove blocked providers
 * throw before network acquisition"* — and a gate downstream of the adapter cannot do
 * that. G's integration instruction says the same thing in the other direction: *"call
 * `assertProviderRightsPermitRunning(providerId)` BEFORE the fetch"*.
 *
 * So there are TWO rights checks and they are different questions:
 *
 *   1. MAY THIS PROVIDER RUN AT ALL — `registry.resolve()`, before the adapter exists in
 *      the call stack. A refusal here means no adapter is constructed and no socket opens;
 *   2. MAY THIS PARTICULAR REQUEST GO OUT — the per-request predicate an adapter declares,
 *      e.g. Eurostat's Comext carve-out, which keys on `reporter` and can only be evaluated
 *      once the request is known.
 *
 * Validation of what came BACK is a third thing and happens after the adapter, where the
 * sketch puts it.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * It is NOT a cron daemon. There is still no `@nestjs/schedule`, no bull, no `@Cron` and
 * no `setInterval` in this backend, and adding one is its own authorisation — P-1 in G's
 * dependency list. `SchedulerClock` is an injected seam: a real deployment supplies a
 * timer, and the tests supply a hand-cranked one, which is why every lease-expiry and
 * backoff property below is testable without waiting in real time.
 *
 * It performs NO fetch. `MarketIngestAdapter` is an interface; this module never
 * implements one, and no adapter exists in this package. Providers are not activated.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · TRIGGERS — SI-1
 * ═══════════════════════════════════════════════════════════════════════════ */

/** SI-1.1 — exactly four kinds, and a run record always names which. */
export const TRIGGER_KINDS = ['SCHEDULED', 'MANUAL_AUTHORISED', 'BACKFILL', 'RETRY'] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/**
 * SI-1.2 — NO USER ACTION MAY BE A TRIGGER.
 *
 * There is no `USER_REQUEST` member and no way to add one through configuration. Opening a
 * dashboard, selecting a subject and rendering a widget are not in this union, so a read
 * path that wanted to trigger acquisition would have to change this file — which is a
 * reviewed change rather than a quiet one.
 */
export interface IngestTrigger {
  readonly kind: TriggerKind;
  readonly providerId: string;
  readonly subjectClass: string;
  /** SI-6.1 — the window this run is for. Two triggers for one window are one run. */
  readonly cadenceWindow: string;
  /** Required for MANUAL_AUTHORISED: who authorised it. A manual run without one is refused. */
  readonly authorisedBy?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE SEAMS — injected, never implemented here
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Time, injected so expiry and backoff are testable without waiting. */
export interface SchedulerClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface AdapterResult {
  /** Observations the adapter produced. Empty is legitimate and means NO_NEW_DATA. */
  readonly observations: readonly MarketObservationDraft[];
  /** The payload address, where the adapter retained one through the snapshot store. */
  readonly snapshotContentAddress?: string;
}

/**
 * What an adapter produces. The observation vocabulary is `ECON-CONTRACT-1`'s — SI-7.1 —
 * and this lane creates none of its own. The C51 guard forbids `MarketSeries`,
 * `MarketPeriod`, `MarketObservation` and friends; nothing here declares them.
 */
export interface MarketObservationDraft {
  /** SI-7.2 — the encoded (series, period) key plus the provider's own key dimensions. */
  readonly observationKey: string;
  readonly seriesId: string;
  readonly periodId: string;
  readonly value: number | null;
  readonly unit: string;
  /** SI-9.1 — three timestamps, never collapsed. */
  readonly publisherVintage: string | null;
  readonly publisherChangedAt: string | null;
  /** SI-9.2 — which of the three the value is carrying. Bound at write, never inferred. */
  readonly vintageProvenance: 'PUBLISHER_VINTAGE' | 'PUBLISHER_CHANGED_AT' | 'INGEST_SNAPSHOT';
  readonly releaseStatus: 'SCHEDULED' | 'PRELIMINARY' | 'REVISED' | 'FINAL' | 'WITHDRAWN';
}

/**
 * A provider adapter. THIS PACKAGE IMPLEMENTS NONE.
 *
 * `acquire` is the only method and it is given the permitted provider, so an adapter
 * cannot be called without one — which means it cannot be called without the rights gate
 * having already passed.
 */
export interface MarketIngestAdapter {
  readonly providerId: string;
  readonly subjectClass: string;
  /** Per-request rights, e.g. the Comext carve-out. Refuse by throwing. */
  assertRequestIsPermitted?(request: unknown): void;
  acquire(provider: PermittedProvider, signal: AbortSignal): Promise<AdapterResult>;
}

/** SI-6.3 — lease storage. The repository implements it; the scheduler only uses it. */
export interface LeaseStore {
  /** Returns null when another owner holds an unexpired lease. */
  acquire(input: {
    runKey: string;
    owner: string;
    nowMs: number;
    leaseMs: number;
  }): Promise<{ leaseId: string; expiresAtMs: number } | null>;
  release(leaseId: string): Promise<void>;
  /** Extend while work continues, so a long legitimate run is not stolen from. */
  heartbeat(leaseId: string, nowMs: number, leaseMs: number): Promise<boolean>;
}

/** SI-6.1/6.2 — run records, keyed so a repeat window is not a second run. */
export interface RunStore {
  findByRunKey(runKey: string): Promise<{ runId: string; outcome: RunOutcome } | null>;
  begin(input: {
    runKey: string;
    trigger: IngestTrigger;
    startedAtMs: number;
  }): Promise<{ runId: string }>;
  finish(input: {
    runId: string;
    outcome: RunOutcome;
    finishedAtMs: number;
    observationsWritten: number;
    detail: string | null;
  }): Promise<void>;
}

export interface ObservationStore {
  /** SI-6.2 — idempotent on observation identity, never on wall-clock time. */
  upsertMany(input: {
    runId: string;
    providerId: string;
    subjectClass: string;
    snapshotContentAddress: string | null;
    observations: readonly MarketObservationDraft[];
    ingestedAtMs: number;
  }): Promise<{ written: number }>;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · CONCURRENCY — SI-3, ENFORCED AT THE FETCH SEAM
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * SI-3.4 — "the ceiling is enforced at the fetch seam, not by scheduling arithmetic. A
 * retry, a manual run and a backfill all count against it."
 *
 * So this is a real semaphore held across the adapter call, not a calculation about how
 * often runs are started. A retry re-enters it; a manual run re-enters it; a backfill
 * re-enters it. There is no path that acquires a slot without releasing it, because the
 * release is in a `finally`.
 */
export class ProviderSlots {
  private readonly inFlight = new Map<string, number>();
  private readonly waiters = new Map<string, Array<() => void>>();

  constructor(private readonly globalCeiling: number) {}

  private globalInFlight(): number {
    let total = 0;
    for (const n of this.inFlight.values()) total += n;
    return total;
  }

  /** Current in-flight count for a provider. For assertions and reporting. */
  inFlightFor(providerId: string): number {
    return this.inFlight.get(providerId) ?? 0;
  }

  tryAcquire(providerId: string, ceiling: number): boolean {
    const current = this.inFlight.get(providerId) ?? 0;

    // SI-3.1 — BOTH ceilings apply. A provider under its own limit still waits when the
    // process is at its global one.
    if (current >= ceiling) return false;
    if (this.globalInFlight() >= this.globalCeiling) return false;

    this.inFlight.set(providerId, current + 1);
    return true;
  }

  release(providerId: string): void {
    const current = this.inFlight.get(providerId) ?? 0;
    this.inFlight.set(providerId, Math.max(0, current - 1));

    const queue = this.waiters.get(providerId);
    const next = queue?.shift();
    if (next !== undefined) next();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · CIRCUIT BREAKER — SI-4.5
 * ═══════════════════════════════════════════════════════════════════════════ */

export class ProviderCircuit {
  private readonly consecutiveFailures = new Map<string, number>();
  private readonly openUntilMs = new Map<string, number>();

  constructor(private readonly threshold: number = 3) {}

  isOpen(providerId: string, nowMs: number): boolean {
    const until = this.openUntilMs.get(providerId);
    if (until === undefined) return false;
    if (nowMs >= until) {
      // Cooldown elapsed: the circuit closes and the failure count resets, so a provider
      // that recovers is not permanently one failure from re-opening.
      this.openUntilMs.delete(providerId);
      this.consecutiveFailures.delete(providerId);
      return false;
    }
    return true;
  }

  recordSuccess(providerId: string): void {
    this.consecutiveFailures.delete(providerId);
    this.openUntilMs.delete(providerId);
  }

  recordFailure(providerId: string, nowMs: number, cooldownMs: number): void {
    const failures = (this.consecutiveFailures.get(providerId) ?? 0) + 1;
    this.consecutiveFailures.set(providerId, failures);

    if (failures >= this.threshold) {
      this.openUntilMs.set(providerId, nowMs + cooldownMs);
    }
  }

  failureCount(providerId: string): number {
    return this.consecutiveFailures.get(providerId) ?? 0;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · RETRY — SI-4
 * ═══════════════════════════════════════════════════════════════════════════ */

/** SI-4.2 — ONLY transport-class failures are retried. A 404 and a schema change are not. */
export class TransportFailure extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'TransportFailure';
  }
}

/** A validation failure is permanent by definition — retrying it changes nothing. */
export class ValidationFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationFailure';
  }
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

/**
 * SI-4.1 — bounded, exponential, jittered. SI-4.3 — a `Retry-After` OVERRIDES the
 * computed backoff, in both directions: a publisher asking for longer is obeyed, and a
 * publisher asking for shorter does not let us go faster than our own floor.
 */
export function backoffDelayMs(
  attempt: number,
  policy: RetryPolicy,
  jitter: number,
  retryAfterMs?: number,
): number {
  const exponential = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
  const jittered = Math.round(exponential * (1 + jitter));

  if (retryAfterMs === undefined) return jittered;

  return Math.max(retryAfterMs, jittered);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · THE SCHEDULER
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface RunReport {
  readonly runKey: string;
  readonly runId: string | null;
  readonly outcome: RunOutcome;
  readonly attempts: number;
  readonly observationsWritten: number;
  readonly detail: string | null;
}

export interface SchedulerDeps {
  readonly registry: MarketProviderRegistry;
  readonly clock: SchedulerClock;
  readonly leases: LeaseStore;
  readonly runs: RunStore;
  readonly observations: ObservationStore;
  readonly slots: ProviderSlots;
  readonly circuit: ProviderCircuit;
  readonly retry?: RetryPolicy;
  /** SI-5.2 — the RUN deadline, distinct from the fetch deadline. */
  readonly runDeadlineMs?: number;
  readonly leaseMs?: number;
  readonly owner?: string;
}

/** SI-6.1 — a run is identified by provider × subject class × window × trigger kind. */
export function runKeyFor(trigger: IngestTrigger): string {
  const parts = [trigger.providerId, trigger.subjectClass, trigger.cadenceWindow, trigger.kind];
  // The same length-prefixed encoding the accepted contracts use, and for the accepted
  // reason: a delimiter-joined key collides as soon as one part contains the delimiter,
  // and the collision is invisible — nothing throws, one run simply wins.
  return parts.map((p) => `${p.length}:${p}`).join('');
}

export class MarketIngestScheduler {
  private readonly adapters = new Map<string, MarketIngestAdapter>();

  constructor(private readonly deps: SchedulerDeps) {}

  /**
   * Registering an adapter is NOT activating it. The adapter sits in a map and is reachable
   * only through `run()`, which gates on the registry first. This is the code shape behind
   * "a provider adapter existing in source is not permission to execute it".
   */
  register(adapter: MarketIngestAdapter): void {
    this.adapters.set(`${adapter.providerId}::${adapter.subjectClass}`, adapter);
  }

  /**
   * SI-1.4 — fan out per provider, settle per provider, record per provider.
   *
   * `Promise.allSettled`, NEVER `Promise.all`. The measured precedent is a 404 ms feed held
   * 7,630 ms by one stalled member; with `all`, one provider's timeout becomes every
   * provider's timeout, and a partial-failure isolation requirement becomes a lie.
   */
  async runAll(triggers: readonly IngestTrigger[]): Promise<readonly RunReport[]> {
    const settled = await Promise.allSettled(triggers.map((t) => this.run(t)));

    return settled.map((result, i) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            runKey: runKeyFor(triggers[i]!),
            runId: null,
            outcome: 'TRANSPORT_FAILED' as RunOutcome,
            attempts: 0,
            observationsWritten: 0,
            detail: `unhandled: ${String((result.reason as Error)?.message ?? result.reason)}`,
          },
    );
  }

  async run(trigger: IngestTrigger): Promise<RunReport> {
    const runKey = runKeyFor(trigger);
    const nowMs = this.deps.clock.now();

    const refuse = (outcome: RunOutcome, detail: string): RunReport => ({
      runKey,
      runId: null,
      outcome,
      attempts: 0,
      observationsWritten: 0,
      detail,
    });

    if (trigger.kind === 'MANUAL_AUTHORISED' && (trigger.authorisedBy ?? '').trim() === '') {
      return refuse(
        'PROVIDER_DISABLED',
        'a MANUAL_AUTHORISED trigger must name who authorised it; an unattributed manual run is not authorised',
      );
    }

    /*
      ── GATE 1 · RIGHTS, BEFORE ANYTHING ELSE ──────────────────────────────
      Before the lease, before the circuit, before the adapter is even looked up. A refusal
      here means no adapter object is touched and no socket can open, which is what the
      acceptance criterion asks to be proven.
    */
    let provider: PermittedProvider;

    try {
      provider = this.deps.registry.resolve(trigger.providerId, trigger.subjectClass, 'ACQUIRE');
    } catch (error) {
      const reason = error instanceof ProviderNotPermitted ? error.reason : 'NO_RIGHTS_RECORD';
      const outcome: RunOutcome =
        reason === 'NOT_ACTIVATED' ? 'PROVIDER_DISABLED' : 'RIGHTS_REFUSED';

      return refuse(outcome, (error as Error).message);
    }

    // SI-4.5 — a provider in cooldown does not run, and says so rather than failing again.
    if (this.deps.circuit.isOpen(trigger.providerId, nowMs)) {
      return refuse('CIRCUIT_OPEN', `'${trigger.providerId}' is in circuit cooldown`);
    }

    // SI-6.2 — an identical window already completed is not re-run.
    const existing = await this.deps.runs.findByRunKey(runKey);
    if (existing !== null) {
      return {
        runKey,
        runId: existing.runId,
        outcome: existing.outcome,
        attempts: 0,
        observationsWritten: 0,
        detail: 'idempotent: this window already ran',
      };
    }

    // SI-6.3 — the lease. A run that cannot take it is DEFERRED, not dropped.
    const leaseMs = this.deps.leaseMs ?? 60_000;
    const owner = this.deps.owner ?? 'market-ingest';
    const lease = await this.deps.leases.acquire({ runKey, owner, nowMs, leaseMs });

    if (lease === null) {
      return refuse('DEFERRED', 'another owner holds an unexpired lease for this run');
    }

    const adapter = this.adapters.get(`${trigger.providerId}::${trigger.subjectClass}`);

    if (adapter === undefined) {
      await this.deps.leases.release(lease.leaseId);
      return refuse(
        'PROVIDER_DISABLED',
        `no adapter is registered for '${trigger.providerId}'/'${trigger.subjectClass}'`,
      );
    }

    const { runId } = await this.deps.runs.begin({ runKey, trigger, startedAtMs: nowMs });
    const policy = this.deps.retry ?? DEFAULT_RETRY_POLICY;
    const runDeadlineAt = nowMs + (this.deps.runDeadlineMs ?? 120_000);

    let attempts = 0;
    let outcome: RunOutcome = 'TRANSPORT_FAILED';
    let detail: string | null = null;
    let written = 0;

    try {
      for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
        attempts = attempt;

        // SI-4.4 — retries do NOT extend the run's deadline.
        if (this.deps.clock.now() >= runDeadlineAt) {
          outcome = 'TIMED_OUT';
          detail = 'run deadline spent; retries do not extend it';
          break;
        }

        // SI-3.4 — the ceiling is taken HERE, around the adapter call, so a retry counts.
        if (!this.deps.slots.tryAcquire(provider.providerId, provider.maxConcurrent)) {
          outcome = 'DEFERRED';
          detail = `provider concurrency ceiling ${provider.maxConcurrent} is saturated`;
          break;
        }

        const controller = new AbortController();
        const fetchTimer = setTimeout(() => controller.abort(), provider.fetchTimeoutMs);

        try {
          await this.deps.leases.heartbeat(lease.leaseId, this.deps.clock.now(), leaseMs);

          const result = await adapter.acquire(provider, controller.signal);

          /*
            SI-16 — NO_NEW_DATA AND NO_MATERIAL_CHANGE ARE DIFFERENT FACTS.
            A run that observed nothing is not a run that observed no change, and
            collapsing them would make an outage indistinguishable from a quiet month.
          */
          if (result.observations.length === 0) {
            outcome = 'NO_NEW_DATA';
            detail = 'the adapter returned no observations for this window';
            this.deps.circuit.recordSuccess(provider.providerId);
            break;
          }

          const persisted = await this.deps.observations.upsertMany({
            runId,
            providerId: provider.providerId,
            subjectClass: provider.subjectClass,
            snapshotContentAddress: result.snapshotContentAddress ?? null,
            observations: result.observations,
            ingestedAtMs: this.deps.clock.now(),
          });

          written = persisted.written;
          outcome = 'SUCCEEDED';
          detail = null;
          this.deps.circuit.recordSuccess(provider.providerId);
          break;
        } catch (error) {
          if (error instanceof ValidationFailure) {
            // SI-4.2 — permanent. Retrying a schema change just spends the budget.
            outcome = 'VALIDATION_FAILED';
            detail = error.message;
            this.deps.circuit.recordFailure(
              provider.providerId,
              this.deps.clock.now(),
              provider.circuitCooldownMs,
            );
            break;
          }

          if (error instanceof AcquisitionRefusal) {
            // A per-request rights refusal — e.g. the Comext carve-out. Never retried:
            // the same request would be refused for the same reason.
            outcome = 'RIGHTS_REFUSED';
            detail = error.message;
            break;
          }

          const transport = error instanceof TransportFailure;

          if (!transport) {
            outcome = 'TRANSPORT_FAILED';
            detail = `non-transport failure, not retried: ${(error as Error).message}`;
            this.deps.circuit.recordFailure(
              provider.providerId,
              this.deps.clock.now(),
              provider.circuitCooldownMs,
            );
            break;
          }

          const aborted = controller.signal.aborted;
          outcome = aborted ? 'TIMED_OUT' : 'TRANSPORT_FAILED';
          detail = (error as Error).message;

          this.deps.circuit.recordFailure(
            provider.providerId,
            this.deps.clock.now(),
            provider.circuitCooldownMs,
          );

          if (attempt < policy.maxAttempts) {
            const delay = backoffDelayMs(
              attempt,
              policy,
              provider.cadence.jitterFraction,
              (error as TransportFailure).retryAfterMs,
            );

            await this.deps.clock.sleep(delay);
          }
        } finally {
          clearTimeout(fetchTimer);
          // ALWAYS released, on every path. A slot leaked on an error path is a ceiling
          // that silently shrinks to zero over a few bad days.
          this.deps.slots.release(provider.providerId);
        }
      }
    } finally {
      await this.deps.leases.release(lease.leaseId);
    }

    await this.deps.runs.finish({
      runId,
      outcome,
      finishedAtMs: this.deps.clock.now(),
      observationsWritten: written,
      detail,
    });

    return { runKey, runId, outcome, attempts, observationsWritten: written, detail };
  }
}
