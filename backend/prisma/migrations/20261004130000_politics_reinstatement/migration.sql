-- POLITICS INTEL R1 — explicit accountable reinstatement (CTO retraction/reinstatement ruling).
-- Additive: one nullable column, one CHECK, and the predecessor trigger function replaced in place.
-- Before this migration a retracted identity could never be revised again; after it, ONLY an explicit
-- reinstatement naming the directly preceding retraction may follow a RETRACTION, and a reinstatement may
-- follow nothing else. Chronology alone never reinstates.
BEGIN;

ALTER TABLE "PoliticsObservation" ADD COLUMN "reinstatement" JSONB;

ALTER TABLE "PoliticsObservation"
  ADD CONSTRAINT "PoliticsObservation_reinstatement_shape_check" CHECK (
    "reinstatement" IS NULL OR (
      jsonb_typeof("reinstatement") = 'object'
      AND jsonb_typeof("reinstatement"->'reinstatesRevisionOrdinal') = 'number'
      AND ("reinstatement"->>'reinstatesRevisionOrdinal')::numeric = "revisionOrdinal" - 1
      AND length(btrim(COALESCE("reinstatement"->>'reviewer', ''))) > 0
      AND lower(btrim("reinstatement"->>'reviewer')) NOT IN ('system', 'auto', 'ai', 'model')
      AND length(btrim(COALESCE("reinstatement"->>'rationale', ''))) > 0
      AND length(btrim(COALESCE("reinstatement"->>'reviewedAt', ''))) > 0
      AND ("revision"->>'revisionKind') IS DISTINCT FROM 'RETRACTION'
    ));

CREATE OR REPLACE FUNCTION "require_politics_revision_predecessor"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE prior_kind TEXT;
BEGIN
  IF NEW."revisionOrdinal" = 0 THEN
    IF NEW."reinstatement" IS NOT NULL THEN
      RAISE EXCEPTION 'Politics reinstatement requires a preceding retraction' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT prior."revision"->>'revisionKind' INTO prior_kind FROM "PoliticsObservation" prior
    WHERE prior."observationKey" = NEW."observationKey"
      AND prior."upstreamAuthority" = NEW."upstreamAuthority"
      AND prior."upstreamId" = NEW."upstreamId"
      AND prior."subjectType" = NEW."subjectType"
      AND prior."subjectId" = NEW."subjectId"
      AND prior."revisionOrdinal" = NEW."revisionOrdinal" - 1
    FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Politics revision requires its exact, unretracted preceding revision' USING ERRCODE = '23514';
  END IF;
  IF prior_kind IS NOT DISTINCT FROM 'RETRACTION' AND NEW."reinstatement" IS NULL THEN
    RAISE EXCEPTION 'Politics identity is retracted; only an explicit accountable reinstatement may follow' USING ERRCODE = '23514';
  END IF;
  IF prior_kind IS DISTINCT FROM 'RETRACTION' AND NEW."reinstatement" IS NOT NULL THEN
    RAISE EXCEPTION 'Politics reinstatement requires a preceding retraction' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
