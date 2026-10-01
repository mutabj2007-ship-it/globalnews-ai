import { ASK_ANSWER_STATES } from '@globalnews-ai/shared';
import { routeAskR2 } from './ask-r2-route';
import {
  answerStateBeforeExecution,
  deriveAnswerState,
  referenceAdmissibleFor,
} from './answer-state';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import type { RoutingPlan } from './frozen-c/src/ports';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — §7 answer states, derived from REAL frozen
 * C plans produced by the integrated route (not hand-built plan fixtures).
 */

const deps = { specialistRegistry: specialistRegistryFixture };
const planFor = (
  q: string,
  lg: 'en' | 'pl' = 'en',
  ctx = {},
  capabilities?: Record<string, string>,
): RoutingPlan =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lg,
      normalizationLanguage: lg,
      displayLanguage: lg,
      origin: 'ASK',
    },
    ctx,
    capabilities === undefined ? deps : ({ ...deps, capabilities } as never),
  ).plan;

describe('§7 — the answer states', () => {
  /*
    INTENTIONALLY SUPERSEDED — ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1: the seven §7
    states plus ONE additive state, RETAINED_RECORD (a governed retained record, or its stated
    absence, answered with zero model calls). The seven keep their order and meaning; the §7
    derivation (`deriveAnswerState`) never produces RETAINED_RECORD — only the adapter's
    deterministic governed-record executor does.
  */
  it('exactly the seven the contract names, plus the additive RETAINED_RECORD and COMPUTED_RESULT', () => {
    expect([...ASK_ANSWER_STATES]).toEqual([
      'REFERENCE_BACKGROUND',
      'CURRENTLY_VERIFIED',
      'CURRENT_REPORTING',
      'PARTIAL',
      'INSUFFICIENT',
      'CLARIFICATION_REQUIRED',
      'CAPABILITY_UNAVAILABLE',
      'RETAINED_RECORD',
      /* ASK TECHNICAL / SCIENTIFIC REASONING R1 — deterministic computation, zero AI. */
      'COMPUTED_RESULT',
    ]);
  });
});

describe('§7 — planning inability is not automatically INSUFFICIENT', () => {
  it.each([
    ['What is inflation?', 'en', 'REFERENCE_BACKGROUND'],
    ['Czym jest inflacja?', 'pl', 'REFERENCE_BACKGROUND'],
    ['Compare them.', 'en', 'CLARIFICATION_REQUIRED'],
    ['Porównaj je.', 'pl', 'CLARIFICATION_REQUIRED'],
    ['What happened yesterday in Nairobi?', 'en', 'CLARIFICATION_REQUIRED'],
    ['What were the results in 2026?', 'en', 'CAPABILITY_UNAVAILABLE'],
  ] as const)('%s → %s, decided from the plan alone', (q, lg, state) => {
    const decided = answerStateBeforeExecution(planFor(q, lg));
    expect(decided?.state).toBe(state);
    expect(decided?.state).not.toBe('INSUFFICIENT');
  });

  it('clarification needs no evidence: deriveAnswerState answers it with nothing obtained', () => {
    expect(deriveAnswerState(planFor('Compare them.')).state).toBe('CLARIFICATION_REQUIRED');
  });

  it('an unread language is a clarification, never an insufficient answer', () => {
    const plan = routeAskR2(
      {
        originalQuestion: 'Nini kinaendelea?',
        sourceLanguage: 'sw',
        normalizationLanguage: 'sw',
        displayLanguage: 'en',
        origin: 'ASK',
      },
      {},
      deps,
    ).plan;
    expect(deriveAnswerState(plan).state).toBe('CLARIFICATION_REQUIRED');
  });
});

describe('§7 — after execution', () => {
  const news = planFor('What is happening in Kenya?');

  it('required reporting obtained → CURRENT_REPORTING; none → INSUFFICIENT', () => {
    expect(deriveAnswerState(news, { items: { REPORTING: 3 } }).state).toBe('CURRENT_REPORTING');
    expect(deriveAnswerState(news, { items: {} })).toEqual({
      state: 'INSUFFICIENT',
      basis: 'NO_REQUIRED_EVIDENCE_OBTAINED',
      missingRoles: ['REPORTING'],
    });
  });

  it('REFERENCE never stands in for a required role', () => {
    expect(deriveAnswerState(news, { items: { REFERENCE: 5 } }).state).toBe('INSUFFICIENT');
  });

  it('Reference-only cannot produce Currently Verified — even with the official leg bound', () => {
    const office = planFor(
      'Who is the current president of Kenya?',
      'en',
      {},
      { OFFICIAL_ARTIFACT: 'BOUND' },
    );
    expect(office.verification?.admissibleOutcomes).toContain('CURRENTLY_VERIFIED');
    expect(
      deriveAnswerState(office, {
        items: { REFERENCE: 3, REPORTING: 1 },
        verification: 'CURRENTLY_VERIFIED',
      }).state,
    ).toBe('INSUFFICIENT');
    expect(
      deriveAnswerState(office, {
        items: { OFFICIAL: 1, REPORTING: 1 },
        verification: 'CURRENTLY_VERIFIED',
      }).state,
    ).toBe('CURRENTLY_VERIFIED');
  });

  it('today (official unbound) the strongest current-status answer is PARTIAL, with two fresh sources', () => {
    const office = planFor('Who is the current president of Kenya?');
    expect(office.verification?.admissibleOutcomes).not.toContain('CURRENTLY_VERIFIED');
    expect(
      deriveAnswerState(office, {
        items: { REPORTING: 2 },
        verification: 'CURRENT_REPORTING_PARTIAL_VERIFICATION',
      }).state,
    ).toBe('PARTIAL');
    expect(
      deriveAnswerState(office, {
        items: { REPORTING: 1 },
        verification: 'CURRENT_REPORTING_PARTIAL_VERIFICATION',
      }).state,
    ).toBe('INSUFFICIENT');
    expect(
      deriveAnswerState(office, { items: { OFFICIAL: 1 }, verification: 'CURRENTLY_VERIFIED' })
        .state,
    ).toBe('INSUFFICIENT');
  });

  it('model memory is non-citable background: a no-evidence plan is REFERENCE_BACKGROUND and says so', () => {
    const plan = planFor('What is photosynthesis?');
    expect(deriveAnswerState(plan).state).toBe('REFERENCE_BACKGROUND');
    expect(plan.disclosures).toContain('REFERENCE_BACKGROUND_NOT_CITABLE');
    expect(plan.modelPriorCitable).toBe(false);
  });
});

describe('§7 — execution that produced nothing', () => {
  /* GATE H — superseded pin. Gate D had this INSUFFICIENT / NO_ANSWER_PRODUCED; Main R1.1
     MC-033/MC-041 rule that an absence-of-reporting claim is the false statement for a
     reference question, and that the honest outcome names REFERENCE as the missing class. */
  it.each([
    ['What is inflation?', 'en'],
    ['Czym jest inflacja?', 'pl'],
    ['Who was Hitler?', 'en'],
  ] as const)(
    'a reference plan that produced no answer is CAPABILITY_UNAVAILABLE naming REFERENCE: %s',
    (q, lg) => {
      expect(deriveAnswerState(planFor(q, lg), { items: {}, producedAnswer: false })).toEqual({
        state: 'CAPABILITY_UNAVAILABLE',
        basis: 'REFERENCE_UNAVAILABLE',
        missingRoles: ['REFERENCE'],
      });
    },
  );

  it('a reporting plan that produced nothing stays INSUFFICIENT and names the missing role', () => {
    expect(
      deriveAnswerState(planFor('What is happening in Kenya?'), {
        items: {},
        producedAnswer: false,
      }),
    ).toEqual({ state: 'INSUFFICIENT', basis: 'NO_ANSWER_PRODUCED', missingRoles: ['REPORTING'] });
  });

  it('a clarification plan is unaffected (nothing was meant to run)', () => {
    expect(
      deriveAnswerState(planFor('Compare them.'), { items: {}, producedAnswer: false }).state,
    ).toBe('CLARIFICATION_REQUIRED');
  });
});

describe('volatility guard — where a REFERENCE item may be used at all', () => {
  it.each([
    ['What is inflation?', true],
    ['Czym jest fotosynteza?', true],
    ['Who is the current president of Kenya?', false],
    ['What is happening in Kenya?', false],
    ['What happened yesterday in Nairobi?', false],
  ] as const)('%s → %s', (q, admissible) => {
    expect(referenceAdmissibleFor(planFor(q, /[ąęłńóśźż]|Czym/.test(q) ? 'pl' : 'en'))).toBe(
      admissible,
    );
  });
});
