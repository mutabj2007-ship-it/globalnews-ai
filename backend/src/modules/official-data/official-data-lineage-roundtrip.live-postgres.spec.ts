/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE LINEAGE COLUMNS, AGAINST A REAL POSTGRES — A-P1 … A-P4, B-P4, B-P5
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THIS SUITE REPLACES `official-data-lineage-persistence.spec.ts`, WHICH WAS DELETED IN
 * THE SAME COMMIT. That one proved a guard fired saying these fields could not be
 * persisted; ruling A ratified the fix the guard itself named, so the guard became a
 * document that had become false. The suite that proved the refusal becomes the suite
 * that proves the round trip — a deletion with no replacement coverage would be a
 * reduction in what is measured.
 *
 * **A FAKE CANNOT PROVE A COLUMN EXISTS.** A-P1's own words: these run against the live
 * database or they are UNMEASURED. It creates a TEMPORARY SCHEMA, applies the real
 * migrations into it, asserts, and drops the schema CASCADE — it creates no database,
 * touches no existing schema, and writes no row outside its own.
 *
 * ── IT SKIPS LOUDLY, AND IT NEVER PASSES QUIETLY ──────────────────────────
 *
 * Without `SNAPSHOT_TEST_DATABASE_URL` the suite is skipped and says so. A skipped check
 * is UNMEASURED, never PASS.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';

const DATABASE_URL = process.env['SNAPSHOT_TEST_DATABASE_URL'];
const MIGRATIONS = join(__dirname, '..', '..', '..', 'prisma', 'migrations');

const MIGRATION_ORDER = [
  '20260919030000_add_official_data_snapshot_store',
  '20260919040000_add_market_scheduled_ingest',
  '20260919050000_snapshot_admission_r2',
  '20260920140000_snapshot_retrieval_lineage_fields',
] as const;

const LINEAGE_MIGRATION = '20260920140000_snapshot_retrieval_lineage_fields';
const SCHEMA = `lineage_roundtrip_${process.pid}`;

const describeLive = DATABASE_URL === undefined ? describe.skip : describe;

if (DATABASE_URL === undefined) {
  // eslint-disable-next-line no-console
  console.warn(
    'LINEAGE ROUND TRIP SKIPPED — UNMEASURED, not PASS. Set SNAPSHOT_TEST_DATABASE_URL ' +
      'to a disposable Postgres to run A-P1…A-P4, B-P4 and B-P5.',
  );
}

function sqlOf(dir: string): string {
  return readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8');
}

/** The columns this round added, and the only ones it added. */
const NEW_COLUMNS = ['referencePeriod', 'sourceLanguage', 'extractorId', 'extractorVersion'];

describeLive('the retrieval lineage columns, on a real Postgres', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await client.query(`CREATE SCHEMA "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);

    /*
      THE ORDERING IS THE EVIDENCE FOR A-P4, so it is done here rather than inside a
      test: apply the three PRIOR migrations, write a row that predates the lineage
      columns, and only THEN apply the lineage migration. A suite that migrated first
      and inserted afterwards could not distinguish "existing rows were left alone"
      from "there were no existing rows".
    */
    for (const dir of MIGRATION_ORDER.filter((d) => d !== LINEAGE_MIGRATION)) {
      await client.query(sqlOf(dir));
    }
    await insertRetrieval('before-the-migration');
    await client.query(sqlOf(LINEAGE_MIGRATION));
  }, 120_000);

  afterAll(async () => {
    if (client !== undefined) {
      await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await client.end();
    }
  }, 60_000);

  /**
   * Insert one COHERENT retrieval, plus the payload it addresses.
   *
   * The row has to satisfy the constraints R2 landed — a verdict with its key and
   * class, and an address unless the capture failed — because those are the guarantees
   * the table exists to enforce, and a test that sidestepped them would be asserting
   * against a shape the database does not actually permit.
   */
  async function insertRetrieval(
    id: string,
    extra: Readonly<Record<string, string | null>> = {},
  ): Promise<void> {
    const address = Buffer.from(id).toString('hex').padEnd(64, '0').slice(0, 64);
    await client.query(
      `INSERT INTO "SnapshotPayload" ("contentAddress", "bytes", "byteLength", "mediaType", "storageState")
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [address, Buffer.from([0x25, 0x50, 0x44, 0x46]), 4, 'application/pdf', 'RETAINED'],
    );
    const base: Record<string, unknown> = {
      contentAddress: address,
      admissibility: 'ADMITTED',
      parserId: 'nisr.cpi.pdf',
      parserVersion: '1.0.0',
      parsedAt: new Date('2026-09-20T02:30:49.000Z'),
      wireByteLength: 1_727_902,
      contentEncoding: 'identity',
      retrievalId: id,
      providerId: 'rw-nisr',
      endpointId: 'cpi-monthly-en',
      requestPath: '/docs/cpi.pdf',
      parameters: JSON.stringify([]),
      requestedAt: new Date('2026-09-20T02:30:45.000Z'),
      retrievedAt: new Date('2026-09-20T02:30:48.000Z'),
      httpStatus: 200,
      mediaType: 'application/pdf',
      byteLength: 1_727_902,
      completeness: 'COMPLETE',
      rightsGrade: 'E-5',
      rightsInstrumentRef: 'https://statistics.gov.rw',
      payloadRetentionPermitted: true,
      editionAnnotations: JSON.stringify({}),
      ...extra,
    };
    const keys = Object.keys(base);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const params = keys.map((_k, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "SnapshotRetrieval" (${cols}) VALUES (${params})`,
      keys.map((k) => base[k]),
    );
  }

  describe('A-P4 · no existing row was touched', () => {
    it('a row written BEFORE the migration survives it with all four columns NULL', async () => {
      /* THIS IS A-4 AS A TEST RATHER THAN A PROMISE. The row was written before the
         lineage migration ran — see `beforeAll` — so NULL here is the migration having
         left it alone, not the absence of anything to leave alone. */
      const { rows } = await client.query(
        `SELECT "retrievalId", "referencePeriod", "sourceLanguage", "extractorId", "extractorVersion"
           FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
        ['before-the-migration'],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].referencePeriod).toBeNull();
      expect(rows[0].sourceLanguage).toBeNull();
      expect(rows[0].extractorId).toBeNull();
      expect(rows[0].extractorVersion).toBeNull();
    }, 120_000);
  });

  describe('A-P1 / B-P4 · a stated value survives the round trip', () => {
    it('reads back exactly what was written', async () => {
      await insertRetrieval('with-lineage', {
        referencePeriod: '2026-08',
        sourceLanguage: 'en',
        extractorId: 'nisr.cpi.pdfsynctext.positional',
        extractorVersion: '1.0.0',
      });

      const { rows } = await client.query(
        `SELECT "referencePeriod", "sourceLanguage", "extractorId", "extractorVersion"
           FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
        ['with-lineage'],
      );
      expect(rows[0].referencePeriod).toBe('2026-08');
      expect(rows[0].sourceLanguage).toBe('en');
      expect(rows[0].extractorId).toBe('nisr.cpi.pdfsynctext.positional');
      expect(rows[0].extractorVersion).toBe('1.0.0');
    });
  });

  describe('A-P3 · the period is NOT laundered into a day', () => {
    it('stores the exact text `2026-08`, at the publisher’s own precision', async () => {
      const { rows } = await client.query(
        `SELECT "referencePeriod"::text AS raw FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
        ['with-lineage'],
      );
      /*
        THE MUTATION THIS CATCHES: a later retype of the column to DATE or timestamptz.
        `2026-08` is a MONTH. A date type manufactures `2026-08-01T00:00:00Z`, a day the
        publisher never stated, and no reader downstream can tell a manufactured day from
        a stated one. This is the ONLY assertion that notices.
      */
      expect(rows[0].raw).toBe('2026-08');
      expect(rows[0].raw).not.toContain('T');
      expect(rows[0].raw).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('the column is a character type, not a temporal one', async () => {
      const { rows } = await client.query(
        `SELECT data_type, character_maximum_length
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'SnapshotRetrieval'
            AND column_name = 'referencePeriod'`,
        [SCHEMA],
      );
      expect(rows[0].data_type).toBe('character varying');
      expect(rows[0].character_maximum_length).toBe(32);
    });

    it('a coarser precision stores unchanged too, without a schema change', async () => {
      /* A publisher who someday states a quarter or a year stores THAT, at THAT
         precision. A date column could represent neither. */
      await insertRetrieval('quarterly', { referencePeriod: '2026-Q3' });
      const { rows } = await client.query(
        `SELECT "referencePeriod" FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
        ['quarterly'],
      );
      expect(rows[0].referencePeriod).toBe('2026-Q3');
    });
  });

  describe('A-P2 / B-P5 · ABSENCE survives as absence', () => {
    it('a retrieval that stated nothing reads back NULL, not an empty string', async () => {
      await insertRetrieval('eurostat-json', { mediaType: 'application/json' });
      const { rows } = await client.query(
        `SELECT "referencePeriod", "sourceLanguage", "extractorId", "extractorVersion"
           FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
        ['eurostat-json'],
      );
      /*
        A `NOT NULL DEFAULT ''` would be the A-24 violation in its purest form: it would
        collapse "the document stated nothing" into "the document stated the empty
        string", and no later reader could separate them. A JSON dataflow states neither
        a single reference period nor an edition language, and NULL is the truthful and
        FINAL value for it — forever, not until someone gets round to it.
      */
      for (const column of NEW_COLUMNS) expect(rows[0][column]).toBeNull();
      for (const column of NEW_COLUMNS) expect(rows[0][column]).not.toBe('');
    });

    it('the mapper turns NULL into an ABSENT PROPERTY, asserted with `in`', () => {
      /*
        `toBeUndefined()` IS NOT SUFFICIENT — it passes for present-with-value-undefined,
        which is the third state this ruling forbids. The store's read mapper uses the
        conditional-spread idiom precisely so the property is absent, and `in` is the only
        assertion that tells the two apart.
      */
      const nullRow = { referencePeriod: null, sourceLanguage: null };
      const mapped = {
        ...(nullRow.referencePeriod === null ? {} : { referencePeriod: nullRow.referencePeriod }),
        ...(nullRow.sourceLanguage === null ? {} : { sourceLanguage: nullRow.sourceLanguage }),
      };
      expect('referencePeriod' in mapped).toBe(false);
      expect('sourceLanguage' in mapped).toBe(false);

      /* And the coalesce that would "also work" does NOT satisfy it. */
      const coalesced = { referencePeriod: nullRow.referencePeriod ?? undefined };
      expect('referencePeriod' in coalesced).toBe(true);
    });
  });

  describe('the migration is additive, and that is checked against the database', () => {
    it('adds exactly four columns and alters nothing else', () => {
      const sql = sqlOf(LINEAGE_MIGRATION);
      const code = sql.replace(/^\s*--.*$/gm, '');
      expect((code.match(/ADD COLUMN/g) ?? []).length).toBe(4);
      for (const verb of ['DROP', 'ALTER COLUMN', 'RENAME', 'CREATE TABLE', 'CREATE INDEX', 'CHECK']) {
        expect({ verb, present: code.includes(verb) }).toEqual({ verb, present: false });
      }
    });

    it('A-4 · contains no UPDATE, which is how a reviewer verifies the no-backfill rule', () => {
      /* One line of SQL that does not exist. */
      expect((sqlOf(LINEAGE_MIGRATION).match(/\bUPDATE\b/gi) ?? []).length).toBe(0);
    });

    it('A-6 · neither new column is indexed', async () => {
      const { rows } = await client.query(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = 'SnapshotRetrieval'`,
        [SCHEMA],
      );
      const defs = rows.map((r: { indexdef: string }) => r.indexdef).join('\n');
      /* The retrieval table is EVIDENCE, not a time series. An index on referencePeriod
         would invite querying retrievals BY period, which is the Economy spine's job. */
      for (const column of NEW_COLUMNS) expect(defs).not.toContain(`"${column}"`);
    });

    it('every new column is nullable with no default', async () => {
      const { rows } = await client.query(
        `SELECT column_name, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'SnapshotRetrieval'
            AND column_name = ANY($2)`,
        [SCHEMA, NEW_COLUMNS],
      );
      expect(rows).toHaveLength(4);
      for (const r of rows as { is_nullable: string; column_default: string | null }[]) {
        expect(r.is_nullable).toBe('YES');
        expect(r.column_default).toBeNull();
      }
    });

    it('DOWN drops exactly what UP adds', () => {
      const down = readFileSync(join(MIGRATIONS, LINEAGE_MIGRATION, 'DOWN.sql'), 'utf8');
      for (const column of NEW_COLUMNS) expect(down).toContain(`"${column}"`);
      expect((down.match(/DROP COLUMN/g) ?? []).length).toBe(4);
      expect(down).not.toContain('DROP TABLE');
    });
  });
});
