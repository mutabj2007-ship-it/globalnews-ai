-- CTO R132 ARTICLE ATTRIBUTION rollback (manual, operator-run). Loses every recorded author and
-- licence snapshot; no other column or table is touched.
BEGIN;
ALTER TABLE "Article" DROP COLUMN IF EXISTS "authorName";
ALTER TABLE "Article" DROP COLUMN IF EXISTS "licenseId";
ALTER TABLE "Article" DROP COLUMN IF EXISTS "licenseUrl";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261016160000_article_attribution_r132';
COMMIT;
