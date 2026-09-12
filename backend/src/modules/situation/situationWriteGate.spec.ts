import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * D-4 — THE SITUATION WRITE GATE, MADE EXECUTABLE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1's C895 verdict is SAFE FOR ALPHA, and its safety rests on a set of facts
 * about this candidate rather than on a promise about it:
 *
 *     SITUATION STORAGE    = ACTIVE      (mounted; five tables exist)
 *     SITUATION PRODUCERS  = GATED       pending a bounded write contract for
 *                                        dimensions JSONB, features JSONB,
 *                                        reason and discriminatorBasis
 *
 * Facts drift. This file is what makes them fail loudly instead.
 *
 * WHAT IT DOES NOT DO, DELIBERATELY: it does not invent a producer, a route or
 * a validator to exercise the tables. The ruling forbids that, and a guard that
 * needed a producer in order to check that no producer exists would defeat
 * itself. Every assertion below is about ABSENCE, which is exactly the shape of
 * the thing being guaranteed.
 *
 * WHEN THE WRITE CONTRACT LANDS, THIS FILE IS THE PLACE IT ARRIVES. The
 * allow-list assertions that replace these will name the permitted data
 * categories and the prohibited identifiers, and the negative tests E1 requires
 * belong here beside them.
 */

const DIR = __dirname;
const read = (file: string): string => readFileSync(join(DIR, file), 'utf8');
const sources = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));

describe('D-4 · SITUATION PRODUCERS = GATED — no writer may be reachable', () => {
  it('scans a non-empty file set (positive control)', () => {
    /* Without this, every assertion below passes vacuously the day someone
       moves the module and the glob stops matching. */
    expect(sources.length).toBeGreaterThan(5);
  });

  it('the module declares NO controller — the property E1 relied on', () => {
    const module = read('situation.module.ts');
    expect(module).not.toMatch(/controllers\s*:/);
  });

  it('NO file in this namespace carries an HTTP decorator, so there is no route to reach', () => {
    for (const file of sources) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect({ file, http: /@(Controller|Get|Post|Put|Patch|Delete)\s*\(/.test(code) })
        .toEqual({ file, http: false });
    }
  });

  it('NOTHING outside this namespace imports SituationService — there is no call site', () => {
    /*
      The substrate exports its service so a future, contracted caller can use
      it. Until that caller exists with its write contract, having none is the
      gate. This is the assertion that notices the first one.
    */
    const backendSrc = join(DIR, '..', '..');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'situation' || entry.name === 'node_modules' || entry.name === 'generated') continue;
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        const code = readFileSync(full, 'utf8');
        if (/from\s+'[^']*modules\/situation\//.test(code) || /\bSituationService\b/.test(code)) {
          offenders.push(full.slice(backendSrc.length + 1));
        }
      }
    };

    walk(backendSrc);

    /* app.module.ts registers the module; that is the mount, not a writer, and
       it is named here rather than excluded silently. */
    expect(offenders).toEqual(['app.module.ts']);
  });
});

describe('IDENTITY INVARIANT — partitionKey is NON-UNIQUE, and stays that way', () => {
  const schema = readFileSync(join(DIR, '../../../prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    join(DIR, '../../../prisma/migrations/20260901050000_add_situation_memory/migration.sql'),
    'utf8',
  );

  it('the schema has NO standalone unique on partitionKey', () => {
    /*
      S1 declared `Situation.key UNIQUE` on the assumption that the key
      identified a situation. It is a coarse PARTITION — `sit:v1:RWA` holds
      every Rwandan situation — so a unique index there would force every
      Rwandan situation into one row: a false merge manufactured by a
      constraint instead of caught by tier 2. That correction is accepted and
      must not be undone.
    */
    const block = /^model Situation \{[\s\S]*?^\}/m.exec(schema)?.[0] ?? '';
    expect(block).toMatch(/@@unique\(\[partitionKey, keyVersion, discriminator\]\)/);
    expect(block).not.toMatch(/partitionKey\s+String\s+@unique/);
    expect((block.match(/@@unique/g) ?? []).length).toBe(1);
  });

  it('the migration creates exactly one unique index on Situation, and it is the triple', () => {
    const uniques = [...migration.matchAll(/CREATE UNIQUE INDEX "([^"]+)" ON "Situation"\(([^)]*)\)/g)];
    expect(uniques).toHaveLength(1);
    expect(uniques[0][2]).toBe('"partitionKey", "keyVersion", "discriminator"');
  });

  it('the partitionKey index that DOES exist is the non-unique one', () => {
    expect(migration).toMatch(
      /CREATE INDEX "Situation_partitionKey_keyVersion_idx" ON "Situation"\("partitionKey", "keyVersion"\)/,
    );
  });
});

describe('D-1 / D-3 · the rollback removes every object the forward migration creates', () => {
  const dir = join(DIR, '../../../prisma/migrations/20260901050000_add_situation_memory');
  const forward = readFileSync(join(dir, 'migration.sql'), 'utf8');
  const down = readFileSync(join(dir, 'DOWN.sql'), 'utf8');

  it('the schema-level FUNCTION is dropped — it does not go with its table', () => {
    expect(forward).toMatch(/CREATE OR REPLACE FUNCTION "situation_identity_is_assign_once"\(\)/);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS "situation_identity_is_assign_once"\(\);/);
  });

  it('every CREATE TABLE has a matching guarded DROP TABLE', () => {
    const created = [...forward.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort();
    const dropped = [...down.matchAll(/DROP TABLE IF EXISTS "([^"]+)";/g)].map((m) => m[1]).sort();
    expect(dropped).toEqual(created);
  });

  it('every foreign key added is dropped by name', () => {
    const added = [...forward.matchAll(/ADD CONSTRAINT "([^"]+_fkey)"/g)].map((m) => m[1]).sort();
    const dropped = [...down.matchAll(/DROP CONSTRAINT IF EXISTS "([^"]+_fkey)";/g)].map((m) => m[1]).sort();
    expect(dropped).toEqual(added);
  });

  it('D-3 — every destructive statement is guarded, so a second run is not an error', () => {
    const statements = down
      .split('\n')
      .filter((line) => /^(DROP|ALTER) /.test(line.trim()));

    for (const statement of statements) {
      expect({ statement, guarded: /IF EXISTS/.test(statement) }).toEqual({ statement, guarded: true });
    }
  });

  it('D-3 — the trigger drop is guarded on the TABLE, not only on the trigger', () => {
    /* `DROP TRIGGER IF EXISTS x ON "Situation"` still raises
       `relation "Situation" does not exist` on a second run: PostgreSQL's
       IF EXISTS there covers the trigger, not the table. */
    expect(down).toMatch(/to_regclass\('"Situation"'\) IS NOT NULL/);
  });

  it('D-2 — the forward header points at the rollback artifact that actually exists', () => {
    expect(forward).toMatch(/ROLLBACK: see DOWN\.sql, beside this file/);
    expect(forward).not.toMatch(/see rollback\/20260901050000_add_situation_memory\.down\.sql —/);
  });

  it('the forward migration still performs ZERO drops', () => {
    expect(forward).not.toMatch(/^\s*DROP /m);
  });
});
