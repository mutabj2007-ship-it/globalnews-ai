import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import { AskV2Service } from './ask-v2.service';
import { AskR2ExecutionAdapter, retrievalDiagnosticsFor } from './ask-r2-execution.adapter';
import { AskObservationService } from '../ask-observability/ask-observation.service';
import { AskObservationRetentionService } from '../ask-observability/ask-observation-retention.service';
import { askRequestContext } from './ask-request-context';
import { accountPrincipal } from './guest/ask-principal';
import {
  QUERY_FINGERPRINT_KEY_ENV,
  RetrievalTraceCollector,
  queryFingerprint,
} from '../news/retrieval-trace/retrieval-trace';
import {
  attachRetrievalDiagnostics,
  buildRetrievalDiagnostics,
} from '../news/retrieval-trace/retrieval-diagnostics';

/**
 * RETRIEVAL R1 · T1.1 — DELETION INHERITANCE, PROVED ON POSTGRESQL (E1-03 T-2 / E1-08 L-5).
 *
 * The REAL AskV2Service lifecycle and the REAL adapter persist the diagnostic envelope into
 * StoredResult.payload; only the analysis stand-in is faked (no OpenAI, no GNews). Then each
 * deletion path a reader or the system can take is exercised, and the envelope is looked for
 * directly in the table afterwards:
 *   1. the reader deletes the thread (AskV2Service.deleteThread);
 *   2. the account is deleted (User → StoredResult ON DELETE CASCADE);
 *   3. a guest session is deleted (GuestSession → StoredResult ON DELETE CASCADE).
 * The envelope has no table of its own, so nothing can outlive the row that carries it.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask R2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const KEY = 'pg-fixture-key-'.repeat(3);
const SCHEMA = 'retrieval-diagnostics/2';

live(
  'T1.1 — the retrieval diagnostic envelope is deleted with its stored result, thread and owner',
  () => {
    let db: PrismaClient;
    let values: Record<string, string>;
    let userId: string;
    let service: AskV2Service;
    let switches: OperationalSwitchService;
    const analyzeNews = jest.fn();
    const config = { get: (key: string) => values[key] } as unknown as ConfigService;
    let priorKey: string | undefined;

    const within = <T>(work: () => Promise<T>): Promise<T> =>
      askRequestContext.run({ accountId: userId, ipScope: 'ip:v4:198.51.100.61' }, work);
    const newThread = async () =>
      (
        await service.createThread(accountPrincipal(userId), {
          idempotencyKey: randomUUID(),
          language: 'en',
        })
      ).id;
    const submit = (threadId: string, question: string) =>
      within(() =>
        service.submit(accountPrincipal(userId), threadId, {
          idempotencyKey: randomUUID(),
          question,
          language: 'en',
          intent: 'ask',
        }),
      );
    /** Envelopes present in the whole table for one owner, read with SQL — not through the service. */
    const envelopesOf = async (owner: { userId?: string; guestSessionId?: string }) => {
      const rows = await db.storedResult.findMany({
        where: owner,
        select: { id: true, payload: true },
      });
      return rows.filter((row) => JSON.stringify(row.payload).includes(SCHEMA));
    };

    async function allOn(): Promise<void> {
      values.ASK_R2_ENABLED = 'true';
      values.ASK_PUBLIC_COMPUTE_ENABLED = 'true';
      await switches.set('ASK_R2_ENABLED', true, 't1-1-live-spec', 'test');
      await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 't1-1-live-spec', 'test');
      switches.forget();
    }

    function build(): void {
      const meter = new ComputeMeterService(db as unknown as PrismaService, config);
      const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
      switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
      const adapter = new AskR2ExecutionAdapter(
        { analyzeNews } as never,
        { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
        {
          id: 'mock',
          displayName: 'Mock',
          isMock: true,
          answerBackground: async () => ({ text: null }),
        } as never,
        meter,
        breaker,
        switches,
        {
          get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
        } as never,
        { registeredDomains: () => ['CONFLICT'] } as never,
        new AskObservationService(
          db as unknown as PrismaService,
          new AskObservationRetentionService(db as unknown as PrismaService),
        ),
        {
          boundSpecialistDomains: () => ['CONFLICT'],
          read: async () => ({ considered: [], contributions: [] }),
        } as never,
      );
      service = new AskV2Service(db as unknown as PrismaService, config, adapter);
    }

    /** An analysis carrying a real sealed trace: one search, one successful attempt. */
    function tracedAnalysis(question: string): AnalysisApiResponse {
      const collector = new RetrievalTraceCollector();
      const fingerprint = queryFingerprint(question);
      const search = collector.beginSearch({
        capability: 'search',
        ...(fingerprint === undefined ? {} : { queryFingerprint: fingerprint }),
        queryLength: question.length,
        requestedLang: 'en',
        sentLangGnews: 'en',
        window: null,
        limit: 10,
        relevanceMode: 'generic',
        requestedSource: false,
        allowFallback: true,
      });
      const attempt = collector.beginAttempt({
        searchOrdinal: search?.ordinal ?? null,
        providerId: 'gnews',
        capability: 'search',
        tier: 'PRIMARY',
        initiatedAt: '2026-10-11T20:00:00.000Z',
        requestedLang: 'en',
        sentLang: 'en',
      });
      if (attempt !== undefined) {
        attempt.outcome = 'SUCCESS';
        attempt.rawFetchedCount = 2;
      }
      const response = {
        analysis: {},
        articles: [{ id: 'a' }, { id: 'b' }],
        retrievalContext: {},
      } as unknown as AnalysisApiResponse;
      return attachRetrievalDiagnostics(
        response,
        buildRetrievalDiagnostics(collector.seal(), {
          windowExcludedOutsideWindow: null,
          anchorGate: null,
          rightsAiInputExcluded: null,
          rightsAiInputReasons: null,
          rightsAiInputPendingReview: null,
          finalEvidence: 2,
        }),
      );
    }

    beforeAll(async () => {
      priorKey = process.env[QUERY_FINGERPRINT_KEY_ENV];
      process.env[QUERY_FINGERPRINT_KEY_ENV] = KEY;
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
      await db.$connect();
    });
    afterAll(async () => {
      if (priorKey === undefined) delete process.env[QUERY_FINGERPRINT_KEY_ENV];
      else process.env[QUERY_FINGERPRINT_KEY_ENV] = priorKey;
      await db?.$disconnect();
    });

    beforeEach(async () => {
      await db.$executeRawUnsafe(
        'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
      );
      values = { ASK_V2_ENABLED: 'true', ASK_FLAG_CACHE_MS: '0', ASK_BREAKER_CACHE_MS: '0' };
      analyzeNews.mockReset();
      analyzeNews.mockImplementation(async (question: unknown, ...args: unknown[]) => {
        const policy = args[5] as {
          usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
        };
        policy?.usageSink?.({ promptTokens: 2500, completionTokens: 600 });
        return tracedAnalysis(String(question));
      });
      build();
      userId = randomUUID();
      await db.user.create({ data: { id: userId, email: `t1-1-${userId}@example.invalid` } });
      await allOn();
    });
    afterEach(async () => {
      await db.user.deleteMany({ where: { id: userId } });
    });

    it('the real lifecycle persists the bounded, allowlisted envelope (positive control)', async () => {
      const op = await submit(await newThread(), 'What is happening in Kenya?');
      expect(op.status).toBe('COMPLETED');
      const [row] = await envelopesOf({ userId });
      expect(row?.id).toBe(op.storedResultId);
      const envelope = (row?.payload as { retrievalDiagnostics: Record<string, unknown> })
        .retrievalDiagnostics;
      expect(envelope).toMatchObject({
        schema: SCHEMA,
        persisted: { maxBytes: 8192, overflowLevel: 0 },
      });
      expect(Buffer.byteLength(JSON.stringify(envelope), 'utf8')).toBeLessThanOrEqual(8192);
      expect(
        (envelope.searches as Array<{ queryFingerprint?: string }>)[0]?.queryFingerprint,
      ).toMatch(/^[0-9a-f]{16}$/);
    });

    it('1 · deleting the thread deletes the stored result, and the envelope with it', async () => {
      const threadId = await newThread();
      const op = await submit(threadId, 'What is happening in Kenya?');
      expect(await envelopesOf({ userId })).toHaveLength(1);
      await service.deleteThread(userId, threadId);
      expect(await db.storedResult.findUnique({ where: { id: op.storedResultId! } })).toBeNull();
      expect(await envelopesOf({ userId })).toHaveLength(0);
      const leftover = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*) AS n FROM "StoredResult" WHERE "id" = $1 OR ("userId" = $2 AND payload::text LIKE '%' || $3 || '%')`,
        op.storedResultId,
        userId,
        SCHEMA,
      );
      expect(Number(leftover[0]?.n)).toBe(0);
    });

    it('2 · deleting the account deletes every stored result and envelope it owned', async () => {
      const first = await submit(await newThread(), 'What is happening in Kenya?');
      const second = await submit(await newThread(), 'What is happening in Rwanda?');
      expect(await envelopesOf({ userId })).toHaveLength(2);
      await db.user.delete({ where: { id: userId } });
      for (const id of [first.storedResultId!, second.storedResultId!]) {
        expect(await db.storedResult.findUnique({ where: { id } })).toBeNull();
      }
      expect(await envelopesOf({ userId })).toHaveLength(0);
    });

    it('3 · deleting a guest session deletes the guest-owned stored result and its envelope', async () => {
      const guest = await db.guestSession.create({
        data: {
          tokenHash: randomBytes(32).toString('hex'),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      const route = {
        plan: { terminalState: 'EXECUTABLE' },
        envelope: { geography: { candidates: [] } },
      } as unknown as Parameters<typeof retrievalDiagnosticsFor>[1];
      const stored = await db.storedResult.create({
        data: {
          guestSessionId: guest.id,
          fingerprint: `t1-1-${randomUUID()}`,
          evidenceRevision: 'r',
          expiresAt: new Date(Date.now() + 3_600_000),
          payload: {
            retrievalDiagnostics: retrievalDiagnosticsFor(
              tracedAnalysis('What is happening in Kenya?'),
              route,
            ),
          } as never,
        },
      });
      expect(await envelopesOf({ guestSessionId: guest.id })).toHaveLength(1);
      await db.guestSession.delete({ where: { id: guest.id } });
      expect(await db.storedResult.findUnique({ where: { id: stored.id } })).toBeNull();
    });
  },
);
