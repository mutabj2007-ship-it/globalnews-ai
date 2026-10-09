import { createHash, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { AskObservationService } from '../../ask-observability/ask-observation.service';
import { AskObservationRetentionService } from '../../ask-observability/ask-observation-retention.service';
import { AskSpecialistReadCoordinator } from '../../ask-intelligence/ask-specialist-read.coordinator';
import { ConflictObservationRepository } from '../../conflict-observation/conflict-observation.repository';
import { ConflictObservationProducer } from '../../conflict-observation/conflict-observation.producer';
import {
  UCDP_CANDIDATE_CSV_HEADERS,
  type ReviewedUcdpCandidateCsvCapture,
} from '../../conflict-observation/ucdp-candidate-csv.normalizer';
import { AskV2Service } from '../ask-v2.service';
import { AskR2ExecutionAdapter } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import { accountPrincipal } from '../guest/ask-principal';
import { BriefingsService } from './briefings.service';

/**
 * CTO REVIEW OF cf7a5d1 · POINT 2 — A FRESH MANUAL "CHECK FOR CHANGES" OBTAINS CURRENT PERMITTED
 * SPECIALIST EVIDENCE THROUGH NORMAL ASK EXECUTION, AND IS COMPARED WITH THE SAVED BASELINE.
 *
 * Real: AskV2Service lifecycle (submit → reserve → execute), AskR2ExecutionAdapter + router, the ONE
 * AskSpecialistReadCoordinator over the REAL ConflictObservationRepository, records admitted by the
 * REAL ConflictObservationProducer from ADMITTED snapshot captures, BriefingsService (follow +
 * recordCheck), PostgreSQL. Stubbed: news analysis (analyzeNews) and model background only.
 *
 * Also proves the no-background-research rule: specialist reads happen ONLY inside the two Ask turns
 * the reader sends; following, recording a check and reading My updates perform zero reads, zero
 * news calls and zero model calls; nothing runs between turns.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Live-path tests require the dedicated loopback test database');
}
jest.setTimeout(90000);
const live = url ? describe : describe.skip;

const QUESTION = 'Is the security situation in DR Congo getting worse?';
const eventId = (): string => String(800000 + Math.floor(Math.random() * 9_000_000));

live('followed question — fresh manual check through normal Ask execution (live PG, real coordinator)', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let userId: string;
  let service: AskV2Service;
  let briefings: BriefingsService;
  let switches: OperationalSwitchService;
  let producer: ConflictObservationProducer;
  let readSpy: jest.SpyInstance;
  const profiles: ReviewedUcdpCandidateCsvCapture[] = [];
  const analyzeNews = jest.fn();
  const answerBackground = jest.fn();
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const run = <T>(work: () => Promise<T>) =>
    askRequestContext.run({ accountId: userId, ipScope: 'ip:v4:198.51.100.77' }, work);

  /* the SAME synthetic-candidate path the Conflict live suite uses: an ADMITTED, COMPLETE capture */
  const ucdpRow = (id: string, date: string) => {
    const v: Record<string, string> = {
      ...Object.fromEntries(UCDP_CANDIDATE_CSV_HEADERS.map((k) => [k, ''])),
      id,
      type_of_violence: '1',
      side_a: 'Synthetic group (test)',
      where_prec: '5',
      latitude: '-1.5',
      longitude: '29.0',
      country: 'DR Congo (Zaire)',
      date_prec: '1',
      date_start: `${date} 00:00:00.000`,
      date_end: `${date} 00:00:00.000`,
    };
    return UCDP_CANDIDATE_CSV_HEADERS.map((k) => v[k]).join(',');
  };
  async function admit(rows: string[]): Promise<void> {
    const bytes = new Uint8Array(Buffer.from([UCDP_CANDIDATE_CSV_HEADERS.join(','), ...rows, ''].join('\r\n')));
    const hash = createHash('sha256').update(bytes).digest('hex');
    const retrievalId = `live-path-${randomUUID()}`;
    const at = new Date();
    await db.snapshotPayload.upsert({
      where: { contentAddress: hash },
      update: {},
      create: { contentAddress: hash, bytes, byteLength: bytes.length, mediaType: 'text/csv' },
    });
    await db.snapshotRetrieval.create({
      data: {
        retrievalId,
        providerId: 'UCDP_GED',
        endpointId: 'synthetic-test',
        requestPath: 'test',
        parameters: [],
        requestedAt: at,
        retrievedAt: at,
        httpStatus: 200,
        mediaType: 'text/csv',
        byteLength: bytes.length,
        contentAddress: hash,
        completeness: 'COMPLETE',
        contentEncoding: 'identity',
        wireByteLength: bytes.length,
        admissibility: 'ADMITTED',
        parserId: 'ucdp-candidate-csv',
        parserVersion: '1',
        parsedAt: at,
        rightsGrade: 'E-5',
        rightsInstrumentRef: 'synthetic-test-only',
        payloadRetentionPermitted: true,
        editionAnnotations: {},
      },
    });
    profiles.push({
      sha256: hash,
      datasetVersion: 'synthetic-test',
      sourceUrl: 'https://ucdp.uu.se/downloads/candidateged/synthetic-test.csv',
      schema: 'ucdp-candidate-csv-v1',
    });
    await producer.admitRetained(retrievalId, 'live-path');
  }

  async function ask(): Promise<{ turnId: string; payload: Record<string, unknown> }> {
    const thread = await service.createThread(accountPrincipal(userId), { idempotencyKey: randomUUID(), language: 'en' });
    const op = await run(() =>
      service.submit(accountPrincipal(userId), thread.id, {
        idempotencyKey: randomUUID(),
        question: QUESTION,
        language: 'en',
        intent: 'ask',
      }),
    );
    expect(op.status).toBe('COMPLETED');
    const turn = await db.askTurn.findFirstOrThrow({ where: { operationId: op.operationId } });
    const stored = await db.storedResult.findUniqueOrThrow({ where: { id: op.storedResultId as string } });
    return { turnId: turn.id, payload: stored.payload as Record<string, unknown> };
  }

  const conflictRefs = (payload: Record<string, unknown>): string[] => {
    const intel = payload.intelligence as { contributions?: { contributorId: string; status: string; observations: { reference: string }[] }[] } | null;
    const c = (intel?.contributions ?? []).find((x) => x.contributorId === 'CONFLICT');
    return c?.status === 'USED' ? c.observations.map((o) => o.reference).sort() : [];
  };

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
    );
    /* ConflictObservation is append-only (its own trigger refuses DELETE): every test admits
       records with fresh synthetic event ids and asserts RELATIVE to the baseline it actually read */
    values = { ASK_V2_ENABLED: 'true', ASK_FLAG_CACHE_MS: '0', ASK_BREAKER_CACHE_MS: '0' };
    answerBackground.mockReset();
    answerBackground.mockImplementation(async () => ({ text: null }));
    analyzeNews.mockReset();
    analyzeNews.mockImplementation(async (...args: unknown[]) => {
      const policy = args[6] as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void };
      policy?.usageSink?.({ promptTokens: 2000, completionTokens: 400 });
      return {
        analysis: {
          summary: 'Reporting describes continued clashes in eastern DR Congo [S1].',
          keyFacts: [{ claim: 'Clashes continued in North Kivu', sourceArticleIds: ['n1'] }],
          sources: [{ articleId: 'n1', publisher: 'Test Wire', title: 'Clashes continue (test)', url: 'https://example.org/n1', publishedAt: '2026-10-01T08:00:00Z' }],
          unknowns: [],
        },
        articles: [{ id: 'n1' }],
        retrievalContext: { dataMode: 'live', providers: ['gnews'] },
      } as unknown as AnalysisApiResponse;
    });

    const prisma = db as unknown as PrismaService;
    const meter = new ComputeMeterService(prisma, config);
    const breaker = new CircuitBreakerService(prisma, meter);
    switches = new OperationalSwitchService(prisma, config, meter);
    producer = new ConflictObservationProducer(prisma, profiles);
    const coordinator = new AskSpecialistReadCoordinator(
      new ConflictObservationRepository(prisma),
      { procurementMatching: async () => ({ kind: 'NO_CAPTURE' }) } as never,
      { readNisrHeadlineCpi: async () => ({ kind: 'GAP' }) } as never,
    );
    readSpy = jest.spyOn(coordinator, 'read');
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      { id: 'mock', displayName: 'Mock General Background', isMock: true, answerBackground } as never,
      meter,
      breaker,
      switches,
      { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      new AskObservationService(prisma, new AskObservationRetentionService(prisma)),
      coordinator,
    );
    service = new AskV2Service(prisma, config, adapter);
    briefings = new BriefingsService(prisma);
    values.ASK_R2_ENABLED = 'true';
    values.ASK_PUBLIC_COMPUTE_ENABLED = 'true';
    await switches.set('ASK_R2_ENABLED', true, 'followed-live-path', 'test');
    await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'followed-live-path', 'test');
    switches.forget();
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `flp-${userId}@example.invalid` } });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });

  it('a newly admitted Conflict record reaches the check through normal execution → MATERIAL_CHANGE; recording runs nothing', async () => {
    await admit([ucdpRow(eventId(), '2026-08-10'), ucdpRow(eventId(), '2026-08-20')]);

    /* 1 · the reader asks and follows: the baseline is a real coordinator read of the real store */
    const first = await ask();
    const baselineRefs = conflictRefs(first.payload);
    expect(baselineRefs.length).toBeGreaterThanOrEqual(2);
    const followed = await briefings.create(userId, { turnId: first.turnId });
    const readsAfterFollow = readSpy.mock.calls.length;
    const newsAfterFollow = analyzeNews.mock.calls.length;

    /* 2 · time passes: a NEW event is admitted by the producer (a period after the baseline) */
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await admit([ucdpRow(eventId(), tomorrow)]);
    /* nothing ran in the background: no read, no news call, no model call between the turns */
    expect(readSpy.mock.calls.length).toBe(readsAfterFollow);
    expect(analyzeNews.mock.calls.length).toBe(newsAfterFollow);

    /* 3 · the reader explicitly runs the check = an ordinary Ask turn through normal execution */
    const second = await ask();
    expect(readSpy.mock.calls.length).toBe(readsAfterFollow + 1);
    const checkRefs = conflictRefs(second.payload);
    const added = checkRefs.filter((r) => !baselineRefs.includes(r));
    expect(added).toHaveLength(1);
    const newRef = added[0];

    /* 4 · recording compares stored-vs-stored: zero reads, zero news, zero model calls */
    const before = { reads: readSpy.mock.calls.length, news: analyzeNews.mock.calls.length, bg: answerBackground.mock.calls.length };
    const check = await briefings.recordCheck(userId, followed.id, second.turnId);
    expect({ reads: readSpy.mock.calls.length, news: analyzeNews.mock.calls.length, bg: answerBackground.mock.calls.length }).toEqual(before);

    expect(check.outcome).toBe('MATERIAL_CHANGE');
    const assessment = check.assessment as { reasons: string[]; structured: { newEvents: { reference: string }[]; compared: string[]; carriedOverCount: number } };
    expect(assessment.reasons[0]).toBe('STRUCTURED_RECORD_NEW_PERIOD');
    expect(assessment.structured.newEvents.map((r) => r.reference)).toEqual([newRef]);
    expect(assessment.structured.carriedOverCount).toBe(checkRefs.length - 1);
    expect(check.resultingVersion).toBe(2);

    /* 5 · checked again with nothing new admitted: UNCHANGED, and no version is written */
    const third = await ask();
    const again = await briefings.recordCheck(userId, followed.id, third.turnId);
    expect(again.outcome).toBe('UNCHANGED');
    expect(again.resultingVersion).toBeNull();
    expect(await db.briefingVersion.count({ where: { briefingId: followed.id } })).toBe(2);
  });

  it('a structured reader failure during a fresh check keeps the baseline (INCOMPLETE_CHECK, no version)', async () => {
    await admit([ucdpRow(eventId(), '2026-08-12')]);
    const first = await ask();
    const followed = await briefings.create(userId, { turnId: first.turnId });
    /* the store is unreachable for the check's own read (the coordinator degrades, never throws) */
    jest.spyOn(ConflictObservationRepository.prototype, 'currentForCountry').mockRejectedValueOnce(new Error('db down'));
    const second = await ask();
    const check = await briefings.recordCheck(userId, followed.id, second.turnId);
    expect(check.outcome).toBe('INCOMPLETE_CHECK');
    expect((check.assessment as { structured: { unassessed: string[] } }).structured.unassessed[0]).toMatch(/^CONFLICT:COD:DEGRADED$/);
    expect(check.resultingVersion).toBeNull();
    expect(await db.briefingVersion.count({ where: { briefingId: followed.id } })).toBe(1);
  });
});
