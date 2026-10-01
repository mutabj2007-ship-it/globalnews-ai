import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import type { AskRequest } from '../ask-compute.contract';
import { AskR2ExecutionAdapter, truthfulInheritedChips } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import type { PlanChip, PlanChips } from '../../ask-router/plan-chips';
import type { ResolvedAskContext } from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2C — an inherited context chip never claims a scope the answer
 * did not use. With R2B/R2C a Map country or a story can reach Ask V2; a background / computed /
 * governed answer never uses it, and a reporting answer uses it only when AnalysisService says so.
 */

const MAP_POL = {
  kind: 'GEOGRAPHY' as const,
  value: 'POL',
  source: 'MAP_GEOGRAPHY_CONTEXT',
  applied: true,
};
const STORY_POL = {
  kind: 'GEOGRAPHY' as const,
  value: 'POL',
  source: 'STORY_ANCHOR',
  applied: true,
};
const TYPED_KEN = {
  kind: 'GEOGRAPHY' as const,
  value: 'KEN',
  source: 'TYPED_GEOGRAPHY',
  applied: true,
};
const TIME = { kind: 'TIME' as const, value: 'last week', source: 'STATED_PERIOD', applied: true };
const scoped = (...chips: PlanChip[]): PlanChips => ({
  kind: 'SCOPED',
  chips,
});
const analysisWith = (retrievalContext: Record<string, unknown>) =>
  ({ analysis: {}, articles: [], retrievalContext }) as unknown as AnalysisApiResponse;

describe('truthfulInheritedChips — downgrade only', () => {
  it('no analysis (background / computed / governed / early terminal) → inherited chips NOT applied', () => {
    const out = truthfulInheritedChips(scoped(MAP_POL, STORY_POL, TYPED_KEN, TIME), null);
    expect(out).toEqual(
      scoped({ ...MAP_POL, applied: false }, { ...STORY_POL, applied: false }, TYPED_KEN, TIME),
    );
  });

  it('reporting that USED the context keeps it applied; that did not → not applied', () => {
    expect(
      truthfulInheritedChips(scoped(MAP_POL), analysisWith({ geographyContextUsed: true })),
    ).toEqual(scoped(MAP_POL));
    expect(
      truthfulInheritedChips(scoped(MAP_POL), analysisWith({ geographyContextUsed: false })),
    ).toEqual(scoped({ ...MAP_POL, applied: false }));
    expect(truthfulInheritedChips(scoped(MAP_POL), analysisWith({}))).toEqual(
      scoped({ ...MAP_POL, applied: false }),
    );
    expect(
      truthfulInheritedChips(scoped(STORY_POL), analysisWith({ storyContextUsed: true })),
    ).toEqual(scoped(STORY_POL));
  });

  it('never upgrades, never touches typed / non-geography chips, and passes NONE / PENDING through', () => {
    const notApplied = { ...MAP_POL, applied: false };
    expect(
      truthfulInheritedChips(scoped(notApplied), analysisWith({ geographyContextUsed: true })),
    ).toEqual(scoped(notApplied));
    const typedOnly = scoped(TYPED_KEN, TIME);
    expect(truthfulInheritedChips(typedOnly, null)).toBe(typedOnly);
    expect(truthfulInheritedChips({ kind: 'NONE' }, null)).toEqual({ kind: 'NONE' });
    expect(truthfulInheritedChips({ kind: 'PENDING' }, null)).toEqual({ kind: 'PENDING' });
  });
});

describe('through the adapter: a Map country on a background answer is not credited', () => {
  const POL: ResolvedAskContext = {
    kind: 'GEOGRAPHY',
    countryIso3: 'POL',
    geographyContext: { countryCode: 'POL', displayName: 'Poland' },
  };
  function harness(analysis?: (policy: unknown) => Promise<unknown>) {
    return new AskR2ExecutionAdapter(
      {
        analyzeNews: jest.fn(async (...args: unknown[]) =>
          analysis
            ? analysis(args[6])
            : {
                analysis: {},
                articles: [{}, {}],
                retrievalContext: { geographyContextUsed: true },
              },
        ),
      } as never,
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
      {
        boundSpecialistDomains: () => ['CONFLICT'],
        read: jest.fn(async () => ({ considered: [], contributions: [] })),
      } as never,
    );
  }
  const run = async (adapter: AskR2ExecutionAdapter, question: string) => {
    const request: AskRequest = { question, language: 'en', intent: 'ask', context: POL };
    const who = { accountId: 'u', ipScope: 'ip:v4:192.0.2.9' };
    const plan = await askRequestContext.run(who, () => adapter.prepare(request));
    const out = await askRequestContext.run(who, () => adapter.execute(request, plan, 'op'));
    return JSON.parse(out.payloadJson) as {
      answer: { state: string };
      chips: { kind: string; chips?: { source: string; applied: boolean }[] };
    };
  };

  it('"What does this mean?" + POL is answered as background → the POL chip is NOT applied', async () => {
    const payload = await run(harness(), 'What does this mean?');
    expect(payload.answer.state).toBe('REFERENCE_BACKGROUND');
    const map = payload.chips.chips?.find((c) => c.source === 'MAP_GEOGRAPHY_CONTEXT');
    expect(map).toBeDefined();
    expect(map?.applied).toBe(false);
  });

  it('a reporting answer that USED the Map country keeps the chip applied', async () => {
    const payload = await run(harness(), 'What is the latest news?');
    const map = payload.chips.chips?.find((c) => c.source === 'MAP_GEOGRAPHY_CONTEXT');
    expect(map?.applied).toBe(true);
  });

  it('a reporting answer that did NOT use it (stamped false) shows it not applied', async () => {
    const payload = await run(
      harness(async () => ({
        analysis: {},
        articles: [{}, {}],
        retrievalContext: { geographyContextUsed: false },
      })),
      'What is the latest news?',
    );
    const map = payload.chips.chips?.find((c) => c.source === 'MAP_GEOGRAPHY_CONTEXT');
    expect(map?.applied).toBe(false);
  });
});
