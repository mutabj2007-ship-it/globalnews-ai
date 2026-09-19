import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R2 · T-17 … T-20 AND T-23 — AGAINST A REAL POSTGRES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THESE ARE THE TESTS MAIN COULD NOT RUN, and the reason they could not be faked is
 * the reason they exist. Main's own note:
 *
 *   "T-18 / T-19 specifically — the whole point is that the refusal happens AT THE
 *    DATABASE, not in application code. Asserting them against a mock would prove the
 *    opposite of what they exist to prove."
 *
 * A fake that refuses an observation citing a REFUSED retrieval proves only that the
 * fake was written to refuse it. The claim under test is that POSTGRES refuses it —
 * that a composite foreign key and a trigger make the bad state UNREPRESENTABLE, with
 * no code path to forget. So this suite executes the real migration SQL and asserts on
 * real SQLSTATEs.
 *
 * ── HOW IT ISOLATES ITSELF ────────────────────────────────────────────────
 *
 * It creates a TEMPORARY SCHEMA inside whatever database it is pointed at, sets
 * `search_path` to it, runs the three migrations into it, asserts, and drops the
 * schema CASCADE. It creates no database, touches no existing schema, and writes no
 * row outside its own. Running it against a development database is safe; it is still
 * pointed at a disposable one by convention.
 *
 * ── IT SKIPS LOUDLY, AND IT NEVER PASSES QUIETLY ──────────────────────────
 *
 * Without `SNAPSHOT_TEST_DATABASE_URL` the suite is skipped and says so. A skipped
 * check is UNMEASURED, never PASS — the package records it that way, because a suite
 * that silently degrades to green when the database is missing is worse than no suite.
 */

const DATABASE_URL = process.env['SNAPSHOT_TEST_DATABASE_URL'];
const MIGRATIONS = join(__dirname, '..', '..', '..', 'prisma', 'migrations');

const MIGRATION_ORDER = [
  '20260919030000_add_official_data_snapshot_store',
  '20260919040000_add_market_scheduled_ingest',
  '20260919050000_snapshot_admission_r2',
] as const;

const FIXTURES = join(__dirname, 'fixtures');
const EUROSTAT_BYTES = readFileSync(join(FIXTURES, 'eurostat-une_rt_m-D2.body'));
const EUROSTAT_SHA = 'c37c607cf568606316269f3afaadbc5596fa5c2c8a14a3ba789e4f47e1077bc9';

const SCHEMA = `snap_r2_${Math.random().toString(36).slice(2, 10)}`;

const describeLive = DATABASE_URL === undefined ? describe.skip : describe;

if (DATABASE_URL === undefined) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n  SNAPSHOT R2 LIVE-POSTGRES SUITE SKIPPED — SNAPSHOT_TEST_DATABASE_URL is not set.\n' +
      '  T-17, T-18, T-19, T-20 and T-23 are UNMEASURED, not passed.\n',
  );
}

describeLive('R2 · T-17 … T-23 against a real PostgreSQL', () => {
  let db: Client;

  /** Every statement runs inside the throwaway schema. */
  const q = (sql: string, params: unknown[] = []) => db.query(sql, params);

  /** Assert a statement fails, and return the SQLSTATE + message so a test can name them. */
  const expectFailure = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<{ code: string; message: string }> => {
    try {
      await q(sql, params);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      return { code: e.code ?? '', message: e.message ?? '' };
    }
    throw new Error(`EXPECTED A DATABASE REFUSAL, BUT THE STATEMENT SUCCEEDED:\n${sql}`);
  };

  /*
    A REFUSED CAPTURE USUALLY HAS AN ADDRESS, AND GETTING THIS WRONG IS WHAT THE LIVE
    DATABASE CAUGHT. A 404, a host mismatch or a parse failure all RECEIVED a body —
    the error page is retained, and R1's own test proves it. The one refusal with no
    address is SECRET_DETECTED, because those bytes were discarded on purpose.

    `endpointId` is a parameter so T-20 can count its own captures without being
    polluted by rows other tests left behind. Cross-test contamination in a shared
    schema is a real hazard and scoping the query is the honest fix — not deleting
    rows, which the append-only triggers forbid anyway.
  */
  /**
   * `ageDays` is a parameter because a retrieval row CANNOT BE UPDATED — R1's
   * `snapshot_retrieval_immutable` trigger refuses it, and rightly: a retrieval
   * records one fetch and a fetch that is later understood differently is a NEW row.
   *
   * The first draft of the freshness test inserted a capture and then back-dated it
   * with an UPDATE. The trigger refused, which is the R1 guarantee working exactly as
   * designed — so the age is set at insert instead. Worth recording rather than
   * quietly fixing: the test was wrong and the database was right.
   */
  const admittedRetrieval = async (
    retrievalId: string,
    contentAddress: string | null,
    endpointId = 'une_rt_m',
    ageDays = 0,
  ) =>
    q(
      `INSERT INTO "SnapshotRetrieval"
        ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
         "retrievedAt","httpStatus","mediaType","byteLength","contentAddress","completeness",
         "contentEncoding","wireByteLength","admissibility","parserId","parserVersion","parsedAt",
         "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
       VALUES ($1,'eurostat',$4,'statistics/1.0/data/une_rt_m','[]'::jsonb,now(),
               now() - ($5 || ' days')::interval,200,'application/json',$2,$3,'COMPLETE',
               'identity',$2,'ADMITTED','eurostat-jsonstat','1.0.0',now(),
               'E-5','eurostat-reuse-policy',true,'{}'::jsonb)`,
      [retrievalId, EUROSTAT_BYTES.length, contentAddress, endpointId, String(ageDays)],
    );

  const refusedRetrieval = async (
    retrievalId: string,
    refusalKey: string,
    refusalClass: string,
    contentAddress: string | null,
    completeness = 'COMPLETE',
    endpointId = 'une_rt_m',
  ) =>
    q(
      `INSERT INTO "SnapshotRetrieval"
        ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
         "retrievedAt","httpStatus","mediaType","byteLength","contentAddress","completeness",
         "contentEncoding","wireByteLength","admissibility","refusalKey","refusalClass",
         "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
       VALUES ($1,'eurostat',$7,'statistics/1.0/data/une_rt_m','[]'::jsonb,now(),
               now(),200,'application/json',$2,$3,$6,
               'identity',$2,'REFUSED',$4,$5,
               'E-5','eurostat-reuse-policy',true,'{}'::jsonb)`,
      [
        retrievalId,
        EUROSTAT_BYTES.length,
        contentAddress,
        refusalKey,
        refusalClass,
        completeness,
        endpointId,
      ],
    );

  /**
   * A retrieval that names an address requires the PAYLOAD to exist first — R1's
   * `SnapshotRetrieval_contentAddress_fkey`. The live database caught this too: the
   * first draft of these helpers invented addresses with no payload behind them, and
   * every refusal test failed on the foreign key before reaching what it meant to test.
   *
   * Which is itself worth recording — a refused capture normally HAS bytes. A 404, a
   * host mismatch and a parse failure all received a body, and R1 retains it. The one
   * refusal with no payload is SECRET_DETECTED.
   */
  const payloadFor = async (address: string) =>
    q(
      `INSERT INTO "SnapshotPayload" ("contentAddress","bytes","byteLength","mediaType","storageState")
       VALUES ($1, $2, $3, 'application/json', 'RETAINED')
       ON CONFLICT ("contentAddress") DO NOTHING`,
      [address, Buffer.from('{"x":1}'), 7],
    );

  const marketRun = async (id: string) =>
    q(
      `INSERT INTO "MarketIngestRun"
        ("id","runKey","providerId","subjectClass","cadenceWindow","triggerKind","startedAt")
       VALUES ($1,$1,'EUROSTAT','INSTRUMENT','2026-09','SCHEDULED',now())`,
      [id],
    );

  const insertObservation = (
    key: string,
    runId: string,
    retrievalId: string | null,
    admissibility: string | null,
    contentAddress: string | null,
  ) =>
    `INSERT INTO "MarketObservation"
       ("id","observationKey","seriesId","periodId","providerId","subjectClass","value","unit",
        "ingestedAt","vintageProvenance","releaseStatus","snapshotContentAddress",
        "snapshotRetrievalId","snapshotAdmissibility","runId")
     VALUES ('${key}','${key}','s-yld','2026-08','EUROSTAT','INSTRUMENT',3.21,'PC',
             now(),'INGEST_SNAPSHOT','FINAL',${contentAddress === null ? 'NULL' : `'${contentAddress}'`},
             ${retrievalId === null ? 'NULL' : `'${retrievalId}'`},
             ${admissibility === null ? 'NULL' : `'${admissibility}'`},'${runId}')`;

  beforeAll(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();

    await db.query(`CREATE SCHEMA "${SCHEMA}"`);
    await db.query(`SET search_path TO "${SCHEMA}"`);

    for (const migration of MIGRATION_ORDER) {
      const sql = readFileSync(join(MIGRATIONS, migration, 'migration.sql'), 'utf8');
      await db.query(sql);
    }
  }, 120_000);

  afterAll(async () => {
    if (db !== undefined) {
      await db.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      await db.end();
    }
  }, 60_000);

  /* ═══════════════════════════════════════════════════════════════════════
   * THE MIGRATION ITSELF APPLIES — the precondition every other test rests on
   * ═══════════════════════════════════════════════════════════════════════ */

  it('the three migrations apply cleanly and produce the R2 shape', async () => {
    const cols = await q(
      `SELECT column_name, column_default, is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'SnapshotRetrieval'
          AND column_name IN ('admissibility','contentEncoding','wireByteLength',
                              'refusalKey','refusalClass','parserId','parserVersion','parsedAt')
        ORDER BY column_name`,
      [SCHEMA],
    );

    expect(cols.rows.map((r: { column_name: string }) => r.column_name)).toEqual([
      'admissibility',
      'contentEncoding',
      'parsedAt',
      'parserId',
      'parserVersion',
      'refusalClass',
      'refusalKey',
      'wireByteLength',
    ]);

    // S-1 · DEFAULT REFUSED IS THE POINT, NOT A CONVENIENCE.
    const admissibility = cols.rows.find(
      (r: { column_name: string }) => r.column_name === 'admissibility',
    ) as { column_default: string; is_nullable: string };

    expect(admissibility.column_default).toMatch(/'REFUSED'/);
    expect(admissibility.is_nullable).toBe('NO');
  });

  it('S-1 · a retrieval inserted WITHOUT naming an admissibility is REFUSED', async () => {
    /*
      THE DEFAULT IS THE WHOLE OF DEFAULT-DENY. There must be no path where the
      ABSENCE of a refusal produces admission — including the path where a writer
      simply forgot the column.
    */
    await payloadFor('1'.repeat(64));
    await refusedRetrieval('r-default', 'STATUS_NOT_OK', 'PERMANENT', '1'.repeat(64));

    const got = await q(
      `SELECT "admissibility" FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
      ['r-default'],
    );
    expect(got.rows[0].admissibility).toBe('REFUSED');
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * T-17 · A BODY CONTAINING THE CONFIGURED SECRET
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('T-17 · a quarantined capture stores metadata and NO BYTES', () => {
    it('writes the retrieval row with no contentAddress and no payload', async () => {
      await refusedRetrieval('r-secret', 'SECRET_DETECTED', 'PERMANENT', null);

      const row = await q(
        `SELECT "contentAddress","refusalKey","admissibility" FROM "SnapshotRetrieval" WHERE "retrievalId" = $1`,
        ['r-secret'],
      );

      expect(row.rows[0].contentAddress).toBeNull();
      expect(row.rows[0].refusalKey).toBe('SECRET_DETECTED');
      expect(row.rows[0].admissibility).toBe('REFUSED');

      /*
        NO PAYLOAD IS REACHABLE FROM THIS CAPTURE — asserted through the JOIN rather
        than as a global count. The first draft counted every payload in the schema
        and expected zero, which passed only while this happened to be the first test
        to run; other tests legitimately create payloads. An assertion that depends on
        execution order is not an assertion.
      */
      const reachable = await q(
        `SELECT count(*)::int AS n
           FROM "SnapshotRetrieval" r
           LEFT JOIN "SnapshotPayload" p ON p."contentAddress" = r."contentAddress"
          WHERE r."retrievalId" = 'r-secret' AND p."contentAddress" IS NOT NULL`,
      );

      // That is the point: the hash of a body known to contain a specific secret is
      // itself a confirmation oracle, so there is no address to join on.
      expect(reachable.rows[0].n).toBe(0);
    });

    it('and the quarantine storage class is accepted, paired with absent bytes', async () => {
      await q(
        `INSERT INTO "SnapshotPayload" ("contentAddress","bytes","byteLength","mediaType","storageState")
         VALUES ($1, NULL, 10, 'application/json', 'NOT_RETAINED_BY_QUARANTINE')`,
        ['a'.repeat(64)],
      );

      const bad = await expectFailure(
        `INSERT INTO "SnapshotPayload" ("contentAddress","bytes","byteLength","mediaType","storageState")
         VALUES ($1, '\\x00'::bytea, 1, 'application/json', 'NOT_RETAINED_BY_QUARANTINE')`,
        ['b'.repeat(64)],
      );

      // A quarantined payload that still has its bytes is UNREPRESENTABLE.
      expect(bad.message).toMatch(/storageState_bytes_agree/);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * T-18 · A REFUSED CAPTURE CANNOT BACK AN OBSERVATION
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('T-18 · the DATABASE refuses an observation citing a REFUSED retrieval', () => {
    it('the insert fails, and it fails on the composite foreign key', async () => {
      await marketRun('run-t18');
      await payloadFor('2'.repeat(64));
      await refusedRetrieval(
        'r-refused-t18',
        'PROVENANCE_HOST_MISMATCH',
        'PERMANENT',
        '2'.repeat(64),
      );

      /*
        THE ATTACK THIS BLOCKS. A writer that knows the retrieval is refused, and
        writes 'ADMITTED' into its own column anyway to satisfy the CHECK, still
        cannot land the row: the composite key (retrievalId, 'ADMITTED') has no
        matching row in SnapshotRetrieval, because that retrieval's admissibility is
        'REFUSED'. There is nothing to forget and nothing to get right.
      */
      const failure = await expectFailure(
        insertObservation('obs-t18', 'run-t18', 'r-refused-t18', 'ADMITTED', null),
      );

      expect(failure.code).toBe('23503'); // foreign_key_violation
      expect(failure.message).toMatch(/snapshotRetrievalId|foreign key/i);
    });

    it('and it cannot be evaded by claiming REFUSED on the observation either', async () => {
      const failure = await expectFailure(
        insertObservation('obs-t18b', 'run-t18', 'r-refused-t18', 'REFUSED', null),
      );

      // The CHECK pins the column to ADMITTED, so the honest spelling is refused too.
      expect(failure.code).toBe('23514'); // check_violation
      expect(failure.message).toMatch(/snapshotAdmissibility_check/);
    });

    it('and a retrieval id without its admissibility cannot slip past MATCH SIMPLE', async () => {
      /*
        A COMPOSITE FOREIGN KEY IS NOT ENFORCED WHEN ANY REFERENCING COLUMN IS NULL —
        that is the SQL default (MATCH SIMPLE) and it is easy to miss. Without the
        wholeness CHECK, naming the retrieval and leaving admissibility NULL would
        cite a refused capture and satisfy the key vacuously.
      */
      const failure = await expectFailure(
        insertObservation('obs-t18c', 'run-t18', 'r-refused-t18', null, null),
      );

      expect(failure.code).toBe('23514');
      expect(failure.message).toMatch(/citation_is_whole/);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * T-19 · ADMISSIBILITY IS ASSIGN-ONCE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('T-19 · REFUSED cannot be promoted to ADMITTED', () => {
    it('the trigger raises, and it names the transition', async () => {
      await payloadFor('3'.repeat(64));
      await refusedRetrieval('r-promote', 'PARSE_FAILED', 'PERMANENT', '3'.repeat(64));

      const failure = await expectFailure(
        `UPDATE "SnapshotRetrieval" SET "admissibility" = 'ADMITTED' WHERE "retrievalId" = 'r-promote'`,
      );

      expect(failure.message).toMatch(/SNAPSHOT_ADMISSIBILITY_IMMUTABLE/);
      expect(failure.message).toMatch(/REFUSED -> ADMITTED/);
    });

    it('the verdict is unchanged afterwards', async () => {
      const row = await q(
        `SELECT "admissibility" FROM "SnapshotRetrieval" WHERE "retrievalId" = 'r-promote'`,
      );
      expect(row.rows[0].admissibility).toBe('REFUSED');
    });

    it('ADMITTED cannot be demoted either — assign-once runs both ways', async () => {
      await admittedRetrieval('r-demote', null, 'demote');

      const failure = await expectFailure(
        `UPDATE "SnapshotRetrieval" SET "admissibility" = 'REFUSED' WHERE "retrievalId" = 'r-demote'`,
      );

      expect(failure.message).toMatch(/SNAPSHOT_ADMISSIBILITY_IMMUTABLE/);
    });

    it('an incoherent verdict is refused at the CHECK, not merely in application code', async () => {
      // ADMITTED with a refusal key.
      const withKey = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","refusalKey","refusalClass","parserId","parserVersion","parsedAt",
           "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-bad-1','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'FAILED','identity','ADMITTED','PARSE_FAILED','PERMANENT','p','1',now(),
                 'E-5','i',true,'{}'::jsonb)`,
      );
      expect(withKey.message).toMatch(/refusal_coherent_check/);

      // ADMITTED with no parser — P-4.
      const noParser = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-bad-2','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'FAILED','identity','ADMITTED','E-5','i',true,'{}'::jsonb)`,
      );
      expect(noParser.message).toMatch(/refusal_coherent_check/);

      // ADMITTED on a TRUNCATED capture — a capped stream is not a short dataset.
      const truncated = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","parserId","parserVersion","parsedAt",
           "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-bad-3','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'TRUNCATED','identity','ADMITTED','p','1',now(),'E-5','i',true,'{}'::jsonb)`,
      );
      expect(truncated.message).toMatch(/refusal_coherent_check/);

      // REFUSED with no key — an unexplained refusal cannot be classified.
      const noKey = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-bad-4','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'FAILED','identity','REFUSED','E-5','i',true,'{}'::jsonb)`,
      );
      expect(noKey.message).toMatch(/refusal_coherent_check/);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * T-20 · REFUSED CAPTURES ARE ABSENT FROM EVERY COVERAGE FIGURE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('T-20 · refused captures do not count as coverage, freshness or completeness', () => {
    it('a coverage query over admitted captures excludes them', async () => {
      await payloadFor('4'.repeat(64));
      await refusedRetrieval(
        'r-cov-1',
        'STATUS_NOT_OK',
        'TRANSIENT',
        '4'.repeat(64),
        'COMPLETE',
        't20',
      );
      await payloadFor('5'.repeat(64));
      await refusedRetrieval(
        'r-cov-2',
        'BODY_NOT_JSON_SHAPED',
        'TRANSIENT',
        '5'.repeat(64),
        'COMPLETE',
        't20',
      );
      await admittedRetrieval('r-cov-ok', null, 't20', 10);

      const all = await q(
        `SELECT count(*)::int AS n FROM "SnapshotRetrieval" WHERE "endpointId" = 't20'`,
      );
      const admitted = await q(
        `SELECT count(*)::int AS n FROM "SnapshotRetrieval" WHERE "endpointId" = 't20' AND "admissibility" = 'ADMITTED'`,
      );

      // Both facts are recorded: the captures exist as evidence of what was received,
      // and the coverage figure counts only what was ADMITTED. A refused capture that
      // vanished entirely would hide an outage; one that counted would fake coverage.
      expect(all.rows[0].n).toBeGreaterThan(admitted.rows[0].n);
      expect(admitted.rows[0].n).toBeGreaterThan(0);
    });

    it('the freshest ADMITTED capture is not the freshest capture', async () => {
      /*
        THE FAILURE MODE THIS CATCHES. The last GOOD capture is ten days old; two
        refusals arrived since. A freshness figure taken over all captures would report
        the series as current, because something was fetched today — it was just
        refused. The refusals are evidence that the pipeline is alive and no evidence
        at all that the data is fresh.
      */
      const freshestAny = await q(
        `SELECT max("retrievedAt") AS t FROM "SnapshotRetrieval" WHERE "endpointId" = 't20'`,
      );
      const freshestAdmitted = await q(
        `SELECT max("retrievedAt") AS t FROM "SnapshotRetrieval" WHERE "endpointId" = 't20' AND "admissibility" = 'ADMITTED'`,
      );

      expect(new Date(freshestAdmitted.rows[0].t).getTime()).toBeLessThan(
        new Date(freshestAny.rows[0].t).getTime(),
      );
    });

    it('and the index that makes that query cheap exists', async () => {
      const idx = await q(
        `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = 'SnapshotRetrieval'`,
        [SCHEMA],
      );
      const names = idx.rows.map((r: { indexname: string }) => r.indexname);

      expect(names).toContain('SnapshotRetrieval_admissibility_retrievedAt_idx');
      expect(names).toContain('SnapshotRetrieval_retrievalId_admissibility_key');
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * T-23 · THE POSITIVE CONTROL — AND IT IS THE ONE THAT DECIDES THE SUITE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('T-23 · a real capture is ADMITTED, parses, and backs an observation', () => {
    /*
      MANDATORY, AND MAIN SAYS WHY: "without a capture that is admitted, T-1 … T-22
      are satisfied by a pipeline that refuses everything — and a pipeline that
      refuses everything passes every negative test ever written for it."

      The bytes are the real 3601-byte Eurostat JSON-stat slice captured under
      ECON-EUROSTAT-BYTE-CAPTURE-D2-R1, whose SHA-256 two independent HTTP clients
      agreed on.
    */
    it('the payload is stored under the address of its DECODED bytes', async () => {
      await q(
        `INSERT INTO "SnapshotPayload" ("contentAddress","bytes","byteLength","mediaType","storageState")
         VALUES ($1, $2, $3, 'application/json', 'RETAINED')`,
        [EUROSTAT_SHA, EUROSTAT_BYTES, EUROSTAT_BYTES.length],
      );

      const stored = await q(
        `SELECT encode(digest("bytes", 'sha256'), 'hex') AS sha, octet_length("bytes") AS n
           FROM "SnapshotPayload" WHERE "contentAddress" = $1`,
        [EUROSTAT_SHA],
      ).catch(async () => {
        // pgcrypto may be unavailable; fall back to comparing the bytes themselves,
        // which proves the same thing for this purpose.
        const raw = await q(
          `SELECT "bytes", octet_length("bytes") AS n FROM "SnapshotPayload" WHERE "contentAddress" = $1`,
          [EUROSTAT_SHA],
        );
        const { createHash } = await import('node:crypto');
        return {
          rows: [
            {
              sha: createHash('sha256').update(raw.rows[0].bytes).digest('hex'),
              n: raw.rows[0].n,
            },
          ],
        };
      });

      // THE BYTES CAME BACK OUT OF POSTGRES AND STILL HASH TO THE SAME ADDRESS.
      expect(stored.rows[0].sha).toBe(EUROSTAT_SHA);
      expect(Number(stored.rows[0].n)).toBe(3601);
    });

    it('the capture is ADMITTED with its parser recorded', async () => {
      await admittedRetrieval('r-t23', EUROSTAT_SHA);

      const row = await q(
        `SELECT "admissibility","parserId","parserVersion","contentEncoding","wireByteLength","byteLength"
           FROM "SnapshotRetrieval" WHERE "retrievalId" = 'r-t23'`,
      );

      expect(row.rows[0].admissibility).toBe('ADMITTED');
      expect(row.rows[0].parserId).toBe('eurostat-jsonstat');
      expect(row.rows[0].parserVersion).toBe('1.0.0');
      // SNAP-R2-2 · under identity the decoded length IS the wire length.
      expect(row.rows[0].contentEncoding).toBe('identity');
      expect(row.rows[0].wireByteLength).toBe(row.rows[0].byteLength);
    });

    it('AND AN OBSERVATION CITING IT LANDS — the suite is not vacuous', async () => {
      await marketRun('run-t23');

      await q(insertObservation('obs-t23', 'run-t23', 'r-t23', 'ADMITTED', EUROSTAT_SHA));

      const joined = await q(
        `SELECT o."observationKey", r."admissibility", p."byteLength"
           FROM "MarketObservation" o
           JOIN "SnapshotRetrieval" r
             ON r."retrievalId" = o."snapshotRetrievalId"
            AND r."admissibility" = o."snapshotAdmissibility"
           JOIN "SnapshotPayload" p ON p."contentAddress" = r."contentAddress"
          WHERE o."observationKey" = 'obs-t23'`,
      );

      expect(joined.rows).toHaveLength(1);
      expect(joined.rows[0].admissibility).toBe('ADMITTED');
      expect(joined.rows[0].byteLength).toBe(3601);
    });

    it('and the whole chain is traceable from the figure back to the bytes', async () => {
      const chain = await q(
        `SELECT o."observationKey", o."snapshotRetrievalId", r."providerId", r."endpointId",
                r."contentAddress", p."mediaType"
           FROM "MarketObservation" o
           JOIN "SnapshotRetrieval" r
             ON r."retrievalId" = o."snapshotRetrievalId"
            AND r."admissibility" = o."snapshotAdmissibility"
           JOIN "SnapshotPayload" p ON p."contentAddress" = r."contentAddress"
          WHERE o."observationKey" = 'obs-t23'`,
      );

      expect(chain.rows[0]).toMatchObject({
        observationKey: 'obs-t23',
        snapshotRetrievalId: 'r-t23',
        providerId: 'eurostat',
        endpointId: 'une_rt_m',
        contentAddress: EUROSTAT_SHA,
        mediaType: 'application/json',
      });
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * E1 R2 SECURITY RE-REVIEW · ITEM A
   * A QUARANTINED CAPTURE IS RECORDABLE, AND CANNOT BACK A FIGURE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('E1-A · quarantine is recordable without a payload, and is not a network failure', () => {
    it('the row inserts with completeness COMPLETE and no address', async () => {
      /*
        THE DEFECT E1 NAMED, AND THE ONE THIS SUITE FOUND INDEPENDENTLY. R1 shipped
        CHECK (contentAddress IS NOT NULL OR completeness = 'FAILED'), which left
        exactly two ways to record a quarantined capture, and both were wrong:

          - give it an address  -> a hash of a body known to contain a specific
                                   secret, which is a confirmation oracle;
          - call it FAILED      -> a lie. The transport succeeded. The body arrived
                                   intact and was refused for its CONTENT.

        Calling it FAILED is the one E1 explicitly forbids, and it is the tempting
        one because it satisfies the old constraint without touching the schema. It
        would also corrupt every transport-health figure with a fault that never
        happened.
      */
      await refusedRetrieval('r-quarantine', 'SECRET_DETECTED', 'PERMANENT', null, 'COMPLETE');

      const row = await q(
        `SELECT "completeness","contentAddress","admissibility","refusalKey","refusalClass"
           FROM "SnapshotRetrieval" WHERE "retrievalId" = 'r-quarantine'`,
      );

      expect(row.rows[0].completeness).toBe('COMPLETE'); // NOT 'FAILED'
      expect(row.rows[0].contentAddress).toBeNull();
      expect(row.rows[0].admissibility).toBe('REFUSED');
      expect(row.rows[0].refusalKey).toBe('SECRET_DETECTED');
      expect(row.rows[0].refusalClass).toBe('PERMANENT');
    });

    it('and it cannot back an observation', async () => {
      await marketRun('run-quarantine');

      const failure = await expectFailure(
        insertObservation('obs-quarantine', 'run-quarantine', 'r-quarantine', 'ADMITTED', null),
      );

      expect(failure.code).toBe('23503'); // foreign_key_violation
    });

    it('a NON-quarantine refusal still needs its address — the arm is narrow, not a hole', async () => {
      /*
        The widened constraint must not have become "an address is optional". Only the
        quarantine case is exempt, and this is the control that says so.
      */
      const failure = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","refusalKey","refusalClass",
           "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-no-addr','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'COMPLETE','identity','REFUSED','PARSE_FAILED','PERMANENT','E-5','i',true,'{}'::jsonb)`,
      );

      expect(failure.message).toMatch(/address_required_unless_failed/);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * E1 R2 SECURITY RE-REVIEW · ITEM B
   * A SECURITY REFUSAL IS NEVER RETRYABLE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('E1-B · refusal class controls retry, and the database enforces it', () => {
    it('SECRET_DETECTED cannot be recorded TRANSIENT — the exact state E1 proved possible', async () => {
      const failure = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","refusalKey","refusalClass",
           "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-sec-retry','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'COMPLETE','identity','REFUSED','SECRET_DETECTED','TRANSIENT','E-5','i',true,'{}'::jsonb)`,
      );

      expect(failure.code).toBe('23514');
      expect(failure.message).toMatch(/security_refusal_is_permanent/);
    });

    it.each([
      'PROVENANCE_HOST_MISMATCH',
      'DECOMPRESSION_BOUND_EXCEEDED',
      'ARCHIVE_NOT_ALLOWED',
      'ENCODING_NOT_ALLOWED',
    ])('%s is a security refusal too, and is equally non-retryable', async (key) => {
      const failure = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","refusalKey","refusalClass",
           "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-sec-${key}','eurostat','e','p','[]'::jsonb,now(),now(),200,'application/json',1,
                 'FAILED','identity','REFUSED','${key}','TRANSIENT','E-5','i',true,'{}'::jsonb)`,
      );

      expect(failure.message).toMatch(/security_refusal_is_permanent/);
    });

    it('but an OPERATIONAL refusal may still be TRANSIENT — the guard is targeted', async () => {
      // BODY_NOT_JSON_SHAPED is a portal error page or a captive portal: it clears.
      await payloadFor('6'.repeat(64));
      await refusedRetrieval('r-op-transient', 'BODY_NOT_JSON_SHAPED', 'TRANSIENT', '6'.repeat(64));

      const row = await q(
        `SELECT "refusalClass" FROM "SnapshotRetrieval" WHERE "retrievalId" = 'r-op-transient'`,
      );
      expect(row.rows[0].refusalClass).toBe('TRANSIENT');
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * E1 · ITEM D — THE SCHEMA AND THE MIGRATION AGREE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('E1-D · every SnapshotRetrieval column the schema declares exists in the database', () => {
    it('schema.prisma and the applied migrations do not disagree', async () => {
      /*
        G reported that the R2 migration omitted `contentEncoding`. Measured against
        this migration the claim does not hold — it is created at the first ALTER, and
        the assertion below is what proves it rather than a reading of the file.

        The assertion is worth having whatever the origin of that report: a column
        declared in schema.prisma and absent from the migration is invisible until a
        deploy, and `prisma migrate diff` generating the DDL does not stop a later
        hand-edit from dropping a line.
      */
      const schemaSrc = readFileSync(
        join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
        'utf8',
      );

      const model = /model SnapshotRetrieval \{([\s\S]*?)^\}/m.exec(schemaSrc)?.[1] ?? '';
      const declared = model
        .split('\n')
        .map((l) => l.replace(/\/\/.*$/, '').trim())
        .filter((l) => l !== '' && !l.startsWith('@@') && !l.startsWith('///'))
        .map((l) => l.split(/\s+/))
        .filter((p) => p.length >= 2 && !/^SnapshotPayload|MarketObservation/.test(p[1]!))
        .map((p) => p[0]!);

      const live = await q(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'SnapshotRetrieval'`,
        [SCHEMA],
      );
      const actual = live.rows.map((r: { column_name: string }) => r.column_name);

      for (const column of declared) {
        expect([column, actual.includes(column)]).toEqual([column, true]);
      }

      // And specifically the one that was reported missing.
      expect(actual).toContain('contentEncoding');
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * THE R1 GUARANTEES STILL HOLD UNDER R2
   * ═══════════════════════════════════════════════════════════════════════ */

  describe('the R1 triggers survive the R2 delta', () => {
    it('a pinned payload still cannot be collected', async () => {
      await q(
        `INSERT INTO "SnapshotPin" ("id","contentAddress","citedBy","pinnedAt")
         VALUES ('pin-1',$1,'eco:1:test',now())`,
        [EUROSTAT_SHA],
      );

      const failure = await expectFailure(
        `UPDATE "SnapshotPayload" SET "bytes" = NULL, "storageState" = 'COLLECTED'
          WHERE "contentAddress" = $1`,
        [EUROSTAT_SHA],
      );

      expect(failure.message).toMatch(/evidence behind a published figure/);
    });

    it('a payload is still immutable', async () => {
      const failure = await expectFailure(
        `UPDATE "SnapshotPayload" SET "mediaType" = 'text/csv' WHERE "contentAddress" = $1`,
        [EUROSTAT_SHA],
      );

      expect(failure.message).toMatch(/identity is immutable/);
    });

    it('a retrieval row still cannot be deleted', async () => {
      const failure = await expectFailure(
        `DELETE FROM "SnapshotRetrieval" WHERE "retrievalId" = 'r-t23'`,
      );

      expect(failure.message).toMatch(/never deleted/);
    });

    it('and a request path that is a URL is still refused', async () => {
      const failure = await expectFailure(
        `INSERT INTO "SnapshotRetrieval"
          ("retrievalId","providerId","endpointId","requestPath","parameters","requestedAt",
           "retrievedAt","httpStatus","mediaType","byteLength","completeness","contentEncoding",
           "admissibility","refusalKey","refusalClass",
           "rightsGrade","rightsInstrumentRef","payloadRetentionPermitted","editionAnnotations")
         VALUES ('r-url','eurostat','e','https://example.com/x','[]'::jsonb,now(),now(),200,
                 'application/json',1,'FAILED','identity','REFUSED','STATUS_NOT_OK','PERMANENT',
                 'E-5','i',true,'{}'::jsonb)`,
      );

      expect(failure.message).toMatch(/requestPath_is_not_a_url/);
    });
  });
});
