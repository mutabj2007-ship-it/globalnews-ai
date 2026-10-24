/*
  CTO R168/R169 · CAPACITY — a hard GLOBAL cap for the whole Alpha environment: at most 30 outgoing
  GDELT requests in ANY rolling hour, at least 5 s between any two, no burst, no retry, NO fail-open.

  The budget is DURABLE and SHARED: every reservation is decided inside one database transaction that
  first takes a transaction-scoped advisory lock (so replicas are serialised) and reads the calls
  already recorded in the last hour from the database (so a restart, a crash or a new replica starts
  from the true count, never from zero). Time is the DATABASE clock, so replicas cannot disagree about
  the window. A reservation is written before the call is made, so a crash after it still counts.

  After a 429 / 5xx / timeout a refusal row shuts the gate for 15 minutes for every instance.
  If the store cannot be read or written, nothing is called (BUDGET_UNREADABLE).

  This file is pure policy: the store is injected (the database in production, an in-memory twin in
  tests).
*/

/** E1 V5 (ADDENDUM-22): the conservative figure governs — 30 per rolling hour, inside the CTO's 60 ceiling */
export const LEAD_CALLS_PER_HOUR = 30;
export const LEAD_MIN_SPACING_MS = 5_000;
export const LEAD_COOLDOWN_AFTER_REFUSAL_MS = 15 * 60_000;
export const LEAD_WINDOW_MS = 60 * 60_000;

/** The reads and writes one locked reservation needs; all times are the store's own clock (ms). */
export interface LeadBudgetTx {
  now(): Promise<number>;
  callsSince(sinceMs: number): Promise<number>;
  lastCallAt(): Promise<number | null>;
  lastRefusalAt(): Promise<number | null>;
  recordCall(atMs: number): Promise<void>;
  recordRefusal(atMs: number): Promise<void>;
}

/** Runs `fn` while holding the one environment-wide lock; rejects if it cannot. */
export interface LeadBudgetStore {
  withLock<T>(fn: (tx: LeadBudgetTx) => Promise<T>): Promise<T>;
}

export type GateRefusal = 'HOURLY_CAP' | 'SPACING' | 'COOLDOWN' | 'BUDGET_UNREADABLE';

export type GateDecision =
  { readonly granted: true } | { readonly granted: false; readonly reason: GateRefusal };

export class LeadCallGate {
  constructor(private readonly store: LeadBudgetStore) {}

  /** Reserves one call, durably, or says why not. A reserved call is spent even if it then fails. */
  async reserve(): Promise<GateDecision> {
    try {
      return await this.store.withLock(async (tx): Promise<GateDecision> => {
        const t = await tx.now();
        const refusedAt = await tx.lastRefusalAt();
        if (refusedAt !== null && t - refusedAt < LEAD_COOLDOWN_AFTER_REFUSAL_MS) {
          return { granted: false, reason: 'COOLDOWN' };
        }
        if ((await tx.callsSince(t - LEAD_WINDOW_MS)) >= LEAD_CALLS_PER_HOUR) {
          return { granted: false, reason: 'HOURLY_CAP' };
        }
        const last = await tx.lastCallAt();
        if (last !== null && t - last < LEAD_MIN_SPACING_MS) {
          return { granted: false, reason: 'SPACING' };
        }
        await tx.recordCall(t);
        return { granted: true };
      });
    } catch {
      return { granted: false, reason: 'BUDGET_UNREADABLE' };
    }
  }

  /** GDELT refused (429 / 5xx / timeout): every instance stays shut for 15 minutes. Best effort. */
  async refused(): Promise<void> {
    try {
      await this.store.withLock(async (tx) => tx.recordRefusal(await tx.now()));
    } catch {
      /* the call itself was already counted; only the cooldown row is lost */
    }
  }
}

/** A small TTL cache for identical public keyword queries (never the question). */
export class LeadQueryCache<V> {
  private readonly entries = new Map<string, { readonly at: number; readonly value: V }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (hit === undefined) return undefined;
    if (this.now() - hit.at >= this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { at: this.now(), value });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
