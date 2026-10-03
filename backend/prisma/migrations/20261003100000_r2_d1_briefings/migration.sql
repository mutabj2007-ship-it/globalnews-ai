-- R2 · D1 (CTO checkpoint 3 ruling §10) — DURABLE BRIEFINGS. ADDITIVE ONLY: two new tables, no
-- existing table, column or rule changes (StoredResult stays expiring; AskBookmark stays a link).
-- A version stores OUR structured output + evidence REFERENCES, never source full text.
-- Private: every access is scoped by userId; User delete cascades; Briefing delete cascades.
-- NOT AUTHORIZED FOR PRODUCTION. Alpha only after CTO approval of the migration evidence.
-- BACKWARD (rollback): DROP TABLE "BriefingVersion"; DROP TABLE "Briefing";
--   (saved briefings are lost; prefer ASK_BRIEFINGS_ENABLED unset/false, which hides the routes).


-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingVersion" (
    "id" TEXT NOT NULL,
    "briefingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "asOf" TIMESTAMPTZ(6) NOT NULL,
    "windowFrom" TIMESTAMPTZ(6),
    "windowTo" TIMESTAMPTZ(6),
    "blocks" JSONB NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "evidenceRevision" TEXT NOT NULL,
    "coverageGaps" JSONB NOT NULL,
    "sourceTurnId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Briefing_userId_updatedAt_idx" ON "Briefing"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingVersion_briefingId_version_key" ON "BriefingVersion"("briefingId", "version");

-- AddForeignKey
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingVersion" ADD CONSTRAINT "BriefingVersion_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Governed values (the service validates too; the database refuses a bad row regardless).
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'));
ALTER TABLE "BriefingVersion" ADD CONSTRAINT "BriefingVersion_version_check" CHECK ("version" >= 1);
