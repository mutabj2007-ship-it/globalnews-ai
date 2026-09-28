-- ════════════════════════════════════════════════════════════════════════════
-- ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — PUBLIC ASK OPERATIONAL CONTROLS
-- ════════════════════════════════════════════════════════════════════════════
-- Authority: F-ASK-R2-PUBLIC-ASK-OPERATIONAL-CONTROLS-CLOSURE-R1 (01 L-8..L-24, 02 §10, 03).
-- CLASS: ADDITIVE — five new tables and two indexes; no existing table altered, dropped
-- or renamed; no foreign key to any existing table. Generated with `prisma migrate diff`
-- and reduced to exactly these objects: the diff also reported pre-existing
-- ConflictObservation identifier-length drift, which is NOT this change and is excluded.
-- APPLIED: never, outside the private loopback test cluster. Applying to Alpha is a
-- separate Product Owner authorisation (contract §23).

-- CreateTable
CREATE TABLE "ComputeMeter" (
    "scope" TEXT NOT NULL,
    "bucketStart" TIMESTAMPTZ(6) NOT NULL,
    "units" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ComputeMeter_pkey" PRIMARY KEY ("scope","bucketStart")
);

-- CreateTable
CREATE TABLE "ComputeReservation" (
    "id" TEXT NOT NULL,
    "charges" JSONB NOT NULL,
    "units" BIGINT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "settledAt" TIMESTAMPTZ(6),
    "outcome" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComputeReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitBreakerState" (
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CLOSED',
    "openUntil" TIMESTAMPTZ(6),
    "cooldownS" INTEGER NOT NULL DEFAULT 30,
    "trialsInFlight" INTEGER NOT NULL DEFAULT 0,
    "trialSuccesses" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircuitBreakerState_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "OperationalSwitch" (
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "setBy" TEXT NOT NULL,
    "setAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "OperationalSwitch_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "OperationalSwitchAudit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "setBy" TEXT NOT NULL,
    "reason" TEXT,
    "setAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalSwitchAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComputeReservation_settledAt_expiresAt_idx" ON "ComputeReservation"("settledAt", "expiresAt");

-- CreateIndex
CREATE INDEX "OperationalSwitchAudit_name_setAt_idx" ON "OperationalSwitchAudit"("name", "setAt");
