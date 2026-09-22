-- Additive dormant Watch foundation. No existing table data is changed.
CREATE TYPE "WatchSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
CREATE TYPE "WatchRunStatus" AS ENUM ('RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'NO_EVIDENCE', 'FAILED', 'BUDGET_EXHAUSTED', 'CANCELLED');
CREATE TABLE "WatchSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "subjectId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "status" "WatchSubscriptionStatus" NOT NULL DEFAULT 'PAUSED',
  "intervalSeconds" INTEGER NOT NULL DEFAULT 3600,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastFailureCode" TEXT,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "dailyRunLimit" INTEGER NOT NULL DEFAULT 24,
  "dailyAttemptLimit" INTEGER NOT NULL DEFAULT 48,
  "evidenceLimit" INTEGER NOT NULL DEFAULT 100,
  "budgetDay" TIMESTAMP(3) NOT NULL,
  "runsUsed" INTEGER NOT NULL DEFAULT 0,
  "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "WatchSubscription_userId_subjectId_key" ON "WatchSubscription"("userId", "subjectId");
CREATE INDEX "WatchSubscription_status_nextRunAt_idx" ON "WatchSubscription"("status", "nextRunAt");
CREATE TABLE "WatchRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL REFERENCES "WatchSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "WatchRunStatus" NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "retryAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WatchRun_subscriptionId_scheduledAt_key" ON "WatchRun"("subscriptionId", "scheduledAt");
CREATE TABLE "WatchObservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL REFERENCES "WatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "outcome" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "truncated" BOOLEAN NOT NULL
);
CREATE UNIQUE INDEX "WatchObservation_runId_key" ON "WatchObservation"("runId");
CREATE INDEX "WatchObservation_observedAt_idx" ON "WatchObservation"("observedAt");
-- Database backstops for the fixed R1 resource ceilings. No monetary units.
ALTER TABLE "WatchSubscription" ADD CONSTRAINT "WatchSubscription_limits_check" CHECK (
  "intervalSeconds" BETWEEN 3600 AND 604800 AND "maxAttempts" BETWEEN 1 AND 3
  AND "dailyRunLimit" BETWEEN 1 AND 24 AND "dailyAttemptLimit" BETWEEN 1 AND 48
  AND "evidenceLimit" BETWEEN 1 AND 100 AND "runsUsed" BETWEEN 0 AND "dailyRunLimit"
  AND "attemptsUsed" BETWEEN 0 AND "dailyAttemptLimit"
);
ALTER TABLE "WatchRun" ADD CONSTRAINT "WatchRun_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3);
ALTER TABLE "WatchObservation" ADD CONSTRAINT "WatchObservation_outcome_check"
  CHECK ("outcome" IN ('EVIDENCE_OBSERVED', 'NO_EVIDENCE') AND jsonb_typeof("evidence") = 'array' AND jsonb_array_length("evidence") <= 100);
