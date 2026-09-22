# Dormant Watch runtime foundation

CTO HOLD: WATCH_RUNTIME_ACTIVE=false. This directory has no Nest module, HTTP controller,
cron registration, boot hook, provider client, delivery adapter or monetary charge path.
The constructor's active override exists for isolated tests; activation requires a later
reviewed integration. Environment configuration cannot enable this foundation.

Follow remains user interest. CountryFollow is neither read nor written by this runtime.
WatchSubscription is an explicit owner-scoped assignment, initially PAUSED. This R1 only
supports MAP/PLACE country subjects, derived using the existing canonical identity helper.
The richer composer, cross-surface subjects, assessments and paid entitlements remain gated.

WatchRun is one immutable scheduled slot per subscription, with status, attempt count and
lease. WatchObservation is one bounded retained-evidence snapshot per completed run. A
snapshot is evidence observed, not a claim that something changed. NO_EVIDENCE is an honest
successful check, not an alert or provider failure. Results and notification delivery are
separate concerns; no notification exists here.

## Persistence and concurrency

The additive migration introduces three tables and two enums. The only existing Prisma
model change is User.watchSubscriptions, with cascading account deletion. No app.module or
shared contract change is needed. Migrate and generate Prisma only in an approved environment;
this delivery does not authorize production migration or runtime activation.

Every claim, completion, failure and status change locks its WatchSubscription row. The run
and budget reservation commit together. Unique (subscriptionId, scheduledAt) prevents a
second run reservation; unique observation.runId prevents duplicate results. Completion,
result insertion and nextRunAt advance commit in one transaction. A transaction rollback
leaves no partial result. An ambiguous commit replay rechecks durable state.

A 60-second lease and monotonically increasing attempt fence stale workers. Expired claims
are retried on the same run, capped at three attempts including crashes. Backoff is 60 and
120 seconds. Failure recording is also fenced. If it cannot reach the database, lease expiry
is the recovery mechanism. Lock/connection errors may end a tick; the next caller retries.
No automatic timer is installed.

PAUSED/CANCELLED invalidate unfinished runs under the same lock. Resume creates a fresh slot
one interval ahead. Cancellation is terminal; repeated create returns the cancelled record.
An already committed result remains valid when pause follows it. No catch-up backlog is
created: terminal completion schedules now + interval. History is retained until account
removal; automatic retention cleanup requires a later policy.

## Resource bounds

Twenty subscriptions per owner, including paused/cancelled records. Owner-row locking makes
the create quota safe under concurrency. Twenty candidate subscriptions per sequential tick;
leased or not-yet-retryable work is excluded so it cannot monopolize the first batch.
Intervals: 1 hour to 7 days. Per-watch UTC-day caps: 24 logical runs and 48 attempts maximum,
with configurable lower values. One run reservation per scheduled slot; each admitted attempt
consumes one attempt unit, even if it fails or its worker crashes. Reservations are not refunded.
These units are internal quotas, never Sand or money. UTC reset is lazy on the next claim.

A quota refusal records BUDGET_EXHAUSTED without reading evidence, then schedules no earlier
than both next UTC midnight and now + interval. A retry also respects the daily attempt cap.
Database CHECK constraints backstop numeric limits. Create validates integer limits and the
shared canonical country authority. ISO2/ISO3 input is trimmed and case-normalized by its existing
lookup functions; persistence and subject identity retain canonical ISO3. The unique owner/subject
key makes aliases idempotent, including existing cancelled subscriptions.

Each execution reads at most evidenceLimit + 1 retained Article rows (maximum 101), filtered
by exact primary ISO2 countryCode resolved from persisted ISO3 through the shared authority,
including after reload. Unsupported persisted codes fail through the bounded failure path before
any Article query. The fetchedAt window is the 24 hours ending at scheduledAt. No
ArticleCountry expansion, remote fetch, GNews/GDELT/RSS orchestration, AI or provider fallback.
The extra row marks truncation. At most 100 evidence references with bounded title, URL and
source strings are copied into the result, preserving publication-time basis. Missing or
expired retained evidence yields NO_EVIDENCE; it does not assert that no real-world events exist.
Retries use the same window, but stored articles may change until a result is committed.

Internal list(userId) returns at most 20 subscriptions and 10 recent runs each; mutations
check owner identity. No public endpoint accepts a userId or invokes this runtime in R1.
A future controller must derive userId from the authenticated principal, never request data.

## Verification

Build shared, generate Prisma, and typecheck backend with tsconfig.build.json. The general
backend tsconfig includes existing files outside rootDir and is not the build entry point.

The Jest integration suite is opt-in via WATCH_TEST_DATABASE_URL, and rejects any value except
postgresql://watch_test@127.0.0.1:55439/watch_runtime_test. Create a disposable PostgreSQL cluster
on that address, then apply all migrations there. Do not point tests at an existing database:
the suite clears User, Article and Watch fixtures. The test role/database must be disposable.

From backend:

    node ../node_modules/jest/bin/jest.js --runInBand --testPathPattern='watch-runtime|follows'

Without the test URL, the PostgreSQL cases are explicitly skipped; HOLD checks still run.
Time comes from an injected clock, not sleep. Tests cover due boundaries, failure/backoff,
crash recovery, concurrent claims, restart/replay, stale workers, pause/cancel/resume,
quotas, UTC reset, no evidence, bounded evidence, atomic rollback, database uniqueness,
batch fairness, ownership and account deletion. Existing Follow tests remain unchanged.

Design archives MAIN-WATCH-SCHEDULED-EXECUTION-1.zip and E1-WATCH-SCHEDULER-FALSIFICATION-1.zip
were not available inside the authorized worktree during implementation. Their contents
were not assumed; reconciliation with those proposals remains a CTO review item.
