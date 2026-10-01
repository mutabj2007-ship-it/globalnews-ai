-- HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE B · M1 — CANONICAL STORY IDENTITY.
-- ADDITIVE ONLY: three new tables; no existing table, column or row is altered. articleRef
-- (sha256(normalizeArticleUrl(url))) is NOT recomputed and SavedStory is NOT touched. No backfill
-- runs here: backfill is an explicit, conservative service operation (CanonicalStoryService).
-- BACKWARD: DROP TABLE "StoryIdentityEvent", "StoryArticle", "Story" (only after M2/M3 are reversed).

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mergedIntoId" TEXT,
    "briefVersion" INTEGER NOT NULL DEFAULT 1,
    "briefUpdatedAt" TIMESTAMPTZ(6),
    "discussionLockedAt" TIMESTAMPTZ(6),
    "discussionLockReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryArticle" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "articleRef" TEXT NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "sourceHost" TEXT NOT NULL,
    "addedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStoryId" TEXT,

    CONSTRAINT "StoryArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryIdentityEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "otherStoryId" TEXT,
    "articleRefs" TEXT[],
    "briefVersion" INTEGER,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryIdentityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_mergedIntoId_idx" ON "Story"("mergedIntoId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryArticle_articleRef_key" ON "StoryArticle"("articleRef");

-- CreateIndex
CREATE INDEX "StoryArticle_storyId_idx" ON "StoryArticle"("storyId");

-- CreateIndex
CREATE INDEX "StoryIdentityEvent_storyId_createdAt_idx" ON "StoryIdentityEvent"("storyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryArticle" ADD CONSTRAINT "StoryArticle_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants enforced by the database, not only by code.

ALTER TABLE "Story" ADD CONSTRAINT "chk_story_status" CHECK ("status" IN ('ACTIVE','MERGED'));

ALTER TABLE "Story" ADD CONSTRAINT "chk_story_alias" CHECK (("status" = 'MERGED') = ("mergedIntoId" IS NOT NULL));

ALTER TABLE "Story" ADD CONSTRAINT "chk_story_not_self_alias" CHECK ("mergedIntoId" IS NULL OR "mergedIntoId" <> "id");

ALTER TABLE "Story" ADD CONSTRAINT "chk_story_brief_version" CHECK ("briefVersion" >= 1);

ALTER TABLE "StoryArticle" ADD CONSTRAINT "chk_story_article_ref_hex" CHECK ("articleRef" ~ '^[0-9a-f]{64}$');

ALTER TABLE "StoryIdentityEvent" ADD CONSTRAINT "chk_story_identity_event_kind" CHECK ("kind" IN ('CREATE','JOIN','MERGE','SPLIT','VERSION'));
