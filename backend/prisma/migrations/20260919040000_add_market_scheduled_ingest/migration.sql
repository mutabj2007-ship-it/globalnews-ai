-- MARKET SCHEDULED INGEST — MKT-PLAT-2.
--
-- Contract:     MAIN-MARKET-LINEAGE-SCHEDULED-INGEST-R1 (D-10, SI-6/7/9/10/16)
-- Declarations: G-MARKET-DATA-ACQUISITION-R2
--
-- THREE NEW TABLES. NO EXISTING TABLE IS ALTERED, DROPPED OR RENAMED. Nothing here
-- writes a row, activates a provider, or schedules anything: there is still no
-- @nestjs/schedule, no bull/bullmq and no @Cron anywhere in backend/src.
--
-- NO PERSONAL DATA. No userId, sessionId, email or IP column, and no foreign key
-- leaves the Market ingest family.
--
-- NO MARKET BYTE STORE. A MarketObservation POINTS AT a snapshot content address
-- when its adapter retained one; the bytes live in the official-data snapshot
-- store, which already exists and already has rights, retention and pinning
-- rules. Two tables for one concern would mean two answers to "which bytes is
-- this figure from".
--
-- ROLLBACK: DOWN.sql beside this file — the repository's convention.

-- CreateTable
CREATE TABLE "MarketIngestRun" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "subjectClass" TEXT NOT NULL,
    "cadenceWindow" TEXT NOT NULL,
    "triggerKind" TEXT NOT NULL,
    "authorisedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "observationsWritten" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketIngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIngestLease" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "MarketIngestLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketObservation" (
    "id" TEXT NOT NULL,
    "observationKey" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "subjectClass" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "publisherVintage" TIMESTAMP(3),
    "publisherChangedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL,
    "vintageProvenance" TEXT NOT NULL,
    "releaseStatus" TEXT NOT NULL,
    "snapshotContentAddress" TEXT,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketIngestRun_runKey_key" ON "MarketIngestRun"("runKey");

-- CreateIndex
CREATE INDEX "MarketIngestRun_providerId_subjectClass_startedAt_idx" ON "MarketIngestRun"("providerId", "subjectClass", "startedAt");

-- CreateIndex
CREATE INDEX "MarketIngestRun_outcome_startedAt_idx" ON "MarketIngestRun"("outcome", "startedAt");

-- CreateIndex
CREATE INDEX "MarketIngestRun_startedAt_idx" ON "MarketIngestRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketIngestLease_runKey_key" ON "MarketIngestLease"("runKey");

-- CreateIndex
CREATE INDEX "MarketIngestLease_expiresAt_idx" ON "MarketIngestLease"("expiresAt");

-- CreateIndex
CREATE INDEX "MarketIngestLease_owner_acquiredAt_idx" ON "MarketIngestLease"("owner", "acquiredAt");

-- CreateIndex
CREATE INDEX "MarketObservation_providerId_subjectClass_ingestedAt_idx" ON "MarketObservation"("providerId", "subjectClass", "ingestedAt");

-- CreateIndex
CREATE INDEX "MarketObservation_seriesId_periodId_idx" ON "MarketObservation"("seriesId", "periodId");

-- CreateIndex
CREATE INDEX "MarketObservation_snapshotContentAddress_idx" ON "MarketObservation"("snapshotContentAddress");

-- CreateIndex
CREATE INDEX "MarketObservation_runId_idx" ON "MarketObservation"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketObservation_observationKey_vintageProvenance_publishe_key" ON "MarketObservation"("observationKey", "vintageProvenance", "publisherChangedAt");

-- AddForeignKey
ALTER TABLE "MarketObservation" ADD CONSTRAINT "MarketObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MarketIngestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- THE GUARANTEES PRISMA CANNOT EXPRESS.
-- ============================================================================

-- SI-16.2 · the outcome vocabulary is closed. A tenth value is a contract change,
-- not a string somebody typed.
ALTER TABLE "MarketIngestRun"
  ADD CONSTRAINT "MarketIngestRun_outcome_check"
  CHECK ("outcome" IS NULL OR "outcome" IN (
    'SUCCEEDED', 'NO_NEW_DATA', 'DEFERRED', 'TIMED_OUT', 'TRANSPORT_FAILED',
    'VALIDATION_FAILED', 'RIGHTS_REFUSED', 'PROVIDER_DISABLED', 'CIRCUIT_OPEN'
  ));

-- SI-1.1 · exactly four trigger kinds. SI-1.2 · AND NO USER-REQUEST KIND.
-- A read path that wanted to trigger acquisition would have to alter this
-- constraint, which is a reviewed migration rather than a quiet code change.
ALTER TABLE "MarketIngestRun"
  ADD CONSTRAINT "MarketIngestRun_triggerKind_check"
  CHECK ("triggerKind" IN ('SCHEDULED', 'MANUAL_AUTHORISED', 'BACKFILL', 'RETRY'));

-- A manual run names who authorised it, or it is not authorised.
ALTER TABLE "MarketIngestRun"
  ADD CONSTRAINT "MarketIngestRun_manual_is_attributed"
  CHECK ("triggerKind" <> 'MANUAL_AUTHORISED' OR ("authorisedBy" IS NOT NULL AND length(btrim("authorisedBy")) > 0));

-- SI-9.2 / E1 M-1 · the vintage axis is the accepted three, and a reading always
-- says which of its timestamps its value is carrying.
ALTER TABLE "MarketObservation"
  ADD CONSTRAINT "MarketObservation_vintageProvenance_check"
  CHECK ("vintageProvenance" IN ('PUBLISHER_VINTAGE', 'PUBLISHER_CHANGED_AT', 'INGEST_SNAPSHOT'));

-- AND THE HALF THAT MAKES IT MEAN SOMETHING: a reading may not CLAIM a publisher
-- vintage it does not carry. This is the difference between an axis and a label.
ALTER TABLE "MarketObservation"
  ADD CONSTRAINT "MarketObservation_vintage_claim_is_backed"
  CHECK (
    ("vintageProvenance" = 'PUBLISHER_VINTAGE'   AND "publisherVintage" IS NOT NULL) OR
    ("vintageProvenance" = 'PUBLISHER_CHANGED_AT' AND "publisherChangedAt" IS NOT NULL) OR
    ("vintageProvenance" = 'INGEST_SNAPSHOT')
  );

-- SI-8.2 · the accepted release-status vocabulary, reused unchanged. WITHDRAWN is
-- a state here, which is what stops it being implemented as a delete.
ALTER TABLE "MarketObservation"
  ADD CONSTRAINT "MarketObservation_releaseStatus_check"
  CHECK ("releaseStatus" IN ('SCHEDULED', 'PRELIMINARY', 'REVISED', 'FINAL', 'WITHDRAWN'));

-- A snapshot pointer is a content address or it is absent. A malformed one would
-- silently never join to a payload.
ALTER TABLE "MarketObservation"
  ADD CONSTRAINT "MarketObservation_snapshot_is_content_address"
  CHECK ("snapshotContentAddress" IS NULL OR "snapshotContentAddress" ~ '^[0-9a-f]{64}$');

-- SI-8.1 · A REVISION APPENDS; IT NEVER OVERWRITES. The prior reading is a prior
-- row, not a property of its successor — the accepted Economy immutability rule,
-- carried into Market storage.
CREATE OR REPLACE FUNCTION "market_observation_is_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'A Market observation is immutable: a revision is a NEW row with its own publisherChangedAt, never an edit (observationKey %)', OLD."observationKey"
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "market_observation_append_only"
  BEFORE UPDATE ON "MarketObservation"
  FOR EACH ROW EXECUTE FUNCTION "market_observation_is_append_only"();

-- A run record is the evidence that a fetch was attempted. Deleting one would
-- erase the only trace of an outcome nobody liked.
CREATE OR REPLACE FUNCTION "market_ingest_run_is_not_deletable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'A Market ingest run record is never deleted: it is the evidence that a fetch was attempted and how it ended (runKey %)', OLD."runKey"
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "market_ingest_run_not_deletable"
  BEFORE DELETE ON "MarketIngestRun"
  FOR EACH ROW EXECUTE FUNCTION "market_ingest_run_is_not_deletable"();
