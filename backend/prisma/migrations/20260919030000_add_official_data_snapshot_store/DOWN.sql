-- ROLLBACK for 20260919030000_add_official_data_snapshot_store.
--
-- Drops the four tables in REVERSE DEPENDENCY ORDER, and — separately — the six
-- schema-level plpgsql functions.
--
-- THE FUNCTIONS ARE THE PART THAT IS EASY TO FORGET. A plpgsql function lives in
-- the SCHEMA, not in the table its trigger fires on, so `DROP TABLE` removes the
-- trigger and leaves the function behind. Re-running the UP migration would then
-- hit an existing function; worse, a later migration reusing a name would
-- silently inherit this body. The Situation migration was corrected for exactly
-- this under E1 item D-1; this one is written that way from the start.
--
-- OPERATOR NOTE, BECAUSE IT IS A REAL HAZARD. This rollback DESTROYS RETAINED
-- EVIDENCE. Every pinned payload it drops is the bytes behind a figure the
-- product has published, and by the finding that motivates this whole capability
-- — publishers serve different editions of the same dataset and do not version
-- past data — those bytes CANNOT BE RE-FETCHED. They are not recoverable from
-- the publisher, only from a database backup.
--
-- So this script is for un-applying a migration that has just been applied to a
-- database holding nothing, which is the only situation it is safe in. If any
-- SnapshotPin row exists, stop and take a backup first.

-- Guard: refuse to run if published evidence would be destroyed.
DO $$
DECLARE pinned_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SnapshotPin') THEN
    EXECUTE 'SELECT COUNT(*) FROM "SnapshotPin" WHERE "releasedAt" IS NULL' INTO pinned_count;
    IF pinned_count > 0 THEN
      RAISE EXCEPTION
        'Refusing to roll back: % payload(s) are pinned as evidence behind published figures and cannot be re-fetched from the publisher. Take a backup and release the pins deliberately if this is really intended.', pinned_count
        USING ERRCODE = '23514';
    END IF;
  END IF;
END $$;

-- Triggers go with their tables, but drop them explicitly so the intent is
-- readable and so a partial rollback leaves nothing half-armed.
DROP TRIGGER IF EXISTS "snapshot_pin_release_only_trigger" ON "SnapshotPin";
DROP TRIGGER IF EXISTS "snapshot_tombstone_immutable" ON "SnapshotTombstone";
DROP TRIGGER IF EXISTS "snapshot_retrieval_immutable" ON "SnapshotRetrieval";
DROP TRIGGER IF EXISTS "snapshot_pin_not_deletable" ON "SnapshotPin";
DROP TRIGGER IF EXISTS "snapshot_tombstone_not_deletable" ON "SnapshotTombstone";
DROP TRIGGER IF EXISTS "snapshot_retrieval_not_deletable" ON "SnapshotRetrieval";
DROP TRIGGER IF EXISTS "snapshot_payload_not_deletable" ON "SnapshotPayload";
DROP TRIGGER IF EXISTS "snapshot_payload_pinned_not_collectable" ON "SnapshotPayload";
DROP TRIGGER IF EXISTS "snapshot_payload_append_only" ON "SnapshotPayload";

-- Reverse dependency order: tombstone and pin reference the payload, the
-- retrieval references the payload, the payload references nothing.
DROP TABLE IF EXISTS "SnapshotTombstone";
DROP TABLE IF EXISTS "SnapshotPin";
DROP TABLE IF EXISTS "SnapshotRetrieval";
DROP TABLE IF EXISTS "SnapshotPayload";

-- THE SIX SCHEMA-LEVEL FUNCTIONS. None of these goes with a table.
DROP FUNCTION IF EXISTS "snapshot_pin_release_only"();
DROP FUNCTION IF EXISTS "snapshot_tombstone_is_immutable"();
DROP FUNCTION IF EXISTS "snapshot_retrieval_is_immutable"();
DROP FUNCTION IF EXISTS "snapshot_row_is_not_deletable"();
DROP FUNCTION IF EXISTS "snapshot_payload_pinned_is_not_collectable"();
DROP FUNCTION IF EXISTS "snapshot_payload_is_append_only"();
