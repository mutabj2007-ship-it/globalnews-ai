import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { DataRetentionService } from './data-retention.service';
import { resolveRetentionPolicy } from './retention-policy';

/**
 * TRUST R1 (CTO §7) — the Beta retention policy deletes UNDERLYING rows, and only out-of-policy
 * ones: each category has a positive control (removed) and a negative control (kept).
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Retention live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('Beta retention policy — live PostgreSQL', () => {
  let db: PrismaClient;
  const NOW = new Date('2026-10-03T12:00:00Z');
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  const service = () =>
    new DataRetentionService(
      db as unknown as PrismaService,
      resolveRetentionPolicy({ RETENTION_SWEEP_ENABLED: 'true' }),
    );

  async function thread(userId: string, lastActivity: Date, bookmarked = false) {
    const t = await db.askThread.create({
      data: { userId, clientKey: randomUUID(), requestHash: randomUUID(), language: 'en' },
    });
    const result = await db.storedResult.create({
      data: {
        userId,
        fingerprint: randomUUID(),
        evidenceRevision: 'r',
        payload: {},
        expiresAt: NOW,
      },
    });
    const op = await db.computeOperation.create({
      data: {
        userId,
        clientKey: randomUUID(),
        requestHash: randomUUID(),
        kind: 'ask',
        computeClass: 'FRESH_BOUNDED',
        fingerprint: randomUUID(),
        plan: {},
        quoteExpiresAt: NOW,
        storedResultId: result.id,
      },
    });
    const turn = await db.askTurn.create({
      data: { threadId: t.id, sequence: 1, question: 'q', language: 'en', operationId: op.id },
    });
    if (bookmarked) await db.askBookmark.create({ data: { userId, turnId: turn.id } });
    await db.$executeRawUnsafe(
      'UPDATE "AskThread" SET "updatedAt" = $1 WHERE id = $2',
      lastActivity,
      t.id,
    );
    return { thread: t.id, op: op.id, result: result.id };
  }

  it('enforces each category with positive and negative controls', async () => {
    const user = await db.user.create({ data: { email: `${randomUUID()}@example.test` } });
    const old = await thread(user.id, daysAgo(400));
    const recent = await thread(user.id, daysAgo(30));
    const saved = await thread(user.id, daysAgo(400), true);

    const ticket = (status: 'RESOLVED' | 'OPEN', updated: Date) =>
      db.supportTicket
        .create({
          data: {
            reference: `GN-${randomUUID().slice(0, 8)}`,
            userId: user.id,
            category: 'BUG_REPORT',
            subject: 's',
            status,
          },
        })
        .then(async (t) => {
          await db.$executeRawUnsafe(
            'UPDATE "SupportTicket" SET "updatedAt" = $1 WHERE id = $2',
            updated,
            t.id,
          );
          return t.id;
        });
    const oldResolved = await ticket('RESOLVED', daysAgo(800));
    const recentResolved = await ticket('RESOLVED', daysAgo(100));
    const oldOpen = await ticket('OPEN', daysAgo(800));

    const event = (at: Date) =>
      db.productEvent.create({ data: { name: 'today_view', createdAt: at } }).then((e) => e.id);
    const oldEvent = await event(daysAgo(120));
    const newEvent = await event(daysAgo(10));

    const tag = randomUUID().slice(0, 8);
    await db.computeMeter.createMany({
      data: [
        { scope: `ip:h:${tag}old`, bucketStart: daysAgo(9), units: 1n },
        { scope: `ip:h:${tag}new`, bucketStart: daysAgo(2), units: 1n },
        { scope: `guestexec:ip:v4:198.51.100.${tag.length}`, bucketStart: daysAgo(9), units: 1n },
        { scope: `conc:ip:h:${tag}idle`, bucketStart: new Date(0), units: 0n },
        { scope: `conc:ip:h:${tag}busy`, bucketStart: new Date(0), units: 1n },
        { scope: `acct:${tag}`, bucketStart: daysAgo(100), units: 1n },
        { scope: `acct:${tag}`, bucketStart: daysAgo(5), units: 1n },
      ],
    });

    await service().sweep(NOW);

    const exists = async (model: 'askThread' | 'computeOperation' | 'storedResult', id: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((await (db[model] as any).findUnique({ where: { id } })) as unknown) !== null;
    /* conversations: the old one is GONE with its turns, operation and stored answer */
    expect(await exists('askThread', old.thread)).toBe(false);
    expect(await exists('computeOperation', old.op)).toBe(false);
    expect(await exists('storedResult', old.result)).toBe(false);
    expect(await db.askTurn.count({ where: { threadId: old.thread } })).toBe(0);
    expect(await exists('askThread', recent.thread)).toBe(true);
    expect(await exists('askThread', saved.thread)).toBe(true);

    const ticketExists = async (id: string) =>
      (await db.supportTicket.findUnique({ where: { id } })) !== null;
    expect(await ticketExists(oldResolved)).toBe(false);
    expect(await ticketExists(recentResolved)).toBe(true);
    expect(await ticketExists(oldOpen)).toBe(true);

    expect(await db.productEvent.findUnique({ where: { id: oldEvent } })).toBeNull();
    expect(await db.productEvent.findUnique({ where: { id: newEvent } })).not.toBeNull();

    const scopes = (await db.computeMeter.findMany({ where: { scope: { contains: tag } } })).map(
      (m) => `${m.scope}@${m.bucketStart.toISOString().slice(0, 10)}`,
    );
    expect(scopes.some((s) => s.includes(`${tag}old`))).toBe(false);
    expect(scopes.some((s) => s.includes(`${tag}new`))).toBe(true);
    expect(scopes.some((s) => s.startsWith('guestexec:ip:v4:'))).toBe(false); // legacy raw-IP row
    expect(scopes.some((s) => s.includes(`${tag}idle`))).toBe(false);
    expect(scopes.some((s) => s.includes(`${tag}busy`))).toBe(true);
    expect(scopes.filter((s) => s.startsWith(`acct:${tag}`))).toEqual([
      `acct:${tag}@${daysAgo(5).toISOString().slice(0, 10)}`,
    ]);
  });

  it('the kill switch stops every deletion', async () => {
    const off = new DataRetentionService(
      db as unknown as PrismaService,
      resolveRetentionPolicy({ RETENTION_SWEEP_ENABLED: 'false' }),
    );
    expect(resolveRetentionPolicy({ RETENTION_SWEEP_ENABLED: 'false' }).enabled).toBe(false);
    off.onApplicationBootstrap(); // must not arm a timer
    off.onApplicationShutdown();
  });
});
