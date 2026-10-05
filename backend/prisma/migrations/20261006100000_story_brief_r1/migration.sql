-- EA-STORY-BRIEF-01 · CANONICAL STORY BRIEF R1 (docs/convergence/east-africa/STORY-BRIEF-CONTRACT.md).
-- Additive only: two new tables and one nullable column on StoryComment. No existing row is
-- rewritten. Story.briefVersion (the alert dedup key) is untouched.
-- BACKWARD: DOWN.sql (refuses while any Brief version exists — a Brief, once shown and discussed,
-- is reader-facing history; forward-repair instead).

-- CreateTable
CREATE TABLE "StoryBriefVersion" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "evidenceRevision" TEXT NOT NULL,
    "materialVersion" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "coverageGaps" JSONB NOT NULL,
    "uncertainty" JSONB NOT NULL,
    "asOf" TIMESTAMPTZ(6) NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceOperationId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryBriefVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryBriefAttempt" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "evidenceRevision" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CHECKING',
    "failureKind" TEXT,
    "failureCode" TEXT,
    "operationId" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "briefVersionId" TEXT,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),

    CONSTRAINT "StoryBriefAttempt_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable, no default, no rewrite of existing comments)
ALTER TABLE "StoryComment" ADD COLUMN "storyBriefVersionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StoryBriefVersion_storyId_version_key" ON "StoryBriefVersion"("storyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "StoryBriefVersion_storyId_evidenceRevision_key" ON "StoryBriefVersion"("storyId", "evidenceRevision");

-- CreateIndex
CREATE INDEX "StoryBriefAttempt_storyId_evidenceRevision_startedAt_idx" ON "StoryBriefAttempt"("storyId", "evidenceRevision", "startedAt");

-- AddForeignKey
ALTER TABLE "StoryComment" ADD CONSTRAINT "StoryComment_storyBriefVersionId_fkey" FOREIGN KEY ("storyBriefVersionId") REFERENCES "StoryBriefVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryBriefVersion" ADD CONSTRAINT "StoryBriefVersion_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryBriefAttempt" ADD CONSTRAINT "StoryBriefAttempt_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryBriefAttempt" ADD CONSTRAINT "StoryBriefAttempt_briefVersionId_fkey" FOREIGN KEY ("briefVersionId") REFERENCES "StoryBriefVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants enforced by the database, not only by code.
ALTER TABLE "StoryBriefVersion" ADD CONSTRAINT "chk_story_brief_version_state" CHECK ("state" IN ('READY', 'PARTIAL', 'INSUFFICIENT'));
ALTER TABLE "StoryBriefVersion" ADD CONSTRAINT "chk_story_brief_version_number" CHECK ("version" >= 1 AND "materialVersion" >= 1);
ALTER TABLE "StoryBriefVersion" ADD CONSTRAINT "chk_story_brief_evidence_revision" CHECK ("evidenceRevision" ~ '^[0-9a-f]{64}$');
ALTER TABLE "StoryBriefAttempt" ADD CONSTRAINT "chk_story_brief_attempt_status" CHECK ("status" IN ('CHECKING', 'DONE', 'FAILED'));
ALTER TABLE "StoryBriefAttempt" ADD CONSTRAINT "chk_story_brief_attempt_failure" CHECK (
  ("status" = 'FAILED') = ("failureKind" IS NOT NULL)
  AND ("failureKind" IS NULL OR "failureKind" IN ('PROVIDER_DEGRADED', 'BUDGET_REFUSED', 'CAPABILITY_UNAVAILABLE', 'EXECUTION_FAILED', 'OUTCOME_UNKNOWN'))
);
ALTER TABLE "StoryBriefAttempt" ADD CONSTRAINT "chk_story_brief_attempt_done" CHECK (("status" = 'DONE') = ("briefVersionId" IS NOT NULL));

-- Dedup: at most ONE live claim per story + evidence revision (concurrent Read Brief / Discuss).
CREATE UNIQUE INDEX "StoryBriefAttempt_one_checking" ON "StoryBriefAttempt"("storyId", "evidenceRevision") WHERE "status" = 'CHECKING';

-- Append-only: a Brief version is never rewritten or deleted (a refresh appends n+1).
CREATE FUNCTION "story_brief_version_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'StoryBriefVersion is append-only (% refused)', TG_OP USING ERRCODE = 'check_violation';
END;
$$;
CREATE TRIGGER "story_brief_version_append_only" BEFORE UPDATE OR DELETE ON "StoryBriefVersion"
  FOR EACH ROW EXECUTE FUNCTION "story_brief_version_immutable"();
