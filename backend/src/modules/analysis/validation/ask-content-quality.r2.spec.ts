import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { selectContributors, placeNamed } from '../../ask-intelligence/contributor-selection';
import { admitsReport, questionAnchorsOf } from '../query/question-anchors.util';
import { readTradeCorridor } from '../query/trade-corridor.util';
import { readOutputContract, renderOutputContract } from '../prompt/output-contract.util';
import { assessBriefCompliance, detectDevelopmentBreadth, type DevelopmentBreadth } from './brief-compliance.util';
import {
  assessReaderContractShape,
  contractBlocks,
  layoutReaderContractSummary,
} from './reader-contract-shape.util';
import { REWORK_REUSE_RULES } from '../../ask-v2/execution-contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONTENT QUALITY REPAIR R2 — the live Alpha gate-2 A/B/C blockers (62db729)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Deterministic fixtures only: no provider, no model, no database. The headlines marked LIVE are
 * the exact titles Alpha admitted on 2026-10-06 (gate 2 RESULTS.json); the others are written for
 * the case. Nothing here blacklists a title — every rejection comes from the admission contract.
 */

const route = (q: string) =>
  routeAskR2(
    { originalQuestion: q, sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en', origin: 'ASK' },
    {},
    { specialistRegistry: specialistRegistryFixture },
  );
const placeOf = (q: string) =>
  selectContributors(route(q)).find((c) => c.contributorId === 'GEOGRAPHY')?.scope.place ?? null;

/* the exact live Alpha A question */
const LIVE_A =
  'What are the three most important developments reported in the past seven days that could affect a small shop owner in Kenya? Start with a two-sentence summary. Then use a compact table: What changed | Date | Why it matters to the shop | Source link. Prioritize credible Kenyan reporting and official sources. Separate reported facts from your analysis. If you can verify fewer than three developments, show only those. Finish with one practical thing the shopkeeper should check next. Keep the entire answer under 250 words.';
/* the exact live Alpha B question */
const LIVE_B =
  'As of 6 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.';

describe('P0-A · one geography: a requested column is never a place', () => {
  it('A1 · the live Kenya question: Kenya scope, and no "Date, Hokkaido, Japan" place line', () => {
    expect(route(LIVE_A).envelope.geography.candidates.filter((c) => c.source === 'TYPED_GEOGRAPHY').map((c) => c.value)).toEqual(['KEN']);
    expect(placeOf(LIVE_A)).toBeNull();
  });

  it.each([
    'Kenya: give me a table: Date | Development | Source',
    'What changed for traders in Kenya this week? Show date and source for each item.',
    'Kenya fuel prices this week. Columns: Location, Facts, Impact.',
    'Summarise Kenya’s budget news in a table with: development, date, route.',
  ])('no Japan (or any foreign place) from format words: %s', (q) => {
    const place = placeOf(q);
    expect(place ?? '').not.toMatch(/Japan|Hokkaido/);
  });

  it('A2 · a genuine Date, Japan question still resolves to the city of Date, Japan', () => {
    expect(placeNamed('What is the weather like in Date, Hokkaido this week?')).toMatch(/^Date, Hokkaido, Japan$/);
  });

  it('a city outside the canonical countries is never this answer’s place', () => {
    expect(placeNamed('Kenya traders and the Date | Source columns', ['KEN'])).toBeNull();
    expect(placeNamed('Importing into Rwanda via Dar es Salaam', ['RWA', 'TZA'])).toMatch(/^Dar es Salaam/);
  });
});

const R = (title: string, summary = '') => ({ title, summary });

describe('P0-C · admission: overlap with the governed question dimensions, not one country token', () => {
  it('A1 · Kenya small-business question is gated on business operating conditions', () => {
    const anchors = questionAnchorsOf(LIVE_A);
    expect(anchors.gated).toBe(true);
    expect(anchors.topics.map((t) => t.key)).toContain('business-impact');
    const admitted = [
      R('Kenya raises pump prices for petrol and diesel in monthly review'),
      R('KRA extends filing deadline for small traders', 'The Kenya Revenue Authority gave businesses two more weeks.'),
      R('Central Bank of Kenya holds interest rate at 9.5%'),
    ];
    const rejected = [
      /* LIVE */ R('Kenyan prisoners play chess for fun behind bars and to help with rehabilitation'),
      /* LIVE */ R('Odisha-Born CSM Tech Deploys Kenya’s National Digital Royalty System'),
      R('Kenya’s national team names squad for Africa Cup qualifiers'),
    ];
    for (const r of admitted) expect(admitsReport(anchors, r).admitted).toBe(true);
    for (const r of rejected) expect(admitsReport(anchors, r).admitted).toBe(false);
  });

  it('B1 · Rwanda corridor: route/logistics evidence admitted, destination-only stories rejected', () => {
    const anchors = questionAnchorsOf(LIVE_B);
    expect(anchors.relation).toBe('CORRIDOR');
    const admitted = [
      R('Dar es Salaam port congestion delays Rwanda-bound cargo'),
      R('Tanzania raises transit fee for trucks heading to Rwanda'),
      R('Mombasa port: Kenya cuts clearance times for transit cargo'),
      R('Dock workers strike at Dar es Salaam port'),
      R('Rwanda revises customs duty on imported fuel'),
    ];
    const rejected = [
      /* LIVE */ R('In Rwanda, Uniformed Security Banned From Court Sessions Involving Minors'),
      /* LIVE */ R('Despite High Tax, Tough Regulations – Betting (Urusimbi) is Still a Societal Crisis in Rwanda'),
      /* LIVE */ R('Rwandans Turn To Very Cheap Smuggled Alcohol'),
      /* LIVE */ R('Ethiopia’s Abiy Ahmed Re-elected Premeir For 5-year Term'),
      /* LIVE */ R('AU Delegation Dispatches to Goma, Kinshasa'),
      /* LIVE */ R('For Sex in Rwanda, You Have One Choice. To Go live'),
    ];
    for (const r of admitted) expect({ title: r.title, admitted: admitsReport(anchors, r).admitted }).toEqual({ title: r.title, admitted: true });
    for (const r of rejected) expect({ title: r.title, admitted: admitsReport(anchors, r).admitted }).toEqual({ title: r.title, admitted: false });
  });

  it('a general word ("security", "tax", "road") counts only beside a named route, never with the destination alone', () => {
    const anchors = questionAnchorsOf(LIVE_B);
    expect(admitsReport(anchors, R('Security tightened on Rwanda roads before summit')).admitted).toBe(false);
    expect(admitsReport(anchors, R('Insecurity on the Dar es Salaam highway worries truckers')).admitted).toBe(true);
  });

  it('C3 · the Dar es Salaam correction: Mombasa-only and unrelated regional politics are not evidence', () => {
    const corridor = readTradeCorridor(
      'importing into Rwanda via Mombasa or Dar es Salaam. My shipment goes through Dar es Salaam, not Mombasa.',
    );
    const anchors = questionAnchorsOf('My shipment goes through Dar es Salaam, not Mombasa.', corridor);
    expect(anchors.actors.map((a) => a.key)).not.toContain('KEN');
    expect(admitsReport(anchors, R('Kenya: Mombasa port expands berth capacity')).admitted).toBe(false);
    expect(admitsReport(anchors, R('Ethiopia’s Abiy Ahmed Re-elected Premeir For 5-year Term')).admitted).toBe(false);
    expect(admitsReport(anchors, R('AU Delegation Dispatches to Goma, Kinshasa')).admitted).toBe(false);
    expect(admitsReport(anchors, R('Dar es Salaam port congestion delays Rwanda-bound cargo')).admitted).toBe(true);
  });

  it('B2 · scarcity is answered with fewer items, never filler: the contract and rework rules say so', () => {
    /* the reader allowed fewer (A): said; every contract (A and B) forbids a speculative link */
    expect(renderOutputContract(readOutputContract(LIVE_A))).toMatch(/give fewer if the evidence supports fewer/);
    for (const q of [LIVE_A, LIVE_B]) {
      expect(renderOutputContract(readOutputContract(q))).toMatch(/Never link a report to it by speculation/);
      expect(renderOutputContract(readOutputContract(q))).toMatch(/Never fill a slot with a weakly related report/);
    }
    expect(REWORK_REUSE_RULES).toMatch(/never\s+connect a report to it by speculation/);
    expect(REWORK_REUSE_RULES).toMatch(/if none qualifies, say that no relevant development is\s+evidenced/);
  });
});

const BROAD: DevelopmentBreadth = { clusters: 6, categories: 4, multiDevelopment: true };

/* What the model returned under the contract: opening, table and closing on SINGLE line breaks. */
const KENYA_ANSWER = [
  'Two developments in the past week could affect a small shop in Kenya. Fuel prices rose and the tax deadline moved.',
  '| What changed | Date | Why it matters to the shop | Source link |',
  '|---|---|---|---|',
  '| Pump prices rose | 2026-10-05 | Higher delivery costs (analysis) | Business Daily |',
  '| KRA filing deadline extended | 2026-10-03 | More time to file | Kenya Revenue Authority |',
  'Check your supplier’s delivery surcharge this week.',
].join('\n');

describe('P0-B · the validator judges the contract generation was given', () => {
  it('ROOT CAUSE · the generic broad-news rule withheld a correct contract answer as "a single paragraph"', () => {
    expect(assessBriefCompliance(KENYA_ANSWER, BROAD).compliant).toBe(false);
  });

  it('B3 · exact Kenya contract: laid out, and accepted by the contract shape check', () => {
    const laid = layoutReaderContractSummary(KENYA_ANSWER);
    expect(contractBlocks(laid).map((b) => b.kind)).toEqual(['prose', 'table', 'prose']);
    /* whitespace only: not one non-space character changed */
    expect(laid.replace(/\s+/g, '')).toBe(KENYA_ANSWER.replace(/\s+/g, ''));
    expect(assessReaderContractShape(laid, readOutputContract(LIVE_A), BROAD).compliant).toBe(true);
    /* and, once laid out, the generic paragraph rule agrees */
    expect(assessBriefCompliance(laid, BROAD).compliant).toBe(true);
  });

  it('B3 · Rwanda corridor contract (6 columns, at most five rows) with fewer rows than requested', () => {
    const answer = [
      'One development on the Dar es Salaam route is supported by the reporting.',
      '| Development | Event/publication dates | Affected route | Facts | Likely impact | Source link |',
      '|---|---|---|---|---|---|',
      '| Port congestion | not reported / 2026-10-03 | Dar es Salaam – Kigali | Berth delays reported | Possible delay (analysis) | Test Daily |',
      'Coverage gap: no border or customs notice was found for Mombasa.',
      'Checks: confirm documents; ask for waiting times; watch the notice board.',
    ].join('\n');
    expect(assessReaderContractShape(answer, readOutputContract(LIVE_B), BROAD).compliant).toBe(true);
  });

  it('B3 · the same request with the columns reordered is judged by ITS columns', () => {
    const q = 'What changed for shops in Kenya this week? Use a table: Source link | Date | What changed. Finish with one check.';
    const answer = 'Opening.\n| Source link | Date | What changed |\n|---|---|---|\n| Business Daily | 2026-10-05 | Pump prices rose |\nCheck prices.';
    expect(assessReaderContractShape(answer, readOutputContract(q), BROAD).compliant).toBe(true);
  });

  it('B3 · a table with no explicit opening, and a request with no table at all', () => {
    const tableOnly = 'Use a table: Development | Date | Source. Kenya this week.';
    expect(
      assessReaderContractShape('| Development | Date | Source |\n|---|---|---|\n| Fuel up | 2026-10-05 | X |', readOutputContract(tableOnly), BROAD).compliant,
    ).toBe(true);
    const noTable = 'Kenya this week. Start with a two-sentence summary. Finish with one practical check.';
    expect(assessReaderContractShape('Summary one. Summary two.\nCheck one thing.', readOutputContract(noTable), BROAD).compliant).toBe(true);
  });

  it('B3 · an honest short "nothing verified" answer is accepted in place of an empty table', () => {
    const honest = 'No development in the past seven days could be verified as affecting a small shop in Kenya. Check back after the next fuel price review.';
    expect(assessReaderContractShape(honest, readOutputContract(LIVE_A), BROAD).compliant).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['pipes without a separator row', 'Opening.\n| What changed | Date | Why | Source |\n| Fuel | 5 Oct | Costs | X |'],
    ['wrong column count', 'Opening.\n| What changed | Date |\n|---|---|\n| Fuel | 5 Oct |'],
    ['ragged row', 'Opening.\n| A | B | C | D |\n|---|---|---|---|\n| 1 | 2 | 3 |'],
    ['more rows than requested (cap three)', `Opening.\n| A | B | C | D |\n|---|---|---|---|\n${'| 1 | 2 | 3 | 4 |\n'.repeat(4)}Close.`],
    ['a long prose wall instead of the table', 'Fuel prices rose. '.repeat(60)],
  ])('B4 · malformed output is still refused, with a reason: %s', (_label, summary) => {
    const verdict = assessReaderContractShape(summary, readOutputContract(LIVE_A), BROAD);
    expect(verdict.compliant).toBe(false);
    expect(verdict.reason).toMatch(/^Reader output contract not met: /);
  });

  it('the breadth of the evidence the model saw still travels with the verdict', () => {
    const verdict = assessReaderContractShape(KENYA_ANSWER, readOutputContract(LIVE_A), detectDevelopmentBreadth([]));
    expect(verdict.breadth.clusters).toBe(0);
  });
});
