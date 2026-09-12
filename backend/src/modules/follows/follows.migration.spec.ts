import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ALL_ISO3_CODES, MAX_FOLLOWED_COUNTRIES } from '@globalnews-ai/shared';
import { ProductEventName } from '../../generated/prisma/enums';
import { MAX_COUNTRY_FOLLOWS } from './follows.constants';

/**
 * R1 + R3 — the migration is additive and destroys nothing.
 *
 * WHY THIS FILE EXISTS AT ALL. A migration is the one artefact in this
 * repository that can destroy data, and it runs in an environment where
 * nobody is watching. Reading it carefully once is not a substitute for
 * a test that reads it on every commit, so this parses the SQL and fails
 * on any destructive statement — the same technique
 * `supportContract.spec.ts` applies to the S1 migration.
 */
const BACKEND_ROOT = join(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = join(BACKEND_ROOT, 'prisma', 'migrations');
const MIGRATION_DIR = '20260823140000_add_return_state_follows_and_telemetry';
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, MIGRATION_DIR, 'migration.sql'), 'utf8');
const SCHEMA = readFileSync(join(BACKEND_ROOT, 'prisma', 'schema.prisma'), 'utf8');

/**
 * SQL statements with comments stripped, split on the terminator.
 *
 * Comments are removed FIRST and deliberately: this migration explains
 * in prose why it uses SET NULL rather than CASCADE, and a scan that
 * matched the word inside that explanation would punish the explanation.
 */
const statements = MIGRATION.replace(/^--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

describe('R1 + R3 — ONE ordered migration window', () => {
  it('is registered as a single migration directory alongside the existing six', () => {
    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(dirs).toContain(MIGRATION_DIR);
    // ONE window for all three tasks, so a rollback is a single coherent
    // step rather than three interleaved ones.
    expect(dirs.filter((dir) => dir.includes('return_state'))).toHaveLength(1);
  });

  it('creates everything R1 and R3 need, in one file', () => {
    expect(MIGRATION).toContain('ALTER TABLE "User" ADD COLUMN     "lastSeenAt"');
    expect(MIGRATION).toContain('CREATE TABLE "CountryFollow"');
    expect(MIGRATION).toContain('CREATE TYPE "ProductEventName"');
    expect(MIGRATION).toContain('CREATE TABLE "ProductEvent"');
    expect(MIGRATION).toContain('CREATE TABLE "AnalysisRun"');
  });
});

describe('R1 + R3 — nothing existing is touched', () => {
  it('contains NO destructive or mutating statement', () => {
    statements.forEach((statement) => {
      const head = statement.slice(0, 60);
      // Anchored at the statement start: "ON DELETE CASCADE" is part of
      // a constraint definition, not a DELETE statement, and an
      // unanchored scan would flag it.
      expect({
        head,
        destructive: /^\s*(UPDATE|DELETE|DROP|TRUNCATE|ALTER TYPE)\b/i.test(statement),
      }).toEqual({
        head,
        destructive: false,
      });
    });
  });

  it('the ONLY change to an existing table is one nullable column', () => {
    const alters = statements.filter((statement) => /^ALTER TABLE "User"/i.test(statement));

    expect(alters).toHaveLength(1);
    expect(alters[0]).toContain('ADD COLUMN');
    expect(alters[0]).toContain('"lastSeenAt" TIMESTAMP(3)');
    expect(alters[0]).not.toMatch(/NOT NULL/i);
  });

  it('the new User column has NO DEFAULT — a pre-existing row must not be given a fabricated visit', () => {
    const alter = statements.find((statement) => /^ALTER TABLE "User"/i.test(statement)) ?? '';

    expect(alter).not.toMatch(/DEFAULT/i);
    // Every pre-existing user is therefore lastSeenAt NULL, which the
    // service reports as "make no return claim".
    expect(SCHEMA).toMatch(/lastSeenAt\s+DateTime\?/);
    expect(SCHEMA).not.toMatch(/lastSeenAt\s+DateTime\?\s*@default/);
  });
});

describe('R1 — the follow constraints are enforced by the database', () => {
  it('the composite unique exists, which is what makes a repeat follow a no-op', () => {
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX "CountryFollow_userId_countryCode_key" ON "CountryFollow"\("userId", "countryCode"\)/,
    );
  });

  it('a follow CASCADES from User, so DELETE /users/me removes it in the same operation', () => {
    const fk =
      statements.find((statement) => statement.includes('CountryFollow_userId_fkey')) ?? '';

    expect(fk).toContain('REFERENCES "User"("id")');
    expect(fk).toContain('ON DELETE CASCADE');
  });

  it('the ceiling is a number, declared once, and equal on both sides', () => {
    expect(MAX_COUNTRY_FOLLOWS).toBe(MAX_FOLLOWED_COUNTRIES);
    expect(MAX_COUNTRY_FOLLOWS).toBe(50);
    // Not expressible in SQL, and deliberately not attempted there: a
    // CHECK constraint counting rows would serialise every insert.
    expect(MIGRATION).not.toMatch(/CHECK\s*\(/i);
  });

  it('the country code column is plain text, validated in the API against the canonical list', () => {
    // Deliberately NOT a Postgres enum: ALL_ISO3_CODES changes when the
    // world does, and an enum would make that a migration.
    expect(MIGRATION).toContain('"countryCode" TEXT NOT NULL');
    expect(ALL_ISO3_CODES.length).toBeGreaterThan(150);
  });
});

describe('R3 — the telemetry tables', () => {
  it('the enum carries exactly the twelve approved names', () => {
    const enumStatement =
      statements.find((statement) => statement.includes('CREATE TYPE "ProductEventName"')) ?? '';
    const members = (enumStatement.match(/'[a-z_]+'/g) ?? []).map((raw) => raw.replace(/'/g, ''));

    expect(members.sort()).toEqual(Object.values(ProductEventName).sort());
    expect(members).toHaveLength(12);
  });

  it('ProductEvent.userId is NULLABLE and SETS NULL on account deletion', () => {
    const table =
      statements.find((statement) => statement.includes('CREATE TABLE "ProductEvent"')) ?? '';
    const fk = statements.find((statement) => statement.includes('ProductEvent_userId_fkey')) ?? '';

    expect(table).toMatch(/"userId" TEXT,/);
    expect(table).not.toMatch(/"userId" TEXT NOT NULL/);
    expect(fk).toContain('ON DELETE SET NULL');
    // Cascade would silently rewrite historical aggregate counts when
    // somebody leaves. SET NULL severs the person, keeps the count true.
    expect(fk).not.toContain('ON DELETE CASCADE');
  });

  it('AnalysisRun has NO user foreign key at all', () => {
    const table =
      statements.find((statement) => statement.includes('CREATE TABLE "AnalysisRun"')) ?? '';

    expect(table).not.toContain('userId');
    expect(statements.some((statement) => statement.includes('AnalysisRun_userId_fkey'))).toBe(
      false,
    );
  });

  it('neither telemetry table has a column for an IP, a user-agent or an email', () => {
    ['ProductEvent', 'AnalysisRun'].forEach((model) => {
      const table =
        statements.find((statement) => statement.includes(`CREATE TABLE "${model}"`)) ?? '';
      ['ip', 'userAgent', 'email', 'sessionId', 'deviceId'].forEach((forbidden) => {
        expect({
          model,
          forbidden,
          present: table.toLowerCase().includes(forbidden.toLowerCase()),
        }).toEqual({
          model,
          forbidden,
          present: false,
        });
      });
    });
  });

  it('AnalysisRun records usage and NOT money', () => {
    const table =
      statements.find((statement) => statement.includes('CREATE TABLE "AnalysisRun"')) ?? '';

    expect(table).toContain('"promptTokens" INTEGER');
    expect(table).toContain('"completionTokens" INTEGER');
    expect(table).toContain('"latencyMs" INTEGER');
    // No price table exists in this repository, so no monetary column
    // ships. A nullable cost nothing ever filled would be rendered as a
    // zero by somebody who did not read the schema comment.
    expect(table.toLowerCase()).not.toMatch(/cost|price|usd|cents/);
  });
});
