import { writeFileSync } from 'node:fs';
import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 §14 — the routing evaluation corpus.
 *
 * Deterministic and offline: every case goes through the real integrated router (frozen C
 * included). `split: 'DEV'` cases shaped Tranche 1A; `split: 'HELD_OUT'` cases were written AFTER
 * that work and were not used to tune it — their result is reported as measured, failures
 * included (this suite never fails on a HELD_OUT miss; it fails only if a DEV case regresses).
 * `TRUST_R1_EVAL_OUT=<file>` writes the raw table. Execution-level behaviour (providers, answers,
 * citations) is NOT measured here: that needs the live sample on Alpha.
 */
type Expect = {
  readonly knowledge?: string | null;
  readonly terminal?: string;
  readonly news?: boolean;
  readonly place?: string | null;
};
interface Case {
  readonly id: string;
  readonly item: string;
  readonly split: 'DEV' | 'HELD_OUT';
  readonly q: string;
  readonly lang?: 'en' | 'pl';
  readonly ctx?: Partial<AskRouteContext>;
  readonly expect: Expect;
}

const MDG = { priorQuestion: 'What is going on in Madagascar?', mapContextCountry: 'MDG' };
const CORPUS: readonly Case[] = [
  /* 1 · Madagascar alone and after Iran */
  {
    id: 'A1',
    item: '1',
    split: 'DEV',
    q: 'What is going on in Madagascar?',
    ctx: { priorQuestion: 'Which news are in Iran?' },
    expect: { news: true, place: 'MDG' },
  },
  {
    id: 'A2',
    item: '1',
    split: 'HELD_OUT',
    q: 'any news from madagascar today',
    expect: { news: true, place: 'MDG' },
  },
  {
    id: 'A3',
    item: '1',
    split: 'HELD_OUT',
    q: 'And Madagascar, what is the latest there?',
    ctx: { priorQuestion: 'Which news are in Iran?' },
    expect: { news: true, place: 'MDG' },
  },
  {
    id: 'A4',
    item: '1',
    split: 'HELD_OUT',
    q: 'Madagascar latest',
    expect: { news: true, place: 'MDG' },
  },
  /* 2 · Tanzania safari */
  {
    id: 'B1',
    item: '2',
    split: 'DEV',
    q: 'I want to visit Tanzania especially Safari national park, I want to know some information before going there',
    expect: { knowledge: 'PLACE_REFERENCE', news: false, place: 'TZA' },
  },
  {
    id: 'B2',
    item: '2',
    split: 'HELD_OUT',
    q: 'Going on holiday in Tanzania next year, any tips for the Serengeti?',
    expect: { knowledge: 'PLACE_REFERENCE', news: false, place: 'TZA' },
  },
  {
    id: 'B3',
    item: '2',
    split: 'HELD_OUT',
    q: 'What do I need to know before travelling to Kenya?',
    expect: { knowledge: 'PLACE_REFERENCE', news: false, place: 'KEN' },
  },
  {
    id: 'B4',
    item: '2',
    split: 'HELD_OUT',
    q: 'Planuję wycieczkę do Tanzanii, co warto wiedzieć?',
    lang: 'pl',
    expect: { knowledge: 'PLACE_REFERENCE', news: false, place: 'TZA' },
  },
  /* 3 · history and science without a breaking-news provider */
  {
    id: 'C1',
    item: '3',
    split: 'DEV',
    q: 'What caused the Rwandan genocide?',
    expect: { news: false },
  },
  {
    id: 'C2',
    item: '3',
    split: 'DEV',
    q: 'How does photosynthesis work?',
    expect: { news: false, place: null },
  },
  {
    id: 'C3',
    item: '3',
    split: 'HELD_OUT',
    q: 'When did Kenya gain independence?',
    expect: { news: false, place: 'KEN' },
  },
  {
    id: 'C4',
    item: '3',
    split: 'HELD_OUT',
    q: 'Why is the sky blue?',
    expect: { news: false, place: null },
  },
  { id: 'C5', item: '3', split: 'HELD_OUT', q: 'Who was Nelson Mandela?', expect: { news: false } },
  {
    id: 'C6',
    item: '3',
    split: 'HELD_OUT',
    q: 'What was the Ottoman Empire?',
    expect: { news: false },
  },
  /* 4 · local Rwanda, Kenya, Poland, Middle East with real aliases */
  {
    id: 'D1',
    item: '4',
    split: 'HELD_OUT',
    q: 'What is happening in Kigali today?',
    expect: { news: true, place: 'RWA' },
  },
  {
    id: 'D2',
    item: '4',
    split: 'HELD_OUT',
    q: 'Latest news from Mombasa',
    expect: { news: true, place: 'KEN' },
  },
  {
    id: 'D3',
    item: '4',
    split: 'HELD_OUT',
    q: 'Co się dzieje w Krakowie?',
    lang: 'pl',
    expect: { news: true, place: 'POL' },
  },
  {
    id: 'D4',
    item: '4',
    split: 'HELD_OUT',
    q: 'What is the situation in Gaza now?',
    expect: { news: true },
  },
  {
    id: 'D5',
    item: '4',
    split: 'HELD_OUT',
    q: 'Any updates from Beirut this week?',
    expect: { place: 'LBN' },
  },
  /* 5 · follow-ups changing topic, country, date */
  {
    id: 'E1',
    item: '5',
    split: 'DEV',
    q: 'And the economy?',
    ctx: MDG,
    expect: { news: true, place: 'MDG' },
  },
  {
    id: 'E2',
    item: '5',
    split: 'DEV',
    q: 'What about yesterday?',
    ctx: MDG,
    expect: { terminal: 'EXECUTABLE', news: true, place: 'MDG' },
  },
  {
    id: 'E3',
    item: '5',
    split: 'HELD_OUT',
    q: 'What about health?',
    ctx: MDG,
    expect: { news: true, place: 'MDG' },
  },
  {
    id: 'E4',
    item: '5',
    split: 'HELD_OUT',
    q: 'And in Kenya?',
    ctx: MDG,
    expect: { place: 'KEN' },
  },
  {
    id: 'E5',
    item: '5',
    split: 'HELD_OUT',
    q: 'What about the past week?',
    ctx: MDG,
    expect: { terminal: 'EXECUTABLE', place: 'MDG' },
  },
  /* 8 · wrong-country traps */
  { id: 'H1', item: '8', split: 'DEV', q: 'Who was Napoleon?', expect: { place: null } },
  { id: 'H2', item: '8', split: 'HELD_OUT', q: 'Who is Paris Hilton?', expect: { place: null } },
  {
    id: 'H3',
    item: '8',
    split: 'HELD_OUT',
    q: 'What is happening in Georgia the country?',
    expect: { place: 'GEO' },
  },
  /* 10 · Greenland */
  {
    id: 'G1',
    item: '10',
    split: 'HELD_OUT',
    q: 'What is happening in Greenland?',
    expect: { news: true, place: 'GRL' },
  },
  { id: 'G2', item: '10', split: 'HELD_OUT', q: 'Nyheder fra Grønland', expect: { place: 'GRL' } },
  {
    id: 'G3',
    item: '10',
    split: 'HELD_OUT',
    q: 'What is the history of Kalaallit Nunaat?',
    expect: { news: false, place: 'GRL' },
  },
];

const deps = { specialistRegistry: specialistRegistryFixture };
function run(c: Case) {
  const lang = c.lang ?? 'en';
  const r = routeAskR2(
    {
      originalQuestion: c.q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-03T12:00:00Z', ...c.ctx },
    deps,
  );
  const news = r.plan.evidenceRequests.some(
    (e) => e.required && e.evidenceClass === 'NEWS_REPORTING',
  );
  const place = r.envelope.geography.candidates[0]?.value ?? null;
  const got = { knowledge: r.knowledgeRequirement, terminal: r.plan.terminalState, news, place };
  const misses = (Object.keys(c.expect) as (keyof Expect)[]).filter((k) => c.expect[k] !== got[k]);
  return { ...c, got, pass: misses.length === 0, misses };
}

const results = CORPUS.map(run);

describe('Trust R1 routing evaluation corpus', () => {
  it.each(results.filter((r) => r.split === 'DEV').map((r) => [r.id, r]))(
    'DEV %s stays correct',
    (_id, r) => {
      expect((r as (typeof results)[number]).misses).toEqual([]);
    },
  );

  it('reports the held-out score as measured (never asserted to be perfect)', () => {
    const held = results.filter((r) => r.split === 'HELD_OUT');
    expect(held.length).toBeGreaterThanOrEqual(20);
  });

  afterAll(() => {
    const out = process.env.TRUST_R1_EVAL_OUT;
    if (!out) return;
    const score = (split: string) => {
      const set = results.filter((r) => r.split === split);
      return `${set.filter((r) => r.pass).length}/${set.length}`;
    };
    const lines = [
      `# Trust R1 routing evaluation (offline, real router) — DEV ${score('DEV')}, HELD_OUT ${score('HELD_OUT')}`,
      '',
      '| id | §14 item | split | question | expected | got | result |',
      '|---|---|---|---|---|---|---|',
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.item} | ${r.split} | ${r.q} | ${JSON.stringify(r.expect)} | ${JSON.stringify(r.got)} | ${r.pass ? 'PASS' : `MISS (${r.misses.join(', ')})`} |`,
      ),
      '',
    ];
    writeFileSync(out, lines.join('\n'));
  });
});
