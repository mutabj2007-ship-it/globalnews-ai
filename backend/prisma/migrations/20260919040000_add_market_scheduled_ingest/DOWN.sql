-- ROLLBACK for 20260919040000_add_market_scheduled_ingest.
--
-- Drops the three tables in REVERSE DEPENDENCY ORDER, and — separately — the two
-- schema-level plpgsql functions, which live in the schema rather than in a table
-- and would survive a naive DROP TABLE.
--
-- OPERATOR NOTE. This is a far less dangerous rollback than the snapshot store's,
-- and the reason is worth stating so the two are not treated alike:
--
--   MarketObservation holds PARSED READINGS. If the bytes they came from are still
--   retained in the snapshot store, the readings are re-derivable by re-parsing.
--
--   The snapshot store's payloads are NOT re-derivable — publishers serve different
--   editions and do not version past data — which is why THAT rollback refuses to
--   run while anything is pinned and this one does not need to.
--
-- Dropping these tables does NOT unpin anything in the snapshot store, and does not
-- touch a single byte of retained evidence. The pointer direction is what makes that
-- true: MarketObservation points at a content address, and nothing points back.
--
-- Run records are lost, though, and they are the only trace that a fetch was
-- attempted and how it ended. Take a backup if the ingest history matters.

DROP TRIGGER IF EXISTS "market_ingest_run_not_deletable" ON "MarketIngestRun";
DROP TRIGGER IF EXISTS "market_observation_append_only" ON "MarketObservation";

-- MarketObservation references MarketIngestRun; MarketIngestLease references nothing.
DROP TABLE IF EXISTS "MarketObservation";
DROP TABLE IF EXISTS "MarketIngestLease";
DROP TABLE IF EXISTS "MarketIngestRun";

-- THE TWO SCHEMA-LEVEL FUNCTIONS. Neither goes with a table.
DROP FUNCTION IF EXISTS "market_ingest_run_is_not_deletable"();
DROP FUNCTION IF EXISTS "market_observation_is_append_only"();
