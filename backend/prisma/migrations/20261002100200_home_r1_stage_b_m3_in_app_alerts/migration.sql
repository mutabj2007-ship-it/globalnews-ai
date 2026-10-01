-- STAGE B · M3 — IN-APP ALERTS (depends on M1). Not Follow, not the dormant Watch. No delivery
-- channel, address, token or subscription column exists. Dedup = UNIQUE (alertId, briefVersion).
-- Every alert records its originating article (originArticleRef, immutable) so an editor split
-- moves the alert with that article; logical dedup = one live alert per reader per canonical story.
-- BACKWARD: DROP TABLE "StoryAlertEvent", "StoryAlert", "UserInboxCursor" (reader alerts are lost;
-- prefer the alerts.inApp gate for rollback).

-- CreateTable
CREATE TABLE "StoryAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "originArticleRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdBriefVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "removedAt" TIMESTAMPTZ(6),

    CONSTRAINT "StoryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryAlertEvent" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "briefVersion" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(6),

    CONSTRAINT "StoryAlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInboxCursor" (
    "userId" TEXT NOT NULL,
    "repliesSeenAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserInboxCursor_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "StoryAlert_userId_status_idx" ON "StoryAlert"("userId", "status");

-- CreateIndex
CREATE INDEX "StoryAlert_storyId_status_idx" ON "StoryAlert"("storyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoryAlert_userId_storyId_key" ON "StoryAlert"("userId", "storyId");

-- CreateIndex
CREATE INDEX "StoryAlertEvent_alertId_readAt_idx" ON "StoryAlertEvent"("alertId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoryAlertEvent_alertId_briefVersion_key" ON "StoryAlertEvent"("alertId", "briefVersion");

-- AddForeignKey
ALTER TABLE "StoryAlert" ADD CONSTRAINT "StoryAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAlert" ADD CONSTRAINT "StoryAlert_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAlertEvent" ADD CONSTRAINT "StoryAlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "StoryAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInboxCursor" ADD CONSTRAINT "UserInboxCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants enforced by the database, not only by code.

ALTER TABLE "StoryAlert" ADD CONSTRAINT "chk_story_alert_status" CHECK ("status" IN ('ACTIVE','PAUSED','REMOVED'));

ALTER TABLE "StoryAlert" ADD CONSTRAINT "chk_story_alert_removed_at" CHECK (("status" = 'REMOVED') = ("removedAt" IS NOT NULL));

ALTER TABLE "StoryAlertEvent" ADD CONSTRAINT "chk_story_alert_event_kind" CHECK ("kind" IN ('NEW_EVIDENCE','STORY_MERGED'));

ALTER TABLE "StoryAlert" ADD CONSTRAINT "chk_story_alert_origin_ref_hex" CHECK ("originArticleRef" ~ '^[0-9a-f]{64}$');
