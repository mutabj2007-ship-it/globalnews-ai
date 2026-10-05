-- EA-STORY-BRIEF-01 rollback (manual, operator-run). Refuses while any Brief version exists:
-- a Brief that readers have seen and discussed is history — forward-repair instead.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "StoryBriefVersion") THEN
    RAISE EXCEPTION 'StoryBriefVersion rows exist; refusing rollback (forward-repair)';
  END IF;
END $$;
ALTER TABLE "StoryComment" DROP CONSTRAINT IF EXISTS "StoryComment_storyBriefVersionId_fkey";
ALTER TABLE "StoryComment" DROP COLUMN IF EXISTS "storyBriefVersionId";
DROP TABLE IF EXISTS "StoryBriefAttempt";
DROP TRIGGER IF EXISTS "story_brief_version_append_only" ON "StoryBriefVersion";
DROP TABLE IF EXISTS "StoryBriefVersion";
DROP FUNCTION IF EXISTS "story_brief_version_immutable"();
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261006100000_story_brief_r1';
COMMIT;
