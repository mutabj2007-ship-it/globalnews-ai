import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = join(__dirname, '../../../prisma');
const sql = readFileSync(
  join(root, 'migrations/20260922130000_security_evidence_r2/migration.sql'),
  'utf8',
);
const down = readFileSync(
  join(root, 'migrations/20260922130000_security_evidence_r2/DOWN.sql'),
  'utf8',
);
describe('R2 migration conformance; execution is separately verified by the local PostgreSQL probe', () => {
  test.each([
    'SecurityProjectionRun',
    'SecurityProjectionCompletion',
    'SecurityObservation',
    'SecurityProjectionMember',
  ])('creates %s', (table) => expect(sql).toContain('CREATE TABLE "' + table + '"'));
  test.each(['ownershipT1', 'ownershipT2'])('requires non-null %s', (column) =>
    expect(sql).toContain('"' + column + '" BOOLEAN NOT NULL'),
  );
  test('requires positively true T1', () => expect(sql).toContain('"ownershipT1" IS TRUE'));
  test('requires positively false T2', () => expect(sql).toContain('"ownershipT2" IS FALSE'));
  test('has no destructive forward DDL', () =>
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE TABLE|ALTER TABLE "Article"/));
  test('revision key is composite', () =>
    expect(sql).toContain('("observationKey", "revisionOrdinal")'));
  test('one projection per run and identity', () =>
    expect(sql).toContain('("runId", "observationKey")'));
  test('append validation is database enforced', () =>
    expect(sql).toContain('security_observation_append BEFORE INSERT'));
  test('completed projections are sealed', () =>
    expect(sql).toContain('Completed projections are sealed'));
  test('completion counts are verified', () => expect(sql).toContain('Projection count mismatch'));
  test('requires contiguous historical ordinals', () =>
    expect(sql).toContain('coalesce(last_ordinal + 1, 0)'));
  test('all four tables reject mutation', () =>
    expect(sql.match(/BEFORE UPDATE OR DELETE/g)).toHaveLength(4));
  test('rollback refuses retained evidence', () =>
    expect(down).toContain('Retained Security audit evidence'));
  test('rollback removes the functions it introduced', () => {
    for (const name of [
      'security_r2_immutable',
      'security_r2_validate_append',
      'security_r2_validate_completion',
    ])
      expect(down).toContain('DROP FUNCTION ' + name + '()');
  });
});
