-- CreateTable
CREATE TABLE "AskThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "returnPath" TEXT,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AskThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskTurn" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "evidenceRevision" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComputeOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "computeClass" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "quotedSand" INTEGER NOT NULL DEFAULT 0,
    "ledgerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'QUOTED',
    "quoteExpiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "runToken" TEXT,
    "storedResultId" TEXT,
    "storedResultReused" BOOLEAN NOT NULL DEFAULT false,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ComputeOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandLedgerEntry" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "quotedSand" INTEGER NOT NULL DEFAULT 0,
    "reservedSand" INTEGER NOT NULL DEFAULT 0,
    "finalSand" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AskThread_userId_updatedAt_idx" ON "AskThread"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AskThread_userId_clientKey_key" ON "AskThread"("userId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "AskTurn_operationId_key" ON "AskTurn"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "AskTurn_threadId_sequence_key" ON "AskTurn"("threadId", "sequence");

-- CreateIndex
CREATE INDEX "StoredResult_userId_fingerprint_expiresAt_idx" ON "StoredResult"("userId", "fingerprint", "expiresAt");

-- CreateIndex
CREATE INDEX "ComputeOperation_userId_createdAt_idx" ON "ComputeOperation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComputeOperation_userId_clientKey_key" ON "ComputeOperation"("userId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "SandLedgerEntry_operationId_entryType_key" ON "SandLedgerEntry"("operationId", "entryType");

-- AddForeignKey
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AskThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ComputeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredResult" ADD CONSTRAINT "StoredResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_storedResultId_fkey" FOREIGN KEY ("storedResultId") REFERENCES "StoredResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandLedgerEntry" ADD CONSTRAINT "SandLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ComputeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- R1 hard hold: even direct SQL cannot reserve or charge real Sand.
ALTER TABLE "SandLedgerEntry" ADD CONSTRAINT "SandLedgerEntry_charging_off" CHECK ("reservedSand" = 0 AND "finalSand" = 0);
ALTER TABLE "SandLedgerEntry" ADD CONSTRAINT "SandLedgerEntry_type" CHECK ("entryType" IN ('QUOTE', 'RESERVE', 'SETTLE', 'RELEASE', 'REFUND'));
ALTER TABLE "SandLedgerEntry" ADD CONSTRAINT "SandLedgerEntry_quote_nonnegative" CHECK ("quotedSand" >= 0);
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_class" CHECK ("computeClass" IN ('STORED', 'CONTEXTUAL', 'FRESH_BOUNDED', 'DEEP_ANALYSIS', 'RESEARCH_REPORT'));
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_status" CHECK ("status" IN ('QUOTED', 'ACCEPTED', 'RESERVED', 'RUNNING', 'COMPLETED', 'RELEASED', 'REFUNDED'));
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_quote_nonnegative" CHECK ("quotedSand" >= 0);
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_acceptance" CHECK ("status" NOT IN ('ACCEPTED', 'RESERVED', 'RUNNING', 'COMPLETED', 'REFUNDED') OR "acceptedAt" IS NOT NULL);
ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_language" CHECK ("language" IN ('en', 'pl'));
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_language" CHECK ("language" IN ('en', 'pl'));
ALTER TABLE "AskTurn" ADD CONSTRAINT "AskTurn_sequence_positive" CHECK ("sequence" > 0);
