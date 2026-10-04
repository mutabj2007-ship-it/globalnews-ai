-- Operational guard for 20261004130000_politics_reinstatement. Never drops a recorded reinstatement.
BEGIN;
LOCK TABLE "PoliticsObservation" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PoliticsObservation" WHERE "reinstatement" IS NOT NULL) THEN
    RAISE EXCEPTION 'Refusing rollback: recorded reinstatements exist; use forward repair' USING ERRCODE = '23514';
  END IF;
END $$;
-- Restore the 20261004120000 predecessor rule (no revision may follow a retraction).
CREATE OR REPLACE FUNCTION "require_politics_revision_predecessor"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."revisionOrdinal" > 0 THEN
    PERFORM 1 FROM "PoliticsObservation" prior
      WHERE prior."observationKey" = NEW."observationKey"
        AND prior."upstreamAuthority" = NEW."upstreamAuthority"
        AND prior."upstreamId" = NEW."upstreamId"
        AND prior."subjectType" = NEW."subjectType"
        AND prior."subjectId" = NEW."subjectId"
        AND prior."revisionOrdinal" = NEW."revisionOrdinal" - 1
        AND prior."revision"->>'revisionKind' IS DISTINCT FROM 'RETRACTION'
      FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Politics revision requires its exact, unretracted preceding revision'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
ALTER TABLE "PoliticsObservation" DROP CONSTRAINT "PoliticsObservation_reinstatement_shape_check";
ALTER TABLE "PoliticsObservation" DROP COLUMN "reinstatement";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261004130000_politics_reinstatement';
COMMIT;
