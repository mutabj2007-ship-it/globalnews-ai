-- Operational guard; the forward baseline migration is unchanged.
-- Roll back subsequent Conflict migrations first. Never drop retained evidence.
BEGIN;
LOCK TABLE "ConflictObservation" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ConflictObservation") THEN
    RAISE EXCEPTION 'Refusing Conflict table rollback: retained evidence exists; use forward repair'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = '"ConflictObservation"'::regclass
    AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Roll back subsequent Conflict migrations first' USING ERRCODE = '23514';
  END IF;
END $$;
DROP TABLE "ConflictObservation";
COMMIT;
