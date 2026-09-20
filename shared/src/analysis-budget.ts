/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ANALYSIS EXECUTION BUDGET — ONE AUTHORITY, DERIVED, NOT GUESSED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS FILE EXISTS. Railway run 579a0134 returned a correct, complete,
 * validated 201 after 30,914 ms. The browser had given up at 30,000 ms and told
 * the reader the analysis had failed. It had not: it had succeeded 914 ms too
 * late.
 *
 * The two numbers were never reconciled. `analysisApi.ts` carried a hard-coded
 * 30,000 whose own comment derived it as "the backend's own AI call timeout
 * (ANALYSIS_TIMEOUT_MS, default 20s) ... plus network overhead" — arithmetic
 * that is only valid for ONE provider call. `ANALYSIS_TIMEOUT_MS` is a
 * PER-ATTEMPT budget created inside `attemptOnce`, and nothing anywhere held a
 * budget for the request as a whole. Two independently-chosen constants, each
 * correct against its own assumption, and no artefact that had to agree.
 *
 * This module is that artefact. The client timeout is DERIVED from the server
 * budget here, so the two cannot drift apart again without this file changing,
 * and `analysis-budget.spec.ts` fails if the derivation stops holding.
 *
 * ── EVERY TERM BELOW IS A MEASURED CONSTANT IN THIS REPOSITORY ──────────────
 *
 * Nothing here is a round number chosen because it felt safe.
 */

/**
 * One provider attempt. Mirrors `DEFAULTS.timeoutMs` in
 * `analysis-config.service.ts`, which is the value `attemptOnce` gives its own
 * AbortController.
 *
 * NOT multiplied by `retryAttempts` — and REV A is honest about why that is
 * safe, because the earlier reasoning was not sufficient on its own.
 *
 * A provider TIMEOUT is deliberately non-retryable: `openai-analysis.provider.ts`
 * refuses to retry one, in its own words because "retrying a timeout would
 * silently multiply total latency past ANALYSIS_TIMEOUT_MS rather than
 * respecting it". True, and necessary — but NOT sufficient. A 429, a 5xx or a
 * network failure IS retryable, and one can arrive at 19.9 s, after which a
 * further attempt starts with its own full budget. The sum of reachable paths
 * is therefore NOT bounded by this term alone.
 *
 * What bounds it is enforcement, not arithmetic: `AnalysisService` races the
 * COMPLETE operation against `totalBudgetMs` on the wall clock
 * (`withResponseDeadline`). Retrieval, every attempt, every backoff, validation
 * and assembly are inside that race. This term is therefore the EXPECTED cost of
 * the dominant phase, and the deadline is what makes the total a guarantee.
 */
export const ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS = 20_000;

/**
 * The retry backoff a run can legitimately absorb: `retryBaseDelayMs` 300 with
 * `retryAttempts` 2 gives 300 + 600 ms of sleeping, plus the fast failures
 * themselves. One second covers it with room.
 */
export const ANALYSIS_PROVIDER_RETRY_OVERHEAD_MS = 1_000;

/**
 * Retrieval. Both news providers declare `REQUEST_TIMEOUT_MS = 8000`
 * (`gnews.provider.ts`, `gdelt-doc.provider.ts`).
 *
 * STATED ASSUMPTION, NOT A MEASUREMENT: this term assumes provider calls that
 * are concurrent rather than serialised, so the retrieval phase is bounded by
 * the slowest provider and not by their sum. A retrieval path that fans out
 * SERIALLY — the declared-region branch batches, and each batch is a further
 * 8 s — exceeds this term. That path is out of scope here and is named in the
 * report as unmeasured.
 */
export const ANALYSIS_RETRIEVAL_BUDGET_MS = 8_000;

/**
 * Everything the server does that is neither a network call nor the model:
 * normalisation, relevance scoring, cross-provider dedup, clustering, schema
 * validation, citation validation, brief compliance assessment, response
 * assembly. Measured at well under a second on the observed run; three seconds
 * is deliberate headroom for a cold container and a large evidence set.
 */
export const ANALYSIS_SERVER_OVERHEAD_BUDGET_MS = 3_000;

/**
 * THE TOTAL SYNCHRONOUS SERVER BUDGET. One authority. Every server-side
 * component of a single `POST /analysis/news` is accounted for above.
 *
 *   8,000 retrieval + 20,000 generation + 1,000 retry overhead
 *                   + 3,000 server overhead  =  32,000 ms
 *
 * Note what is NOT in this sum, and why it no longer needs to be: the
 * Executive Brief repair. It used to add a SECOND full `provider.analyzeNews()`
 * call — the same entire article set, every field regenerated, 6,689 tokens on
 * the observed run against the original's 6,367 — to the synchronous path. It
 * has been removed from that path. A brief that fails structural compliance is
 * withheld immediately, with its reason, and the validated analysis is returned
 * at once. The validation itself is unchanged.
 */
export const ANALYSIS_TOTAL_BUDGET_MS =
  ANALYSIS_RETRIEVAL_BUDGET_MS +
  ANALYSIS_PROVIDER_ATTEMPT_BUDGET_MS +
  ANALYSIS_PROVIDER_RETRY_OVERHEAD_MS +
  ANALYSIS_SERVER_OVERHEAD_BUDGET_MS;

/**
 * What the wire costs, over and above anything the server measures: TLS,
 * the Railway edge, a cold container's first byte, and transferring a response
 * that carries the full evidence record.
 *
 * It exists so the client deadline is strictly LATER than the last moment the
 * server may legitimately still be working. A margin of zero would make every
 * worst-case-but-successful response a false failure — which is precisely the
 * defect being corrected.
 */
export const ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS = 8_000;

/**
 * THE CLIENT DEADLINE. Derived, never chosen.
 *
 *   32,000 total server budget + 8,000 transport margin = 40,000 ms
 *
 * THE INVARIANT THIS EXISTS TO GUARANTEE: a response the server is still
 * permitted to be producing can never arrive after the client has stopped
 * listening. `ANALYSIS_CLIENT_TIMEOUT_MS > ANALYSIS_TOTAL_BUDGET_MS`, strictly,
 * with the margin as the gap. Pinned by spec.
 *
 * THE INVARIANT IS NOW LOAD-BEARING, because the server side is enforced rather
 * than merely declared: no successful response can be produced after
 * `ANALYSIS_TOTAL_BUDGET_MS`, so none can arrive after the client deadline.
 *
 * WHAT THIS DOES NOT BOUND, STATED PLAINLY: provider work that has already
 * started. The deadline bounds the RESPONSE. Cancellation is unwired, so an
 * abandoned generation runs to completion and spends its tokens — and then
 * populates the cache, which is why an identical retry is served in about a
 * millisecond. Response time: bounded. Cost: not yet.
 */
export const ANALYSIS_CLIENT_TIMEOUT_MS =
  ANALYSIS_TOTAL_BUDGET_MS + ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REV B — THE AUTHORITY IS ENFORCED AT RUNTIME, NOT ONLY AT COMPILE TIME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT THIS CLOSES. Everything above is compiled into the frontend:
 * `analysisApi.ts` aborts at `ANALYSIS_CLIENT_TIMEOUT_MS`, and that number is
 * fixed the moment the bundle is built. The backend, by contrast, read
 * `ANALYSIS_TOTAL_BUDGET_MS` from the environment with no upper bound at all. A
 * single Railway variable — `ANALYSIS_TOTAL_BUDGET_MS=120000`, set from a
 * dashboard, with no deploy, no build and no review — put the server deadline
 * eighty seconds beyond the point at which the already-shipped client has
 * stopped listening.
 *
 * That recreates the EXACT defect this module exists to correct: a correct,
 * complete, validated response arriving after the browser has given up. Run
 * 579a0134 was that failure by 914 ms. An unclamped override makes it available
 * by the minute.
 *
 * WHY A CLAMP AND NOT A WARNING. A documented risk is not enforcement. The
 * relationship `server deadline + transport margin <= compiled client deadline`
 * is load-bearing — the client's abort is the only thing that stops the browser
 * waiting — and a relationship a runtime value can violate is not an invariant.
 */

/**
 * THE FIRST-PARTY PROXY IS ALSO A DEADLINE.
 *
 * Live Alpha measured Next's same-origin rewrite closing /api/analysis/news at
 * ~30,032 ms with "socket hang up". The backend's previous legal deadline was
 * 32,000 ms, so a correctly classified backend 504 could never reach the
 * browser: the proxy converted it into a generic 500 first.
 *
 * This is an infrastructure contract now because Analysis intentionally routes
 * through the first-party proxy to preserve session-tier and CSRF semantics.
 * Two seconds is reserved for the backend response to traverse that proxy before
 * its measured cutoff. The server therefore must settle no later than 28s.
 */
export const ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS = 30_000;
export const ANALYSIS_PROXY_RESPONSE_MARGIN_MS = 2_000;

/**
 * THE CEILING ON ANY SERVER DEADLINE.
 *
 * Two independent consumers bound it:
 *   1. the compiled browser client, which needs its transport margin; and
 *   2. the first-party Next proxy, which must still be alive to relay the
 *      backend's success or truthful 504.
 *
 * The smaller ceiling wins. Runtime overrides may still LOWER this value, but
 * cannot raise it past either consumer.
 */
export const ANALYSIS_MAX_SERVER_BUDGET_MS = Math.min(
  ANALYSIS_CLIENT_TIMEOUT_MS - ANALYSIS_CLIENT_TRANSPORT_MARGIN_MS,
  ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS - ANALYSIS_PROXY_RESPONSE_MARGIN_MS,
);

/**
 * Resolves a candidate total-budget value into one that is safe to arm a
 * deadline with. Every path returns a real, enforced deadline.
 *
 *   absent / non-finite / <= 0  ->  ANALYSIS_TOTAL_BUDGET_MS
 *   above the ceiling           ->  ANALYSIS_MAX_SERVER_BUDGET_MS
 *   anything else               ->  the candidate, unchanged
 *
 * THE FIRST CASE IS NOT COSMETIC, AND IT IS THE ONE THAT ALREADY BIT.
 * `setTimeout(fn, undefined)` does not mean "no deadline" — it means a deadline
 * of approximately zero. Every `AnalysisConfigService` test double in this
 * repository predates `totalBudgetMs` and supplies none, so an unresolved
 * budget turns each of them into an instant deadline failure. A missing budget
 * must become the AUTHORITATIVE budget; it must never become an accidental
 * zero, in a test or anywhere else.
 *
 * PRODUCTION ENFORCEMENT IS NOT WEAKENED BY THAT FALLBACK. In production the
 * value always arrives from `AnalysisConfigService`, which defaults to
 * `ANALYSIS_TOTAL_BUDGET_MS` and clamps through this same function — so the
 * fallback is unreachable there. Where it IS reachable, it yields a genuine
 * enforced deadline rather than no deadline, which is strictly stronger than
 * the alternative of treating an absent budget as "unbounded".
 */
export function resolveServerBudgetMs(candidateMs: number | undefined): number {
  if (candidateMs === undefined || !Number.isFinite(candidateMs) || candidateMs <= 0) {
    return ANALYSIS_TOTAL_BUDGET_MS;
  }

  return Math.min(candidateMs, ANALYSIS_MAX_SERVER_BUDGET_MS);
}
