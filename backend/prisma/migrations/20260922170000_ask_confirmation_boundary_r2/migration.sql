-- R2: ordinary work has no Sand confirmation requirement and no fabricated
-- acceptedAt. Preserve explicit consent for deep/report execution. The R1
-- SandLedgerEntry_charging_off constraint remains untouched.
BEGIN;
ALTER TABLE "ComputeOperation" DROP CONSTRAINT "ComputeOperation_acceptance";
ALTER TABLE "ComputeOperation" ADD CONSTRAINT "ComputeOperation_acceptance" CHECK (
  ("status" <> 'ACCEPTED' OR "acceptedAt" IS NOT NULL)
  AND (
    "computeClass" NOT IN ('DEEP_ANALYSIS', 'RESEARCH_REPORT')
    OR "status" NOT IN ('RESERVED', 'RUNNING', 'COMPLETED', 'REFUNDED')
    OR "acceptedAt" IS NOT NULL
  )
);
COMMIT;
