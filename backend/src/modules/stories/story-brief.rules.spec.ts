import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceRevisionOf, readStateOf, type AttemptFact, type VersionFact } from './story-brief.rules';
import { storyBriefEnabled } from './story-gates';

const ref = (n: number) => n.toString(16).padStart(64, '0');
const NOW = new Date('2026-10-05T12:00:00Z');
const later = new Date(NOW.getTime() + 60000);
const earlier = new Date(NOW.getTime() - 60000);

describe('EA-STORY-BRIEF-01 · evidence revision', () => {
  it('is order- and duplicate-independent and ignores non-refs', () => {
    expect(evidenceRevisionOf([ref(2), ref(1), ref(1), 'not-a-ref'])).toBe(evidenceRevisionOf([ref(1), ref(2)]));
    expect(evidenceRevisionOf([ref(1)])).toMatch(/^[0-9a-f]{64}$/);
  });
  it('ANY new member changes it (a same-publisher update included) — host count is not the authority', () => {
    expect(evidenceRevisionOf([ref(1), ref(2)])).not.toBe(evidenceRevisionOf([ref(1)]));
  });
});

describe('EA-STORY-BRIEF-01 · read state (facts only, zero compute)', () => {
  const R = 'rev-now';
  const v = (rev: string, state: VersionFact['state'] = 'READY'): VersionFact => ({ evidenceRevision: rev, state });
  const a = (status: AttemptFact['status'], lease: Date, failureKind: AttemptFact['failureKind'] = null): AttemptFact => ({
    evidenceRevision: R,
    status,
    failureKind,
    leaseExpiresAt: lease,
  });
  const state = (x: Partial<Parameters<typeof readStateOf>[0]>) =>
    readStateOf({ currentRevision: R, versionForCurrent: null, latestVersion: null, lastAttemptForCurrent: null, now: NOW, ...x });

  it.each([
    ['nothing', {}, 'NOT_GENERATED'],
    ['current READY', { versionForCurrent: v(R), latestVersion: v(R) }, 'READY'],
    ['current PARTIAL', { versionForCurrent: v(R, 'PARTIAL'), latestVersion: v(R, 'PARTIAL') }, 'PARTIAL'],
    ['current INSUFFICIENT', { versionForCurrent: v(R, 'INSUFFICIENT'), latestVersion: v(R, 'INSUFFICIENT') }, 'INSUFFICIENT'],
    ['older Brief only', { latestVersion: v('rev-old') }, 'STALE'],
    ['live claim', { lastAttemptForCurrent: a('CHECKING', later) }, 'CHECKING'],
    ['live claim over an older Brief', { latestVersion: v('rev-old'), lastAttemptForCurrent: a('CHECKING', later) }, 'CHECKING'],
    ['expired claim', { lastAttemptForCurrent: a('CHECKING', earlier) }, 'NOT_GENERATED'],
    ['provider failure', { lastAttemptForCurrent: a('FAILED', earlier, 'PROVIDER_DEGRADED') }, 'FAILED'],
    ['failure over an older Brief', { latestVersion: v('rev-old'), lastAttemptForCurrent: a('FAILED', earlier, 'PROVIDER_DEGRADED') }, 'STALE'],
  ] as const)('%s → %s', (_label, facts, expected) => {
    expect(state(facts as Partial<Parameters<typeof readStateOf>[0]>)).toBe(expected);
  });

  it('a failure is never reported as INSUFFICIENT', () => {
    for (const kind of ['PROVIDER_DEGRADED', 'BUDGET_REFUSED', 'CAPABILITY_UNAVAILABLE', 'EXECUTION_FAILED', 'OUTCOME_UNKNOWN'] as const) {
      expect(state({ lastAttemptForCurrent: a('FAILED', earlier, kind) })).toBe('FAILED');
    }
  });
});

describe('EA-STORY-BRIEF-01 · structural guarantees', () => {
  const cfg = (values: Record<string, string>) => ({ get: (k: string) => values[k] }) as never;
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
  const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

  it('gate is default OFF and literal', () => {
    expect(storyBriefEnabled(cfg({}))).toBe(false);
    expect(storyBriefEnabled(cfg({ STORY_BRIEF_ENABLED: 'TRUE' }))).toBe(false);
    expect(storyBriefEnabled(cfg({ STORY_BRIEF_ENABLED: 'true' }))).toBe(true);
  });

  it('the R1 production binding is the honest UNAVAILABLE generator (spend authority open)', () => {
    expect(code('stories.module.ts')).toMatch(/provide: STORY_BRIEF_GENERATOR, useClass: UnavailableStoryBriefGenerator/);
  });

  it('the Brief path never reads Discussion or Alerts content, and never writes a user id onto a version', () => {
    const service = code('story-brief.service.ts');
    expect(service).not.toMatch(/storyComment|storyAlert|\.body\b/);
    expect(service).not.toMatch(/storyBriefVersion\.create\(\{[\s\S]{0,400}userId/);
  });

  it('read() has no path to the generator (zero compute)', () => {
    const service = code('story-brief.service.ts');
    const readBody = service.slice(service.indexOf('async read('), service.indexOf('private async viewOf('));
    expect(readBody).not.toMatch(/generator\.generate/);
  });

  it('the Ask spend path never reads the Story Brief gate', () => {
    const askRoots = ['../ask-v2', '../compute-controls', '../analysis'];
    const { readdirSync, statSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const f = join(dir, n);
        return statSync(f).isDirectory() ? walk(f) : f.endsWith('.ts') ? [f] : [];
      });
    const offenders = askRoots
      .flatMap((r) => walk(join(__dirname, r)))
      .filter((f) => /STORY_BRIEF_ENABLED|storyBriefEnabled/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the migration is additive, enforces the states and makes versions append-only', () => {
    const sql = readFileSync(join(__dirname, '..', '..', '..', 'prisma', 'migrations', '20261006100000_story_brief_r1', 'migration.sql'), 'utf8').replace(/--[^\n]*/g, '');
    expect(sql).not.toMatch(/\bDROP\b|^\s*UPDATE\b|\bDELETE FROM\b|\bTRUNCATE\b/im);
    for (const [, table] of sql.matchAll(/ALTER TABLE "([A-Za-z]+)"/g)) {
      expect(['StoryBriefVersion', 'StoryBriefAttempt', 'StoryComment']).toContain(table);
    }
    expect(sql).toMatch(/ALTER TABLE "StoryComment" ADD COLUMN "storyBriefVersionId" TEXT;/);
    for (const name of ['chk_story_brief_version_state', 'chk_story_brief_attempt_status', 'chk_story_brief_attempt_failure', 'StoryBriefAttempt_one_checking', 'story_brief_version_append_only']) {
      expect(sql).toContain(`"${name}"`);
    }
  });
});
