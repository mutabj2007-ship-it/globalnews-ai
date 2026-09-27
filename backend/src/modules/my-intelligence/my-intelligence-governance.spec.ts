import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { validateReturnDestination } from '../auth/return-destination.util';
import { WATCH_RUNTIME_ACTIVE } from '../watch/watch-runtime.policy';
import { SAND_CHARGING_ENABLED } from '../ask-v2/ask-compute.contract';
import { AskV2EnabledGuard } from '../ask-v2/ask-v2.controller';

/**
 * MY INTELLIGENCE R1 — the governance around the new data: account deletion,
 * sign-in return, additive-only migration, and everything that must stay OFF.
 */

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
const modelBlockOf = (name: string): string => {
  const start = schema.indexOf(`model ${name} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return schema.slice(start, schema.indexOf('\n}', start));
};

describe('account deletion removes My Intelligence data', () => {
  it('SavedStory cascades on User deletion and is unique per user and articleRef', () => {
    const block = modelBlockOf('SavedStory');
    expect(block).toMatch(/user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    expect(block).toMatch(/@@unique\(\[userId,\s*articleRef\]\)/);
  });

  it('visitBoundaryAt is a nullable COLUMN on User, so it dies with the row', () => {
    const block = modelBlockOf('User');
    expect(block).toMatch(/visitBoundaryAt\s+DateTime\?/);
    expect(block).not.toMatch(/visitBoundaryAt.*@relation/);
    expect(block).toMatch(/savedStories\s+SavedStory\[\]/);
  });

  it('question history keeps its existing cascade', () => {
    expect(modelBlockOf('SearchHistoryEntry')).toMatch(/onDelete:\s*Cascade/);
  });
});

describe('the migration is additive only', () => {
  const dir = join(__dirname, '../../../prisma/migrations/20260927120000_my_intelligence_saved_stories_visit_boundary');
  const sql = readFileSync(join(dir, 'migration.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('adds a nullable column and a new table, and nothing destructive', () => {
    expect(sql).toMatch(/ALTER TABLE "User" ADD COLUMN "visitBoundaryAt" TIMESTAMP\(3\);/);
    expect(sql).toMatch(/CREATE TABLE "SavedStory"/);
    /* Destructive STATEMENTS only — the FK clause "ON DELETE CASCADE ON UPDATE CASCADE" is not one. */
    expect(sql).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE)\b|ALTER COLUMN|RENAME|DROP COLUMN|DROP TABLE/im);
    /* No default on the new User column: existing users make no return claim. */
    expect(sql).not.toMatch(/"visitBoundaryAt" TIMESTAMP\(3\) (NOT NULL|DEFAULT)/);
  });

  it('pins the identity shape in the database too', () => {
    expect(sql).toContain(`CHECK ("articleRef" ~ '^[0-9a-f]{64}$')`);
  });

  it('ships a DOWN.sql that removes only what it added', () => {
    expect(readdirSync(dir).sort()).toEqual(['DOWN.sql', 'migration.sql']);
  });
});

describe('sign-in may return to /my-intelligence — exactly, and nothing looser', () => {
  it.each(['/my-intelligence'])('%s is allowed', (path) => {
    expect(validateReturnDestination(path)).toBe(path);
  });

  it.each([
    '/my-intelligence/',
    '/my-intelligence/saved',
    '/my-intelligence?tab=saved',
    '/my-intelligence#saved',
    '/my-intelligence-evil',
    '//my-intelligence',
    'https://evil.example/my-intelligence',
  ])('%s is refused', (path) => {
    expect(validateReturnDestination(path)).toBeNull();
  });
});

describe('Watch, Sand and Ask V2 remain OFF', () => {
  it('WATCH_RUNTIME_ACTIVE is false: following is not Watch', () => {
    expect(WATCH_RUNTIME_ACTIVE).toBe(false);
  });

  it('Sand charging is off and cannot be switched on here', () => {
    expect(SAND_CHARGING_ENABLED).toBe(false);
  });

  it('Ask V2 is 404 unless ASK_V2_ENABLED is exactly "true"', () => {
    const guard = new AskV2EnabledGuard({ get: () => undefined } as never);
    expect(() => guard.canActivate({} as never)).toThrow(NotFoundException);
  });

  it('nothing in My Intelligence reaches Watch, Ask V2, Sand, schedulers or notifications', () => {
    const dir = __dirname;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      expect(source).not.toMatch(/ask-v2|ASK_EXECUTION_PORT|watch|Sand|@Cron|setInterval|notification/i);
    }
  });
});
