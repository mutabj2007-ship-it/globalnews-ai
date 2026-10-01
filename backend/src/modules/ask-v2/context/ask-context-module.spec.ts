import { readFileSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import type { AskContribution } from '../../ask-intelligence/ask-contribution.contract';
import { fingerprint, type AskPlan, type AskRequest } from '../ask-compute.contract';
import { AskR2ExecutionAdapter, routeContextOf } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import { QuoteTurnDto } from '../ask-v2.dto';
import {
  AskContextRefused,
  AskContextResolver,
  type ModuleRecordResolver,
} from './ask-context.resolver';
import {
  contextIdentity,
  isResolvedAskContext,
  type ResolvedAskContext,
} from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2F — a dashboard record (MODULE context) through the ONE engine.
 * The browser names a record by its stable key; the module's own governed read resolves it, and
 * the record enters the answer through the SAME governed contribution channel.
 */

const KEY = 'acled:RWA:2026-09-30:000123';

function resolverWith(found: boolean | Error = true) {
  const resolvePinned = jest.fn(async (module: string, key: string) => {
    if (found instanceof Error) throw found;
    return found
      ? {
          module: module as 'CONFLICT',
          observationKey: key,
          countryIso3: 'RWA',
          district: null,
        }
      : null;
  });
  const stories = { findRetainedArticleByUrl: jest.fn(), findArticleById: jest.fn() };
  return {
    resolver: new AskContextResolver(stories, { resolvePinned } as ModuleRecordResolver),
    resolvePinned,
    stories,
  };
}
async function refusal(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return 'NOT_REFUSED';
  } catch (e) {
    return e instanceof AskContextRefused ? e.code : `OTHER:${(e as Error).message}`;
  }
}

describe('R2F DTO — a MODULE reference is a key, never values', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const run = (context: unknown) =>
    pipe.transform(
      {
        idempotencyKey: 'key-1',
        question: 'What does this mean?',
        language: 'en',
        intent: 'ask',
        context,
      },
      { type: 'body', metatype: QuoteTurnDto },
    );

  it('accepts { kind: MODULE, module, observationKey }', async () => {
    await expect(
      run({ kind: 'MODULE', module: 'CONFLICT', observationKey: KEY }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['an unknown module', { kind: 'MODULE', module: 'WEATHER', observationKey: KEY }],
    ['a missing key', { kind: 'MODULE', module: 'CONFLICT' }],
    [
      'a key with a control character',
      { kind: 'MODULE', module: 'CONFLICT', observationKey: 'a\nb' },
    ],
    ['a 301-char key', { kind: 'MODULE', module: 'CONFLICT', observationKey: 'k'.repeat(301) }],
    ['record values', { kind: 'MODULE', module: 'CONFLICT', observationKey: KEY, fatalities: 3 }],
  ])('rejects %s', async (_n, context) => {
    await expect(run(context)).rejects.toBeDefined();
  });
});

describe('R2F resolver — bound modules resolve by key; unbound modules are refused by name', () => {
  it.each(['CONFLICT', 'IMIHIGO', 'ECONOMY', 'MARKET'])(
    '%s resolves through the module read seam',
    async (module) => {
      const { resolver, resolvePinned, stories } = resolverWith();
      const resolved = await resolver.resolve({ kind: 'MODULE', module, observationKey: KEY });
      expect(resolved).toEqual({ kind: 'MODULE', module, observationKey: KEY, countryIso3: 'RWA' });
      expect(isResolvedAskContext(resolved)).toBe(true);
      expect(resolvePinned).toHaveBeenCalledWith(module, KEY);
      expect(stories.findRetainedArticleByUrl).not.toHaveBeenCalled();
    },
  );

  it.each(['ENERGY', 'POLITICS', 'ELECTIONS', 'HUMANITARIAN'])(
    '%s → ASK_CONTEXT_MODULE_NOT_BINDABLE (no read, no pretend binding)',
    async (module) => {
      const { resolver, resolvePinned } = resolverWith();
      expect(await refusal(resolver.resolve({ kind: 'MODULE', module, observationKey: KEY }))).toBe(
        'ASK_CONTEXT_MODULE_NOT_BINDABLE',
      );
      expect(resolvePinned).not.toHaveBeenCalled();
    },
  );

  it('an unknown key → ASK_CONTEXT_MODULE_NOT_FOUND; a failing read is NOT_FOUND too', async () => {
    expect(
      await refusal(
        resolverWith(false).resolver.resolve({
          kind: 'MODULE',
          module: 'CONFLICT',
          observationKey: KEY,
        }),
      ),
    ).toBe('ASK_CONTEXT_MODULE_NOT_FOUND');
    expect(
      await refusal(
        resolverWith(new Error('db')).resolver.resolve({
          kind: 'MODULE',
          module: 'CONFLICT',
          observationKey: KEY,
        }),
      ),
    ).toBe('ASK_CONTEXT_MODULE_NOT_FOUND');
  });

  it('cross-kind keys and record values are refused before any read', async () => {
    const { resolver, resolvePinned } = resolverWith();
    for (const raw of [
      { kind: 'MODULE', module: 'CONFLICT', observationKey: KEY, countryCode: 'RW' },
      { kind: 'MODULE', module: 'CONFLICT', observationKey: KEY, title: 'x' },
      { kind: 'MODULE', module: 'CONFLICT', observationKey: 'a\u0007b' },
      { kind: 'STORY', module: 'CONFLICT', observationKey: KEY },
    ]) {
      expect(await refusal(resolver.resolve(raw))).toBe('ASK_CONTEXT_INVALID');
    }
    expect(resolvePinned).not.toHaveBeenCalled();
  });

  it('without the module reader bound, MODULE fails closed (UNAVAILABLE)', async () => {
    const resolver = new AskContextResolver({
      findRetainedArticleByUrl: jest.fn(),
      findArticleById: jest.fn(),
    });
    expect(
      await refusal(resolver.resolve({ kind: 'MODULE', module: 'CONFLICT', observationKey: KEY })),
    ).toBe('ASK_CONTEXT_UNAVAILABLE');
  });
});

describe('R2F identity and routing', () => {
  const ctx: ResolvedAskContext = {
    kind: 'MODULE',
    module: 'CONFLICT',
    observationKey: KEY,
    countryIso3: 'RWA',
  };
  const base: AskRequest = { question: 'What does this mean?', language: 'en', intent: 'ask' };

  it('identity is module:key (country is derived, not identity)', () => {
    expect(contextIdentity(ctx)).toEqual(['MODULE', `CONFLICT:${KEY}`]);
    expect(contextIdentity({ ...ctx, countryIso3: undefined })).toEqual(contextIdentity(ctx));
  });

  it('two records, or record vs none, are different fingerprints', () => {
    const plan = (
      JSON.parse(
        readFileSync(join(__dirname, '__fixtures__', 'no-context-identity.golden.json'), 'utf8'),
      ) as unknown[]
    )[0] as AskPlan;
    const a = fingerprint({ ...base, context: ctx }, plan);
    expect(fingerprint({ ...base, context: { ...ctx, observationKey: `${KEY}x` } }, plan)).not.toBe(
      a,
    );
    expect(fingerprint(base, plan)).not.toBe(a);
  });

  it('the record country is INHERITED context (map rank), never a typed place', () => {
    expect(routeContextOf(ctx)).toEqual({ mapContextCountry: 'RWA' });
    expect(routeContextOf({ ...ctx, countryIso3: undefined })).toEqual({});
  });

  it('the strict validator rejects a non-pinnable module and unknown keys', () => {
    expect(isResolvedAskContext({ ...ctx, module: 'ENERGY' })).toBe(false);
    expect(isResolvedAskContext({ ...ctx, extra: 1 })).toBe(false);
    expect(isResolvedAskContext({ ...ctx, observationKey: 'a\u0000' })).toBe(false);
  });
});

describe('R2F through the adapter — the pinned record joins the SAME governed channel', () => {
  const pinnedContribution = {
    contributorId: 'CONFLICT',
    domain: 'security',
    applicability: 'SUPPLEMENTARY',
    status: 'USED',
    temporalBasis: 'RETAINED_EVENT_RECORD',
    observations: [{ key: KEY }],
    disclosures: ['PINNED_BY_READER'],
  } as unknown as AskContribution;

  function harness() {
    const analyzeNews = jest.fn(async () => ({
      analysis: {},
      articles: [{}, {}],
      retrievalContext: {},
    }));
    const intelligence = {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({
        considered: [
          {
            contributorId: 'CONFLICT',
            domain: 'security',
            applicability: 'PRIMARY',
            scope: { countryIso3: 'RWA', district: null, place: null },
          },
        ],
        contributions: [{ ...pinnedContribution, status: 'NO_MATCH', observations: [] }],
      })),
      readPinned: jest.fn(async () => pinnedContribution),
    };
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      {
        id: 'openai',
        answerBackground: jest.fn(async () => ({ text: 'A background answer.' })),
      } as never,
      {
        config: { outputWeight: 4 },
        reserve: jest.fn(async () => ({ admitted: true, reservationId: 'r', estimatedUnits: 1 })),
        settle: jest.fn(async () => true),
      } as never,
      {
        permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })),
        record: jest.fn(async () => undefined),
      } as never,
      { isEnabled: jest.fn(async () => true) } as never,
      {
        get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
      } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: jest.fn(async () => true) } as never,
      intelligence as never,
    );
    return { adapter, intelligence, analyzeNews };
  }
  const run = async (adapter: AskR2ExecutionAdapter, request: AskRequest) => {
    const who = { accountId: 'u', ipScope: 'ip:v4:192.0.2.9' };
    const plan = await askRequestContext.run(who, () => adapter.prepare(request));
    const out = await askRequestContext.run(who, () => adapter.execute(request, plan, 'op'));
    return JSON.parse(out.payloadJson) as {
      intelligence: { considered: string[]; contributions: { status: string }[] } | null;
    };
  };
  const ctx: ResolvedAskContext = {
    kind: 'MODULE',
    module: 'CONFLICT',
    observationKey: KEY,
    countryIso3: 'RWA',
  };

  it('a reporting answer carries the pinned record, replacing the text-keyed CONFLICT read', async () => {
    const { adapter, intelligence, analyzeNews } = harness();
    const payload = await run(adapter, {
      question: 'What is the latest news on clashes in Rwanda?',
      language: 'en',
      intent: 'ask',
      context: ctx,
    });
    expect(intelligence.readPinned).toHaveBeenCalledWith({
      module: 'CONFLICT',
      observationKey: KEY,
      countryIso3: 'RWA',
      district: null,
    });
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    expect(payload.intelligence?.considered).toEqual(['CONFLICT']);
    expect(payload.intelligence?.contributions).toHaveLength(1);
    expect(payload.intelligence?.contributions[0].status).toBe('USED');
  });

  it('without MODULE context the pinned read never happens (no-context behaviour unchanged)', async () => {
    const { adapter, intelligence } = harness();
    await run(adapter, {
      question: 'What is the latest news on clashes in Rwanda?',
      language: 'en',
      intent: 'ask',
    });
    expect(intelligence.readPinned).not.toHaveBeenCalled();
  });
});
