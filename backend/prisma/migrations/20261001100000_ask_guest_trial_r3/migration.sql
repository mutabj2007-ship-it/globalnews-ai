-- ASK GUEST TRIAL + FIRST-ANSWER R3 — the first-visit guest as a real, separate owner.
--
-- ADDITIVE / RELAXING ONLY. New tables; three new nullable columns; "userId" becomes
-- nullable on AskThread, ComputeOperation and StoredResult. The prior backend always writes
-- "userId" and never reads "guestSessionId", so it keeps working against this schema, and
-- its `where: { userId: <string> }` predicates can never match a guest-owned row.
-- Rollback of code needs no schema rollback. Re-adding NOT NULL would first require the
-- guest rows to be purged; that is not planned.
-- AlterTable
ALTER TABLE "AskThread" ADD COLUMN     "guestSessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StoredResult" ADD COLUMN     "guestSessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ComputeOperation" ADD COLUMN     "guestSessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMPTZ(6),

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSlot" (
    "operationId" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RESERVED',
    "releaseReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMPTZ(6),

    CONSTRAINT "GuestSlot_pkey" PRIMARY KEY ("operationId")
);

-- CreateTable
CREATE TABLE "GuestClaim" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "consumedByUserId" TEXT,

    CONSTRAINT "GuestClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");

-- CreateIndex
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");

-- CreateIndex
CREATE INDEX "GuestSession_status_expiresAt_idx" ON "GuestSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "GuestSlot_guestSessionId_state_idx" ON "GuestSlot"("guestSessionId", "state");

-- CreateIndex
CREATE INDEX "GuestSlot_state_createdAt_idx" ON "GuestSlot"("state", "createdAt");

-- CreateIndex
CREATE INDEX "GuestClaim_guestSessionId_status_idx" ON "GuestClaim"("guestSessionId", "status");

-- CreateIndex
CREATE INDEX "GuestClaim_consumedByUserId_consumedAt_idx" ON "GuestClaim"("consumedByUserId", "consumedAt");

-- CreateIndex
CREATE INDEX "GuestClaim_expiresAt_idx" ON "GuestClaim"("expiresAt");

-- CreateIndex
CREATE INDEX "AskThread_guestSessionId_updatedAt_idx" ON "AskThread"("guestSessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AskThread_guestSessionId_clientKey_key" ON "AskThread"("guestSessionId", "clientKey");

-- CreateIndex
CREATE INDEX "StoredResult_guestSessionId_fingerprint_expiresAt_idx" ON "StoredResult"("guestSessionId", "fingerprint", "expiresAt");

-- CreateIndex
CREATE INDEX "ComputeOperation_guestSessionId_createdAt_idx" ON "ComputeOperation"("guestSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComputeOperation_guestSessionId_clientKey_key" ON "ComputeOperation"("guestSessionId", "clientKey");

-- AddForeignKey
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredResult" ADD CONSTRAINT "StoredResult_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSlot" ADD CONSTRAINT "GuestSlot_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ComputeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSlot" ADD CONSTRAINT "GuestSlot_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestClaim" ADD CONSTRAINT "GuestClaim_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly ONE owner per row: an account or a guest session, never both, never neither.
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_exactly_one_owner"
  CHECK (num_nonnulls("userId", "guestSessionId") = 1);
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_exactly_one_owner"
  CHECK (num_nonnulls("userId", "guestSessionId") = 1);
ALTER TABLE "StoredResult" ADD CONSTRAINT "StoredResult_exactly_one_owner"
  CHECK (num_nonnulls("userId", "guestSessionId") = 1);

-- Bounded vocabularies for the state machines.
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_status_check"
  CHECK ("status" IN ('ACTIVE', 'CLAIMED', 'REVOKED'));
ALTER TABLE "GuestSlot" ADD CONSTRAINT "GuestSlot_state_check"
  CHECK ("state" IN ('RESERVED', 'COMMITTED', 'RELEASED'));
ALTER TABLE "GuestSlot" ADD CONSTRAINT "GuestSlot_release_reason_check"
  CHECK (("state" = 'RELEASED') = ("releaseReason" IS NOT NULL)
     AND ("releaseReason" IS NULL OR "releaseReason" IN ('NO_ANSWER', 'FAILED', 'REFUSED')));
ALTER TABLE "GuestClaim" ADD CONSTRAINT "GuestClaim_status_check"
  CHECK ("status" IN ('PENDING', 'CONSUMED', 'EXPIRED'));
