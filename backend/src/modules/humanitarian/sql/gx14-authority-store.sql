-- ════════════════════════════════════════════════════════════════════════════
-- GX-14 · THE TWO STORES, THE FOUR ROLES, AND THE GRANTS THAT ARE THE CONTROL
-- ════════════════════════════════════════════════════════════════════════════
--
-- ALPHA-HUMANITARIAN-GX14-AUTHORITY-STORE-R1.
--
-- E1: "The subject of this assertion is a DB GRANT, not a filter — a redaction is a
-- control in the same process as the thing it redacts."
--
-- That is why this file exists and why it is SQL rather than Prisma models. The
-- security property is not expressible in an ORM: it is the absence of a privilege
-- held by a role that the reader process authenticates as. Prisma manages `public`;
-- these are two separate schemas with separate owners, and Prisma never sees them.
--
-- NOT APPLIED ANYWHERE. This script is executed only by the live-Postgres proof against
-- a disposable local database. No Alpha, no Production, no migration deployment.
--
-- ── WHY TWO SCHEMAS AND NOT TWO TABLES ────────────────────────────────────
--
-- GA-38 requires "distinct databases or distinct schemas with distinct owners, NOT two
-- tables in one schema behind an application filter". The difference is what happens
-- when the application is wrong: an application filter fails open the moment someone
-- writes a query that forgets it, and every ORM makes writing that query easy. A schema
-- the reader role has no USAGE on cannot be queried by a mistake.

-- ── ROLES ──────────────────────────────────────────────────────────────────
-- NOLOGIN group roles; the proof grants them to login roles it creates per run.

CREATE ROLE hum_authority_writer NOLOGIN;
CREATE ROLE hum_projection_writer NOLOGIN;
CREATE ROLE hum_reader_role NOLOGIN;
CREATE ROLE hum_producer_role NOLOGIN;

-- ── SCHEMAS, WITH DISTINCT OWNERS ──────────────────────────────────────────

CREATE SCHEMA hum_authority AUTHORIZATION hum_authority_writer;
CREATE SCHEMA hum_reader AUTHORIZATION hum_projection_writer;

-- PUBLIC is stripped first and explicitly. A privilege nobody granted is still a
-- privilege if PUBLIC has it by default, and that is the usual way a "no access" claim
-- turns out to be false.
REVOKE ALL ON SCHEMA hum_authority FROM PUBLIC;
REVOKE ALL ON SCHEMA hum_reader FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════════════
-- THE AUTHORITY STORE — full-resolution geometry, and the governed declarations
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE hum_authority.protected_class (
  class_id              text PRIMARY KEY,
  declared_at           timestamptz NOT NULL,
  basis                 text NOT NULL,
  partition_unit_level  text NOT NULL
);

CREATE TABLE hum_authority.protected_partition (
  partition_key                  text PRIMARY KEY,
  unit_level                     text NOT NULL,
  declared_at                    timestamptz NOT NULL,
  minimum_membership             integer NOT NULL,
  declared_eligible_membership   integer NOT NULL,
  covers_class_ids               text[] NOT NULL,

  -- AS-E1-5 · the cohort must be derivable by a third party from a PUBLISHED register.
  -- These four columns are what make that claim checkable rather than asserted: a
  -- declaration that cannot name its register and predicate cannot be inserted.
  register_id                    text NOT NULL,
  register_edition               text NOT NULL,
  eligibility_predicate          text NOT NULL,
  -- AS-E1-6 §3 · the lag is measured against this, not against declared_at.
  authored_at                    timestamptz NOT NULL,

  CONSTRAINT protected_partition_minimum_membership_at_least_two
    CHECK (minimum_membership >= 2),
  CONSTRAINT protected_partition_eligibility_not_short
    CHECK (declared_eligible_membership >= minimum_membership),
  CONSTRAINT protected_partition_covers_something
    CHECK (array_length(covers_class_ids, 1) >= 1),
  CONSTRAINT protected_partition_derivation_stated
    CHECK (register_id <> '' AND register_edition <> '' AND eligibility_predicate <> '')
);

-- Full-resolution geometry, INCLUDING every protected record. This is the table the
-- reader role must have no privilege of any kind on.
CREATE TABLE hum_authority.geometry_record (
  record_key                  text PRIMARY KEY,
  protection_class_id         text REFERENCES hum_authority.protected_class(class_id),
  presentation_partition_key  text NOT NULL,
  emitting_domain_id          text NOT NULL,
  kind                        text NOT NULL,
  denotation                  text NOT NULL,
  origin                      text NOT NULL,
  crs                         text NOT NULL,
  coordinates                 jsonb,
  source_id                   text NOT NULL,
  source_geometry_id          text,
  relation_to_assertion       text NOT NULL
);

CREATE TABLE hum_authority.authority_epoch (
  epoch          integer PRIMARY KEY,
  source_digest  text NOT NULL,
  loaded_at      timestamptz NOT NULL,
  CONSTRAINT authority_epoch_positive CHECK (epoch >= 1),
  CONSTRAINT authority_epoch_digest_is_sha256 CHECK (source_digest ~ '^[0-9a-f]{64}$')
);

-- AS-7 · the run log. The governance assertions are made against THIS, not against the
-- scheduler's configuration, because the property is about what happened.
CREATE TABLE hum_authority.cadence_run (
  ran_at   timestamptz PRIMARY KEY,
  outcome  text NOT NULL,
  epoch    integer NOT NULL,
  CONSTRAINT cadence_run_outcome_known CHECK (outcome IN ('SUBSTANTIVE', 'NO_OP'))
);

-- ════════════════════════════════════════════════════════════════════════════
-- THE READER STORE — one row per record, always
-- ════════════════════════════════════════════════════════════════════════════
--
-- GA-38's column set is CLOSED. The schema check in the proof enumerates exactly these
-- five columns and refuses any other — which is what makes "add a coordinates column
-- and watch it fail" a real mutation rather than a description.
--
-- A PROJECTED row's `projection` JSON legitimately contains coordinates: those are the
-- PUBLIC geometry of an unprotected record, which is the thing a map draws. What must
-- never exist is a discrete coordinate column, because that is a column a query can
-- reach without going through the projection the authority produced.

CREATE TABLE hum_reader.reader_row (
  record_key             text PRIMARY KEY,
  row_kind               text NOT NULL,
  withheld               text,
  projection             jsonb,
  projected_under_epoch  integer NOT NULL,

  CONSTRAINT reader_row_kind_known
    CHECK (row_kind IN ('PROJECTED', 'WITHHELD')),

  -- THE WALL FOR THE LEAK THE COMPILER CAUGHT IN THE TYPE.
  -- R3's internal reason vocabulary contains 'PROTECTED'. If that value ever reached
  -- this column, the reader store would hold the protected fact at rest. Only the two
  -- READER tokens are admissible here, so a writer that bypasses the TypeScript
  -- constructor is refused by the database.
  CONSTRAINT reader_row_withheld_is_a_reader_token
    CHECK (withheld IS NULL OR withheld IN ('NOT_SHOWN', 'NOT_DRAWABLE_HERE')),

  -- A row is one thing or the other, never both and never neither. "Never neither" is
  -- the AS-4 half: an absent row would make membership a function of the dark set.
  CONSTRAINT reader_row_exactly_one_payload
    CHECK (
      (row_kind = 'WITHHELD'  AND withheld IS NOT NULL AND projection IS NULL)
      OR
      (row_kind = 'PROJECTED' AND withheld IS NULL     AND projection IS NOT NULL)
    ),

  CONSTRAINT reader_row_epoch_positive CHECK (projected_under_epoch >= 1)
);

-- AS-E1-4 · the index a reader query uses orders by record_key ALONE.
-- Nothing correlated with row_kind, nothing that would return projected rows first.
CREATE UNIQUE INDEX reader_row_order_key ON hum_reader.reader_row (record_key);

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS — the actual control
-- ════════════════════════════════════════════════════════════════════════════

-- The authority writer owns its schema and needs nothing granted.

-- The projection job: reads the authority, writes the reader store. It is the only
-- role that can see both, and it is not a role any request authenticates as.
GRANT USAGE ON SCHEMA hum_authority TO hum_projection_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA hum_authority TO hum_projection_writer;

-- THE READER: USAGE on the reader schema and SELECT on the one table. Nothing else,
-- anywhere. GA-41 and GA-42 are the assertions that this line is the whole of it.
GRANT USAGE ON SCHEMA hum_reader TO hum_reader_role;
GRANT SELECT ON hum_reader.reader_row TO hum_reader_role;

-- ── THE PRODUCER — COLUMN-LEVEL, AFTER E1 BROKE THE TABLE-LEVEL VERSION ────
--
-- R1 granted `SELECT, INSERT, UPDATE ON hum_authority.geometry_record`. E1 executed,
-- as hum_producer_role:
--
--     UPDATE geometry_record SET protection_class_id = NULL
--     UPDATE geometry_record SET presentation_partition_key = 'PART-LIGHT'
--
-- Both succeeded. A producer could therefore declassify any protected record and move
-- any record out of a dark cohort — without touching a declaration table at all.
--
-- R1's GA-43 test asserted the producer could not write `protected_class` or
-- `protected_partition`, and passed. It was testing THE WRONG OBJECT: the security
-- decision for a record does not live in the declaration tables, it lives in two
-- columns ON THE RECORD. The declaration says which classes are dark; these two columns
-- say which class and cohort this record is in, and that is the half that was open.
--
-- Table-level UPDATE is replaced by a column list. In PostgreSQL a column-level UPDATE
-- grant is enforced per column, so a statement touching an ungranted column is refused
-- outright — the whole statement, not the column. The producer cannot reach the
-- security fields even in the same statement as a legitimate one.
--
-- THE TWO SECURITY-OWNED COLUMNS ARE ABSENT FROM THIS LIST, and their absence is the
-- control: `protection_class_id` and `presentation_partition_key` are the authority's.
-- `record_key` is also absent — re-keying a record is re-identifying it, which is not
-- a producer-owned act either.
GRANT USAGE ON SCHEMA hum_authority TO hum_producer_role;
GRANT SELECT ON hum_authority.geometry_record TO hum_producer_role;

GRANT UPDATE (
  emitting_domain_id,
  kind,
  denotation,
  origin,
  crs,
  coordinates,
  source_id,
  source_geometry_id,
  relation_to_assertion
) ON hum_authority.geometry_record TO hum_producer_role;

-- INSERT is left table-level DELIBERATELY, and this is a known open item rather than
-- an oversight. See 05-UNRESOLVED.md: restricting it to the same column list would make
-- every producer insert arrive with `protection_class_id = NULL`, which is FAIL-OPEN,
-- and the only fail-closed default available — a sentinel "unadjudicated" partition —
-- would be a cohort not derivable from any published register, breaking AS-E1-5. The
-- correct resolution belongs with the producer composition root that GA-33 is waiting
-- on, and inventing one here to close a row on a checklist would trade a measured gap
-- for an unmeasured rule violation.
GRANT INSERT ON hum_authority.geometry_record TO hum_producer_role;

-- Stated explicitly rather than left to absence. Absence is the correct mechanism, but
-- an explicit REVOKE is what a reviewer can read, and it survives someone later adding
-- a blanket GRANT above it.
REVOKE ALL ON hum_authority.protected_class      FROM hum_producer_role, hum_reader_role;
REVOKE ALL ON hum_authority.protected_partition  FROM hum_producer_role, hum_reader_role;
REVOKE ALL ON hum_authority.geometry_record      FROM hum_reader_role;
REVOKE ALL ON hum_authority.authority_epoch      FROM hum_producer_role, hum_reader_role;
REVOKE ALL ON hum_authority.cadence_run          FROM hum_producer_role, hum_reader_role;
REVOKE ALL ON SCHEMA hum_authority               FROM hum_reader_role;

-- GA-42 · the reader cannot write the reader store either. The projection job writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON hum_reader.reader_row FROM hum_reader_role;
