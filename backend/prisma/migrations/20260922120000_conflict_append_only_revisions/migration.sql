-- Preserve every existing row; allow future revisions to append under the shared key.
ALTER TABLE "ConflictObservation"
  ADD COLUMN "revisionOrdinal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "captureHash" TEXT,
  ADD COLUMN "captureRetrievedAt" TIMESTAMP(3),
  ADD COLUMN "snapshotRetrievalId" TEXT,
  ADD COLUMN "snapshotAdmissibility" TEXT;

UPDATE "ConflictObservation"
SET "revisionOrdinal" = COALESCE(("revision"->>'revisionOrdinal')::integer, 0);

DROP INDEX "ConflictObservation_observationKey_key";
DROP INDEX "ConflictObservation_authority_upstreamEventId_key";
CREATE UNIQUE INDEX "ConflictObservation_observationKey_revisionOrdinal_key"
  ON "ConflictObservation"("observationKey", "revisionOrdinal");
CREATE UNIQUE INDEX "ConflictObservation_authority_upstreamEventId_revisionOrdinal_key"
  ON "ConflictObservation"("authority", "upstreamEventId", "revisionOrdinal");
CREATE UNIQUE INDEX "ConflictObservation_observationKey_captureHash_key"
  ON "ConflictObservation"("observationKey", "captureHash");

ALTER TABLE "ConflictObservation"
  ADD CONSTRAINT "ConflictObservation_revision_ordinal_check"
    CHECK ("revisionOrdinal" >= 0 AND "revisionOrdinal" = ("revision"->>'revisionOrdinal')::integer),
  ADD CONSTRAINT "ConflictObservation_capture_admission_check"
    CHECK (("snapshotRetrievalId" IS NULL AND "snapshotAdmissibility" IS NULL AND "captureHash" IS NULL AND "captureRetrievedAt" IS NULL)
      OR ("snapshotRetrievalId" IS NOT NULL AND "snapshotAdmissibility" IS NOT NULL
        AND "snapshotAdmissibility" = 'ADMITTED' AND "captureHash" IS NOT NULL
        AND "captureHash" ~ '^[0-9a-f]{64}$' AND "captureRetrievedAt" IS NOT NULL)),
  ADD CONSTRAINT "ConflictObservation_snapshotRetrievalId_snapshotAdmissibility_fkey"
    FOREIGN KEY ("snapshotRetrievalId", "snapshotAdmissibility")
    REFERENCES "SnapshotRetrieval"("retrievalId", "admissibility") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "refuse_conflict_observation_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Conflict observations are append-only; append a revision instead';
END;
$$;
CREATE TRIGGER "ConflictObservation_append_only"
  BEFORE UPDATE OR DELETE ON "ConflictObservation"
  FOR EACH ROW EXECUTE FUNCTION "refuse_conflict_observation_mutation"();
