import type { NewsArticle } from '@globalnews-ai/shared';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import {
  AskExecutionRefused,
  fingerprint,
  validatePlan,
  type AskRequest,
  type PersistedAskPlan,
} from '../ask-compute.contract';
import { AskR2ExecutionAdapter, routeContextOf } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import { AskContextRefused, AskContextResolver } from './ask-context.resolver';
import {
  contextIdentity,
  isResolvedAskContext,
  type ResolvedAskContext,
} from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2D — the My Intelligence SELECTION through the ONE engine.
 */

const url = (n: number) => `https://news.example/2026/10/01/story-${n}`;
const ref = (n: number) => computeArticleRef(url(n));
const article = (n: number): NewsArticle =>
  ({
    id: `art-${n}`,
    title: `Story ${n}`,
    summary: 's',
    url: url(n),
    sourceId: 'src',
    sourceName: 'Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-10-01T06:00:00Z',
  }) as NewsArticle;
const pick = (...ns: number[]) => ns.map((n) => ({ articleRef: ref(n), url: url(n) }));

function resolverWith(retained: readonly number[]) {
  const findRetainedArticleByUrl = jest.fn(async (u: string) => {
    const n = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => url(i) === u);
    return n !== undefined && retained.includes(n) ? article(n) : null;
  });
  const findArticleById = jest.fn(async () => null);
  return {
    resolver: new AskContextResolver({ findRetainedArticleByUrl, findArticleById }),
    findRetainedArticleByUrl,
  };
}
async function refusal(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return 'NOT_REFUSED';
  } catch (e) {
    return e instanceof AskContextRefused
      ? e.code
      : e instanceof AskExecutionRefused
        ? e.code
        : `OTHER:${(e as Error).message}`;
  }
}

describe('R2D resolver — every selected story resolved, or the turn is refused', () => {
  it('resolves an in-bounds COMPARE selection from retained reporting (one read per story)', async () => {
    const { resolver, findRetainedArticleByUrl } = resolverWith([1, 2]);
    const resolved = await resolver.resolve({
      kind: 'SELECTION',
      action: 'COMPARE',
      stories: pick(1, 2),
    });
    expect(resolved).toEqual({
      kind: 'SELECTION',
      action: 'COMPARE',
      stories: [
        { articleRef: ref(1), articleId: 'art-1', url: url(1) },
        { articleRef: ref(2), articleId: 'art-2', url: url(2) },
      ],
    });
    expect(findRetainedArticleByUrl).toHaveBeenCalledTimes(2);
    expect(isResolvedAskContext(resolved)).toBe(true);
  });

  it('one unresolvable story refuses the WHOLE selection — never a silent drop', async () => {
    const { resolver } = resolverWith([1, 2]);
    expect(
      await refusal(
        resolver.resolve({ kind: 'SELECTION', action: 'SUMMARIZE', stories: pick(1, 2, 3) }),
      ),
    ).toBe('ASK_CONTEXT_STORY_NOT_FOUND');
  });

  it.each([
    [
      'COMPARE with 1 story (minimum 2)',
      { kind: 'SELECTION', action: 'COMPARE', stories: pick(1) },
    ],
    [
      '9 stories (maximum 8)',
      { kind: 'SELECTION', action: 'SUMMARIZE', stories: pick(1, 2, 3, 4, 5, 6, 7, 8, 9) },
    ],
    ['duplicate refs', { kind: 'SELECTION', action: 'COMPARE', stories: [...pick(1), ...pick(1)] }],
    ['an unknown action', { kind: 'SELECTION', action: 'RANK', stories: pick(1, 2) }],
    ['no stories', { kind: 'SELECTION', action: 'SUMMARIZE', stories: [] }],
    [
      'a story carrying a title',
      { kind: 'SELECTION', action: 'SUMMARIZE', stories: [{ ...pick(1)[0], title: 'x' }] },
    ],
    [
      'a selection carrying extra keys',
      { kind: 'SELECTION', action: 'SUMMARIZE', stories: pick(1), prompt: 'x' },
    ],
  ])('%s → ASK_CONTEXT_INVALID, no read', async (_n, context) => {
    const { resolver, findRetainedArticleByUrl } = resolverWith([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(await refusal(resolver.resolve(context))).toBe('ASK_CONTEXT_INVALID');
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it('a ref that is not its URL identity → ASK_CONTEXT_STORY_REF_MISMATCH, before any read', async () => {
    const { resolver, findRetainedArticleByUrl } = resolverWith([1, 2]);
    expect(
      await refusal(
        resolver.resolve({
          kind: 'SELECTION',
          action: 'COMPARE',
          stories: [{ articleRef: ref(2), url: url(1) }, ...pick(2)],
        }),
      ),
    ).toBe('ASK_CONTEXT_STORY_REF_MISMATCH');
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it('all six existing MultiStoryAction values are accepted (no MI capability is dropped)', async () => {
    const { resolver } = resolverWith([1, 2]);
    for (const action of [
      'COMPARE',
      'SUMMARIZE',
      'ASK_SELECTED',
      'EXPLAIN_DISAGREEMENTS',
      'WHAT_CHANGED',
      'CREATE_BRIEFING',
    ]) {
      const resolved = await resolver.resolve({ kind: 'SELECTION', action, stories: pick(1, 2) });
      expect(resolved).toMatchObject({ kind: 'SELECTION', action });
    }
  });
});

const sel = (action: string, ...ns: number[]): ResolvedAskContext =>
  ({
    kind: 'SELECTION',
    action,
    stories: ns.map((n) => ({ articleRef: ref(n), articleId: `art-${n}`, url: url(n) })),
  }) as ResolvedAskContext;

describe('R2D identity — Story Set A never reuses Story Set B', () => {
  it('different sets, different actions → different identities; the same set in another order → the same', () => {
    expect(contextIdentity(sel('COMPARE', 1, 2))).not.toEqual(
      contextIdentity(sel('COMPARE', 1, 3)),
    );
    expect(contextIdentity(sel('COMPARE', 1, 2))).not.toEqual(
      contextIdentity(sel('SUMMARIZE', 1, 2)),
    );
    expect(contextIdentity(sel('COMPARE', 1, 2))).toEqual(contextIdentity(sel('COMPARE', 2, 1)));
  });

  it('the plan revision and fingerprint follow the selection identity', async () => {
    const adapter = harness().adapter;
    const q = 'Compare the selected stories';
    const prep = (c: ResolvedAskContext) =>
      askRequestContext.run(WHO, () =>
        adapter.prepare({ question: q, language: 'en', intent: 'ask', context: c }),
      );
    const a = await prep(sel('COMPARE', 1, 2));
    const b = await prep(sel('COMPARE', 1, 3));
    const a2 = await prep(sel('COMPARE', 2, 1));
    expect(a.revision).not.toBe(b.revision);
    expect(a2.revision).toBe(a.revision);
    const req = (c: ResolvedAskContext): AskRequest => ({
      question: q,
      language: 'en',
      intent: 'ask',
      context: c,
    });
    expect(fingerprint(req(sel('COMPARE', 1, 2)), a)).not.toBe(
      fingerprint(req(sel('COMPARE', 1, 3)), b),
    );
  });

  it('validatePlan rejects a corrupt persisted selection', async () => {
    const base = await askRequestContext.run(WHO, () =>
      harness().adapter.prepare({
        question: 'Summarize the selected stories',
        language: 'en',
        intent: 'ask',
        context: sel('SUMMARIZE', 1),
      }),
    );
    const invalid = (context: unknown) => {
      try {
        validatePlan({ ...base, context } as PersistedAskPlan);
        return false;
      } catch (e) {
        return (e as Error).message === 'ASK_PLAN_INVALID';
      }
    };
    expect(invalid(sel('SUMMARIZE', 1))).toBe(false);
    expect(invalid(sel('COMPARE', 1))).toBe(true); // below the action minimum
    expect(invalid({ ...(sel('SUMMARIZE', 1) as object), extra: 1 })).toBe(true);
    expect(
      invalid({
        kind: 'SELECTION',
        action: 'SUMMARIZE',
        stories: [{ articleRef: ref(2), articleId: 'a', url: url(1) }],
      }),
    ).toBe(true); // ref is not the stored URL identity
  });

  it('routeContextOf maps a selection to frozen C’s own multi-story transport (articleRefs)', () => {
    expect(routeContextOf(sel('COMPARE', 1, 2))).toEqual({ articleRefs: [ref(1), ref(2)] });
  });
});

/* ── the adapter executes the SELECTION (never a clarification / background answer) ─────── */
const WHO = { accountId: 'u-1', ipScope: 'ip:v4:192.0.2.5' };
type Calls = {
  analysis: unknown[][];
  background: unknown[];
  reserve: unknown[];
  settle: unknown[][];
};
function harness(meterAdmitted = true) {
  const calls: Calls = { analysis: [], background: [], reserve: [], settle: [] };
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        calls.analysis.push(args);
        (
          args[6] as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void }
        ).usageSink?.({
          promptTokens: 1000,
          completionTokens: 300,
        });
        return { analysis: { summary: 'comparison' }, articles: [{}, {}], retrievalContext: {} };
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
    {
      id: 'openai',
      answerBackground: jest.fn(async (input: unknown) => {
        calls.background.push(input);
        return { text: 'bg' };
      }),
    } as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async (input: unknown) => {
        calls.reserve.push(input);
        return meterAdmitted
          ? { admitted: true, reservationId: 'res', estimatedUnits: 1 }
          : { admitted: false, kind: 'REFUSED', control: 'account-day' };
      }),
      settle: jest.fn(async (...args: unknown[]) => {
        calls.settle.push(args);
        return true;
      }),
    } as never,
    {
      permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })),
      record: jest.fn(async () => undefined),
    } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async () => true) } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({ considered: [], contributions: [] })),
    } as never,
  );
  return { adapter, calls };
}
async function run(question: string, context: ResolvedAskContext, meterAdmitted = true) {
  const h = harness(meterAdmitted);
  const request: AskRequest = { question, language: 'en', intent: 'ask', context };
  const plan = await askRequestContext.run(WHO, () => h.adapter.prepare(request));
  const out = await askRequestContext.run(WHO, () => h.adapter.execute(request, plan, 'op'));
  return {
    h,
    payload: JSON.parse(out.payloadJson) as {
      answer: { state: string };
      route: { scopedBy: string; terminalState: string };
    },
  };
}

describe('R2D adapter — the selection is executed as the selection', () => {
  it.each([
    'Compare the selected stories', // the general router reads this as a CLARIFICATION
    'Explain the disagreements between the selected stories', // … and this as REFERENCE_BACKGROUND
    'Porównaj wybrane artykuły',
    'What is inflation?', // an ASK_SELECTED typed question
  ])(
    '"%s" → ONE analysis call with the selection; no background; answered as CURRENT_REPORTING',
    async (q) => {
      const { h, payload } = await run(q, sel('COMPARE', 1, 2));
      expect(h.calls.background).toEqual([]);
      expect(h.calls.analysis).toHaveLength(1);
      const args = h.calls.analysis[0];
      expect(args[0]).toBe(q);
      expect(args[2]).toBeUndefined(); // no story context
      expect(args[3]).toBeUndefined(); // the selection replaces conversation context
      expect(args[4]).toEqual({ action: 'COMPARE', stories: pick(1, 2) });
      expect(args[5]).toBeUndefined(); // no geography
      expect((args[6] as { maxModelAttempts: number }).maxModelAttempts).toBe(1);
      expect(payload.answer).toMatchObject({ state: 'CURRENT_REPORTING' });
      expect(payload.route).toMatchObject({ scopedBy: 'SELECTION', terminalState: 'EXECUTABLE' });
      /* metered and settled exactly once, as the reporting path */
      expect(h.calls.reserve).toHaveLength(1);
      expect(h.calls.settle).toEqual([['res', 1000 + 4 * 300, 'SUCCESS']]);
    },
  );

  it('a meter refusal stops the selection before the model (fail closed)', async () => {
    const h = harness(false);
    const request: AskRequest = {
      question: 'Compare the selected stories',
      language: 'en',
      intent: 'ask',
      context: sel('COMPARE', 1, 2),
    };
    const plan = await askRequestContext.run(WHO, () => h.adapter.prepare(request));
    expect(
      await refusal(askRequestContext.run(WHO, () => h.adapter.execute(request, plan, 'op'))),
    ).toBe('BUDGET_REFUSED:account-day');
    expect(h.calls.analysis).toEqual([]);
  });

  it('a different selection under the same plan is refused before spend (revision mismatch)', async () => {
    const h = harness();
    const asked: AskRequest = {
      question: 'Compare the selected stories',
      language: 'en',
      intent: 'ask',
      context: sel('COMPARE', 1, 2),
    };
    const plan = await askRequestContext.run(WHO, () => h.adapter.prepare(asked));
    expect(
      await refusal(
        askRequestContext.run(WHO, () =>
          h.adapter.execute({ ...asked, context: sel('COMPARE', 1, 3) }, plan, 'op'),
        ),
      ),
    ).toBe('ASK_PLAN_REVISION_MISMATCH');
    expect(h.calls).toEqual({ analysis: [], background: [], reserve: [], settle: [] });
  });
});
