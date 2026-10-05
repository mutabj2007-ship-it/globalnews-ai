import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { StoryIdentityService } from '../stories/story-identity.service';
import { DiscussionService } from '../stories/discussion.service';
import { StoryBriefService } from './story-brief.service';
import {
  UnavailableStoryBriefGenerator,
  type StoryBriefGeneration,
  type StoryBriefGenerator,
} from './story-brief.generator';
import { STORY_BRIEF_LEASE_MS } from './story-brief.rules';

/**
 * EA-STORY-BRIEF-01 — the canonical Story Brief against the dedicated LOOPBACK test database.
 * No provider, model or network: the generator is a counted fake (or the R1 production binding).
 */

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Story Brief live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

class FakeGenerator implements StoryBriefGenerator {
  readonly available = true;
  calls = 0;
  inputs: unknown[] = [];
  next: StoryBriefGeneration = concluded('READY');
  gate: Promise<void> | null = null;
  async generate(input: unknown): Promise<StoryBriefGeneration> {
    this.calls++;
    this.inputs.push(input);
    if (this.gate) await this.gate;
    return this.next;
  }
}

function concluded(state: 'READY' | 'PARTIAL' | 'INSUFFICIENT'): StoryBriefGeneration {
  return {
    outcome: 'CONCLUDED',
    state,
    blocks: { schema: 'briefing-blocks/1', answerState: state, summary: `Brief (${state})`, intelligence: { considered: ['CONFLICT'], contributions: [] } },
    evidenceRefs: [{ id: 'art-1', host: 'one.example', url: 'https://one.example/a', title: 'A', publisher: 'One', publishedAt: '2026-10-05T08:00:00Z' }],
    coverageGaps: state === 'READY' ? [] : ['NO_LOCAL_SOURCE'],
    uncertainty: ['cause not established'],
    asOf: new Date('2026-10-05T09:00:00Z'),
    operationId: 'op-brief-1',
  };
}

live('Story Brief R1 — live PostgreSQL', () => {
  let db: PrismaClient;
  let identity: StoryIdentityService;
  let discussion: DiscussionService;
  const stamp = randomUUID().slice(0, 8);
  let seq = 0;
  const requester = { userId: 'requester-not-stored' };

  async function article(host: string, headline: string, minutes = 0) {
    seq++;
    const articleUrl = `https://${host}/brief-${stamp}-${seq}`;
    await db.article.create({
      data: {
        id: `brief-${stamp}-${seq}`,
        title: `${headline} ${stamp}`,
        summary: 'Retained summary',
        url: articleUrl,
        sourceId: host,
        sourceName: host,
        category: 'world',
        publishedAt: new Date(Date.UTC(2026, 9, 5, 8, minutes)),
      },
    });
    return { url: articleUrl, articleRef: computeArticleRef(articleUrl) };
  }
  async function story(headline: string) {
    const a = await article('one.example', headline);
    const { story: s } = await identity.ensureStoryForArticle(a);
    return { storyId: s.storyId, headline };
  }
  const service = (generator: StoryBriefGenerator) =>
    new StoryBriefService(db as unknown as PrismaService, identity, generator);

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 6 }) });
    await db.$connect();
    identity = new StoryIdentityService(db as unknown as PrismaService);
    discussion = new DiscussionService(db as unknown as PrismaService, identity);
  });
  afterAll(async () => db.$disconnect());

  it('NOT_GENERATED, and read() never calls the generator (zero compute)', async () => {
    const s = await story('Quiet story');
    const gen = new FakeGenerator();
    const view = await service(gen).read(s.storyId);
    expect(view).toMatchObject({ storyId: s.storyId, state: 'NOT_GENERATED', brief: null, versions: 0, lastAttempt: null });
    expect(gen.calls).toBe(0);
  });

  it('an unavailable generator is an honest CAPABILITY_UNAVAILABLE failure — never INSUFFICIENT, nothing persisted as a Brief', async () => {
    const s = await story('Unbound story');
    const view = await service(new UnavailableStoryBriefGenerator()).request(s.storyId, requester);
    expect(view.state).toBe('FAILED');
    expect(view.generationAvailable).toBe(false);
    expect(view.lastAttempt).toMatchObject({ status: 'FAILED', failureKind: 'CAPABILITY_UNAVAILABLE', failureCode: 'STORY_BRIEF_GENERATION_NOT_AUTHORIZED' });
    expect(await db.storyBriefVersion.count({ where: { storyId: s.storyId } })).toBe(0);
  });

  it('READY persists once; reopen (read AND request) costs zero compute', async () => {
    const s = await story('Ready story');
    const gen = new FakeGenerator();
    const first = await service(gen).request(s.storyId, requester);
    expect(first).toMatchObject({ state: 'READY', versions: 1, brief: { version: 1, state: 'READY' } });
    expect(gen.calls).toBe(1);
    expect(await service(gen).request(s.storyId, requester)).toMatchObject({ state: 'READY', versions: 1 });
    expect(await service(gen).read(s.storyId)).toMatchObject({ state: 'READY', versions: 1 });
    expect(gen.calls).toBe(1);
  });

  it.each(['PARTIAL', 'INSUFFICIENT'] as const)('%s is a persisted conclusion per evidence revision: reopen does not respend', async (state) => {
    const s = await story(`${state} story`);
    const gen = new FakeGenerator();
    gen.next = concluded(state);
    expect((await service(gen).request(s.storyId, requester)).state).toBe(state);
    expect((await service(gen).request(s.storyId, requester)).state).toBe(state);
    expect(gen.calls).toBe(1);
  });

  it('the Brief stores no requester identity and the generator receives evidence only', async () => {
    const s = await story('Privacy story');
    const gen = new FakeGenerator();
    await service(gen).request(s.storyId, requester);
    const row = await db.storyBriefVersion.findFirstOrThrow({ where: { storyId: s.storyId } });
    expect(JSON.stringify(row)).not.toContain(requester.userId);
    expect(Object.keys(gen.inputs[0] as object).sort()).toEqual(['articleRefs', 'attemptId', 'evidenceRevision', 'leadArticle', 'materialVersion', 'storyId']);
  });

  it('a same-publisher update makes the Brief STALE (briefVersion does not move); refresh APPENDS v2 and v1 is unchanged', async () => {
    const s = await story('Port strike halts exports');
    const gen = new FakeGenerator();
    const v1 = await service(gen).request(s.storyId, requester);
    const before = await db.story.findUniqueOrThrow({ where: { id: s.storyId } });
    /* Same host + same headline + inside the window → JOIN without a new host. */
    await identity.ensureStoryForArticle(await article('one.example', s.headline, 30));
    const after = await db.story.findUniqueOrThrow({ where: { id: s.storyId } });
    expect(after.briefVersion).toBe(before.briefVersion); /* the alert key did not move … */
    const stale = await service(gen).read(s.storyId);
    expect(stale.state).toBe('STALE'); /* … but the evidence set did */
    expect(stale.brief?.version).toBe(1);
    expect(stale.changedSince).toMatchObject({ fromRevision: v1.currentEvidenceRevision, basis: 'EVIDENCE_SET_CHANGED' });
    const v2 = await service(gen).request(s.storyId, requester);
    expect(v2).toMatchObject({ state: 'READY', versions: 2, brief: { version: 2 } });
    const rows = await db.storyBriefVersion.findMany({ where: { storyId: s.storyId }, orderBy: { version: 'asc' } });
    expect(rows.map((r) => [r.version, r.evidenceRevision === v1.currentEvidenceRevision])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('versions are append-only in the DATABASE (UPDATE and DELETE refused by trigger)', async () => {
    const s = await story('Immutable story');
    await service(new FakeGenerator()).request(s.storyId, requester);
    const row = await db.storyBriefVersion.findFirstOrThrow({ where: { storyId: s.storyId } });
    await expect(db.storyBriefVersion.update({ where: { id: row.id }, data: { state: 'PARTIAL' } })).rejects.toThrow(/append-only/);
    await expect(db.storyBriefVersion.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });

  it('concurrent Read Brief for the same story + revision: ONE generation; the others see CHECKING', async () => {
    const s = await story('Concurrent story');
    const gen = new FakeGenerator();
    let release!: () => void;
    gen.gate = new Promise<void>((r) => (release = r));
    const svc = service(gen);
    const first = svc.request(s.storyId, requester);
    await new Promise((r) => setTimeout(r, 300));
    const others = await Promise.all([svc.request(s.storyId, requester), svc.request(s.storyId, requester)]);
    expect(others.map((v) => v.state)).toEqual(['CHECKING', 'CHECKING']);
    release();
    expect((await first).state).toBe('READY');
    expect(gen.calls).toBe(1);
    expect(await db.storyBriefAttempt.count({ where: { storyId: s.storyId } })).toBe(1);
  });

  it('a provider failure is FAILED / PROVIDER_DEGRADED, not INSUFFICIENT; with an older Brief it is STALE + lastAttempt FAILED', async () => {
    const s = await story('Degraded story');
    const gen = new FakeGenerator();
    gen.next = { outcome: 'FAILED', failureKind: 'PROVIDER_DEGRADED', failureCode: 'MODEL_TIMEOUT', operationId: 'op-x' };
    const failed = await service(gen).request(s.storyId, requester);
    expect(failed.state).toBe('FAILED');
    expect(failed.lastAttempt).toMatchObject({ failureKind: 'PROVIDER_DEGRADED', failureCode: 'MODEL_TIMEOUT' });
    gen.next = concluded('READY');
    await service(gen).request(s.storyId, requester);
    await identity.ensureStoryForArticle(await article('one.example', s.headline, 20));
    gen.next = { outcome: 'FAILED', failureKind: 'PROVIDER_DEGRADED', failureCode: 'MODEL_FAILURE', operationId: null };
    const stale = await service(gen).request(s.storyId, requester);
    expect(stale.state).toBe('STALE');
    expect(stale.brief?.version).toBe(1);
    expect(stale.lastAttempt).toMatchObject({ status: 'FAILED', failureKind: 'PROVIDER_DEGRADED' });
  });

  it('an expired claim is closed as OUTCOME_UNKNOWN (never silently re-run as the same attempt)', async () => {
    const s = await story('Lease story');
    const gen = new FakeGenerator();
    const svc = service(gen);
    const current = await svc.read(s.storyId);
    const past = new Date(Date.now() - 2 * STORY_BRIEF_LEASE_MS);
    const stuck = await db.storyBriefAttempt.create({
      data: { storyId: s.storyId, evidenceRevision: current.currentEvidenceRevision, status: 'CHECKING', leaseExpiresAt: past, startedAt: past },
    });
    expect((await svc.read(s.storyId)).state).toBe('NOT_GENERATED'); /* an expired lease is not CHECKING */
    await svc.request(s.storyId, requester);
    expect(await db.storyBriefAttempt.findUniqueOrThrow({ where: { id: stuck.id } })).toMatchObject({ status: 'FAILED', failureKind: 'OUTCOME_UNKNOWN', failureCode: 'LEASE_EXPIRED' });
    expect(gen.calls).toBe(1); /* the NEW explicit request ran once; the stuck one was not resumed */
  });

  it('DB refuses a failure without a kind and an unknown conclusion state', async () => {
    const s = await story('Check story');
    const rev = (await service(new FakeGenerator()).read(s.storyId)).currentEvidenceRevision;
    await expect(
      db.storyBriefAttempt.create({ data: { storyId: s.storyId, evidenceRevision: rev, status: 'FAILED', leaseExpiresAt: new Date() } }),
    ).rejects.toThrow();
    await expect(
      db.storyBriefVersion.create({
        data: { storyId: s.storyId, version: 9, evidenceRevision: rev, materialVersion: 1, state: 'FAILED', blocks: {}, evidenceRefs: [], coverageGaps: [], uncertainty: [], asOf: new Date(), generatedAt: new Date() },
      }),
    ).rejects.toThrow();
  });

  it('after a MERGE the survivor shows the merged story’s Brief history (alias set)', async () => {
    const a = await story('Merge left');
    const b = await story('Merge right');
    const gen = new FakeGenerator();
    await service(gen).request(b.storyId, requester);
    await identity.merge({ survivorId: a.storyId, mergedId: b.storyId, actorId: 'editor', reason: 'same event' });
    const viaAlias = await service(gen).read(b.storyId);
    expect(viaAlias.storyId).toBe(a.storyId);
    expect(viaAlias.versions).toBe(1);
    expect(viaAlias.state).toBe('STALE'); /* the merged evidence set differs from the Brief's */
  });

  it('Discussion anchors a comment to a Brief VERSION of the same story; a foreign version is refused', async () => {
    const a = await article('one.example', 'Discussed story');
    const { story: s } = await identity.ensureStoryForArticle(a);
    const other = await story('Other story');
    const gen = new FakeGenerator();
    await service(gen).request(s.storyId, requester);
    await service(gen).request(other.storyId, requester);
    const mine = await db.storyBriefVersion.findFirstOrThrow({ where: { storyId: s.storyId } });
    const foreign = await db.storyBriefVersion.findFirstOrThrow({ where: { storyId: other.storyId } });
    const userId = (await db.user.create({ data: { email: `${randomUUID()}@brief.test` } })).id;
    const comment = await discussion.post(userId, { ...a, body: 'On this Brief', idempotencyKey: `k-${randomUUID()}`, storyBriefVersionId: mine.id });
    expect(comment.storyBriefVersionId).toBe(mine.id);
    await expect(
      discussion.post(userId, { ...a, body: 'Wrong Brief', idempotencyKey: `k-${randomUUID()}`, storyBriefVersionId: foreign.id }),
    ).rejects.toThrow(/STORY_BRIEF_VERSION/);
    const plain = await discussion.post(userId, { ...a, body: 'No Brief on screen', idempotencyKey: `k-${randomUUID()}` });
    expect(plain.storyBriefVersionId).toBeNull();
  });
});
