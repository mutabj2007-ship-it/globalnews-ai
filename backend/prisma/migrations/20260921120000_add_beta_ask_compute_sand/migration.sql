-- CreateTable
CREATE TABLE "StoredResult" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "computeClass" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "evidenceRevision" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reuseCount" INTEGER NOT NULL DEFAULT 0,
    "lastReusedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "StoredResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComputeOperation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "computeClass" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "ownerKind" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "quotedSand" INTEGER NOT NULL DEFAULT 0,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "entitlementState" TEXT NOT NULL,
    "executionStatus" TEXT NOT NULL DEFAULT 'QUOTED',
    "quoteExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "storedResultId" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "retrievalCalls" INTEGER,
    "providerRequests" INTEGER,
    "evidenceCount" INTEGER,
    "durationMs" INTEGER,
    "cacheHit" BOOLEAN,
    "storedResultReused" BOOLEAN NOT NULL DEFAULT false,
    "failureType" TEXT,
    "estimatedCostMicroUsd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ComputeOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandLedgerEntry" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "quotedSand" INTEGER NOT NULL DEFAULT 0,
    "reservedSand" INTEGER NOT NULL DEFAULT 0,
    "finalSand" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskThread" (
    "id" TEXT NOT NULL,
    "ownerKind" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AskThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskTurn" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "question" TEXT,
    "answer" JSONB,
    "status" TEXT NOT NULL,
    "computeClass" TEXT,
    "storedResultReused" BOOLEAN NOT NULL DEFAULT false,
    "operationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredResult_fingerprint_key" ON "StoredResult"("fingerprint");

-- CreateIndex
CREATE INDEX "StoredResult_evidenceRevision_idx" ON "StoredResult"("evidenceRevision");

-- CreateIndex
CREATE INDEX "StoredResult_countryCode_idx" ON "StoredResult"("countryCode");

-- CreateIndex
CREATE INDEX "StoredResult_expiresAt_idx" ON "StoredResult"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComputeOperation_idempotencyKey_key" ON "ComputeOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ComputeOperation_ownerKey_idx" ON "ComputeOperation"("ownerKey");

-- CreateIndex
CREATE INDEX "ComputeOperation_userId_idx" ON "ComputeOperation"("userId");

-- CreateIndex
CREATE INDEX "ComputeOperation_executionStatus_idx" ON "ComputeOperation"("executionStatus");

-- CreateIndex
CREATE INDEX "ComputeOperation_createdAt_idx" ON "ComputeOperation"("createdAt");

-- CreateIndex
CREATE INDEX "ComputeOperation_computeClass_idx" ON "ComputeOperation"("computeClass");

-- CreateIndex
CREATE INDEX "SandLedgerEntry_operationId_idx" ON "SandLedgerEntry"("operationId");

-- CreateIndex
CREATE INDEX "SandLedgerEntry_userId_idx" ON "SandLedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "SandLedgerEntry_entryType_idx" ON "SandLedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "SandLedgerEntry_createdAt_idx" ON "SandLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "AskThread_ownerKey_idx" ON "AskThread"("ownerKey");

-- CreateIndex
CREATE INDEX "AskThread_userId_idx" ON "AskThread"("userId");

-- CreateIndex
CREATE INDEX "AskThread_updatedAt_idx" ON "AskThread"("updatedAt");

-- CreateIndex
CREATE INDEX "AskTurn_threadId_idx" ON "AskTurn"("threadId");

-- CreateIndex
CREATE INDEX "AskTurn_operationId_idx" ON "AskTurn"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "AskTurn_threadId_sequence_key" ON "AskTurn"("threadId", "sequence");

-- AddForeignKey
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_storedResultId_fkey" FOREIGN KEY ("storedResultId") REFERENCES "StoredResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandLedgerEntry" ADD CONSTRAINT "SandLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ComputeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandLedgerEntry" ADD CONSTRAINT "SandLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AskThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ComputeOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
