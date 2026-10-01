import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import { AskV2Service } from '../ask-v2.service';
import { AskR2ExecutionAdapter } from '../ask-r2-execution.adapter';
import { GuestSessionService } from '../guest/guest-session.service';
import { accountPrincipal, guestPrincipal } from '../guest/ask-principal';
import { askRequestContext, type AskRequestContext } from '../ask-request-context';
import { fingerprint, hashIdentity, type PersistedAskPlan } from '../ask-compute.contract';
import { AskContextRefused, AskContextResolver } from './ask-context.resolver';

/**
 * UNIFIED INTELLIGENCE BINDING R2B — the context envelope through the REAL lifecycle on
 * PostgreSQL: real AskV2Service, real resolver over the real Article table (via
 * ArticlePersistenceService.findRetainedByUrl — the same read NewsService delegates to), real
 * adapter, meter, breaker and switches. Only the model providers are faked (no OpenAI, no GNews).
 */

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask R2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const RUN = randomUUID().slice(0, 8);
const URL_A = `https://r2b-${RUN}.example/2026/10/01/polish-budget`;
const URL_B = `https://r2b-${RUN}.example/2026/10/01/kenyan-rates`;
const URL_NC = `https://r2b-${RUN}.example/2026/10/01/unplaced`;
const ID_A = `r2b-${RUN}-a`;
const ID_B = `r2b-${RUN}-b`;
const ID_NC = `r2b-${RUN}-nc`;
const REF = (u: string) => computeArticleRef(u);
const STORY = (u: string) => ({ kind: 'STORY' as const, articleRef: REF(u), url: u });
const GEO = (c: string) => ({ kind: 'GEOGRAPHY' as const, countryCode: c });
const Q = 'What does this mean?';

live('R2B — canonical Ask V2 context envelope on PostgreSQL', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let service: AskV2Service;
  let switches: OperationalSwitchService;
  const analyzeNews = jest.fn();
  const answerBackground = jest.fn();
  const findRetainedArticleByUrl = jest.fn();
  const findArticleById = jest.fn();
  /* R2F — the module read seam: known keys resolve to a governed Rwanda record. */
  const resolvePinned = jest.fn(async (module: string, key: string) =>
    key.startsWith('cfl:known')
      ? { module: module as 'CONFLICT', observationKey: key, countryIso3: 'RWA', district: null }
      : null,
  );
  const readPinned = jest.fn(async (record: { observationKey: string }) => ({
    contributorId: 'CONFLICT',
    domain: 'security',
    applicability: 'SUPPLEMENTARY',
    scope: { countryIso3: 'RWA', district: null, place: null },
    status: 'USED',
    temporalBasis: 'RETAINED_EVENT_RECORD',
    observations: [{ key: record.observationKey }],
    disclosures: ['PINNED_BY_READER'],
  }));
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  let userId: string;
  let threadId: string;
  const who = (): AskRequestContext => ({ accountId: userId, ipScope: 'ip:v4:198.51.100.40' });
  const createdGuests: string[] = [];

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
    const base = {
      summary: 'Retained summary — never part of the context.',
      sourceId: 'src-r2b',
      sourceName: 'Example Wire',
      category: 'world',
      publishedAt: new Date('2026-10-01T06:00:00Z'),
    };
    await db.article.createMany({
      data: [
        {
          ...base,
          id: ID_A,
          url: URL_A,
          title: 'Polish parliament passes the budget',
          countryCode: 'PL',
        },
        {
          ...base,
          id: ID_B,
          url: URL_B,
          title: 'Kenya central bank holds rates',
          countryCode: 'KE',
        },
        { ...base, id: ID_NC, url: URL_NC, title: 'A report with no country', countryCode: null },
      ],
    });
  });
  afterAll(async () => {
    await db.article.deleteMany({ where: { id: { in: [ID_A, ID_B, ID_NC] } } });
    await db.guestSession.deleteMany({ where: { id: { in: createdGuests } } });
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
    );
    values = {
      ASK_V2_ENABLED: 'true',
      ASK_R2_ENABLED: 'true',
      ASK_PUBLIC_COMPUTE_ENABLED: 'true',
      ASK_GUEST_TRIAL_ENABLED: 'true',
      ASK_FLAG_CACHE_MS: '0',
      ASK_BREAKER_CACHE_MS: '0',
      ASK_UNITS_PER_REQUEST_MAX: '16000',
      ASK_GLOBAL_UNITS_PER_HOUR: '1000000',
      ASK_GLOBAL_UNITS_PER_DAY: '5000000',
      ASK_PROVIDER_UNITS_PER_HOUR: '1000000',
      ASK_IP_UNITS_PER_DAY: '360000',
      ASK_CONCURRENT_GLOBAL: '8',
      ASK_GUEST_ATTEMPTS_PER_SESSION: '8',
      ASK_GUEST_UNITS_PER_SESSION: '48000',
      ASK_GUEST_POOL_UNITS_PER_HOUR: '100000',
      ASK_GUEST_POOL_UNITS_PER_DAY: '500000',
      ASK_GUEST_SESSIONS_PER_IP_DAY: '1000',
      ASK_GUEST_EXECUTIONS_PER_IP_DAY: '1000',
      ASK_GUEST_EXECUTIONS_PER_DAY: '1000',
      ASK_GUEST_CONCURRENT_PER_SESSION: '1',
      ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: '3',
      ASK_GUEST_COOLDOWN_S: '600',
    };
    analyzeNews.mockReset();
    analyzeNews.mockImplementation(async (...args: unknown[]) => {
      (
        args[6] as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void }
      ).usageSink?.({ promptTokens: 2000, completionTokens: 400 });
      return { analysis: {}, articles: [{ id: 'x' }, { id: 'y' }], retrievalContext: {} };
    });
    readPinned.mockClear();
    resolvePinned.mockClear();
    answerBackground.mockReset();
    answerBackground.mockImplementation(
      async (input: {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      }) => {
        input.usageSink?.({ promptTokens: 300, completionTokens: 100 });
        return { text: 'General background answer.' };
      },
    );
    const persistence = new ArticlePersistenceService(db as unknown as PrismaService);
    findArticleById.mockReset();
    findArticleById.mockImplementation(async (id: string) => persistence.findById(id));
    findRetainedArticleByUrl.mockReset();
    findRetainedArticleByUrl.mockImplementation(
      async (u: string) => (await persistence.findRetainedByUrl(u))?.article ?? null,
    );
    const meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    const guests = new GuestSessionService(db as unknown as PrismaService, config, meter, switches);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      { id: 'mock', displayName: 'Mock Background', isMock: true, answerBackground } as never,
      meter,
      breaker,
      switches,
      {
        get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
      } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: async () => true } as never,
      {
        boundSpecialistDomains: () => ['CONFLICT'],
        read: async () => ({ considered: [], contributions: [] }),
        /* R2F — the pinned dashboard record (stubbed; the real read is covered by the
           conflict live spec and the coordinator matrix). */
        readPinned,
      } as never,
      guests,
    );
    service = new AskV2Service(
      db as unknown as PrismaService,
      config,
      adapter,
      guests,
      switches,
      meter,
      new AskContextResolver({ findRetainedArticleByUrl, findArticleById }, { resolvePinned }),
    );
    for (const name of [
      'ASK_R2_ENABLED',
      'ASK_PUBLIC_COMPUTE_ENABLED',
      'ASK_GUEST_TRIAL_ENABLED',
    ] as const) {
      await switches.set(name, true, 'r2b-live-spec', 'test');
    }
    switches.forget();
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `r2b-${userId}@example.invalid` } });
    threadId = (
      await askRequestContext.run(who(), () =>
        service.createThread(accountPrincipal(userId), {
          idempotencyKey: 'thread',
          language: 'en',
        }),
      )
    ).id;
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });

  const send = (
    question: string,
    context?: unknown,
    key: string = randomUUID(),
    intent: 'ask' | 'deep-analysis' = 'ask',
    thread: string = threadId,
  ) =>
    askRequestContext.run(who(), () =>
      service.submit(accountPrincipal(userId), thread, {
        idempotencyKey: key,
        question,
        language: 'en',
        intent,
        ...(context === undefined ? {} : { context: context as never }),
      }),
    );
  /* A fresh thread: no earlier turn, so no continuity prior enters the identity. */
  const newThread = async () =>
    (
      await askRequestContext.run(who(), () =>
        service.createThread(accountPrincipal(userId), {
          idempotencyKey: randomUUID(),
          language: 'en',
        }),
      )
    ).id;
  const op = (id: string) => db.computeOperation.findUniqueOrThrow({ where: { id } });
  const planOf = async (id: string) => (await op(id)).plan as unknown as PersistedAskPlan;
  async function refusal(work: Promise<unknown>): Promise<string> {
    try {
      await work;
      return 'NOT_REFUSED';
    } catch (e) {
      return e instanceof AskContextRefused
        ? e.code
        : `${(e as Error).name}:${(e as Error).message}`;
    }
  }
  const counts = async () => ({
    operations: await db.computeOperation.count({ where: { userId } }),
    turns: await db.askTurn.count({ where: { threadId } }),
    reservations: await db.computeReservation.count(),
  });

  /* ── A · STORY A vs STORY B ────────────────────────────────────────── */
  it('A · same question, STORY A vs STORY B: different requestHash / revision / fingerprint / persisted context; no cross-reuse', async () => {
    const a = await send(Q, STORY(URL_A));
    const b = await send(Q, STORY(URL_B));
    expect(a.status).toBe('COMPLETED');
    expect(b.status).toBe('COMPLETED');
    const [oa, ob] = [await op(a.operationId), await op(b.operationId)];
    expect(oa.requestHash).not.toBe(ob.requestHash);
    expect(oa.fingerprint).not.toBe(ob.fingerprint);
    const [pa, pb] = [
      oa.plan as unknown as PersistedAskPlan,
      ob.plan as unknown as PersistedAskPlan,
    ];
    expect(pa.revision).not.toBe(pb.revision);
    expect(pa.context).toMatchObject({
      kind: 'STORY',
      articleRef: REF(URL_A),
      articleId: ID_A,
      countryIso3: 'POL',
    });
    expect(pb.context).toMatchObject({
      kind: 'STORY',
      articleRef: REF(URL_B),
      articleId: ID_B,
      countryIso3: 'KEN',
    });
    expect(ob.storedResultReused).toBe(false);
    /* Each run received ITS OWN server-built story. */
    expect(analyzeNews).toHaveBeenCalledTimes(2);
    expect(analyzeNews.mock.calls[0][2]).toEqual({
      title: 'Polish parliament passes the budget',
      articleId: ID_A,
      url: URL_A,
      sourceName: 'Example Wire',
      countryCode: 'POL',
    });
    expect(analyzeNews.mock.calls[1][2]).toMatchObject({ articleId: ID_B, countryCode: 'KEN' });
    /* The persisted context carries no retained summary / evidence text. */
    expect(JSON.stringify(pa.context)).not.toContain('Retained summary');
  });

  /* ── R2C · STORY by persisted id is the SAME identity as STORY by {articleRef, url} ── */
  it('R2C · the same story named by id or by {articleRef, url} is ONE identity (same key → same operation)', async () => {
    const key = randomUUID();
    const byRef = await send(Q, STORY(URL_A), key);
    const byId = await send(Q, { kind: 'STORY', articleId: ID_A }, key);
    expect(byId.operationId).toBe(byRef.operationId);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    /* and a different stored story by id is a different identity (conflict on the same key) */
    expect(await refusal(send(Q, { kind: 'STORY', articleId: ID_B }, key))).toMatch(
      /^ConflictException/,
    );
    /* an unknown id fails closed before any operation */
    const before = await counts();
    expect(await refusal(send(Q, { kind: 'STORY', articleId: `r2b-${RUN}-missing` }))).toBe(
      'ASK_CONTEXT_STORY_NOT_FOUND',
    );
    expect(await counts()).toEqual(before);
  });

  /* ── B · GEOGRAPHY POL vs KEN, on the REUSABLE (background) class ─── */
  it('B · same question, POL vs KEN: different identity — a reusable POL answer is NEVER replayed for KEN', async () => {
    const pol = await send(Q, GEO('pl'));
    const ken = await send(Q, GEO('KEN'));
    const [op1, op2] = [await op(pol.operationId), await op(ken.operationId)];
    expect(op1.requestHash).not.toBe(op2.requestHash);
    expect(op1.fingerprint).not.toBe(op2.fingerprint);
    expect((op1.plan as unknown as PersistedAskPlan).revision).not.toBe(
      (op2.plan as unknown as PersistedAskPlan).revision,
    );
    expect((op1.plan as unknown as PersistedAskPlan).context).toEqual({
      kind: 'GEOGRAPHY',
      countryIso3: 'POL',
      geographyContext: { countryCode: 'POL', displayName: 'Poland' },
    });
    expect((op2.plan as unknown as PersistedAskPlan).context).toMatchObject({ countryIso3: 'KEN' });
    /* "What does this mean?" under a Map country stays REFERENCE_BACKGROUND — the reusable class.
       KEN must not reuse POL's stored answer. */
    expect(op2.storedResultReused).toBe(false);
    expect(answerBackground).toHaveBeenCalledTimes(2);
  });

  /* ── C · same key + same context → same operation; different context → conflict ── */
  it('C · same key + same question + same context = the SAME operation (no new work)', async () => {
    const key = randomUUID();
    const first = await send(Q, STORY(URL_A), key);
    const again = await send(Q, STORY(URL_A), key);
    expect(again.operationId).toBe(first.operationId);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('C′ · same key + same question + DIFFERENT context = the existing idempotency conflict (never a replay)', async () => {
    const key = randomUUID();
    await send(Q, GEO('POL'), key);
    expect(await refusal(send(Q, GEO('KEN'), key))).toBe(
      'ConflictException:Idempotency key belongs to a different request',
    );
    expect(await refusal(send(Q, STORY(URL_A), key))).toMatch(/^ConflictException/);
    expect(await refusal(send(Q, undefined, key))).toMatch(/^ConflictException/);
  });

  /* ── D · same context + new key → ordinary reuse rules ──────────────── */
  it('D · same question + same context + NEW key: ordinary stored-reuse rules only', async () => {
    /* Each Send in its OWN thread: in one thread the repeated "What does this mean?" is an
       anaphoric follow-up, and the landed continuity rightly makes it a different request. */
    /* Reference background (reusable): the second Send replays the first, for the SAME country. */
    const first = await send(Q, GEO('POL'), randomUUID(), 'ask', await newThread());
    const second = await send(Q, GEO('POL'), randomUUID(), 'ask', await newThread());
    expect(second.operationId).not.toBe(first.operationId);
    expect((await op(second.operationId)).storedResultReused).toBe(true);
    expect(answerBackground).toHaveBeenCalledTimes(1);
    /* Current reporting (not reusable): the same story asked again is observed afresh. */
    const s1 = await send(Q, STORY(URL_A), randomUUID(), 'ask', await newThread());
    const s2 = await send(Q, STORY(URL_A), randomUUID(), 'ask', await newThread());
    expect((await op(s2.operationId)).storedResultReused).toBe(false);
    expect((await op(s2.operationId)).fingerprint).toBe((await op(s1.operationId)).fingerprint);
    expect(analyzeNews).toHaveBeenCalledTimes(2);
  });

  /* ── E · no context: canonical semantics unchanged ──────────────────── */
  it('E · NO context: requestHash and fingerprint are exactly the canonical formulas; no context in the plan', async () => {
    const res = await send(Q);
    const o = await op(res.operationId);
    expect(o.requestHash).toBe(hashIdentity([threadId, Q, 'en', 'ask']));
    const plan = o.plan as unknown as PersistedAskPlan;
    expect(plan).not.toHaveProperty('context');
    expect(o.fingerprint).toBe(fingerprint({ question: Q, language: 'en', intent: 'ask' }, plan));
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
    expect(analyzeNews.mock.calls.every((c) => c[2] === undefined && c[5] === undefined)).toBe(
      true,
    );
  });

  /* ── durable quote → accept → execute (deep work) ───────────────────── */
  it('durable: a deep STORY quote persists the context; execute restores it from the plan, never re-resolving client input', async () => {
    const quoted = await send(Q, STORY(URL_A), randomUUID(), 'deep-analysis');
    expect(quoted.requiresAcceptance).toBe(true);
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(await db.computeReservation.count()).toBe(0);
    const persisted = await planOf(quoted.operationId);
    expect(persisted.context).toMatchObject({ kind: 'STORY', articleId: ID_A });
    expect(findRetainedArticleByUrl).toHaveBeenCalledTimes(1);

    await askRequestContext.run(who(), () =>
      service.accept(accountPrincipal(userId), quoted.operationId),
    );
    await askRequestContext.run(who(), () =>
      service.reserve(accountPrincipal(userId), quoted.operationId),
    );
    const done = await askRequestContext.run(who(), () =>
      service.execute(accountPrincipal(userId), quoted.operationId),
    );
    expect(done.status).toBe('COMPLETED');
    /* The run received the PERSISTED server context … */
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    expect(analyzeNews.mock.calls[0][2]).toEqual(
      (persisted.context as { storyContext: unknown }).storyContext,
    );
    /* … and nothing was re-read from a client copy. */
    expect(findRetainedArticleByUrl).toHaveBeenCalledTimes(1);
    /* A StoredResult exists under the context-bearing fingerprint. */
    const o = await op(quoted.operationId);
    const stored = await db.storedResult.findUniqueOrThrow({ where: { id: o.storedResultId! } });
    expect(stored.fingerprint).toBe(o.fingerprint);

    /* Retry of execute: terminal, no second run. */
    await askRequestContext.run(who(), () =>
      service.execute(accountPrincipal(userId), quoted.operationId),
    );
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    /* Display-only reopen (Recent/Saved path): 0 provider, 0 AI, 0 resolution. */
    const reopened = await askRequestContext.run(who(), () =>
      service.getOperation(accountPrincipal(userId), quoted.operationId),
    );
    expect(reopened.result?.displayOnly).toBe(true);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    expect(answerBackground).not.toHaveBeenCalled();
    expect(findRetainedArticleByUrl).toHaveBeenCalledTimes(1);
  });

  it('a corrupt persisted context fails closed at execute (ASK_PLAN_INVALID), with zero spend', async () => {
    const quoted = await send(Q, GEO('POL'), randomUUID(), 'deep-analysis');
    const plan = await planOf(quoted.operationId);
    await db.computeOperation.update({
      where: { id: quoted.operationId },
      data: {
        plan: {
          ...plan,
          context: {
            kind: 'GEOGRAPHY',
            countryIso3: 'POL',
            geographyContext: { countryCode: 'POL', displayName: 'Atlantis' },
          },
        } as never,
      },
    });
    await askRequestContext.run(who(), () =>
      service.accept(accountPrincipal(userId), quoted.operationId),
    );
    await askRequestContext.run(who(), () =>
      service.reserve(accountPrincipal(userId), quoted.operationId),
    );
    const res = await askRequestContext.run(who(), () =>
      service.execute(accountPrincipal(userId), quoted.operationId),
    );
    expect(res).toMatchObject({ status: 'RELEASED', failureCode: 'ASK_PLAN_INVALID' });
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(answerBackground).not.toHaveBeenCalled();
    expect(await db.computeReservation.count()).toBe(0);
  });

  /* ── fail closed BEFORE compute ─────────────────────────────────────── */
  it.each([
    [
      'an unretained story',
      STORY(`https://r2b-${RUN}.example/never-retained`),
      'ASK_CONTEXT_STORY_NOT_FOUND',
    ],
    [
      'a ref that is not the URL identity',
      { kind: 'STORY', articleRef: REF(URL_B), url: URL_A },
      'ASK_CONTEXT_STORY_REF_MISMATCH',
    ],
    ['an unknown country', GEO('ZZ'), 'ASK_CONTEXT_GEOGRAPHY_UNKNOWN'],
    ['a country name', GEO('Poland'), 'ASK_CONTEXT_GEOGRAPHY_UNKNOWN'],
  ])(
    'account: %s → %s with no operation, turn, reservation, provider or model',
    async (_n, context, code) => {
      const before = await counts();
      expect(await refusal(send(Q, context))).toBe(code);
      expect(await counts()).toEqual(before);
      expect(analyzeNews).not.toHaveBeenCalled();
      expect(answerBackground).not.toHaveBeenCalled();
    },
  );

  it('guest: an unresolvable context charges NO guest attempt — no preflight, no slot, no meter', async () => {
    const g = await db.guestSession.create({
      data: {
        tokenHash: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      select: { id: true },
    });
    createdGuests.push(g.id);
    const gwho: AskRequestContext = {
      accountId: null,
      guestSessionId: g.id,
      ipScope: 'ip:v4:198.51.100.41',
    };
    const thread = await askRequestContext.run(gwho, () =>
      service.createThread(guestPrincipal(g.id), { idempotencyKey: 'thread', language: 'en' }),
    );
    const guestSend = (context: unknown) =>
      askRequestContext.run(gwho, () =>
        service.submit(guestPrincipal(g.id), thread.id, {
          idempotencyKey: randomUUID(),
          question: Q,
          language: 'en',
          intent: 'ask',
          context: context as never,
        }),
      );
    expect(await refusal(guestSend(STORY(`https://r2b-${RUN}.example/missing`)))).toBe(
      'ASK_CONTEXT_STORY_NOT_FOUND',
    );
    expect(await refusal(guestSend(GEO('ZZZ')))).toBe('ASK_CONTEXT_GEOGRAPHY_UNKNOWN');
    expect(await db.guestSlot.count({ where: { guestSessionId: g.id } })).toBe(0);
    expect(await db.computeOperation.count({ where: { guestSessionId: g.id } })).toBe(0);
    /* guestPreflight never ran: no guest execution counter row exists for this IP scope. */
    expect(await db.computeMeter.count({ where: { scope: { startsWith: 'guestexec' } } })).toBe(0);
    expect(await db.computeReservation.count()).toBe(0);
    /* A resolvable context for the same guest then runs normally and counts once. */
    const ok = await guestSend(STORY(URL_A));
    expect(ok.status).toBe('COMPLETED');
    expect(await db.guestSlot.count({ where: { guestSessionId: g.id, state: 'COMMITTED' } })).toBe(
      1,
    );
  });

  it('a story with no trustworthy country is anchored by identity only (no country invented, no Map country)', async () => {
    const res = await send(Q, STORY(URL_NC));
    const plan = await planOf(res.operationId);
    expect(plan.context).toMatchObject({ kind: 'STORY', articleId: ID_NC });
    expect(plan.context).not.toHaveProperty('countryIso3');
    expect(analyzeNews.mock.calls[0][2]).not.toHaveProperty('countryCode');
    expect(analyzeNews.mock.calls[0][5]).toBeUndefined();
  });

  it('continuity: a later follow-up WITHOUT context does not inherit the earlier turn’s context', async () => {
    await send('What is happening in Poland?', STORY(URL_A));
    const follow = await send('Why did this happen?');
    const plan = await planOf(follow.operationId);
    expect(plan).not.toHaveProperty('context');
    expect(analyzeNews.mock.calls[1][2]).toBeUndefined();
    /* The existing server-derived priorQuestion continuity still applies. */
    expect(analyzeNews.mock.calls[1][3]).toBe('What is happening in Poland?');
  });

  /* ── R2D · My Intelligence SELECTION through the canonical engine ───── */
  const SEL = (action: string, ...urls: string[]) => ({
    kind: 'SELECTION' as const,
    action,
    stories: urls.map((u) => ({ articleRef: REF(u), url: u })),
  });

  it('R2D · Compare(A,B) vs Compare(A,NC): different identity, each run receives ITS selection; no reuse', async () => {
    const one = await send('Compare the selected stories', SEL('COMPARE', URL_A, URL_B));
    const two = await send('Compare the selected stories', SEL('COMPARE', URL_A, URL_NC));
    expect(one.status).toBe('COMPLETED');
    expect(two.status).toBe('COMPLETED');
    const [o1, o2] = [await op(one.operationId), await op(two.operationId)];
    expect(o1.requestHash).not.toBe(o2.requestHash);
    expect(o1.fingerprint).not.toBe(o2.fingerprint);
    expect(o2.storedResultReused).toBe(false);
    expect(analyzeNews).toHaveBeenCalledTimes(2);
    expect(analyzeNews.mock.calls[0][4]).toEqual({
      action: 'COMPARE',
      stories: [
        { articleRef: REF(URL_A), url: URL_A },
        { articleRef: REF(URL_B), url: URL_B },
      ],
    });
    expect(analyzeNews.mock.calls[1][4].stories[1].url).toBe(URL_NC);
    /* never answered as background, never re-classified as a clarification */
    expect(answerBackground).not.toHaveBeenCalled();
    const payload = (await db.storedResult.findUniqueOrThrow({ where: { id: o1.storedResultId! } }))
      .payload as { answer: { state: string }; route: { scopedBy: string } };
    expect(payload.answer.state).toBe('CURRENT_REPORTING');
    expect(payload.route.scopedBy).toBe('SELECTION');
  });

  it('R2D · the same set in another order is the SAME identity (same key → same operation)', async () => {
    const key = randomUUID();
    const first = await send('Summarize the selected stories', SEL('SUMMARIZE', URL_A, URL_B), key);
    const again = await send('Summarize the selected stories', SEL('SUMMARIZE', URL_B, URL_A), key);
    expect(again.operationId).toBe(first.operationId);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('R2D · one unretained story refuses the whole selection before any operation, model or meter', async () => {
    const before = await counts();
    expect(
      await refusal(
        send(
          'Compare the selected stories',
          SEL('COMPARE', URL_A, `https://r2b-${RUN}.example/missing`),
        ),
      ),
    ).toBe('ASK_CONTEXT_STORY_NOT_FOUND');
    expect(await counts()).toEqual(before);
    expect(analyzeNews).not.toHaveBeenCalled();
  });

  it('R2D · reopen is display-only; the next question in the thread does not inherit the selection', async () => {
    const res = await send('Compare the selected stories', SEL('COMPARE', URL_A, URL_B));
    const reopened = await askRequestContext.run(who(), () =>
      service.getOperation(accountPrincipal(userId), res.operationId),
    );
    expect(reopened.result?.displayOnly).toBe(true);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    const follow = await send('Why did this happen?');
    expect(await planOf(follow.operationId)).not.toHaveProperty('context');
    expect(analyzeNews.mock.calls[1][4]).toBeUndefined();
  });

  /* ── R2F · a dashboard record (MODULE) ───────────────────────────────── */
  const MOD = (observationKey: string, module = 'CONFLICT') => ({
    kind: 'MODULE',
    module,
    observationKey,
  });

  it('R2F · two records: different identity, the plan persists the record, execute reads THAT record', async () => {
    const one = await send(
      'What does this mean?',
      MOD('cfl:known-1'),
      randomUUID(),
      'ask',
      await newThread(),
    );
    const two = await send(
      'What does this mean?',
      MOD('cfl:known-2'),
      randomUUID(),
      'ask',
      await newThread(),
    );
    const [o1, o2] = [await op(one.operationId), await op(two.operationId)];
    expect(o1.requestHash).not.toBe(o2.requestHash);
    expect(o1.fingerprint).not.toBe(o2.fingerprint);
    expect((await planOf(one.operationId)).context).toEqual({
      kind: 'MODULE',
      module: 'CONFLICT',
      observationKey: 'cfl:known-1',
      countryIso3: 'RWA',
    });
    expect(
      readPinned.mock.calls.map((c) => (c[0] as { observationKey: string }).observationKey),
    ).toEqual(['cfl:known-1', 'cfl:known-2']);
  });

  it('R2F · an unbound module or an unknown record is refused before any operation, model or meter', async () => {
    const before = await counts();
    expect(await refusal(send('What does this mean?', MOD('k', 'ENERGY')))).toBe(
      'ASK_CONTEXT_MODULE_NOT_BINDABLE',
    );
    expect(await refusal(send('What does this mean?', MOD('cfl:missing')))).toBe(
      'ASK_CONTEXT_MODULE_NOT_FOUND',
    );
    expect(await counts()).toEqual(before);
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(answerBackground).not.toHaveBeenCalled();
    expect(readPinned).not.toHaveBeenCalled();
  });

  it('R2F · a follow-up without context does not inherit the record', async () => {
    await send('What does this mean?', MOD('cfl:known-1'));
    const follow = await send('Why did this happen?');
    expect(await planOf(follow.operationId)).not.toHaveProperty('context');
    expect(readPinned).toHaveBeenCalledTimes(1);
  });
});
