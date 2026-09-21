-- Retained canonical Conflict event evidence.
-- No producer is activated by this migration.

CREATE TABLE "ConflictObservation" (
  "id" TEXT NOT NULL,
  "observationKey" TEXT NOT NULL,
  "authority" TEXT NOT NULL,
  "upstreamEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "actors" JSONB NOT NULL,
  "geography" JSONB NOT NULL,
  "temporal" JSONB NOT NULL,
  "severity" JSONB NOT NULL,
  "sourceReference" JSONB NOT NULL,
  "acquisition" JSONB NOT NULL,
  "revision" JSONB NOT NULL,
  "occurredOn" TIMESTAMP(3) NOT NULL,
  "countryIso3" TEXT,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConflictObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConflictObservation_observationKey_key"
  ON "ConflictObservation"("observationKey");

CREATE UNIQUE INDEX "ConflictObservation_authority_upstreamEventId_key"
  ON "ConflictObservation"("authority", "upstreamEventId");

CREATE INDEX "ConflictObservation_occurredOn_idx"
  ON "ConflictObservation"("occurredOn");

CREATE INDEX "ConflictObservation_countryIso3_occurredOn_idx"
  ON "ConflictObservation"("countryIso3", "occurredOn");

CREATE INDEX "ConflictObservation_authority_idx"
  ON "ConflictObservation"("authority");
