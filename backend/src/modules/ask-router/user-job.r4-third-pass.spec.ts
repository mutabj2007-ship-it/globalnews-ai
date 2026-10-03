import { routeAskR2, type AskRouteContext, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { normalizeTurn } from './turn-normalization';
import { readRequestAct, readTemporalRoles } from './user-job';
import { coordinatedCountryPair } from './bilateral-relationship';
import { readConversationalTurn } from '../ask-v2/conversation/conversation-state';

/**
 * CTO R4 THIRD PASS — semantic FAMILIES, never the inspected sealed sentences. Own wording only.
 * "news" = a REQUIRED NEWS_REPORTING evidence request; "reasoning" = REFERENCE_BACKGROUND_ONLY.
 */
const PRIOR: AskRouteContext['priorWork'] = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'earlier work' };
const INSTANT = '2026-10-03T12:00:00Z';

function raw(
  q: string,
  lang: 'en' | 'pl' = 'en',
  extra: Partial<AskRouteContext> = {},
): AskR2Route {
  return routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: INSTANT, ...extra },
    { specialistRegistry: specialistRegistryFixture },
  );
}
function route(q: string, lang: 'en' | 'pl' = 'en', extra: Partial<AskRouteContext> = {}) {
  const r = raw(q, lang, extra);
  return {
    job: r.job.job,
    source: r.job.source,
    transformation: r.job.transformation,
    reference: r.job.discourseReference,
    knowledge: r.knowledgeRequirement,
    reasoning: r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY',
    news: r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
    countries: r.relationship?.countries ?? [],
    evidence: r.job.currentnessEvidence ?? [],
    terminal: r.plan.terminalState,
  };
}

describe('§2 — lexical freshness triggers are gone: a subject noun and a discourse marker are not time', () => {
  it.each([
    ['How should I judge whether a news outlet is trustworthy?', 'en'],
    ['How can news framing affect public understanding?', 'en'],
    ['Why do news cycles reward outrage?', 'en'],
    ['Now, explain why success can create fragility.', 'en'],
    ['Jak ocenić wiarygodność serwisu z wiadomościami?', 'pl'],
    ['A teraz wyjaśnij, dlaczego sukces może rodzić kruchość.', 'pl'],
  ] as const)('%s → not news by default', (q, lang) => {
    const r = route(q, lang);
    expect(r.news && r.source !== 'UNRESOLVED').toBe(false);
    expect(r.evidence).toEqual([]);
  });
  it('a discourse "Now," on earlier work is an operation on that work', () => {
    expect(route('Now, compare those two ideas.', 'en', { priorWork: PRIOR })).toMatchObject({
      reference: 'PRIOR_WORK',
      reasoning: true,
      news: false,
    });
  });
  it.each([
    ['Any news about Kenya?', 'en'],
    ['What is the latest news on the Sudan talks?', 'en'],
    ['What is happening now in Lebanon?', 'en'],
    ['Najnowsze wiadomości z Polski', 'pl'],
  ] as const)('news as the requested OBJECT stays a reporting request: %s', (q, lang) => {
    expect(route(q, lang).news).toBe(true);
  });
});

describe('§3 — a completed past year is HISTORICAL; a window reaching the present is current', () => {
  it.each([
    ['Why did the financial system fail in 2008?', 'en'],
    ['What caused the 1929 crash?', 'en'],
    ['What happened in 2008?', 'en'],
    ['How did the 1990s privatisation wave reshape Eastern Europe?', 'en'],
    ['Dlaczego w 2008 roku upadł system finansowy?', 'pl'],
  ] as const)('%s → historical analysis, zero news', (q, lang) => {
    const r = route(q, lang);
    expect(r).toMatchObject({ reasoning: true, news: false });
  });
  it.each([
    ['What changed since 2008?', 'en'],
    ['What happened this week?', 'en'],
    ['What has changed in Kenya since then?', 'en'],
    ['Co się zmieniło od 2015 roku?', 'pl'],
  ] as const)('%s → current evidence', (q, lang) => {
    expect(route(q, lang).news).toBe(true);
  });
  it('the time roles', () => {
    const roles = (q: string) => readTemporalRoles(q, 'en', 2026).map((t) => t.role);
    expect(roles('in 2008')).toEqual(['HISTORICAL_PERIOD']);
    expect(roles('since 2008')).toEqual(['REPORTING_WINDOW']);
    expect(roles('in 2026')).toEqual(['REPORTING_WINDOW']);
    expect(roles('by 2030')).toContain('FUTURE_HORIZON');
    /* "from" a year is an ORIGIN unless it runs onwards / to now */
    expect(roles('lessons from the 1957 influenza pandemic')).toEqual(['HISTORICAL_PERIOD']);
    expect(roles('growth from 2015 onwards')).toEqual(['REPORTING_WINDOW']);
  });
  it('a request for the REPORTING itself in a past year is not turned into analysis', () => {
    expect(route('What did newspapers report about Kenya in 2019?').reasoning).toBe(false);
  });
});

describe('§4/§5 — the action outranks the duration; imperatives are requests', () => {
  it.each([
    ['Outline how a four-day work week could be introduced.', 'en'],
    ['Explain a 30-year mortgage.', 'en'],
    ['Compare a 4-day week with a 5-day week.', 'en'],
    ['Describe the Hundred Years’ War.', 'en'],
    ['Draft a memo on the three-month notice period.', 'en'],
    ['Opisz, jak wprowadzić czterodniowy tydzień pracy.', 'pl'],
  ] as const)('%s → answered (never a noted constraint), zero news', (q, lang) => {
    expect(readConversationalTurn(q, lang, [])?.constraintOnly).toBe(false);
    const r = route(q, lang);
    expect(r).toMatchObject({ reasoning: true, news: false });
  });
  it('real constraints are still noted', () => {
    expect(readConversationalTurn('I only have two days.', 'en', [])?.constraintOnly).toBe(true);
    expect(readConversationalTurn('Only official sources.', 'en', [])?.constraintOnly).toBe(true);
    expect(readConversationalTurn('Mam tylko trzy dni.', 'pl', [])?.constraintOnly).toBe(true);
  });
  it.each([
    ['Outline the trade-offs.', 'en', 'EXPLAIN'],
    ['Give me an overview of carbon pricing.', 'en', 'EXPLAIN'],
    ['Draft a cover letter.', 'en', 'PRODUCE'],
    ['Suggest three ways to reduce churn.', 'en', 'ADVISE'],
    ['Compare tariffs and quotas.', 'en', 'COMPARE'],
    ['Omów zalety i wady ceł.', 'pl', 'EXPLAIN'],
    ['Czy możesz wyjaśnić, czym jest inflacja?', 'pl', 'EXPLAIN'],
    ['Zaproponuj trzy sposoby na ograniczenie rezygnacji.', 'pl', 'PRODUCE'],
    ['Doradź mi, jak wybrać bank.', 'pl', 'ADVISE'],
  ] as const)('request act: %s → %s', (q, lang, act) => {
    expect(readRequestAct(q, lang)).toBe(act);
  });
});

describe('§6 — bounded normalization: form only, never meaning', () => {
  it('contractions, apostrophe omission, quotes, a discourse "now"', () => {
    expect(normalizeTurn('whats inflation', 'en').text).toBe('what is inflation');
    expect(normalizeTurn('What’s inflation?', 'en').text).toBe(
      'what is inflation?'.replace(/^w/, 'W'),
    );
    expect(normalizeTurn('Right. Now turn that into steps.', 'en').text).toBe(
      'Right. turn that into steps.',
    );
    expect(normalizeTurn('Now, compare those.', 'en').applied).toContain('DISCOURSE_NOW');
  });
  it('a "now" that carries time is kept', () => {
    expect(normalizeTurn('What is happening now in Kenya?', 'en').text).toContain('now');
    expect(normalizeTurn('Now is the time to invest?', 'en').text).toContain('Now');
  });
  it('never invents or removes an entity, never changes capitalisation of names', () => {
    expect(normalizeTurn('japan and south korea', 'en').text).toBe('japan and south korea');
    expect(normalizeTurn('Its economy', 'en').text).toBe('Its economy');
  });
});

describe('§7 — MIXED is clause-semantic (conjunction, semicolon, two sentences, contraction, PL)', () => {
  it.each([
    ["Explain why bank runs happen and what's happening with Credit Suisse this week.", 'en'],
    ['Explain why bank runs happen; what is happening with Credit Suisse this week?', 'en'],
    ['Explain why bank runs happen. What is happening with Credit Suisse this week?', 'en'],
    ['whats a recession and whats the latest gdp figure for germany', 'en'],
    ['Czym jest recesja i jaki jest obecnie wzrost PKB w Niemczech?', 'pl'],
  ] as const)('%s → MIXED (the stable half survives a failed retrieval)', (q, lang) => {
    expect(route(q, lang).knowledge).toBe('MIXED_REFERENCE_CURRENT');
  });
});

describe('§8–§10 — a two-country relationship is a scope object, current or historical', () => {
  it.each([
    [
      'How did relations between France and Germany change after the Second World War?',
      'en',
      ['FRA', 'DEU'],
    ],
    ['Why have Japan and South Korea had recurring historical disputes?', 'en', ['JPN', 'KOR']],
    ['why have japan and south korea fallen out so often historically?', 'en', ['JPN', 'KOR']],
    ['How did India and Pakistan become rivals?', 'en', ['IND', 'PAK']],
    ['Jak rozwijał się spór Peru–Chile?', 'pl', ['PER', 'CHL']],
    ['Jak Niemcy i Francja przeszły od wrogości do sojuszu?', 'pl', ['DEU', 'FRA']],
  ] as const)(
    'historical: %s → reasoning, BOTH countries kept, zero news',
    (q, lang, countries) => {
      const r = route(q, lang);
      expect(r).toMatchObject({ reasoning: true, news: false });
      expect([...r.countries].sort()).toEqual([...countries].sort());
    },
  );
  it.each([
    [
      'What is happening at the border between Rwanda and Tanzania this week?',
      'en',
      ['RWA', 'TZA'],
    ],
    ['How are relations between Kenya and Uganda right now?', 'en', ['KEN', 'UGA']],
    ['Jak wyglądają obecnie stosunki między Polską a Ukrainą?', 'pl', ['POL', 'UKR']],
  ] as const)('current: %s → current evidence, BOTH countries kept', (q, lang, countries) => {
    const r = route(q, lang);
    expect(r.news).toBe(true);
    expect([...r.countries].sort()).toEqual([...countries].sort());
  });
  it('country identity does not depend on capitalisation in a coordinated pair', () => {
    expect(coordinatedCountryPair('japan and south korea', 'en')).toEqual(['JPN', 'KOR']);
    expect(coordinatedCountryPair('relations between chile and peru', 'en')).toEqual([
      'CHL',
      'PER',
    ]);
    /* a single lowercase homograph with no partner is still not a country */
    expect(coordinatedCountryPair('turkey and stuffing recipes', 'en')).toBeNull();
  });
});

describe('§11/§12 — continuation survives an imperative that creates the work', () => {
  it('Outline … → Which assumption is weakest? → Turn that criticism into a checklist', () => {
    const t1 = 'Outline the arguments for a four-day work week.';
    expect(readConversationalTurn(t1, 'en', [])?.constraintOnly).toBe(false);
    expect(route(t1)).toMatchObject({ job: 'EXPLANATION', reasoning: true, news: false });
    expect(route('Which assumption is weakest?', 'en', { priorWork: PRIOR })).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      reference: 'PRIOR_WORK',
      reasoning: true,
    });
    expect(
      route('Turn that criticism into a checklist for a pilot.', 'en', { priorWork: PRIOR }),
    ).toMatchObject({
      job: 'TRANSFORMATION',
      transformation: 'CHECKLIST',
      reference: 'PRIOR_WORK',
    });
  });
  it.each([
    'Which of those reasons matters most?',
    'Is that conclusion too strong?',
    'What would break it?',
    'Rank those arguments by strength.',
  ])('semantic reference to the earlier work: %s', (q) => {
    expect(route(q, 'en', { priorWork: PRIOR })).toMatchObject({
      reference: 'PRIOR_WORK',
      news: false,
    });
  });
  it.each(['Który z tych argumentów jest najsłabszy?', 'Co z tego jest najważniejsze?'])(
    'PL reference: %s',
    (q) => {
      expect(route(q, 'pl', { priorWork: PRIOR })).toMatchObject({
        reference: 'PRIOR_WORK',
        news: false,
      });
    },
  );
});

describe('§13 — EXECUTABLE INVARIANT: no positive currentness evidence → never deterministic news', () => {
  const CORPUS: Array<[string, 'en' | 'pl']> = [
    ['How does inflation destroy purchasing power?', 'en'],
    ['How can a war reshape an economy?', 'en'],
    ['Why do elections polarise societies?', 'en'],
    ['How should I judge whether a news outlet is trustworthy?', 'en'],
    ['What caused the 1929 crash?', 'en'],
    ['Outline how a four-day work week could be introduced.', 'en'],
    ['Are we approaching our peak?', 'en'],
    ['Is a monopoly always bad?', 'en'],
    ['What makes a coalition stable?', 'en'],
    ['Tell me about trade unions', 'en'],
    ['Rwanda and Tanzania border commercial services', 'en'],
    ['Kenya', 'en'],
    ['Jak wojna może przekształcić gospodarkę?', 'pl'],
    ['Czy monopol zawsze szkodzi?', 'pl'],
    ['Opowiedz o związkach zawodowych', 'pl'],
    ['What changed in Kenya today?', 'en'],
    ['What is the current inflation rate?', 'en'],
    ['Who is the current president of Kenya?', 'en'],
    ['What happened this week?', 'en'],
    ['Latest news on Tesla layoffs.', 'en'],
  ];
  it.each(CORPUS)('%s', (q, lang) => {
    const r = raw(q, lang);
    const news =
      r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
      r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';
    /* news is planned either by the classifier's decision (UNRESOLVED: the executor asks first)
       or with at least one piece of positive currentness evidence — never by default */
    if (news && r.job.source !== 'UNRESOLVED')
      expect((r.job.currentnessEvidence ?? []).length).toBeGreaterThan(0);
  });
});

describe('§14 — current questions still require current evidence (no bias toward reasoning)', () => {
  it.each([
    ['What changed in Kenya today?', 'en'],
    ['What is the current inflation rate?', 'en'],
    ['Who is the current president of Kenya?', 'en'],
    ['What happened this week?', 'en'],
    ['Jaka jest obecnie inflacja w Polsce?', 'pl'],
    ['Co się wydarzyło w tym tygodniu?', 'pl'],
  ] as const)('%s → news, with evidence', (q, lang) => {
    const r = route(q, lang);
    expect(r.news).toBe(true);
    expect(r.reasoning).toBe(false);
    expect(r.evidence.length).toBeGreaterThan(0);
  });
});
