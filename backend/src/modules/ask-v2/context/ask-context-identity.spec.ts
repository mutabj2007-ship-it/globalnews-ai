import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import {
  AskExecutionRefused,
  fingerprint,
  validatePlan,
  type AskPlan,
  type AskRequest,
  type PersistedAskPlan,
} from '../ask-compute.contract';
import { AskR2ExecutionAdapter, routeContextOf } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import type { ResolvedAskContext } from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2B — request identity and the binding into the ONE engine.
 *
 *   - a context-free turn is byte-identical to the canonical engine (golden values generated
 *     on 6ba220f, whose identity code equals dc36536's);
 *   - the same question with a different resolved context is a different plan revision and a
 *     different fingerprint — pinned EXPLICITLY, even where the two routes are identical;
 *   - a persisted context is validated strictly (corrupt → ASK_PLAN_INVALID);
 *   - the resolved context reaches the landed seams (AskRouteContext, AnalysisService's
 *     storyContext / geographyContext) and nothing else, and prepare spends nothing.
 */

interface Golden {
  question: string;
  language: 'en' | 'pl';
  intent: AskRequest['intent'];
  prior: string | null;
  revision: string;
  scope: string;
  contract: string;
  executionKey: string;
  fingerprint: string;
}
const GOLDEN: Golden[] = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'no-context-identity.golden.json'), 'utf8'),
);

const URL_A = 'https://news.example/2026/10/01/story-a';
const URL_B = 'https://news.example/2026/10/01/story-b';
const story = (url: string, id: string, iso3?: string): ResolvedAskContext => ({
  kind: 'STORY',
  articleRef: computeArticleRef(url),
  articleId: id,
  ...(iso3 === undefined ? {} : { countryIso3: iso3 }),
  storyContext: {
    title: `Server title for ${id}`,
    articleId: id,
    url,
    sourceName: 'Example Wire',
    ...(iso3 === undefined ? {} : { countryCode: iso3 }),
  },
});
const STORY_A = story(URL_A, 'art-a', 'POL');
const STORY_B = story(URL_B, 'art-b', 'POL');
const STORY_A_NOCOUNTRY = story(URL_A, 'art-a');
const STORY_B_NOCOUNTRY = story(URL_B, 'art-b');
const GEO = (iso3: string, name: string): ResolvedAskContext => ({
  kind: 'GEOGRAPHY',
  countryIso3: iso3,
  geographyContext: { countryCode: iso3, displayName: name },
});
const POL = GEO('POL', 'Poland');
const KEN = GEO('KEN', 'Kenya');

type Calls = {
  analysis: unknown[][];
  background: unknown[];
  reserve: unknown[];
  settle: unknown[];
};
function harness() {
  const calls: Calls = { analysis: [], background: [], reserve: [], settle: [] };
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        calls.analysis.push(args);
        return { analysis: {}, articles: [{}, {}], retrievalContext: {} };
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
    {
      id: 'openai',
      answerBackground: jest.fn(async (input: unknown) => {
        calls.background.push(input);
        return { text: 'background' };
      }),
    } as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async (input: unknown) => {
        calls.reserve.push(input);
        return { admitted: true, reservationId: 'res-1', estimatedUnits: 1 };
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
    {
      get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
    } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async () => true) } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({ considered: [], contributions: [] })),
    } as never,
  );
  return { adapter, calls };
}
const WHO = { accountId: 'golden-account', ipScope: 'ip:v4:192.0.2.1' };
const prepare = (adapter: AskR2ExecutionAdapter, request: AskRequest, prior?: string | null) =>
  askRequestContext.run({ ...WHO, ...(prior ? { priorQuestion: prior } : {}) }, () =>
    adapter.prepare(request),
  );
const req = (question: string, context?: ResolvedAskContext): AskRequest => ({
  question,
  language: 'en',
  intent: 'ask',
  ...(context === undefined ? {} : { context }),
});
const Q = 'What does this mean?';

describe('E · NO context: byte-identical to the canonical engine (golden, generated on 6ba220f)', () => {
  it.each(
    GOLDEN.map(
      (g) =>
        [`${g.language}/${g.intent}: ${g.question}${g.prior ? ' (follow-up)' : ''}`, g] as const,
    ),
  )('%s', async (_name, g) => {
    const { adapter } = harness();
    const request: AskRequest = { question: g.question, language: g.language, intent: g.intent };
    const plan = await prepare(adapter, request, g.prior);
    expect(plan).not.toHaveProperty('context');
    expect({
      revision: plan.revision,
      scope: plan.scope,
      contract: plan.contract,
      executionKey: plan.executionKey,
      fingerprint: fingerprint(request, plan),
    }).toEqual({
      revision: g.revision,
      scope: g.scope,
      contract: g.contract,
      executionKey: g.executionKey,
      fingerprint: g.fingerprint,
    });
  });
});

describe('A / B · same question, different context → different identity', () => {
  it.each([
    ['A · STORY A vs STORY B', STORY_A, STORY_B],
    [
      'A · STORY A vs STORY B, both without a country (IDENTICAL routes)',
      STORY_A_NOCOUNTRY,
      STORY_B_NOCOUNTRY,
    ],
    ['B · GEOGRAPHY POL vs GEOGRAPHY KEN', POL, KEN],
    ['STORY vs GEOGRAPHY', STORY_A, POL],
  ])('%s: different plan revision, execution key and fingerprint', async (_n, first, second) => {
    const { adapter } = harness();
    const p1 = await prepare(adapter, req(Q, first));
    const p2 = await prepare(adapter, req(Q, second));
    expect(p1.revision).not.toBe(p2.revision);
    expect(p1.executionKey).not.toBe(p2.executionKey);
    expect(fingerprint(req(Q, first), p1)).not.toBe(fingerprint(req(Q, second), p2));
  });

  it('the identity is pinned EXPLICITLY: with identical routes, only the pinned context separates the revisions', async () => {
    const { adapter } = harness();
    const a = await prepare(adapter, req(Q, STORY_A_NOCOUNTRY));
    const b = await prepare(adapter, req(Q, STORY_B_NOCOUNTRY));
    /* The two routes are the same (no country on either story) … */
    expect(a.scope).toBe(b.scope);
    expect(a.contract).toBe(b.contract);
    /* … and yet the revisions differ. */
    expect(a.revision).not.toBe(b.revision);
  });

  it('even holding the plan fixed, the fingerprint itself separates contexts', () => {
    const plan = GOLDEN[0] as unknown as AskPlan;
    const base = {
      ...plan,
      contextual: false,
      deepRequested: false,
      reportRequested: false,
      countryCount: 0,
      domainCount: 0,
      timeWindowDays: 0,
    } as AskPlan;
    const f = (c?: ResolvedAskContext) => fingerprint(req(Q, c), base);
    expect(new Set([f(), f(STORY_A), f(STORY_B), f(POL), f(KEN)]).size).toBe(5);
  });

  it('a context-bearing turn never equals the context-free turn', async () => {
    const { adapter } = harness();
    const none = await prepare(adapter, req(Q));
    for (const c of [STORY_A, STORY_A_NOCOUNTRY, POL, KEN]) {
      const withContext = await prepare(adapter, req(Q, c));
      expect(withContext.revision).not.toBe(none.revision);
      expect(fingerprint(req(Q, c), withContext)).not.toBe(fingerprint(req(Q), none));
    }
  });

  it('C · the same question with the same context is the same identity (deterministic)', async () => {
    const { adapter } = harness();
    for (const c of [STORY_A, POL]) {
      const p1 = await prepare(adapter, req(Q, c));
      const p2 = await prepare(adapter, req(Q, c));
      expect(p2.revision).toBe(p1.revision);
      expect(fingerprint(req(Q, c), p2)).toBe(fingerprint(req(Q, c), p1));
    }
  });
});

describe('validatePlan — the persisted context is checked strictly', () => {
  const valid = async (c: ResolvedAskContext): Promise<PersistedAskPlan> => {
    const { adapter } = harness();
    return { ...(await prepare(adapter, req(Q, c))), context: c };
  };
  const invalid = (plan: PersistedAskPlan, request?: AskRequest): boolean => {
    try {
      validatePlan(plan, request);
      return false;
    } catch (e) {
      return (e as Error).message === 'ASK_PLAN_INVALID';
    }
  };

  it('a valid STORY / GEOGRAPHY context validates, against its own request', async () => {
    for (const c of [STORY_A, STORY_A_NOCOUNTRY, POL]) {
      expect(invalid(await valid(c), req(Q, c))).toBe(false);
    }
  });

  it.each<[string, (c: Record<string, unknown>) => unknown]>([
    ['an unknown kind', (c) => ({ ...c, kind: 'MODULE' })],
    ['an extra top-level key', (c) => ({ ...c, prompt: 'x' })],
    [
      'an extra storyContext key (summary)',
      (c) => ({ ...c, storyContext: { ...(c.storyContext as object), summary: 'x' } }),
    ],
    ['a malformed articleRef', (c) => ({ ...c, articleRef: 'nope' })],
    [
      'an articleRef that is not the stored URL identity',
      (c) => ({ ...c, articleRef: computeArticleRef(URL_B) }),
    ],
    [
      'an oversized title',
      (c) => ({ ...c, storyContext: { ...(c.storyContext as object), title: 'T'.repeat(1001) } }),
    ],
    [
      'a storyContext.articleId that differs',
      (c) => ({ ...c, storyContext: { ...(c.storyContext as object), articleId: 'other' } }),
    ],
    [
      'an ungoverned country',
      (c) => ({
        ...c,
        countryIso3: 'ZZZ',
        storyContext: { ...(c.storyContext as object), countryCode: 'ZZZ' },
      }),
    ],
    [
      'a storyContext country that differs from countryIso3',
      (c) => ({ ...c, storyContext: { ...(c.storyContext as object), countryCode: 'KEN' } }),
    ],
    ['null', () => null],
    ['a string', () => 'STORY'],
  ])('STORY with %s → ASK_PLAN_INVALID', async (_n, corrupt) => {
    const plan = await valid(STORY_A);
    expect(invalid({ ...plan, context: corrupt(plan.context as never) as never })).toBe(true);
  });

  it.each<[string, (c: Record<string, unknown>) => unknown]>([
    [
      'a tampered display name',
      (c) => ({ ...c, geographyContext: { countryCode: 'POL', displayName: 'Atlantis' } }),
    ],
    [
      'an ISO2 code',
      (c) => ({
        ...c,
        countryIso3: 'PL',
        geographyContext: { countryCode: 'PL', displayName: 'Poland' },
      }),
    ],
    [
      'an unknown ISO3',
      (c) => ({
        ...c,
        countryIso3: 'ZZZ',
        geographyContext: { countryCode: 'ZZZ', displayName: 'Poland' },
      }),
    ],
    [
      'a mismatched geography code',
      (c) => ({ ...c, geographyContext: { countryCode: 'KEN', displayName: 'Kenya' } }),
    ],
    ['an extra key', (c) => ({ ...c, articleRef: 'x' })],
  ])('GEOGRAPHY with %s → ASK_PLAN_INVALID', async (_n, corrupt) => {
    const plan = await valid(POL);
    expect(invalid({ ...plan, context: corrupt(plan.context as never) as never })).toBe(true);
  });

  it('a persisted context that is not the request’s context → ASK_PLAN_INVALID', async () => {
    expect(invalid(await valid(STORY_A), req(Q, STORY_B))).toBe(true);
    expect(invalid(await valid(POL), req(Q, KEN))).toBe(true);
    expect(invalid(await valid(POL), req(Q))).toBe(true);
  });
});

describe('ROUTER binding — the landed seams only', () => {
  it('routeContextOf maps STORY → anchor (+ country when established), GEOGRAPHY → map country; never articleRefs', () => {
    expect(routeContextOf(undefined)).toEqual({});
    expect(routeContextOf(STORY_A)).toEqual({
      hasResolvedArticleAnchor: true,
      storyAnchorCountry: 'POL',
    });
    expect(routeContextOf(STORY_A_NOCOUNTRY)).toEqual({ hasResolvedArticleAnchor: true });
    expect(routeContextOf(POL)).toEqual({ mapContextCountry: 'POL' });
    for (const c of [STORY_A, STORY_A_NOCOUNTRY, POL]) {
      expect(routeContextOf(c)).not.toHaveProperty('articleRefs');
    }
  });

  it('a STORY scopes as ARTICLE_ANCHOR (never SELECTION); a GEOGRAPHY as MAP_GEOGRAPHY_CONTEXT', async () => {
    const { adapter } = harness();
    const scopeOf = async (c: ResolvedAskContext) =>
      JSON.parse((await prepare(adapter, req(Q, c))).scope) as {
        scopedBy: string;
        geography: string[];
      };
    expect(await scopeOf(STORY_A)).toMatchObject({
      scopedBy: 'ARTICLE_ANCHOR',
      geography: ['STORY_ANCHOR:POL'],
    });
    expect((await scopeOf(POL)).scopedBy).toBe('MAP_GEOGRAPHY_CONTEXT');
    for (const c of [STORY_A, STORY_A_NOCOUNTRY]) {
      expect((await scopeOf(c)).scopedBy).not.toBe('SELECTION');
    }
  });

  it('a place TYPED by the reader keeps its precedence over an inherited story or Map country', async () => {
    const { adapter } = harness();
    const typed = 'What is happening in Kenya?';
    for (const c of [STORY_A, POL]) {
      const scope = JSON.parse((await prepare(adapter, req(typed, c))).scope) as {
        scopedBy: string;
      };
      expect(scope.scopedBy).toBe('TYPED_GEOGRAPHY');
    }
  });

  it('an anchored story makes a context-dependent question current reporting about that story', async () => {
    const { adapter } = harness();
    expect((await prepare(adapter, req(Q))).contract).toMatch(
      /:REFERENCE:REFERENCE_BACKGROUND_ONLY$/,
    );
    for (const c of [STORY_A, STORY_A_NOCOUNTRY]) {
      expect((await prepare(adapter, req(Q, c))).contract).toMatch(
        /:CURRENT_REPORTING:EXECUTABLE$/,
      );
    }
  });

  it('prepare with context spends NOTHING (no analysis, background, meter)', async () => {
    const { adapter, calls } = harness();
    for (const c of [STORY_A, STORY_A_NOCOUNTRY, POL, KEN]) await prepare(adapter, req(Q, c));
    expect(calls).toEqual({ analysis: [], background: [], reserve: [], settle: [] });
  });
});

describe('ANALYSIS binding — the existing storyContext / geographyContext arguments', () => {
  const run = async (question: string, context?: ResolvedAskContext) => {
    const h = harness();
    const request = req(question, context);
    const plan = await prepare(h.adapter, request);
    await askRequestContext.run(WHO, () => h.adapter.execute(request, plan, 'op-1'));
    return h.calls;
  };

  it('STORY → the SERVER-built StoryContext, exactly; no geography', async () => {
    const calls = await run(Q, STORY_A);
    expect(calls.analysis).toHaveLength(1);
    expect(calls.analysis[0]![2]).toEqual(STORY_A.kind === 'STORY' ? STORY_A.storyContext : null);
    expect(calls.analysis[0]![4]).toBeUndefined();
    expect(calls.analysis[0]![5]).toBeUndefined();
  });

  it('GEOGRAPHY → the SERVER-built GeographyContext (ISO3 + registry name); no story', async () => {
    const calls = await run('What is the latest news?', POL);
    expect(calls.analysis).toHaveLength(1);
    expect(calls.analysis[0]![2]).toBeUndefined();
    expect(calls.analysis[0]![5]).toEqual({ countryCode: 'POL', displayName: 'Poland' });
  });

  it('NO context → both undefined, exactly as the canonical engine', async () => {
    const calls = await run('What is the latest news?');
    expect(calls.analysis).toHaveLength(1);
    expect(calls.analysis[0]![2]).toBeUndefined();
    expect(calls.analysis[0]![5]).toBeUndefined();
  });

  it('executing a plan quoted for STORY A with STORY B is refused before any spend', async () => {
    const h = harness();
    const plan = await prepare(h.adapter, req(Q, STORY_A));
    let code = 'NOT_REFUSED';
    try {
      await askRequestContext.run(WHO, () => h.adapter.execute(req(Q, STORY_B), plan, 'op-1'));
    } catch (e) {
      code = e instanceof AskExecutionRefused ? e.code : 'OTHER';
    }
    expect(code).toBe('ASK_PLAN_REVISION_MISMATCH');
    expect(h.calls).toEqual({ analysis: [], background: [], reserve: [], settle: [] });
  });
});
