-- CTO R132 · B3 ADDITIVE ATTRIBUTION SCHEMA (#94) — ADDITIVE ONLY.
-- Article gains three nullable TEXT columns: the item's credited author(s) and the per-source licence
-- (id + reference) it was acquired under. They are an ACQUISITION SNAPSHOT: written once at insert,
-- never by the upsert's update (immutable like "fetchedAt"), never re-derived from today's registry.
-- NULL is the honest value for every existing row: no backfill, no default, no trigger, no other table.
-- BACKWARD: DOWN.sql (operator-run).

ALTER TABLE "Article" ADD COLUMN "authorName" TEXT;
ALTER TABLE "Article" ADD COLUMN "licenseId" TEXT;
ALTER TABLE "Article" ADD COLUMN "licenseUrl" TEXT;
