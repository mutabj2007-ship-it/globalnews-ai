import { writeFileSync } from 'node:fs';
import { routeAskR2, type AskR2Route, type AskRouteContext } from '../ask-r2-route';
import { specialistRegistryFixture } from '../frozen-c/fixtures/specialist-registry.fixture';
import { readConversationalTurn } from '../../ask-v2/conversation/conversation-state';
import { semanticReaderText } from './interpret-turn';
import { validateSemanticTurnIR } from './semantic-turn-ir';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §22 — PROPERTY / METAMORPHIC GATE (before any new sealed evaluation)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Cases are GENERATED from a seeded grammar over its own pools (countries with their Polish case
 * forms, venue cities, disputed regions, concepts, objective cues) — never from the inspected
 * sealed / blind literal phrases. Every generated turn is checked for:
 *
 *   VALIDITY     the IR validates against its closed schema and invariants (a city is never an
 *                actor, an object / venue never replaces an actor, spans are the reader's words)
 *   ROUTING      §6 — news only when the IR requires current evidence (or the one bounded
 *                interpretation is still pending); an IR CURRENT turn is never answered as
 *                background only
 *   INVARIANCE   capitalisation · punctuation · fillers · contractions · actor order · tense with
 *                the same time · venue insertion / removal · Polish grammatical case · EN / PL ·
 *                clause separators — the semantic class does not change
 *   SENSITIVITY  adding "current" makes a stable frame current · "in 1987" → "today" changes the
 *                temporal role · a venue turned into an explicit actor changes the actors
 */
const DEPS = { specialistRegistry: specialistRegistryFixture };
const INSTANT = '2026-10-03T12:00:00Z';

/* ── seeded generator ────────────────────────────────────────────────────────────────────── */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* the committed seed; SEMANTIC_PROPERTY_SEED re-draws every family (robustness runs) */
const SEED = Number(process.env.SEMANTIC_PROPERTY_SEED ?? 20261003);
const rnd = mulberry32(SEED);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
function pickPair<T>(xs: readonly T[]): [T, T] {
  const a = pick(xs);
  let b = pick(xs);
  while (b === a) b = pick(xs);
  return [a, b];
}
const CASES_PER_FAMILY = 24;

/* ── pools (generator-owned) ─────────────────────────────────────────────────────────────── */
interface Country {
  readonly iso3: string;
  readonly en: string;
  readonly pl: {
    readonly nom: string;
    readonly gen: string;
    readonly instr: string;
    readonly loc: string;
  };
}
const COUNTRIES: readonly Country[] = [
  {
    iso3: 'BRA',
    en: 'Brazil',
    pl: { nom: 'Brazylia', gen: 'Brazylii', instr: 'Brazylią', loc: 'Brazylii' },
  },
  {
    iso3: 'ARG',
    en: 'Argentina',
    pl: { nom: 'Argentyna', gen: 'Argentyny', instr: 'Argentyną', loc: 'Argentynie' },
  },
  {
    iso3: 'DEU',
    en: 'Germany',
    pl: { nom: 'Niemcy', gen: 'Niemiec', instr: 'Niemcami', loc: 'Niemczech' },
  },
  {
    iso3: 'FRA',
    en: 'France',
    pl: { nom: 'Francja', gen: 'Francji', instr: 'Francją', loc: 'Francji' },
  },
  {
    iso3: 'EGY',
    en: 'Egypt',
    pl: { nom: 'Egipt', gen: 'Egiptu', instr: 'Egiptem', loc: 'Egipcie' },
  },
  {
    iso3: 'ETH',
    en: 'Ethiopia',
    pl: { nom: 'Etiopia', gen: 'Etiopii', instr: 'Etiopią', loc: 'Etiopii' },
  },
  { iso3: 'KEN', en: 'Kenya', pl: { nom: 'Kenia', gen: 'Kenii', instr: 'Kenią', loc: 'Kenii' } },
  {
    iso3: 'UGA',
    en: 'Uganda',
    pl: { nom: 'Uganda', gen: 'Ugandy', instr: 'Ugandą', loc: 'Ugandzie' },
  },
  {
    iso3: 'NOR',
    en: 'Norway',
    pl: { nom: 'Norwegia', gen: 'Norwegii', instr: 'Norwegią', loc: 'Norwegii' },
  },
  {
    iso3: 'VNM',
    en: 'Vietnam',
    pl: { nom: 'Wietnam', gen: 'Wietnamu', instr: 'Wietnamem', loc: 'Wietnamie' },
  },
  {
    iso3: 'KHM',
    en: 'Cambodia',
    pl: { nom: 'Kambodża', gen: 'Kambodży', instr: 'Kambodżą', loc: 'Kambodży' },
  },
  {
    iso3: 'MAR',
    en: 'Morocco',
    pl: { nom: 'Maroko', gen: 'Maroka', instr: 'Marokiem', loc: 'Maroku' },
  },
  {
    iso3: 'DZA',
    en: 'Algeria',
    pl: { nom: 'Algieria', gen: 'Algierii', instr: 'Algierią', loc: 'Algierii' },
  },
  {
    iso3: 'SRB',
    en: 'Serbia',
    pl: { nom: 'Serbia', gen: 'Serbii', instr: 'Serbią', loc: 'Serbii' },
  },
  {
    iso3: 'HRV',
    en: 'Croatia',
    pl: { nom: 'Chorwacja', gen: 'Chorwacji', instr: 'Chorwacją', loc: 'Chorwacji' },
  },
  {
    iso3: 'THA',
    en: 'Thailand',
    pl: { nom: 'Tajlandia', gen: 'Tajlandii', instr: 'Tajlandią', loc: 'Tajlandii' },
  },
  {
    iso3: 'MYS',
    en: 'Malaysia',
    pl: { nom: 'Malezja', gen: 'Malezji', instr: 'Malezją', loc: 'Malezji' },
  },
  {
    iso3: 'NGA',
    en: 'Nigeria',
    pl: { nom: 'Nigeria', gen: 'Nigerii', instr: 'Nigerią', loc: 'Nigerii' },
  },
  { iso3: 'GHA', en: 'Ghana', pl: { nom: 'Ghana', gen: 'Ghany', instr: 'Ghaną', loc: 'Ghanie' } },
  {
    iso3: 'ESP',
    en: 'Spain',
    pl: { nom: 'Hiszpania', gen: 'Hiszpanii', instr: 'Hiszpanią', loc: 'Hiszpanii' },
  },
  {
    iso3: 'PRT',
    en: 'Portugal',
    pl: { nom: 'Portugalia', gen: 'Portugalii', instr: 'Portugalią', loc: 'Portugalii' },
  },
  {
    iso3: 'HUN',
    en: 'Hungary',
    pl: { nom: 'Węgry', gen: 'Węgier', instr: 'Węgrami', loc: 'Węgrzech' },
  },
  {
    iso3: 'AUT',
    en: 'Austria',
    pl: { nom: 'Austria', gen: 'Austrii', instr: 'Austrią', loc: 'Austrii' },
  },
  {
    iso3: 'IDN',
    en: 'Indonesia',
    pl: { nom: 'Indonezja', gen: 'Indonezji', instr: 'Indonezją', loc: 'Indonezji' },
  },
];
/* venue cities, in countries outside the pool so a venue can never be confused with an actor */
const VENUES_EN = [
  'Vienna',
  'Oslo',
  'Helsinki',
  'Brussels',
  'Cairo',
  'Bangkok',
  'Nairobi',
  'Accra',
  'Lisbon',
];
const VENUES_PL = ['Genewie', 'Helsinkach', 'Brukseli', 'Kairze', 'Wiedniu', 'Lizbonie'];
const VENUE_COUNTRY: Readonly<Record<string, string>> = {
  Vienna: 'AUT',
  Oslo: 'NOR',
  Helsinki: 'FIN',
  Brussels: 'BEL',
  Cairo: 'EGY',
  Bangkok: 'THA',
  Nairobi: 'KEN',
  Accra: 'GHA',
  Lisbon: 'PRT',
};
const REGIONS_EN = [
  'Kashmir',
  'Crimea',
  'the Golan Heights',
  'the Spratly Islands',
  'Essequibo',
  'Transnistria',
  'the Chagos Islands',
];
const REGIONS_PL = ['Kaszmir', 'Krym', 'Naddniestrze', 'Wzgórza Golan'];
const CONCEPTS_EN = [
  'a sovereign wealth fund',
  'quantitative tightening',
  'a currency board',
  'a carbon tax',
  'collective bargaining',
  'fiscal federalism',
  'a trade surplus',
  'inflation targeting',
  'a sovereign default',
];
const CONCEPTS_PL = [
  'fundusz suwerenny',
  'izba walutowa',
  'podatek węglowy',
  'układ zbiorowy',
  'federalizm fiskalny',
  'nadwyżka handlowa',
  'cel inflacyjny',
];
const STATE_FRAMES = [
  'reserve requirement for commercial banks',
  'minimum wage rule for apprentices',
  'tariff schedule for imported steel',
  'deposit insurance limit for savers',
];

/* ── classification of one turn ──────────────────────────────────────────────────────────── */
interface Observed {
  readonly route: AskR2Route;
  readonly cls: string;
  readonly news: boolean | 'PENDING';
  readonly actors: string;
  readonly violations: readonly string[];
}
function observe(q: string, lang: 'en' | 'pl', ctx: AskRouteContext = {}): Observed {
  const route = routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: INSTANT, ...ctx },
    DEPS,
  );
  const ir = route.semantic;
  const planNews =
    route.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
    route.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';
  const news: boolean | 'PENDING' =
    ir.resolution.needsSemanticResolution && route.job.source === 'UNRESOLVED'
      ? 'PENDING'
      : planNews;
  const actors = [...(route.relationship?.countries ?? [])].sort().join('+');
  const violations = [...validateSemanticTurnIR(ir, semanticReaderText(q, lang))];
  /* §6 — news only when the IR requires current evidence */
  if (news === true && ir.turn.evidence !== 'CURRENT_REPORTING' && ir.turn.evidence !== 'OFFICIAL')
    violations.push('NEWS_WITHOUT_CURRENT_IR');
  /* an IR CURRENT turn is never background-only */
  if (
    ir.turn.freshness === 'CURRENT' &&
    !ir.resolution.needsSemanticResolution &&
    route.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY'
  )
    violations.push('CURRENT_IR_ANSWERED_AS_BACKGROUND');
  const mixed =
    route.knowledgeRequirement === 'MIXED_REFERENCE_CURRENT' ||
    route.knowledgeRequirement === 'MIXED_ADVISORY_CURRENT';
  return {
    route,
    news,
    actors,
    violations,
    cls: `${ir.turn.freshness}|mixed=${mixed}|news=${news}|actors=${actors}|ref=${route.job.discourseReference}`,
  };
}

/* ── harmless transforms (invariance) ────────────────────────────────────────────────────── */
type Transform = readonly [string, (q: string, lang: 'en' | 'pl') => string];
const lower: Transform = ['lowercase', (q) => q.toLowerCase()];
const noFinalPunct: Transform = ['no-final-punctuation', (q) => q.replace(/[?.!]+\s*$/u, '')];
const filler: Transform = [
  'filler',
  (q, lang) =>
    `${lang === 'pl' ? pick(['dobra, ', 'no to ', 'ok, ']) : pick(['ok so ', 'well, ', 'um, ', 'hey, '])}${q.charAt(0).toLowerCase()}${q.slice(1)}`,
];
const contraction: Transform = [
  'contraction',
  (q, lang) =>
    lang === 'pl'
      ? q
      : q
          .replace(/\bWhat is\b/g, "What's")
          .replace(/\bwhat is\b/g, "what's")
          .replace(/\bHow is\b/g, "How's")
          .replace(/\bWhy did\b/g, "Why'd")
          .replace(/\bdo not\b/g, "don't")
          .replace(/\bis not\b/g, "isn't"),
];
const HARMLESS: readonly Transform[] = [lower, noFinalPunct, filler, contraction];

interface FamilyResult {
  readonly family: string;
  readonly cases: number;
  readonly checks: number;
  readonly failures: string[];
}
const RESULTS: FamilyResult[] = [];

function runFamily(
  family: string,
  make: () => Array<{
    q: string;
    lang: 'en' | 'pl';
    expect: (o: Observed) => string | null;
    variants?: Array<{ name: string; q: string; same: boolean }>;
    ctx?: AskRouteContext;
  }>,
): FamilyResult {
  const failures: string[] = [];
  let checks = 0;
  const cases = make();
  for (const c of cases) {
    const base = observe(c.q, c.lang, c.ctx);
    checks++;
    if (base.violations.length > 0) failures.push(`${c.q} → ${base.violations.join(',')}`);
    const why = c.expect(base);
    checks++;
    if (why !== null) failures.push(`${c.q} → ${why} [${base.cls}]`);
    const variants = [
      ...HARMLESS.map(([name, f]) => ({ name, q: f(c.q, c.lang), same: true })),
      ...(c.variants ?? []),
    ].filter((v) => v.q !== c.q);
    for (const v of variants) {
      const o = observe(v.q, c.lang, c.ctx);
      checks++;
      if (o.violations.length > 0) failures.push(`[${v.name}] ${v.q} → ${o.violations.join(',')}`);
      checks++;
      if (v.same && o.cls !== base.cls)
        failures.push(`[${v.name}] INVARIANCE ${v.q}\n      ${o.cls}\n   vs ${base.cls}`);
      if (!v.same && o.cls === base.cls)
        failures.push(`[${v.name}] SENSITIVITY ${v.q} unchanged ${o.cls}`);
    }
  }
  const r = { family, cases: cases.length, checks, failures };
  RESULTS.push(r);
  return r;
}

const times = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));
const year = (): number => 1950 + Math.floor(rnd() * 50);

describe('CTO R4 semantic IR §22 — generated property / metamorphic families', () => {
  afterAll(() => {
    if (process.env.SEMANTIC_PROPERTY_REPORT)
      writeFileSync(
        process.env.SEMANTIC_PROPERTY_REPORT,
        JSON.stringify(
          {
            seed: SEED,
            families: RESULTS.map((r) => ({
              family: r.family,
              cases: r.cases,
              checks: r.checks,
              failures: r.failures.length,
            })),
            totalChecks: RESULTS.reduce((n, r) => n + r.checks, 0),
            failures: RESULTS.flatMap((r) => r.failures.map((f) => `${r.family}: ${f}`)),
          },
          null,
          2,
        ),
      );
  });

  it('1 · pure conceptual (EN / PL) — never current, never news', () => {
    const r = runFamily('conceptual', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const q =
          lang === 'en'
            ? pick([
                `Explain how ${pick(CONCEPTS_EN)} works.`,
                `What is ${pick(CONCEPTS_EN)}?`,
                `Why does ${pick(CONCEPTS_EN)} matter for small economies?`,
                `Describe the main idea behind ${pick(CONCEPTS_EN)}.`,
              ])
            : pick([
                `Wyjaśnij, jak działa ${pick(CONCEPTS_PL)}.`,
                `Czym jest ${pick(CONCEPTS_PL)}?`,
                `Na czym polega ${pick(CONCEPTS_PL)}?`,
              ]);
        return {
          q,
          lang,
          expect: (o) =>
            o.route.semantic.turn.freshness !== 'NONE'
              ? 'conceptual read as current'
              : o.news === true
                ? 'conceptual sent to news'
                : null,
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('2 · current factual (EN / PL) — current evidence, news', () => {
    const r = runFamily('current-factual', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const c = pick(COUNTRIES);
        const q =
          lang === 'en'
            ? pick([
                `What happened in ${c.en} today?`,
                `What is the latest news from ${c.en}?`,
                `Is the ceasefire in ${c.en} still holding?`,
                `What has ${c.en}'s government announced this week?`,
              ])
            : pick([
                `Co wydarzyło się dzisiaj w ${c.pl.loc}?`,
                `Jakie są najnowsze wiadomości z ${c.pl.gen}?`,
                `Co ogłosił rząd ${c.pl.gen} w tym tygodniu?`,
              ]);
        return {
          q,
          lang,
          expect: (o) =>
            o.route.semantic.turn.freshness !== 'CURRENT'
              ? 'current read as not current'
              : o.news !== true
                ? 'current not sent to news'
                : null,
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('3 · MIXED (EN / PL) — both components survive any clause separator', () => {
    const r = runFamily('mixed', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const c = pick(COUNTRIES);
        const stable =
          lang === 'en'
            ? pick([
                `I understand what ${pick(CONCEPTS_EN)} is in theory`,
                `Explain how ${pick(CONCEPTS_EN)} works`,
                `Why do governments use ${pick(CONCEPTS_EN)}`,
              ])
            : pick([
                `Wyjaśnij, jak działa ${pick(CONCEPTS_PL)}`,
                `Na czym polega ${pick(CONCEPTS_PL)}`,
              ]);
        const current =
          lang === 'en'
            ? pick([
                `what is the latest on it in ${c.en}?`,
                `has ${c.en} changed its approach this week?`,
                `is ${c.en} still using it right now?`,
              ])
            : pick([
                `co nowego w tej sprawie w ${c.pl.loc} w tym tygodniu?`,
                `czy ${c.pl.nom} nadal to stosuje?`,
              ]);
        const seps =
          lang === 'en' ? [', and ', '; ', ' — ', '. ', ' - '] : [', a ', '; ', ' — ', '. '];
        const join = (sep: string) =>
          `${stable}${sep}${sep === '. ' ? current.charAt(0).toUpperCase() + current.slice(1) : current}`;
        return {
          q: join(seps[0]),
          lang,
          expect: (o) =>
            !o.cls.includes('mixed=true')
              ? 'mixed component erased'
              : o.news === false
                ? 'mixed current part lost'
                : null,
          variants: seps
            .slice(1)
            .map((s) => ({ name: `separator ${JSON.stringify(s)}`, q: join(s), same: true })),
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('4 · historical bilateral (EN / PL) — both actors, no news; order / case / tense invariant; date → today is sensitive', () => {
    const r = runFamily('historical-bilateral', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const [a, b] = pickPair(COUNTRIES);
        const y = year();
        const pair = [a.iso3, b.iso3].sort().join('+');
        if (lang === 'en') {
          const t = pick([0, 1, 2]);
          const mk = (x: Country, z: Country, when: string) =>
            [
              `Why did ${x.en} and ${z.en} go to war ${when}?`,
              `What caused the dispute between ${x.en} and ${z.en} ${when}?`,
              `Why did ${x.en} and ${z.en} sign a peace treaty ${when}?`,
            ][t];
          return {
            q: mk(a, b, `in ${y}`),
            lang,
            expect: (o) =>
              o.actors !== pair
                ? `actors ${o.actors} ≠ ${pair}`
                : o.news !== false
                  ? 'historical sent to news'
                  : null,
            variants: [
              { name: 'actor order', q: mk(b, a, `in ${y}`), same: true },
              ...(t === 0
                ? [
                    {
                      name: 'tense, same time',
                      q: `Why had ${a.en} and ${b.en} gone to war in ${y}?`,
                      same: true,
                    },
                  ]
                : []),
              {
                name: 'date → today',
                q: mk(a, b, 'today')
                  .replace('Why did', 'Why have')
                  .replace(' go to war', ' gone to war')
                  .replace(' sign ', ' signed '),
                same: false,
              },
            ],
          };
        }
        const mkPl = (x: Country, z: Country, when: string) =>
          `Co spowodowało spór ${x.pl.gen} i ${z.pl.gen} ${when}?`;
        return {
          q: mkPl(a, b, `w ${y} roku`),
          lang,
          expect: (o) =>
            o.actors !== pair
              ? `actors ${o.actors} ≠ ${pair}`
              : o.news !== false
                ? 'historical sent to news'
                : null,
          variants: [
            { name: 'actor order', q: mkPl(b, a, `w ${y} roku`), same: true },
            {
              name: 'grammatical case (genitive coordination → między + instrumental)',
              q: `Co spowodowało spór między ${a.pl.instr} a ${b.pl.instr} w ${y} roku?`,
              same: true,
            },
            {
              name: 'grammatical case (comitative)',
              q: `Co spowodowało spór ${a.pl.gen} z ${b.pl.instr} w ${y} roku?`,
              same: true,
            },
            {
              name: 'date → today',
              q: `Jaki spór toczą dzisiaj ${a.pl.nom} i ${b.pl.nom}?`,
              same: false,
            },
          ],
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('5 · two actors + venue (EN / PL) — the city is a VENUE, never an actor; venue insertion invariant; venue → actor sensitive', () => {
    const r = runFamily('actors-venue', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const [a, b] = pickPair(COUNTRIES);
        const pair = [a.iso3, b.iso3].sort().join('+');
        const expectVenue = (o: Observed): string | null => {
          if (o.actors !== pair) return `actors ${o.actors} ≠ ${pair}`;
          const city = o.route.semantic.entities.find((e) => e.type === 'CITY');
          if (city === undefined) return 'venue city not read';
          if (city.role !== 'VENUE') return `city role ${city.role}`;
          return o.news !== true ? 'current talks not sent to news' : null;
        };
        if (lang === 'en') {
          let v = pick(VENUES_EN);
          while (VENUE_COUNTRY[v] === a.iso3 || VENUE_COUNTRY[v] === b.iso3) v = pick(VENUES_EN);
          let third = pick(COUNTRIES);
          while (third === a || third === b) third = pick(COUNTRIES);
          const t = pick([0, 1]);
          const mk = (x: Country, z: Country, venue: string) =>
            [
              `What came out of the talks between ${x.en} and ${z.en}${venue} this week?`,
              `Are the negotiations between ${x.en} and ${z.en}${venue} still going on?`,
            ][t];
          return {
            q: mk(a, b, ` in ${v}`),
            lang,
            expect: expectVenue,
            variants: [
              { name: 'actor order', q: mk(b, a, ` in ${v}`), same: true },
              { name: 'venue → explicit actor', q: mk(a, third, ''), same: false },
            ],
          };
        }
        const v = pick(VENUES_PL);
        return {
          q: `Co dały rozmowy ${a.pl.gen} z ${b.pl.instr} w ${v} w tym tygodniu?`,
          lang,
          expect: expectVenue,
          variants: [
            {
              name: 'grammatical case (między + instrumental)',
              q: `Co dały rozmowy między ${a.pl.instr} a ${b.pl.instr} w ${v} w tym tygodniu?`,
              same: true,
            },
          ],
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('6 · two actors + disputed object (EN / PL) — the object never replaces an actor', () => {
    const r = runFamily('actors-object', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const [a, b] = pickPair(COUNTRIES);
        const pair = [a.iso3, b.iso3].sort().join('+');
        const expectObject = (o: Observed): string | null => {
          if (o.actors !== pair) return `actors ${o.actors} ≠ ${pair}`;
          const region = o.route.semantic.entities.find((e) => e.type === 'REGION');
          if (region === undefined) return 'disputed region not read';
          if (region.role !== 'DISPUTED_OBJECT') return `region role ${region.role}`;
          return null;
        };
        if (lang === 'en') {
          const reg = pick(REGIONS_EN);
          const t = pick([0, 1, 2]);
          const mk = (x: Country, z: Country) =>
            [
              `Are ${x.en} and ${z.en} still arguing over ${reg}?`,
              `What is the latest in the dispute between ${x.en} and ${z.en} over ${reg}?`,
              `Has ${x.en} pressed its claim against ${z.en} over ${reg} recently?`,
            ][t];
          return {
            q: mk(a, b),
            lang,
            expect: expectObject,
            variants: t === 2 ? [] : [{ name: 'actor order', q: mk(b, a), same: true }],
          };
        }
        const reg = pick(REGIONS_PL);
        return {
          q: `Czy ${a.pl.nom} i ${b.pl.nom} nadal spierają się o ${reg}?`,
          lang,
          expect: expectObject,
          variants: [
            {
              name: 'grammatical case (spór między + instrumental)',
              q: `Czy spór między ${a.pl.instr} a ${b.pl.instr} o ${reg} nadal trwa?`,
              same: true,
            },
          ],
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('7 · inherited objective (EN / PL) — several turns back, structured, newest wins; never "best for what?"', () => {
    const failures: string[] = [];
    let checks = 0;
    const cuesEn = [
      (x: string) => `What matters most to me is ${x}.`,
      (x: string) => `The thing that matters most to me is ${x}.`,
      (x: string) => `My priority is ${x}.`,
      (x: string) => `Our goal is ${x}.`,
    ];
    const cuesPl = [
      (x: string) => `Najważniejsze dla mnie jest ${x}.`,
      (x: string) => `Zależy mi na tym, żeby ${x}.`,
      (x: string) => `Moim priorytetem jest ${x}.`,
    ];
    const criteriaEn = [
      'the lowest implementation risk',
      'keeping monthly costs predictable even if growth is slower',
      'access to experienced engineers within a short commute of the office',
      'reliability over raw speed',
    ];
    const criteriaPl = [
      'niskie ryzyko wdrożenia',
      'przewidywalne koszty miesięczne',
      'dostęp do doświadczonych inżynierów',
    ];
    const fillersEn = [
      'How do the first two compare on cost?',
      'Is the third one harder to set up?',
      'What are the trade-offs?',
    ];
    const fillersPl = [
      'Jak wypadają dwie pierwsze pod względem kosztów?',
      'Czy trzecia jest trudniejsza we wdrożeniu?',
    ];
    for (let i = 0; i < CASES_PER_FAMILY; i++) {
      const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
      const crit = lang === 'en' ? pick(criteriaEn) : pick(criteriaPl);
      const objectiveTurn = lang === 'en' ? pick(cuesEn)(crit) : pick(cuesPl)(crit);
      const options =
        lang === 'en'
          ? "I'm comparing three vendors: Alder, Birch and Cedar."
          : 'Porównuję trzech dostawców: Alder, Birch i Cedar.';
      const middle = times(1 + (i % 3), () => (lang === 'en' ? pick(fillersEn) : pick(fillersPl)));
      const overrideNewer = i % 4 === 3;
      const newer =
        lang === 'en'
          ? 'My priority is the shortest time to launch.'
          : 'Moim priorytetem jest najkrótszy czas wdrożenia.';
      const finalQ =
        lang === 'en'
          ? pick(['So which one is best?', 'Which one would you pick?', 'Which should I go with?'])
          : pick(['Który wybrać?', 'Które z nich polecasz?']);
      const turns = [objectiveTurn, options, ...middle, ...(overrideNewer ? [newer] : [])];
      const earlierNewestFirst = [...turns].reverse().map((q) => ({ question: q, language: lang }));
      const turn = readConversationalTurn(finalQ, lang, earlierNewestFirst);
      const o = observe(finalQ, lang, {
        conversation: {
          ...(turn?.objective ? { objective: turn.objective } : {}),
          ...(turn?.choiceSet ? { choiceSet: turn.choiceSet } : {}),
        },
        ...(turn?.turnIndex === undefined ? {} : { turnIndex: turn.turnIndex }),
      });
      checks += 4;
      if (o.violations.length > 0) failures.push(`${finalQ} → ${o.violations.join(',')}`);
      const want = overrideNewer
        ? lang === 'en'
          ? 'the shortest time to launch'
          : 'najkrótszy czas wdrożenia'
        : crit;
      if (o.route.decisionObjective === null)
        failures.push(`"best for what?" asked [${turns.join(' | ')} → ${finalQ}]`);
      else if (!o.route.decisionObjective.includes(want.split(' ').slice(0, 3).join(' ')))
        failures.push(`objective "${o.route.decisionObjective}" ≠ newest "${want}"`);
      if (o.route.job.discourseReference !== 'PRIOR_WORK')
        failures.push(`${finalQ}: reference ${o.route.job.discourseReference}`);
      if (o.news === true) failures.push(`${finalQ}: sent to news`);
      /* nothing the reader said is lost: criterion + constraints cover every word of the objective */
      if (turn?.objective) {
        const whole = [turn.objective.criterion, ...turn.objective.constraints].join(' ');
        if (want.split(' ').some((w) => !whole.includes(w)))
          failures.push(`objective truncated: "${whole}" ⊉ "${want}"`);
      }
    }
    RESULTS.push({ family: 'inherited-objective', cases: CASES_PER_FAMILY, checks, failures });
    expect(failures).toEqual([]);
  });

  it('8 · artifact continuation (EN / PL) — resolved against the earlier work, zero news, never "best for what?"', () => {
    const r = runFamily('artifact-continuation', () =>
      times(CASES_PER_FAMILY, (i) => {
        const lang: 'en' | 'pl' = i % 3 === 2 ? 'pl' : 'en';
        const q =
          lang === 'en'
            ? pick([
                `Which of those ${pick(['recommendations', 'arguments', 'risks', 'steps'])} is weakest?`,
                `Which ${pick(['recommendation', 'argument', 'assumption'])} matters most?`,
                'Turn that into a checklist.',
                'Which part is the most fragile?',
              ])
            : pick([
                'Który z tych argumentów jest najsłabszy?',
                'Która rekomendacja jest najważniejsza?',
                'Zamień to w listę kontrolną.',
              ]);
        return {
          q,
          lang,
          ctx: { priorWork: { kind: 'RECOMMENDATION', label: 'earlier recommendations' } },
          expect: (o) =>
            o.route.job.discourseReference !== 'PRIOR_WORK'
              ? 'earlier work not referenced'
              : o.news !== false
                ? 'continuation sent to news'
                : o.route.knowledgeRequirement === 'DECISION_SUPPORT' &&
                    o.route.decisionObjective === null
                  ? '"best for what?" on a component evaluation'
                  : null,
        };
      }),
    );
    expect(r.failures).toEqual([]);
  });

  it('9 · sensitivity — explicit "current" turns a stable frame current', () => {
    const failures: string[] = [];
    for (const f of STATE_FRAMES) {
      const base = observe(`What is the ${f}?`, 'en');
      const cur = observe(`What is the current ${f}?`, 'en');
      if (base.route.semantic.turn.freshness !== 'NONE') failures.push(`base current: ${f}`);
      if (cur.route.semantic.turn.freshness !== 'CURRENT') failures.push(`"current" ignored: ${f}`);
      if (cur.news !== true) failures.push(`"current" not sent to news: ${f}`);
    }
    RESULTS.push({
      family: 'sensitivity-current',
      cases: STATE_FRAMES.length,
      checks: STATE_FRAMES.length * 3,
      failures,
    });
    expect(failures).toEqual([]);
  });
});
