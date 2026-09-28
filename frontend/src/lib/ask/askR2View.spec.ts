import type { AskR2Payload, AskAnswerState } from '@/lib/api/askV2Api';
import { askR2PayloadOf } from '@/lib/api/askV2Api';
import { askR2Strings } from './askR2Strings';
import { askR2View, formatUtc } from './askR2View';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G — D25 02 engine-state matrix and 05 chip rules,
 * decided by the pure view model (the component only draws what this returns).
 */

function payload(state: AskAnswerState, over: Partial<AskR2Payload> = {}): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      scopedBy: 'TYPED_GEOGRAPHY',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state, basis: 'x', missingRoles: [] },
    aiExecuted: true,
    modelPriorCitable: false,
    analysis: {
      analysis: { generatedAt: '2026-09-28T04:40:00Z' },
      articles: [{}, {}],
      retrievalContext: { newestArticlePublishedAt: '2026-09-28T04:20:00Z' },
    } as never,
    ...over,
  };
}
const EN = askR2Strings('en');
const PL = askR2Strings('pl');

describe('D25 02 — badge, surface and freshness per state', () => {
  it.each([
    [
      'REFERENCE_BACKGROUND',
      'REFERENCE BACKGROUND',
      'reference',
      /* the fixture carries 2 retrieved sources: background drawn from them says so */
      'Background: reference · checked 28 Sep 2026, 04:40 UTC · 2 sources',
    ],
    [
      'CURRENTLY_VERIFIED',
      'CURRENTLY VERIFIED',
      'verified',
      'Checked 28 Sep 2026, 04:40 UTC · 2 sources',
    ],
    [
      'CURRENT_REPORTING',
      'CURRENT INTELLIGENCE',
      'current',
      'Retained reporting to 28 Sep 2026, 04:20 UTC · 2 sources',
    ],
    [
      'CLARIFICATION_REQUIRED',
      'CLARIFICATION REQUIRED',
      'clarification',
      'One question before searching · nothing has run',
    ],
    [
      'INSUFFICIENT',
      'INSUFFICIENT EVIDENCE',
      'insufficient',
      'Checked 28 Sep 2026, 04:40 UTC · 0 matching reports',
    ],
    ['PARTIAL', 'PARTIAL EVIDENCE', 'partial', 'Checked 28 Sep 2026, 04:40 UTC · 2 sources'],
  ] as const)('%s → %s', (state, badge, tone, freshness) => {
    const v = askR2View(payload(state), EN, 'en');
    expect([v.badgeText, v.tone, v.freshness]).toEqual([badge, tone, freshness]);
  });

  it('PL copy is D25’s own', () => {
    const v = askR2View(payload('CURRENTLY_VERIFIED'), PL, 'pl');
    expect(v.badgeText).toBe('ZWERYFIKOWANE AKTUALNIE');
    expect(v.freshness).toBe('Sprawdzono 28 wrz 2026, 04:40 UTC · 2 źródła');
    expect(PL.sourcesLabel(5)).toBe('5 źródeł');
    expect(PL.sourcesLabel(22)).toBe('22 źródła');
    expect(PL.sourcesLabel(12)).toBe('12 źródeł');
  });
});

describe('D25 06 — Reference background never looks like Currently verified', () => {
  it('model-only reference: not citable, "not checked", its own tone, no handoff', () => {
    const ref = askR2View(payload('REFERENCE_BACKGROUND', { analysis: null }), EN, 'en');
    const ver = askR2View(payload('CURRENTLY_VERIFIED'), EN, 'en');
    expect(ref.citable).toBe(false);
    expect(ref.freshness).toBe('Stable general knowledge · not checked against current sources');
    expect(ref.tone).not.toBe(ver.tone);
    expect(ref.handoffs).toEqual({ openFull: false, runDeeper: false });
  });

  it('reference drawn from retrieved sources cites them and says when (D25 mixed case) — never "no citations"', () => {
    const ref = askR2View(payload('REFERENCE_BACKGROUND'), EN, 'en');
    expect(ref.citable).toBe(true);
    expect(ref.tone).toBe('reference');
    expect(askR2View(payload('REFERENCE_BACKGROUND'), PL, 'pl').freshness).toBe(
      'Tło: wiedza ogólna · sprawdzono 28 wrz 2026, 04:40 UTC · 2 źródła',
    );
  });
});

describe('D25 10 — handoffs exist only where D25 places them', () => {
  it.each([
    ['CURRENTLY_VERIFIED', true],
    ['CURRENT_REPORTING', true],
    ['PARTIAL', true],
    ['REFERENCE_BACKGROUND', false],
    ['CLARIFICATION_REQUIRED', false],
    ['INSUFFICIENT', false],
    ['CAPABILITY_UNAVAILABLE', false],
  ] as const)('%s → %s', (state, offered) => {
    expect(askR2View(payload(state), EN, 'en').handoffs).toEqual({
      openFull: offered,
      runDeeper: offered,
    });
  });
});

describe('D25 05 — chips from the plan only, kept scope visible', () => {
  it('ordered as the plan sends them; a kept constraint is flagged and noted', () => {
    const v = askR2View(
      payload('INSUFFICIENT', {
        chips: {
          kind: 'SCOPED',
          chips: [
            { kind: 'TOPIC', value: 'entertainment', source: 'READER_CATEGORY', applied: false },
            { kind: 'GEOGRAPHY', value: 'RWA', source: 'TYPED_GEOGRAPHY', applied: true },
            { kind: 'TIME', value: 'this week', source: 'STATED_PERIOD', applied: false },
          ],
        },
      }),
      EN,
      'en',
      (iso) => (iso === 'RWA' ? 'Rwanda' : iso),
    );
    expect(v.chips.items.map((c) => c.label)).toEqual(['Entertainment', 'Rwanda', 'This week']);
    expect(v.chips.items.map((c) => c.kept)).toEqual([true, false, true]);
    expect(v.chips.note).toBe('Kept as asked');
  });

  it('no scope / pending have D25’s lines', () => {
    expect(askR2View(payload('REFERENCE_BACKGROUND'), EN, 'en').chips.note).toBe(
      'General question · no scope applied',
    );
    expect(
      askR2View(payload('CLARIFICATION_REQUIRED', { chips: { kind: 'PENDING' } }), PL, 'pl').chips
        .note,
    ).toBe('Zakres zależy od Twojego wyboru');
  });
});

describe('freshness time when no analysis ran', () => {
  it('INSUFFICIENT with no analysis uses the server checkedAt — never a dash', () => {
    const v = askR2View(
      payload('INSUFFICIENT', { analysis: null, checkedAt: '2026-09-28T04:52:00Z' }),
      EN,
      'en',
    );
    expect(v.freshness).toBe('Checked 28 Sep 2026, 04:52 UTC · 0 matching reports');
  });
});

describe('payload narrowing', () => {
  it('only an ask-r2-result/1 payload is read', () => {
    expect(askR2PayloadOf({ result: { payload: payload('PARTIAL') } } as never)?.answer.state).toBe(
      'PARTIAL',
    );
    expect(askR2PayloadOf({ result: { payload: { answer: 'legacy' } } } as never)).toBeNull();
    expect(askR2PayloadOf(null)).toBeNull();
  });

  it('formatUtc refuses an unparseable time rather than inventing one', () => {
    expect(formatUtc('not-a-date', 'en')).toBeNull();
    expect(formatUtc(undefined, 'en')).toBeNull();
  });
});

describe('GATE H — typed refusals say what is missing; executor clarifications offer the choices', () => {
  it.each([
    ['REFERENCE_UNAVAILABLE', /Reference knowledge is not connected/],
    ['EXECUTOR_NOT_WIRED', /needs a source Ask cannot read yet/],
    ['PLAN_IDENTITY_REQUIRED', /Sign in to ask about your own saved stories/],
    ['PLAN_CAPABILITY_UNAVAILABLE', /needs a capability Ask does not have/],
  ])('%s is named, never "Ask is unavailable" and never "no reporting"', (basis, text) => {
    const v = askR2View(
      payload('CAPABILITY_UNAVAILABLE', {
        answer: { state: 'CAPABILITY_UNAVAILABLE', basis, missingRoles: [] },
        analysis: null,
      }),
      EN,
      'en',
    );
    expect(v.unavailableText).toMatch(text);
    expect(v.unavailableText).not.toBe(EN.unavailable);
    expect(v.freshness).toBe(EN.noAnswer);
    expect(`${v.unavailableText} ${v.freshness}`).not.toMatch(
      /matching report|no reporting found/i,
    );
    expect(v.citable).toBe(false);
    expect(v.handoffs).toEqual({ openFull: false, runDeeper: false });
  });

  it('an unknown basis keeps the generic "Ask is unavailable" copy', () => {
    const v = askR2View(
      payload('CAPABILITY_UNAVAILABLE', {
        answer: { state: 'CAPABILITY_UNAVAILABLE', basis: 'SOMETHING_ELSE', missingRoles: [] },
        analysis: null,
      }),
      EN,
      'en',
    );
    expect(v.unavailableText).toBe(EN.unavailable);
  });

  it('PL typed refusals are Polish', () => {
    const v = askR2View(
      payload('CAPABILITY_UNAVAILABLE', {
        answer: {
          state: 'CAPABILITY_UNAVAILABLE',
          basis: 'REFERENCE_UNAVAILABLE',
          missingRoles: ['REFERENCE'],
        },
        analysis: null,
      }),
      PL,
      'pl',
    );
    expect(v.unavailableText).toMatch(/Wiedza referencyjna/);
    expect(v.freshness).toBe(PL.noAnswer);
  });

  it('an executor clarification (Congo) localises its candidates and says no AI was used', () => {
    const names: Record<string, string> = { COD: 'DR Congo', COG: 'Republic of the Congo' };
    const v = askR2View(
      payload('CLARIFICATION_REQUIRED', {
        answer: {
          state: 'CLARIFICATION_REQUIRED',
          basis: 'LANDED_AMBIGUOUS_COUNTRY',
          missingRoles: [],
          candidates: ['COD', 'COG'],
        },
        analysis: null,
      }),
      EN,
      'en',
      (iso3) => names[iso3] ?? iso3,
    );
    expect(v.clarification).toEqual({
      byExecutor: true,
      candidates: ['DR Congo', 'Republic of the Congo'],
    });
    expect(v.freshness).toBe(EN.askedBeforeAnswering);
  });

  it('a plan clarification keeps D25’s "nothing has run"', () => {
    const v = askR2View(
      payload('CLARIFICATION_REQUIRED', {
        answer: { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_CLARIFICATION', missingRoles: [] },
        analysis: null,
      }),
      EN,
      'en',
    );
    expect(v.clarification).toEqual({ byExecutor: false, candidates: [] });
    expect(v.freshness).toBe(EN.freshness.nothingRan);
  });
});
