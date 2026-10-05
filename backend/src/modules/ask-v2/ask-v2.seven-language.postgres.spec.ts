import { accountPrincipal } from './guest/ask-principal';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AskV2Service } from './ask-v2.service';
import {
  ASK_LANGUAGES,
  AskPlan,
  ExecutionResult,
  Language,
  returnLabel,
} from './ask-compute.contract';
import { randomUUID } from 'node:crypto';

/*
 * ASK SEVEN-LANGUAGE PERSISTENCE R1 — the real database must store every language the DTOs
 * accept. 20260922140000_ask_compute_sand_r1 clamped AskThread/AskTurn to ('en','pl') while
 * ASK_LANGUAGES grew to the seven display locales, so a fr/de/es/pt/ar thread passed
 * validation and then failed on the "AskThread_language" CHECK. No mock can see this.
 */
// Never fall back to DATABASE_URL. Only this dedicated, loopback test database is accepted.
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(30000);
const live = url ? describe : describe.skip;
live('Ask V2 seven-language persistence (real PostgreSQL)', () => {
  let db: PrismaClient;
  let service: AskV2Service;
  let userId: string;
  const plan = (): AskPlan => ({
    revision: 'seven-language-revision',
    scope: 'scope:TZ:7d',
    contract: 'test-cto-v1',
    executionKey: 'planned-ask',
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 1,
    domainCount: 1,
    timeWindowDays: 7,
  });
  const execute = jest.fn<Promise<ExecutionResult>, never[]>();

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
    const values: Record<string, string> = {
      ASK_V2_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
    };
    const config = { get: (key: string) => values[key] } as ConfigService;
    service = new AskV2Service(db as PrismaService, config, {
      prepare: async () => plan(),
      execute,
    });
  });
  beforeEach(async () => {
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `seven-${userId}@example.invalid` } });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  test('the accepted language set is exactly the seven display locales', () => {
    expect([...ASK_LANGUAGES].sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'pl', 'pt']);
  });

  test.each([...ASK_LANGUAGES])('%s: thread and turn persist in their own language', async (lang) => {
    const p = accountPrincipal(userId);
    const thread = await service.createThread(p, { idempotencyKey: `t-${lang}`, language: lang });
    await service.quote(p, thread.id, {
      idempotencyKey: `q-${lang}`,
      question: 'What changed in Tanzania this week?',
      language: lang,
      intent: 'ask',
    });
    const stored = await db.askThread.findUniqueOrThrow({
      where: { id: thread.id },
      include: { turns: true },
    });
    // Stored as asked: never relabelled to 'en' to get past the constraint.
    expect(stored.language).toBe(lang);
    expect(stored.turns.map((t) => t.language)).toEqual([lang]);
    // Idempotent replay of the same create returns the same row.
    const again = await service.createThread(p, { idempotencyKey: `t-${lang}`, language: lang });
    expect(again.id).toBe(thread.id);
  });

  test.each([...ASK_LANGUAGES])('%s: answered turn survives execute and reload', async (lang) => {
    const p = accountPrincipal(userId);
    execute.mockImplementation(async () => ({
      succeeded: true,
      payloadJson: JSON.stringify({ answer: { state: 'REFERENCE_BACKGROUND' }, language: lang }),
      evidenceRevision: 'seven-language-revision',
      validUntil: new Date(Date.now() + 3600000).toISOString(),
    }));
    const thread = await service.createThread(p, { idempotencyKey: `r-${lang}`, language: lang });
    const op = await service.quote(p, thread.id, {
      idempotencyKey: `rq-${lang}`,
      question: 'What changed in Tanzania this week?',
      language: lang,
      intent: 'ask',
    });
    await service.accept(p, op.operationId);
    await service.reserve(p, op.operationId);
    const done = await service.execute(p, op.operationId);
    expect(done.status).toBe('COMPLETED');
    // A fresh read (reload / another device) returns the thread in the reader's language.
    const reopened = await service.getThread(p, thread.id);
    expect(reopened.language).toBe(lang);
    expect(reopened.turns.map((t) => t.language)).toEqual([lang]);
    expect(reopened.returnLabel).toBe(returnLabel(lang));
  });

  test('a follow-up may switch language inside the same thread', async () => {
    const p = accountPrincipal(userId);
    const thread = await service.createThread(p, { idempotencyKey: 'switch', language: 'ar' });
    for (const lang of ['ar', 'fr', 'en'] as Language[]) {
      await service.quote(p, thread.id, {
        idempotencyKey: `switch-${lang}`,
        question: 'And what about Dar es Salaam?',
        language: lang,
        intent: 'ask',
      });
    }
    const turns = await db.askTurn.findMany({
      where: { threadId: thread.id },
      orderBy: { sequence: 'asc' },
    });
    expect(turns.map((t) => t.language)).toEqual(['ar', 'fr', 'en']);
  });

  test('the database still refuses a language outside the canonical set', async () => {
    await expect(
      db.askThread.create({
        data: { userId, clientKey: 'bad', requestHash: 'h', language: 'sw' },
      }),
    ).rejects.toThrow(/AskThread_language/);
    const p = accountPrincipal(userId);
    const thread = await service.createThread(p, { idempotencyKey: 'ok', language: 'en' });
    await service.quote(p, thread.id, {
      idempotencyKey: 'ok-q',
      question: 'What changed?',
      language: 'en',
      intent: 'ask',
    });
    await expect(
      db.askTurn.updateMany({ where: { threadId: thread.id }, data: { language: 'xx' } }),
    ).rejects.toThrow(/AskTurn_language/);
  });
});
