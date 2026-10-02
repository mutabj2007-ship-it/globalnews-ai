/**
 * ════════════════════════════════════════════════════════════════════════════
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — BETA RETENTION POLICY (CTO ruling §7)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * These are GlobalNewsAI's Beta retention choices, NOT statutory periods. Each category records
 * its purpose and its deletion mechanism; every period is configurable (env, in days) with the
 * ruled default. Deletion removes the underlying rows — never a UI-only hide.
 */
export interface RetentionPolicy {
  /** Account Ask conversations, counted from the thread's last activity (updatedAt). */
  readonly accountConversationDays: number;
  /** Support tickets, counted from the moment they were resolved (status RESOLVED, updatedAt). */
  readonly supportResolvedDays: number;
  /** Detailed usage / compute records (ProductEvent, AnalysisRun, account and provider meters). */
  readonly usageDays: number;
  /** Network-derived guest rate-limit rows: kept this long AFTER their limit window ends. */
  readonly rateLimitGraceDays: number;
  /** Rows removed per category per sweep (bounded work, no long locks). */
  readonly batch: number;
  /** How often a process sweeps. */
  readonly intervalMs: number;
  /** Operator kill switch: RETENTION_SWEEP_ENABLED=false stops all deletion. */
  readonly enabled: boolean;
}

export const RETENTION_CATEGORIES = [
  {
    category: 'ACCOUNT_CONVERSATIONS',
    purpose: 'Let a signed-in reader continue and revisit their Ask conversations.',
    rule: '12 months after the conversation’s last activity; the reader may delete sooner (account deletion). A thread holding a bookmarked (Saved) turn follows the reader’s Saved lifecycle and is kept.',
    mechanism:
      'DataRetentionService deletes the thread’s operations (cascading turns), their stored answers, then the thread.',
  },
  {
    category: 'SUPPORT_MESSAGES',
    purpose: 'Answer and follow up a support case.',
    rule: '24 months after the case is resolved; unresolved cases are kept until resolved. No legal/security hold mechanism exists yet.',
    mechanism: 'DataRetentionService deletes RESOLVED tickets (messages cascade).',
  },
  {
    category: 'USAGE_COMPUTE_RECORDS',
    purpose: 'Operate budgets, provider breakers and service diagnostics.',
    rule: '90 days.',
    mechanism:
      'DataRetentionService deletes ProductEvent, AnalysisRun and non-network ComputeMeter buckets older than 90 days, and settled ComputeReservations after the rate-limit window.',
  },
  {
    category: 'GUEST_RATE_LIMIT_IDENTIFIERS',
    purpose: 'Enforce guest question limits per network without storing the address.',
    rule: 'Keyed, daily-rotating HMAC pseudonym (never the raw IP); rows deleted 7 days after their window ends.',
    mechanism:
      'DataRetentionService deletes ip:/guestiss:ip:/guestexec:ip: meter buckets past the grace period and idle conc:ip: rows; legacy raw-IP rows fall under the same prefixes.',
  },
  {
    category: 'ASK_DIAGNOSTICS',
    purpose: 'Operate and debug Ask (codes only, no question text, no account).',
    rule: '30 days (pre-existing, enforced by AskObservationRetentionService).',
    mechanism: 'AskObservationRetentionService.',
  },
] as const;

const DAY_MS = 86_400_000;

function days(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

export function resolveRetentionPolicy(env: NodeJS.ProcessEnv = process.env): RetentionPolicy {
  return {
    accountConversationDays: days(env, 'RETENTION_ACCOUNT_CONVERSATION_DAYS', 365),
    supportResolvedDays: days(env, 'RETENTION_SUPPORT_RESOLVED_DAYS', 730),
    usageDays: days(env, 'RETENTION_USAGE_DAYS', 90),
    rateLimitGraceDays: days(env, 'RETENTION_RATE_LIMIT_GRACE_DAYS', 7),
    batch: days(env, 'RETENTION_SWEEP_BATCH', 500),
    intervalMs: days(env, 'RETENTION_SWEEP_INTERVAL_HOURS', 6) * 3_600_000,
    enabled: env.RETENTION_SWEEP_ENABLED !== 'false',
  };
}

export const ago = (now: Date, n: number): Date => new Date(now.getTime() - n * DAY_MS);

/** Meter scopes derived from a client network (pseudonymous, or legacy raw-IP rows). */
export const NETWORK_SCOPE_PREFIXES = ['ip:', 'guestiss:ip:', 'guestexec:ip:'] as const;
export const NETWORK_CONCURRENCY_PREFIX = 'conc:ip:';
/** The longest network limit window is one UTC day. */
export const NETWORK_WINDOW_DAYS = 1;
