BEGIN;
LOCK TABLE "ConflictObservation" IN ACCESS EXCLUSIVE MODE;

CREATE TRIGGER "ConflictObservation_no_truncate"
  BEFORE TRUNCATE ON "ConflictObservation"
  FOR EACH STATEMENT EXECUTE FUNCTION "refuse_conflict_observation_mutation"();

-- NULL must not pass CHECK's three-valued logic. Validate existing rows as well.
ALTER TABLE "ConflictObservation"
  ADD CONSTRAINT "ConflictObservation_revision_shape_check" CHECK (
    jsonb_typeof("revision"->'revisionOrdinal') IS NOT DISTINCT FROM 'number'
    AND ("revision"->>'revisionOrdinal')::numeric = "revisionOrdinal"
    AND (("revisionOrdinal" = 0
      AND "revision"->'supersedesRevisionOrdinal' IS NOT DISTINCT FROM 'null'::jsonb
      AND NOT ("revision" ? 'revisionKind'))
    OR ("revisionOrdinal" > 0
      AND jsonb_typeof("revision"->'supersedesRevisionOrdinal') IS NOT DISTINCT FROM 'number'
      AND ("revision"->>'supersedesRevisionOrdinal')::numeric = "revisionOrdinal" - 1
      AND COALESCE("revision"->>'revisionKind' IN ('LOCATION_CORRECTION', 'CLASSIFICATION_CHANGE',
        'IMPACT_METADATA_CHANGE', 'SOURCE_REVISION', 'RETRACTION'), false)))
  );

-- Refuse an already broken chain instead of silently blessing it during migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ConflictObservation" next
    WHERE next."revisionOrdinal" > 0 AND NOT EXISTS (
      SELECT 1 FROM "ConflictObservation" prior
      WHERE prior."observationKey" = next."observationKey"
        AND prior."authority" = next."authority"
        AND prior."upstreamEventId" = next."upstreamEventId"
        AND prior."revisionOrdinal" = next."revisionOrdinal" - 1)) THEN
    RAISE EXCEPTION 'Conflict revision chain is broken; evidence reconciliation required'
      USING ERRCODE = '23514';
  END IF;
END $$;

CREATE FUNCTION "require_conflict_revision_predecessor"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."revisionOrdinal" > 0 THEN
    PERFORM 1 FROM "ConflictObservation" prior
      WHERE prior."observationKey" = NEW."observationKey"
        AND prior."authority" = NEW."authority"
        AND prior."upstreamEventId" = NEW."upstreamEventId"
        AND prior."revisionOrdinal" = NEW."revisionOrdinal" - 1
      FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conflict revision requires its exact preceding event revision'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ConflictObservation_predecessor"
  BEFORE INSERT ON "ConflictObservation"
  FOR EACH ROW EXECUTE FUNCTION "require_conflict_revision_predecessor"();
COMMIT;
