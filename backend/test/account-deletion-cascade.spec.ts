import { readFileSync } from 'fs';
import { join } from 'path';

/**
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
    const modelBlock = schemaSource.slice(schemaSource.indexOf('model SearchHistoryEntry'));
    expect(modelBlock).toMatch(/onDelete:\s*Cascade/);
  });

  it('User itself carries no provider-specific column \u2014 identity data lives exclusively in UserIdentity', () => {
    const userBlock = schemaSource.slice(schemaSource.indexOf('model User '), schemaSource.indexOf('model UserIdentity'));
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
    const modelBlock = schemaSource.slice(schemaSource.indexOf('model SearchHistoryEntry'));
    expect(modelBlock).not.toMatch(/articleId/);
  });
});
