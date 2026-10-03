-- CTO R4 SEMANTIC IR — the turn's semantic interpretation on the Ask observation (codes only).
-- Additive: existing rows keep NULL / empty arrays ("no interpretation recorded"); no backfill.
-- Does not touch 20261003200000_r4_ask_observation_job.
ALTER TABLE "AskObservation" ADD COLUMN "semanticPath" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "semanticConflicts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "semanticClauseCount" INTEGER;
ALTER TABLE "AskObservation" ADD COLUMN "semanticFreshness" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "semanticEvidence" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "semanticActorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "semanticVenueCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "semanticObjectCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AskObservation" ADD COLUMN "semanticRelation" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "semanticObjectiveSourceTurn" INTEGER;
ALTER TABLE "AskObservation" ADD COLUMN "semanticReferenceKind" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "semanticInterpreterPromptTokens" INTEGER;
ALTER TABLE "AskObservation" ADD COLUMN "semanticInterpreterCompletionTokens" INTEGER;
ALTER TABLE "AskObservation" ADD COLUMN "semanticCompleteness" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "semanticUnresolvedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
