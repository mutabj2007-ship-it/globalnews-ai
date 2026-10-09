import type { AskR2Payload, AskAnswerState } from '@/lib/api/askV2Api';
import { askR2PayloadOf } from '@/lib/api/askV2Api';
import { askR2Strings } from './askR2Strings';
import { askR2View, failedTurnCopy, formatUtc } from './askR2View';

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
      /* PUBLIC BETA HARDENING R1C — no retained basis in this fixture: it was checked, not
         retained (retained wording is proven in askLiveRetainedProvenance.spec.ts). */
      'Checked 28 Sep 2026, 04:40 UTC · 2 sources',
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
    ['REFERENCE_UNAVAILABLE', /not answered from memory/],
    ['EXECUTOR_NOT_WIRED', /needs a source Ask cannot read yet/],
    ['PLAN_IDENTITY_REQUIRED', /^Sign in to use your saved information\.$/],
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
    expect(v.unavailableText).toMatch(/nie odpowiedziano z pamięci/);
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
    /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — no question given here, so no draft choices. */
    expect(v.clarification).toEqual({
      byExecutor: true,
      candidates: ['DR Congo', 'Republic of the Congo'],
      lead: null,
      suggestion: null,
      choices: [],
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
    /*
      ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — the freshness line keeps D25's "nothing has run",
      but the body is never only that: with no known code the reader is asked the fallback.
    */
    expect(v.clarification).toEqual({
      byExecutor: false,
      candidates: [],
      lead: EN.clarify.fallback,
      suggestion: null,
      choices: [],
    });
    expect(v.freshness).toBe(EN.freshness.nothingRan);
  });
});

describe('ALPHA ENABLEMENT R1 — MC-070: a continuation with nothing to continue', () => {
  const names: Record<string, string> = { KEN: 'Kenya' };
  const plNames: Record<string, string> = { KEN: 'Kenia' };
  const noPrior = (lang: 'en' | 'pl') =>
    askR2View(
      payload('CLARIFICATION_REQUIRED', {
        answer: {
          state: 'CLARIFICATION_REQUIRED',
          basis: 'NO_PRIOR_SUBJECT',
          missingRoles: [],
          candidates: ['KEN'],
        },
        analysis: null,
      }),
      lang === 'en' ? EN : PL,
      lang,
      (iso3) => (lang === 'en' ? names : plNames)[iso3] ?? iso3,
    );

  it('EN: asks what to know about this place and never claims there is no earlier question — no choice list', () => {
    const v = noPrior('en');
    expect(v.clarification.lead).toBe(
      "What would you like to know about this place? An earlier question isn't carried over to a new place on its own.",
    );
    expect(v.clarification.lead).not.toMatch(/no earlier question/i);
    expect(v.clarification.candidates).toEqual([]);
    expect(v.freshness).toBe(EN.freshness.nothingRan);
    expect(v.handoffs).toEqual({ openFull: false, runDeeper: false });
    expect(v.citable).toBe(false);
  });

  it('PL: the same, in Polish', () => {
    const v = noPrior('pl');
    expect(v.clarification.lead).toBe(
      'Co chcesz wiedzieć o tym miejscu? Wcześniejsze pytanie nie przechodzi samo na nowe miejsce.',
    );
    expect(v.freshness).toBe(PL.freshness.nothingRan);
  });
});

describe('ALPHA ENABLEMENT R1 — MC-055: the reader’s own library, worded by the server’s scope', () => {
  type Scope = 'SAVED_STORIES' | 'INTERESTS' | null;
  const personal = (
    lang: 'en' | 'pl',
    basis: string,
    missingRoles: string[],
    personalScope: Scope,
  ) => {
    const base = payload('CAPABILITY_UNAVAILABLE');
    return askR2View(
      payload('CAPABILITY_UNAVAILABLE', {
        route: { ...base.route, personalScope },
        answer: { state: 'CAPABILITY_UNAVAILABLE', basis, missingRoles },
        analysis: null,
      }),
      lang === 'en' ? EN : PL,
      lang,
    ).unavailableText;
  };

  it.each([
    ['en', 'SAVED_STORIES', "Comparing your saved stories isn't available yet."],
    ['pl', 'SAVED_STORIES', 'Porównywanie zapisanych artykułów nie jest jeszcze dostępne.'],
    ['en', 'INTERESTS', "Using your interests isn't available yet."],
    ['pl', 'INTERESTS', 'Korzystanie z zainteresowań nie jest jeszcze dostępne.'],
    ['en', null, "Your saved information isn't available here yet."],
    ['pl', null, 'Twoje zapisane informacje nie są jeszcze tutaj dostępne.'],
  ] as const)('signed in, not wired · %s %s', (lang, scope, text) => {
    expect(personal(lang, 'EXECUTOR_NOT_WIRED', ['PERSONAL'], scope)).toBe(text);
  });

  it.each([
    ['en', 'SAVED_STORIES', 'Sign in to compare your saved stories.'],
    ['pl', 'SAVED_STORIES', 'Zaloguj się, aby porównać zapisane artykuły.'],
    ['en', 'INTERESTS', 'Sign in to use your interests.'],
    ['pl', 'INTERESTS', 'Zaloguj się, aby korzystać ze swoich zainteresowań.'],
    ['en', null, 'Sign in to use your saved information.'],
    ['pl', null, 'Zaloguj się, aby korzystać z zapisanych informacji.'],
  ] as const)('signed out · %s %s', (lang, scope, text) => {
    expect(personal(lang, 'PLAN_IDENTITY_REQUIRED', [], scope)).toBe(text);
  });

  it('an interests question never receives the saved-stories words', () => {
    for (const lang of ['en', 'pl'] as const)
      for (const [basis, roles] of [
        ['EXECUTOR_NOT_WIRED', ['PERSONAL']],
        ['PLAN_IDENTITY_REQUIRED', []],
      ] as const)
        expect(personal(lang, basis, [...roles], 'INTERESTS')).not.toMatch(
          /saved stories|zapisan\p{L}* artykuł/u,
        );
  });

  it('never the diagnostic basis; another unwired executor keeps its own sentence', () => {
    expect(personal('en', 'EXECUTOR_NOT_WIRED', ['PERSONAL'], 'SAVED_STORIES')).not.toMatch(
      /EXECUTOR_NOT_WIRED/,
    );
    expect(personal('en', 'EXECUTOR_NOT_WIRED', ['OFFICIAL'], null)).toBe(
      EN.unavailableBecause.EXECUTOR_NOT_WIRED,
    );
  });
});

describe('ASK FIRST-ANSWER RETRIEVAL R3 — a refused search is "limited", never "0 matching reports"', () => {
  const empty = (outcome?: string, dataMode = 'live') =>
    payload('INSUFFICIENT', {
      aiExecuted: false,
      analysis: {
        analysis: null,
        articles: [],
        retrievalContext: { dataMode, ...(outcome ? { outcome } : {}) },
      } as never,
    });

  it.each(['PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE'])('%s → limited (EN/PL)', (outcome) => {
    const en = askR2View(empty(outcome), EN, 'en');
    expect(en.searchLimited).toBe(true);
    expect(en.freshness).toMatch(/^Checked .* · a news source was temporarily unavailable/);
    const pl = askR2View(empty(outcome), PL, 'pl');
    expect(pl.freshness).toMatch(/^Sprawdzono .* · źródło wiadomości było chwilowo niedostępne/);
  });

  it('an answered, empty search keeps the honest "0 matching reports"', () => {
    const v = askR2View(empty('NO_RELEVANT_EVIDENCE'), EN, 'en');
    expect(v.searchLimited).toBe(false);
    expect(v.freshness).toMatch(/0 matching reports$/);
  });

  it('no outcome recorded and a live answer → not limited (no claim without the typed fact)', () => {
    expect(askR2View(empty(undefined), EN, 'en').searchLimited).toBe(false);
  });

  it('an answer that stands on reachable reporting while a source failed is flagged, still citable', () => {
    const v = askR2View(
      payload('CURRENT_REPORTING', {
        analysis: {
          analysis: { generatedAt: '2026-09-28T04:40:00Z' },
          articles: [{}],
          retrievalContext: {
            dataMode: 'cached',
            fallbackReason: 'provider-error',
            outcome: 'RETAINED_ONLY',
          },
        } as never,
      }),
      EN,
      'en',
    );
    expect(v.searchLimited).toBe(true);
    expect(EN.limitedNote).toMatch(/temporarily unavailable/);
  });
});

describe('BETA-ASK-005 — the bounded publication window is visible', () => {
  const windowed = (state: AskAnswerState) =>
    payload(state, {
      chips: {
        kind: 'SCOPED',
        chips: [{ kind: 'TIME', value: 'last 7 days', source: 'REPORTING_WINDOW', applied: true }],
      },
      analysis: {
        analysis: { generatedAt: '2026-10-01T12:00:00Z' },
        articles: [{}, {}],
        retrievalContext: {
          newestArticlePublishedAt: '2026-09-30T08:00:00Z',
          reportingWindow: {
            statedPeriod: 'last 7 days',
            from: '2026-09-24T12:00:00.000Z',
            to: '2026-10-01T12:00:00.000Z',
            basis: 'PUBLICATION_TIME',
            excludedOutsideWindow: 3,
          },
        },
      } as never,
    });

  it('the answer states the exact window, and the chip is applied (not "kept as asked")', () => {
    const v = askR2View(windowed('CURRENT_REPORTING'), EN, 'en');
    expect(v.freshness).toContain(
      'Reporting published 24 Sep 2026, 12:00 UTC – 1 Oct 2026, 12:00 UTC',
    );
    expect(JSON.stringify(v)).toContain('Last 7 days');
    expect(v.clarification.lead).toBeNull();
  });

  it('an insufficient windowed answer still names the window it searched', () => {
    const v = askR2View(windowed('INSUFFICIENT'), EN, 'en');
    expect(v.freshness).toContain('Reporting published 24 Sep 2026');
  });

  it('Polish wording', () => {
    const v = askR2View(windowed('CURRENT_REPORTING'), PL, 'pl');
    expect(v.freshness).toContain('Doniesienia opublikowane 24 wrz 2026, 12:00 UTC');
  });
});

describe('ASK TRUTHFUL RETRIEVAL R2A — what was checked is shown, never a denial on absence', () => {
  const withRetrieval = (state: AskAnswerState, retrievalContext: Record<string, unknown>) =>
    payload(state, {
      analysis: {
        analysis: null,
        articles: [],
        retrievalContext: { dataMode: 'live', providers: ['gnews'], ...retrievalContext },
      } as never,
    });

  it('coverage incomplete: the exact sentences, and the failed lane named', () => {
    const v = askR2View(
      withRetrieval('INSUFFICIENT', {
        verificationNotice: 'COVERAGE_INCOMPLETE',
        retrievalTrace: {
          queryVariants: ['Dubai Israel flight'],
          timeWindow: null,
          languages: ['reader'],
          lanesAttempted: ['gnews', 'rss-feeds'],
          lanesSucceeded: ['rss-feeds'],
          lanesUnavailable: [{ lane: 'gnews', reason: 'rate-limited' }],
          candidatesSeen: 0,
          candidatesAdmitted: 0,
          independentClusters: 0,
        },
        claimAssessments: [
          {
            id: 'occurrence',
            type: 'OCCURRENCE',
            text: 'An aviation incident occurred',
            state: 'COVERAGE_INCOMPLETE',
            supportingArticleIds: [],
            independentFamilies: 0,
            officialFamily: false,
            contradictingArticleIds: [],
          },
        ],
      }),
      EN,
      'en',
    );
    expect(v.verification?.notice).toBe(
      'I could not verify this claim from the sources successfully checked. Verification was incomplete because some source lanes were unavailable.',
    );
    expect(v.verification?.lanes).toEqual([
      { label: 'Publisher feeds', ok: true, status: 'checked' },
      { label: 'GNews', ok: false, status: 'unavailable (rate limited)' },
    ]);
    expect(v.verification?.claims).toEqual([
      {
        text: 'An aviation incident occurred',
        state: 'COVERAGE_INCOMPLETE',
        label: 'Not verified — coverage incomplete',
      },
    ]);
  });

  /* CTO ALPHA CONTENT-INTEGRITY R1 (C) — amended: the reader asked an OPEN question (no claim was
     assessed), so the notice never calls it "this claim"; the INSUFFICIENT answer state says nothing
     matching was found. Still never a denial. With a claim, the original sentence stands (below). */
  it('complete coverage that found nothing for an OPEN question: no "this claim", never "did not happen"', () => {
    const v = askR2View(
      withRetrieval('INSUFFICIENT', { verificationNotice: 'NOT_VERIFIED' }),
      EN,
      'en',
    );
    expect(v.verification?.notice ?? null).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/this claim/i);
    expect(JSON.stringify(v)).not.toMatch(/no evidence of|did not (happen|occur)/i);
  });

  it('an OPEN question whose search was incomplete: the coverage sentence alone, lanes named', () => {
    const v = askR2View(
      withRetrieval('INSUFFICIENT', {
        verificationNotice: 'COVERAGE_INCOMPLETE',
        retrievalTrace: {
          queryVariants: [],
          timeWindow: null,
          languages: ['en'],
          lanesAttempted: ['gnews', 'gdelt-doc', 'rss-feeds'],
          lanesSucceeded: ['rss-feeds'],
          lanesUnavailable: [
            { lane: 'gnews', reason: 'rate-limited' },
            { lane: 'gdelt-doc', reason: 'rate-limited' },
          ],
          candidatesSeen: 0,
          candidatesAdmitted: 0,
          independentClusters: 0,
        },
      }),
      EN,
      'en',
    );
    expect(v.verification?.notice).toBe(
      'Verification was incomplete because some source lanes were unavailable.',
    );
    expect(v.verification?.lanes.map((l) => [l.label, l.ok])).toEqual([
      ['Publisher feeds', true],
      ['GNews', false],
      ['GDELT', false],
    ]);
  });

  it('a CLAIM that could not be verified keeps the claim sentence', () => {
    const v = askR2View(
      withRetrieval('INSUFFICIENT', {
        verificationNotice: 'NOT_VERIFIED',
        claimAssessments: [
          {
            id: 'occurrence',
            type: 'OCCURRENCE',
            text: 'A border closure occurred',
            state: 'NOT_VERIFIED',
            supportingArticleIds: [],
            independentFamilies: 0,
            officialFamily: false,
            contradictingArticleIds: [],
          },
        ],
      }),
      EN,
      'en',
    );
    expect(v.verification?.notice).toBe(
      'I could not verify this claim from the sources successfully checked.',
    );
  });

  it('an ordinary answer without server verification facts shows no panel', () => {
    expect(askR2View(payload('CURRENT_REPORTING'), EN, 'en').verification).toBeNull();
  });
});

describe('ASK TECHNICAL / SCIENTIFIC REASONING R1 — a deterministic computed answer', () => {
  it('is its own CALCULATION state: no sources, no AI, never "current" or "verified"', () => {
    const v = askR2View(
      payload('COMPUTED_RESULT', { aiExecuted: false, analysis: null }),
      EN,
      'en',
    );
    expect(v.badge).toBe('calc');
    expect(v.badgeText).toBe('CALCULATION');
    expect(v.freshness).toBe(
      'Calculated deterministically from the values in your question · no sources needed · no AI used',
    );
    expect(v.citable).toBe(false);
    expect(v.handoffs).toEqual({ openFull: false, runDeeper: false });
  });

  it('Polish wording', () => {
    const v = askR2View(
      payload('COMPUTED_RESULT', { aiExecuted: false, analysis: null }),
      PL,
      'pl',
    );
    expect(v.badgeText).toBe('OBLICZENIE');
  });
});

describe('CONVERSATIONAL INTELLIGENCE JOURNEY R3 — the two zero-compute asks', () => {
  const objective = (lang: 'en' | 'pl') =>
    askR2View(
      payload('CLARIFICATION_REQUIRED', {
        answer: {
          state: 'CLARIFICATION_REQUIRED',
          basis: 'DECISION_OBJECTIVE_MISSING',
          missingRoles: [],
          candidates: ['investment', 'logistics', 'market size', 'growth'],
        },
        analysis: null,
      }),
      lang === 'en' ? EN : PL,
      lang,
      (iso3) => `PLACE:${iso3}`,
      lang === 'en' ? 'Which economy is best?' : 'Która gospodarka jest najlepsza?',
    );

  it('EN: "best for what?" asks the objective and offers objectives (never places) as staged drafts', () => {
    const v = objective('en');
    expect(v.clarification.lead).toBe('Best for what objective? The answer depends on it.');
    expect(v.clarification.candidates).toEqual([
      'investment',
      'logistics',
      'market size',
      'growth',
    ]);
    expect(v.clarification.choices[1]).toEqual({
      label: 'logistics',
      question: 'Which economy is best — for logistics?',
    });
    expect(v.freshness).toBe(EN.freshness.nothingRan);
  });

  it('PL: the same, in Polish', () => {
    const v = objective('pl');
    expect(v.clarification.lead).toBe('Najlepsza pod jakim względem? Od tego zależy odpowiedź.');
    expect(v.clarification.choices[0].question).toBe(
      'Która gospodarka jest najlepsza — pod kątem: inwestycje?',
    );
  });

  it('a noted constraint says so and asks what to know next — no choice list', () => {
    const v = askR2View(
      payload('CLARIFICATION_REQUIRED', {
        answer: { state: 'CLARIFICATION_REQUIRED', basis: 'CONSTRAINT_NOTED', missingRoles: [] },
        analysis: null,
      }),
      EN,
      'en',
    );
    expect(v.clarification.lead).toBe(
      "Noted — I'll keep that for the rest of this conversation. What would you like to know?",
    );
    expect(v.clarification.candidates).toEqual([]);
  });
});

describe('CTO R3 LIVE DEFECT L-3 — a failed turn says only what is true', () => {
  it.each([
    [
      'NETWORK',
      'en',
      'The connection failed before Ask could start. Nothing was run. Your question is still available to retry.',
    ],
    [
      'NETWORK',
      'pl',
      'Połączenie przerwało się, zanim Zapytaj zdążyło zacząć. Nic nie zostało uruchomione. Możesz ponowić to pytanie.',
    ],
    ['UNAVAILABLE', 'en', 'Ask is unavailable right now. Nothing was run.'],
    ['BUDGET_REFUSED:account-day', 'en', EN.budgetRefused],
    ['SIGNED_OUT', 'en', 'Ask is unavailable right now. Nothing was run.'],
    ['ASK_CONTEXT_UNAVAILABLE', 'en', 'Ask is unavailable right now. Nothing was run.'],
    ['EXECUTION_FAILED', 'en', 'Ask is unavailable right now. Nothing was run.'],
    [undefined, 'en', 'Ask is unavailable right now. Nothing was run.'],
  ] as const)('%s (%s)', (failure, lang, copy) => {
    expect(failedTurnCopy(failure, lang === 'en' ? EN : PL)).toBe(copy);
  });

  it('a dropped connection never claims the service is unavailable (EN / PL)', () => {
    expect(failedTurnCopy('NETWORK', EN)).not.toMatch(/unavailable/i);
    expect(failedTurnCopy('NETWORK', PL)).not.toMatch(/niedostępn/i);
  });
});

describe('CTO R3 LIVE DEFECT L-4 — a relationship scope shows both sides and the relation, localised', () => {
  const relationshipChips = (countries: string[], relations: string[]) =>
    payload('CURRENT_REPORTING', {
      chips: {
        kind: 'SCOPED',
        chips: [
          ...countries.map((value) => ({
            kind: 'GEOGRAPHY' as const,
            value,
            source: 'RELATIONSHIP',
            applied: true,
          })),
          ...relations.map((value) => ({
            kind: 'TOPIC' as const,
            value,
            source: 'RELATIONSHIP',
            applied: true,
          })),
        ],
      },
    });
  const en: Record<string, string> = {
    RWA: 'Rwanda',
    TZA: 'Tanzania',
    KEN: 'Kenya',
    UGA: 'Uganda',
  };
  const pl: Record<string, string> = {
    RWA: 'Rwanda',
    TZA: 'Tanzania',
    KEN: 'Kenia',
    UGA: 'Uganda',
  };

  it('EN: Rwanda · Tanzania · Border · Trade', () => {
    const v = askR2View(
      relationshipChips(['RWA', 'TZA'], ['BORDER', 'TRADE']),
      EN,
      'en',
      (c) => en[c] ?? c,
    );
    expect(v.chips.items.map((i) => i.label)).toEqual(['Rwanda', 'Tanzania', 'Border', 'Trade']);
  });

  it('PL: Kenia · Uganda · Handel (localised names and relation)', () => {
    const v = askR2View(relationshipChips(['KEN', 'UGA'], ['TRADE']), PL, 'pl', (c) => pl[c] ?? c);
    expect(v.chips.items.map((i) => i.label)).toEqual(['Kenia', 'Uganda', 'Handel']);
  });

  it('a one-country, non-relationship answer is unchanged (a reader TOPIC word stays the reader’s word)', () => {
    const v = askR2View(
      payload('CURRENT_REPORTING', {
        chips: {
          kind: 'SCOPED',
          chips: [
            { kind: 'GEOGRAPHY', value: 'RWA', source: 'TYPED_GEOGRAPHY', applied: true },
            { kind: 'TOPIC', value: 'border', source: 'READER_CATEGORY', applied: false },
          ],
        },
      }),
      EN,
      'en',
      (c) => en[c] ?? c,
    );
    expect(v.chips.items.map((i) => i.label)).toEqual(['Rwanda', 'Border']);
  });
});
