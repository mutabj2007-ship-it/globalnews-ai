import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { StoredResultIdentity } from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { BetaFeatureFlagsService } from './flags/beta-feature-flags.service';
import { SandPricingService } from './pricing/sand-pricing.service';
import { EntitlementService } from './entitlement/entitlement.service';
import { StoredResultService } from './stored-result/stored-result.service';
import { SandLedgerService } from './ledger/sand-ledger.service';
import {
  ComputeOperationService,
  type OperationOwner,
} from './operation/compute-operation.service';
import { ComputeQuoteService } from './quote/compute-quote.service';
import { FakePrisma, resetFakePrismaIds } from './testing/fake-prisma.testing';

/**
 * BETA-SIMPLE-ASK-SAND-1 §30 "REQUIRED TESTS — Sand":
 *   - quote can be generated
 *   - charging OFF prevents mutation
 *   - explicit confirmation required
 *   - idempotency works
 *   - failed operation releases reservation
 *   - existing result reopen costs zero new Sand
 *
 * and §30 "AI-cost protection":
 *   - reopening stored result triggers no new expensive execution
 *   - category click does not auto-run AI
 *   - duplicate request does not duplicate operation
 *   - cache reuse works
 *   - compute class is backend-owned
 */

/** Every §10 flag on EXCEPT charging — the state this tranche ships. */
const FLAGS_CHARGING_OFF: Record<string, string> = {
  COMPUTE_CLASSIFICATION_ENABLED: 'true',
  METERED_COMPUTE_ENABLED: 'true',
  SAND_LEDGER_ENABLED: 'true',
};

/** Every flag on INCLUDING charging — only reachable by deliberate configuration. */
const FLAGS_CHARGING_ON: Record<string, string> = {
  ...FLAGS_CHARGING_OFF,
  SAND_CHARGING_ENABLED: 'true',
};

const GUEST: OperationOwner = { kind: 'anonymous', key: 'session-abc', sessionKey: 'session-abc' };

interface Harness {
  prisma: FakePrisma;
  quotes: ComputeQuoteService;
  operations: ComputeOperationService;
  ledger: SandLedgerService;
  storedResults: StoredResultService;
  flags: BetaFeatureFlagsService;
}

async function buildHarness(env: Record<string, string> = FLAGS_CHARGING_OFF): Promise<Harness> {
  resetFakePrismaIds();
  const prisma = new FakePrisma();

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      BetaFeatureFlagsService,
      SandPricingService,
      EntitlementService,
      StoredResultService,
      SandLedgerService,
      ComputeOperationService,
      ComputeQuoteService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
    ],
  }).compile();

  return {
    prisma,
    quotes: moduleRef.get(ComputeQuoteService),
    operations: moduleRef.get(ComputeOperationService),
    ledger: moduleRef.get(SandLedgerService),
    storedResults: moduleRef.get(StoredResultService),
    flags: moduleRef.get(BetaFeatureFlagsService),
  };
}

function identity(overrides: Partial<StoredResultIdentity> = {}): StoredResultIdentity {
  return {
    kind: 'ask-turn',
    normalizedTask: 'what is happening in rwanda',
    language: 'en',
    evidenceRevision: 'rev-1',
    ...overrides,
  };
}

/** An ordinary single-country Ask. */
function ordinaryAskRequest(overrides: Record<string, unknown> = {}) {
  return {
    owner: GUEST,
    kind: 'ask-turn' as const,
    identity: identity(),
    signals: { contextualOnly: false, countryCount: 1, domainCount: 1 },
    clientIdempotencyKey: 'submission-1',
    ...overrides,
  };
}

/** A request the backend must classify as Deep Analysis on its own. */
function deepAskRequest(overrides: Record<string, unknown> = {}) {
  return {
    owner: GUEST,
    kind: 'ask-turn' as const,
    identity: identity({ normalizedTask: 'compare energy security across east africa' }),
    signals: { contextualOnly: false, countryCount: 6, domainCount: 2 },
    clientIdempotencyKey: 'submission-deep',
    ...overrides,
  };
}

describe('§30 Sand — quote generation', () => {
  it('generates a quote for an ordinary Ask, at zero Sand', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(ordinaryAskRequest());

    expect(quote.operationId).toBeTruthy();
    expect(quote.computeClass).toBe('FRESH_BOUNDED');
    expect(quote.quotedSand).toBe(0);
    expect(quote.requiresConfirmation).toBe(false);
    expect(quote.entitlementState).toBe('included');
  });

  it('generates a priced, confirmable quote for Deep Analysis', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    expect(quote.computeClass).toBe('DEEP_ANALYSIS');
    expect(quote.quotedSand).toBe(24);
    expect(quote.requiresConfirmation).toBe(true);
    expect(quote.entitlementState).toBe('metered');
    expect(quote.label).toBe('Deep Analysis');
  });

  it('reports charging state truthfully so the UI never implies a debit that will not happen', async () => {
    const off = await buildHarness(FLAGS_CHARGING_OFF);
    expect((await off.quotes.quote(deepAskRequest())).quote.chargingEnabled).toBe(false);

    const on = await buildHarness(FLAGS_CHARGING_ON);
    expect((await on.quotes.quote(deepAskRequest())).quote.chargingEnabled).toBe(true);
  });

  it('gives the quote a bounded expiry, because a quote pins a classification', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('writes a QUOTE ledger row even though nothing has moved', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());
    const entries = await h.ledger.entriesForOperation(quote.operationId);

    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe('QUOTE');
    expect(entries[0].finalSand).toBe(0);
  });
});

describe('§30 Sand — the compute class is backend-owned (§5/§20)', () => {
  it('classifies Deep Analysis from an ordinary ask-turn the client never labelled', async () => {
    const h = await buildHarness();
    const request = deepAskRequest();

    // The caller said `kind: 'ask-turn'`. It has no way to say
    // 'FRESH_BOUNDED' — there is no such field on the request.
    expect(request.kind).toBe('ask-turn');
    expect((await h.quotes.quote(request)).quote.computeClass).toBe('DEEP_ANALYSIS');
  });

  it('cannot be downgraded by resubmitting with cheaper-looking signals', async () => {
    const h = await buildHarness();

    const first = await h.quotes.quote(deepAskRequest());
    expect(first.quote.quotedSand).toBe(24);

    // Same caller, same idempotency key, now claiming a trivial request.
    const second = await h.quotes.quote(
      deepAskRequest({ signals: { contextualOnly: true, countryCount: 1, domainCount: 1 } }),
    );

    expect(second.reused).toBe(true);
    expect(second.quote.operationId).toBe(first.quote.operationId);
    expect(second.quote.computeClass).toBe('DEEP_ANALYSIS');
    expect(second.quote.quotedSand).toBe(24);
  });
});

describe('§30 AI-cost protection — a category click does not auto-run AI (§16)', () => {
  it('quotes a category view at CONTEXTUAL and zero, however broad the request', async () => {
    const h = await buildHarness();

    const { quote } = await h.quotes.quote({
      owner: GUEST,
      kind: 'category-view',
      identity: identity({ kind: 'category-view', normalizedTask: 'energy' }),
      signals: { contextualOnly: false, countryCount: 40, domainCount: 5 },
      clientIdempotencyKey: 'category-energy',
    });

    expect(quote.computeClass).toBe('CONTEXTUAL');
    expect(quote.quotedSand).toBe(0);
    expect(quote.requiresConfirmation).toBe(false);
    expect(quote.entitlementState).toBe('included');
  });
});

describe('§30 AI-cost protection — stored-result reuse (§6)', () => {
  it('reopening a stored result classifies STORED and costs zero new Sand', async () => {
    const h = await buildHarness();
    const askIdentity = identity();

    // A previous, expensive execution left a stored result behind.
    const storedId = await h.storedResults.store({
      identity: askIdentity,
      computeClass: 'DEEP_ANALYSIS',
      payload: { answer: 'previously computed' },
    });
    expect(storedId).toBeTruthy();

    const { quote } = await h.quotes.quote({
      owner: GUEST,
      kind: 'ask-turn',
      identity: askIdentity,
      // Signals that would otherwise classify DEEP_ANALYSIS.
      signals: { contextualOnly: false, countryCount: 8, domainCount: 4 },
      clientIdempotencyKey: 'reopen-1',
    });

    expect(quote.computeClass).toBe('STORED');
    expect(quote.quotedSand).toBe(0);
    expect(quote.requiresConfirmation).toBe(false);
    expect(quote.storedResultAvailable).toBe(true);
    expect(quote.resultId).toBe(storedId);
    expect(quote.entitlementState).toBe('included');
  });

  it('does not reuse across a changed evidence revision', async () => {
    const h = await buildHarness();
    await h.storedResults.store({
      identity: identity({ evidenceRevision: 'rev-1' }),
      computeClass: 'FRESH_BOUNDED',
      payload: { answer: 'old' },
    });

    const { quote } = await h.quotes.quote(
      ordinaryAskRequest({
        identity: identity({ evidenceRevision: 'rev-2' }),
        clientIdempotencyKey: 'after-revision',
      }),
    );

    expect(quote.storedResultAvailable).toBe(false);
    expect(quote.computeClass).toBe('FRESH_BOUNDED');
  });

  it('does not reuse an expired stored result', async () => {
    const h = await buildHarness();
    await h.storedResults.store({
      identity: identity(),
      computeClass: 'FRESH_BOUNDED',
      payload: { answer: 'stale' },
      ttlSeconds: -1,
    });

    expect(await h.storedResults.find(identity())).toBeNull();
  });

  it('treats an omitted TTL as revision-governed rather than never-expiring-by-accident', async () => {
    const h = await buildHarness();
    await h.storedResults.store({
      identity: identity(),
      computeClass: 'FRESH_BOUNDED',
      payload: { answer: 'current' },
    });

    // Reusable now...
    expect(await h.storedResults.find(identity())).not.toBeNull();
    // ...but not once the evidence corpus has moved on.
    expect(await h.storedResults.find(identity({ evidenceRevision: 'rev-2' }))).toBeNull();
  });

  it('counts reuse, so §31 can report a real cache-hit rate', async () => {
    const h = await buildHarness();
    const id = await h.storedResults.store({
      identity: identity(),
      computeClass: 'FRESH_BOUNDED',
      payload: { answer: 'x' },
    });

    await h.storedResults.recordReuse(id!);
    await h.storedResults.recordReuse(id!);

    const found = await h.storedResults.find(identity());
    expect(found?.reuseCount).toBe(2);
  });

  it('two different callers share one stored result but never one operation row', async () => {
    const h = await buildHarness();
    await h.storedResults.store({
      identity: identity(),
      computeClass: 'FRESH_BOUNDED',
      payload: { answer: 'shared' },
    });

    const userA = await h.quotes.quote(
      ordinaryAskRequest({
        owner: { kind: 'anonymous', key: 'session-a', sessionKey: 'session-a' },
      }),
    );
    const userB = await h.quotes.quote(
      ordinaryAskRequest({
        owner: { kind: 'anonymous', key: 'session-b', sessionKey: 'session-b' },
      }),
    );

    expect(userA.quote.resultId).toBe(userB.quote.resultId);
    expect(userA.quote.operationId).not.toBe(userB.quote.operationId);
    expect(userA.reused).toBe(false);
    expect(userB.reused).toBe(false);
  });

  it('survives a stored-result store failure without failing the request', async () => {
    const h = await buildHarness();
    jest.spyOn(h.prisma.storedResult, 'upsert').mockImplementation(() => {
      throw new Error('database unreachable');
    });

    await expect(
      h.storedResults.store({
        identity: identity(),
        computeClass: 'FRESH_BOUNDED',
        payload: { answer: 'x' },
      }),
    ).resolves.toBeNull();
  });

  it('survives a stored-result lookup failure by computing instead of erroring', async () => {
    const h = await buildHarness();
    jest.spyOn(h.prisma.storedResult, 'findUnique').mockImplementation(() => {
      throw new Error('database unreachable');
    });

    const { quote } = await h.quotes.quote(ordinaryAskRequest());
    expect(quote.storedResultAvailable).toBe(false);
    expect(quote.computeClass).toBe('FRESH_BOUNDED');
  });
});

describe('§12/§30 idempotency — a duplicate request does not duplicate the operation', () => {
  it('returns the same operation for a repeated submission', async () => {
    const h = await buildHarness();

    const first = await h.quotes.quote(deepAskRequest());
    const second = await h.quotes.quote(deepAskRequest());

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.quote.operationId).toBe(first.quote.operationId);
    expect(h.prisma.computeOperation.rows).toHaveLength(1);
  });

  it('survives a double click — five rapid identical submissions create one row', async () => {
    const h = await buildHarness();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => h.quotes.quote(deepAskRequest())),
    );

    const ids = new Set(results.map((r) => r.quote.operationId));
    expect(ids.size).toBe(1);
    expect(h.prisma.computeOperation.rows).toHaveLength(1);
  });

  it('never reserves twice for one operation, so a retry cannot double-charge', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    // A retried worker re-asserting RESERVED is a no-op, not a second reservation.
    await h.operations.reserve(quote.operationId, GUEST);

    const reserves = (await h.ledger.entriesForOperation(quote.operationId)).filter(
      (e) => e.entryType === 'RESERVE',
    );
    expect(reserves).toHaveLength(1);
  });

  it('never settles twice, so a retried completion cannot double-charge', async () => {
    const h = await buildHarness(FLAGS_CHARGING_ON);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.complete(quote.operationId, GUEST);
    // A retried worker re-reports the terminal state it already wrote.
    await h.operations.complete(quote.operationId, GUEST);

    const settles = (await h.ledger.entriesForOperation(quote.operationId)).filter(
      (e) => e.entryType === 'SETTLE',
    );
    expect(settles).toHaveLength(1);
    expect(await h.ledger.netConsumedForOperation(quote.operationId)).toBe(24);
  });

  it('never releases twice, so the ledger cannot report returning more than it held', async () => {
    const h = await buildHarness(FLAGS_CHARGING_ON);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.failAndRelease(quote.operationId, GUEST, 'provider-timeout');
    await h.operations.failAndRelease(quote.operationId, GUEST, 'provider-timeout');

    const releases = (await h.ledger.entriesForOperation(quote.operationId)).filter(
      (e) => e.entryType === 'RELEASE',
    );
    expect(releases).toHaveLength(1);
    // Never negative — the ledger returned exactly what it held.
    expect(await h.ledger.outstandingReservationForOperation(quote.operationId)).toBe(0);
  });

  it('separates two genuinely different submissions from the same caller', async () => {
    const h = await buildHarness();

    const a = await h.quotes.quote(deepAskRequest({ clientIdempotencyKey: 'sub-a' }));
    const b = await h.quotes.quote(deepAskRequest({ clientIdempotencyKey: 'sub-b' }));

    expect(a.quote.operationId).not.toBe(b.quote.operationId);
    expect(h.prisma.computeOperation.rows).toHaveLength(2);
  });
});

describe('§30 Sand — explicit confirmation is required', () => {
  it('marks Deep Analysis as requiring confirmation and leaves it QUOTED', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    expect(quote.requiresConfirmation).toBe(true);

    const operation = await h.operations.findById(quote.operationId);
    expect(operation?.executionStatus).toBe('QUOTED');
  });

  it('never asks for confirmation for an ordinary Ask or a stored replay', async () => {
    const h = await buildHarness();
    expect((await h.quotes.quote(ordinaryAskRequest())).quote.requiresConfirmation).toBe(false);

    await h.storedResults.store({
      identity: identity({ normalizedTask: 'stored q' }),
      computeClass: 'DEEP_ANALYSIS',
      payload: {},
    });
    const replay = await h.quotes.quote(
      deepAskRequest({
        identity: identity({ normalizedTask: 'stored q' }),
        clientIdempotencyKey: 'replay-key',
      }),
    );
    expect(replay.quote.requiresConfirmation).toBe(false);
  });

  it('expires a quote, so a stale price cannot be confirmed indefinitely', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());
    const operation = (await h.operations.findById(quote.operationId))!;

    expect(h.operations.isQuoteExpired(operation, new Date())).toBe(false);
    expect(h.operations.isQuoteExpired(operation, new Date(Date.now() + 10 * 60 * 1000))).toBe(
      true,
    );
  });
});

describe('§30 Sand — charging OFF prevents mutation', () => {
  it('settles a completed Deep Analysis at zero Sand while charging is off', async () => {
    const h = await buildHarness(FLAGS_CHARGING_OFF);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.complete(quote.operationId, GUEST);

    expect(await h.ledger.netConsumedForOperation(quote.operationId)).toBe(0);

    const settle = (await h.ledger.entriesForOperation(quote.operationId)).find(
      (e) => e.entryType === 'SETTLE',
    );
    // The zero is written and visible in the ledger — not a silent skip.
    expect(settle).toBeDefined();
    expect(settle!.finalSand).toBe(0);
    expect(settle!.quotedSand).toBe(24);
  });

  it('consumes the quoted Sand only when charging is deliberately enabled', async () => {
    const h = await buildHarness(FLAGS_CHARGING_ON);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.complete(quote.operationId, GUEST);

    expect(await h.ledger.netConsumedForOperation(quote.operationId)).toBe(24);
  });

  it('writes no ledger rows at all when SAND_LEDGER is off', async () => {
    const h = await buildHarness({
      COMPUTE_CLASSIFICATION_ENABLED: 'true',
      METERED_COMPUTE_ENABLED: 'true',
    });
    const { quote } = await h.quotes.quote(deepAskRequest());

    expect(h.flags.get().sandLedger).toBe(false);
    expect(await h.ledger.entriesForOperation(quote.operationId)).toHaveLength(0);
  });
});

describe('§13/§30 — a failed operation releases its reservation', () => {
  it('moves FAILED then RESERVATION_RELEASED and nets the reservation to zero', async () => {
    const h = await buildHarness(FLAGS_CHARGING_ON);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);

    const outstandingBefore = await h.ledger.outstandingReservationForOperation(quote.operationId);
    expect(outstandingBefore).toBe(24);

    const released = await h.operations.failAndRelease(
      quote.operationId,
      GUEST,
      'provider-timeout',
    );

    expect(released.executionStatus).toBe('RESERVATION_RELEASED');
    expect(await h.ledger.outstandingReservationForOperation(quote.operationId)).toBe(0);
  });

  it('consumes nothing on failure, even with charging deliberately ON', async () => {
    const h = await buildHarness(FLAGS_CHARGING_ON);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.failAndRelease(quote.operationId, GUEST, 'provider-unavailable');

    expect(await h.ledger.netConsumedForOperation(quote.operationId)).toBe(0);
  });

  it('records a RELEASE row, so the release is provable from the ledger', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.failAndRelease(quote.operationId, GUEST, 'malformed-output');

    const types = (await h.ledger.entriesForOperation(quote.operationId)).map((e) => e.entryType);
    expect(types).toEqual(['QUOTE', 'RESERVE', 'RELEASE']);
  });
});

describe('§13 — the operation state machine is enforced, not merely documented', () => {
  it('refuses an illegal transition', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    // QUOTED -> COMPLETED skips reservation and execution entirely.
    await expect(h.operations.transition(quote.operationId, 'COMPLETED')).rejects.toThrow(
      /Illegal compute operation transition QUOTED -> COMPLETED/,
    );
  });

  it('refuses to reopen a completed operation, closing a second settlement route', async () => {
    const h = await buildHarness(FLAGS_CHARGING_ON);
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.complete(quote.operationId, GUEST);

    await expect(h.operations.markRunning(quote.operationId)).rejects.toThrow(
      /Illegal compute operation transition COMPLETED -> RUNNING/,
    );
    expect(await h.ledger.netConsumedForOperation(quote.operationId)).toBe(24);
  });

  it('treats a repeated terminal assertion as a no-op rather than an error', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    await h.operations.failAndRelease(quote.operationId, GUEST, 'provider-timeout');

    const again = await h.operations.transition(quote.operationId, 'RESERVATION_RELEASED');
    expect(again.executionStatus).toBe('RESERVATION_RELEASED');
  });

  it('stamps completedAt on reaching a terminal state', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.reserve(quote.operationId, GUEST);
    await h.operations.markRunning(quote.operationId);
    const completed = await h.operations.complete(quote.operationId, GUEST);

    expect(completed.completedAt).toBeInstanceOf(Date);
  });
});

describe('§14 — cost telemetry is recorded and stays private', () => {
  it('records provider, token and duration signals on the operation', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(deepAskRequest());

    await h.operations.recordTelemetry(quote.operationId, {
      durationMs: 1234,
      storedResultReused: false,
      cacheHit: false,
      provider: 'openai',
      model: 'test-model',
      inputTokens: 900,
      outputTokens: 400,
      retrievalCalls: 3,
      evidenceCount: 12,
      estimatedCostMicroUsd: 8200,
    });

    const row = h.prisma.computeOperation.rows[0];
    expect(row.durationMs).toBe(1234);
    expect(row.provider).toBe('openai');
    expect(row.inputTokens).toBe(900);
    expect(row.estimatedCostMicroUsd).toBe(8200);
  });

  it('leaves unreported signals null rather than inventing zeros', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(ordinaryAskRequest());

    await h.operations.recordTelemetry(quote.operationId, {
      durationMs: 10,
      storedResultReused: true,
    });

    const row = h.prisma.computeOperation.rows[0];
    // A stored replay makes no provider call; recording 0 tokens would
    // corrupt the very cost baseline §14 exists to establish.
    expect(row.inputTokens).toBeNull();
    expect(row.outputTokens).toBeNull();
    expect(row.provider).toBeNull();
    expect(row.storedResultReused).toBe(true);
  });

  it('never fails the request when telemetry cannot be written', async () => {
    const h = await buildHarness();
    const { quote } = await h.quotes.quote(ordinaryAskRequest());
    jest.spyOn(h.prisma.computeOperation, 'update').mockImplementation(() => {
      throw new Error('database unreachable');
    });

    await expect(
      h.operations.recordTelemetry(quote.operationId, { durationMs: 1, storedResultReused: false }),
    ).resolves.toBeUndefined();
  });
});
