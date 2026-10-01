import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { StoryIdentityService } from './story-identity.service';
import { DiscussionService } from './discussion.service';
import { AlertsService } from './alerts.service';
import { readStoryRelations } from './story-relation.read';

/**
 * STAGE B — canonical identity, Discussion and in-app Alerts against the dedicated LOOPBACK
 * test database (never a shared or production database). Every row is stamped so runs are
 * independent; nothing here touches a provider, a model or a network transport.
 */

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Stage B live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('Stage B — live PostgreSQL', () => {
  let db: PrismaClient;
  let identity: StoryIdentityService;
  let discussion: DiscussionService;
  let alerts: AlertsService;
  const stamp = randomUUID().slice(0, 8);
  const T0 = new Date('2026-09-30T08:00:00Z');
  const at = (minutes: number) => new Date(T0.getTime() + minutes * 60000);
  let seq = 0;

  async function article(input: { host: string; title: string; minutes?: number; image?: string; path?: string }) {
    seq++;
    const articleUrl = `https://${input.host}/${input.path ?? `sb-${stamp}-${seq}`}`;
    await db.article.create({
      data: {
        id: `sb-${stamp}-${seq}`,
        title: input.title,
        summary: 'Retained summary',
        url: articleUrl,
        imageUrl: input.image ?? null,
        sourceId: input.host,
        sourceName: input.host,
        category: 'world',
        publishedAt: at(input.minutes ?? 0),
      },
    });
    return { url: articleUrl, articleRef: computeArticleRef(articleUrl) };
  }
  const user = async (name: string | null = null) =>
    (await db.user.create({ data: { email: `${randomUUID()}@stage-b.test`, displayName: name } })).id;
  const title = (s: string) => `${s} ${stamp}`;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
    const prisma = db as unknown as PrismaService;
    identity = new StoryIdentityService(prisma);
    discussion = new DiscussionService(prisma, identity);
    alerts = new AlertsService(prisma, identity);
  });
  afterAll(async () => db.$disconnect());

  // ── 1. Canonical identity ────────────────────────────────────────────────

  describe('conservative placement (the 6ba220f ladder, fail closed)', () => {
    it('reading never creates a story', async () => {
      const a = await article({ host: 'one.example', title: title('Read only') });
      expect(await identity.resolveByArticleRef(a.articleRef)).toBeNull();
      const thread = await discussion.thread(a.articleRef, null);
      expect(thread).toMatchObject({ storyId: null, count: 0, comments: [] });
      expect(await discussion.counts([a.articleRef])).toEqual({});
      expect(await db.storyArticle.count({ where: { articleRef: a.articleRef } })).toBe(0);
    });

    it('JOINS only on proof: exact headline + same host + inside the window', async () => {
      const a = await article({ host: 'same.example', title: title('Port strike halts exports') });
      const b = await article({ host: 'same.example', title: title('Port strike halts exports'), minutes: 90 });
      const first = await identity.ensureStoryForArticle(a);
      const second = await identity.ensureStoryForArticle(b);
      expect(first.outcome).toBe('CREATED');
      expect(second.outcome).toBe('JOINED');
      expect(second.story.storyId).toBe(first.story.storyId);
      // Same host → no new evidence → no version bump.
      expect(second.story.briefVersion).toBe(1);
    });

    it('does NOT merge similar headlines (the resume/collapse case)', async () => {
      const a = await article({ host: 'talks.example', title: title('Ukraine peace talks resume in Geneva') });
      const b = await article({ host: 'talks.example', title: title('Ukraine peace talks collapse in Geneva'), minutes: 30 });
      const x = await identity.ensureStoryForArticle(a);
      const y = await identity.ensureStoryForArticle(b);
      expect(y.outcome).toBe('CREATED');
      expect(y.story.storyId).not.toBe(x.story.storyId);
    });

    it('does NOT merge the same wire headline from two unrelated outlets without corroboration', async () => {
      const a = await article({ host: 'outlet-a.example', title: title('Central bank holds rates') });
      const b = await article({ host: 'outlet-b.example', title: title('Central bank holds rates'), minutes: 10 });
      expect((await identity.ensureStoryForArticle(a)).story.storyId).not.toBe((await identity.ensureStoryForArticle(b)).story.storyId);
    });

    it('does NOT merge outside the publication window', async () => {
      const a = await article({ host: 'late.example', title: title('Annual summit opens') });
      const b = await article({ host: 'late.example', title: title('Annual summit opens'), minutes: 7 * 60 });
      expect((await identity.ensureStoryForArticle(a)).story.storyId).not.toBe((await identity.ensureStoryForArticle(b)).story.storyId);
    });

    it('a shared image corroborates across hosts and raises the brief version (new evidence)', async () => {
      const image = `https://img.example/${stamp}/flood.jpg`;
      const a = await article({ host: 'first.example', title: title('Flood barrier fails'), image });
      const b = await article({ host: 'second.example', title: title('Flood barrier fails'), image, minutes: 20 });
      const x = await identity.ensureStoryForArticle(a);
      const y = await identity.ensureStoryForArticle(b);
      expect(y.outcome).toBe('JOINED');
      expect(y.story.storyId).toBe(x.story.storyId);
      expect(y.story.briefVersion).toBe(2);
    });

    it('refuses a URL that does not hash to the articleRef, and an unretained article', async () => {
      const a = await article({ host: 'ver.example', title: title('Verified') });
      await expect(identity.ensureStoryForArticle({ articleRef: a.articleRef, url: 'https://ver.example/other' })).rejects.toThrow('REF_URL_MISMATCH');
      const ghost = 'https://ghost.example/never-retained-' + stamp;
      await expect(identity.ensureStoryForArticle({ articleRef: computeArticleRef(ghost), url: ghost })).rejects.toThrow('NOT_RETAINED');
    });

    it('backfill is conservative, idempotent and agrees with live placement', async () => {
      const host = `bf-${stamp}.example`;
      const p = await article({ host, title: title('Backfill pair'), path: `bf-${stamp}-1` });
      const q = await article({ host, title: title('Backfill pair'), minutes: 5, path: `bf-${stamp}-2` });
      const r = await article({ host, title: title('Backfill pair, revised'), minutes: 6, path: `bf-${stamp}-3` });
      let cursor: string | null = `sb-${stamp}-`;
      const totals = { created: 0, joined: 0 };
      do {
        const report = await identity.backfill({ limit: 500, cursor });
        totals.created += report.created;
        totals.joined += report.joined;
        cursor = report.nextCursor;
      } while (cursor !== null && cursor.startsWith(`sb-${stamp}`));
      const [sp, sq, sr] = await Promise.all([p, q, r].map((x) => identity.resolveByArticleRef(x.articleRef)));
      expect(sp!.storyId).toBe(sq!.storyId);
      expect(sr!.storyId).not.toBe(sp!.storyId);
      const again = await identity.backfill({ limit: 500, cursor: `sb-${stamp}-` });
      expect(again.created + again.joined).toBe(0);
    });
  });

  describe('merge / split keep articleRef and saved stories intact', () => {
    it('articleRef survives merge and split; SavedStory rows are untouched', async () => {
      const reader = await user('Saver');
      const a = await article({ host: 'm-a.example', title: title('Merge source A') });
      const b = await article({ host: 'm-b.example', title: title('Merge source B') });
      const sa = await identity.ensureStoryForArticle(a);
      const sb = await identity.ensureStoryForArticle(b);
      const saved = await db.savedStory.create({
        data: {
          userId: reader, articleRef: b.articleRef, canonicalUrl: b.url, sourceUrl: b.url, title: 'Merge source B',
          sourceName: 'm-b.example', sourceDomain: 'm-b.example', publishedAt: T0, publishedAtBasis: 'publisher', countryCodes: [],
        },
      });
      const before = JSON.stringify(saved);

      const merged = await identity.merge({ survivorId: sa.story.storyId, mergedId: sb.story.storyId, actorId: 'op-1', reason: 'Same event' });
      expect(merged.aliasIds).toEqual(expect.arrayContaining([sa.story.storyId, sb.story.storyId]));
      expect((await identity.resolveByArticleRef(b.articleRef))!.storyId).toBe(sa.story.storyId);
      expect(await db.storyArticle.findUnique({ where: { articleRef: b.articleRef } })).toMatchObject({ articleRef: b.articleRef, articleUrl: b.url, previousStoryId: sb.story.storyId });
      expect((await db.story.findUnique({ where: { id: sb.story.storyId } }))!.status).toBe('MERGED');

      const split = await identity.split({ storyId: sa.story.storyId, articleRefs: [b.articleRef], actorId: 'op-1', reason: 'Different events' });
      expect((await identity.resolveByArticleRef(b.articleRef))!.storyId).toBe(split.created.storyId);
      expect((await identity.resolveByArticleRef(a.articleRef))!.storyId).toBe(sa.story.storyId);
      expect(JSON.stringify(await db.savedStory.findUnique({ where: { id: saved.id } }))).toBe(before);

      const events = await db.storyIdentityEvent.findMany({ where: { storyId: sa.story.storyId }, orderBy: { createdAt: 'asc' } });
      expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(['CREATE', 'MERGE', 'VERSION', 'SPLIT']));
      expect(events.find((e) => e.kind === 'MERGE')).toMatchObject({ actorId: 'op-1', reason: 'Same event' });
    });

    it('refuses self-merge, merging an alias, and a split that would empty the story', async () => {
      const a = await article({ host: 'r-a.example', title: title('Refuse A') });
      const b = await article({ host: 'r-b.example', title: title('Refuse B') });
      const c = await article({ host: 'r-c.example', title: title('Refuse C') });
      const [sa, sb, sc] = [await identity.ensureStoryForArticle(a), await identity.ensureStoryForArticle(b), await identity.ensureStoryForArticle(c)];
      await expect(identity.merge({ survivorId: sa.story.storyId, mergedId: sa.story.storyId, actorId: 'op', reason: 'x' })).rejects.toThrow();
      await identity.merge({ survivorId: sa.story.storyId, mergedId: sb.story.storyId, actorId: 'op', reason: 'x' });
      await expect(identity.merge({ survivorId: sc.story.storyId, mergedId: sb.story.storyId, actorId: 'op', reason: 'x' })).rejects.toThrow('MERGE_REQUIRES_CANONICAL');
      await expect(identity.split({ storyId: sc.story.storyId, articleRefs: [c.articleRef], actorId: 'op', reason: 'x' })).rejects.toThrow('SPLIT_WOULD_EMPTY');
    });
  });

  describe('Compare identity enrichment (read-only)', () => {
    it('SAME_STORY / SEPARATED_BY_EDITOR / NOT_ESTABLISHED, and comparing creates nothing', async () => {
      const a = await article({ host: 'c.example', title: title('Compare same') });
      const b = await article({ host: 'c.example', title: title('Compare same'), minutes: 3 });
      const c = await article({ host: 'c2.example', title: title('Compare other') });
      const d = await article({ host: 'c3.example', title: title('Never placed') });
      const sa = await identity.ensureStoryForArticle(a);
      await identity.ensureStoryForArticle(b);
      await identity.ensureStoryForArticle(c);
      const storiesBefore = await db.story.count();
      const read = await readStoryRelations(db as unknown as PrismaService, [a.articleRef, b.articleRef, c.articleRef, d.articleRef]);
      const rel = (x: string, y: string) => read.relations.find((r) => r.first === x && r.second === y)!.relation;
      expect(rel(a.articleRef, b.articleRef)).toBe('SAME_STORY');
      expect(rel(a.articleRef, c.articleRef)).toBe('NOT_ESTABLISHED');
      expect(rel(a.articleRef, d.articleRef)).toBe('NOT_ESTABLISHED');
      expect(read.storyIds[d.articleRef]).toBeNull();
      expect(await db.story.count()).toBe(storiesBefore);

      const split = await identity.split({ storyId: sa.story.storyId, articleRefs: [b.articleRef], actorId: 'op', reason: 'Separate' });
      const after = await readStoryRelations(db as unknown as PrismaService, [a.articleRef, b.articleRef]);
      expect(after.relations[0].relation).toBe('SEPARATED_BY_EDITOR');
      expect(after.storyIds[b.articleRef]).toBe(split.created.storyId);
    });
  });

  // ── 2. Discussion ────────────────────────────────────────────────────────

  describe('Discussion', () => {
    it('real counts only; idempotent posting; one reply level; author label never an email', async () => {
      const alice = await user('Alice');
      const bob = await user('bob@leak.example');
      const a = await article({ host: 'd.example', title: title('Discuss me') });
      expect(await discussion.counts([a.articleRef])).toEqual({});
      const c1 = await discussion.post(alice, { ...a, body: 'First thought', idempotencyKey: `k-${stamp}-1` });
      const again = await discussion.post(alice, { ...a, body: 'First thought', idempotencyKey: `k-${stamp}-1` });
      expect(again.id).toBe(c1.id);
      const r1 = await discussion.post(bob, { ...a, body: 'A reply', parentId: c1.id, idempotencyKey: `k-${stamp}-2` });
      const r2 = await discussion.post(alice, { ...a, body: 'Reply to reply', parentId: r1.id, idempotencyKey: `k-${stamp}-3` });
      expect(r2.parentId).toBe(c1.id);
      expect(await discussion.counts([a.articleRef])).toEqual({ [a.articleRef]: 3 });
      const thread = await discussion.thread(a.articleRef, alice);
      expect(thread.count).toBe(3);
      expect(thread.comments.find((c) => c.id === r1.id)!.authorLabel).toBeNull();
      expect(thread.comments.find((c) => c.id === c1.id)).toMatchObject({ authorLabel: 'Alice', mine: true });
      expect(JSON.stringify(thread)).not.toMatch(/@leak\.example|@stage-b\.test/);
    });

    it('removed / hidden / deleted bodies never reach readers; locked refuses writes, reads stay open', async () => {
      const alice = await user('Alice');
      const bob = await user('Bob');
      const a = await article({ host: 'mod.example', title: title('Moderated') });
      const c1 = await discussion.post(alice, { ...a, body: 'Secret spam body', idempotencyKey: `m-${stamp}-1` });
      const c2 = await discussion.post(bob, { ...a, body: 'Bob reply', parentId: c1.id, idempotencyKey: `m-${stamp}-2` });
      await discussion.moderate('op-1', c1.id, 'REMOVE', 'Spam');
      let thread = await discussion.thread(a.articleRef, null);
      expect(JSON.stringify(thread)).not.toContain('Secret spam body');
      expect(thread.comments.find((c) => c.id === c1.id)).toMatchObject({ state: 'REMOVED', body: null });
      expect(thread.count).toBe(1);

      await discussion.remove(bob, c2.id);
      expect((await db.storyComment.findUnique({ where: { id: c2.id } }))!.body).toBe('');
      thread = await discussion.thread(a.articleRef, null);
      expect(thread.count).toBe(0);
      expect(await discussion.counts([a.articleRef])).toEqual({});

      await expect(discussion.edit(alice, c2.id, 'not mine')).rejects.toThrow();
      await expect(discussion.moderate('op-1', c2.id, 'RESTORE', 'x')).rejects.toThrow('COMMENT_DELETED_BY_AUTHOR');

      const story = (await identity.resolveByArticleRef(a.articleRef))!;
      await discussion.setLock('op-1', story.storyId, true, 'Heated');
      await expect(discussion.post(bob, { ...a, body: 'Locked out', idempotencyKey: `m-${stamp}-3` })).rejects.toThrow('DISCUSSION_LOCKED');
      expect((await discussion.thread(a.articleRef, null)).locked).toBe(true);
      const audit = await db.storyModerationAction.findMany({ where: { storyId: story.storyId } });
      expect(audit.map((x) => x.action).sort()).toEqual(['LOCK', 'REMOVE']);
    });

    it('reports: once per reader, never your own', async () => {
      const alice = await user('Alice');
      const bob = await user('Bob');
      const a = await article({ host: 'rep.example', title: title('Reported') });
      const c = await discussion.post(alice, { ...a, body: 'Questionable', idempotencyKey: `r-${stamp}-1` });
      await discussion.report(bob, c.id, 'SPAM');
      await discussion.report(bob, c.id, 'ABUSE');
      expect(await db.storyCommentReport.count({ where: { commentId: c.id } })).toBe(1);
      await expect(discussion.report(alice, c.id, 'SPAM')).rejects.toThrow('REPORT_OWN');
    });

    it('continuity through merge: comments on both stories read as one thread from either article', async () => {
      const alice = await user('Alice');
      const a = await article({ host: 'cm-a.example', title: title('Continuity A') });
      const b = await article({ host: 'cm-b.example', title: title('Continuity B') });
      await discussion.post(alice, { ...a, body: 'On A', idempotencyKey: `cm-${stamp}-1` });
      await discussion.post(alice, { ...b, body: 'On B', idempotencyKey: `cm-${stamp}-2` });
      const sa = (await identity.resolveByArticleRef(a.articleRef))!;
      const sb = (await identity.resolveByArticleRef(b.articleRef))!;
      await identity.merge({ survivorId: sa.storyId, mergedId: sb.storyId, actorId: 'op', reason: 'Same' });
      const fromA = await discussion.thread(a.articleRef, null);
      const fromB = await discussion.thread(b.articleRef, null);
      expect(fromA.count).toBe(2);
      expect(fromB.comments.map((c) => c.body).sort()).toEqual(['On A', 'On B']);
      expect(fromA.storyId).toBe(fromB.storyId);
    });
  });

  // ── 3. Alerts ────────────────────────────────────────────────────────────

  describe('in-app Alerts', () => {
    it('explicit creation is idempotent; dedup by brief version; pause stops new events', async () => {
      const reader = await user('Reader');
      const a = await article({ host: 'al-a.example', title: title('Alerted'), image: `https://img.example/${stamp}/al.jpg` });
      const first = await alerts.create(reader, a);
      const second = await alerts.create(reader, a);
      expect(second.id).toBe(first.id);
      expect(await db.storyAlert.count({ where: { userId: reader } })).toBe(1);
      expect(first).toMatchObject({ change: 'NO_CHANGE_YET', unread: 0, status: 'ACTIVE' });

      // Same host again: no new evidence, no event.
      const sameHost = await article({ host: 'al-a.example', title: title('Alerted'), minutes: 2 });
      await identity.ensureStoryForArticle(sameHost);
      expect(await db.storyAlertEvent.count({ where: { alertId: first.id } })).toBe(0);

      // A new host proven to join (same image): exactly one event at version 2.
      const b = await article({ host: 'al-b.example', title: title('Alerted'), minutes: 4, image: `https://img.example/${stamp}/al.jpg` });
      await identity.ensureStoryForArticle(b);
      await identity.ensureStoryForArticle(b);
      const events = await db.storyAlertEvent.findMany({ where: { alertId: first.id } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ briefVersion: 2, kind: 'NEW_EVIDENCE', readAt: null });
      expect((await alerts.list(reader))[0]).toMatchObject({ change: 'CHANGED', unread: 1 });

      await alerts.apply(reader, first.id, 'pause');
      const c = await article({ host: 'al-c.example', title: title('Alerted'), minutes: 5, image: `https://img.example/${stamp}/al.jpg` });
      await identity.ensureStoryForArticle(c);
      expect(await db.storyAlertEvent.count({ where: { alertId: first.id } })).toBe(1);

      const inbox = await alerts.inbox(reader, false);
      expect(inbox.unread.developments).toBe(1);
      await alerts.markAllRead(reader);
      expect((await alerts.inbox(reader, false)).unread.developments).toBe(0);

      await alerts.apply(reader, first.id, 'remove');
      expect(await alerts.list(reader)).toHaveLength(0);
      const restored = await alerts.create(reader, a);
      expect(restored.id).toBe(first.id);
    });

    it('Follow does not create an Alert; no delivery rows exist to create', async () => {
      const reader = await user('Follower');
      await db.countryFollow.create({ data: { userId: reader, countryCode: 'KEN' } });
      expect(await db.storyAlert.count({ where: { userId: reader } })).toBe(0);
      expect(await alerts.list(reader)).toEqual([]);
    });

    it('merge emits STORY_MERGED once and keeps one alert per reader', async () => {
      const reader = await user('Both');
      const a = await article({ host: 'mg-a.example', title: title('Merge alert A') });
      const b = await article({ host: 'mg-b.example', title: title('Merge alert B') });
      const x = await alerts.create(reader, a);
      const y = await alerts.create(reader, b);
      await identity.merge({ survivorId: x.storyId, mergedId: y.storyId, actorId: 'op', reason: 'Same' });
      const live = await alerts.list(reader);
      expect(live).toHaveLength(1);
      expect(live[0].id).toBe(x.id);
      const events = await db.storyAlertEvent.findMany({ where: { alertId: x.id } });
      expect(events.map((e) => e.kind)).toEqual(['STORY_MERGED']);
      expect(events[0].briefVersion).toBe(2);
      expect((await alerts.byArticle(reader, [b.articleRef]))[b.articleRef].alertId).toBe(x.id);
    });

    it('another reader cannot see or change my alert', async () => {
      const me = await user('Me');
      const them = await user('Them');
      const a = await article({ host: 'own.example', title: title('Owned') });
      const mine = await alerts.create(me, a);
      await expect(alerts.apply(them, mine.id, 'remove')).rejects.toThrow();
      expect(await alerts.list(them)).toEqual([]);
      expect((await alerts.list(me))[0].id).toBe(mine.id);
    });

    it('replies inbox: a reply to my comment is unread until read-all', async () => {
      const me = await user('Me');
      const them = await user('Them');
      const a = await article({ host: 'rp.example', title: title('Replies') });
      const mine = await discussion.post(me, { ...a, body: 'Mine', idempotencyKey: `rp-${stamp}-1` });
      await discussion.post(them, { ...a, body: 'Theirs', parentId: mine.id, idempotencyKey: `rp-${stamp}-2` });
      const inbox = await alerts.inbox(me, true);
      expect(inbox.unread.replies).toBe(1);
      expect(JSON.stringify(inbox)).not.toContain('Theirs');
      await alerts.markAllRead(me);
      expect((await alerts.inbox(me, true)).unread.replies).toBe(0);
    });
  });

  // ── 4. Account deletion ──────────────────────────────────────────────────

  describe('account deletion', () => {
    it('removes the account’s comments, reports, alerts, events and cursor; others’ replies and the audit survive', async () => {
      const leaving = await user('Leaving');
      const staying = await user('Staying');
      const a = await article({ host: 'del.example', title: title('Deletion') });
      const mine = await discussion.post(leaving, { ...a, body: 'Leaving soon', idempotencyKey: `del-${stamp}-1` });
      const reply = await discussion.post(staying, { ...a, body: 'Still here', parentId: mine.id, idempotencyKey: `del-${stamp}-2` });
      const theirs = await discussion.post(staying, { ...a, body: 'Report me', idempotencyKey: `del-${stamp}-3` });
      await discussion.report(leaving, theirs.id, 'OTHER');
      const alert = await alerts.create(leaving, a);
      await alerts.markAllRead(leaving);
      const story = (await identity.resolveByArticleRef(a.articleRef))!;
      await discussion.moderate(leaving, theirs.id, 'HIDE', 'as operator');

      await db.user.delete({ where: { id: leaving } });

      expect(await db.storyComment.findUnique({ where: { id: mine.id } })).toBeNull();
      expect(await db.storyCommentReport.count({ where: { userId: leaving } })).toBe(0);
      expect(await db.storyAlert.findUnique({ where: { id: alert.id } })).toBeNull();
      expect(await db.userInboxCursor.findUnique({ where: { userId: leaving } })).toBeNull();
      expect(await db.storyComment.findUnique({ where: { id: reply.id } })).toMatchObject({ parentId: null, body: 'Still here' });
      expect(await db.storyModerationAction.count({ where: { actorId: leaving } })).toBe(1);
      expect(await db.story.findUnique({ where: { id: story.storyId } })).not.toBeNull();
    });
  });
});
