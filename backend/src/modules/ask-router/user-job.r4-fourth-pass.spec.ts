import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { readTemporalSemantics } from './temporal-semantics';
import { combinedCountryAdjectives, restoreCountryPossessives } from './country-morphology';
import { readBilateralRelationship } from './bilateral-relationship';
import { foldPl, plTolerant } from './pl-tolerant';
import { normalizeTurn } from './turn-normalization';

/**
 * CTO R4 FOURTH PASS — TIME ROLE, ENTITY ROLE and RELATIONSHIP ROLE resolved before job /
 * freshness. Semantic FAMILIES in own wording only — never the inspected sealed sentences.
 * "news" = a REQUIRED NEWS_REPORTING request; "reasoning" = REFERENCE_BACKGROUND_ONLY.
 */
function route(q: string, lang: 'en' | 'pl' = 'en', extra: Partial<AskRouteContext> = {}) {
  const r = routeAskR2(
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
  return {
    job: r.job.job,
    knowledge: r.knowledgeRequirement,
    reasoning: r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY',
    news: r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
    relationship: r.relationship,
    temporal: r.temporalSemantics,
    evidence: r.job.currentnessEvidence ?? [],
  };
}
const T = (q: string, lang: 'en' | 'pl' = 'en') => readTemporalSemantics(q, lang, 2026);

describe('§1 — the temporal interpretation layer', () => {
  it.each([
    ['the 1997 Asian financial crisis', 'en', 'PAST_COMPLETED', 'HISTORICAL'],
    ['what is happening at the moment', 'en', 'CURRENT_STATE', 'CURRENT'],
    ['what is the situation at present', 'en', 'CURRENT_STATE', 'CURRENT'],
    ['have prices been rising lately', 'en', 'RECENT_PERIOD', 'CURRENT'],
    ['why is remote work so common these days', 'en', 'CONTEMPORARY_TENDENCY', 'CONTEMPORARY'],
    ['why is remote work so common nowadays', 'en', 'CONTEMPORARY_TENDENCY', 'CONTEMPORARY'],
    /* fifth pass: a dated "since" keeps BOTH endpoints → historical + current (still news) */
    ['what changed since 2008', 'en', 'SINCE_PAST_TO_PRESENT', 'HISTORICAL_AND_CURRENT'],
    ['what happened in the last 30 days', 'en', 'REPORTING_WINDOW', 'CURRENT'],
    ['co się dzieje w tej chwili', 'pl', 'CURRENT_STATE', 'CURRENT'],
    ['co sie dzieje w tej chwili', 'pl', 'CURRENT_STATE', 'CURRENT'],
    ['ostatnio ceny rosną', 'pl', 'RECENT_PERIOD', 'CURRENT'],
    ['w okresie międzywojennym', 'pl', 'HISTORICAL_PERIOD', 'HISTORICAL'],
    ['w dzisiejszych czasach', 'pl', 'CONTEMPORARY_TENDENCY', 'CONTEMPORARY'],
  ] as const)('%s → %s / %s', (q, lang, role, currentness) => {
    const t = T(q, lang);
    expect(t.spans.map((s) => s.role)).toContain(role);
    expect(t.currentness).toBe(currentness);
  });
  it('SINCE_PAST_TO_PRESENT keeps both endpoints', () => {
    expect(T('what changed since 2008').spans).toContainEqual(
      expect.objectContaining({ role: 'SINCE_PAST_TO_PRESENT', from: 2008, to: 'PRESENT' }),
    );
  });
  it('a past anchor + an explicit present comparison is HISTORICAL_AND_CURRENT', () => {
    expect(T('how does the 1929 crash compare with conditions today').currentness).toBe(
      'HISTORICAL_AND_CURRENT',
    );
  });
  it('a discourse "now" is marked as such, never as time', () => {
    expect(normalizeTurn('Now, explain why trust erodes.', 'en').applied).toContain(
      'DISCOURSE_NOW',
    );
  });
});

describe('§2 — a completed DATED event outranks the particular-event currentness rule', () => {
  it.each([
    ['Why did the Asian financial crisis spread in 1997?', 'en'],
    ['What made the 2010 eurozone debt crisis so hard to contain?', 'en'],
    ['What caused the 1973 oil shock?', 'en'],
    ['Dlaczego kryzys azjatycki z 1997 roku rozprzestrzenił się tak szybko?', 'pl'],
  ] as const)('%s → historical, zero news', (q, lang) => {
    expect(route(q, lang)).toMatchObject({ reasoning: true, news: false });
  });
  it('the same event compared with today → MIXED (historical + current)', () => {
    expect(route('How does the 1997 Asian crisis compare with conditions today?').knowledge).toBe(
      'MIXED_REFERENCE_CURRENT',
    );
  });
  it('an explicit present question → current', () => {
    expect(route('Is Asia entering a financial crisis now?').news).toBe(true);
  });
});

describe('§3 / §12 — present-state language activates the evidence path (current→reasoning protection)', () => {
  it.each([
    ['What is happening at the border at the moment?', 'en'],
    ['What is the situation in Haiti at present?', 'en'],
    ['Have food prices in Spain been rising lately?', 'en'],
    ['Is housing in Lisbon expensive these days?', 'en'],
    ['Where are cases being reported at the moment?', 'en'],
    ['Jaka jest w tej chwili sytuacja na granicy?', 'pl'],
    ['Czy ostatnio rosną ceny żywności w Polsce?', 'pl'],
    ['czy ostatnio rosna ceny zywnosci w polsce', 'pl'],
  ] as const)('%s → news', (q, lang) => {
    const r = route(q, lang);
    expect(r.news).toBe(true);
    expect(r.reasoning).toBe(false);
  });
  it('a contemporary tendency asked as an explanation is MIXED (not timeless, not pure news)', () => {
    expect(route('Why are remote teams so common nowadays?').knowledge).toBe(
      'MIXED_REFERENCE_CURRENT',
    );
  });
});

describe('§4–§6 / §13 — RelationshipScope with entity roles, independent of freshness', () => {
  it.each([
    /* territorial dispute: two actors + the disputed place */
    [
      'What explains the dispute between Argentina and the United Kingdom over the Falklands?',
      'en',
      ['ARG', 'GBR'],
    ],
    /* conflict over an island / region */
    ['Why did China and Japan quarrel over the Senkaku islands in 2012?', 'en', ['CHN', 'JPN']],
    /* war between two countries, historical */
    ['Why did Iran and Iraq go to war in 1980?', 'en', ['IRN', 'IRQ']],
    ['why did ethiopia and eritrea fight a war in 1998', 'en', ['ETH', 'ERI']],
    /* combined adjectives */
    ['How did Franco-German relations evolve after 1945?', 'en', ['FRA', 'DEU']],
    ['Explain the Sino-Japanese rivalry.', 'en', ['CHN', 'JPN']],
    [
      'Jak kształtowały się stosunki polsko-ukraińskie w latach dziewięćdziesiątych?',
      'pl',
      ['POL', 'UKR'],
    ],
    [
      'Jak ksztaltowaly sie stosunki polsko-ukrainskie w latach dziewiecdziesiatych?',
      'pl',
      ['POL', 'UKR'],
    ],
  ] as const)('historical / conceptual: %s → reasoning, both actors', (q, lang, actors) => {
    const r = route(q, lang);
    expect(r).toMatchObject({ reasoning: true, news: false, job: 'RELATIONSHIP_ANALYSIS' });
    expect([...(r.relationship?.countries ?? [])].sort()).toEqual([...actors].sort());
  });
  it.each([
    ['Have Turkey and Greece been cooperating more lately?', 'en', ['TUR', 'GRC']],
    [
      'What is happening at the border linking Rwanda and Tanzania regarding commercial services?',
      'en',
      ['RWA', 'TZA'],
    ],
    ['Jak wyglądają obecnie stosunki między Polską a Litwą?', 'pl', ['POL', 'LTU']],
  ] as const)('current: %s → news, both actors', (q, lang, actors) => {
    const r = route(q, lang);
    expect(r.news).toBe(true);
    expect([...(r.relationship?.countries ?? [])].sort()).toEqual([...actors].sort());
  });
  it('a third place keeps the pair and gets its role (disputed object / corridor / venue)', () => {
    const falklands = readBilateralRelationship(
      'What explains the dispute between Argentina and the United Kingdom over the Falklands?',
      'en',
    );
    expect(falklands?.countries).toEqual(['ARG', 'GBR']);
    expect(falklands?.entities).toContainEqual({ iso3: 'FLK', role: 'DISPUTED_OBJECT' });
    const corridor = readBilateralRelationship(
      'How does trade between Uganda and Burundi move through Tanzania?',
      'en',
    );
    expect(corridor?.countries).toEqual(['UGA', 'BDI']);
    expect(corridor?.entities).toContainEqual({ iso3: 'TZA', role: 'CORRIDOR' });
    const venue = readBilateralRelationship(
      'What came out of the negotiations between Ethiopia and Egypt hosted in Qatar?',
      'en',
    );
    expect(venue?.countries).toEqual(['ETH', 'EGY']);
    expect(venue?.entities?.find((e) => e.role === 'VENUE')?.iso3).toBe('QAT');
  });
  it('relation families', () => {
    const kinds = (q: string) => readBilateralRelationship(q, 'en')?.relations ?? [];
    expect(kinds('Why did Iran and Iraq go to war in 1980?')).toContain('WAR');
    expect(
      kinds('the dispute between Argentina and the United Kingdom over the Falklands'),
    ).toContain('TERRITORIAL_DISPUTE');
    expect(kinds('How did the alliance between France and the United Kingdom form?')).toContain(
      'ALLIANCE',
    );
    expect(kinds('the rivalry between India and Pakistan')).toContain('COMPETITION');
  });
  it('a plain comparison of two countries is still not a relationship', () => {
    expect(readBilateralRelationship('Compare Rwanda and Tanzania', 'en')).toBeNull();
  });
});

describe('§7 / §8 — country morphology, case and diacritics (bounded, never fuzzy)', () => {
  it('combined adjectives', () => {
    expect(combinedCountryAdjectives('Franco-German ties', 'en')).toEqual([['FRA', 'DEU']]);
    expect(combinedCountryAdjectives('Polish-Lithuanian union', 'en')).toEqual([['POL', 'LTU']]);
    expect(combinedCountryAdjectives('stosunki polsko-litewskie', 'pl')).toEqual([['POL', 'LTU']]);
    expect(combinedCountryAdjectives('US-China trade', 'en')).toEqual([['USA', 'CHN']]);
    expect(combinedCountryAdjectives('a well-known long-term plan', 'en')).toEqual([]);
  });
  it('an omitted possessive apostrophe on a country, only before a noun', () => {
    expect(restoreCountryPossessives('kenyas economy')).toBe("kenya's economy");
    expect(restoreCountryPossessives('who leads perus election')).toBe("who leads peru's election");
    expect(restoreCountryPossessives('the chinas cabinet')).toBe('the chinas cabinet');
    expect(restoreCountryPossessives('it was kenyas')).toBe('it was kenyas');
  });
  it('Polish with and without diacritics is the same text', () => {
    expect(foldPl('czym się różni')).toBe('czym sie rozni');
    expect(plTolerant(/czym\s+się\s+różni/iu).test('czym sie rozni')).toBe(true);
    expect(route('czym sie rozni inflacja od deflacji', 'pl')).toMatchObject({
      reasoning: true,
      news: false,
    });
    expect(route('czym się różni inflacja od deflacji', 'pl')).toMatchObject({
      reasoning: true,
      news: false,
    });
  });
});

describe('§9 / §10 — Polish stable SEMANTIC forms, and MIXED keeps the stable clause', () => {
  it.each([
    'Czym się różni recesja od depresji?',
    'Co łączy inflację i bezrobocie?',
    'Jakie są skutki wysokich stóp procentowych?',
    'Z czego wynika inflacja bazowa?',
    'Skąd się bierze nierówność dochodów?',
  ])('%s → stable reasoning', (q) => {
    expect(route(q, 'pl')).toMatchObject({ reasoning: true, news: false });
  });
  it.each([
    ['czym sie rozni obligacja od akcji, a jak dzis zachowuje sie WIG20?', 'pl'],
    ['Czym się różni obligacja od akcji? Jak dziś zachowuje się WIG20?', 'pl'],
    ['Explain why measles spreads fast. Where are cases being reported at the moment?', 'en'],
    ["what's a hedge fund and whats the s&p 500 doing today", 'en'],
  ] as const)('%s → MIXED', (q, lang) => {
    expect(route(q, lang).knowledge).toBe('MIXED_REFERENCE_CURRENT');
  });
});

describe('§11 — contest state is contextual currentness', () => {
  it.each([
    ['who is leading in the polls before the german election', 'en'],
    ['so whos leading in perus election', 'en'],
    ['Kto prowadzi w sondażach przed wyborami we Francji?', 'pl'],
  ] as const)('%s → current', (q, lang) => {
    expect(route(q, lang).news).toBe(true);
  });
  it('a dated contest is historical', () => {
    expect(
      route('Who was ahead after the first round of the French election in 2002?'),
    ).toMatchObject({
      reasoning: true,
      news: false,
    });
  });
  it('"ahead" alone is not currentness', () => {
    expect(T('how to stay ahead of competitors').currentness).toBe('NONE');
  });
});

describe('§14 — conceptual→news protection still holds', () => {
  it.each([
    ['How does a currency peg turn a small shock into a big crisis?', 'en'],
    ['How can a war reshape an economy?', 'en'],
    ['Jak wojna może przekształcić gospodarkę?', 'pl'],
    ['How should I judge whether a news outlet is trustworthy?', 'en'],
  ] as const)('%s', (q, lang) => {
    expect(route(q, lang)).toMatchObject({ reasoning: true, news: false });
  });
});
