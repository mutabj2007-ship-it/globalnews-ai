-- CTO R4 CLOSEOUT — the governed user job on the Ask observation (codes only, all nullable).
-- Additive: existing rows keep NULL ("no job reading recorded"); no backfill.
ALTER TABLE "AskObservation" ADD COLUMN "jobKind" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobSource" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobDepth" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobFreshness" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobClassifierUsed" BOOLEAN;
ALTER TABLE "AskObservation" ADD COLUMN "jobTransformation" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobDiscourseReference" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobArtifactUsedKind" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "jobArtifactProducedKind" TEXT;
