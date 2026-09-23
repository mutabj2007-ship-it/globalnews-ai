-- psql -X -qAt emits one JSON array; use a read-only Alpha connection, never production.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT coalesce(json_agg(row_data ORDER BY id), '[]'::json) FROM (
  SELECT a.id, to_jsonb(a) || jsonb_build_object('countries',
    (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c."countryCode"), '[]'::jsonb)
     FROM "ArticleCountry" c WHERE c."articleId"=a.id)) AS row_data
  FROM "Article" a ORDER BY a.id LIMIT 10000
) retained;
ROLLBACK;