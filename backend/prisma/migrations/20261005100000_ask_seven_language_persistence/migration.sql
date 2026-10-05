-- ASK SEVEN-LANGUAGE PERSISTENCE R1 — widen the AskThread/AskTurn language CHECK to the
-- seven display locales that ASK_LANGUAGES (shared DISPLAY_LOCALES) already accepts.
--
-- 20260922140000_ask_compute_sand_r1 clamped both columns to ('en','pl'). The DTOs later
-- accepted fr/de/es/pt/ar, so those threads passed validation and failed on insert.
--
-- RELAXING ONLY. Every existing row ('en'/'pl') satisfies the new CHECK; no row is
-- rewritten or relabelled. The constraint is kept, so unknown values are still refused.
-- Code rollback needs no schema rollback: an older backend never writes the new values.
-- Schema rollback (DOWN.sql) would fail once any fr/de/es/pt/ar row exists; that is
-- intended — forward-repair instead of deleting conversations.
ALTER TABLE "AskThread" DROP CONSTRAINT IF EXISTS "AskThread_language";
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_language"
  CHECK ("language" IN ('en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'));

ALTER TABLE "AskTurn" DROP CONSTRAINT IF EXISTS "AskTurn_language";
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_language"
  CHECK ("language" IN ('en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'));
