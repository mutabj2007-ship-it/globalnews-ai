import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WATCH_RUNTIME_ACTIVE } from '../watch/watch-runtime.policy';
import { STAGE_B_DECLARED_OFF, alertsInAppEnabled, discussionReadEnabled, discussionWriteEnabled } from './story-gates';
import { readIdentityFor } from '../news/compare/story-compare.controller';

/**
 * STAGE B — structural guarantees that must hold whatever the code paths do at runtime.
 */

const SRC = join(__dirname, '..', '..');
const BACKEND = join(SRC, '..');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'generated' || entry === 'node_modules') continue;
      walk(full, acc);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const all = walk(SRC);
const rel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, '/');
const storiesFiles = all.filter((f) => rel(f).startsWith('modules/stories/'));

describe('Discussion is never Ask evidence (structural)', () => {
  const EVIDENCE_ROOTS = ['modules/ask-v2/', 'modules/analysis/', 'modules/news/', 'modules/ask-observability/', 'modules/signals/', 'modules/situation/'];
  const evidenceFiles = all.filter((f) => EVIDENCE_ROOTS.some((r) => rel(f).startsWith(r)));

  it('the sweep is alive', () => {
    expect(evidenceFiles.length).toBeGreaterThan(50);
    expect(storiesFiles.length).toBeGreaterThan(8);
  });

  it('no Ask / analysis / retrieval / evidence file reads discussion content', () => {
    const offenders = evidenceFiles.filter((f) => {
      const code = strip(readFileSync(f, 'utf8'));
      return /storyComment|StoryComment|discussion\.service|DiscussionService|stories\/discussion/.test(code);
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it('the only news→stories edge is Compare’s read-only identity relation', () => {
    const edges = evidenceFiles.filter((f) => /from '[^']*stories\//.test(strip(readFileSync(f, 'utf8'))));
    expect(edges.map(rel)).toEqual(['modules/news/compare/story-compare.controller.ts']);
    const code = strip(readFileSync(edges[0], 'utf8'));
    expect(code.match(/from '[^']*stories\/[^']*'/g)).toEqual(["from '../../stories/story-relation.read'"]);
  });

  it('the relation reader touches identity only', () => {
    const code = strip(readFileSync(join(__dirname, 'story-relation.read.ts'), 'utf8'));
    expect(code).not.toMatch(/comment|alert/i);
  });
});

describe('No delivery, no scheduler, no provider, no Watch, no Follow (structural)', () => {
  const FORBIDDEN: Array<[RegExp, string]> = [
    [/\bfetch\s*\(/, 'fetch('],
    [/nodemailer|sendgrid|mailgun|resend|postmark|ses\b/i, 'email transport'],
    [/web-?push|firebase|fcm|apns|expo-server/i, 'push transport'],
    [/@nestjs\/schedule|\bCron\b|\bInterval\(|setInterval\s*\(/, 'scheduler'],
    [/HttpService|axios/, 'HTTP client'],
    [/from '[^']*watch\//, 'Watch'],
    [/countryFollow|CountryFollow|from '[^']*follows\/follows\.(controller|module)/, 'Follow write'],
    [/from '[^']*(ask-v2|analysis|providers|openai|frozen-c)\//, 'Ask / analysis / provider'],
    [/webhook|smtp|notify\(/i, 'delivery'],
  ];

  it.each(FORBIDDEN.map(([re, label]) => [label, re] as const))('stories module: no %s', (_label, re) => {
    const offenders = storiesFiles.filter((f) => re.test(strip(readFileSync(f, 'utf8'))));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('the dormant Watch stays dormant and the declared-OFF capabilities stay OFF', () => {
    expect(WATCH_RUNTIME_ACTIVE).toBe(false);
    expect(STAGE_B_DECLARED_OFF).toEqual({ alertsDelivery: false, billingCheckout: false });
  });

  it('the schema stores no delivery channel, address, token or price for alerts', () => {
    const schema = readFileSync(join(BACKEND, 'prisma', 'schema.prisma'), 'utf8');
    for (const model of ['StoryAlert', 'StoryAlertEvent', 'UserInboxCursor']) {
      const block = schema.slice(schema.indexOf(`model ${model} `), schema.indexOf('}', schema.indexOf(`model ${model} `)));
      expect(block).not.toMatch(/channel|email|push|token|webhook|price|plan|delivered/i);
    }
  });
});

describe('Gates: one authority each, literal true, default OFF', () => {
  const cfg = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as never;
  it('default OFF; write requires read', () => {
    expect(discussionReadEnabled(cfg({}))).toBe(false);
    expect(discussionWriteEnabled(cfg({ DISCUSSION_WRITE_ENABLED: 'true' }))).toBe(false);
    expect(discussionWriteEnabled(cfg({ DISCUSSION_READ_ENABLED: 'true', DISCUSSION_WRITE_ENABLED: 'true' }))).toBe(true);
    expect(alertsInAppEnabled(cfg({ ALERTS_IN_APP_ENABLED: 'TRUE' }))).toBe(false);
  });
  it('no Stage B gate is read by the Ask spend path', () => {
    const askFiles = all.filter((f) => /modules\/(ask-v2|compute-controls|analysis)\//.test(rel(f)));
    const offenders = askFiles.filter((f) => /DISCUSSION_(READ|WRITE)_ENABLED|ALERTS_IN_APP_ENABLED/.test(readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('Schema + migrations: additive, account-owned rows cascade, audits survive', () => {
  const schema = readFileSync(join(BACKEND, 'prisma', 'schema.prisma'), 'utf8');
  const block = (name: string) => {
    const start = schema.indexOf(`model ${name} `);
    expect(start).toBeGreaterThan(-1);
    return schema.slice(start, schema.indexOf('\n}', start));
  };

  it('reader-owned rows cascade with the account', () => {
    for (const m of ['StoryComment', 'StoryCommentReport', 'StoryAlert', 'UserInboxCursor']) {
      expect(block(m)).toMatch(/user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    }
    expect(block('StoryAlertEvent')).toMatch(/onDelete: Cascade/);
  });

  it('audit rows keep a plain actor id (no User relation), so deleting an operator keeps the audit', () => {
    for (const m of ['StoryIdentityEvent', 'StoryModerationAction']) expect(block(m)).not.toMatch(/\bUser\b/);
  });

  it('a story cannot be deleted from under its members, comments or alerts', () => {
    for (const m of ['StoryArticle', 'StoryComment', 'StoryAlert']) expect(block(m)).toMatch(/story\s+Story\s+@relation\(fields: \[storyId\], references: \[id\], onDelete: Restrict\)/);
  });

  it('articleRef is the membership key and SavedStory is unchanged by Stage B', () => {
    expect(block('StoryArticle')).toMatch(/articleRef\s+String\s+@unique/);
    expect(block('SavedStory')).not.toMatch(/\bstoryId\b|\bStory\b/);
  });

  const migrations = [
    '20261002100000_home_r1_stage_b_m1_canonical_story_identity',
    '20261002100100_home_r1_stage_b_m2_discussion',
    '20261002100200_home_r1_stage_b_m3_in_app_alerts',
  ].map((m) => readFileSync(join(BACKEND, 'prisma', 'migrations', m, 'migration.sql'), 'utf8'));
  const NEW_TABLES = ['Story', 'StoryArticle', 'StoryIdentityEvent', 'StoryComment', 'StoryCommentReport', 'StoryModerationAction', 'StoryAlert', 'StoryAlertEvent', 'UserInboxCursor'];

  it('additive only: no DROP, no UPDATE/DELETE, ALTER only on new tables', () => {
    for (const sql of migrations) {
      const code = sql.replace(/--[^\n]*/g, '');
      expect(code).not.toMatch(/\bDROP\b|^\s*UPDATE\b|\bDELETE FROM\b|\bTRUNCATE\b/im);
      for (const [, table] of code.matchAll(/ALTER TABLE "([A-Za-z]+)"/g)) expect(NEW_TABLES).toContain(table);
    }
  });

  it('database CHECKs enforce the governed states', () => {
    const joined = migrations.join('\n');
    for (const name of ['chk_story_status', 'chk_story_alias', 'chk_story_article_ref_hex', 'chk_story_comment_state', 'chk_story_comment_body', 'chk_story_alert_status', 'chk_story_alert_event_kind']) {
      expect(joined).toContain(`"${name}"`);
    }
  });
});

describe('Compare identity enrichment fails to absence', () => {
  it('null when nothing is available or the identity read throws', async () => {
    expect(await readIdentityFor(undefined, [{ articleRef: 'a'.repeat(64), status: 'available' }])).toBeNull();
    expect(await readIdentityFor({} as never, [{ articleRef: 'a'.repeat(64), status: 'unavailable', reason: 'NOT_RETAINED' }])).toBeNull();
    const broken = { storyArticle: { findMany: async () => { throw new Error('relation "StoryArticle" does not exist'); } } };
    expect(await readIdentityFor(broken as never, [{ articleRef: 'a'.repeat(64), status: 'available' }])).toBeNull();
  });
});

describe('Correction R1 — the retained-article observation seam (structural)', () => {
  const persistence = strip(readFileSync(join(SRC, 'modules', 'news', 'persistence', 'article-persistence.service.ts'), 'utf8'));
  const port = strip(readFileSync(join(SRC, 'modules', 'news', 'persistence', 'retained-article-observer.port.ts'), 'utf8'));
  const observer = strip(readFileSync(join(__dirname, 'story-observation.module.ts'), 'utf8'));

  it('news persistence depends only on the port, never on the stories module', () => {
    expect(persistence).toMatch(/from '\.\/retained-article-observer\.port'/);
    expect(persistence).not.toMatch(/stories\//);
    expect(port.match(/^import .*$/gm)).toEqual(["import type { NewsArticle } from '@globalnews-ai/shared';"]);
  });

  it('the observer is optional, runs after commit, and is isolated by its own catch', () => {
    expect(persistence).toMatch(/@Optional\(\) @Inject\(RETAINED_ARTICLE_OBSERVER\)/);
    expect(persistence).toMatch(/await this\.observeCommitted\(articles\);\s*return firstSeenByUrl;/);
    expect(persistence).toMatch(/private async observeCommitted[\s\S]*?try \{[\s\S]*?observeRetained\(articles\)[\s\S]*?\} catch/);
  });

  it('the observer is database-only: no provider, model, network, scheduler, Watch or Follow', () => {
    expect(observer).not.toMatch(/fetch\(|HttpService|axios|providers\/|analysis|ask-v2|openai|@nestjs\/schedule|Cron|setInterval|watch\/|follows\.(controller|module)/);
    expect(observer).toMatch(/observeRetainedForAlerts/);
  });

  it('observation never creates a story and is bounded', () => {
    const identity = strip(readFileSync(join(__dirname, 'story-identity.service.ts'), 'utf8'));
    expect(identity).toMatch(/if \(mode === 'observe'\) return 'NO_PROVEN_ALERTED_STORY' as const;/);
    expect(identity).toMatch(/\.slice\(0, MAX_OBSERVE_BATCH\)/);
    expect(identity).toMatch(/storyAlert\.count\(\{ where: \{ status: 'ACTIVE' \} \}\)\) === 0\) return out;/);
  });
});
