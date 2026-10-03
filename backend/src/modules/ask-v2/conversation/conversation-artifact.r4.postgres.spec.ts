import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { SessionService } from '../../auth/session.service';
import { AskV2Module } from '../ask-v2.module';
import { AskV2Service } from '../ask-v2.service';
import { accountPrincipal } from '../guest/ask-principal';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from '../ask-compute.contract';

/**
 * CTO R4 — ConversationArtifact memory through the REAL Ask V2 service on real PostgreSQL. The
 * artifact an answer produced is stored in that answer's durable StoredResult; a later turn in the
 * SAME owner-verified thread receives it (quote and execute identically), it is never regenerated,
 * a malformed one is never trusted, and it never crosses into another thread.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('Conversation artifact live tests require a dedicated loopback test database');
}
jest.setTimeout(120000);
const live = url ? describe : describe.skip;

const FRAMEWORK = {
  kind: 'CONCEPTUAL_FRAMEWORK',
  label: 'Prime moment',
  components: ['peak capability', 'peak recognition', 'overextension', 'complacency'],
  provenance: 'MODEL_REASONING',
  citable: false,
};

live('R4 ConversationArtifact memory — live PostgreSQL through AskV2Service', () => {
  let db: PrismaClient;
  let service: AskV2Service;
  let userId = '';
  const prepared: Readonly<AskRequest>[] = [];
  const executed: Readonly<AskRequest>[] = [];
  /** what the next execution's payload carries as its artifact (undefined = none) */
  let nextArtifact: unknown = undefined;
  let executions = 0;
  const plan = (): AskPlan => ({
    revision: 'rev-1',
    scope: 'scope:any',
    contract: 'qual-v1',
    executionKey: 'planned-ask',
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 0,
    domainCount: 0,
    timeWindowDays: 0,
  });

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
    const values: Record<string, string> = {
      ASK_V2_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
      SAND_CHARGING_ENABLED: 'false',
    };
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AskV2Module],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(ConfigService)
      .useValue({ get: (k: string) => values[k] } as ConfigService)
      .overrideProvider(SessionService)
      .useValue({ validateSession: async () => null })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({
        prepare: async (r: Readonly<AskRequest>) => (prepared.push(r), plan()),
        execute: async (r: Readonly<AskRequest>): Promise<ExecutionResult> => {
          executed.push(r);
          executions++;
          const artifact = nextArtifact;
          nextArtifact = undefined;
          return {
            succeeded: true,
            payloadJson: JSON.stringify({
              schema: 'ask-r2-result/1',
              answer: { state: 'REFERENCE_BACKGROUND' },
              background: { text: `reasoned answer to: ${r.question}` },
              ...(artifact === undefined ? {} : { artifact }),
              checkedAt: new Date().toISOString(),
            }),
            evidenceRevision: 'rev-1',
            validUntil: plan().validUntil,
          };
        },
      })
      .compile();
    service = module.get(AskV2Service);
    userId = (await db.user.create({ data: { email: `${randomUUID()}@r4-artifact.test` } })).id;
  });
  afterAll(async () => {
    await db?.user.deleteMany({ where: { id: userId } });
    await db?.$disconnect();
  });

  async function ask(threadId: string, question: string) {
    const p = accountPrincipal(userId);
    const q = await service.quote(p, threadId, {
      idempotencyKey: randomUUID(),
      question,
      language: 'en',
      intent: 'ask',
    });
    const quoted = prepared[prepared.length - 1];
    if (q.status !== 'COMPLETED') {
      await service.accept(p, q.operationId);
      await service.reserve(p, q.operationId);
      await service.execute(p, q.operationId);
    }
    return { operationId: q.operationId, quoted, executed: executed[executed.length - 1] };
  }
  const thread = async () =>
    (
      await service.createThread(accountPrincipal(userId), {
        idempotencyKey: randomUUID(),
        language: 'en',
      })
    ).id;

  it('the Prime Moment journey: turn 1 stores the framework; turns 2–4 receive it (quote = execute), never regenerated', async () => {
    const t = await thread();
    nextArtifact = FRAMEWORK;
    const t1 = await ask(
      t,
      'Define deeply what is "Prime moment" of something or someone. I need deeper analysis.',
    );
    expect(t1.quoted.priorArtifact).toBeUndefined();
    const op = await db.computeOperation.findUnique({
      where: { id: t1.operationId },
      select: { storedResult: { select: { payload: true } } },
    });
    expect((op?.storedResult?.payload as { artifact?: unknown }).artifact).toEqual(FRAMEWORK);

    const before = executions;
    const t2 = await ask(
      t,
      'Apply that idea to GlobalNewsAI. Are we approaching our prime moment?',
    );
    const expected = { ...FRAMEWORK, sourceOperationId: t1.operationId };
    expect(t2.quoted.priorArtifact).toEqual(expected);
    expect(t2.executed.priorArtifact).toEqual(expected);
    /* one execution for turn 2 — the earlier artifact was read, never regenerated */
    expect(executions).toBe(before + 1);

    const t3 = await ask(t, 'Which part is weakest?');
    expect(t3.executed.priorArtifact).toEqual(expected);

    /* a later artifact supersedes the earlier one (the most recent work wins) */
    nextArtifact = { ...FRAMEWORK, kind: 'DIAGNOSIS', label: 'Weakest component' };
    const t4 = await ask(t, 'What should we do about it?');
    const t5 = await ask(t, 'Turn that into a 90-day plan.');
    expect(t5.quoted.priorArtifact).toMatchObject({
      kind: 'DIAGNOSIS',
      sourceOperationId: t4.operationId,
    });
    expect(t5.executed.priorArtifact).toEqual(t5.quoted.priorArtifact);
  });

  it('CTO R4 closeout §8 — CONCEPTUAL_FRAMEWORK → DIAGNOSIS → RECOMMENDATION → PLAN chain in one thread, each turn receiving the previous turn’s artifact with its source turn', async () => {
    const t = await thread();
    const kinds = ['CONCEPTUAL_FRAMEWORK', 'DIAGNOSIS', 'RECOMMENDATION', 'PLAN'] as const;
    /* own wording: a question already answered for this owner would be served from its stored
       result (correct reuse) and carry that result's artifact */
    const questions = [
      'Explain in depth what a peak moment of an organisation is.',
      'Which dimension of that is most fragile for a 12-person startup?',
      'So what would you recommend we do about that?',
      'Make that into a 90-day plan.',
    ];
    const ops: string[] = [];
    for (const [i, q] of questions.entries()) {
      nextArtifact = { ...FRAMEWORK, kind: kinds[i], label: `${kinds[i]} label` };
      const turn = await ask(t, q);
      if (i === 0) expect(turn.quoted.priorArtifact).toBeUndefined();
      else {
        const expected = {
          ...FRAMEWORK,
          kind: kinds[i - 1],
          label: `${kinds[i - 1]} label`,
          sourceOperationId: ops[i - 1],
        };
        expect(turn.quoted.priorArtifact).toEqual(expected);
        expect(turn.executed.priorArtifact).toEqual(expected);
      }
      ops.push(turn.operationId);
    }
    /* every stored artifact keeps its kind, bounded content, MODEL_REASONING and citable=false */
    for (const [i, id] of ops.entries()) {
      const op = await db.computeOperation.findUnique({
        where: { id },
        select: { storedResult: { select: { payload: true } } },
      });
      const stored = (op?.storedResult?.payload as { artifact?: Record<string, unknown> }).artifact;
      expect(stored).toMatchObject({
        kind: kinds[i],
        provenance: 'MODEL_REASONING',
        citable: false,
      });
      expect((stored!.components as unknown[]).length).toBeLessThanOrEqual(8);
    }
  });

  it('CTO R4 fifth pass — the objective the reader stated two turns earlier travels with the request (source turn kept; quote = execute; newer overrides)', async () => {
    const t = await thread();
    await ask(t, 'I am choosing between studying law and studying medicine.');
    await ask(t, 'What matters most to me is income stability and working abroad.');
    await ask(t, 'Hmm, good points.');
    const decision = await ask(t, 'So which one fits me better?');
    expect(decision.quoted.conversation?.objective).toEqual({
      text: 'income stability and working abroad',
      sourceTurn: 1,
    });
    expect(decision.executed.conversation?.objective).toEqual(
      decision.quoted.conversation?.objective,
    );
    await ask(t, 'Actually, my priority is a short training path.');
    const again = await ask(t, 'Which one fits me better now?');
    expect(again.quoted.conversation?.objective?.text).toBe('a short training path');
    expect(again.quoted.conversation?.objective?.sourceTurn).toBe(4);
  });

  it('a malformed or evidence-claiming artifact in a stored payload is never trusted', async () => {
    const t = await thread();
    nextArtifact = {
      kind: 'NEWS_FACT',
      label: 'x',
      components: [],
      provenance: 'MODEL_REASONING',
      citable: false,
    };
    await ask(t, 'Explain deeply what critical mass is.');
    const t2 = await ask(t, 'Which part is weakest?');
    expect(t2.quoted.priorArtifact).toBeUndefined();
    expect(t2.executed.priorArtifact).toBeUndefined();
  });

  it('an artifact never crosses into another thread', async () => {
    const a = await thread();
    nextArtifact = FRAMEWORK;
    await ask(a, 'Explain in depth what institutional trust is.');
    const b = await thread();
    const other = await ask(b, 'Which part is weakest?');
    expect(other.quoted.priorArtifact).toBeUndefined();
    expect(other.executed.priorArtifact).toBeUndefined();
  });
});
