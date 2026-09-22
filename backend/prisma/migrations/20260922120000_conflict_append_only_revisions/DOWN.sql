-- Apply hardening DOWN first. Empty-table-only rollback: never erase revision lineage.
BEGIN;
LOCK TABLE "ConflictObservation" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ConflictObservation") THEN
    RAISE EXCEPTION 'Refusing Conflict revision rollback: retained evidence exists; use forward repair'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"ConflictObservation"'::regclass
    AND tgname = 'ConflictObservation_predecessor') THEN
    RAISE EXCEPTION 'Roll back Conflict hardening first' USING ERRCODE = '23514';
  END IF;
END $$;
DROP TRIGGER "ConflictObservation_append_only" ON "ConflictObservation";
DROP FUNCTION "refuse_conflict_observation_mutation"();
ALTER TABLE "ConflictObservation"
  DROP CONSTRAINT "ConflictObservation_snapshotRetrievalId_snapshotAdmissibility_fkey",
  DROP CONSTRAINT "ConflictObservation_capture_admission_check",
  DROP CONSTRAINT "ConflictObservation_revision_ordinal_check";
DROP INDEX "ConflictObservation_observationKey_revisionOrdinal_key";
DROP INDEX "ConflictObservation_authority_upstreamEventId_revisionOrdinal_key";
DROP INDEX "ConflictObservation_observationKey_captureHash_key";
ALTER TABLE "ConflictObservation" DROP COLUMN "revisionOrdinal", DROP COLUMN "captureHash",
  DROP COLUMN "captureRetrievedAt", DROP COLUMN "snapshotRetrievalId", DROP COLUMN "snapshotAdmissibility";
CREATE UNIQUE INDEX "ConflictObservation_observationKey_key" ON "ConflictObservation"("observationKey");
CREATE UNIQUE INDEX "ConflictObservation_authority_upstreamEventId_key" ON "ConflictObservation"("authority", "upstreamEventId");
COMMIT;
