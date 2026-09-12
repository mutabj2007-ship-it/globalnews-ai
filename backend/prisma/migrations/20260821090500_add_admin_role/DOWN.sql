-- Milestone F1.a — MANUAL RECOVERY REFERENCE ONLY.
--
-- Prisma Migrate does NOT execute this file and has no automatic
-- down-migration. It is documentation, not a rollback button, and
-- this comment exists so nobody mistakes it for one.
--
-- The SUPPORTED reversion is a NEW forward migration containing
-- exactly these statements, applied with `prisma migrate deploy` like
-- any other migration.
--
-- If 20260821090500_add_admin_role has only ever been applied to a
-- development database, the clean path is instead:
--     npx prisma migrate resolve --rolled-back 20260821090500_add_admin_role
-- followed by deleting this migration directory.
--
-- DATA IMPACT: none for ordinary users. "User"."adminRole" is nullable
-- with no default and F1.a ships no code path that writes it, so every
-- row holds NULL except those granted deliberately at database level.
-- The only information destroyed is the set of administrator grants —
-- which is precisely what reverting this migration is meant to destroy.

DROP INDEX "User_adminRole_idx";
ALTER TABLE "User" DROP COLUMN "adminRole";
DROP TYPE "AdminRole";
