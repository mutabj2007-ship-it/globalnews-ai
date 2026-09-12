-- SITUATION MEMORY — S1-R2.
--
-- FIVE NEW TABLES. NO EXISTING TABLE IS ALTERED, DROPPED OR RENAMED, AND NO
-- EXISTING COLUMN, INDEX OR CONSTRAINT IS TOUCHED. `AnalysisRun` in particular
-- is untouched: it is telemetry, one row per analysis REQUEST, and every Admin
-- figure is a count or aggregate over rows carrying that meaning. Writing this
-- store's results into it would change what one row MEANS, and every one of
-- those figures would change with it without a line of admin-analytics.service.ts
-- being edited.
--
-- WHAT CHANGED FROM S1, AND WHY IT MATTERS. S1 declared `Situation.key UNIQUE`,
-- assuming the key identified a situation. G's ratified contract establishes
-- that it is a coarse PARTITION: `sit:v1:RWA` holds every Rwandan situation.
-- A unique index there would have forced every Rwandan situation into one row —
-- a false merge manufactured by a constraint instead of caught by tier 2.
-- The column is now `partitionKey`, indexed and NOT unique, and identity is the
-- triple (partitionKey, keyVersion, discriminator).
--
-- NO PERSONAL DATA. No table below carries a userId, sessionId or email column,
-- and no foreign key leaves the Situation family. DELETE /users/me therefore
-- remains the single-operation cascade it already is.
--
-- NO BACKFILL. Nothing here writes a row. Every row is written by an observation.
--
-- ROLLBACK: see DOWN.sql, beside this file — the repository's own convention,
-- the precedent set by 20260821090500_add_admin_role and
-- 20260822053000_add_support_tickets. (This header previously pointed at
-- rollback/20260901050000_add_situation_memory.down.sql, a path that never
-- existed in the accepted package; corrected under E1 C895 review item D-2.)
--
-- It drops the five tables in reverse dependency order, AND the three foreign
-- keys, the CHECK constraint, the trigger and the schema-level plpgsql function
-- "situation_identity_is_assign_once" — which does NOT go with its table and
-- would otherwise survive a rollback (E1 D-1).

-- CreateTable
CREATE TABLE "Situation" (
    "id" TEXT NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "discriminator" TEXT NOT NULL,
    "discriminatorBasis" TEXT NOT NULL,
    "seedArticleUrl" TEXT NOT NULL,
    "seedObservedAt" TIMESTAMP(3) NOT NULL,
    "countryCode" TEXT,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRetrievedAt" TIMESTAMP(3),
    "lastAnalysedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Situation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituationSnapshot" (
    "id" TEXT NOT NULL,
    "situationId" TEXT NOT NULL,
    "analysedAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "analysisRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituationCluster" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "clusterKey" TEXT NOT NULL,
    "publisherCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituationCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituationClusterMember" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituationClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituationShadowDecision" (
    "id" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "observationUrl" TEXT NOT NULL,
    "candidateSituationId" TEXT,
    "candidateDiscriminator" TEXT,
    "anchorArticleUrl" TEXT,
    "score" DOUBLE PRECISION,
    "recommendation" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyThreshold" DOUBLE PRECISION NOT NULL,
    "shadowOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituationShadowDecision_pkey" PRIMARY KEY ("id")
);

-- THE IDENTITY CONSTRAINT. It is the TRIPLE, not the key: many situations may
-- share a partition, none may share the full triple.
-- CreateIndex
CREATE UNIQUE INDEX "Situation_partitionKey_keyVersion_discriminator_key" ON "Situation"("partitionKey", "keyVersion", "discriminator");

-- The bounded lookup: the situations in this observation's bucket, at this key
-- version. NOT UNIQUE, on purpose.
-- CreateIndex
CREATE INDEX "Situation_partitionKey_keyVersion_idx" ON "Situation"("partitionKey", "keyVersion");

-- CreateIndex
CREATE INDEX "Situation_countryCode_idx" ON "Situation"("countryCode");

-- CreateIndex
CREATE INDEX "Situation_lastAnalysedAt_idx" ON "Situation"("lastAnalysedAt");

-- CreateIndex
CREATE INDEX "SituationSnapshot_situationId_analysedAt_idx" ON "SituationSnapshot"("situationId", "analysedAt");

-- CreateIndex
CREATE INDEX "SituationSnapshot_analysedAt_idx" ON "SituationSnapshot"("analysedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SituationCluster_snapshotId_clusterKey_key" ON "SituationCluster"("snapshotId", "clusterKey");

-- CreateIndex
CREATE UNIQUE INDEX "SituationClusterMember_clusterId_articleUrl_key" ON "SituationClusterMember"("clusterId", "articleUrl");

-- CreateIndex
CREATE INDEX "SituationClusterMember_articleUrl_idx" ON "SituationClusterMember"("articleUrl");

-- CreateIndex
CREATE INDEX "SituationShadowDecision_partitionKey_keyVersion_decidedAt_idx" ON "SituationShadowDecision"("partitionKey", "keyVersion", "decidedAt");

-- CreateIndex
CREATE INDEX "SituationShadowDecision_decidedAt_idx" ON "SituationShadowDecision"("decidedAt");

-- CreateIndex
CREATE INDEX "SituationShadowDecision_candidateSituationId_idx" ON "SituationShadowDecision"("candidateSituationId");

-- AddForeignKey  (the ONLY three foreign keys, all internal to this family)
ALTER TABLE "SituationSnapshot" ADD CONSTRAINT "SituationSnapshot_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituationCluster" ADD CONSTRAINT "SituationCluster_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SituationSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituationClusterMember" ADD CONSTRAINT "SituationClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SituationCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- TWO GUARANTEES PRISMA CANNOT EXPRESS, ENFORCED BY THE DATABASE ITSELF.
--
-- Both are requirements the CTO stated in prose. Prose in a comment is a
-- promise; a constraint is a guarantee. Each is a single object and each is
-- dropped by one line in the rollback script.
-- ============================================================================

-- 1. SHADOW MEANS SHADOW. A shadow decision cannot be promoted to authoritative
--    by an UPDATE somebody believed was harmless.
ALTER TABLE "SituationShadowDecision"
  ADD CONSTRAINT "SituationShadowDecision_shadowOnly_check" CHECK ("shadowOnly" = true);

-- 2. THE DISCRIMINATOR IS ASSIGN-ONCE, AND SO IS ITS PARTITION AND VERSION.
--    G's invariant 2 says the discriminator is assigned once at creation and
--    never recomputed. Enforcing that only in the repository means it holds
--    until somebody writes a second writer. This trigger means it holds.
--
--    partitionKey and keyVersion are immutable for the same reason: a situation
--    that changed bucket or key version in place would silently re-partition
--    history that was recorded under the old one. Re-partitioning after a
--    version bump is a migration with an explicit mapping, not an UPDATE.
CREATE OR REPLACE FUNCTION "situation_identity_is_assign_once"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."discriminator" IS DISTINCT FROM OLD."discriminator"
     OR NEW."discriminatorBasis" IS DISTINCT FROM OLD."discriminatorBasis"
     OR NEW."partitionKey" IS DISTINCT FROM OLD."partitionKey"
     OR NEW."keyVersion" IS DISTINCT FROM OLD."keyVersion"
     OR NEW."seedArticleUrl" IS DISTINCT FROM OLD."seedArticleUrl"
     OR NEW."seedObservedAt" IS DISTINCT FROM OLD."seedObservedAt"
     OR NEW."firstObservedAt" IS DISTINCT FROM OLD."firstObservedAt"
  THEN
    RAISE EXCEPTION
      'Situation identity is assign-once: discriminator, discriminatorBasis, partitionKey, keyVersion, seedArticleUrl, seedObservedAt and firstObservedAt cannot be changed after creation (situation id %)', OLD."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "situation_identity_assign_once"
  BEFORE UPDATE ON "Situation"
  FOR EACH ROW EXECUTE FUNCTION "situation_identity_is_assign_once"();
