# M59 — Scale Readiness

## A. Milestone

M59 — Scale Readiness

## B. Decision

**PASS — NO PRODUCTION CODE CHANGE**

## C. Tested repository state

```
branch: main
HEAD: 7589e3e
commit: feat: harden account privacy protections
```

## D. Objective

M59 evaluated whether GlobalNews AI's existing architecture is adequate for
realistic MVP / early-beta load — a modest early-product target, not
enterprise scale — without introducing optimization work that the evidence
did not justify. The milestone was explicitly evidence-first: findings were
required to be grounded in direct source inspection and, where practical,
real local measurement, rather than inferred from architecture alone.

## E. Evidence sources

Every finding in this report is classified into exactly one of:

- **VERIFIED IN CODE** — confirmed by direct inspection of the source at
  HEAD `7589e3e`.
- **VERIFIED BY LOCAL BENCHMARK** — confirmed by an actual local run
  against that same code state.
- **PRODUCTION INFRASTRUCTURE UNKNOWN** — depends on a deployment/hosting
  detail not visible in this repository.
- **REAL-PROVIDER PERFORMANCE UNKNOWN** — depends on live GNews/OpenAI
  behavior, deliberately not exercised during this milestone.

## F. Code-level findings

All VERIFIED IN CODE at HEAD `7589e3e`:

- **Global throttle**: 20 requests / 60 seconds (`ThrottlerModule.forRoot`,
  applied globally via `APP_GUARD`).
- **Analysis throttle**: 5 requests / 60 seconds on `POST /analysis/news`
  (`@Throttle`).
- **PrismaService lifecycle**: `PrismaService extends PrismaClient`, default
  (singleton) provider scope — exactly one `PrismaClient` instance per
  backend process. `$connect()`/`$disconnect()` both called explicitly,
  exactly once, in `onModuleInit`/`onModuleDestroy`. No per-request
  construction found anywhere.
- **Session expiration / lazy cleanup**: expired sessions are deleted only
  when encountered by `SessionService.validateSession` on read — no
  scheduled or global cleanup job exists. Sign-out deletes the current
  session; account deletion cascades sessions via the schema's existing
  `onDelete: Cascade` declarations.
- **Analysis cache characteristics**: in-memory `Map<string, CacheEntry>`,
  keyed by language + normalized query (+ story-anchor segment where
  applicable), TTL-bounded (default 300s). Eviction is lazy — only checked
  when that same key is looked up again — no size bound and no proactive
  sweep.
- **In-flight analysis deduplication**: a separate in-memory Map tracks
  in-progress analysis operations by the same cache key. Cleanup runs via
  `.finally()` on both success and rejection, guarded by an identity check
  that prevents a stale cleanup from deleting a newer entry registered for
  the same key.
- **News provider selection**: exactly one provider is active for reads at
  a time — `GNewsProvider` only if `GNEWS_API_KEY` is a usable
  (non-blank) value, `MockNewsProvider` otherwise. Fails closed in
  `NODE_ENV=production` with an unusable key (`NewsStartupValidator`).
- **Analysis provider selection**: `OpenAiAnalysisProvider` only if
  `OPENAI_API_KEY` is usable, `MockAnalysisProvider` otherwise. This
  selection is boot-time deterministic — evaluated once when the DI
  container is built, never re-evaluated during the process's lifetime.
- **Observability relevant to M59**: every HTTP request is logged with a
  correlated request ID, start time, completion status, and total
  duration (`durationMs`), via the existing M55 request-correlation
  middleware/interceptor.
- **No demonstrated P0 or P1 blocker** was found anywhere in this review.

## G. Benchmark environment

The real-machine benchmark was intentionally run under conditions that
guarantee zero paid external API usage:

- development/local environment
- no real GNews API key active — normal news routes served by
  `MockNewsProvider`
- no real OpenAI API key active — analysis served by the mock/development
  analysis provider
- no paid-provider load testing was performed at any point

## H. Phase 1 benchmark results

### HEALTH — 5 concurrent

| Metric | Value |
|---|---|
| Attempted | 5 |
| HTTP 2xx | 5 |
| HTTP 429 | 0 |
| Other HTTP failures | 0 |
| Transport failures | 0 |
| Elapsed | 6.95 ms |
| Average | 5.15 ms |
| p50 | 5.10 ms |
| p95 | 5.62 ms |
| Maximum | 5.62 ms |
| Requests/sec | 719.64 |

### TOP HEADLINES — MOCK PROVIDER — 5 concurrent

| Metric | Value |
|---|---|
| Attempted | 5 |
| HTTP 2xx | 5 |
| HTTP 429 | 0 |
| Other HTTP failures | 0 |
| Transport failures | 0 |
| Elapsed | 795.07 ms |
| Average | 788.96 ms |
| p50 | 794.35 ms |
| p95 | 794.41 ms |
| Maximum | 794.41 ms |
| Requests/sec | 6.29 |

### NEWS SEARCH — MOCK PROVIDER — 5 concurrent

| Metric | Value |
|---|---|
| Attempted | 5 |
| HTTP 2xx | 5 |
| HTTP 429 | 0 |
| Other HTTP failures | 0 |
| Transport failures | 0 |
| Elapsed | 191.54 ms |
| Average | 148.96 ms |
| p50 | 138.79 ms |
| p95 | 191.15 ms |
| Maximum | 191.15 ms |
| Requests/sec | 26.10 |

## I. Phase 2 benchmark results

### 5 IDENTICAL ANALYSIS REQUESTS

| Metric | Value |
|---|---|
| Attempted | 5 |
| HTTP 2xx | 5 (status 201 for all 5) |
| HTTP 429 | 0 |
| Other HTTP failures | 0 |
| Transport failures | 0 |
| Elapsed | 900.69 ms |
| Average | 882.41 ms |
| p50 | 878.31 ms |
| p95 | 898.32 ms |
| Maximum | 898.32 ms |
| Requests/sec | 5.55 |

**Runtime log evidence**: the backend log produced exactly **four**
occurrences of `DEBUG [AnalysisService] Joining in-flight analysis.` for
this batch of five identical concurrent requests.

This is direct runtime evidence that one of the five requests performed
the underlying analysis operation, and the other four duplicate concurrent
requests joined that same in-flight operation rather than each starting
independent analysis work. No further conclusion is drawn from this log
count beyond that specific fact.

### 5 DISTINCT ANALYSIS REQUESTS

| Metric | Value |
|---|---|
| Attempted | 5 |
| HTTP 2xx | 5 (status 201 for all 5) |
| HTTP 429 | 0 |
| Other HTTP failures | 0 |
| Transport failures | 0 |
| Elapsed | 717.01 ms |
| Average | 563.87 ms |
| p50 | 697.42 ms |
| p95 | 715.56 ms |
| Maximum | 715.56 ms |
| Requests/sec | 6.97 |

## J. Important interpretation

The `/health` Requests/sec figure above (719.64) is **not** a production
capacity claim — it reflects a trivial local endpoint under light local
concurrency, on development hardware, against a locally-running process.

These local/mock results demonstrate stability only at the specific,
modest concurrency levels actually tested (5 concurrent requests per
group). They do **not** prove:

- production hosting capacity
- real GNews latency or performance
- real OpenAI latency or performance
- real provider rate-limit behavior under load
- production PostgreSQL connection-pool capacity
- behavior behind a production reverse proxy
- multi-instance cache/in-flight-deduplication behavior
- horizontal scaling behavior
- the full 10–30 concurrent-user upper bound of the original provisional
  MVP target

## K. P0/P1/P2/P3 summary

- **P0 blockers**: none
- **P1 blockers**: none
- **P2 (known, deferred, not promoted to blockers)**:
  - Expired, inactive sessions may remain in the database until
    encountered (and lazily deleted) or until the owning account is
    deleted — no scheduled cleanup job exists.
  - The analysis cache uses lazy, read-triggered expiry rather than a
    proactive global eviction sweep.
  - Analysis cache state and in-flight-deduplication state are
    process-local; both would fragment across multiple backend instances
    if horizontal scaling is introduced later.

## L. Final decision

**M59 PASS — NO PRODUCTION CODE CHANGE**

The evidence — both direct source inspection and real local benchmark
measurement — showed no demonstrated scale blocker at the defined MVP
readiness tier. Introducing production optimization work without evidence
that it was needed would have been unjustified, and none was introduced.
