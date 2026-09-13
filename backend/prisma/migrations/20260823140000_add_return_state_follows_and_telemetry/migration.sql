-- R1 + R3 — return state, country follow, and the telemetry foundation.
--
-- ONE ORDERED MIGRATION FOR ALL THREE TASKS, so a rollback is a single
-- coherent step rather than three interleaved ones.
--
-- ADDITIVE ONLY. There is no UPDATE, no DELETE, no DROP, no column type
-- change and no DEFAULT on the new User column anywhere below, so not one
-- existing row is touched and every pre-existing user is lastSeenAt NULL —
-- which the service reads as "make no return claim".

-- AlterTable
-- R1/T2. Nullable with NO DEFAULT: a pre-existing row must not be given a
-- fabricated first observation.
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
-- R1/T3.
CREATE TABLE "CountryFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountryFollow_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
-- R3/T7.
CREATE TYPE "ProductEventName" AS ENUM ('today_view', 'today_item_open', 'country_filter', 'world_map_open', 'analysis_started', 'analysis_completed', 'evidence_open', 'source_open', 'follow_created', 'follow_removed', 'return_visit', 'language_selected');

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "name" "ProductEventName" NOT NULL,
    "userId" TEXT,
    "countryCode" TEXT,
    "language" TEXT,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "cached" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountryFollow_userId_idx" ON "CountryFollow"("userId");

-- CreateIndex
-- The composite unique is what makes a repeat follow a database-level
-- no-op rather than a matter of application politeness.
CREATE UNIQUE INDEX "CountryFollow_userId_countryCode_key" ON "CountryFollow"("userId", "countryCode");

-- CreateIndex
CREATE INDEX "ProductEvent_name_createdAt_idx" ON "ProductEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_createdAt_idx" ON "AnalysisRun"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_provider_createdAt_idx" ON "AnalysisRun"("provider", "createdAt");

-- AddForeignKey
-- CASCADE: a follow is account-owned, so DELETE /users/me removes it in the
-- same single database operation as every other account-owned table.
ALTER TABLE "CountryFollow" ADD CONSTRAINT "CountryFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, not CASCADE (CTO decision): deleting an account severs the link
-- to the person while leaving aggregate history true.
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
