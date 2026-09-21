-- Provider-neutral retained Conflict event evidence.
-- No producer is activated by this migration.

CREATE TABLE "ConflictObservation" (
  "id" TEXT NOT NULL,
  "observationKey" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "occurredOn" TIMESTAMP(3) NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "countryIso3" TEXT,
  "placeLabel" TEXT,
  "sourceUrl" TEXT,
  "sourceName" TEXT,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConflictObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConflictObservation_observationKey_key"
  ON "ConflictObservation"("observationKey");

CREATE UNIQUE INDEX "ConflictObservation_providerId_providerEventId_key"
  ON "ConflictObservation"("providerId", "providerEventId");

CREATE INDEX "ConflictObservation_occurredOn_idx"
  ON "ConflictObservation"("occurredOn");

CREATE INDEX "ConflictObservation_countryIso3_occurredOn_idx"
  ON "ConflictObservation"("countryIso3", "occurredOn");

CREATE INDEX "ConflictObservation_providerId_idx"
  ON "ConflictObservation"("providerId");
