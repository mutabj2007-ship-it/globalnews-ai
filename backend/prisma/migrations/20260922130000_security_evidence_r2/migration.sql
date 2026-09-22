-- R2 replaces the UNAPPLIED R1 design. Existing tables and historical migrations are untouched.
CREATE TABLE "SecurityProjectionRun" (
 "id" SERIAL PRIMARY KEY, "geographyId" TEXT NOT NULL CHECK ("geographyId" ~ '^[A-Z]{2}$'),
 "maxAgeMinutes" INTEGER NOT NULL CHECK ("maxAgeMinutes" BETWEEN 1 AND 43200),
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SecurityProjectionRun_geographyId_id_idx" ON "SecurityProjectionRun"("geographyId", "id");
CREATE TABLE "SecurityProjectionCompletion" (
 "runId" INTEGER PRIMARY KEY REFERENCES "SecurityProjectionRun"("id") ON DELETE RESTRICT,
 "status" TEXT NOT NULL CHECK ("status" IN ('OK','NO_RESULTS','SOURCE_UNAVAILABLE')),
 "observationCount" INTEGER NOT NULL CHECK ("observationCount" >= 0),
 "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("status" = 'OK') = ("observationCount" > 0)));
CREATE TABLE "SecurityObservation" (
 "id" SERIAL PRIMARY KEY, "runId" INTEGER NOT NULL REFERENCES "SecurityProjectionRun"("id") ON DELETE RESTRICT,
 "observationKey" TEXT NOT NULL, "geographyId" TEXT NOT NULL,
 "revisionOrdinal" INTEGER NOT NULL CHECK ("revisionOrdinal" >= 0), "supersedesRevisionOrdinal" INTEGER,
 "ownershipT1" BOOLEAN NOT NULL, "ownershipT2" BOOLEAN NOT NULL, "resolvedOwner" TEXT NOT NULL,
 "payload" JSONB NOT NULL,
 CONSTRAINT "SecurityObservation_owner_check" CHECK ("ownershipT1" IS TRUE AND "ownershipT2" IS FALSE AND "resolvedOwner" = 'SECURITY'),
 CONSTRAINT "SecurityObservation_revision_check" CHECK (
   ("revisionOrdinal" = 0 AND "supersedesRevisionOrdinal" IS NULL) OR
   ("revisionOrdinal" > 0 AND "supersedesRevisionOrdinal" IS NOT NULL AND "supersedesRevisionOrdinal" = "revisionOrdinal" - 1)));
CREATE UNIQUE INDEX "SecurityObservation_observationKey_revisionOrdinal_key" ON "SecurityObservation"("observationKey", "revisionOrdinal");
CREATE UNIQUE INDEX "SecurityObservation_runId_observationKey_key" ON "SecurityObservation"("runId", "observationKey");
CREATE INDEX "SecurityObservation_geographyId_runId_idx" ON "SecurityObservation"("geographyId", "runId");
CREATE TABLE "SecurityProjectionMember" (
 "runId" INTEGER NOT NULL REFERENCES "SecurityProjectionRun"("id") ON DELETE RESTRICT,
 "observationId" INTEGER NOT NULL REFERENCES "SecurityObservation"("id") ON DELETE RESTRICT,
 "observationKey" TEXT NOT NULL,
 PRIMARY KEY ("runId", "observationId"));
CREATE UNIQUE INDEX "SecurityProjectionMember_runId_observationKey_key" ON "SecurityProjectionMember"("runId", "observationKey");
CREATE FUNCTION security_r2_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN RAISE EXCEPTION 'Security R2 audit ledger is append-only'; END $$;
CREATE TRIGGER security_run_immutable BEFORE UPDATE OR DELETE ON "SecurityProjectionRun" FOR EACH ROW EXECUTE FUNCTION security_r2_immutable();
CREATE TRIGGER security_completion_immutable BEFORE UPDATE OR DELETE ON "SecurityProjectionCompletion" FOR EACH ROW EXECUTE FUNCTION security_r2_immutable();
CREATE TRIGGER security_observation_immutable BEFORE UPDATE OR DELETE ON "SecurityObservation" FOR EACH ROW EXECUTE FUNCTION security_r2_immutable();
CREATE TRIGGER security_member_immutable BEFORE UPDATE OR DELETE ON "SecurityProjectionMember" FOR EACH ROW EXECUTE FUNCTION security_r2_immutable();
CREATE FUNCTION security_r2_validate_append() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE scope TEXT; last_ordinal INTEGER;
BEGIN
 SELECT "geographyId" INTO scope FROM "SecurityProjectionRun" WHERE "id" = NEW."runId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "SecurityProjectionCompletion" WHERE "runId" = NEW."runId") THEN RAISE EXCEPTION 'Completed projections are sealed'; END IF;
 IF NEW."geographyId" IS DISTINCT FROM scope THEN RAISE EXCEPTION 'Wrong geography'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('security-r2:' || scope));
 SELECT max("revisionOrdinal") INTO last_ordinal FROM "SecurityObservation" WHERE "observationKey" = NEW."observationKey";
 IF NEW."revisionOrdinal" <> coalesce(last_ordinal + 1, 0) THEN RAISE EXCEPTION 'Revision must append contiguously'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_observation_append BEFORE INSERT ON "SecurityObservation" FOR EACH ROW EXECUTE FUNCTION security_r2_validate_append();
CREATE FUNCTION security_r2_validate_completion() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE actual INTEGER;
BEGIN
 PERFORM 1 FROM "SecurityProjectionRun" WHERE "id" = NEW."runId" FOR UPDATE;
 SELECT count(*) INTO actual FROM "SecurityProjectionMember" WHERE "runId" = NEW."runId";
 IF NEW."observationCount" <> actual THEN RAISE EXCEPTION 'Projection count mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_completion_seal BEFORE INSERT ON "SecurityProjectionCompletion" FOR EACH ROW EXECUTE FUNCTION security_r2_validate_completion();
CREATE FUNCTION security_r2_validate_member() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE scope TEXT; obs_scope TEXT; obs_key TEXT;
BEGIN
 SELECT "geographyId" INTO scope FROM "SecurityProjectionRun" WHERE "id" = NEW."runId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "SecurityProjectionCompletion" WHERE "runId" = NEW."runId") THEN RAISE EXCEPTION 'Completed projections are sealed'; END IF;
 SELECT "geographyId", "observationKey" INTO obs_scope, obs_key FROM "SecurityObservation" WHERE "id" = NEW."observationId";
 IF obs_scope IS DISTINCT FROM scope OR obs_key IS DISTINCT FROM NEW."observationKey" THEN RAISE EXCEPTION 'Wrong member scope or identity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_member_validate BEFORE INSERT ON "SecurityProjectionMember" FOR EACH ROW EXECUTE FUNCTION security_r2_validate_member();
-- TRUNCATE is a mutation too, including when a privileged application role can issue it.
CREATE TRIGGER security_run_no_truncate BEFORE TRUNCATE ON "SecurityProjectionRun" EXECUTE FUNCTION security_r2_immutable();
CREATE TRIGGER security_completion_no_truncate BEFORE TRUNCATE ON "SecurityProjectionCompletion" EXECUTE FUNCTION security_r2_immutable();
CREATE TRIGGER security_observation_no_truncate BEFORE TRUNCATE ON "SecurityObservation" EXECUTE FUNCTION security_r2_immutable();
CREATE TRIGGER security_member_no_truncate BEFORE TRUNCATE ON "SecurityProjectionMember" EXECUTE FUNCTION security_r2_immutable();
