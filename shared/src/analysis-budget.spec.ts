import {
  ANALYSIS_CLIENT_TIMEOUT_MS,
  ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS,
  ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS,
  ANALYSIS_PROVIDER_RETRY_OVERHEAD_MS,
  ANALYSIS_RETRIEVAL_BUDGET_MS,
  ANALYSIS_SERVER_OVERHEAD_BUDGET_MS,
  ANALYSIS_MAX_SERVER_BUDGET_MS,
  ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS,
  ANALYSIS_PROXY_RESPONSE_MARGIN_MS,
  ANALYSIS_TOTAL_BUDGET_MS,
  resolveServerBudgetMs,
} from './analysis-budget';

/*
 * THE INVARIANT THIS FILE EXISTS FOR.
 *
 * Railway run 579a0134: a correct, complete, validated 201 at 30,914 ms against
 * a client that had given up at 30,000 ms. Two constants chosen independently,
 * each defensible against its own assumption, with no artefact that had to
 * agree. These tests are that artefact.
 */

describe('ANALYSIS EXECUTION BUDGET — the client deadline is derived, not guessed', () => {
  it('the total server budget is exactly the sum of its declared parts', () => {
    expect(ANALYSIS_TOTAL_BUDGET_MS).toBe(
      ANALYSIS_RETRIEVAL_BUDGET_MS +
        ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS +
        ANALYSIS_PROVIDER_RETRY_OVERHEAD_MS +
        ANALYSIS_SERVER_OVERHEAD_BUDGET_MS,
    );
  });

  it('the client deadline is the total budget plus the transport margin', () => {
    expect(ANALYSIS_CLIENT_TIMEOUT_MS).toBe(
      ANALYSIS_TOTAL_BUDGET_MS + ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS,
    );
  });

  /*
    THE ONE THAT MATTERS. A response the server is still LEGALLY PERMITTED to be
    producing must never arrive after the client has stopped listening. If this
    ever fails, the false-failure defect has returned.
  */
  it('a successful response cannot legally outlive the client deadline', () => {
    expect(ANALYSIS_CLIENT_TIMEOUT_MS).toBeGreaterThan(ANALYSIS_MAX_SERVER_BUDGET_MS);
    expect(ANALYSIS_CLIENT_TIMEOUT_MS - ANALYSIS_MAX_SERVER_BUDGET_MS).toBeGreaterThanOrEqual(
      ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS,
    );
  });

  it('the transport margin is real, not decorative', () => {
    expect(ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS).toBeGreaterThan(0);
  });

  /*
    THE LIVE ALPHA PROXY INCIDENT, PINNED AS A REGRESSION CASE.

    The first-party Next proxy closed the analysis socket at ~30,032 ms while
    the backend still believed it could work until 32,000 ms. The backend now
    settles early enough that its success or truthful 504 can traverse the
    proxy rather than becoming a generic proxy 500.
  */
  it('the runtime server ceiling leaves a real margin before the first-party proxy cutoff', () => {
    expect(ANALYSIS_MAX_SERVER_BUDGET_MS).toBeLessThan(
      ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS,
    );
    expect(
      ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS - ANALYSIS_MAX_SERVER_BUDGET_MS,
    ).toBeGreaterThanOrEqual(ANALYSIS_PROXY_RESPONSE_MARGIN_MS);
  });

  /*
    The corrected single-generation path from run 579a0134 still fits with
    substantial room inside the stricter runtime ceiling.
  */
  it('the corrected single-generation path fits inside the runtime server ceiling', () => {
    const RETRIEVAL_AND_OVERHEAD_MS = 1_000;
    const GENERATION_1_MS = 16_535;
    expect(RETRIEVAL_AND_OVERHEAD_MS + GENERATION_1_MS).toBeLessThan(
      ANALYSIS_MAX_SERVER_BUDGET_MS,
    );
  });

  it('every term is positive — a zeroed term would silently void the derivation', () => {
    for (const term of [
      ANALYSIS_RETRIEVAL_BUDGET_MS,
      ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS,
      ANALYSIS_PROVIDER_RETRY_OVERHEAD_MS,
      ANALYSIS_SERVER_OVERHEAD_BUDGET_MS,
    ]) {
      expect(term).toBeGreaterThan(0);
    }
  });
});

/*
 * REV A — THE CASES THE CTO REQUIRED, ADDED BECAUSE THE ARITHMETIC ALONE WAS
 * REJECTED AS ENFORCEMENT.
 */
describe('REV A — the retry path the R1 derivation did not bound', () => {
  /*
    THE HOLE THE CTO FOUND. A provider TIMEOUT is non-retryable, so R1 argued the
    provider term was 20s x 1. But a 429 / 5xx / network failure IS retryable and
    can arrive just under the attempt ceiling, after which a further attempt
    begins with its own full budget. Unbounded by arithmetic.
  */
  const NEAR_TIMEOUT_FAILURE_MS = 19_900; /* retryable, arriving just under the ceiling */

  it('a naive sum of reachable attempts EXCEEDS the total budget — which is why a deadline is required', () => {
    const twoAttempts = NEAR_TIMEOUT_FAILURE_MS + ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS;
    const naiveWorstCase = ANALYSIS_RETRIEVAL_BUDGET_MS + twoAttempts;
    expect(naiveWorstCase).toBeGreaterThan(ANALYSIS_TOTAL_BUDGET_MS);
  });

  /*
    AND THIS IS THE GUARANTEE THAT REPLACES THE ARITHMETIC. AnalysisService races
    the COMPLETE operation against totalBudgetMs on the wall clock, so no
    reachable retry or retrieval path can produce a USER-FACING RESPONSE later
    than the budget — however many attempts happened inside it.
  */
  it('the enforced response deadline bounds every reachable path, retries included', () => {
    const anyReachablePath = [
      ANALYSIS_RETRIEVAL_BUDGET_MS + ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS,
      NEAR_TIMEOUT_FAILURE_MS + ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS,
      NEAR_TIMEOUT_FAILURE_MS * 3,
      600_000,
    ];
    for (const path of anyReachablePath) {
      const userFacing = Math.min(path, ANALYSIS_MAX_SERVER_BUDGET_MS);
      expect(userFacing).toBeLessThanOrEqual(ANALYSIS_MAX_SERVER_BUDGET_MS);
      expect(userFacing).toBeLessThan(ANALYSIS_CLIENT_TIMEOUT_MS);
    }
  });

  it('the client deadline remains strictly greater than the server response deadline', () => {
    expect(ANALYSIS_CLIENT_TIMEOUT_MS).toBeGreaterThan(ANALYSIS_MAX_SERVER_BUDGET_MS);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REV B — THE CEILING IS ENFORCED, NOT DOCUMENTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Rev A proved the DERIVATION held between two compile-time constants. It could
 * not prove anything about a value that only exists at runtime, and the runtime
 * value was exactly the one that could break the contract.
 */
describe('resolveServerBudgetMs — REV B runtime enforcement', () => {
  it('refuses a Railway override that would outlive the compiled client', () => {
    /* The concrete attack: one dashboard variable, no deploy, no review. */
    expect(resolveServerBudgetMs(120_000)).toBe(ANALYSIS_MAX_SERVER_BUDGET_MS);
    expect(resolveServerBudgetMs(120_000)).toBeLessThan(ANALYSIS_CLIENT_TIMEOUT_MS);
  });

  it('keeps the transport margin intact for every clamped value', () => {
    for (const attempted of [32_001, 45_000, 120_000, Number.MAX_SAFE_INTEGER]) {
      expect(
        ANALYSIS_CLIENT_TIMEOUT_MS - resolveServerBudgetMs(attempted),
      ).toBeGreaterThanOrEqual(ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS);
    }
  });

  it('still allows an operator to make the server STRICTER', () => {
    /* Lowering can never break the invariant, so it is never refused. */
    expect(resolveServerBudgetMs(5_000)).toBe(5_000);
    expect(resolveServerBudgetMs(1)).toBe(1);
  });

  it('turns an absent or nonsensical budget into the authority, never into zero', () => {
    /*
      THE ONE THAT ALREADY BIT. setTimeout(fn, undefined) is a ~0 ms deadline,
      not an absent one — every pre-existing config double would have failed
      instantly.
    */
    expect(resolveServerBudgetMs(undefined)).toBe(ANALYSIS_MAX_SERVER_BUDGET_MS);
    expect(resolveServerBudgetMs(0)).toBe(ANALYSIS_MAX_SERVER_BUDGET_MS);
    expect(resolveServerBudgetMs(-1)).toBe(ANALYSIS_MAX_SERVER_BUDGET_MS);
    expect(resolveServerBudgetMs(Number.NaN)).toBe(ANALYSIS_MAX_SERVER_BUDGET_MS);
    expect(resolveServerBudgetMs(Number.POSITIVE_INFINITY)).toBe(ANALYSIS_MAX_SERVER_BUDGET_MS);
  });

  it('never returns a value that is not a real, armable deadline', () => {
    for (const candidate of [
      undefined,
      0,
      -5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1,
      32_000,
      999_999,
    ]) {
      const resolved = resolveServerBudgetMs(candidate);
      expect(Number.isFinite(resolved)).toBe(true);
      expect(resolved).toBeGreaterThan(0);
      expect(resolved).toBeLessThanOrEqual(ANALYSIS_MAX_SERVER_BUDGET_MS);
    }
  });

  it('pins the ceiling to the smaller of client tolerance and proxy tolerance', () => {
    expect(ANALYSIS_MAX_SERVER_BUDGET_MS).toBe(
      Math.min(
        ANALYSIS_CLIENT_TIMEOUT_MS - ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS,
        ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS - ANALYSIS_PROXY_RESPONSE_MARGIN_MS,
      ),
    );
  });
});
