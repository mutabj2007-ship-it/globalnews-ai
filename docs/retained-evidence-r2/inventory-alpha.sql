-- Run only later against an explicitly selected Alpha database, using a read-only role.
-- stdout is private retained material. Never put exports under frontend/public or commit them.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT json_build_object('articles', (SELECT count(*) FROM "Article"),
  'attributions', (SELECT count(*) FROM "ArticleCountry"),
  'securityRevisions', (SELECT count(*) FROM "SecurityObservation"));
SELECT to_regclass('hum_authority.retained_capture') AS humanitarian_capture_table,
       to_regclass('hum_authority.retained_observation_revision') AS humanitarian_revision_table;
ROLLBACK;