/**
 * CORPUS ADDITIONS — ASK R2 CONTEXT PRODUCER CLOSURE R1
 *
 * Rows to add to the frozen router's 41-row corpus. Every expectation here was
 * either EXECUTED against the landed tree or is produced by a producer in this
 * package; nothing is aspirational.
 *
 * `landedToday` records what the LANDED path does with the row right now, so the
 * corpus documents the delta rather than only the target. Four rows change
 * behaviour when producer A lands; the rest are locks.
 */

export interface CorpusRow {
  readonly id: string;
  readonly question: string;
  readonly axis: 'TYPED_GEO' | 'OFFICE_GEO' | 'FALSE_POSITIVE' | 'TOPIC' | 'TIME' | 'ENTITY_GEO' | 'HOMOGRAPH';
  readonly expectCountry: string | null;
  readonly expectTopicCategory: string | null;
  readonly expectStatedPeriod: string | null;
  readonly landedToday: string;
  readonly note?: string;
}

export const CORPUS_ADDITIONS: readonly CorpusRow[] = [
  /* ── A · the gap, and the rows that close it ─────────────────────────────── */
  { id: 'G1-office-president-country', question: 'Who is the current president of Rwanda?', axis: 'OFFICE_GEO',
    expectCountry: 'RWA', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'NO typed geography — the map country becomes the scope',
    note: 'the round\'s finding; measured, not inferred' },
  { id: 'G2-office-government-country', question: 'government of Kenya', axis: 'OFFICE_GEO',
    expectCountry: 'KEN', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'NO typed geography' },
  { id: 'G3-office-multiword-country', question: 'the prime minister of the United Kingdom', axis: 'OFFICE_GEO',
    expectCountry: 'GBR', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'NO typed geography',
    note: 'determiner stripped, multi-word country name' },
  { id: 'G4-office-institution-country', question: 'the central bank of Kenya', axis: 'OFFICE_GEO',
    expectCountry: 'KEN', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'NO typed geography' },

  /* ── A · false positives — the whole point of the conjunction ────────────── */
  { id: 'FP1-president-of-the-board', question: 'who is the president of the board', axis: 'FALSE_POSITIVE',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'no geography (correct)',
    note: 'office noun present, complement does not resolve' },
  { id: 'FP2-cost-of-living', question: 'what is the cost of living', axis: 'FALSE_POSITIVE',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'no geography (correct)' },
  { id: 'FP3-end-of-the-year', question: 'what happens at the end of the year', axis: 'FALSE_POSITIVE',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'no geography (correct)' },

  /* ── A · HOMOGRAPHS — the hazard the brief\'s examples do not reach ───────── */
  { id: 'HG1-cost-of-turkey', question: 'the cost of turkey at christmas', axis: 'HOMOGRAPH',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'detectLocation: none. BUT resolvePrimaryCountry(whole text) -> TR',
    note: 'why a bare country-mention scan cannot be promoted to a routing producer' },
  { id: 'HG2-end-of-jordan-career', question: 'the end of jordan career', axis: 'HOMOGRAPH',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'resolvePrimaryCountry(whole text) -> JO' },
  { id: 'HG3-president-of-turkey', question: 'the president of Turkey', axis: 'OFFICE_GEO',
    expectCountry: 'TUR', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'NO typed geography',
    note: 'THE PROPERTY THAT MAKES THIS A RULE: with an office in front of it, Turkey IS the country' },

  /* ── B · topic preservation ──────────────────────────────────────────────── */
  { id: 'T1-entertainment-geo-time', question: 'Entertainment news in Rwanda this week', axis: 'TOPIC',
    expectCountry: 'RWA', expectTopicCategory: 'entertainment', expectStatedPeriod: 'this week',
    landedToday: 'country RWA; topic [] ; time absent',
    note: 'the mandatory row: all three axes survive together' },
  { id: 'T2-security-is-not-a-category', question: 'Security developments in Kenya', axis: 'TOPIC',
    expectCountry: 'KEN', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'country KEN; AnalyticalDomain [security]',
    note: 'security is a DOMAIN, not a NewsCategory. The two axes stay separate and this row proves it.' },
  { id: 'T3-sports-named', question: 'sports results in Kenya', axis: 'TOPIC',
    expectCountry: 'KEN', expectTopicCategory: 'sports', expectStatedPeriod: null,
    landedToday: 'classifyCategory -> world (the floor)' },

  /* ── C · time preservation ───────────────────────────────────────────────── */
  { id: 'P1-yesterday', question: 'What happened at the convention centre yesterday?', axis: 'TIME',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: 'yesterday',
    landedToday: 'no time channel at all' },
  { id: 'P2-today', question: 'what changed today', axis: 'TIME',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: 'today', landedToday: 'no time channel' },
  { id: 'P3-last-week', question: 'inflation in Kenya last week', axis: 'TIME',
    expectCountry: 'KEN', expectTopicCategory: null, expectStatedPeriod: 'last week', landedToday: 'no time channel' },
  { id: 'P4-this-month', question: 'what happened in Rwanda this month', axis: 'TIME',
    expectCountry: 'RWA', expectTopicCategory: null, expectStatedPeriod: 'this month', landedToday: 'no time channel' },
  { id: 'P5-explicit-date', question: 'what happened in Rwanda on 3 March 2026', axis: 'TIME',
    expectCountry: 'RWA', expectTopicCategory: null, expectStatedPeriod: '3 march 2026', landedToday: 'no time channel' },
  { id: 'P6-explicit-range', question: 'what happened between 1 and 7 March 2026', axis: 'TIME',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: 'between 1 and 7 march 2026',
    landedToday: 'no time channel',
    note: 'must not be recorded as the single day "1 march" — rule order is load-bearing' },

  /* ── entity geography ────────────────────────────────────────────────────── */
  { id: 'E1-person-name', question: 'Who is Kagame?', axis: 'ENTITY_GEO',
    expectCountry: null, expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'no geography by any path; map country inherited',
    note: 'a proper name is NOT an office construction. Producer A correctly declines it; the gap stays open and is reported, not papered over.' },
  { id: 'E2-demonym', question: 'Rwandan security developments', axis: 'ENTITY_GEO',
    expectCountry: 'RWA', expectTopicCategory: null, expectStatedPeriod: null,
    landedToday: 'resolveCountriesByDemonym -> RWA (landed, works)',
    note: 'must remain provenance-distinct from a typed place' },
];
