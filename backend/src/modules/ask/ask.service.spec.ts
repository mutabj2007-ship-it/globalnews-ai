import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { AnalysisService } from '../analysis/service/analysis.service';
import { BetaFeatureFlagsService } from '../compute/flags/beta-feature-flags.service';
import { SandPricingService } from '../compute/pricing/sand-pricing.service';
import { EntitlementService } from '../compute/entitlement/entitlement.service';
import { StoredResultService } from '../compute/stored-result/stored-result.service';
import { SandLedgerService } from '../compute/ledger/sand-ledger.service';
import {
  ComputeOperationService,
  type OperationOwner,
} from '../compute/operation/compute-operation.service';
import { ComputeQuoteService } from '../compute/quote/compute-quote.service';
import { FakePrisma, resetFakePrismaIds } from '../compute/testing/fake-prisma.testing';
import { AskService } from './ask.service';
import { AskThreadService } from './thread/ask-thread.service';
import { EvidenceRevisionService } from './evidence/evidence-revision.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §30 "REQUIRED TESTS — Ask" (server side):
 *   - multiple-turn thread works
 *   - follow-up retains context
 *   - reload/resume behavior matches the implemented persistence contract
 *
 * and §30 "AI-cost protection":
 *   - reopening stored result triggers no new expensive execution
 *   - cache reuse works
 */

const FLAGS_ON: Record<string, string> = {
  ASK_CONVERSATIONAL_V2_ENABLED: 'true',
  ASK_PERSISTENCE_ENABLED: 'true',
  COMPUTE_CLASSIFICATION_ENABLED: 'true',
  METERED_COMPUTE_ENABLED: 'true',
  SAND_LEDGER_ENABLED: 'true',
};

const GUEST: OperationOwner = { kind: 'anonymous', key: 'guest:abc', sessionKey: 'abc' };
const OTHER_GUEST: OperationOwner = { kind: 'anonymous', key: 'guest:xyz', sessionKey: 'xyz' };

/** A minimal successful AnalysisApiResponse — the shape Ask wraps, unchanged. */
function successResponse(query: string): AnalysisApiResponse {
  return {
    query,
    requestedLanguage: 'en',
    responseLanguage: 'en',
    normalizedQuery: query.toLowerCase(),
    analysis: { summary: `answer to ${query}` } as AnalysisApiResponse['analysis'],
    articles: [
      { id: 'a1', title: 'Source one', url: 'https://example.test/1' },
      { id: 'a2', title: 'Source two', url: 'https://example.test/2' },
    ] as AnalysisApiResponse['articles'],
    retrievalContext: {} as AnalysisApiResponse['retrievalContext'],
    sourceEntities: {} as AnalysisApiResponse['sourceEntities'],
    provenance: {
      provider: 'openai',
      model: 'test-model',
      executionMode: 'development',
      analysisMode: 'live-ai',
      status: 'success',
      cached: false,
      latencyMs: 120,
      tokenUsage: { promptTokens: 800, completionTokens: 300, totalTokens: 1100 },
    },
  };
}

function failureResponse(
  status: AnalysisApiResponse['provenance']['status'],
  failureReason?: AnalysisApiResponse['provenance']['failureReason'],
): AnalysisApiResponse {
  const base = successResponse('failing question');
  return {
    ...base,
    analysis: null,
    provenance: { ...base.provenance, status, failureReason, tokenUsage: undefined },
  };
}

interface Harness {
  prisma: FakePrisma;
  ask: AskService;
  ledger: SandLedgerService;
  storedResults: StoredResultService;
  analyze: jest.Mock;
}

async function buildHarness(
  env: Record<string, string> = FLAGS_ON,
  analysisImpl: () => Promise<AnalysisApiResponse> = async () => successResponse('q'),
): Promise<Harness> {
  resetFakePrismaIds();
  const prisma = new FakePrisma();
  const analyze = jest.fn(analysisImpl);

  // A stable evidence corpus: one article with a fixed fetchedAt, so
  // the §6 evidence revision is a real bucketed value that does not
  // move between the turns of a single test. Without this, the
  // clock-derived fallback would advance and every stored-result
  // reuse assertion would be testing the fallback rather than reuse.
  prisma.article.create({
    data: {
      id: 'seed-article',
      url: 'https://example.test/seed',
      fetchedAt: new Date('2026-09-21T10:00:00.000Z'),
    },
  });

  const moduleRef = await Test.createTestingModule({
    providers: [
      AskService,
      AskThreadService,
      EvidenceRevisionService,
      BetaFeatureFlagsService,
      SandPricingService,
      EntitlementService,
      StoredResultService,
      SandLedgerService,
      ComputeOperationService,
      ComputeQuoteService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      { provide: AnalysisService, useValue: { analyzeNews: analyze } },
    ],
  }).compile();

  return {
    prisma,
    ask: moduleRef.get(AskService),
    ledger: moduleRef.get(SandLedgerService),
    storedResults: moduleRef.get(StoredResultService),
    analyze,
  };
}

let keyCounter = 0;
function uniqueKey(): string {
  keyCounter += 1;
  return `idem-key-${keyCounter}-padding`;
}

beforeEach(() => {
  keyCounter = 0;
});

describe('§30 Ask — a multiple-turn thread works', () => {
  it('creates a thread on the first turn and appends to it on the next', async () => {
    const h = await buildHarness();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(first.threadId).toBeTruthy();
    expect(first.userTurn.role).toBe('user');
    expect(first.assistantTurn.role).toBe('assistant');
    expect(first.assistantTurn.status).toBe('answered');

    const second = await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'And what about the economy there?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(second.threadId).toBe(first.threadId);

    const thread = await h.ask.getThread(first.threadId, GUEST);
    expect(thread.turns).toHaveLength(4);
    expect(thread.turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('numbers turns in a stable, strictly increasing sequence', async () => {
    const h = await buildHarness();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'First question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    for (let i = 0; i < 3; i += 1) {
      await h.ask.addTurn({
        owner: GUEST,
        threadId: first.threadId,
        question: `Follow-up ${i}`,
        language: 'en',
        idempotencyKey: uniqueKey(),
      });
    }

    const thread = await h.ask.getThread(first.threadId, GUEST);
    expect(thread.turns.map((t) => t.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('keeps previous answers visible, so a long conversation is not destroyed by a new turn', async () => {
    const h = await buildHarness();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'Original question about Rwanda',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'A completely different follow-up',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    const thread = await h.ask.getThread(first.threadId, GUEST);
    expect(thread.turns[0].question).toBe('Original question about Rwanda');
    expect(thread.turns[1].answer).not.toBeNull();
  });

  it('derives a readable thread title from the first question', async () => {
    const h = await buildHarness();
    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    const thread = await h.ask.getThread(first.threadId, GUEST);
    expect(thread.thread.title).toBe('What is happening in Rwanda?');
  });

  it('truncates an overlong title rather than storing a thousand-character one', async () => {
    const h = await buildHarness();
    const first = await h.ask.addTurn({
      owner: GUEST,
      question: `${'a very long question '.repeat(20)}end`,
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    const thread = await h.ask.getThread(first.threadId, GUEST);
    expect(thread.thread.title.length).toBeLessThanOrEqual(81);
    expect(thread.thread.title.endsWith('…')).toBe(true);
  });
});

describe('§30 Ask — a follow-up retains context (§4)', () => {
  it('carries the thread context into retrieval as a story anchor', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'What is the energy situation?',
      language: 'en',
      context: { countryCode: 'RW', subjectLabel: 'Rwanda energy', originRoute: '/map' },
      idempotencyKey: uniqueKey(),
    });

    expect(h.analyze).toHaveBeenCalledWith(
      'What is the energy situation?',
      'en',
      expect.objectContaining({ countryCode: 'RW', title: 'Rwanda energy' }),
    );
  });

  it('stores the originating context on the thread so a return control can be rendered', async () => {
    const h = await buildHarness();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'Tell me about this',
      language: 'en',
      context: {
        originRoute: '/map',
        originLabel: 'World Map',
        countryCode: 'RW',
        countryName: 'Rwanda',
        module: 'energy',
      },
      idempotencyKey: uniqueKey(),
    });

    const thread = await h.ask.getThread(first.threadId, GUEST);
    expect(thread.thread.context).toMatchObject({
      originRoute: '/map',
      originLabel: 'World Map',
      countryCode: 'RW',
      module: 'energy',
    });
  });

  it('does not anchor retrieval when no geography is in context', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'A general question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(h.analyze).toHaveBeenCalledWith('A general question', 'en', undefined);
  });
});

describe('§30 Ask — reload/resume matches the persistence contract', () => {
  it('returns the full conversation after a "reload" — a fresh read with the same owner', async () => {
    const h = await buildHarness();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'Question before reload',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    // Simulates a page reload: a brand-new read, nothing in memory.
    const resumed = await h.ask.getThread(first.threadId, GUEST);

    expect(resumed.turns).toHaveLength(2);
    expect(resumed.turns[0].question).toBe('Question before reload');
    expect(resumed.turns[1].answer).not.toBeNull();
  });

  it('resuming a conversation runs no AI', async () => {
    const h = await buildHarness();
    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'Question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    h.analyze.mockClear();
    await h.ask.getThread(first.threadId, GUEST);

    expect(h.analyze).not.toHaveBeenCalled();
  });

  it('lists the caller’s threads most recently active first', async () => {
    const h = await buildHarness();

    const a = await h.ask.addTurn({
      owner: GUEST,
      question: 'First conversation',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    const b = await h.ask.addTurn({
      owner: GUEST,
      question: 'Second conversation',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    const threads = await h.ask.listThreads(GUEST);
    expect(threads.map((t) => t.id)).toEqual(expect.arrayContaining([a.threadId, b.threadId]));
  });

  it('never exposes one guest’s conversation to another', async () => {
    const h = await buildHarness();
    const mine = await h.ask.addTurn({
      owner: GUEST,
      question: 'My private question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    await expect(h.ask.getThread(mine.threadId, OTHER_GUEST)).rejects.toThrow(/Unknown Ask thread/);
    expect(await h.ask.listThreads(OTHER_GUEST)).toHaveLength(0);
  });

  it('works without persistence, but stores nothing', async () => {
    const h = await buildHarness({
      ASK_CONVERSATIONAL_V2_ENABLED: 'true',
      COMPUTE_CLASSIFICATION_ENABLED: 'true',
    });

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'Ephemeral question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.assistantTurn.status).toBe('answered');
    expect(h.prisma.askThread.rows).toHaveLength(0);
    expect(h.prisma.askTurn.rows).toHaveLength(0);
  });

  it('refuses to run at all when the conversational flag is off', async () => {
    const h = await buildHarness({ COMPUTE_CLASSIFICATION_ENABLED: 'true' });

    await expect(
      h.ask.addTurn({
        owner: GUEST,
        question: 'Anything',
        language: 'en',
        idempotencyKey: uniqueKey(),
      }),
    ).rejects.toThrow(/not enabled/);
    expect(h.analyze).not.toHaveBeenCalled();
  });
});

describe('§30 AI-cost protection — stored-result reuse in a real Ask turn', () => {
  it('asking the same question twice calls the AI once', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    expect(h.analyze).toHaveBeenCalledTimes(1);

    const second = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    // No second provider call — the answer was replayed.
    expect(h.analyze).toHaveBeenCalledTimes(1);
    expect(second.reused).toBe(true);
    expect(second.assistantTurn.storedResultReused).toBe(true);
    expect(second.assistantTurn.computeClass).toBe('STORED');
  });

  it('a second caller benefits from the first caller’s stored result', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'Shared question about Rwanda',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    const other = await h.ask.addTurn({
      owner: OTHER_GUEST,
      question: 'Shared question about Rwanda',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(h.analyze).toHaveBeenCalledTimes(1);
    expect(other.reused).toBe(true);
  });

  it('marks the replayed answer as cached while keeping this caller’s own question text', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    const replay = await h.ask.addTurn({
      owner: GUEST,
      question: 'what is happening in rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(replay.assistantTurn.answer?.provenance.cached).toBe(true);
    expect(replay.assistantTurn.answer?.query).toBe('what is happening in rwanda?');
  });

  it('does not reuse across languages', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'pl',
      idempotencyKey: uniqueKey(),
    });

    expect(h.analyze).toHaveBeenCalledTimes(2);
  });

  it('reports zero-Sand telemetry for a replay, with no invented provider numbers', async () => {
    const h = await buildHarness();

    await h.ask.addTurn({
      owner: GUEST,
      question: 'Rwanda question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    const replay = await h.ask.addTurn({
      owner: GUEST,
      question: 'Rwanda question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(replay.telemetry?.storedResultReused).toBe(true);
    expect(replay.telemetry?.cacheHit).toBe(true);
    expect(replay.telemetry?.inputTokens).toBeUndefined();
    expect(replay.telemetry?.provider).toBeUndefined();
  });
});

describe('§9/§30 — explicit confirmation is required before expensive work runs', () => {
  it('returns a quote and runs NOTHING for an unconfirmed Deep Analysis', async () => {
    const h = await buildHarness();

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'Give me a deep analysis of energy across East Africa',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.assistantTurn.status).toBe('awaiting-confirmation');
    expect(result.quote?.computeClass).toBe('DEEP_ANALYSIS');
    expect(result.quote?.quotedSand).toBe(24);
    expect(result.quote?.requiresConfirmation).toBe(true);
    // The whole point: no provider call was made.
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it('runs the analysis once the quoted operation is explicitly confirmed', async () => {
    const h = await buildHarness();
    const question = 'Give me a deep analysis of energy across East Africa';
    const idempotencyKey = uniqueKey();

    const quoted = await h.ask.addTurn({
      owner: GUEST,
      question,
      language: 'en',
      idempotencyKey,
    });
    expect(h.analyze).not.toHaveBeenCalled();

    const confirmed = await h.ask.addTurn({
      owner: GUEST,
      threadId: quoted.threadId,
      question,
      language: 'en',
      idempotencyKey,
      confirmedOperationId: quoted.quote!.operationId,
    });

    expect(h.analyze).toHaveBeenCalledTimes(1);
    expect(confirmed.assistantTurn.status).toBe('answered');
  });

  it('ignores a confirmation for a different operation', async () => {
    const h = await buildHarness();

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'Give me a deep analysis of energy across East Africa',
      language: 'en',
      idempotencyKey: uniqueKey(),
      confirmedOperationId: 'some-other-operation-id',
    });

    expect(result.assistantTurn.status).toBe('awaiting-confirmation');
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it('never asks an ordinary Ask to confirm anything', async () => {
    const h = await buildHarness();

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.assistantTurn.status).toBe('answered');
    expect(result.quote).toBeUndefined();
    expect(h.analyze).toHaveBeenCalledTimes(1);
  });
});

describe('§3 — the failure states the UI must be able to render', () => {
  it.each([
    ['no-evidence', 'not-attempted' as const, undefined],
    ['invalid-response', 'validation-rejected' as const, undefined],
    ['provider-failed', 'failed' as const, 'provider-timeout' as const],
    ['analysis-failed', 'failed' as const, 'malformed-output' as const],
  ])('maps a %s outcome onto the turn status', async (expected, status, reason) => {
    const h = await buildHarness(FLAGS_ON, async () => failureResponse(status, reason));

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'A question that fails',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.assistantTurn.status).toBe(expected);
  });

  it('records a provider-failed turn when AnalysisService throws outright', async () => {
    const h = await buildHarness(FLAGS_ON, async () => {
      throw new Error('upstream exploded');
    });

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'A question that throws',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.assistantTurn.status).toBe('provider-failed');
  });

  it('§13 — releases the reservation when AnalysisService throws', async () => {
    const h = await buildHarness(FLAGS_ON, async () => {
      throw new Error('upstream exploded');
    });

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'A question that throws',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    const operationId = result.assistantTurn.operationId!;
    expect(await h.ledger.outstandingReservationForOperation(operationId)).toBe(0);
    expect(await h.ledger.netConsumedForOperation(operationId)).toBe(0);
  });

  it('§6 — never stores a failed answer for reuse', async () => {
    const h = await buildHarness(FLAGS_ON, async () =>
      failureResponse('failed', 'provider-timeout'),
    );

    await h.ask.addTurn({
      owner: GUEST,
      question: 'A transiently failing question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(h.prisma.storedResult.rows).toHaveLength(0);

    // The next attempt genuinely retries rather than replaying the blip.
    await h.ask.addTurn({
      owner: GUEST,
      question: 'A transiently failing question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    expect(h.analyze).toHaveBeenCalledTimes(2);
  });

  it('§13 — a no-evidence answer costs nothing', async () => {
    const h = await buildHarness(FLAGS_ON, async () => failureResponse('not-attempted'));

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'A question with no evidence',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    const operationId = result.assistantTurn.operationId!;
    expect(await h.ledger.netConsumedForOperation(operationId)).toBe(0);
    expect(await h.ledger.outstandingReservationForOperation(operationId)).toBe(0);
  });
});

describe('§12 — a duplicate Ask submission does not run the AI twice', () => {
  it('reuses the operation for a repeated submission with the same key', async () => {
    const h = await buildHarness();
    const key = uniqueKey();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: key,
    });
    const second = await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: key,
    });

    expect(h.prisma.computeOperation.rows).toHaveLength(1);
    expect(second.assistantTurn.operationId).toBe(first.assistantTurn.operationId);
  });

  it('a double click does not duplicate the exchange in the conversation', async () => {
    const h = await buildHarness();
    const key = uniqueKey();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: key,
    });
    const second = await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: key,
    });

    expect(second.reused).toBe(true);
    expect(second.assistantTurn.id).toBe(first.assistantTurn.id);

    const thread = await h.ask.getThread(first.threadId, GUEST);
    // Exactly one exchange, not two.
    expect(thread.turns).toHaveLength(2);
  });

  it('a retried key replays the recorded failure rather than silently retrying', async () => {
    const h = await buildHarness(FLAGS_ON, async () =>
      failureResponse('failed', 'provider-timeout'),
    );
    const key = uniqueKey();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'A failing question',
      language: 'en',
      idempotencyKey: key,
    });
    const retry = await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'A failing question',
      language: 'en',
      idempotencyKey: key,
    });

    // Same key means the same logical operation, so the same outcome.
    expect(retry.assistantTurn.id).toBe(first.assistantTurn.id);
    expect(retry.assistantTurn.status).toBe('provider-failed');
    expect(h.analyze).toHaveBeenCalledTimes(1);

    // A genuinely new attempt uses a new key, and does re-run.
    await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'A failing question',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });
    expect(h.analyze).toHaveBeenCalledTimes(2);
  });

  it('a retried duplicate never reserves or settles a second time', async () => {
    const h = await buildHarness();
    const key = uniqueKey();

    const first = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: key,
    });
    await h.ask.addTurn({
      owner: GUEST,
      threadId: first.threadId,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: key,
    });

    const operationId = first.assistantTurn.operationId!;
    const types = (await h.ledger.entriesForOperation(operationId)).map((e) => e.entryType);
    expect(types).toEqual(['QUOTE', 'RESERVE', 'SETTLE']);
    expect(await h.ledger.outstandingReservationForOperation(operationId)).toBe(0);
  });
});

describe('§14 — cost telemetry from a real turn', () => {
  it('captures provider, model, tokens and evidence count from the analysis response', async () => {
    const h = await buildHarness();

    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.telemetry).toMatchObject({
      provider: 'openai',
      model: 'test-model',
      inputTokens: 800,
      outputTokens: 300,
      evidenceCount: 2,
      storedResultReused: false,
    });
    expect(result.telemetry!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('keeps telemetry off the turn the user sees — it travels on the envelope only', async () => {
    const h = await buildHarness();
    const result = await h.ask.addTurn({
      owner: GUEST,
      question: 'What is happening in Rwanda?',
      language: 'en',
      idempotencyKey: uniqueKey(),
    });

    expect(result.assistantTurn).not.toHaveProperty('telemetry');
  });
});
