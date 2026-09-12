import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * NOTE ON EXECUTION (Support loop S1): this file is currently run by NO
 * Jest configuration — it ends in `.spec.ts`, which the backend config
 * excludes by `rootDir: "src"`, and the e2e config matches only
 * `.e2e-spec.ts$`. CI runs `npm test --workspace=backend` and nothing
 * else. It is extended here so the record stays coherent and so it is
 * correct the day it is wired in, and the same guarantees are ALSO
 * asserted in `src/modules/support/supportContract.spec.ts`, which does
 * run. The configuration gap itself is recorded as separate technical
 * debt and is deliberately not repaired here.
 *
 * Milestone #57 — a live database is not available in every
 * environment this runs in, so this test verifies the actual
 * guarantee at its source: the Prisma schema itself declares
 * onDelete: Cascade on every one of the three tables that reference
 * User, which is what makes a single DELETE /users/me (UsersService's
 * one-line prisma.user.delete call, see users.service.spec.ts) remove
 * every account-owned row across UserIdentity/Session/
 * SearchHistoryEntry in one database-level operation. This
 * complements, rather than replaces, users.service.spec.ts's proof
 * that the service layer issues exactly that single delete call.
 */
describe('Account deletion cascade guarantee (Milestone #57)', () => {
  const schemaSource = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf-8');

  /**
   * Support loop S1 — model blocks are now bounded at the NEXT model or
   * enum rather than running to end-of-file.
   *
   * SearchHistoryEntry used to be the last model in the schema, so
   * slicing from it to EOF was the same thing as slicing to its own
   * closing brace. It no longer is: the support models follow it, and
   * an assertion named for one model would otherwise silently scan
   * another. Coverage does not shrink \u2014 the support models are asserted
   * explicitly below, including the articleId check that the unbounded
   * slice used to cover by accident.
   */
  const modelBlockOf = (name: string): string => {
    const start = schemaSource.indexOf(`model ${name} `);
    expect(start).toBeGreaterThan(-1);
    const rest = schemaSource.slice(start + 1);
    const next = rest.search(/\n(model|enum) /);
    return next === -1 ? schemaSource.slice(start) : schemaSource.slice(start, start + 1 + next);
  };

  it('UserIdentity cascades on User deletion', () => {
    const modelBlock = schemaSource.slice(
      schemaSource.indexOf('model UserIdentity'),
      schemaSource.indexOf('model Session'),
    );
    expect(modelBlock).toMatch(/onDelete:\s*Cascade/);
  });

  it('Session cascades on User deletion', () => {
    const modelBlock = schemaSource.slice(
      schemaSource.indexOf('model Session'),
      schemaSource.indexOf('model SearchHistoryEntry'),
    );
    expect(modelBlock).toMatch(/onDelete:\s*Cascade/);
  });

  it('SearchHistoryEntry cascades on User deletion', () => {
    const modelBlock = modelBlockOf('SearchHistoryEntry');
    expect(modelBlock).toMatch(/onDelete:\s*Cascade/);
  });

  it('User itself carries no provider-specific column \u2014 identity data lives exclusively in UserIdentity', () => {
    const userBlock = schemaSource.slice(
      schemaSource.indexOf('model User '),
      schemaSource.indexOf('model UserIdentity'),
    );
    expect(userBlock).not.toMatch(/provider/i);
    expect(userBlock).not.toMatch(/providerAccountId/);
  });

  it('the provider-neutral unique constraint is preserved on UserIdentity', () => {
    const modelBlock = schemaSource.slice(
      schemaSource.indexOf('model UserIdentity'),
      schemaSource.indexOf('model Session'),
    );
    expect(modelBlock).toMatch(/@@unique\(\[provider,\s*providerAccountId\]\)/);
  });

  it('SearchHistoryEntry never declares an articleId column', () => {
    const modelBlock = modelBlockOf('SearchHistoryEntry');
    expect(modelBlock).not.toMatch(/articleId/);
  });

  /**
   * Support loop S1 — a fourth account-owned model, and a fifth that
   * hangs off it. The chain is User -> SupportTicket -> SupportMessage,
   * cascading at both links, so DELETE /users/me still removes every row
   * the account owns in one database operation and UsersService keeps
   * its single prisma.user.delete call.
   *
   * The consequence is deliberate and was decided rather than
   * discovered: a user who deletes their account also deletes any
   * report they filed. That is the existing cascade policy extended
   * consistently (CTO Option A), and it creates no retention policy.
   */
  it('SupportTicket cascades on User deletion', () => {
    expect(modelBlockOf('SupportTicket')).toMatch(/onDelete:\s*Cascade/);
  });

  it('SupportMessage cascades on SupportTicket deletion, completing the chain', () => {
    expect(modelBlockOf('SupportMessage')).toMatch(/onDelete:\s*Cascade/);
  });

  it('SupportMessage.authorId carries NO User relation \u2014 deleting one actor must not erase another user\u2019s thread', () => {
    const modelBlock = modelBlockOf('SupportMessage');
    expect(modelBlock).toMatch(/authorId\s+String\?/);
    expect(modelBlock).not.toMatch(/authorId.*@relation/);
    expect(modelBlock).not.toMatch(/author\s+User/);
  });

  it('neither support model declares an articleId column', () => {
    expect(modelBlockOf('SupportTicket')).not.toMatch(/articleId/);
    expect(modelBlockOf('SupportMessage')).not.toMatch(/articleId/);
  });

  /**
   * R1/T3 — a sixth account-owned model, cascading like the rest, so
   * DELETE /users/me still removes every row the account owns in ONE
   * database operation and UsersService keeps its single
   * prisma.user.delete call.
   */
  it('CountryFollow cascades on User deletion', () => {
    expect(modelBlockOf('CountryFollow')).toMatch(/onDelete:\s*Cascade/);
  });

  it('CountryFollow is scoped by userId and unique per user and country', () => {
    const modelBlock = modelBlockOf('CountryFollow');
    expect(modelBlock).toMatch(/userId\s+String/);
    expect(modelBlock).toMatch(/@@unique\(\[userId,\s*countryCode\]\)/);
  });

  it('R1/T2 — lastSeenAt is a COLUMN on User, so it dies with the row and needs no cascade', () => {
    const modelBlock = modelBlockOf('User');
    expect(modelBlock).toMatch(/lastSeenAt\s+DateTime\?/);
    // Not a relation, so there is nothing to cascade and nothing that
    // could be left orphaned.
    expect(modelBlock).not.toMatch(/lastSeenAt.*@relation/);
  });

  /**
   * R3/T7 — THE ONE ACCOUNT-OWNED RELATION THAT DELIBERATELY DOES NOT
   * CASCADE, and the reason is a product decision rather than an
   * oversight (CTO decision).
   *
   * Cascading would delete a departing user's events, silently rewriting
   * historical aggregate counts — "how many follows were created in
   * August" would change every time somebody closed their account. SET
   * NULL severs the link to the person while leaving the count true. The
   * row that survives carries no identifier of any kind: userId is the
   * only field that ever referred to a person, and it becomes NULL.
   */
  it('ProductEvent SETS NULL on User deletion rather than cascading', () => {
    const modelBlock = modelBlockOf('ProductEvent');
    expect(modelBlock).toMatch(/onDelete:\s*SetNull/);
    expect(modelBlock).not.toMatch(/onDelete:\s*Cascade/);
  });

  it('a surviving ProductEvent row can carry NOTHING that identifies the deleted user', () => {
    const modelBlock = modelBlockOf('ProductEvent');

    expect(modelBlock).toMatch(/userId\s+String\?/);
    ['email', 'displayName', 'ipAddress', 'userAgent', 'sessionId'].forEach((forbidden) => {
      expect({ forbidden, present: modelBlock.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    });
  });

  it('AnalysisRun has no User relation at all, so account deletion cannot reach it', () => {
    const modelBlock = modelBlockOf('AnalysisRun');
    expect(modelBlock).not.toMatch(/userId/);
    expect(modelBlock).not.toMatch(/@relation/);
  });
});
