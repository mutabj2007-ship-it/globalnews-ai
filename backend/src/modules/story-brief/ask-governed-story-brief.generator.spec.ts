import { AskGovernedStoryBriefGenerator, failureKindOf } from './ask-governed-story-brief.generator';

/** The governed operation → Brief projection. Pure: views are fixtures, no Ask call. */
const generator = new AskGovernedStoryBriefGenerator({} as never, { get: () => 'true' } as never);

const r2 = (state: string, summary: string | null = 'Sourced summary') => ({
  schema: 'ask-r2-result/1',
  checkedAt: '2026-10-05T10:00:00.000Z',
  answer: { state },
  analysis: {
    analysis: {
      summary,
      keyFacts: [{ claim: 'Port reopened', sourceArticleIds: ['a1'] }],
      sources: [{ articleId: 'a1', url: 'https://one.example/a', title: 'A', publisher: 'One', publishedAt: '2026-10-05T08:00:00Z' }],
      unknowns: ['cause not established'],
    },
  },
  intelligence: { considered: ['CONFLICT'], contributions: [] },
});
const completed = (payload: unknown) =>
  ({ operationId: 'op-1', status: 'COMPLETED', failureCode: null, result: { payload } }) as never;
const released = (failureCode: string) => ({ operationId: 'op-2', status: 'RELEASED', failureCode, result: null }) as never;

describe('governed failure codes → Brief failure kinds (never INSUFFICIENT)', () => {
  it.each([
    ['BUDGET_REFUSED:account-day', 'BUDGET_REFUSED'],
    ['BUDGET_DEGRADED:global-hour', 'BUDGET_REFUSED'],
    ['MODEL_TIMEOUT', 'PROVIDER_DEGRADED'],
    ['CIRCUIT_OPEN', 'PROVIDER_DEGRADED'],
    ['ASK_R2_DISABLED', 'CAPABILITY_UNAVAILABLE'],
    ['ASK_PUBLIC_COMPUTE_DISABLED', 'CAPABILITY_UNAVAILABLE'],
    ['EXECUTION_FAILED', 'EXECUTION_FAILED'],
    ['QUOTE_EXPIRED', 'EXECUTION_FAILED'],
  ])('%s → %s', (code, kind) => {
    expect(failureKindOf(code)).toBe(kind);
    expect(generator.project(released(code))).toMatchObject({ outcome: 'FAILED', failureKind: kind, failureCode: code, operationId: 'op-2' });
  });
});

describe('a completed governed run → a Brief conclusion with the Ask shapes', () => {
  it.each([
    ['CURRENT_REPORTING', 'READY'],
    ['CURRENTLY_VERIFIED', 'READY'],
    ['PARTIAL', 'PARTIAL'],
    ['INSUFFICIENT', 'INSUFFICIENT'],
  ])('%s → %s, blocks/evidence/intelligence from the briefing snapshot', (answer, state) => {
    const out = generator.project(completed(r2(answer)));
    expect(out).toMatchObject({ outcome: 'CONCLUDED', state, operationId: 'op-1' });
    if (out.outcome !== 'CONCLUDED') throw new Error('unreachable');
    expect(out.blocks).toMatchObject({ schema: 'briefing-blocks/1', intelligence: { considered: ['CONFLICT'] } });
    expect(out.evidenceRefs).toEqual([expect.objectContaining({ id: 'a1', host: 'one.example' })]);
    expect(JSON.stringify(out.evidenceRefs)).not.toMatch(/summary|body|text/); /* references only */
  });

  it('completed with no sourced answer → INSUFFICIENT (a conclusion), not a failure', () => {
    expect(generator.project(completed(r2('CURRENT_REPORTING', null)))).toMatchObject({ outcome: 'CONCLUDED', state: 'INSUFFICIENT', coverageGaps: ['NO_SOURCED_ANSWER'] });
  });

  it('CAPABILITY_UNAVAILABLE / CLARIFICATION answers are failures, not Briefs', () => {
    expect(generator.project(completed(r2('CAPABILITY_UNAVAILABLE')))).toMatchObject({ outcome: 'FAILED', failureKind: 'CAPABILITY_UNAVAILABLE' });
    expect(generator.project(completed(r2('CLARIFICATION_REQUIRED')))).toMatchObject({ outcome: 'FAILED', failureKind: 'EXECUTION_FAILED' });
  });

  it('Ask disabled → CAPABILITY_UNAVAILABLE without touching Ask', async () => {
    const off = new AskGovernedStoryBriefGenerator({} as never, { get: () => undefined } as never);
    expect(off.available).toBe(false);
    await expect(off.generate({} as never, { userId: 'u' })).resolves.toMatchObject({ outcome: 'FAILED', failureKind: 'CAPABILITY_UNAVAILABLE' });
  });
});
