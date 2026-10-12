/*
  EAST AFRICA — RETRIEVAL & GEOGRAPHIC INTEGRITY R1 · PROPOSED ACCEPTANCE FIXTURES (EA-GEO-R1-FX).

  Written by the East Africa independent validator against live Alpha backend 737c42f. PROPOSAL ONLY:
  Claude Code integrates after CTO approval; no file here is committed by EA.

  HOW TO READ IT
  - `it(...)`          = a PASS condition at 737c42f that must stay true (regression guard).
  - `it.failing(...)`  = a HOLD condition: the REQUIRED behaviour is asserted and it does NOT hold at
                         737c42f. Jest reports these as passing while the defect exists. When a fix lands,
                         the case turns red and must be flipped from `it.failing` to `it` IN THE SAME
                         reviewed change — never deleted, never loosened (no stealth test update).
  - Synthetic text written by EA; no publisher content, no network, no provider, no model, no database.
  - The private AnalysisService.detectLocation is reached through the prototype because it is the exact
    function that chooses the typed country feed (rawTypedLocation, analysis.service.ts:1493). If the owner extracts it
    into a pure helper, point `analysisTypedCountry` at that helper; the expectations do not change.
*/
import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { congoReadingOf, detectAmbiguousCountryMention } from '../anchor/event-anchor.util';
import { classifyQueryIntent } from '../query/query-intent.util';
import { admitsReport, anchoredQueries, questionAnchorsOf, supplementQueries } from '../query/question-anchors.util';
import { resolveGeography } from '../../geo/geo-resolver';
import { resolvePrimaryCountry } from '../../news/country/country-relevance.util';
import { computeSourceDiversity } from '../duplicates/compute-source-diversity.util';
import { publishedInsideWindow } from '../../news/relevance/publication-window.util';
import { contributesJournalisticCorroboration } from '../../news/providers/feed-corroboration';
import { FEED_SOURCES } from '../../news/providers/feed-source-registry';
import { getLocalizedCountryName } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';

const analysis: any = Object.assign(Object.create(AnalysisService.prototype), {
  logger: { debug() {}, warn() {}, log() {}, error() {} },
});
/** The country Analysis would retrieve as a TYPED location for this question text (undefined = none). */
const analysisTypedCountry = (q: string): string | undefined => {
  if (detectAmbiguousCountryMention(q) !== undefined) return undefined; /* GATE F drops it (analysis.service.ts:1512) */
  const loc = analysis.detectLocation(q) ?? analysis.detectLocationByDemonym(q);
  return loc?.country?.iso3;
};
const route = (q: string, lang = 'en'): any =>
  routeAskR2(
    { originalQuestion: q, sourceLanguage: lang, normalizationLanguage: lang, displayLanguage: lang, origin: 'ASK' } as never,
    { requestInstant: '2026-10-12T12:00:00Z' } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
const routeGeo = (q: string, lang = 'en'): string[] =>
  route(q, lang).envelope.geography.candidates.map((c: { value: string }) => c.value);
const primary = (title: string, summary = ''): string =>
  (resolvePrimaryCountry({ title, summary } as never) as { countryCode?: string } | undefined)?.countryCode ?? 'NONE';

/* The Choose a Place (Ask D0.1 · D2) draft, built exactly as ChoosePlace.tsx does on release-prep/d01-frontend-639785e:
   askDiscoverStrings(locale).draftRegion + getLocalizedCountryName(iso2, locale). */
const DRAFT_PREFIX: Record<string, string> = {
  en: 'What changed this week in ',
  pl: 'Co zmieniło się w tym tygodniu w ',
  fr: 'Qu’est-ce qui a changé cette semaine à ',
  de: 'Was hat sich diese Woche geändert in ',
  es: '¿Qué ha cambiado esta semana en ',
  pt: 'O que mudou esta semana em ',
  ar: 'ما الذي تغيّر هذا الأسبوع في ',
};
const d01Draft = (locale: string, iso2: 'CD' | 'CG'): string =>
  `${DRAFT_PREFIX[locale]}${getLocalizedCountryName(iso2, locale as never)}`;

/* ═════════════════════════ A · KENYA AND RWANDA ECONOMIC REPORTING ═════════════════════════ */
const SENTINEL = 'Compare the latest economic news from Kenya and Rwanda.';

describe('EA-GEO-A Kenya–Rwanda comparison', () => {
  it('A-01 the sentinel is a comparison with BOTH named countries as sides, in either order', () => {
    for (const [q, sides] of [
      [SENTINEL, ['KEN', 'RWA']],
      ['Compare the latest economic news from Rwanda and Kenya.', ['RWA', 'KEN']],
      ['Kenya vs Rwanda economy: latest news', ['KEN', 'RWA']],
    ] as const) {
      const c: any = classifyQueryIntent(q);
      expect(c.intent).toBe('COMPARISON_RESEARCH');
      expect(c.sides.map((s: { iso3: string }) => s.iso3)).toEqual(sides);
    }
  });

  it('A-02 the economic subject is kept as an admission gate over both countries', () => {
    const a = questionAnchorsOf(SENTINEL);
    expect(a.actors.map((x) => x.key)).toEqual(['KEN', 'RWA']);
    expect(a.topics.map((t) => t.key)).toEqual(['economy']);
    expect(a.gated).toBe(true);
    expect(anchoredQueries(a)).toEqual(['Kenya economy', 'Rwanda economy']);
  });

  it.failing('A-03 HOLD the Ask plan scope names BOTH countries (route envelope carries only the first)', () => {
    expect(routeGeo(SENTINEL)).toEqual(expect.arrayContaining(['KEN', 'RWA']));
  });

  it.failing('A-04 HOLD a one-sided admitted set still searches the missing side (3 Kenya items → no Rwanda supplement)', () => {
    const kenya = [
      { title: 'Kenyan shilling steadies as central bank intervenes', summary: 'The Central Bank of Kenya sold dollars.' },
      { title: 'Kenya inflation eases to 4.1%', summary: 'Prices in Kenya rose more slowly.' },
      { title: 'Kenya Treasury raises bond sale target', summary: 'Kenya plans to borrow more domestically.' },
    ];
    const a = questionAnchorsOf(SENTINEL);
    expect(kenya.every((r) => admitsReport(a, r).admitted)).toBe(true);
    expect(supplementQueries(a, kenya)).toContain('Rwanda economy');
  });

  it.failing('A-05 HOLD a three-country comparison supplements every side (bounded at two today: Tanzania never searched)', () => {
    const a = questionAnchorsOf('Compare the latest economic news from Kenya, Rwanda and Tanzania.');
    expect(anchoredQueries(a)).toContain('Tanzania economy');
  });

  it.failing('A-06 HOLD "How do Kenya\'s and Rwanda\'s economies compare right now?" is a two-sided comparison, not a clarification', () => {
    const c: any = classifyQueryIntent("How do Kenya's and Rwanda's economies compare right now?");
    expect(c.intent).not.toBe('CLARIFICATION_REQUIRED');
    expect(c.sides.map((s: { iso3: string }) => s.iso3)).toEqual(['KEN', 'RWA']);
  });

  it('A-07 a Kenyan athlete abroad is not Kenyan economic reporting', () => {
    expect(admitsReport(questionAnchorsOf(SENTINEL), { title: 'Kenyan runner wins Berlin marathon', summary: 'The Kenyan athlete set a course record in Germany.' }).admitted).toBe(false);
  });

  it.failing('A-08 HOLD an office mention is not the event country ("Nairobi-based analysts" on Ugandan inflation)', () => {
    const r = { title: 'Nairobi-based analysts say Ugandan inflation is easing', summary: 'Inflation in Uganda slowed for a third month, analysts in Nairobi said.' };
    expect(primary(r.title, r.summary)).not.toBe('KE');
    expect(admitsReport(questionAnchorsOf(SENTINEL), r).admitted).toBe(false);
  });

  it('A-09 a reporting window admits only publisher-dated reports inside it (old background and first-seen-only fail closed)', () => {
    const from = '2026-10-05T12:00:00Z';
    const to = '2026-10-12T12:00:00Z';
    expect(publishedInsideWindow({ publishedAt: '2026-10-10T08:00:00Z', publishedAtBasis: 'publisher' } as never, from, to)).toBe(true);
    expect(publishedInsideWindow({ publishedAt: '2025-03-01T08:00:00Z', publishedAtBasis: 'publisher' } as never, from, to)).toBe(false);
    expect(publishedInsideWindow({ publishedAt: '2026-10-11T07:00:00Z', publishedAtBasis: 'firstSeen' } as never, from, to)).toBe(false);
  });

  it('A-10 identical wire copies form ONE reporting cluster; provider items never count as journalistic corroboration', () => {
    const base = { summary: 'The Central Bank of Kenya sold dollars to support the currency.', publishedAtBasis: 'publisher', category: 'business' };
    const div: any = computeSourceDiversity([
      { ...base, id: 'w1', title: 'Kenyan shilling steadies as central bank intervenes', sourceName: 'Pub B', url: 'https://b.example/1', sourceId: 'gnews', publishedAt: '2026-10-11T08:00:00Z' },
      { ...base, id: 'w2', title: 'Kenyan shilling steadies as central bank intervenes', sourceName: 'Pub C', url: 'https://c.example/9', sourceId: 'gnews', publishedAt: '2026-10-11T09:00:00Z' },
    ] as never);
    expect(div.reportingClusterCount).toBe(1);
    expect(div.distinctSourceNameCount).toBe(2);
    expect(contributesJournalisticCorroboration('gnews')).toBe(false);
    expect(contributesJournalisticCorroboration(undefined)).toBe(false);
  });
});

/* ═════════════════════════ B · DR CONGO vs REPUBLIC OF THE CONGO ═════════════════════════ */
describe('EA-GEO-B COD/COG identity through the Ask handoff', () => {
  it('B-01 the English D0.1 drafts keep the chosen identity in the Ask route', () => {
    expect(routeGeo(d01Draft('en', 'CD'))).toEqual(['COD']);
    expect(routeGeo(d01Draft('en', 'CG'))).toEqual(['COG']);
  });

  it('B-02 "this week" is never silently dropped: it is offered, not applied (BROADENING_OFFERED)', () => {
    const plan = route(d01Draft('en', 'CD')).plan;
    expect(plan.terminalState).toBe('BROADENING_OFFERED');
    expect(plan.constraints.find((c: { axis: string }) => c.axis === 'TIME')).toMatchObject({ carried: false, refusal: 'CONSTRAINT_UNTRANSPORTABLE' });
  });

  it.failing.each([
    'What changed in Congo - Kinshasa',
    'Latest news in Congo - Kinshasa',
    'What is happening in Congo (Kinshasa)',
    'What changed in Congo - Kinshasa over the last 7 days',
  ])('B-03 HOLD-P0 Analysis never retrieves Congo-Brazzaville for a Congo-Kinshasa question: %s', (q) => {
    expect(routeGeo(q)).toEqual(['COD']); /* the route is already right … */
    expect(analysisTypedCountry(q)).not.toBe('COG'); /* … Analysis's typed country feed is COG today */
  });

  it.each([
    ['What changed in Congo - Brazzaville', 'COG'],
    ['What changed in DR Congo', 'COD'],
    ['What changed in RDC', 'COD'],
    ['What changed this week in Kinshasa', 'COD'],
    ['What is happening in Congo Kinshasa', 'COD'],
  ])('B-04 explicit forms keep working at Analysis: %s → %s', (q, iso3) => {
    expect(analysisTypedCountry(q)).toBe(iso3);
  });

  it.each(['What changed this week in Congo', 'Cholera outbreak in Congo this week'])(
    'B-05 a bare "Congo" proves neither country: %s',
    (q) => {
      expect(detectAmbiguousCountryMention(q)).toMatchObject({ candidates: ['COD', 'COG'] });
      expect(analysisTypedCountry(q)).toBeUndefined();
      expect(routeGeo(q)).toEqual([]);
    },
  );

  it.each(['What changed this week with M23?', 'What did Congolese officials say this week?'])(
    'B-06 an actor or a demonym alone is not a country scope: %s',
    (q) => {
      expect(routeGeo(q)).toEqual([]);
      expect(analysisTypedCountry(q)).toBeUndefined();
    },
  );

  /* The draft a reader gets after choosing a place must reach Ask as that place in EVERY locale. */
  const HANDOFF_OK = [['en', 'CG'], ['fr', 'CD'], ['fr', 'CG'], ['de', 'CD'], ['de', 'CG'], ['pt', 'CD'], ['ar', 'CD'], ['ar', 'CG']] as const;
  const HANDOFF_HOLD = [['en', 'CD'], ['pl', 'CD'], ['pl', 'CG'], ['es', 'CD'], ['es', 'CG'], ['pt', 'CG']] as const;
  const iso3Of = { CD: 'COD', CG: 'COG' } as const;
  const handoffHolds = (locale: string, iso2: 'CD' | 'CG'): void => {
    const q = d01Draft(locale, iso2);
    expect(routeGeo(q, locale)).toEqual([iso3Of[iso2]]);
    expect(detectAmbiguousCountryMention(q)).toBeUndefined();
    expect([undefined, iso3Of[iso2]]).toContain(analysisTypedCountry(q));
  };
  it.each(HANDOFF_OK)('B-07 D0.1 handoff keeps identity (%s, %s)', (locale, iso2) => handoffHolds(locale, iso2));
  it.failing.each(HANDOFF_HOLD)('B-08 HOLD D0.1 handoff loses or flips identity (%s, %s)', (locale, iso2) => handoffHolds(locale, iso2));

  it.failing('B-09 HOLD-P0 the Polish DR Congo name is never Tonga', () => {
    for (const q of ['Co zmieniło się w Demokratyczna Republika Konga', 'Co zmieniło się w Demokratycznej Republice Konga']) {
      expect(routeGeo(q, 'pl')).not.toContain('TON');
      expect((resolveGeography(q) as any).place?.country?.iso3).not.toBe('TON');
    }
  });

  it.failing.each([
    ['fr', 'Quoi de neuf en République démocratique du Congo'],
    ['fr', 'Quoi de neuf en RD Congo'],
    ['es', '¿Qué ha cambiado en la República Democrática del Congo?'],
    ['pt', 'O que mudou na República Democrática do Congo?'],
  ])('B-10 HOLD a long-form DR Congo name is not ambiguous (%s: %s)', (_lang, q) => {
    expect(detectAmbiguousCountryMention(q)).toBeUndefined();
    expect(congoReadingOf(q) === 'COD' || (resolveGeography(q) as any).place?.country?.iso3 === 'COD').toBe(true);
  });

  it.failing('B-11 HOLD the Kinyarwanda DR Congo name never resolves to Congo-Brazzaville', () => {
    expect((resolveGeography('What changed in Repubulika Iharanira Demokarasi ya Kongo') as any).place?.country?.iso3).not.toBe('COG');
  });

  it.failing('B-12 HOLD a stated "past week" is applied or disclosed, never silently dropped', () => {
    const r = route('What changed in Congo - Kinshasa in the past week');
    const timeConstraint = r.plan.constraints.find((c: { axis: string }) => c.axis === 'TIME');
    expect(r.reportingWindow?.hours === 168 || timeConstraint !== undefined).toBe(true);
  });

  it('B-13 supported relative windows are applied on the publication basis', () => {
    expect(route('What changed in Congo - Kinshasa over the last 7 days').reportingWindow).toMatchObject({ hours: 168, basis: 'PUBLICATION_TIME' });
    expect(route('What changed in Congo - Kinshasa since yesterday').reportingWindow).toMatchObject({ hours: 48 });
  });
});

/* ═════════════════════════ C · REPORTING-CHAIN INTEGRITY ═════════════════════════ */
describe('EA-GEO-C event country of a report', () => {
  it.each([
    ['Fighting resumes near Goma in eastern DR Congo', 'Clashes were reported north of Goma in North Kivu.', 'CD'],
    ['Floods hit Kinshasa neighbourhoods', 'Heavy rain flooded parts of the capital.', 'CD'],
    ['Les combats reprennent à Goma', '', 'CD'],
    ['Danish Refugee Council scales up aid in eastern DR Congo', 'The agency expanded support in South Kivu.', 'CD'],
    ['Kinshasa-based analysts say Angola oil output fell', 'Angola produced less crude in September.', 'AO'],
    ['Congolese refugees arrive in Uganda', 'Hundreds crossed into Kisoro district.', 'UG'],
    ['Republic of the Congo awards oil blocks', '', 'CG'],
    ['Congo-Brazzaville awards oil blocks', '', 'CG'],
    ["Rwanda's central bank holds key rate at 6.5%", 'The National Bank of Rwanda kept its policy rate unchanged.', 'RW'],
  ])('C-01 PASS %s → %s', (title, summary, cc) => {
    expect(primary(title, summary)).toBe(cc);
  });

  it.each([
    ['Congo: cholera cases rise', 'Health officials reported more cases.'],
    ['M23 statement criticises new sanctions', 'The rebel group said the measures were unfair.'],
    ['Methane project on Lake Kivu delayed', 'The gas extraction project faces new delays.'],
  ])('C-02 PASS no single country is proven: %s', (title, summary) => {
    expect(primary(title, summary)).toBe('NONE');
  });

  it('C-03 PRESERVED HOLD (D-21): the GOICO/Musanze sentinel stays unresolved until D-21 is qualified — never a wrong country', () => {
    expect(primary('Fire guts GOICO market in Musanze', 'Traders in Musanze counted losses after the blaze.')).toBe('NONE');
  });

  it.failing('C-04 HOLD an actor\'s nationality is not the event location (Rwanda named as actor, event in eastern DR Congo)', () => {
    expect(primary('Rwanda accused of backing M23 in eastern Congo', 'A UN report said Rwandan troops operated in North Kivu.')).not.toBe('RW');
  });

  it.failing.each([
    ['Brazzaville announces new oil exploration licences', 'The Republic of the Congo awarded three blocks.', 'CG'],
    ['Oil blocks awarded in Brazzaville', '', 'CG'],
    ['Pointe-Noire port expands', '', 'CG'],
    ['RDC : les combats reprennent au Nord-Kivu', 'Des affrontements ont été signalés près de Goma.', 'CD'],
    ['DRC: fighting resumes in North Kivu', '', 'CD'],
  ])('C-05 HOLD-RECALL a qualified place resolves: "%s" + "%s" → %s (remedy must respect the D-21 / no-blind-curated-city rulings)', (title, summary, cc) => {
    expect(primary(title, summary)).toBe(cc);
  });
});

/* ═════════════════════════ D · SOURCE RIGHTS (guard) ═════════════════════════ */
describe('EA-GEO-D East Africa sources stay dormant until E1', () => {
  it('D-01 no East Africa feed is enabled or recorded CLEARED in the shipped registry', () => {
    const ea = (FEED_SOURCES as ReadonlyArray<{ countryCode: string; enabled: boolean; rights: { state: string } }>).filter((f) =>
      ['RW', 'KE', 'TZ', 'UG', 'CD', 'BI', 'SS', 'ET', 'SO', 'DJ', 'ER'].includes(f.countryCode),
    );
    expect(ea.length).toBeGreaterThan(0);
    expect(ea.every((f) => f.enabled === false && f.rights.state !== 'CLEARED')).toBe(true);
  });
});
