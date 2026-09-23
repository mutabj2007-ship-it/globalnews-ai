CREATE TABLE "EnergyObservation" (
 "id" TEXT PRIMARY KEY, "observationKey" TEXT NOT NULL, "revision" INTEGER NOT NULL CHECK ("revision" > 0),
 "snapshotRetrievalId" TEXT NOT NULL REFERENCES "SnapshotRetrieval"("retrievalId") ON DELETE RESTRICT ON UPDATE CASCADE,
 "payload" JSONB NOT NULL, "evidencePointer" TEXT NOT NULL, "parserVersion" TEXT NOT NULL,
 "admission" TEXT NOT NULL DEFAULT 'REFUSED', "publicDisclosureApproved" BOOLEAN NOT NULL DEFAULT false,
 "reviewedBy" TEXT, "reviewRef" TEXT,
 CONSTRAINT "EnergyObservation_observationKey_revision_key" UNIQUE ("observationKey", "revision")
);
