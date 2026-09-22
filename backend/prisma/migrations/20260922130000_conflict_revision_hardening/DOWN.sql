-- Operational rollback, never automatic. Refuse removing safeguards around evidence.
BEGIN;
LOCK TABLE "ConflictObservation" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ConflictObservation") THEN
    RAISE EXCEPTION 'Refusing Conflict hardening rollback: retained evidence exists; use forward repair'
      USING ERRCODE = '23514';
  END IF;
END $$;
DROP TRIGGER "ConflictObservation_predecessor" ON "ConflictObservation";
DROP FUNCTION "require_conflict_revision_predecessor"();
DROP TRIGGER "ConflictObservation_no_truncate" ON "ConflictObservation";
ALTER TABLE "ConflictObservation" DROP CONSTRAINT "ConflictObservation_revision_shape_check";
COMMIT;
