-- ASK GLOBALNEWSAI INTELLIGENCE BINDING R1 — additive, non-destructive.
-- Bounded observability of governed contributor use: ids and a count only (no content,
-- no question, no account). Existing rows receive empty arrays and a NULL count.
ALTER TABLE "AskObservation" ADD COLUMN "contributorsConsidered" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "contributorsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "contributorsDegraded" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "contributorItemCount" INTEGER;
