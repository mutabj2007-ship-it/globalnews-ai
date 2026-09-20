-- ROLLBACK for 20260920140000_snapshot_retrieval_lineage_fields.
--
-- Drops exactly the four columns UP adds, and nothing else. There is nothing further to
-- undo: UP creates no table, no index, no constraint, no trigger and no function, and it
-- writes no row — so this file has no counterpart for any of those and must not acquire
-- one.
--
-- THE DATA LOST BY THIS ROLLBACK IS REAL, AND SAYING SO IS THE POINT. Dropping these
-- columns discards the reference period, the edition language and the extractor identity
-- of every retrieval recorded since UP ran. They are not recoverable by re-deriving them:
-- re-parsing retained bytes would be a NEW parse under a CURRENT parser version, written
-- against a row whose recorded parserVersion describes a different one (A-4). A rollback
-- here is a decision to lose lineage, not a decision to defer it.

ALTER TABLE "SnapshotRetrieval" DROP COLUMN IF EXISTS "extractorVersion";
ALTER TABLE "SnapshotRetrieval" DROP COLUMN IF EXISTS "extractorId";
ALTER TABLE "SnapshotRetrieval" DROP COLUMN IF EXISTS "sourceLanguage";
ALTER TABLE "SnapshotRetrieval" DROP COLUMN IF EXISTS "referencePeriod";
