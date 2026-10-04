-- Operational guard for 20261004120000_politics_observation_store. Never drops retained evidence.
BEGIN;
LOCK TABLE "PoliticsObservation" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PoliticsObservation") THEN
    RAISE EXCEPTION 'Refusing Politics table rollback: retained evidence exists; use forward repair'
      USING ERRCODE = '23514';
  END IF;
END $$;
DROP TABLE "PoliticsObservation";
DROP FUNCTION "refuse_politics_observation_mutation"();
DROP FUNCTION "require_politics_revision_predecessor"();
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261004120000_politics_observation_store';
COMMIT;
