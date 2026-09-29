# ASK PUBLIC BETA — OPERATOR RUNBOOK R1

**Authority:** CTO ASK GLOBALNEWSAI — PUBLIC BETA OPERATIONS MINIMUM R1
**Surface:** Admin → AI → Ask Intelligence (`GET /admin/ai/ask-intelligence`, capability `analytics.view`)
**Status:** R1 is READ-ONLY. Nothing on the page performs an action. Every response below is
taken somewhere else, by a named person, and recorded.

---

## 0 · What this page is, and what it is not

It is the minimum instrumentation needed to run the standalone Ask Beta: is it answering,
what capability are readers not getting, what is refusing, and what should be fixed next.

**It is not a raw-prompt reader.** No question, search query, account, address, model prompt,
article body or provider response is stored by this telemetry or carried by this page. The
observation record has no column any of them could occupy, and a privacy spec asserts that
absence over the schema rather than over the code. A restricted Question Review mode is
described in §6; it is **not implemented** and is not part of Beta.

---

## 1 · The alert lines, and what each one is measured against

Every threshold is a ratio of a **measurement** to a **landed number**. Two are Product
judgements with no landed anchor and say so (`PO_PENDING`) rather than pretending otherwise.

| Alert                       | Observed                                                        | Compared against                                        | Warn   | Critical |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- | ------ | -------- |
| `PROVIDER_BREAKER_OPEN`     | providers whose stored breaker state is `OPEN`                  | the breaker's own state                                 | 1      | 1        |
| `BUDGET_SATURATION_HOUR`    | global meter units this hour                                    | `ASK_GLOBAL_UNITS_PER_HOUR`                             | 0.70   | 0.90     |
| `BUDGET_SATURATION_DAY`     | global meter units today                                        | `ASK_GLOBAL_UNITS_PER_DAY`                              | 0.70   | 0.90     |
| `BUDGET_REJECTION_RATE`     | `BUDGET_*` refusals ÷ executions (24h)                          | — (`PO_PENDING`)                                        | 0.02   | 0.10     |
| `MODEL_CALL_VOLUME_HOUR`    | model invocations this hour                                     | `ASK_GLOBAL_UNITS_PER_HOUR ÷ ASK_UNITS_PER_REQUEST_MAX` | 0.70   | 0.90     |
| `PROVIDER_CALL_VOLUME_HOUR` | provider calls this hour                                        | the same derived ceiling                                | 0.70   | 0.90     |
| `TOKEN_VOLUME_HOUR`         | measured units this hour (`prompt + outputWeight × completion`) | `ASK_GLOBAL_UNITS_PER_HOUR`                             | 0.70   | 0.90     |
| `FAILURE_RATE`              | executions with a failure code ÷ executions (24h)               | — (`PO_PENDING`)                                        | 0.10   | 0.25     |
| `LATENCY_P95`               | p95 execution latency (24h)                                     | `ANALYSIS_TOTAL_BUDGET_MS`                              | 0.60 × | 0.90 ×   |

**`UNKNOWN` is not `OK`.** A line is `UNKNOWN` when the figure could not be measured, or when
the sample is smaller than the breaker's own minimum sample count. An operations page that
goes quiet when the database is unreachable is worse than no page, so an unevaluated line is
never green.

---

## 2 · Response procedure

Work top to bottom. Stop at the first line that is not `OK`.

### 2.1 `PROVIDER_BREAKER_OPEN` — CRITICAL

The shared circuit breaker has tripped for a provider: a failure ratio over a minimum sample
count inside the breaker window. Ask is already taking the degraded path immediately and is
paying no provider timeouts.

1. Read **Operations → breakers**: note `state`, `openUntil`, `cooldownS`.
2. Read **Operations → provider errors** (`MODEL_*`). `MODEL_TIMEOUT` is a slow provider;
   `MODEL_FAILURE` is a refusing or erroring one.
3. **Do not reset the breaker.** It half-opens on its own after the cooldown and closes after
   the required trial successes. A manual reset removes the only protection against paying a
   timeout on every request.
4. If the provider is confirmed down and the breaker is flapping, turn Ask compute off:
   set `ASK_PUBLIC_COMPUTE_ENABLED` to disabled through the audited switch row (§3). Readers
   then get a typed refusal instead of a slow failure.
5. Record the incident. Re-enable only when **Operations → breakers** shows `CLOSED` and
   provider errors have stopped for a full breaker window.

### 2.2 `BUDGET_SATURATION_HOUR` / `_DAY` — WARNING then CRITICAL

Ask is consuming its global unit ceiling. At the ceiling the meter refuses new work
(`BUDGET_DEGRADED:global-hour` / `global-day`), which is the control working, not an outage.

1. Confirm against **Health → model invocations** and **token totals** that the volume is
   real traffic rather than one runaway caller.
2. If it is one caller, the per-account and per-IP ceilings already bound them; check
   **Operations → budget rejections** for `account-day` / `ip-day` controls firing.
3. If it is genuine load and Beta should absorb it, the Product Owner raises
   `ASK_GLOBAL_UNITS_PER_HOUR` / `_PER_DAY`. **Raising a ceiling is a Product Owner decision,
   not an operator decision** — the ceiling is what bounds spend.
4. If it is genuine load and Beta should not absorb it, do nothing: the ceiling is doing its
   job and readers receive a typed degraded answer.

### 2.3 `BUDGET_REJECTION_RATE` — WARNING then CRITICAL

Readers are being refused often enough that the Beta is not really open.

1. **Operations → budget rejections** names the exact control on every refusal
   (`global-hour`, `provider-hour`, `account-day`, `new-account-day`, `ip-day`,
   `concurrent-global`, `concurrent-account`, `concurrent-ip`).
2. A `concurrent-*` control dominating means the concurrency bound, not the spend bound, is
   the limit. That is a different knob (`ASK_CONCURRENT_GLOBAL`) and a different decision.
3. Escalate to the Product Owner with the control breakdown. Do not raise a ceiling to make
   an alert green.

### 2.4 `MODEL_CALL_VOLUME_HOUR` / `PROVIDER_CALL_VOLUME_HOUR` / `TOKEN_VOLUME_HOUR`

Approaching the volume the hourly ceiling admits. Treat as an early form of §2.2 — the same
ceiling, read before the meter reaches it. No separate action; it exists so an operator sees
saturation coming rather than discovering it in the rejection rate.

### 2.5 `FAILURE_RATE` — WARNING then CRITICAL

1. **Operations → failure codes** is the whole answer. The families:
   - `MODEL_*` — provider failure or timeout. Go to §2.1.
   - `BUDGET_*` — a control refused it. Go to §2.2/§2.3.
   - `CIRCUIT_*` — breaker open or its store unreadable. `CIRCUIT_UNKNOWN` means the control
     store could not be read and the call was denied — fail-closed, and a database problem
     rather than a provider one.
   - `ASK_R2_DISABLED` / `ASK_PUBLIC_COMPUTE_DISABLED` — a switch is off. Expected during a
     deliberate hold; unexpected otherwise, and §3 says who changed it.
   - `ASK_PLAN_REVISION_MISMATCH` — the route changed between quote and execute. A few are
     normal; a spike means a deploy landed mid-flight.
   - `ASK_REQUEST_CONTEXT_MISSING` — the server-held account/IP context was absent. This is a
     wiring defect, not load. Escalate to engineering.
2. If the rate is `MODEL_*`-dominated and rising, pre-empt the breaker: disable
   `ASK_PUBLIC_COMPUTE_ENABLED` (§3) and record the incident.

### 2.6 `LATENCY_P95` — WARNING then CRITICAL

p95 is approaching the landed analysis time budget, so readers are close to seeing timeouts.

1. Check **Operations → breaker outcomes** for a rising `TIMEOUT` share.
2. Check **Health → zero-model executions**: a healthy Beta answers many questions
   deterministically with no model call at all, and a fall in that share means more work is
   reaching the provider.
3. If p95 crosses the budget, follow §2.1 step 4 — a Beta that times out is worse than a Beta
   that refuses.

---

## 3 · The kill switches

Two keys, both required, both default OFF:

- the deployment variable must be the exact string `true`, **and**
- the audited `OperationalSwitch` row must be enabled, set by a named person.

| Switch                       | Effect when off                                                       |
| ---------------------------- | --------------------------------------------------------------------- |
| `ASK_R2_ENABLED`             | the Ask R2 surface refuses with `ASK_R2_DISABLED`                     |
| `ASK_PUBLIC_COMPUTE_ENABLED` | no model spend on the public Ask path (`ASK_PUBLIC_COMPUTE_DISABLED`) |

`ASK_V2_ENABLED` is separate and unchanged: it makes the Ask V2 routes exist at all. With it
off the routes are `404`, which the page counts as `ASK_SURFACE_ABSENT`.

**Turning a switch off does not need a deploy or a restart** — the row is re-read within
`ASK_FLAG_CACHE_MS`. Nothing turns one back on by itself.

**An unreadable switch is not an off switch.** The page shows `readable: false` separately
from `effective: false`. Unreadable means the control store could not be answered; the Ask
path fails closed, and the operator's problem is the database, not the switch.

---

## 4 · Resilience properties you can rely on

- **Telemetry never blocks an answer.** Every observation write is bounded by its own
  deadline, swallows its own failures, and is taken after the answer is already decided. A
  telemetry outage costs measurements and nothing else.
- **A failed Admin read is `null`, never a zero.** Every panel renders an error with a retry
  rather than a healthy-looking zero. If a panel is empty, it measured emptiness; if it shows
  an error, it measured nothing.
- **Retention is enforced, not declared.** Observations and access counters older than the
  retention horizon are removed by an opportunistic bounded sweep, at most once per hour per
  process, in batches. The existing product analytics declares 90 days and enforces nothing;
  this store does not repeat that.
- **One Ask, at most one observation.** The observation is unique on the operation id, so a
  retry cannot inflate a count.

---

## 5 · Legacy rollback

The route-path vocabulary declares `ASK_R2` and `LEGACY_ANALYSIS`. **R1 instruments the Ask R2
adapter only**, so the page reports the legacy path as _not instrumented_ rather than showing
a zero that would read as "no rollback happened". A spec asserts that no source file emits
`LEGACY_ANALYSIS`, so that statement is a measurement about the codebase and not a promise.

If a legacy fallback is ever wired, `EMITTED_ASK_ROUTE_PATHS` must be corrected in the same
change — the spec fails until it is, and the panel starts reporting real counts.

---

## 6 · Restricted Question Review — NOT IMPLEMENTED, and the conditions for it

Out of scope for Public Beta R1. If it is ever proposed, it must carry all of:

1. explicit legal and privacy approval, recorded, before any code;
2. `SUPER_ADMIN` or a dedicated research role only — never `analytics.view`, which all four
   admin roles hold;
3. PII and secret redaction on the way in, not on the way out;
4. an audit record of every access, naming the administrator and the reason;
5. a retention horizon materially shorter than the aggregate store's;
6. **no bulk export by default**, and no export at all without a second approval;
7. preferably reader-submitted "this answer was poor" examples rather than blanket browsing —
   a reader who offers an example has consented; a reader who asked a question has not.

Until every one of those exists, the honest answer to "can we see what people asked?" is no.

---

## 7 · Escalation

| Symptom                                          | First responder                                                     | Escalate to                                            |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Breaker open, provider errors                    | Operator                                                            | Engineering, then Product Owner if a switch is flipped |
| Budget saturation or rejection rate              | Operator                                                            | Product Owner (ceilings are their decision)            |
| `ASK_REQUEST_CONTEXT_MISSING`, `CIRCUIT_UNKNOWN` | Engineering                                                         | —                                                      |
| A panel showing an error rather than data        | Engineering (database read)                                         | —                                                      |
| `droppedCodeObservations` above zero             | Engineering — a producer is emitting a non-governed geography value | Security review                                        |
