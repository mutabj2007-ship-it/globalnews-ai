-- OFFICIAL-DATA SNAPSHOT — R2 ADMISSION DELTA.
--
-- Contract: MAIN-SNAPSHOT-HUMANITARIAN-RECONCILIATION-R2 · snapshot/02-POSTGRES-DELTA
--           (package sha256 eb57f615…3a060, CTO-approved)
-- Against:  ALPHA-OFFICIAL-DATA-SNAPSHOT-POSTGRES-R1 (migration 20260919030000)
--           and ALPHA-MARKET-SCHEDULED-INGEST-PLATFORM-R1 (migration 20260919040000)
--
-- ADDITIVE. Eight columns on "SnapshotRetrieval", two on "MarketObservation", four
-- CHECK constraints, one UNIQUE, one composite FOREIGN KEY, one trigger. NO TABLE IS
-- DROPPED OR RENAMED AND NO COLUMN IS REMOVED.
--
-- NO BACKFILL AND NO RE-ADDRESSING — SNAP-R2-2. Every capture taken under
-- `Content-Encoding: identity` has the same address under R1 and R2, because the
-- decoded bytes ARE the wire bytes under identity. That is the difference between an
-- amendment and a migration, and it is why this file rewrites no row. No gzip capture
-- exists, because no provider is activated.
--
-- ONE EXISTING CONSTRAINT IS REPLACED RATHER THAN ADDED TO, and it is the only
-- non-additive statement here: "SnapshotPayload_storageState_bytes_agree" enumerates
-- the storage dispositions, and R2 adds a fourth. Postgres has no "extend a CHECK", so
-- the constraint is dropped and recreated with the fourth arm. The three existing arms
-- are reproduced unchanged; every row valid before is valid after.
--
-- ROLLBACK: DOWN.sql beside this file.

-- ─────────────────────────────────────────────────────────────────────────
-- 1 · THE GENERATED DELTA (prisma migrate diff)
-- ─────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "SnapshotRetrieval" ADD COLUMN     "admissibility" TEXT NOT NULL DEFAULT 'REFUSED',
ADD COLUMN     "contentEncoding" TEXT NOT NULL DEFAULT 'identity',
ADD COLUMN     "parsedAt" TIMESTAMP(3),
ADD COLUMN     "parserId" TEXT,
ADD COLUMN     "parserVersion" TEXT,
ADD COLUMN     "refusalClass" TEXT,
ADD COLUMN     "refusalKey" TEXT,
ADD COLUMN     "wireByteLength" INTEGER;

-- AlterTable
ALTER TABLE "MarketObservation" ADD COLUMN     "snapshotAdmissibility" TEXT,
ADD COLUMN     "snapshotRetrievalId" TEXT;

-- CreateIndex
CREATE INDEX "SnapshotRetrieval_admissibility_retrievedAt_idx" ON "SnapshotRetrieval"("admissibility", "retrievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotRetrieval_retrievalId_admissibility_key" ON "SnapshotRetrieval"("retrievalId", "admissibility");

-- CreateIndex
CREATE INDEX "MarketObservation_snapshotRetrievalId_idx" ON "MarketObservation"("snapshotRetrievalId");

-- AddForeignKey
ALTER TABLE "MarketObservation" ADD CONSTRAINT "MarketObservation_snapshotRetrievalId_snapshotAdmissibilit_fkey" FOREIGN KEY ("snapshotRetrievalId", "snapshotAdmissibility") REFERENCES "SnapshotRetrieval"("retrievalId", "admissibility") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- 2 · THE GUARANTEES PRISMA CANNOT EXPRESS
--
-- Prose in a comment is a promise; a constraint is a guarantee. This codebase's
-- own sentence, from the migration that shipped the same pattern.
-- ─────────────────────────────────────────────────────────────────────────

-- S-1 · THE VERDICT IS ONE OF TWO VALUES.
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_admissibility_check"
  CHECK ("admissibility" IN ('REFUSED', 'ADMITTED'));

-- SNAP-R2-3 · TRANSPORT EVIDENCE HAS A DECLARED DOMAIN. `identity` and `gzip` are
-- the two the contract admits; anything else is a capture the gate should have
-- refused with ENCODING_NOT_ALLOWED before it reached storage.
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_contentEncoding_check"
  CHECK ("contentEncoding" IN ('identity', 'gzip'));

-- SNAP-R2-8 · THE RECORD IS INTERNALLY CONSISTENT, OR IT IS REFUSED.
--
-- Every field pairing that could silently disagree, checked at the layer that
-- cannot be bypassed. Note what the ADMITTED arm requires: no refusal key, a
-- COMPLETE capture, and a named parser WITH ITS VERSION — because without the
-- version a parser upgrade changes MEANING without changing BYTES, undetectably.
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_refusal_coherent_check"
  CHECK (
    ("admissibility" = 'REFUSED'
      AND "refusalKey" IS NOT NULL
      AND "refusalClass" IS NOT NULL)
    OR
    ("admissibility" = 'ADMITTED'
      AND "refusalKey" IS NULL
      AND "refusalClass" IS NULL
      AND "completeness" = 'COMPLETE'
      AND "parserId" IS NOT NULL
      AND "parserVersion" IS NOT NULL)
  );

-- S-5 · A REFUSAL CLASS IS ONE OF TWO, AND ONLY TRANSIENT MAY RETRY. G measured
-- the failure this prevents: a 404 is a PERMANENT configuration error, and on a
-- retry loop it reports as a transient provider outage.
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_refusalClass_check"
  CHECK ("refusalClass" IS NULL OR "refusalClass" IN ('PERMANENT', 'TRANSIENT'));

-- R2-SEC-B · A SECURITY REFUSAL IS NEVER RETRYABLE, AT THE DATABASE.
--
-- E1's R2 re-review proved this was representable:
--
--     refusalKey = 'SECRET_DETECTED', refusalClass = 'TRANSIENT'
--
-- a capture refused BECAUSE IT LEAKED A CREDENTIAL, marked retryable — which would
-- let a retry loop re-send a request already known to have exposed a secret, on a
-- schedule, against the same endpoint.
--
-- The contract now derives the class rather than trusting the field, and this is the
-- half that holds when the writer is not the store: a maintenance script, a backfill,
-- or a psql session. The five keys below are refusals whose cause is a SECURITY
-- condition rather than an operational one; making one retryable requires a governed
-- remediation that changes the REQUEST, and a remediated request is a new capture.
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_security_refusal_is_permanent"
  CHECK (
    "refusalKey" IS NULL
    OR "refusalKey" NOT IN ('SECRET_DETECTED', 'PROVENANCE_HOST_MISMATCH',
                            'DECOMPRESSION_BOUND_EXCEEDED', 'ARCHIVE_NOT_ALLOWED',
                            'ENCODING_NOT_ALLOWED')
    OR "refusalClass" = 'PERMANENT'
  );

-- SNAP-R2-12 · AND THE R1 CONSTRAINT THAT QUARANTINE CONTRADICTS.
--
-- FOUND BY EXECUTING THIS MIGRATION AGAINST A REAL POSTGRES, WHICH IS THE ONLY WAY
-- IT COULD HAVE BEEN FOUND. R1 shipped:
--
--     CHECK ("contentAddress" IS NOT NULL OR "completeness" = 'FAILED')
--
-- "an address is required unless no bytes arrived" — correct under R1, where those
-- were the only two cases.
--
-- R2 ADDS A THIRD. A quarantined capture is `completeness = 'COMPLETE'` — the body
-- arrived intact; it was refused for CONTAINING A SECRET, which is a property of the
-- content and not of the transport — and it has NO contentAddress, because the bytes
-- were discarded and an address over discarded bytes is a confirmation oracle.
--
-- So under the R1 constraint, SNAP-R2-12 is UNREPRESENTABLE: the quarantine rule and
-- the address rule cannot both hold. The constraint is widened by exactly one arm.
-- Every row valid before remains valid; the only new admission is the one R2 requires.
--
-- Worth stating plainly: a mock would have accepted this migration. The contradiction
-- is between two CHECK constraints, and nothing but Postgres evaluates those.
ALTER TABLE "SnapshotRetrieval"
  DROP CONSTRAINT "SnapshotRetrieval_address_required_unless_failed";

ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_address_required_unless_failed"
  CHECK (
    "contentAddress" IS NOT NULL
    OR "completeness" = 'FAILED'
    OR "refusalKey" = 'SECRET_DETECTED'
  );

-- SNAP-R2-12 · THE FOURTH STORAGE DISPOSITION.
--
-- DROP AND RECREATE, because Postgres cannot extend a CHECK. The three original
-- arms are reproduced character for character; only the fourth is new, and it
-- pairs quarantine with an absent payload for the same reason the other two
-- absences do.
ALTER TABLE "SnapshotPayload"
  DROP CONSTRAINT "SnapshotPayload_storageState_bytes_agree";

ALTER TABLE "SnapshotPayload"
  ADD CONSTRAINT "SnapshotPayload_storageState_bytes_agree"
  CHECK (
    ("storageState" = 'RETAINED'                   AND "bytes" IS NOT NULL) OR
    ("storageState" = 'COLLECTED'                  AND "bytes" IS NULL)     OR
    ("storageState" = 'NOT_RETAINED_BY_RIGHTS'     AND "bytes" IS NULL)     OR
    ("storageState" = 'NOT_RETAINED_BY_QUARANTINE' AND "bytes" IS NULL)
  );

-- S-3 · AN OBSERVATION MAY REFERENCE ONLY AN ADMITTED CAPTURE.
--
-- THIS IS THE HALF THAT MAKES THE COMPOSITE FOREIGN KEY ABOVE MEAN SOMETHING.
-- Because this column can hold only 'ADMITTED', the foreign key can resolve only
-- to a row whose `admissibility` IS 'ADMITTED'. A REFUSED capture is not rejected
-- by a trigger — it is UNREFERENCEABLE. There is no code path to forget.
--
-- Both columns are nullable together: not every Market observation is
-- snapshot-backed, and SI-10.4 makes the snapshot mandatory only for a publisher
-- that does not version its past data. But one that cites a capture cites an
-- admitted one.
ALTER TABLE "MarketObservation"
  ADD CONSTRAINT "MarketObservation_snapshotAdmissibility_check"
  CHECK ("snapshotAdmissibility" IS NULL OR "snapshotAdmissibility" = 'ADMITTED');

-- AND THE TWO HALVES OF THE CITATION TRAVEL TOGETHER. A retrieval id without its
-- admissibility would bypass the composite key silently — the FK is not enforced
-- when any referencing column is NULL (MATCH SIMPLE, the SQL default).
ALTER TABLE "MarketObservation"
  ADD CONSTRAINT "MarketObservation_snapshot_citation_is_whole"
  CHECK (
    ("snapshotRetrievalId" IS NULL     AND "snapshotAdmissibility" IS NULL) OR
    ("snapshotRetrievalId" IS NOT NULL AND "snapshotAdmissibility" IS NOT NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3 · S-2 · ADMISSIBILITY IS ASSIGN-ONCE
--
-- E1 names the precedent this tree already contains — `situation_identity_assign_once`
-- — "because enforcing that only in the repository means it holds until somebody
-- writes a second writer".
--
-- A NOTE ON THE TRIGGER THAT IS ALREADY HERE, because it is worth knowing rather
-- than discovering. R1 shipped `snapshot_retrieval_immutable`, which raises on ANY
-- update to a retrieval row, so a REFUSED -> ADMITTED promotion was already
-- impossible. This trigger is still worth having and is not redundant:
--
--   1. it names the specific violation, and a promotion attempt is a different
--      event from an incidental edit — an operator reading the log should not have
--      to infer which one happened;
--   2. it fires FIRST. Postgres runs BEFORE-row triggers in NAME ORDER, and
--      `snapshot_admissibility_assign_once` sorts before `snapshot_retrieval_immutable`,
--      so the precise message is the one that surfaces;
--   3. it survives a future decision to relax the blanket immutability — which is
--      plausible, since a parse record could reasonably be attached later. The
--      admission verdict must not be relaxed with it.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "snapshot_admissibility_assign_once"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."admissibility" IS DISTINCT FROM NEW."admissibility" THEN
    RAISE EXCEPTION
      'SNAPSHOT_ADMISSIBILITY_IMMUTABLE: % -> % (retrievalId %). An admission verdict is assigned once. A refused capture is never promoted; it is re-captured.',
      OLD."admissibility", NEW."admissibility", OLD."retrievalId"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_admissibility_assign_once"
  BEFORE UPDATE ON "SnapshotRetrieval"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_admissibility_assign_once"();
