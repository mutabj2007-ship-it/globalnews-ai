-- POLITICS INTEL R1 — retained Politics evidence (CTO Decision 5: additive, local only).
-- New table only: no existing table, column, index or row is altered.
-- No producer, provider or schedule is activated by this migration.
BEGIN;

CREATE TABLE "PoliticsObservation" (
  "id" TEXT NOT NULL,
  "observationKey" TEXT NOT NULL,
  "upstreamAuthority" TEXT NOT NULL,
  "upstreamId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "observationKind" TEXT NOT NULL,
  "claim" JSONB NOT NULL,
  "temporal" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "sourceReference" JSONB NOT NULL,
  "attributeAuthorship" JSONB NOT NULL,
  "revision" JSONB NOT NULL,
  "publication" JSONB NOT NULL,
  "revisionOrdinal" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "artifactSha256" TEXT NOT NULL,
  "review" JSONB NOT NULL,
  "snapshotRetrievalId" TEXT NOT NULL,
  "snapshotAdmissibility" TEXT NOT NULL,
  "effectiveOn" TIMESTAMP(3) NOT NULL,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "temporalBasis" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "countryIso3" TEXT,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PoliticsObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PoliticsObservation_artifact_hash_check" CHECK ("artifactSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PoliticsObservation_kind_check" CHECK (
    ("observationKind" = 'LEGISLATIVE_STAGE' AND "subjectType" = 'LEGISLATIVE_SUBJECT')
    OR ("observationKind" = 'ELECTION_PROCESS_NOTICE' AND "subjectType" = 'ELECTION')
    OR ("observationKind" = 'PROTEST_HELD' AND "subjectType" = 'PROTEST_CAMPAIGN')),
  CONSTRAINT "PoliticsObservation_claim_kind_check" CHECK ("claim"->>'kind' IS NOT DISTINCT FROM "observationKind"),
  CONSTRAINT "PoliticsObservation_temporal_basis_check" CHECK ("temporalBasis" IN ('OCCURRENCE', 'PUBLISHER_VINTAGE', 'RETRIEVAL_ONLY')),
  CONSTRAINT "PoliticsObservation_country_check" CHECK ("countryIso3" IS NULL OR "countryIso3" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PoliticsObservation_capture_link_check" CHECK ("snapshotAdmissibility" = 'ADMITTED'),
  CONSTRAINT "PoliticsObservation_revision_shape_check" CHECK (
    jsonb_typeof("revision"->'revisionOrdinal') IS NOT DISTINCT FROM 'number'
    AND ("revision"->>'revisionOrdinal')::numeric = "revisionOrdinal"
    AND (("revisionOrdinal" = 0
      AND "revision"->'supersedesRevisionOrdinal' IS NOT DISTINCT FROM 'null'::jsonb
      AND NOT ("revision" ? 'revisionKind'))
    OR ("revisionOrdinal" > 0
      AND jsonb_typeof("revision"->'supersedesRevisionOrdinal') IS NOT DISTINCT FROM 'number'
      AND ("revision"->>'supersedesRevisionOrdinal')::numeric = "revisionOrdinal" - 1
      AND COALESCE("revision"->>'revisionKind' IN ('CORRECTION', 'CLASSIFICATION_CHANGE',
        'SOURCE_REVISION', 'RETRACTION'), false)))),
  CONSTRAINT "PoliticsObservation_snapshotRetrievalId_snapshotAdmissibility_fkey"
    FOREIGN KEY ("snapshotRetrievalId", "snapshotAdmissibility")
    REFERENCES "SnapshotRetrieval"("retrievalId", "admissibility") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PoliticsObservation_observationKey_revisionOrdinal_key"
  ON "PoliticsObservation"("observationKey", "revisionOrdinal");
CREATE UNIQUE INDEX "PoliticsObservation_upstreamAuthority_upstreamId_revisionOrdinal_key"
  ON "PoliticsObservation"("upstreamAuthority", "upstreamId", "revisionOrdinal");
CREATE INDEX "PoliticsObservation_countryIso3_effectiveOn_idx"
  ON "PoliticsObservation"("countryIso3", "effectiveOn");
CREATE INDEX "PoliticsObservation_subjectType_subjectId_idx"
  ON "PoliticsObservation"("subjectType", "subjectId");
CREATE INDEX "PoliticsObservation_effectiveOn_idx"
  ON "PoliticsObservation"("effectiveOn");

CREATE FUNCTION "refuse_politics_observation_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Politics observations are append-only; append a revision instead';
END;
$$;
CREATE TRIGGER "PoliticsObservation_append_only"
  BEFORE UPDATE OR DELETE ON "PoliticsObservation"
  FOR EACH ROW EXECUTE FUNCTION "refuse_politics_observation_mutation"();
CREATE TRIGGER "PoliticsObservation_no_truncate"
  BEFORE TRUNCATE ON "PoliticsObservation"
  FOR EACH STATEMENT EXECUTE FUNCTION "refuse_politics_observation_mutation"();

-- A revision needs its exact predecessor for the same identity AND the same subject:
-- a correction can never retarget which real-world subject a fact is about.
CREATE FUNCTION "require_politics_revision_predecessor"() RETURNS trigger
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
CREATE TRIGGER "PoliticsObservation_predecessor"
  BEFORE INSERT ON "PoliticsObservation"
  FOR EACH ROW EXECUTE FUNCTION "require_politics_revision_predecessor"();

COMMIT;
