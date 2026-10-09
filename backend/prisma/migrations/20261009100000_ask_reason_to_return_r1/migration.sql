-- ASK STANDALONE · REASON TO RETURN R1 (PO contract 2026-10-09) — ADDITIVE ONLY.
-- 1. Followed questions reuse the existing Briefing / BriefingVersion substrate (scope.kind
--    'ASK_QUESTION'); no second following store. A manual check is one append-only BriefingCheck
--    row: the reader's own Ask turn, our deterministic change assessment (codes + evidence
--    references only, never source text) and, when the check produced a usable changed reading,
--    the version it created. A failed or partial check is recorded and never touches a version.
-- 2. Briefing gains the PAUSED status (the CHECK is widened; no existing row changes).
-- 3. AskObservation gains three nullable retrieval-outcome columns (codes and counts only), so a
--    completed no-match, a provider failure and an all-filtered search are separable (§5).
-- BACKWARD: DOWN.sql (operator-run). Prefer the flags: ASK_BRIEFINGS_ENABLED unset hides the routes.

CREATE TABLE "BriefingCheck" (
    "id" TEXT NOT NULL,
    "briefingId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "assessment" JSONB NOT NULL,
    "baselineVersion" INTEGER,
    "resultingVersion" INTEGER,
    "checkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BriefingCheck_briefingId_turnId_key" ON "BriefingCheck"("briefingId", "turnId");
CREATE INDEX "BriefingCheck_briefingId_checkedAt_idx" ON "BriefingCheck"("briefingId", "checkedAt");

ALTER TABLE "BriefingCheck" ADD CONSTRAINT "BriefingCheck_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BriefingCheck" ADD CONSTRAINT "BriefingCheck_outcome_check" CHECK ("outcome" IN (
  'INCOMPLETE_CHECK', 'INSUFFICIENT_BASELINE', 'CORRECTION', 'MATERIAL_CHANGE',
  'NEW_EVIDENCE', 'UNCHANGED', 'NO_RELEVANT_UPDATE'));

ALTER TABLE "Briefing" DROP CONSTRAINT "Briefing_status_check";
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_status_check" CHECK ("status" IN ('ACTIVE', 'PAUSED', 'ARCHIVED'));

ALTER TABLE "AskObservation" ADD COLUMN "retrievalOutcome" TEXT;
ALTER TABLE "AskObservation" ADD COLUMN "candidatesSeen" INTEGER;
ALTER TABLE "AskObservation" ADD COLUMN "candidatesAdmitted" INTEGER;
