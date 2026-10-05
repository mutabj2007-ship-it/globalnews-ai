import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import { ASK_LANGUAGES } from './ask-compute.contract';

/**
 * ASK SEVEN-LANGUAGE PERSISTENCE R1 — the database CHECK and the DTO language set are one
 * contract. They drifted once (CHECK ('en','pl') vs seven accepted locales) and every
 * fr/de/es/pt/ar thread failed on insert. This reads the SQL on every commit, so the next
 * locale added to DISPLAY_LOCALES fails here until a migration widens the CHECK too.
 * The real-database proof is ask-v2.seven-language.postgres.spec.ts.
 */
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'prisma', 'migrations');
const strip = (sql: string) => sql.replace(/--.*$/gm, '');
const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => ({
    name,
    sql: strip(readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8')),
  }));

/** The value list of the LAST migration that (re)defines the named CHECK. */
function effectiveCheck(constraint: string): { migration: string; values: string[] } {
  const pattern = new RegExp(
    `ADD CONSTRAINT "${constraint}"\\s+CHECK \\(\\s*"language" IN \\(([^)]*)\\)\\s*\\)`,
    'g',
  );
  let found: { migration: string; values: string[] } | null = null;
  for (const { name, sql } of migrations) {
    for (const match of sql.matchAll(pattern)) {
      found = {
        migration: name,
        values: match[1].split(',').map((v) => v.trim().replace(/^'|'$/g, '')),
      };
    }
  }
  if (!found) throw new Error(`no migration defines ${constraint}`);
  return found;
}

describe('Ask language persistence contract', () => {
  test('ASK_LANGUAGES is the shared DISPLAY_LOCALES authority', () => {
    expect([...ASK_LANGUAGES]).toEqual([...DISPLAY_LOCALES]);
  });

  test.each(['AskThread_language', 'AskTurn_language'])(
    '%s CHECK admits exactly the accepted languages',
    (constraint) => {
      const { migration, values } = effectiveCheck(constraint);
      expect(migration).toBe('20261005100000_ask_seven_language_persistence');
      expect([...values].sort()).toEqual([...ASK_LANGUAGES].sort());
    },
  );

  test('the widening migration only relaxes: it rewrites, relabels and deletes nothing', () => {
    const { sql } = migrations.find(
      (m) => m.name === '20261005100000_ask_seven_language_persistence',
    )!;
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP TABLE|DROP COLUMN|INSERT)\b/i);
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(4);
    for (const s of statements) expect(s).toMatch(/^ALTER TABLE "Ask(Thread|Turn)" /);
  });
});
