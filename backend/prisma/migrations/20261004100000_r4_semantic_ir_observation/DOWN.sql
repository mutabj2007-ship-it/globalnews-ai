-- CTO R4 SEMANTIC IR rollback (manual, operator-run). Drops only the semantic diagnostics columns.
BEGIN;
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticPath";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticConflicts";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticClauseCount";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticFreshness";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticEvidence";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticActorCodes";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticVenueCodes";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticObjectCodes";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticRelation";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticObjectiveSourceTurn";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticReferenceKind";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticInterpreterPromptTokens";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticInterpreterCompletionTokens";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticCompleteness";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "semanticUnresolvedFields";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261004100000_r4_semantic_ir_observation';
COMMIT;
