import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 LIVE-GATE REPAIR (P0-3) — ONE RETRIEVAL DEADLINE PER ANALYSIS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha 2026-10-06 10:42Z (fe96eb1, TEST C): GNews answered 0 in 351 ms, the publisher feeds
 * answered in 882 ms, then the fallback tier waited 12.1 s for GDELT (malformed), two corridor
 * supplement searches followed one after another, and the analysis's one synchronous budget
 * (28 s) expired while OpenAI was generating: MODEL_FAILURE, "Ask is unavailable".
 *
 * The analysis keeps its ONE overall deadline. Retrieval now has its own deadline INSIDE it —
 * the overall budget minus a reserve for final generation — carried with the request (no
 * parameter threading through every retrieval branch). NewsService reads it:
 *   · a provider is not started when too little of the retrieval budget remains (a budget skip,
 *     recorded as such — never a provider failure, never a retry);
 *   · a started provider is awaited only until the retrieval deadline; past it the tier stops
 *     waiting (the provider's own request, cooldown and no-retry rules are untouched — exactly
 *     the existing "not awaited" peer-tail semantics).
 * Outside an analysis (Home feeds, admin) there is no deadline and nothing changes.
 */
export interface RetrievalBudget {
  /** epoch ms after which no further retrieval may be awaited */
  readonly deadlineAt: number;
  /** the whole retrieval share, ms (for the per-tier cap) */
  readonly totalMs: number;
}

const storage = new AsyncLocalStorage<RetrievalBudget>();

/** Generation needs this much of the overall budget left (OpenAI measured 11.6 s live). */
export const GENERATION_RESERVE_MS = 13_000;
/**
 * ASK R2 A/B/C BLOCKER REPAIR R1 — a reader-requested TABLE is a longer generation. Live Alpha
 * 09d7a5e: the Dar es Salaam table brief took 12.1 s (1,261 completion tokens), and the Rwanda
 * corridor table (6 columns, up to 5 rows) was cancelled at the 28 s budget after 14.5 s of
 * generation, because retrieval had used its full 15 s share. Only table contracts reserve more.
 */
export const TABLE_GENERATION_RESERVE_MS = 17_000;
/** A provider is not started with less than this left: it could not answer usefully. */
export const MIN_PROVIDER_START_MS = 1_500;
/** Retrieval always gets at least this much, even under a very small overall budget. */
export const MIN_RETRIEVAL_BUDGET_MS = 4_000;
/**
 * One provider tier (one fan-out) may hold at most this share of the retrieval budget, so a single
 * slow provider (GDELT: 12–16 s measured) can never consume most of the turn and later independent
 * searches (corridor routes) keep their time.
 */
export const TIER_SHARE = 0.6;

/** The retrieval share of an overall synchronous budget. */
export function retrievalBudgetMs(totalBudgetMs: number, generationReserveMs: number = GENERATION_RESERVE_MS): number {
  return Math.max(MIN_RETRIEVAL_BUDGET_MS, totalBudgetMs - generationReserveMs);
}

export function withRetrievalDeadline<T>(
  deadlineAt: number,
  work: () => Promise<T>,
  totalMs: number = Math.max(0, deadlineAt - Date.now()),
): Promise<T> {
  return storage.run({ deadlineAt, totalMs }, work);
}

/** Remaining retrieval budget in ms, or undefined when no analysis deadline applies. */
export function remainingRetrievalMs(now = Date.now()): number | undefined {
  const budget = storage.getStore();
  return budget === undefined ? undefined : budget.deadlineAt - now;
}

/** How long ONE tier may be awaited now: the remaining budget, capped at TIER_SHARE of the whole. */
export function tierWaitMs(now = Date.now()): number | undefined {
  const budget = storage.getStore();
  if (budget === undefined) return undefined;
  return Math.min(budget.deadlineAt - now, Math.round(budget.totalMs * TIER_SHARE));
}

export const RETRIEVAL_BUDGET_EXHAUSTED = Symbol('retrieval-budget-exhausted');

/**
 * Await `work` (one tier) no longer than tierWaitMs(): the remaining retrieval budget, capped at
 * TIER_SHARE of it. Resolves to the work's value, or to
 * RETRIEVAL_BUDGET_EXHAUSTED when the deadline passes first (the work keeps running unawaited, its
 * eventual rejection handled). Without a deadline it is exactly `work`.
 */
export async function withinRetrievalBudget<T>(
  work: Promise<T>,
): Promise<T | typeof RETRIEVAL_BUDGET_EXHAUSTED> {
  const remaining = tierWaitMs();
  if (remaining === undefined) return work;
  if (remaining <= 0) {
    void work.catch(() => undefined);
    return RETRIEVAL_BUDGET_EXHAUSTED;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<typeof RETRIEVAL_BUDGET_EXHAUSTED>((resolve) => {
    timer = setTimeout(() => resolve(RETRIEVAL_BUDGET_EXHAUSTED), remaining);
  });
  try {
    const winner = await Promise.race([work, expired]);
    if (winner === RETRIEVAL_BUDGET_EXHAUSTED) void work.catch(() => undefined);
    return winner;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
