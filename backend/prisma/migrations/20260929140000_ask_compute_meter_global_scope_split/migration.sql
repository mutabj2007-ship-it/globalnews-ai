-- ASK COMPUTE METER GLOBAL BUCKET COLLISION R1 (P1) — DATA ONLY. No schema change.
--
-- The global-hour and global-day rate controls move from the shared scope 'global' to
-- 'global:hour' and 'global:day'. Without this carry-over the split would restart both
-- global counters at zero on deploy day — a transient weakening of both ceilings.
--
-- Usage from the current and previous UTC day is carried into the new keys:
--   * every legacy 'global' row is an hour bucket          -> 'global:hour' (same bucketStart)
--   * a legacy row at 00:00 UTC is ALSO the day bucket     -> 'global:day'  (same bucketStart)
-- The legacy 00:00 row mixed the day total with hour 00 (that is the defect), so it is carried
-- to both keys unchanged: the conservative direction — never lower than the true usage.
--
-- Idempotent: GREATEST on conflict, so a re-run never double-counts. Legacy 'global' rows are
-- left in place (history; still referenced by any reservation recorded before the deploy,
-- which settles against exactly the charges it recorded).

INSERT INTO "ComputeMeter" ("scope", "bucketStart", "units")
SELECT 'global:hour', "bucketStart", "units"
FROM "ComputeMeter"
WHERE "scope" = 'global'
  AND "bucketStart" >= (date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day') AT TIME ZONE 'UTC'
ON CONFLICT ("scope", "bucketStart")
DO UPDATE SET "units" = GREATEST("ComputeMeter"."units", EXCLUDED."units");

INSERT INTO "ComputeMeter" ("scope", "bucketStart", "units")
SELECT 'global:day', "bucketStart", "units"
FROM "ComputeMeter"
WHERE "scope" = 'global'
  AND "bucketStart" = date_trunc('day', "bucketStart" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  AND "bucketStart" >= (date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day') AT TIME ZONE 'UTC'
ON CONFLICT ("scope", "bucketStart")
DO UPDATE SET "units" = GREATEST("ComputeMeter"."units", EXCLUDED."units");
