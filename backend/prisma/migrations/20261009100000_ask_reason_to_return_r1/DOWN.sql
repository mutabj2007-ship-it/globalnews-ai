-- ASK REASON TO RETURN R1 rollback (manual, operator-run). Loses every followed-question check
-- record; versions and briefings stay. A PAUSED briefing is returned to ACTIVE first so the
-- narrower CHECK can be restored.
BEGIN;
DROP TABLE IF EXISTS "BriefingCheck";
UPDATE "Briefing" SET "status" = 'ACTIVE' WHERE "status" = 'PAUSED';
ALTER TABLE "Briefing" DROP CONSTRAINT "Briefing_status_check";
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'));
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "retrievalOutcome";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "candidatesSeen";
ALTER TABLE "AskObservation" DROP COLUMN IF EXISTS "candidatesAdmitted";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261009100000_ask_reason_to_return_r1';
COMMIT;
