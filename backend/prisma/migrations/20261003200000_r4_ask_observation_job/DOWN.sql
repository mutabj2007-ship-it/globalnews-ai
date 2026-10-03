-- CTO R4 closeout rollback (manual, operator-run). Drops only the job diagnostics columns.
BEGIN;
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobKind";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobSource";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobDepth";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobFreshness";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobClassifierUsed";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobTransformation";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobDiscourseReference";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobArtifactUsedKind";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "jobArtifactProducedKind";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261003200000_r4_ask_observation_job';
COMMIT;
