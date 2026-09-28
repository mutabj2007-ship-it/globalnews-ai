-- MY INTELLIGENCE — INTEREST + SELECTION HOOK R1 — explicit reader interests.
--
-- ADDITIVE ONLY. One new table; no existing table, row or column is touched.
-- `interest` is constrained to the governed vocabulary
-- (MY_INTELLIGENCE_INTERESTS in shared/src/my-intelligence.ts): never free text.

-- CreateTable
CREATE TABLE "UserIntelligenceInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIntelligenceInterest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserIntelligenceInterest_governed_interest" CHECK ("interest" IN (
        'politics_governance', 'security_conflict', 'economy_markets', 'diplomacy',
        'humanitarian_society', 'energy_infrastructure', 'technology', 'regional_affairs',
        'health_science', 'sports', 'entertainment'
    ))
);

-- CreateIndex
CREATE UNIQUE INDEX "UserIntelligenceInterest_userId_interest_key" ON "UserIntelligenceInterest"("userId", "interest");

-- CreateIndex
CREATE INDEX "UserIntelligenceInterest_userId_idx" ON "UserIntelligenceInterest"("userId");

-- AddForeignKey
ALTER TABLE "UserIntelligenceInterest" ADD CONSTRAINT "UserIntelligenceInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
