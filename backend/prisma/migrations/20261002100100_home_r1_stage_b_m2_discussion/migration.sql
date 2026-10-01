-- STAGE B · M2 — DISCUSSION (depends on M1). Comments are never Ask evidence.
-- Soft states (HIDDEN / REMOVED / DELETED) so a gate rollback hides writes and keeps rows.
-- Account deletion cascades the author's comments and reports; replies by others survive
-- (parentId SET NULL). The moderation audit keeps a plain actor id (no User relation).
-- BACKWARD: DROP TABLE "StoryModerationAction", "StoryCommentReport", "StoryComment" — this DESTROYS
-- reader content; prefer the discussion.write / discussion.read gates for rollback.

-- CreateTable
CREATE TABLE "StoryComment" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'VISIBLE',
    "briefVersion" INTEGER NOT NULL,
    "originArticleRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "StoryComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryCommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryCommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryModerationAction" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "commentId" TEXT,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryComment_storyId_createdAt_idx" ON "StoryComment"("storyId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryComment_parentId_idx" ON "StoryComment"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryComment_userId_idempotencyKey_key" ON "StoryComment"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoryCommentReport_commentId_userId_key" ON "StoryCommentReport"("commentId", "userId");

-- CreateIndex
CREATE INDEX "StoryModerationAction_storyId_createdAt_idx" ON "StoryModerationAction"("storyId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoryComment" ADD CONSTRAINT "StoryComment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryComment" ADD CONSTRAINT "StoryComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryComment" ADD CONSTRAINT "StoryComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StoryComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryCommentReport" ADD CONSTRAINT "StoryCommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "StoryComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryCommentReport" ADD CONSTRAINT "StoryCommentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants enforced by the database, not only by code.

ALTER TABLE "StoryComment" ADD CONSTRAINT "chk_story_comment_state" CHECK ("state" IN ('VISIBLE','HIDDEN','REMOVED','DELETED'));

ALTER TABLE "StoryComment" ADD CONSTRAINT "chk_story_comment_body" CHECK (char_length("body") <= 2000);

ALTER TABLE "StoryComment" ADD CONSTRAINT "chk_story_comment_not_self_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "StoryComment" ADD CONSTRAINT "chk_story_comment_brief_version" CHECK ("briefVersion" >= 1);

ALTER TABLE "StoryCommentReport" ADD CONSTRAINT "chk_story_comment_report_reason" CHECK ("reason" IN ('SPAM','ABUSE','HARASSMENT','MISINFORMATION','OFF_TOPIC','OTHER'));

ALTER TABLE "StoryModerationAction" ADD CONSTRAINT "chk_story_moderation_action" CHECK ("action" IN ('HIDE','REMOVE','RESTORE','LOCK','UNLOCK'));
