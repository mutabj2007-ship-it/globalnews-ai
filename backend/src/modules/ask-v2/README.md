# Ask V2 / Compute / Sand adaptation (CODEX J R1)

This is an additive substrate, not a replacement for the current Ask dock,
specialist dashboards, retrieval or AnalysisService. No frontend call sites
are changed. Routes are under `/ask-v2` (plus the application's existing global
API prefix). All routes require the existing session guard; mutations also
require the existing CSRF guard. Responses are private/no-store.

Defaults: `ASK_V2_ENABLED=false`, `SAND_LEDGER_ENABLED=false`.
`SAND_CHARGING_ENABLED` is a literal false, regardless of environment. The
migration rejects nonzero reservedSand and finalSand at the database boundary.
The 24/120 Sand quotes are design fixtures, not commercial prices. There is no
wallet or balance mutation. Shadow-ledger opt-in is pinned when a quote is made.

## CTO integration interface (execution remains unwired)

Bind `ASK_EXECUTION_PORT` in this module to a CTO-owned adapter only after its
retrieval contract is reviewed. The supplied default returns 503
`ASK_EXECUTION_PORT_NOT_BOUND`. Enabling the API flag alone does not enable AI.

- `prepare({ question, language, intent })` must use only local/read-only
  planning. It must make **zero provider calls**. Supply a real evidence revision,
  full scope identity (authoritative anchor, geography, time window and coverage
  policy), response/model contract, bounded expiry and deterministic work signals.
  No timestamp-bucket approximation of evidence freshness is adopted from the old
  branch. Report/deep detection from EN/PL natural-language requests belongs here;
  the client intent can raise work but must not hide a larger server-planned task.
- `execute(request, plan, operationId)` may consume the current AnalysisService
  through its reviewed interface. It must respect the exact prepared scope and
  return success only after current response/evidence validation. Unsupported
  DEEP_ANALYSIS or RESEARCH_REPORT must be refused, never silently routed through
  ordinary Ask and represented as a deep/report success. CONTEXTUAL must use only
  stored structured intelligence, with zero retrieval/model calls.
- Return `ExecutionResult` with an object serialized in `payloadJson`, matching
  evidence revision and bounded validity. The wrapper stores it as an immutable
  display artifact; no endpoint accepts an output payload to populate this store.
- Neither method receives thread history, previous model output, return path,
  caller-provided evidence, context titles, nor a caller-chosen compute class.
  User turns are durable, but this R1 does not resolve ambiguous follow-ups from
  history. That would require an explicit CTO intent-resolution contract, not
  silently feeding model prose back into evidence.

If this adapter requires an AnalysisService change, stop and hand that interface
to the CTO lane. This lane does not own AnalysisService or provider orchestration.

## API and lifecycle

`POST threads` accepts a client idempotency key, en/pl language and optional
validated local returnPath. `GET threads` lists the latest 50. `GET threads/:id`
returns 100 ordered user turns at a time (`?after=sequence`) with operation refs.
`GET operations/:id` returns the operation and any display result. Historical
expired output is explicitly marked expired; it is not eligible for new reuse.

`POST threads/:id/quote` takes key, question, language and intent. Retrying the
same key returns the original operation; changed content or thread gives 409.
User ownership scopes keys and reuse. A successful quote and its turn/sequence
allocation/optional QUOTE ledger row commit atomically.

For an explicit new operation, call separate POST actions:
`operations/:id/accept`, `/reserve`, `/execute`. Acceptance pins the quote,
reservation is shadow-only, and execution claims the operation durably before
calling the adapter. Settlement is internal, not an HTTP payload upload route.
`/release` cancels outstanding work. Internal `refund()` records a zero-value
REFUND only after completion; no refund/paid UX is introduced.

All state/ledger mutations use serializable transactions with bounded conflict
retries. Unique owner/key, thread/sequence, operation/turn and operation/ledger-
event constraints provide cross-process invariants. A lost worker's RUNNING
claim is never redispatched automatically: `/execute` after its five-minute
lease expires releases it as `EXECUTION_OUTCOME_UNKNOWN`. `/release` can cancel
it earlier. There is no new background scheduler. Late results are fenced out.
Provider calls cannot be rolled back; failed DB settlement remains RUNNING for
explicit release or internal settlement retry, not a second provider call.

Quotes expire after at most five minutes and never outlive their plan. Stored
reuse is checked before classifying and again before execution. Expired/missing
STORED quotes release rather than falling through to new provider spending.
Immutable result IDs are separate from reusable fingerprints, so refreshing a
result never overwrites a prior conversation's artifact. Concurrent **different**
idempotency keys can still compute separately if both miss the store; this R1
promises at-most-once dispatch per operation, not global query single-flight.

## Local validation

The PostgreSQL spec is opt-in via `ASK_V2_TEST_DATABASE_URL`, accepts only
`postgresql://askv2test@127.0.0.1:<port>/ask_v2_test`, and never reads DATABASE_URL.
Use a disposable PostgreSQL database initialized from the baseline schema plus
`20260922140000_ask_compute_sand_r1/migration.sql`. Then run from repository root:

```
npm run build:shared
npm run test --workspace=backend -- --runInBand --testPathPattern=ask-v2
```

Without that dedicated URL, the real-database suite is explicitly skipped; the
pure contract suite still runs. Delivery evidence records the real-database run.
No migration is applied to production. Production HOLD remains.
