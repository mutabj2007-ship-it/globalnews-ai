import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GX-14 · THE GRANT PROOF — MEASURED AS THE ROLE, NOT AS THE OWNER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-GX14-AUTHORITY-STORE-R1.
 *
 * E1's measurement gate, control 4: "The grant assertions run AS THE ROLE, not as the
 * owner. A check executed as a superuser measures nothing."
 *
 * So every assertion below opens its own connection, authenticated as the role under
 * test, and asks the database. Nothing here reads a config file, and nothing infers a
 * privilege from the SQL that was supposed to have granted it — the whole point of the
 * gate is that the grant either took effect or did not.
 *
 * DISPOSABLE LOCAL POSTGRES ONLY. The runner refuses a non-local host; Railway, Alpha
 * and Production are out of scope by ruling. Each run builds its own schemas and roles
 * with a random suffix and drops them, so concurrent runs cannot collide.
 *
 * ── R-B, AND WHY IT IS THE CONTROL THAT MATTERS ───────────────────────────
 *
 * "A store with ZERO protected records satisfies every 'a reader cannot read protected
 * geometry' assertion." Every fixture below therefore includes a genuinely protected
 * synthetic record whose full geometry IS in the authority store, and an unprotected
 * one that is genuinely drawable — one dark cohort and one bright cohort, as the brief
 * requires. Without both, this file would pass while measuring nothing.
 */

const DB_URL = process.env['SNAPSHOT_TEST_DATABASE_URL'];

const describeLive = DB_URL ? describe : describe.skip;

if (!DB_URL) {
  // Loud, not silent. A suite that quietly reports success without a database is how
  // "proven against Postgres" becomes false without anybody lying.
  // eslint-disable-next-line no-console
  console.warn(
    '\n  GX-14 LIVE PROOF SKIPPED — SNAPSHOT_TEST_DATABASE_URL is not set.\n' +
      '  These assertions are UNMEASURED, not passing.\n',
  );
}

const SQL = readFileSync(join(__dirname, 'sql', 'gx14-authority-store.sql'), 'utf8');

const SUFFIX = randomBytes(4).toString('hex');
const AUTH_SCHEMA = `hum_authority_${SUFFIX}`;
const READ_SCHEMA = `hum_reader_${SUFFIX}`;
const ROLE = (base: string): string => `${base}_${SUFFIX}`;
const PASSWORD = randomBytes(12).toString('hex');

/** The script is written against fixed names; each run rewrites them to its own. */
function scopedSql(): string {
  return SQL.replace(/hum_authority\b/g, AUTH_SCHEMA)
    .replace(/hum_reader\b/g, READ_SCHEMA)
    .replace(/hum_authority_writer\b/g, ROLE('hum_authority_writer'))
    .replace(/hum_projection_writer\b/g, ROLE('hum_projection_writer'))
    .replace(/hum_reader_role\b/g, ROLE('hum_reader_role'))
    .replace(/hum_producer_role\b/g, ROLE('hum_producer_role'));
}

/*
  The replace above would also rewrite the ROLE names inside the schema names, so the
  order matters and is fragile. Guarded rather than trusted: the generated SQL is
  asserted to contain the four role names exactly once per CREATE ROLE.
*/

async function connectAs(role?: string): Promise<Client> {
  const url = new URL(DB_URL as string);
  if (role !== undefined) {
    url.username = role;
    url.password = PASSWORD;
  }
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  return client;
}

async function asRole<T>(role: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = await connectAs(role);
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Runs a statement and returns the SQLSTATE, or null when it succeeded. */
async function sqlstateOf(client: Client, sql: string): Promise<string | null> {
  try {
    await client.query(sql);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'UNKNOWN';
  }
}

const INSUFFICIENT_PRIVILEGE = '42501';
const UNDEFINED_TABLE = '42P01';
/** Either is a refusal. Postgres hides a table you have no schema USAGE on. */
const REFUSED = [INSUFFICIENT_PRIVILEGE, UNDEFINED_TABLE];

describeLive('GX-14 · the authority store, measured as the actual roles', () => {
  let owner: Client;

  beforeAll(async () => {
    owner = await connectAs();

    const sql = scopedSql();
    // The guard on the fragile rewrite above.
    for (const base of [
      'hum_authority_writer',
      'hum_projection_writer',
      'hum_reader_role',
      'hum_producer_role',
    ]) {
      expect(sql).toContain(`CREATE ROLE ${ROLE(base)} NOLOGIN`);
    }

    await owner.query(sql);

    // Give each group role a LOGIN so the proof can authenticate AS it. This is the
    // step that makes the assertions real rather than inferred.
    for (const base of [
      'hum_authority_writer',
      'hum_projection_writer',
      'hum_reader_role',
      'hum_producer_role',
    ]) {
      await owner.query(`ALTER ROLE ${ROLE(base)} LOGIN PASSWORD '${PASSWORD}'`);
    }

    /* ── THE FIXTURE · ONE DARK COHORT, ONE BRIGHT COHORT ──────────────── */
    await owner.query(`
      INSERT INTO ${AUTH_SCHEMA}.protected_class
        (class_id, declared_at, basis, partition_unit_level)
      VALUES ('CLASS-P', '2026-01-01T00:00:00Z', 'synthetic declared class', 'DISTRICT');

      INSERT INTO ${AUTH_SCHEMA}.protected_partition
        (partition_key, unit_level, declared_at, minimum_membership,
         declared_eligible_membership, covers_class_ids,
         register_id, register_edition, eligibility_predicate, authored_at)
      VALUES ('PART-DARK', 'DISTRICT', '2026-01-01T00:00:00Z', 5, 40, ARRAY['CLASS-P'],
              'SYNTHETIC-ADMIN-REGISTER', '2026.1',
              'every district whose register-declared population is below 50000',
              '2026-01-01T00:00:00Z');

      INSERT INTO ${AUTH_SCHEMA}.authority_epoch (epoch, source_digest, loaded_at)
      VALUES (1, repeat('a', 64), '2026-01-02T00:00:00Z');

      -- THE PROTECTED RECORD. Its full geometry is genuinely here. R-B depends on it.
      INSERT INTO ${AUTH_SCHEMA}.geometry_record
        (record_key, protection_class_id, presentation_partition_key, emitting_domain_id,
         kind, denotation, origin, crs, coordinates, source_id, relation_to_assertion)
      VALUES ('rec-dark', 'CLASS-P', 'PART-DARK', 'DOM-1',
              'POINT', 'AFFECTED_AREA', 'SOURCE_NATIVE', 'EPSG:4326',
              '{"type":"Point","coordinates":[11.5,48.25]}'::jsonb,
              'SYNTHETIC-SRC-1', 'THE_ASSERTION');

      -- THE BRIGHT RECORD.
      INSERT INTO ${AUTH_SCHEMA}.geometry_record
        (record_key, protection_class_id, presentation_partition_key, emitting_domain_id,
         kind, denotation, origin, crs, coordinates, source_id, relation_to_assertion)
      VALUES ('rec-bright', NULL, 'PART-LIGHT', 'DOM-1',
              'POINT', 'AFFECTED_AREA', 'SOURCE_NATIVE', 'EPSG:4326',
              '{"type":"Point","coordinates":[2.35,48.85]}'::jsonb,
              'SYNTHETIC-SRC-1', 'THE_ASSERTION');

      -- The projection: one row per record, ALWAYS.
      INSERT INTO ${READ_SCHEMA}.reader_row
        (record_key, row_kind, withheld, projection, projected_under_epoch)
      VALUES
        ('rec-dark',   'WITHHELD',  'NOT_SHOWN', NULL, 1),
        ('rec-bright', 'PROJECTED', NULL,
         '{"recordKey":"rec-bright","render":"NATIVE","kind":"POINT","denotation":"AFFECTED_AREA","origin":"SOURCE_NATIVE","crs":"EPSG:4326","coordinates":{"type":"Point","coordinates":[2.35,48.85]},"sourceId":"SYNTHETIC-SRC-1","relationToAssertion":"THE_ASSERTION"}'::jsonb,
         1);
    `);
  }, 120_000);

  afterAll(async () => {
    if (!owner) return;
    await owner.query(`DROP SCHEMA IF EXISTS ${READ_SCHEMA} CASCADE`);
    await owner.query(`DROP SCHEMA IF EXISTS ${AUTH_SCHEMA} CASCADE`);
    for (const base of [
      'hum_authority_writer',
      'hum_projection_writer',
      'hum_reader_role',
      'hum_producer_role',
    ]) {
      await owner.query(`DROP OWNED BY ${ROLE(base)} CASCADE`).catch(() => undefined);
      await owner.query(`DROP ROLE IF EXISTS ${ROLE(base)}`).catch(() => undefined);
    }
    await owner.end();
  }, 120_000);

  /* ══════════════════════════════════════════════════════════════════════
   * R-B · THE CONTROL THAT MAKES THE REST MEAN SOMETHING
   * ══════════════════════════════════════════════════════════════════════ */

  it('R-B · a genuinely protected record with real geometry IS in the authority store', async () => {
    /*
      Without this, every "the reader cannot read protected geometry" assertion below is
      satisfied by a store that contains no protected geometry at all. E1 names this
      exact vacuity as the thing that would let an empty set pass the whole gate.
    */
    const dark = await owner.query(
      `SELECT coordinates FROM ${AUTH_SCHEMA}.geometry_record WHERE record_key = 'rec-dark'`,
    );
    expect(dark.rows).toHaveLength(1);
    expect(dark.rows[0].coordinates).toEqual({ type: 'Point', coordinates: [11.5, 48.25] });

    const bright = await owner.query(
      `SELECT protection_class_id FROM ${AUTH_SCHEMA}.geometry_record WHERE record_key = 'rec-bright'`,
    );
    expect(bright.rows[0].protection_class_id).toBeNull();
  });

  /* ══════════════════════════════════════════════════════════════════════
   * A · PERSISTENCE — GA-38, GA-39, GA-40
   * ══════════════════════════════════════════════════════════════════════ */

  it('GA-38 · the two stores are physically separate schemas with distinct owners', async () => {
    const owners = await owner.query(
      `SELECT nspname, pg_get_userbyid(nspowner) AS owner
         FROM pg_namespace WHERE nspname IN ($1, $2) ORDER BY nspname`,
      [AUTH_SCHEMA, READ_SCHEMA],
    );

    expect(owners.rows).toHaveLength(2);
    const byName = Object.fromEntries(owners.rows.map((r) => [r.nspname, r.owner]));
    expect(byName[AUTH_SCHEMA]).toBe(ROLE('hum_authority_writer'));
    expect(byName[READ_SCHEMA]).toBe(ROLE('hum_projection_writer'));
    // Distinct owners, not two tables in one schema behind an application filter.
    expect(byName[AUTH_SCHEMA]).not.toBe(byName[READ_SCHEMA]);
  });

  it('GA-38 · the reader store column set is CLOSED and holds no coordinate column', async () => {
    const cols = await owner.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'reader_row' ORDER BY column_name`,
      [READ_SCHEMA],
    );

    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'projected_under_epoch',
      'projection',
      'record_key',
      'row_kind',
      'withheld',
    ]);
  });

  it('GA-38 MUTATION · adding a coordinates column makes the closed-set check fail', async () => {
    await owner.query(`ALTER TABLE ${READ_SCHEMA}.reader_row ADD COLUMN coordinates jsonb`);
    try {
      const cols = await owner.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'reader_row' ORDER BY column_name`,
        [READ_SCHEMA],
      );
      const names = cols.rows.map((r) => r.column_name);

      // The check the previous test makes now fails, which is the mutation firing.
      expect(names).toContain('coordinates');
      expect(names).not.toEqual([
        'projected_under_epoch',
        'projection',
        'record_key',
        'row_kind',
        'withheld',
      ]);
    } finally {
      await owner.query(`ALTER TABLE ${READ_SCHEMA}.reader_row DROP COLUMN coordinates`);
    }
  });

  it('GA-39 · protecting a record REPLACES its row and leaves cardinality unchanged', async () => {
    const before = await owner.query(`SELECT count(*)::int AS n FROM ${READ_SCHEMA}.reader_row`);

    // rec-bright becomes protected: the projection job replaces the row in place.
    await owner.query(`
      UPDATE ${READ_SCHEMA}.reader_row
         SET row_kind = 'WITHHELD', withheld = 'NOT_SHOWN', projection = NULL
       WHERE record_key = 'rec-bright'
    `);

    const after = await owner.query(`SELECT count(*)::int AS n FROM ${READ_SCHEMA}.reader_row`);
    expect(after.rows[0].n).toBe(before.rows[0].n);

    // The row is PRESENT and withheld, never deleted. A hole is a position.
    const row = await owner.query(
      `SELECT row_kind, withheld FROM ${READ_SCHEMA}.reader_row WHERE record_key = 'rec-bright'`,
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toEqual({ row_kind: 'WITHHELD', withheld: 'NOT_SHOWN' });

    // Restore for the remaining tests.
    await owner.query(`
      UPDATE ${READ_SCHEMA}.reader_row
         SET row_kind = 'PROJECTED', withheld = NULL,
             projection = '{"recordKey":"rec-bright","withheld":"NOT_SHOWN"}'::jsonb
       WHERE record_key = 'rec-bright'
    `);
  });

  it('GA-40 · a row left at an older epoch is detectable, so a partial re-projection refuses', async () => {
    await owner.query(
      `UPDATE ${READ_SCHEMA}.reader_row SET projected_under_epoch = 1 WHERE record_key = 'rec-dark'`,
    );
    await owner.query(
      `UPDATE ${READ_SCHEMA}.reader_row SET projected_under_epoch = 2 WHERE record_key = 'rec-bright'`,
    );

    const stale = await owner.query(
      `SELECT count(*)::int AS n FROM ${READ_SCHEMA}.reader_row WHERE projected_under_epoch < 2`,
    );
    expect(stale.rows[0].n).toBe(1);

    await owner.query(`UPDATE ${READ_SCHEMA}.reader_row SET projected_under_epoch = 2`);
    const clean = await owner.query(
      `SELECT count(*)::int AS n FROM ${READ_SCHEMA}.reader_row WHERE projected_under_epoch < 2`,
    );
    expect(clean.rows[0].n).toBe(0);
  });

  it('THE READER STORE REFUSES R3 INTERNAL REASONS — the PROTECTED fact cannot be stored', async () => {
    /*
      The wall behind the type. `PROTECTED` is a member of R3's internal
      GeometryWithheldReason union, and a writer bypassing the TypeScript constructor
      would put it in this column. The database refuses it.
    */
    const code = await sqlstateOf(
      owner,
      `UPDATE ${READ_SCHEMA}.reader_row SET withheld = 'PROTECTED' WHERE record_key = 'rec-dark'`,
    );
    expect(code).toBe('23514'); // check_violation
  });

  /* ══════════════════════════════════════════════════════════════════════
   * B · GRANTS — GA-20, GA-41, GA-42, GA-43
   * ══════════════════════════════════════════════════════════════════════ */

  it('GA-20 / GA-41 · the reader role has NO privilege of any kind on the authority store', async () => {
    await asRole(ROLE('hum_reader_role'), async (reader) => {
      // Asked of the database, as the role — not read from a config file.
      const grants = await reader.query(
        `SELECT privilege_type, table_name FROM information_schema.role_table_grants
          WHERE table_schema = $1 AND grantee = $2`,
        [AUTH_SCHEMA, ROLE('hum_reader_role')],
      );
      expect(grants.rows).toEqual([]);

      const usage = await reader.query(`SELECT has_schema_privilege($1, $2, 'USAGE') AS u`, [
        ROLE('hum_reader_role'),
        AUTH_SCHEMA,
      ]);
      expect(usage.rows[0].u).toBe(false);

      // And the attempt itself is refused, which is the assertion that matters.
      const code = await sqlstateOf(
        reader,
        `SELECT coordinates FROM ${AUTH_SCHEMA}.geometry_record WHERE record_key = 'rec-dark'`,
      );
      expect(REFUSED).toContain(code);
    });
  });

  it('GA-20 MUTATION · granting the reader SELECT on the authority store makes it FAIL', async () => {
    await owner.query(`GRANT USAGE ON SCHEMA ${AUTH_SCHEMA} TO ${ROLE('hum_reader_role')}`);
    await owner.query(
      `GRANT SELECT ON ${AUTH_SCHEMA}.geometry_record TO ${ROLE('hum_reader_role')}`,
    );
    try {
      await asRole(ROLE('hum_reader_role'), async (reader) => {
        const r = await reader.query(
          `SELECT coordinates FROM ${AUTH_SCHEMA}.geometry_record WHERE record_key = 'rec-dark'`,
        );
        // The protected geometry is now readable — the control is gone, and the proof
        // says so out loud rather than quietly continuing to pass.
        expect(r.rows[0].coordinates).toEqual({ type: 'Point', coordinates: [11.5, 48.25] });
      });
    } finally {
      await owner.query(
        `REVOKE SELECT ON ${AUTH_SCHEMA}.geometry_record FROM ${ROLE('hum_reader_role')}`,
      );
      await owner.query(`REVOKE USAGE ON SCHEMA ${AUTH_SCHEMA} FROM ${ROLE('hum_reader_role')}`);
    }

    // And the control is restored — otherwise the mutation would leave the gate open.
    await asRole(ROLE('hum_reader_role'), async (reader) => {
      const code = await sqlstateOf(
        reader,
        `SELECT coordinates FROM ${AUTH_SCHEMA}.geometry_record WHERE record_key = 'rec-dark'`,
      );
      expect(REFUSED).toContain(code);
    });
  });

  it('GA-42 · the reader role cannot WRITE the reader store either', async () => {
    await asRole(ROLE('hum_reader_role'), async (reader) => {
      // It can read — the safe projection remains available.
      const rows = await reader.query(
        `SELECT record_key, row_kind, withheld FROM ${READ_SCHEMA}.reader_row ORDER BY record_key`,
      );
      expect(rows.rows.map((r) => r.record_key)).toEqual(['rec-bright', 'rec-dark']);

      for (const statement of [
        `UPDATE ${READ_SCHEMA}.reader_row SET withheld = 'NOT_SHOWN'`,
        `INSERT INTO ${READ_SCHEMA}.reader_row (record_key, row_kind, withheld, projected_under_epoch) VALUES ('x','WITHHELD','NOT_SHOWN',2)`,
        `DELETE FROM ${READ_SCHEMA}.reader_row`,
      ]) {
        expect([statement, await sqlstateOf(reader, statement)]).toEqual([
          statement,
          INSUFFICIENT_PRIVILEGE,
        ]);
      }
    });
  });

  it('GA-43 · the producer can write geometry and cannot touch a declaration', async () => {
    await asRole(ROLE('hum_producer_role'), async (producer) => {
      // It CAN do its job.
      const wrote = await sqlstateOf(
        producer,
        `INSERT INTO ${AUTH_SCHEMA}.geometry_record
           (record_key, protection_class_id, presentation_partition_key, emitting_domain_id,
            kind, denotation, origin, crs, coordinates, source_id, relation_to_assertion)
         VALUES ('rec-producer', NULL, 'PART-LIGHT', 'DOM-1', 'POINT', 'AFFECTED_AREA',
                 'SOURCE_NATIVE', 'EPSG:4326', '{"type":"Point","coordinates":[0,0]}'::jsonb,
                 'SYNTHETIC-SRC-1', 'THE_ASSERTION')`,
      );
      expect(wrote).toBeNull();

      /*
        AND IT CANNOT DECLARE. E1: "A producer that could declare a class could
        un-declare one." Both directions are tested, because the dangerous one is the
        second and it is the one a permissions review tends to miss.
      */
      for (const statement of [
        `INSERT INTO ${AUTH_SCHEMA}.protected_class (class_id, declared_at, basis, partition_unit_level) VALUES ('CLASS-X','2026-01-01T00:00:00Z','forged','DISTRICT')`,
        `DELETE FROM ${AUTH_SCHEMA}.protected_class WHERE class_id = 'CLASS-P'`,
        `UPDATE ${AUTH_SCHEMA}.protected_partition SET minimum_membership = 2`,
        `DELETE FROM ${AUTH_SCHEMA}.protected_partition WHERE partition_key = 'PART-DARK'`,
        `SELECT * FROM ${AUTH_SCHEMA}.protected_class`,
      ]) {
        expect([statement, await sqlstateOf(producer, statement)]).toEqual([
          statement,
          INSUFFICIENT_PRIVILEGE,
        ]);
      }
    });

    await owner.query(
      `DELETE FROM ${AUTH_SCHEMA}.geometry_record WHERE record_key = 'rec-producer'`,
    );
  });

  it('the safe projection REMAINS AVAILABLE to the reader — one dark, one bright', async () => {
    /*
      The negative control's counterpart. A configuration that refused the reader
      everything would pass every assertion above and serve no map at all.
    */
    await asRole(ROLE('hum_reader_role'), async (reader) => {
      const rows = await reader.query(
        `SELECT record_key, row_kind, withheld, projection
           FROM ${READ_SCHEMA}.reader_row ORDER BY record_key`,
      );

      expect(rows.rows).toHaveLength(2);

      const dark = rows.rows.find((r) => r.record_key === 'rec-dark');
      expect(dark.row_kind).toBe('WITHHELD');
      expect(dark.withheld).toBe('NOT_SHOWN');
      expect(dark.projection).toBeNull();

      const bright = rows.rows.find((r) => r.record_key === 'rec-bright');
      expect(bright.row_kind).toBe('PROJECTED');
      expect(bright.projection).not.toBeNull();

      // And nowhere in what the reader can see is there a coordinate for the dark one.
      expect(JSON.stringify(rows.rows)).not.toContain('11.5');
      expect(JSON.stringify(rows.rows)).not.toContain('48.25');
    });
  });

  /* ══════════════════════════════════════════════════════════════════════
   * C · AS-E1-4 · ORDER IS NOT A FUNCTION OF ROW KIND — GA-47
   * ══════════════════════════════════════════════════════════════════════ */

  it('GA-47 · the reader ordering is identical whether or not a member is withheld', async () => {
    /*
      E1's channel: a response ordered by anything correlated with row kind
      reintroduces at the STORE layer the ordering channel R3 closed at the
      presentation layer. Measured with the protected member first, last and only.
    */
    await owner.query(`DELETE FROM ${READ_SCHEMA}.reader_row`);
    const keys = ['aaa', 'mmm', 'zzz'];
    for (const k of keys) {
      await owner.query(
        `INSERT INTO ${READ_SCHEMA}.reader_row (record_key, row_kind, withheld, projection, projected_under_epoch)
         VALUES ($1, 'PROJECTED', NULL, '{"recordKey":"x","withheld":"NOT_SHOWN"}'::jsonb, 2)`,
        [k],
      );
    }

    const orderOf = async (): Promise<string[]> =>
      asRole(ROLE('hum_reader_role'), async (reader) => {
        const r = await reader.query(
          `SELECT record_key FROM ${READ_SCHEMA}.reader_row ORDER BY record_key`,
        );
        return r.rows.map((x) => x.record_key);
      });

    const allBright = await orderOf();
    expect(allBright).toEqual(keys);

    for (const protectedKey of keys) {
      await owner.query(`UPDATE ${READ_SCHEMA}.reader_row
           SET row_kind = 'PROJECTED', withheld = NULL,
               projection = '{"recordKey":"x","withheld":"NOT_SHOWN"}'::jsonb`);
      await owner.query(
        `UPDATE ${READ_SCHEMA}.reader_row
            SET row_kind = 'WITHHELD', withheld = 'NOT_SHOWN', projection = NULL
          WHERE record_key = $1`,
        [protectedKey],
      );

      expect([protectedKey, await orderOf()]).toEqual([protectedKey, keys]);
    }
  });
});
