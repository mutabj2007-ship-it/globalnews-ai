import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { readClauseIntents, splitClauses } from './clause-intent';
import { resolvePolishCountryForm } from './country-morphology';
import { conversationObjective, readEvaluationKind } from './decision-objective';
import { readBilateralRelationship } from './bilateral-relationship';
import { readConversationalTurn } from '../ask-v2/conversation/conversation-state';

/**
 * CTO R4 FIFTH PASS — the four families, structurally, plus a SEMANTIC METAMORPHIC suite: harmless
 * transformations of a question must not change its semantic class. Own wording only — never the
 * inspected sealed sentences. Invariants, never expected prose.
 */
const PRIOR: AskRouteContext['priorWork'] = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'earlier work' };
function raw(q: string, lang: 'en' | 'pl' = 'en', extra: Partial<AskRouteContext> = {}) {
  return routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-03T12:00:00Z', ...extra },
    { specialistRegistry: specialistRegistryFixture },
  );
}
/** the semantic class of a route: what kind of answer the reader gets */
function cls(q: string, lang: 'en' | 'pl' = 'en', extra: Partial<AskRouteContext> = {}): string {
  const r = raw(q, lang, extra);
  const news = r.plan.evidenceRequests.some(
    (e) => e.required && e.evidenceClass === 'NEWS_REPORTING',
  );
  if (r.knowledgeRequirement === 'MIXED_REFERENCE_CURRENT') return 'MIXED';
  if (r.knowledgeRequirement === 'DECISION_SUPPORT' && r.decisionObjective === null)
    return 'CLARIFY';
  if (r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY') return 'REASONING';
  if (news) return r.job.source === 'UNRESOLVED' ? 'CLASSIFIER' : 'EVIDENCE';
  return r.plan.terminalState;
}
const actors = (q: string, lang: 'en' | 'pl' = 'en') =>
  [...(raw(q, lang).relationship?.countries ?? [])].sort().join('+');

describe('A — clause intent: MIXED emerges from the SET of clause intents', () => {
  it('splits on conjunctions, commas, semicolons and sentence boundaries (EN / PL)', () => {
    expect(
      splitClauses('What does a central bank do, and what did the Fed decide this week?', 'en'),
    ).toHaveLength(2);
    expect(splitClauses('Explain the role of tariffs; what changed today?', 'en')).toHaveLength(2);
    expect(splitClauses('I get what a bond is. Has the yield risen lately?', 'en')).toHaveLength(2);
    expect(
      splitClauses('Czym jest obligacja, a jak dziś zachowują się rentowności?', 'pl'),
    ).toHaveLength(2);
  });
  it('a statement of conceptual context is a STABLE clause', () => {
    const intents = readClauseIntents(
      'I understand what a recession is in theory. Is Germany in one right now?',
      'en',
      {
        current: (c) => /right now/i.test(c),
        historical: () => false,
        stableShape: () => false,
      },
    );
    expect(intents.map((c) => c.intent)).toEqual(['STABLE', 'CURRENT']);
    expect(intents.map((c) => c.job)).toEqual(['EXPLANATION', 'CURRENT_REPORTING']);
  });
  it.each([
    [
      'What exactly does a central bank do, and what has the Polish central bank changed this week?',
      'en',
    ],
    ['What makes a currency a safe haven? Has the Swiss franc strengthened lately?', 'en'],
    ['I understand what quantitative easing means in theory. Is the ECB doing it right now?', 'en'],
    ['Explain the role of a central bank; what did the Fed decide yesterday?', 'en'],
    ['Why does inflation matter for savers, and what is the inflation rate in Chile today?', 'en'],
    ['Wiem, co oznacza recesja w teorii. Czy Niemcy są teraz w recesji?', 'pl'],
    ['Co właściwie robi bank centralny, a co NBP zmienił w tym tygodniu?', 'pl'],
    ['Jak zmieniła się polityka migracyjna Szwecji od 2015 roku do dziś?', 'pl'],
  ] as const)('%s → MIXED', (q, lang) => {
    expect(cls(q, lang)).toBe('MIXED');
  });
});

describe('B — two-actor EVENTS are relationships; Polish grammatical cases; third-place roles', () => {
  it.each([
    ['How did Norway and Sweden dissolve their union in 1905?', 'en', 'NOR+SWE'],
    [
      'Why did Russia and Ukraine sign the grain deal brokered in Istanbul in 2022?',
      'en',
      'RUS+UKR',
    ],
    ['Why did Egypt and Israel sign a peace treaty in 1979?', 'en', 'EGY+ISR'],
    ['Na czym polegał konflikt Grecji i Turcji o Cypr w 1974 roku?', 'pl', 'GRC+TUR'],
    [
      'Jak przebiegał szczyt Stanów Zjednoczonych i Korei Północnej w Singapurze w 2018 roku?',
      'pl',
      'PRK+USA',
    ],
  ] as const)('%s → both actors', (q, lang, pair) => {
    expect(actors(q, lang)).toBe(pair);
    expect(cls(q, lang)).toBe('REASONING');
  });
  it('the venue / disputed place is never an actor', () => {
    /* CTO R4 semantic IR §12 — Istanbul is the VENUE as a city (no country identity): Turkey is
       never promoted into the relation by its city */
    const istanbul = readBilateralRelationship(
      'Why did Russia and Ukraine sign the grain deal brokered in Istanbul in 2022?',
      'en',
    );
    expect(istanbul?.countries).toEqual(['RUS', 'UKR']);
    expect(istanbul?.entities).toContainEqual({ iso3: null, role: 'VENUE' });
    expect(istanbul?.entities?.some((e) => e.iso3 === 'TUR')).toBe(false);
    expect(
      readBilateralRelationship(
        'Na czym polegał konflikt Grecji i Turcji o Cypr w 1974 roku?',
        'pl',
      )?.entities,
    ).toContainEqual({ iso3: 'CYP', role: 'DISPUTED_OBJECT' });
  });
  it('without the coordinated two-actor structure, an event noun alone never makes a relationship', () => {
    expect(readBilateralRelationship('What is a peace treaty?', 'en')).toBeNull();
    expect(readBilateralRelationship('Why did the summit in Geneva matter?', 'en')).toBeNull();
  });
  it.each([
    ['Stanów Zjednoczonych', 'USA'],
    ['Stanach Zjednoczonych', 'USA'],
    ['Korei Północnej', 'PRK'],
    ['Koreą Południową', 'KOR'],
    ['Korei Poludniowej', 'KOR'],
    ['Czech', 'CZE'],
    ['Węgier', 'HUN'],
    ['Nowej Zelandii', 'NZL'],
  ])('Polish case form %s → %s (bounded: registry nominatives only)', (form, iso3) => {
    expect(resolvePolishCountryForm(form)).toBe(iso3);
  });
  it('a near-spelling is never a country', () => {
    expect(resolvePolishCountryForm('Koreańczyków')).toBeNull();
    expect(resolvePolishCountryForm('stanów zdrowia')).toBeNull();
  });
});

describe('C — a completed historical anchor outranks contest-currentness', () => {
  it.each([
    'Who won the 2000 US presidential election, and why was the result so contested?',
    'Who was ahead after round 3 in 2000?',
    'Who won the 1992 French referendum and why was it so close?',
  ])('%s → historical reference + explanation (reasoning)', (q) => {
    expect(cls(q)).toBe('REASONING');
  });
  it.each([
    'who is ahead in the brazilian election right now',
    'Who is leading the polls before the Dutch election?',
  ])('%s → current', (q) => {
    expect(cls(q)).toBe('EVIDENCE');
  });
});

describe('D — objective memory, and component evaluation never asks "best for what?"', () => {
  it('CHOICE vs ARTIFACT_COMPONENT evaluation', () => {
    expect(readEvaluationKind('Which country is best?', 'en')).toBe('CHOICE_EVALUATION');
    expect(readEvaluationKind('Which argument is strongest?', 'en')).toBe(
      'ARTIFACT_COMPONENT_EVALUATION',
    );
    expect(readEvaluationKind("Which of the critic's points is the strongest?", 'en')).toBe(
      'ARTIFACT_COMPONENT_EVALUATION',
    );
    expect(readEvaluationKind('Which recommendation matters most?', 'en')).toBe(
      'ARTIFACT_COMPONENT_EVALUATION',
    );
    expect(readEvaluationKind('Który z tych argumentów jest najmocniejszy?', 'pl')).toBe(
      'ARTIFACT_COMPONENT_EVALUATION',
    );
  });
  it('the objective survives several turns, with its source turn; a newer one overrides', () => {
    expect(
      conversationObjective(
        [
          'I am choosing between law and medicine.',
          'What matters most to me is income stability.',
          'OK.',
          'Hmm.',
        ],
        'en',
      ),
    ).toEqual({ text: 'income stability', sourceTurn: 1 });
    expect(
      conversationObjective(['My priority is cost.', 'Actually, my priority is speed.'], 'en'),
    ).toEqual({ text: 'speed', sourceTurn: 1 });
  });
  it('a decision uses the conversation objective instead of asking "for what?"', () => {
    const turns = [
      'Evaluate these approaches for reducing customer churn.',
      'Fine.',
      'Which is strongest?',
    ];
    const earlier = turns
      .slice(0, -1)
      .map((question) => ({ question, language: 'en' }))
      .reverse();
    const t = readConversationalTurn(turns[2], 'en', earlier);
    expect(t?.objective?.text).toBe('reducing customer churn');
    expect(cls(turns[2], 'en', { conversationObjective: t!.objective!.text })).toBe('REASONING');
    expect(cls(turns[2], 'en')).toBe('CLARIFY');
  });
  it('a DECISION_CRITERIA artifact supplies the objective', () => {
    expect(
      cls('Which is the best choice?', 'en', {
        priorWork: { kind: 'DECISION_CRITERIA', label: 'reducing churn' },
      }),
    ).toBe('REASONING');
  });
  it('a component evaluation of earlier work is a reference to it, never a clarification', () => {
    expect(
      cls("Which of the critic's points is the strongest, and why?", 'en', { priorWork: PRIOR }),
    ).toBe('REASONING');
    expect(
      raw("Which of the critic's points is the strongest, and why?", 'en', { priorWork: PRIOR }).job
        .discourseReference,
    ).toBe('PRIOR_WORK');
  });
});

/* ── SEMANTIC METAMORPHIC SUITE ───────────────────────────────────────────────────────────── */
type Transform = readonly [string, (q: string) => string];
const HARMLESS: readonly Transform[] = [
  ['lowercase', (q) => q.toLowerCase()],
  ['UPPERCASE first word only', (q) => q.charAt(0).toUpperCase() + q.slice(1)],
  ['no final punctuation', (q) => q.replace(/[?.!]+\s*$/, '')],
  ['doubled punctuation', (q) => q.replace(/\?\s*$/, '??')],
  ['leading "Now,"', (q) => `Now, ${q.charAt(0).toLowerCase()}${q.slice(1)}`],
  ['leading "ok so"', (q) => `ok so ${q.charAt(0).toLowerCase()}${q.slice(1)}`],
  ['contraction', (q) => q.replace(/\bwhat is\b/i, "what's").replace(/\bdid not\b/i, "didn't")],
];

describe('METAMORPHIC — harmless form changes never change the semantic class', () => {
  const BASES: Array<[string, string]> = [
    ['Why did the Asian financial crisis happen in 1997?', 'REASONING'],
    ['What caused the 1973 oil embargo?', 'REASONING'],
    ['How does a currency peg turn a small shock into a big crisis?', 'REASONING'],
    ['What is the role of a central bank?', 'REASONING'],
    ['What is happening in Sudan at the moment?', 'EVIDENCE'],
    ['Have food prices in Kenya been rising lately?', 'EVIDENCE'],
    ['What exactly does a central bank do, and what did the Fed decide this week?', 'MIXED'],
  ];
  for (const [base, expected] of BASES)
    for (const [name, t] of HARMLESS)
      it(`${expected} · ${name}: ${base}`, () => {
        expect(cls(base)).toBe(expected);
        expect(cls(t(base))).toBe(expected);
      });

  it.each([
    [
      'Why did the Asian financial crisis happen in 1997?',
      'What was behind the 1997 Asian financial crisis?',
    ],
    [
      'Why did the Asian financial crisis happen in 1997?',
      'Explain why the 1997 Asian crisis happened.',
    ],
    ['What is the role of a central bank?', 'What exactly does a central bank do?'],
  ])('synonymous stable wording keeps the class: %s ≈ %s', (a, b) => {
    expect(cls(b)).toBe(cls(a));
  });
});

describe('METAMORPHIC — a two-actor scope survives order, case, possessive, venue and tense', () => {
  const BASE = 'What is happening at the border between Rwanda and Tanzania regarding trade?';
  const VARIANTS: readonly Transform[] = [
    ['reversed actors', (q) => q.replace('Rwanda and Tanzania', 'Tanzania and Rwanda')],
    ['lowercase', (q) => q.toLowerCase()],
    [
      'venue inserted',
      () => 'What came out of the trade talks between Rwanda and Tanzania held in Kenya this week?',
    ],
    [
      'historical tense',
      () => 'How did trade relations between Rwanda and Tanzania develop in the 1990s?',
    ],
    ['possessive', () => "How has Rwanda's trade with Tanzania across the border changed lately?"],
    [
      'combined form PL',
      () =>
        'Jak rozwijały się stosunki handlowe między Rwandą a Tanzanią w latach dziewięćdziesiątych?',
    ],
  ];
  it.each(VARIANTS.map(([name, t]) => [name, t(BASE)] as const))(
    '%s: both actors kept (%s)',
    (_name, q) => {
      const lang = /[ąęółśżźćń]/i.test(q) ? 'pl' : 'en';
      expect(actors(q, lang)).toBe('RWA+TZA');
    },
  );
});

describe('METAMORPHIC — an artifact reference keeps its reference class under rewording', () => {
  it.each([
    'Which part is weakest?',
    'Which component is weakest?',
    'What is the weakest part?',
    'Which of those points is weakest?',
    'which part is the weakest',
    'Now, which element is the most fragile?',
    'Która część jest najsłabsza?',
    'Ktora czesc jest najslabsza?',
  ])('%s → PRIOR_WORK, reasoning', (q) => {
    const lang = /^Kt/.test(q) ? 'pl' : 'en';
    const r = raw(q, lang, { priorWork: PRIOR });
    expect(r.job.discourseReference).toBe('PRIOR_WORK');
    expect(cls(q, lang, { priorWork: PRIOR })).toBe('REASONING');
  });
});
