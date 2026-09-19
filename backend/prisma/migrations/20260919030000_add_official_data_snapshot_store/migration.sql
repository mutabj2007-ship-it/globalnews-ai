-- OFFICIAL-DATA SNAPSHOT RETENTION — P-2, THE FOUR PERSISTENCE MODELS.
--
-- Contract:  shared/src/official-data/snapshot.ts (SR-1 … SR-22), promoted from
--            MAIN-OFFICIAL-DATA-SNAPSHOT-RETENTION-R1.
-- Substrate: Postgres `Bytes` (BYTEA), by Product Owner decision P-1.
--
-- FOUR NEW TABLES. NO EXISTING TABLE IS ALTERED, DROPPED OR RENAMED, AND NO
-- EXISTING COLUMN, INDEX, CONSTRAINT OR TRIGGER IS TOUCHED. Nothing here writes
-- a row: every row is written by a retrieval, and no provider is activated by
-- this migration.
--
-- NO PERSONAL DATA. No table below carries a userId, sessionId, email or IP
-- column, and no foreign key leaves the Snapshot family. DELETE /users/me
-- therefore remains the single-operation cascade it already is.
--
-- NO BACKFILL, AND NOTHING TO BACKFILL FROM. No lane has ever held official
-- provider bytes in this product.
--
-- ROLLBACK: see DOWN.sql beside this file — the repository's convention, set by
-- 20260821090500_add_admin_role, 20260822053000_add_support_tickets and
-- 20260901050000_add_situation_memory. It drops the four tables in reverse
-- dependency order AND the schema-level plpgsql functions, which do NOT go with
-- their tables and would otherwise survive a rollback (the E1 D-1 finding on the
-- Situation migration, applied here from the start).
--
-- WHY THE TABLE SPLIT IS LOAD-BEARING, RESTATED IN SQL TERMS. SR-4 requires that
-- fetching an unchanged dataset twice costs ONE ROW AND ZERO BYTES. That is only
-- true if the bytes live in a table keyed by their own hash, which is why
-- "SnapshotPayload"."contentAddress" is the primary key rather than a surrogate
-- id with a unique index beside it: the second fetch collides on the key and
-- writes nothing.

-- CreateTable
CREATE TABLE "SnapshotPayload" (
    "contentAddress" TEXT NOT NULL,
    "bytes" BYTEA,
    "byteLength" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "storageState" TEXT NOT NULL DEFAULT 'RETAINED',
    "firstRetainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotPayload_pkey" PRIMARY KEY ("contentAddress")
);

-- CreateTable
CREATE TABLE "SnapshotRetrieval" (
    "retrievalId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "contentAddress" TEXT,
    "completeness" TEXT NOT NULL,
    "rightsGrade" TEXT NOT NULL,
    "rightsInstrumentRef" TEXT NOT NULL,
    "payloadRetentionPermitted" BOOLEAN NOT NULL,
    "editionAnnotations" JSONB NOT NULL,
    "publisherReleasedAt" TIMESTAMP(3),
    "publisherChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotRetrieval_pkey" PRIMARY KEY ("retrievalId")
);

-- CreateTable
CREATE TABLE "SnapshotPin" (
    "id" TEXT NOT NULL,
    "contentAddress" TEXT NOT NULL,
    "citedBy" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "SnapshotPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotTombstone" (
    "contentAddress" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "policyId" TEXT NOT NULL,

    CONSTRAINT "SnapshotTombstone_pkey" PRIMARY KEY ("contentAddress")
);

-- CreateIndex
CREATE INDEX "SnapshotPayload_storageState_firstRetainedAt_idx" ON "SnapshotPayload"("storageState", "firstRetainedAt");

-- CreateIndex
CREATE INDEX "SnapshotRetrieval_contentAddress_retrievedAt_idx" ON "SnapshotRetrieval"("contentAddress", "retrievedAt");

-- CreateIndex
CREATE INDEX "SnapshotRetrieval_providerId_endpointId_retrievedAt_idx" ON "SnapshotRetrieval"("providerId", "endpointId", "retrievedAt");

-- CreateIndex
CREATE INDEX "SnapshotRetrieval_retrievedAt_idx" ON "SnapshotRetrieval"("retrievedAt");

-- CreateIndex
CREATE INDEX "SnapshotPin_contentAddress_releasedAt_idx" ON "SnapshotPin"("contentAddress", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotPin_contentAddress_citedBy_key" ON "SnapshotPin"("contentAddress", "citedBy");

-- CreateIndex
CREATE INDEX "SnapshotTombstone_collectedAt_idx" ON "SnapshotTombstone"("collectedAt");

-- AddForeignKey  (the ONLY three foreign keys, all internal to this family)
ALTER TABLE "SnapshotRetrieval" ADD CONSTRAINT "SnapshotRetrieval_contentAddress_fkey" FOREIGN KEY ("contentAddress") REFERENCES "SnapshotPayload"("contentAddress") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotPin" ADD CONSTRAINT "SnapshotPin_contentAddress_fkey" FOREIGN KEY ("contentAddress") REFERENCES "SnapshotPayload"("contentAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotTombstone" ADD CONSTRAINT "SnapshotTombstone_contentAddress_fkey" FOREIGN KEY ("contentAddress") REFERENCES "SnapshotPayload"("contentAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- THE GUARANTEES PRISMA CANNOT EXPRESS, ENFORCED BY THE DATABASE ITSELF.
--
-- Every one of these is a clause of the accepted contract. A clause enforced
-- only in the repository holds until somebody writes a second writer; a clause
-- enforced here holds against psql, against a migration script and against a
-- future service nobody has written yet. This store's whole purpose is to be
-- believed later, so "the application always does the right thing" is not a
-- strong enough guarantee for it.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. THE ADDRESS IS A SHA-256, AND THE DATABASE KNOWS WHAT THAT LOOKS LIKE.
--    SR-1. `snapshotContentAddress()` refuses a bad address in TypeScript;
--    this refuses one that arrives any other way.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "SnapshotPayload"
  ADD CONSTRAINT "SnapshotPayload_contentAddress_is_sha256"
  CHECK ("contentAddress" ~ '^[0-9a-f]{64}$');

ALTER TABLE "SnapshotPayload"
  ADD CONSTRAINT "SnapshotPayload_byteLength_nonneg" CHECK ("byteLength" >= 0);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. THE THREE STORAGE DISPOSITIONS, AND THE BYTES THAT MUST MATCH THEM.
--
--    This is the constraint that makes "collected but the bytes are still
--    there" and "retained but the bytes are gone" UNREPRESENTABLE rather than
--    merely unlikely. A reader who finds storageState = 'COLLECTED' knows the
--    bytes are absent without looking, and that is what a tombstone is for.
--
--    PINNED is deliberately NOT a storage disposition — it is derived from the
--    pin table, because a denormalised flag can drift from the pins that
--    justify it, and a payload wrongly believed unpinned is precisely the byte
--    that gets collected.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "SnapshotPayload"
  ADD CONSTRAINT "SnapshotPayload_storageState_bytes_agree"
  CHECK (
    ("storageState" = 'RETAINED'               AND "bytes" IS NOT NULL) OR
    ("storageState" = 'COLLECTED'              AND "bytes" IS NULL)     OR
    ("storageState" = 'NOT_RETAINED_BY_RIGHTS' AND "bytes" IS NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. COMPLETENESS IS THE CONTRACT'S THREE VALUES, AND A FAILED RETRIEVAL IS
--    THE ONLY ONE THAT MAY LACK AN ADDRESS. SR-16.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_completeness_check"
  CHECK ("completeness" IN ('COMPLETE', 'TRUNCATED', 'FAILED'));

ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_address_required_unless_failed"
  CHECK ("contentAddress" IS NOT NULL OR "completeness" = 'FAILED');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. A REQUEST PATH IS NOT A URL. SR-22's second half, at the column.
--
--    A URL here would smuggle parameters past the credential check, which only
--    ever reads `parameters`. The store cannot be pointed at the open web
--    because it cannot be TOLD about the open web, and this is where that stops
--    being a convention.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "SnapshotRetrieval"
  ADD CONSTRAINT "SnapshotRetrieval_requestPath_is_not_a_url"
  CHECK ("requestPath" NOT LIKE '%://%' AND "requestPath" NOT LIKE '%?%');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. THE PAYLOAD IS IMMUTABLE, AND COLLECTION IS THE ONE PERMITTED MUTATION.
--
--    SR-5 and SR-7: no overwrite exists in this contract at any layer. The
--    single legal UPDATE is bytes NOT NULL -> NULL under collection, together
--    with the storageState that must accompany it. Everything else about a
--    payload — its address, its length, its media type, when it was first
--    seen — is what it was when it was written.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "snapshot_payload_is_append_only"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."contentAddress" IS DISTINCT FROM OLD."contentAddress"
     OR NEW."byteLength"      IS DISTINCT FROM OLD."byteLength"
     OR NEW."mediaType"       IS DISTINCT FROM OLD."mediaType"
     OR NEW."firstRetainedAt" IS DISTINCT FROM OLD."firstRetainedAt"
  THEN
    RAISE EXCEPTION
      'Snapshot payload identity is immutable: contentAddress, byteLength, mediaType and firstRetainedAt cannot change after creation (address %)', OLD."contentAddress"
      USING ERRCODE = '23514';
  END IF;

  IF NEW."bytes" IS DISTINCT FROM OLD."bytes" AND NEW."bytes" IS NOT NULL THEN
    RAISE EXCEPTION
      'Snapshot payload bytes are immutable: the only permitted change is removal under a collection policy (address %)', OLD."contentAddress"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_payload_append_only"
  BEFORE UPDATE ON "SnapshotPayload"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_payload_is_append_only"();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. PINNED EVIDENCE CANNOT BE COLLECTED. THE RULE THIS STORE EXISTS FOR.
--
--    `assertCollectable()` refuses it in TypeScript. This refuses it when the
--    caller is a maintenance script, a migration, or a psql session at 3am
--    during an incident — which is exactly when a store of evidence is most
--    likely to be asked to give up space and least likely to be reviewed.
--
--    "Pinned" is any pin that has not been released. Releasing a pin makes a
--    payload ELIGIBLE after the grace window, never collected on the spot.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "snapshot_payload_pinned_is_not_collectable"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."storageState" = 'COLLECTED' AND OLD."storageState" <> 'COLLECTED' THEN
    IF EXISTS (
      SELECT 1 FROM "SnapshotPin"
       WHERE "SnapshotPin"."contentAddress" = OLD."contentAddress"
         AND "SnapshotPin"."releasedAt" IS NULL
    ) THEN
      RAISE EXCEPTION
        'Snapshot % is evidence behind a published figure and cannot be collected under any policy, at any age', OLD."contentAddress"
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_payload_pinned_not_collectable"
  BEFORE UPDATE ON "SnapshotPayload"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_payload_pinned_is_not_collectable"();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. THE RECORD SURVIVES EVERYTHING. Retention policy section 4, at the table.
--
--    "Collection removes bytes, never the record", "delete a retrieval row" and
--    "delete a tombstone" are three separate prohibitions in the accepted
--    policy. They are one trigger function here because they are one idea:
--    subtraction in this family is confined to the bytes column.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "snapshot_row_is_not_deletable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Snapshot records are never deleted: only payload BYTES are collectable, and collection leaves a tombstone (table %)', TG_TABLE_NAME
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_payload_not_deletable"
  BEFORE DELETE ON "SnapshotPayload"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_row_is_not_deletable"();

CREATE TRIGGER "snapshot_retrieval_not_deletable"
  BEFORE DELETE ON "SnapshotRetrieval"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_row_is_not_deletable"();

CREATE TRIGGER "snapshot_tombstone_not_deletable"
  BEFORE DELETE ON "SnapshotTombstone"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_row_is_not_deletable"();

CREATE TRIGGER "snapshot_pin_not_deletable"
  BEFORE DELETE ON "SnapshotPin"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_row_is_not_deletable"();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. A RETRIEVAL ROW IS WHAT HAPPENED. IT DOES NOT GET EDITED.
--
--    SR-7's append-only rule reaches the retrieval too. A fetch that is later
--    understood differently produces a NEW row with a new retrievalId; it does
--    not rewrite the one that recorded what was actually asked and returned.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "snapshot_retrieval_is_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'A snapshot retrieval records one fetch and is immutable: record a new retrieval instead (retrievalId %)', OLD."retrievalId"
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_retrieval_immutable"
  BEFORE UPDATE ON "SnapshotRetrieval"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_retrieval_is_immutable"();

-- ─────────────────────────────────────────────────────────────────────────
-- 9. A TOMBSTONE IS TERMINAL, AND A PIN MAY ONLY BE RELEASED.
--
--    Editing a tombstone would restore the very ambiguity it removes. Editing
--    a pin's citation would break the property that makes pinning safe: a pin
--    is released because the citation it names is no longer published, and a
--    citation that can be rewritten cannot be checked.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "snapshot_tombstone_is_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'A snapshot tombstone is terminal and cannot be edited (address %)', OLD."contentAddress"
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_tombstone_immutable"
  BEFORE UPDATE ON "SnapshotTombstone"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_tombstone_is_immutable"();

CREATE OR REPLACE FUNCTION "snapshot_pin_release_only"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."contentAddress" IS DISTINCT FROM OLD."contentAddress"
     OR NEW."citedBy"  IS DISTINCT FROM OLD."citedBy"
     OR NEW."pinnedAt" IS DISTINCT FROM OLD."pinnedAt"
     OR NEW."id"       IS DISTINCT FROM OLD."id"
  THEN
    RAISE EXCEPTION
      'A snapshot pin is assign-once except for its release: only releasedAt may change (pin %)', OLD."id"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_pin_release_only_trigger"
  BEFORE UPDATE ON "SnapshotPin"
  FOR EACH ROW EXECUTE FUNCTION "snapshot_pin_release_only"();
