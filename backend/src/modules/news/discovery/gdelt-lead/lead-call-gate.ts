/*
  CTO R168 · CAPACITY — a hard GLOBAL cap for the whole Alpha environment: at most 60 outgoing GDELT
  requests per rolling hour, at least 5 s between any two, no burst, no retry, and NO fail-open.

  Across replicas: only the ONE instance holding a Postgres session-level advisory lock may call
  GDELT at all ("single-instance bounded gate"). The lock lives on a dedicated connection; it is
  released when that instance stops, and another instance may take it then. No table, no migration.
  If the lock cannot be taken, or the database cannot be reached, this instance calls nothing.

  After a 429 or a 5xx the gate stays shut for 15 minutes; a failed call still counts against the
  hour, and the hourly count restarts empty only for a new holder session (see
  LEAD_CALLS_PER_HOUR). Everything is injected so the rules are testable without a clock or a database.
*/

/** CTO R168: the environment-wide ceiling */
export const LEAD_CALLS_PER_HOUR_GLOBAL = 60;
/*
  One holder cannot see a previous holder's count (no shared table, by design: no migration). When the
  lock passes on (a deploy, a crash), two holder sessions can fall inside one rolling hour, so each
  session may use only HALF the ceiling: any hour with at most one hand-over stays within 60.
  Residual, disclosed to E1/CTO: three or more backend restarts inside one hour could exceed it.
*/
export const LEAD_CALLS_PER_HOUR = LEAD_CALLS_PER_HOUR_GLOBAL / 2;
export const LEAD_MIN_SPACING_MS = 5_000;
export const LEAD_COOLDOWN_AFTER_REFUSAL_MS = 15 * 60_000;
const HOUR_MS = 60 * 60_000;

/** A held lock reports whether its connection (and so the lock) is still alive. */
export interface LockHandle {
  alive(): boolean;
}

/** Tries once to become the single GDELT caller. Resolves null (never throws) when unsure. */
export type InstanceLock = () => Promise<LockHandle | null>;

export type GateRefusal = 'NOT_THE_GATE_INSTANCE' | 'HOURLY_CAP' | 'SPACING' | 'COOLDOWN';

export class LeadCallGate {
  private readonly calls: number[] = [];
  private cooldownUntil = 0;
  private held: LockHandle | null = null;
  private lockAttemptAt = -Infinity;

  constructor(
    private readonly lock: InstanceLock,
    private readonly now: () => number = Date.now,
  ) {}

  /** Reserves one call slot, or says why not. A reserved slot is spent even if the call fails. */
  async reserve(): Promise<
    { readonly granted: true } | { readonly granted: false; readonly reason: GateRefusal }
  > {
    const t = this.now();
    if (this.held !== null && !this.held.alive()) {
      /* a lost lock is a new session when re-taken: its window starts full, never empty */
      this.held = null;
      this.calls.length = 0;
      for (let i = 0; i < LEAD_CALLS_PER_HOUR; i++) this.calls.push(t);
    }
    if (this.held === null) {
      /* re-try taking the lock at most once a minute: a waiting instance never hammers the DB */
      if (t - this.lockAttemptAt < 60_000)
        return { granted: false, reason: 'NOT_THE_GATE_INSTANCE' };
      this.lockAttemptAt = t;
      this.held = await this.lock().catch(() => null);
      if (this.held === null) return { granted: false, reason: 'NOT_THE_GATE_INSTANCE' };
    }
    if (t < this.cooldownUntil) return { granted: false, reason: 'COOLDOWN' };
    while (this.calls.length > 0 && t - this.calls[0] >= HOUR_MS) this.calls.shift();
    if (this.calls.length >= LEAD_CALLS_PER_HOUR) return { granted: false, reason: 'HOURLY_CAP' };
    const last = this.calls[this.calls.length - 1];
    if (last !== undefined && t - last < LEAD_MIN_SPACING_MS)
      return { granted: false, reason: 'SPACING' };
    this.calls.push(t);
    return { granted: true };
  }

  /** A refusal from GDELT (429 / 5xx / timeout) shuts the gate; nothing is retried. */
  refused(): void {
    this.cooldownUntil = this.now() + LEAD_COOLDOWN_AFTER_REFUSAL_MS;
  }

  /** For tests and the status probe only. */
  usedThisHour(): number {
    const t = this.now();
    return this.calls.filter((c) => t - c < HOUR_MS).length;
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
