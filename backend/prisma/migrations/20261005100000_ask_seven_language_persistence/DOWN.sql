-- ASK SEVEN-LANGUAGE PERSISTENCE R1 rollback (manual, operator-run).
-- Refuses (ADD CONSTRAINT fails) while any fr/de/es/pt/ar thread or turn exists. Never
-- delete or relabel those conversations to make this pass; forward-repair instead.
BEGIN;
ALTER TABLE "AskThread" DROP CONSTRAINT IF EXISTS "AskThread_language";
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_language" CHECK ("language" IN ('en', 'pl'));
ALTER TABLE "AskTurn" DROP CONSTRAINT IF EXISTS "AskTurn_language";
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_language" CHECK ("language" IN ('en', 'pl'));
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261005100000_ask_seven_language_persistence';
COMMIT;
