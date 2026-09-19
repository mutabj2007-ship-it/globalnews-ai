# DATABASE INTEGRITY MANIFEST
## MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1 — E1 C895 HARDENED (D-1 · D-2 · D-3 · D-6)

**Why this file exists.** The three promotion fingerprints do not cover the database.
C spans `.ts .tsx .mjs .json`; PA covers `frontend/public`; SC covers `scripts/`.
**`schema.prisma` is `.prisma` and both migration files are `.sql`, so all three are
invisible to all three scopes.** Candidate identity is C/PA/SC **plus** this manifest.

## 1 · EXACT HASHES

```
sha256  9d2507760af86d4aedb2f1890191af775605517e45d2ec68a5016823a6c0d1f4   28406 B
        backend/prisma/schema.prisma

sha256  4949a41675824f941280b921edd16b298de76157e559aa88bb182c486eac496e    9057 B
        backend/prisma/migrations/20260901050000_add_situation_memory/migration.sql

sha256  84f730ab5bc4ec824f7e6db4340781e61ee3453902bca60d9a12a0837086cb18    4727 B
        backend/prisma/migrations/20260901050000_add_situation_memory/DOWN.sql
```

**`migration.sql` is no longer byte-identical to the accepted authority, and that is
deliberate and bounded.** E1 item D-2 required the stale rollback path in its header to be
corrected. The change is **comment-only**: `diff` over the file with comment and blank lines
removed shows **ZERO statement difference**. Not one SQL statement, identifier, type,
constraint or index was touched, and the accepted Situation identity semantics are unaltered.

> **OPERATOR NOTE, BECAUSE IT IS A REAL HAZARD.** Prisma records a checksum of the WHOLE
> migration file, comments included. Editing it is safe here only because this migration has
> **never been applied to any database** — it is new to this candidate and nothing has been
> deployed. After the first `prisma migrate deploy`, this file must not be edited again for
> any reason, including a comment: Prisma would then fail with a modified-migration error.

## 2 · MIGRATION IDENTITY

```
NAME      20260901050000_add_situation_memory
POSITION  immediately after 20260826210000_add_article_published_at_basis
CLASS     ADDITIVE — five new tables; no existing table altered, dropped or renamed
APPLIED   never (no deployment has occurred)
```

## 3 · THE FIVE ADDED PRISMA MODELS

Schema model count **11 → 16**. Each block was compared to the accepted authority by digest.

```
Situation                 832d60a73350…      SituationClusterMember    5b0238d2afaf…
SituationSnapshot         62cdb79f353c…      SituationShadowDecision   76dbe8e534eb…
SituationCluster          01553ca8f98a…
```

The eleven pre-existing models are unchanged and none gains a back-relation. The new models
reference `Article` and `AnalysisRun` **in comments only**; there is deliberately no foreign
key to either.

## 4 · FORWARD MIGRATION — FULL OBJECT ENUMERATION (D-6)

```
5   CREATE TABLE                Situation · SituationSnapshot · SituationCluster
                                SituationClusterMember · SituationShadowDecision
9   CREATE INDEX                Situation ×3 · SituationSnapshot ×2
                                SituationClusterMember ×1 · SituationShadowDecision ×3
3   CREATE UNIQUE INDEX         Situation_partitionKey_keyVersion_discriminator_key
                                SituationCluster_snapshotId_clusterKey_key
                                SituationClusterMember_clusterId_articleUrl_key
4   ALTER TABLE                 = 3 FOREIGN KEY + 1 CHECK
      3 FOREIGN KEY             SituationSnapshot_situationId_fkey
                                SituationCluster_snapshotId_fkey
                                SituationClusterMember_clusterId_fkey
      1 CHECK                   SituationShadowDecision_shadowOnly_check
1   CREATE FUNCTION (plpgsql)   situation_identity_is_assign_once()
1   CREATE TRIGGER              situation_identity_assign_once  BEFORE UPDATE ON "Situation"
0   DROP                        zero forward drops; no operation touches an existing object
0   CREATE TYPE                 no enum is introduced
```

**IDENTITY INVARIANT — PRESERVED.** `Situation` carries exactly ONE unique index and it is the
triple `(partitionKey, keyVersion, discriminator)`. `partitionKey` is **NON-UNIQUE** on its
own — it is a coarse partition (`sit:v1:RWA` holds every Rwandan situation), and a unique
index there would force them all into one row: a false merge manufactured by a constraint
instead of caught by tier 2. `situationWriteGate.spec.ts` asserts this in both the schema and
the migration.

## 5 · ROLLBACK — FULL OBJECT ENUMERATION (D-1 · D-3 · D-6)

```
1   DROP TRIGGER    IF EXISTS   situation_identity_assign_once   (guarded on the TABLE)
1   DROP FUNCTION   IF EXISTS   situation_identity_is_assign_once()          <- D-1
4   DROP CONSTRAINT IF EXISTS   3 foreign keys + the CHECK
4   ALTER TABLE     IF EXISTS   the carriers of those four constraints
5   DROP TABLE      IF EXISTS   reverse dependency order
0   DROP TYPE                   nothing to drop — the forward migration creates no enum
```

**D-1 — the function was the object that survived.** The first draft dropped the foreign keys
and the tables and stopped, reasoning that a table drops its own constraints and triggers. True
— and exactly why the gap was easy to miss: the TRIGGER goes with `Situation`, but the
plpgsql FUNCTION is **schema-level** and would have outlived a "complete" rollback. Re-running
the forward migration would then silently reuse the leftover definition, because
`CREATE OR REPLACE FUNCTION` does not complain.

**D-3 — safely re-runnable, ordering unchanged.** Every destructive statement is guarded.
`ALTER TABLE IF EXISTS … DROP CONSTRAINT IF EXISTS` needs **both** guards; the constraint
guard alone still fails once the table is gone. The trigger drop uses a `DO` block testing
`to_regclass('"Situation"')`, because PostgreSQL's `IF EXISTS` on `DROP TRIGGER … ON t`
covers the trigger, **not** the table, and would still raise on a second run. Ordering is
unchanged: trigger and function first, then the foreign keys, then the tables in reverse
dependency order (ClusterMember → Cluster → Snapshot → Situation; ShadowDecision has no FK).

## 6 · WHAT THIS MANIFEST DOES NOT ATTEST

- **Not a migration run.** No database was migrated from this validation host.
- **Not a semantic typecheck.** `prisma generate` cannot run here (`binaries.prisma.sh` 403)
  and generating the client would write inside the C scope. Backend semantic typechecking
  remains **UNMEASURED — ENVIRONMENTAL**.
- **Not a claim that Situation is producing.** `SITUATION STORAGE = ACTIVE`;
  `SITUATION PRODUCERS = GATED` pending a bounded write contract for `dimensions`,
  `features`, `reason` and `discriminatorBasis`. The module declares no controller, no file
  in the namespace carries an HTTP decorator, and `app.module.ts` is the only importer
  anywhere — all asserted by `situationWriteGate.spec.ts`.

---

# ADDENDUM — ALPHA-OFFICIAL-DATA-SNAPSHOT-POSTGRES-R1

**Migration `20260919030000_add_official_data_snapshot_store`.** P-1 (Postgres `Bytes`) and
P-2 (the four persistence models) of `MAIN-OFFICIAL-DATA-SNAPSHOT-RETENTION-R1`.

## A1 · EXACT HASHES

```
sha256  75082a2d6c3b75798f44f0daca54dd22db7e6aee8b8fa64cedd4a5c7ab970e8c   37665 B
        backend/prisma/schema.prisma

sha256  611a6db246631b1c2c5ae00c992997e148f8346179b7506a4d3aed8cb9d8be50   18552 B
        backend/prisma/migrations/20260919030000_add_official_data_snapshot_store/migration.sql

sha256  24307732d379f94a3de4b85be511c52a3ea480d7a7271c0532141de5b9947fc3    3566 B
        backend/prisma/migrations/20260919030000_add_official_data_snapshot_store/DOWN.sql
```

`schema.prisma` was `9d2507760af86d4aedb2f1890191af775605517e45d2ec68a5016823a6c0d1f4` (28406 B)
before this addendum. The change is **purely additive**: 224 appended lines declaring four new
models. No existing model, field, index or attribute was edited, and a diff confirms the first
742 lines are byte-identical.

## A2 · MIGRATION IDENTITY

```
NAME      20260919030000_add_official_data_snapshot_store
POSITION  immediately after 20260901050000_add_situation_memory
CLASS     ADDITIVE — four new tables; no existing table altered, dropped or renamed
APPLIED   never (no deployment has occurred)
```

The `CREATE TABLE` / `CREATE INDEX` / `ADD FOREIGN KEY` section was **generated** by
`prisma migrate diff --from-schema <pre> --to-schema <post> --script`, so the table shapes are
the generator's rather than hand-typed. The CHECK constraints and the nine triggers below them
are hand-written, exactly as they were for the Situation migration, because Prisma cannot
express them.

## A3 · THE SAME OPERATOR HAZARD AS BEFORE

Prisma records a checksum of the WHOLE migration file, comments included. This one has **never
been applied to any database**, so it is still editable. **After the first
`prisma migrate deploy`, neither `migration.sql` nor its comments may be edited again for any
reason** — Prisma would fail with a modified-migration error.

## A4 · ONE HAZARD THAT IS NEW, AND IT IS THE MORE SERIOUS ONE

`DOWN.sql` for this migration **destroys retained evidence**. Every pinned payload it drops is
the bytes behind a figure the product has published, and — by the finding that motivates the
whole capability, that publishers serve different editions of the same dataset and do not
version past data — **those bytes cannot be re-fetched**. They are recoverable only from a
database backup.

The script therefore opens with a guard that **refuses to run while any unreleased
`SnapshotPin` exists**. That guard is asserted by
`official-data-snapshot.migration.spec.ts`, not merely written.

## A5 · WHAT IS VALIDATED, AND WHAT IS NOT

| gate | state |
|---|---|
| `prisma validate` | **passes** |
| `prisma generate` | **passes** — the four delegates are produced |
| generator-produced DDL | **yes**, via `migrate diff` |
| schema ↔ SQL column conformance, both directions | **asserted**, 41 tests |
| DOWN drops every function UP creates | **asserted** |
| additive-only (no ALTER/DROP/RENAME of an existing object) | **asserted** |
| **applied to a real PostgreSQL** | **NOT DONE.** Docker was not running in this environment and no disposable database was reachable; no destructive operation against an Alpha or Production database is authorised. The CHECK constraints and triggers are therefore proven by inspection and by conformance assertions, **not by execution** — and that is the one outstanding validation step before deployment |

---

# ADDENDUM — ALPHA-MARKET-SCHEDULED-INGEST-PLATFORM-R1

**Migration `20260919040000_add_market_scheduled_ingest`.** MKT-PLAT-2 of the Market
scheduled-ingest platform.

## B1 · EXACT HASHES

```
sha256  e10a25cfc421e593607a971f0dab1287d5e69ebbf95e8725db006db48f02ad63   45407 B
        backend/prisma/schema.prisma

sha256  47ff00c0df8ae229dc952aa8dc48d21ed27aec0a2aba16815bf45d3d338cefb7   8219 B
        backend/prisma/migrations/20260919040000_add_market_scheduled_ingest/migration.sql

sha256  d7c970128fdf721bd60e7f2ae9ac5b4f433f4144b5a254caa592c5a7bc2c31e3    1811 B
        backend/prisma/migrations/20260919040000_add_market_scheduled_ingest/DOWN.sql
```

`schema.prisma` was `75082a2d6c3b75798f44f0daca54dd22db7e6aee8b8fa64cedd4a5c7ab970e8c` (37665 B)
before this addendum — the snapshot-store state recorded above. This change is again
**purely additive**: 188 appended lines declaring three new models, with the first 966
lines byte-identical.

## B2 · MIGRATION IDENTITY

```
NAME      20260919040000_add_market_scheduled_ingest
POSITION  immediately after 20260919030000_add_official_data_snapshot_store
CLASS     ADDITIVE — three new tables; no existing table altered, dropped or renamed
APPLIED   never (no deployment has occurred)
```

The `CREATE TABLE` / `CREATE INDEX` / `ADD FOREIGN KEY` section was **generated** by
`prisma migrate diff`. The seven CHECK constraints and two triggers below it are
hand-written, because Prisma cannot express them.

## B3 · THE TWO MIGRATIONS ARE INDEPENDENT, AND THAT IS DELIBERATE

`MarketObservation.snapshotContentAddress` is a **pointer, not a foreign key**, to
`SnapshotPayload`. So:

- the snapshot store can be deployed without the Market tables, and vice versa;
- rolling back Market **does not touch a single byte of retained evidence**, and does not
  unpin anything — the pointer direction is what makes that true;
- the snapshot store's PIN remains the retention guarantee. An FK would have added a
  second, weaker one and coupled two migrations that are separately deployable.

## B4 · ROLLBACK HAZARD — LOWER HERE, AND WORTH CONTRASTING

`DOWN.sql` for the **snapshot store** refuses to run while anything is pinned, because
those bytes cannot be re-fetched from the publisher.

`DOWN.sql` for **Market** needs no such guard: `MarketObservation` holds PARSED READINGS,
and if the bytes they came from are still retained they are re-derivable by re-parsing.
What is lost is the ingest run history — the only trace that a fetch was attempted and how
it ended. Take a backup if that matters.

## B5 · WHAT IS VALIDATED, AND WHAT IS NOT

Identical in shape to A5, and with the same single gap: `prisma validate` passes,
`prisma generate` produces the three delegates, the DDL is generator-produced, and the
migration is additive-only — but **it has not been applied to a real PostgreSQL**, so the
CHECK constraints and the two triggers are proven by inspection rather than by execution.
