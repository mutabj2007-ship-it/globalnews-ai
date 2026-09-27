-- Rollback for 20260927120000_my_intelligence_saved_stories_visit_boundary.
-- Removes only what the migration added.
DROP TABLE IF EXISTS "SavedStory";
ALTER TABLE "User" DROP COLUMN IF EXISTS "visitBoundaryAt";
