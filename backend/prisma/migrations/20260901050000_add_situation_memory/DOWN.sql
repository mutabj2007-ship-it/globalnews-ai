-- =====================================================================
-- MANUAL RECOVERY REFERENCE ONLY — NOT A PRISMA MIGRATION.
--
-- Reverses 20260901050000_add_situation_memory.
--
-- Authored by MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1 and HARDENED under the
-- E1 C895 migration review (D-1, D-3). Prisma Migrate has no automatic "down";
-- the supported way to reverse an applied migration is a NEW forward migration.
-- This file exists so an operator recovering an isolated or rehearsal database
-- has the exact reversal to hand.
--
-- ── D-1: THE FUNCTION IS THE OBJECT THAT SURVIVES ────────────────────────────
--
-- The first draft of this file dropped the three foreign keys and the five
-- tables and stopped, on the reasoning that dropping a table drops its own
-- constraints and triggers. That is true, and it is exactly why the gap was
-- easy to miss: the TRIGGER goes with "Situation", but
-- `situation_identity_is_assign_once()` is a SCHEMA-level function and would
-- have survived a "complete" rollback. Re-running the forward migration then
-- silently reuses a leftover definition — `CREATE OR REPLACE FUNCTION` does not
-- complain — so a stale function could outlive the migration that created it
-- and still be wired to the new trigger. E1 caught it; it is dropped explicitly
-- below.
--
-- ── D-3: SAFELY RE-RUNNABLE, WITHOUT WEAKENING ORDER ─────────────────────────
--
-- Every statement is guarded, so running this twice, or against a database
-- where the migration was only partially applied, is not an error.
--
-- `ALTER TABLE IF EXISTS … DROP CONSTRAINT IF EXISTS` needs BOTH guards: the
-- constraint guard alone still fails when the table is gone.
--
-- The trigger drop needs a DO block rather than `DROP TRIGGER IF EXISTS … ON
-- "Situation"`, because PostgreSQL's IF EXISTS there covers the TRIGGER, not
-- the TABLE — that statement still raises `relation "Situation" does not exist`
-- on a second run. `to_regclass` is the check that makes it safe.
--
-- ORDERING IS UNCHANGED AND IS NOT NEGOTIABLE: dependants before dependencies.
-- Trigger and function first (while "Situation" is still there), then the three
-- foreign keys, then the tables in reverse dependency order —
-- SituationClusterMember → SituationCluster → SituationSnapshot → Situation.
-- SituationShadowDecision carries no foreign key and may be dropped anywhere.
--
-- ── WHAT THIS IS SAFE TO DO, AND WHERE IT IS NOT ─────────────────────────────
--
-- The forward migration creates five NEW tables and alters no existing one, so
-- reversing it cannot touch a single pre-existing row: Article, AnalysisRun,
-- User and every other table are untouched in both directions. WITHIN the
-- Situation family this IS destructive — every observed situation, snapshot,
-- cluster and shadow decision is discarded permanently.
--
-- Nothing else needs undoing, because nothing else was done: the forward
-- migration creates no enum, adds no column to an existing table, writes no
-- backfill, and leaves no foreign key pointing outside the Situation family.
-- =====================================================================

-- DropTrigger — guarded on the TABLE, not only on the trigger (see D-3 above).
DO $$
BEGIN
  IF to_regclass('"Situation"') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS "situation_identity_assign_once" ON "Situation";
  END IF;
END
$$;

-- DropFunction — D-1. Schema-level; it does NOT go with the table.
DROP FUNCTION IF EXISTS "situation_identity_is_assign_once"();

-- DropConstraint — the CHECK. Dropped explicitly so the forward migration's own
-- claim holds: "each is dropped by one line in the rollback script".
ALTER TABLE IF EXISTS "SituationShadowDecision"
  DROP CONSTRAINT IF EXISTS "SituationShadowDecision_shadowOnly_check";

-- DropForeignKey
ALTER TABLE IF EXISTS "SituationClusterMember"
  DROP CONSTRAINT IF EXISTS "SituationClusterMember_clusterId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "SituationCluster"
  DROP CONSTRAINT IF EXISTS "SituationCluster_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "SituationSnapshot"
  DROP CONSTRAINT IF EXISTS "SituationSnapshot_situationId_fkey";

-- DropTable — reverse dependency order.
DROP TABLE IF EXISTS "SituationClusterMember";

-- DropTable
DROP TABLE IF EXISTS "SituationCluster";

-- DropTable
DROP TABLE IF EXISTS "SituationSnapshot";

-- DropTable — no foreign key; order-independent.
DROP TABLE IF EXISTS "SituationShadowDecision";

-- DropTable
DROP TABLE IF EXISTS "Situation";
