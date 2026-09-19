-- ROLLBACK for 20260919050000_snapshot_admission_r2.
--
-- SAFER THAN EITHER OF THE TWO ROLLBACKS BEFORE IT, and the reason is worth stating
-- so the three are not treated alike:
--
--   20260919030000 (snapshot store) DESTROYS EVIDENCE and refuses to run while
--   anything is pinned, because those bytes cannot be re-fetched.
--
--   20260919040000 (Market ingest) loses ingest history but no evidence.
--
--   THIS ONE DROPS ONLY THE ADMISSION AND TRANSPORT COLUMNS. Not one payload byte,
--   not one retrieval row, not one pin. What is lost is the VERDICT — which captures
--   were admitted and why the others were refused.
--
-- AND THAT IS STILL A REAL LOSS. After this runs, a refused capture becomes
-- indistinguishable from an admitted one at the database level, and the composite
-- foreign key that made a refused capture UNREFERENCEABLE is gone with it. An
-- observation written afterwards can cite anything.
--
-- So: this is for un-applying a migration that has just been applied, which is the
-- only situation it is safe in. If any retrieval is ADMITTED, the verdicts are
-- production evidence and dropping them is a decision, not a cleanup.

-- Guard: refuse silently losing admission verdicts.
DO $$
DECLARE admitted_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'SnapshotRetrieval' AND column_name = 'admissibility'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM "SnapshotRetrieval" WHERE "admissibility" = ''ADMITTED''' INTO admitted_count;
    IF admitted_count > 0 THEN
      RAISE EXCEPTION
        'Refusing to roll back: % capture(s) are ADMITTED. Dropping these columns discards the admission verdicts and the composite foreign key that makes a REFUSED capture unreferenceable. Take a backup and decide deliberately if this is really intended.', admitted_count
        USING ERRCODE = '23514';
    END IF;
  END IF;
END $$;

-- The trigger and its function. The function lives in the SCHEMA, not with the
-- table, so it would survive a naive column drop.
DROP TRIGGER IF EXISTS "snapshot_admissibility_assign_once" ON "SnapshotRetrieval";
DROP FUNCTION IF EXISTS "snapshot_admissibility_assign_once"();

-- The Market citation. The foreign key first, then the checks, then the columns.
ALTER TABLE "MarketObservation"
  DROP CONSTRAINT IF EXISTS "MarketObservation_snapshotRetrievalId_snapshotAdmissibilit_fkey";
ALTER TABLE "MarketObservation"
  DROP CONSTRAINT IF EXISTS "MarketObservation_snapshot_citation_is_whole";
ALTER TABLE "MarketObservation"
  DROP CONSTRAINT IF EXISTS "MarketObservation_snapshotAdmissibility_check";
DROP INDEX IF EXISTS "MarketObservation_snapshotRetrievalId_idx";
ALTER TABLE "MarketObservation"
  DROP COLUMN IF EXISTS "snapshotAdmissibility",
  DROP COLUMN IF EXISTS "snapshotRetrievalId";

-- The retrieval constraints and indexes.
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT IF EXISTS "SnapshotRetrieval_security_refusal_is_permanent";
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT IF EXISTS "SnapshotRetrieval_refusalClass_check";
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT IF EXISTS "SnapshotRetrieval_refusal_coherent_check";
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT IF EXISTS "SnapshotRetrieval_contentEncoding_check";
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT IF EXISTS "SnapshotRetrieval_admissibility_check";
DROP INDEX IF EXISTS "SnapshotRetrieval_retrievalId_admissibility_key";
DROP INDEX IF EXISTS "SnapshotRetrieval_admissibility_retrievedAt_idx";

ALTER TABLE "SnapshotRetrieval"
  DROP COLUMN IF EXISTS "parsedAt",
  DROP COLUMN IF EXISTS "parserVersion",
  DROP COLUMN IF EXISTS "parserId",
  DROP COLUMN IF EXISTS "refusalClass",
  DROP COLUMN IF EXISTS "refusalKey",
  DROP COLUMN IF EXISTS "wireByteLength",
  DROP COLUMN IF EXISTS "contentEncoding",
  DROP COLUMN IF EXISTS "admissibility";

-- RESTORE THE R1 ADDRESS CONSTRAINT, two arms exactly as it shipped. The quarantine
-- arm must go with the columns it depends on: `refusalKey` no longer exists after the
-- drop above, so leaving the three-arm version would reference a missing column.
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT IF EXISTS "SnapshotRetrieval_address_required_unless_failed";

ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_address_required_unless_failed"
  CHECK ("contentAddress" IS NOT NULL OR "completeness" = 'FAILED');

-- RESTORE THE R1 STORAGE-STATE CONSTRAINT, three arms exactly as it shipped.
-- Leaving the four-arm version in place would be a rollback that is not one: a
-- NOT_RETAINED_BY_QUARANTINE row would remain writable with no column to explain it.
ALTER TABLE "SnapshotPayload"
  DROP CONSTRAINT IF EXISTS "SnapshotPayload_storageState_bytes_agree";

ALTER TABLE "SnapshotPayload"
  ADD CONSTRAINT "SnapshotPayload_storageState_bytes_agree"
  CHECK (
    ("storageState" = 'RETAINED'               AND "bytes" IS NOT NULL) OR
    ("storageState" = 'COLLECTED'              AND "bytes" IS NULL)     OR
    ("storageState" = 'NOT_RETAINED_BY_RIGHTS' AND "bytes" IS NULL)
  );
