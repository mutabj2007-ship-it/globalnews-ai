-- ════════════════════════════════════════════════════════════════════════════
-- ASK CONTINUITY R1 — ASK BOOKMARK
-- STATUS: UNVALIDATED UNTIL PRISMA ENGINE CHECK. NOT MIGRATION-SAFE YET.
-- ════════════════════════════════════════════════════════════════════════════
-- Authority: ASK GLOBALNEWSAI — RECENT + SAVED CONTINUITY R1 (Product Owner, 2026-09-29),
-- corrected by CTO ASK CONTINUITY REBASE + PUBLICATION R2.
-- Baseline: release/alpha-m08-integrated-r1 @ a6b329d (PR #66).
--
-- CLASS: ADDITIVE — one new table, one unique constraint, one index, two foreign
-- keys onto EXISTING tables ("User", "AskTurn"). No existing table is altered,
-- dropped or renamed and no existing column changes type.
--
-- HAND-AUTHORED, AND WHY: `prisma migrate diff` could not be run in this
-- environment — the schema engine download is refused by the egress proxy
-- (403 Forbidden, binaries.prisma.sh). The same failure reproduces on the
-- UNMODIFIED canonical schema, so it is environmental and pre-existing, not a
-- product of this change. The SQL below is therefore written by hand to match
-- the objects the Prisma model declares, and `prisma validate` / `migrate diff`
-- must be re-run by a lane whose environment can reach the engine before this
-- migration is trusted. IT IS UNVALIDATED UNTIL PRISMA ENGINE CHECK and is not
-- claimed to be migration-safe. The 403 control was re-run at a6b329d.
--
-- WHY A RELATION AND NOT A COPY: the question lives on "AskTurn"."question" and
-- the answer is reached through that turn's "ComputeOperation" -> "StoredResult".
-- Copying either here would create a second copy of canonical Ask content that
-- could drift from it, and would outlive "StoredResult"."expiresAt" — a bookmark
-- must not become a way to keep an expired artifact readable.
--
-- CASCADE: deleting the account removes the bookmark, and so does deleting the
-- turn. Neither leaves a row pointing at content that no longer exists. Account
-- deletion therefore needs no bespoke cleanup path.
--
-- APPLIED: never, outside a private loopback test cluster. Applying to any
-- deployed environment is a separate Product Owner authorisation.

-- CreateTable
CREATE TABLE "AskBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One bookmark per reader per turn: this is what makes "bookmark" idempotent
-- rather than a counter, and what lets an unbookmark be addressed by (user, turn).
CREATE UNIQUE INDEX "AskBookmark_userId_turnId_key" ON "AskBookmark"("userId", "turnId");

-- CreateIndex
-- The Saved listing reads newest-first for one owner only.
CREATE INDEX "AskBookmark_userId_createdAt_idx" ON "AskBookmark"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AskBookmark" ADD CONSTRAINT "AskBookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskBookmark" ADD CONSTRAINT "AskBookmark_turnId_fkey"
    FOREIGN KEY ("turnId") REFERENCES "AskTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
