-- R2 · D1 rollback (manual, operator-run; Alpha only). Loses every saved briefing.
BEGIN;
DROP TABLE IF EXISTS "BriefingVersion";
DROP TABLE IF EXISTS "Briefing";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261003100000_r2_d1_briefings';
COMMIT;
