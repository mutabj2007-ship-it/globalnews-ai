import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MIGRATION VALIDATION — SCHEMA ↔ SQL ↔ ROLLBACK CONFORMANCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS RATHER THAN A DATABASE TEST. Applying the migration to a real
 * PostgreSQL would prove more, and it is the right thing to do before deploying.
 * It could not be done here: Docker was not running in this environment and no
 * disposable database was reachable, and the brief authorises no destructive
 * operation against any Alpha or Production database. That limit is recorded
 * rather than worked around — see the package's DEPLOYMENT-AND-MIGRATION note.
 *
 * WHAT THIS DOES PROVE, MECHANICALLY, AND IT IS NOT NOTHING.
 *
 *   1. every model and every field in schema.prisma has DDL in migration.sql,
 *      and the migration creates nothing the schema does not declare;
 *   2. DOWN.sql drops everything UP creates — including the six plpgsql
 *      FUNCTIONS, which live in the schema rather than in a table and therefore
 *      survive a naive `DROP TABLE` rollback. That was a real E1 finding against
 *      the Situation migration (item D-1) and this asserts it instead of
 *      remembering it;
 *   3. the contract clauses that are enforced in SQL are actually present as SQL
 *      — a CHECK or a trigger named in a comment is a promise, one that fails a
 *      test is a guarantee;
 *   4. the migration is additive: it alters, drops and renames nothing.
 *
 * The migration SQL's CREATE TABLE / INDEX / FOREIGN KEY section was produced by
 * `prisma migrate diff --from-schema <pre> --to-schema <post> --script`, so the
 * table shapes are the generator's and not hand-typed. The constraints and
 * triggers below it are hand-written, as they were for the Situation migration,
 * because Prisma cannot express them.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const SCHEMA = join(REPO, 'backend', 'prisma', 'schema.prisma');
const MIGRATION_DIR = join(
  REPO,
  'backend',
  'prisma',
  'migrations',
  '20260919030000_add_official_data_snapshot_store',
);

const schema = readFileSync(SCHEMA, 'utf8');
const up = readFileSync(join(MIGRATION_DIR, 'migration.sql'), 'utf8');
const down = readFileSync(join(MIGRATION_DIR, 'DOWN.sql'), 'utf8');

/** Comment-stripped, so a guard reads SQL rather than prose about SQL. */
const upCode = up.replace(/^\s*--.*$/gm, '');
const downCode = down.replace(/^\s*--.*$/gm, '');

const MODELS = [
  'SnapshotPayload',
  'SnapshotRetrieval',
  'SnapshotPin',
  'SnapshotTombstone',
] as const;

/** The fields each model declares in schema.prisma, excluding relation fields. */
function schemaFieldsOf(model: string): string[] {
  const body = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm').exec(schema)?.[1] ?? '';

  return (
    body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => line !== '' && !line.startsWith('@@') && !line.startsWith('///'))
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 2)
      // relation fields name another model as their type; they are not columns
      .filter(
        (parts) => !MODELS.includes(parts[1]!.replace(/[?[\]]/g, '') as (typeof MODELS)[number]),
      )
      .map((parts) => parts[0]!)
  );
}

describe('P-2 · the four models Main named, and only those four', () => {
  it('schema.prisma declares all four', () => {
    for (const model of MODELS) {
      expect([model, new RegExp(`^model ${model} \\{`, 'm').test(schema)]).toEqual([model, true]);
    }
  });

  it('the migration creates a table for each, and no fifth Snapshot table', () => {
    const created = [...upCode.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]!);

    expect(created.sort()).toEqual([...MODELS].sort());
  });

  it('the names are Main’s P-2 names verbatim — not renamed, not abbreviated', () => {
    // A rename here would silently fork the shape Main owns and E1 reviews.
    expect([...MODELS]).toEqual([
      'SnapshotPayload',
      'SnapshotRetrieval',
      'SnapshotPin',
      'SnapshotTombstone',
    ]);
  });
});

describe('every schema field reaches the SQL', () => {
  it.each([...MODELS])('%s', (model) => {
    const createTable = new RegExp(`CREATE TABLE "${model}" \\(([\\s\\S]*?)\\n\\);`).exec(
      upCode,
    )?.[1];

    expect(createTable).toBeDefined();

    const columns = [...createTable!.matchAll(/^\s+"(\w+)"/gm)].map((m) => m[1]!);

    for (const field of schemaFieldsOf(model)) {
      expect([model, field, columns.includes(field)]).toEqual([model, field, true]);
    }
  });

  it('and the SQL introduces no column the schema does not declare', () => {
    for (const model of MODELS) {
      const createTable = new RegExp(`CREATE TABLE "${model}" \\(([\\s\\S]*?)\\n\\);`).exec(
        upCode,
      )![1]!;
      const columns = [...createTable.matchAll(/^\s+"(\w+)"/gm)].map((m) => m[1]!);
      const declared = schemaFieldsOf(model);

      for (const column of columns) {
        expect([model, column, declared.includes(column)]).toEqual([model, column, true]);
      }
    }
  });

  it('the payload bytes are a real Postgres BYTEA — P-1, the substrate decision', () => {
    expect(upCode).toMatch(/"bytes" BYTEA/);
    expect(schema).toMatch(/bytes Bytes\?/);
  });
});

describe('the migration is ADDITIVE — it touches nothing that already exists', () => {
  it('alters no pre-existing table', () => {
    const altered = [...upCode.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]!);
    const outsiders = [...new Set(altered)].filter(
      (t) => !MODELS.includes(t as (typeof MODELS)[number]),
    );

    expect(outsiders).toEqual([]);
  });

  it('drops and renames nothing', () => {
    /*
      ANCHORED AT THE START OF A STATEMENT, and the reason is worth recording:
      the obvious unanchored /TRUNCATE/i matched the string literal 'TRUNCATED'
      — one of the contract's three completeness values — and failed a migration
      that is entirely additive. A guard that fires on a value it was written to
      protect is a guard nobody will keep.
    */
    const destructive = [
      ...upCode.matchAll(/^\s*(DROP\s+TABLE|TRUNCATE|ALTER\s+TABLE[^;]*?\b(DROP|RENAME)\b)/gim),
    ];

    expect(destructive.map((m) => m[0]!.trim())).toEqual([]);
  });

  it('writes no row — every row is written by a retrieval', () => {
    expect(upCode).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+"|\bCOPY\b/i);
  });

  it('adds no foreign key that leaves the Snapshot family', () => {
    const refs = [...upCode.matchAll(/REFERENCES "(\w+)"/g)].map((m) => m[1]!);

    expect([...new Set(refs)]).toEqual(['SnapshotPayload']);
  });

  it('carries no personal data column', () => {
    for (const forbidden of ['userId', 'sessionId', 'email', 'ipAddress', 'userAgent']) {
      expect([forbidden, upCode.includes(`"${forbidden}"`)]).toEqual([forbidden, false]);
    }
  });
});

describe('the contract clauses that are enforced in SQL are present as SQL', () => {
  const REQUIRED_CHECKS: ReadonlyArray<readonly [string, RegExp]> = [
    ['SR-1 · the address is a SHA-256', /CHECK \("contentAddress" ~ '\^\[0-9a-f\]\{64\}\$'\)/],
    ['byte length is non-negative', /CHECK \("byteLength" >= 0\)/],
    ['storage state and bytes agree', /SnapshotPayload_storageState_bytes_agree/],
    ['SR-16 · completeness is the contract’s three values', /'COMPLETE', 'TRUNCATED', 'FAILED'/],
    ['an address is required unless FAILED', /SnapshotRetrieval_address_required_unless_failed/],
    ['SR-22 · a request path is not a URL', /SnapshotRetrieval_requestPath_is_not_a_url/],
  ];

  it.each(REQUIRED_CHECKS)('%s', (_name, pattern) => {
    expect(pattern.test(upCode)).toBe(true);
  });

  const REQUIRED_TRIGGERS = [
    'snapshot_payload_append_only',
    'snapshot_payload_pinned_not_collectable',
    'snapshot_payload_not_deletable',
    'snapshot_retrieval_not_deletable',
    'snapshot_tombstone_not_deletable',
    'snapshot_pin_not_deletable',
    'snapshot_retrieval_immutable',
    'snapshot_tombstone_immutable',
    'snapshot_pin_release_only_trigger',
  ] as const;

  it.each([...REQUIRED_TRIGGERS])('trigger %s is created', (trigger) => {
    expect(new RegExp(`CREATE TRIGGER "${trigger}"`).test(upCode)).toBe(true);
  });

  it('SR-19 · the pinned-evidence refusal really queries the pin table', () => {
    // A trigger that merely raised on a flag would be the denormalisation this
    // design avoids. It must look at unreleased pins.
    const fn = /snapshot_payload_pinned_is_not_collectable[\s\S]*?LANGUAGE plpgsql;/.exec(
      upCode,
    )?.[0];

    expect(fn).toBeDefined();
    expect(fn!).toMatch(/FROM "SnapshotPin"/);
    expect(fn!).toMatch(/"releasedAt" IS NULL/);
  });

  it('the payload trigger permits exactly one mutation: bytes to NULL', () => {
    const fn = /snapshot_payload_is_append_only[\s\S]*?LANGUAGE plpgsql;/.exec(upCode)![0];

    expect(fn).toMatch(/NEW\."bytes" IS DISTINCT FROM OLD\."bytes" AND NEW\."bytes" IS NOT NULL/);
    expect(fn).toMatch(/"contentAddress"/);
    expect(fn).toMatch(/"byteLength"/);
    expect(fn).toMatch(/"mediaType"/);
  });
});

describe('DOWN.sql undoes everything UP does — including the part that is easy to forget', () => {
  const FUNCTIONS = [
    'snapshot_payload_is_append_only',
    'snapshot_payload_pinned_is_not_collectable',
    'snapshot_row_is_not_deletable',
    'snapshot_retrieval_is_immutable',
    'snapshot_tombstone_is_immutable',
    'snapshot_pin_release_only',
  ] as const;

  it('drops all four tables', () => {
    for (const model of MODELS) {
      expect([model, new RegExp(`DROP TABLE IF EXISTS "${model}"`).test(downCode)]).toEqual([
        model,
        true,
      ]);
    }
  });

  it.each([...FUNCTIONS])(
    'drops the schema-level function %s, which does NOT go with its table',
    (fn) => {
      expect(new RegExp(`DROP FUNCTION IF EXISTS "${fn}"\\(\\)`).test(downCode)).toBe(true);
    },
  );

  it('every function UP creates, DOWN drops — neither list may drift', () => {
    const created = [...upCode.matchAll(/CREATE OR REPLACE FUNCTION "(\w+)"/g)].map((m) => m[1]!);
    const dropped = [...downCode.matchAll(/DROP FUNCTION IF EXISTS "(\w+)"/g)].map((m) => m[1]!);

    expect([...new Set(created)].sort()).toEqual([...new Set(dropped)].sort());
  });

  it('drops tables in reverse dependency order — the referencing tables first', () => {
    const order = [...downCode.matchAll(/DROP TABLE IF EXISTS "(\w+)"/g)].map((m) => m[1]!);

    expect(order.indexOf('SnapshotPayload')).toBe(order.length - 1);
  });

  it('REFUSES TO RUN when published evidence would be destroyed', () => {
    /*
      The bytes behind a published figure cannot be re-fetched — publishers serve
      different editions and do not version past data, which is the finding this
      whole capability exists for. A rollback that silently dropped them would be
      the single most destructive operation in this product.
    */
    expect(downCode).toMatch(/RAISE EXCEPTION[\s\S]*?Refusing to roll back/);
    expect(downCode).toMatch(/"releasedAt" IS NULL/);
  });
});
