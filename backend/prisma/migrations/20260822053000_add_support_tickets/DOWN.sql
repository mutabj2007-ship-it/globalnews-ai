-- =====================================================================
-- MANUAL RECOVERY REFERENCE ONLY — NOT A PRISMA MIGRATION.
--
-- Prisma Migrate has no automatic "down"; the supported way to reverse
-- an applied migration is a NEW forward migration. This file exists so
-- that an operator recovering an isolated or rehearsal database has the
-- exact reversal to hand, and it follows the precedent set by
-- 20260821090500_add_admin_role/DOWN.sql.
--
-- DO NOT RUN THIS AGAINST A DATABASE HOLDING REAL SUPPORT TICKETS.
-- Unlike the admin-role reversal, this one is DESTRUCTIVE: dropping the
-- tables discards every ticket and every message, including any
-- abuse report, permanently and with no way back.
--
-- Order matters: SupportMessage references SupportTicket, and
-- SupportTicket references User, so the dependent table goes first.
-- =====================================================================

-- DropForeignKey
ALTER TABLE "SupportMessage" DROP CONSTRAINT "SupportMessage_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_userId_fkey";

-- DropTable
DROP TABLE "SupportMessage";

-- DropTable
DROP TABLE "SupportTicket";

-- DropEnum
DROP TYPE "SupportAuthorType";

-- DropEnum
DROP TYPE "SupportMessageVisibility";

-- DropEnum
DROP TYPE "SupportTicketStatus";

-- DropEnum
DROP TYPE "SupportCategory";
