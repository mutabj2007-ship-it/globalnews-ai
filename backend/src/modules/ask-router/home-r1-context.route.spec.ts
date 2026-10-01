import { routeAskR2, missingSeams, type AskRouteContext, type AskR2Route } from './ask-r2-route';
import { requiredRolesOf } from './answer-state';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { EXECUTOR_SUPPLIES } from '../ask-v2/ask-r2-execution.adapter';

/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — what frozen C (untouched) makes of the
 * server-resolved context the embedded Ask and My Intelligence now send. Measured, not
 * assumed: a resolved selection / story anchor / map country must route to a plan the ONE
 * executor can supply (REPORTING), with no missing seam — otherwise the convergence would
 * silently degrade every contextual question.
 */
const deps = { specialistRegistry: specialistRegistryFixture };
const REF = (n: number) => n.toString(16).padStart(64, '0');

function route(question: string, ctx: Partial<AskRouteContext>, language: 'en' | 'pl' = 'en'): AskR2Route {
  return routeAskR2(
    { originalQuestion: question, sourceLanguage: language, normalizationLanguage: language, displayLanguage: language, origin: 'ASK' },
    { computeConsent: 'GRANTED', requestInstant: '2026-10-01T10:00:00Z', identityVerified: true, ...ctx },
    deps,
  );
}

const executable = (r: AskR2Route) => {
  expect(missingSeams(r)).toEqual([]);
  expect(r.plan.terminalState).toBe('EXECUTABLE');
  for (const role of requiredRolesOf(r.plan)) expect(EXECUTOR_SUPPLIES.has(role)).toBe(true);
};

describe('Stage A context routing through frozen C', () => {
  it.each([
    ['en', 'What connects these stories?'],
    ['en', 'What do these stories say about regional trade?'],
    ['pl', 'Co łączy te historie?'],
  ] as const)('a resolved ASK_SELECTED selection (%s) is scoped by SELECTION and executable: %s', (language, q) => {
    const r = route(q, { articleRefs: [REF(1), REF(2)], selectionAction: 'ASK_SELECTED' }, language);
    expect(r.plan.scopedBy).toBe('SELECTION');
    executable(r);
  });

  it('a selection below the action minimum asks the reader (no execution)', () => {
    const r = route('Compare these stories', { articleRefs: [REF(1)], selectionAction: 'COMPARE' });
    expect(r.plan.terminalState).toBe('CLARIFICATION_REQUIRED');
    expect(r.plan.refusals).toContain('SELECTION_BELOW_MINIMUM');
  });

  it('a resolved story anchor carries its country as the anchor, executable', () => {
    const r = route('What does this mean for regional trade?', {
      hasResolvedArticleAnchor: true,
      storyAnchorCountry: 'KEN',
    });
    executable(r);
  });

  it('a map country is inherited context, not compulsory scope', () => {
    const r = route('What is happening with inflation?', { mapContextCountry: 'RWA' });
    expect(missingSeams(r)).toEqual([]);
  });
});
