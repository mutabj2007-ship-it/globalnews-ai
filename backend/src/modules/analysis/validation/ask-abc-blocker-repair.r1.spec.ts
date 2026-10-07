import {
  admitsReport,
  BUSINESS_IMPACT_LEAD_WORDS,
  questionAnchorsOf,
} from '../query/question-anchors.util';
import { readTradeCorridor } from '../query/trade-corridor.util';
import { readOutputContract, renderOutputContract } from '../prompt/output-contract.util';
import { buildAnalysisJsonSchema, buildDevelopmentBreadthSection } from '../prompt/build-analysis-prompt.util';
import {
  GENERATION_RESERVE_MS,
  retrievalBudgetMs,
  TABLE_GENERATION_RESERVE_MS,
} from '../../news/retrieval-budget';
import type { DevelopmentBreadth } from './brief-compliance.util';
import { normalizeBriefFields } from '../providers/normalize-brief-fields.util';
import { assessReaderContractShape, opensWithNothingVerified } from './reader-contract-shape.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 A/B/C BLOCKER REPAIR R1 — the live Alpha A/B/C failures on bb08e49 (2026-10-07)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Signed-in owner probes on Alpha bb08e49: A, B and C failed; D, E and F passed. The records showed
 * (1) the corridor gate admitted reports that only MENTION a route's country beside a generic word,
 * (2) the business-impact gate admitted a report that meets Kenya in passing deep in its text,
 * (3) a narrow evidence set replaced the reader's table contract with "one paragraph", and
 * (4) the shape check accepted any table-less brief under 120 words.
 *
 * Fixtures: the titles are the exact live titles; each body is WRITTEN to reproduce the live
 * article's measured shape — which anchor terms it carries and where (e.g. "Citibank Kenya" past
 * the lead) — without copying publisher text. Nothing is blacklisted by title.
 */

const LIVE_A =
  'What are the three most important developments reported in the past seven days that could affect a small shop owner in Kenya? Start with a two-sentence summary. Then use a compact table: What changed | Date | Why it matters to the shop | Source link. Prioritize credible Kenyan reporting and official sources. Separate reported facts from your analysis. If you can verify fewer than three developments, show only those. Finish with one practical thing the shopkeeper should check next. Keep the entire answer under 250 words.';
const LIVE_B =
  'As of 7 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.';
const LIVE_C = 'My shipment goes through Dar es Salaam, not Mombasa. Revise your answer to retain only relevant developments and explain what changed.';

const filler = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

/* ── the live article shapes ─────────────────────────────────────────────── */
const EADB = {
  title: 'Anne Juuko named EADB Director General as bank posts 51% profit growth',
  summary:
    `The East African Development Bank has appointed a veteran Ugandan banker as Director General. ${filler(40)} ` +
    `The regional lender reported profit before tax up 51 percent and loan disbursements up 140 percent, ` +
    `with credit to member states and capital markets activity rising. ${filler(60)} ` +
    'She previously held senior positions at Citibank Kenya and Citibank Uganda, and the bank serves Uganda, Kenya, Tanzania and Rwanda.',
};
const KEN_RWA_DEALS = {
  title: 'Kenya, Rwanda Sign 11 New Deals as Bilateral Cooperation Deepens',
  summary:
    'Kenya and Rwanda signed eleven new instruments in Nairobi covering trade, transport and economic cooperation, ' +
    'including the Northern Corridor and joint logistics planning.',
};
const DANGOTE = {
  title: 'Dangote IPO Opened to Kenyan Investors',
  summary:
    'The refinery initial public offering has been opened to Kenyan investors, the business desk reports; ' +
    'cross-border listings give businesses access to new capital markets.',
};
const KEN_FUEL_LEAD = {
  title: 'Pump prices rise for the third month',
  summary: 'Kenya’s energy regulator raised diesel and petrol prices for the coming month, citing import costs.',
};
const ETHIOPIA = {
  title: 'Ethiopia’s Abiy Ahmed Re-elected Premeir For 5-year Term',
  summary: `Parliament re-elected the prime minister for a further term. ${filler(120)} Regional security and relations with neighbouring Kenya were discussed.`,
};
const AU_GOMA = {
  title: 'AU Delegation Dispatches to Goma, Kinshasa',
  summary: 'An African Union delegation including a former Kenya president travelled to Goma to assess the security situation in eastern DR Congo.',
};
const SEX_ARTICLE = {
  title: 'For Sex in Rwanda, You Have One Choice. To Go live',
  summary: `${filler(70)} In Rwanda, informal traders say availability has changed. ${filler(200)}`,
};
const RWA_TAXMAN = {
  title: 'Rwanda’s Taxman Goes Digital and Offers Businesses Room to Breathe',
  summary:
    'The Rwanda Revenue Authority moved customs clearance online, so imports at the border are processed faster and traders can file declarations digitally.',
};
const MOMBASA_ONLY = {
  title: 'Mombasa port congestion delays Rwanda-bound cargo',
  summary: 'Berth congestion at the Kenyan port of Mombasa is delaying containers bound for Rwanda by several days.',
};
const DAR_PORT = {
  title: 'Dar es Salaam port clears backlog of transit cargo',
  summary: 'Tanzania Ports Authority says the Dar es Salaam backlog of Rwanda transit containers has cleared and dwell times fell.',
};

/* ── round 2 (live 09d7a5e) shapes ───────────────────────────────────────── */
const EADB_2 = {
  title: 'EADB Appoints Anne Juuko as Director General',
  summary: 'Nairobi, Kenya — The East African Development Bank has named a new Director General to lead the regional business lender.',
};
const MATERNAL = {
  title: 'Kenya’s maternal health crisis: Why postpartum bleeding is still killing mothers',
  summary: 'Hospitals in Kenya report shortfalls in blood supplies for mothers after childbirth.',
};
const CLIMATE = {
  title: 'Global Leaders Warn of "Climate Overshoot," Call for Fossil Fuel Phase-Out',
  summary: 'At a summit attended by delegates from Kenya and Nairobi-based agencies, leaders urged an end to fossil fuel use.',
};
const PACKAGING = {
  title: 'Couple started packaging business with Sh250,000 in Kenya - here’s how',
  summary: 'A couple in Nairobi, Kenya describe how they grew their packaging business from savings.',
};
const FOOD_PRICES = {
  title: 'Food prices rising in Kenya as climate change strains supply',
  summary: 'Shoppers in Nairobi markets face higher prices as drought cuts the supply of staples; consumers are paying more.',
};
const KT_DAR = {
  title: 'Rwanda Cargo Through Dar es Salaam Rises 24% as Trade Routes Shift',
  summary: 'Rwandan cargo through the port of Dar es Salaam rose 24 percent as importers shifted to the Central Corridor.',
};
const EAC_CHINA = {
  title: 'EAC’s 100 Businesses Scheme for Larger Share Of China Trade',
  summary: 'One hundred firms from Rwanda, Tanzania and other EAC states will pursue exports and imports with Chinese buyers.',
};
const KIBEHO = {
  title: 'Kibeho Traders Harvesting Money From Selling Holly Water',
  summary: 'Traders in Kibeho, Rwanda sell holy water in containers to pilgrims.',
};

describe('A · Kenya small-business gate (business-impact)', () => {
  const anchors = questionAnchorsOf(LIVE_A);

  it('the live A question is gated on business-impact in Kenya', () => {
    expect(anchors.gated).toBe(true);
    expect(anchors.actors.map((a) => a.key)).toEqual(['KEN']);
    expect(anchors.topics.map((t) => t.key)).toEqual(['business-impact']);
  });

  it('rejects the EADB appointment: Kenya only met in passing, past the lead', () => {
    expect(EADB.summary.split(/\s+/).findIndex((w) => /^Kenya/.test(w))).toBeGreaterThan(BUSINESS_IMPACT_LEAD_WORDS);
    expect(admitsReport(anchors, EADB).admitted).toBe(false);
  });

  it('keeps genuine Kenya small-business evidence (title or lead names Kenya)', () => {
    expect(admitsReport(anchors, KEN_RWA_DEALS).admitted).toBe(true);
    expect(admitsReport(anchors, DANGOTE).admitted).toBe(true);
    expect(admitsReport(anchors, KEN_FUEL_LEAD).admitted).toBe(true);
  });

  it.each([
    ['the second EADB article (one generic word, "business")', EADB_2],
    ['a maternal-health story (one generic word, "supplies")', MATERNAL],
    ['a climate summit (one generic word, "fuel")', CLIMATE],
    ['a start-up feature (one generic word, "business")', PACKAGING],
  ])('round 2 · rejects %s', (_label, report) => {
    expect(admitsReport(anchors, report).admitted).toBe(false);
  });

  it('round 2 · keeps a real cost-of-doing-business development (food prices, supply, markets)', () => {
    expect(admitsReport(anchors, FOOD_PRICES).admitted).toBe(true);
  });

  it('a non-business country question is not tightened (the lead rule is business-impact only)', () => {
    const inflation = questionAnchorsOf('What is happening with inflation in Kenya?');
    const deep = { title: 'Central bank holds rates', summary: `${filler(80)} Inflation in Kenya eased to 4.1 percent.` };
    expect(admitsReport(inflation, deep).admitted).toBe(true);
  });
});

describe('B · Rwanda corridor gate', () => {
  const anchors = questionAnchorsOf(LIVE_B);

  it('the live B question is a corridor with Mombasa and Dar es Salaam as route places', () => {
    expect(anchors.relation).toBe('CORRIDOR');
    const routes = anchors.actors.filter((a) => a.role === 'ROUTE');
    expect(routes.flatMap((r) => r.places ?? [])).toEqual(expect.arrayContaining(['mombasa', 'dar es salaam']));
  });

  it.each([
    ['Ethiopia PM re-election (Kenya mention + "security")', ETHIOPIA],
    ['AU delegation to Goma (Kenya mention + "security")', AU_GOMA],
    ['unrelated sex article (Rwanda + one generic "traders")', SEX_ARTICLE],
    ['EADB appointment (Tanzania/Kenya mention + "tax")', EADB],
    ['Dangote IPO (Kenyan + one generic "border")', DANGOTE],
  ])('rejects %s', (_label, report) => {
    expect(admitsReport(anchors, report).admitted).toBe(false);
  });

  it('keeps customs digitisation, the corridor deals and a named-port logistics report', () => {
    expect(admitsReport(anchors, RWA_TAXMAN).admitted).toBe(true);
    expect(admitsReport(anchors, KEN_RWA_DEALS).admitted).toBe(true);
    expect(admitsReport(anchors, MOMBASA_ONLY).admitted).toBe(true);
    expect(admitsReport(anchors, DAR_PORT).admitted).toBe(true);
  });

  it('a weak word ("delays") counts beside the PORT name, not beside the country name', () => {
    const portDelay = { title: 'Port delays', summary: 'Delays at Mombasa this week.' };
    const countryDelay = { title: 'Court delays', summary: 'Delays in Kenya courts this week.' };
    expect(admitsReport(anchors, portDelay).admitted).toBe(true);
    expect(admitsReport(anchors, countryDelay).admitted).toBe(false);
  });
});

describe('C · "Dar es Salaam, not Mombasa" — the re-gate of the earlier evidence', () => {
  const corridor = readTradeCorridor(LIVE_C, { priorQuestion: LIVE_B });
  const anchors = questionAnchorsOf(LIVE_C, corridor);

  it('Mombasa is excluded and carried into admission', () => {
    expect(anchors.actors.map((a) => a.key)).not.toContain('KEN');
    expect((anchors.excluded ?? []).map((e) => e.key)).toContain('KEN');
  });

  it('rejects the EADB appointment', () => {
    expect(admitsReport(anchors, EADB).admitted).toBe(false);
  });

  it('rejects Mombasa-only evidence once the reader ruled Mombasa out', () => {
    expect(admitsReport(anchors, MOMBASA_ONLY).admitted).toBe(false);
    expect(admitsReport(anchors, KEN_RWA_DEALS).admitted).toBe(false);
  });

  it('keeps Dar es Salaam evidence', () => {
    expect(admitsReport(anchors, DAR_PORT).admitted).toBe(true);
  });

  /* round 2 (live 09d7a5e): B timed out, so C ran ONE new search whose anchors were read from the
     whole retrieval question — both anchor readings must apply the narrowed-route rule */
  const searchAgain = questionAnchorsOf(`${LIVE_B}\n${LIVE_C}`);

  it.each([
    ['the reuse anchors', anchors],
    ['the search-again anchors', searchAgain],
  ])('round 2 · %s: generic Rwanda business / customs / trade stories with no Dar relationship are rejected', (_l, a) => {
    expect((a.excluded ?? []).map((e) => e.key)).toContain('KEN');
    for (const report of [RWA_TAXMAN, EAC_CHINA, KIBEHO, SEX_ARTICLE]) {
      expect(admitsReport(a, report).admitted).toBe(false);
    }
  });

  it.each([
    ['the reuse anchors', anchors],
    ['the search-again anchors', searchAgain],
  ])('round 2 · %s: the route-specific KT Press Dar es Salaam cargo story is kept', (_l, a) => {
    expect(admitsReport(a, KT_DAR).admitted).toBe(true);
  });

  it('the same customs story is still evidence for the UNNARROWED corridor question (B)', () => {
    expect(admitsReport(questionAnchorsOf(LIVE_B), RWA_TAXMAN).admitted).toBe(true);
  });
});

describe('Contract · a table brief is generated block by block (A: "Start with a two-sentence summary")', () => {
  it('the rendered contract says the reader’s "summary" is only the opening of the one brief', () => {
    const text = renderOutputContract(readOutputContract(LIVE_A));
    expect(text).toMatch(/Every step below is part of the ONE brief/);
    expect(text).toMatch(/only the START of the brief/);
    expect(text).toMatch(/is not a row/);
  });

  it('a TABLE contract asks for three required fields — opening, table, closing — not one "summary"', () => {
    const schema = buildAnalysisJsonSchema({
      clusters: 3,
      categories: 1,
      multiDevelopment: false,
      readerContract: true,
      readerContractTable: true,
    }).schema as { properties: Record<string, unknown>; required: string[] };
    expect(schema.required).toEqual(expect.arrayContaining(['briefOpening', 'briefTable', 'briefClosing']));
    expect(schema.required).not.toContain('summary');
    expect(Object.keys(schema.properties)).not.toContain('summary');
    expect(JSON.stringify(schema.properties.briefTable)).toMatch(/ONLY the requested Markdown table/);
    const section = buildDevelopmentBreadthSection({
      clusters: 3,
      categories: 1,
      multiDevelopment: false,
      readerContract: true,
      readerContractTable: true,
    });
    expect(section).toMatch(/THREE fields that together are the brief/);
  });

  it('a contract WITHOUT a table keeps the one "summary" field, described as the whole brief', () => {
    const schema = buildAnalysisJsonSchema({ clusters: 3, categories: 1, multiDevelopment: false, readerContract: true }).schema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toContain('summary');
    expect(JSON.stringify(schema.properties.summary)).toMatch(/The WHOLE brief in THE READER'S OUTPUT CONTRACT order/);
  });

  it('the provider joins the three blocks in contract order, and the unchanged shape check judges the join', () => {
    const joined = normalizeBriefFields({
      briefOpening: 'Two developments qualify. Fuel costs rose.',
      briefTable:
        '| What changed | Date | Why it matters to the shop | Source link |\n|---|---|---|---|\n| Pump prices up | 2026-10-05 | Delivery costs | Africanews |',
      briefClosing: 'Check your supplier’s delivery charge this week.',
      headline: 'h',
    }) as Record<string, unknown>;
    expect(Object.keys(joined)).not.toEqual(expect.arrayContaining(['briefOpening']));
    const summary = String(joined.summary);
    expect(summary.indexOf('Two developments')).toBeLessThan(summary.indexOf('| What changed'));
    expect(summary.indexOf('| What changed')).toBeLessThan(summary.indexOf('Check your supplier'));
    const contract = readOutputContract(LIVE_A);
    const breadth: DevelopmentBreadth = { clusters: 3, categories: 1, multiDevelopment: false };
    expect(assessReaderContractShape(summary, contract, breadth).compliant).toBe(true);

    /* an empty table block is NOT a pass: the join has no table and the guard refuses it */
    const empty = normalizeBriefFields({ briefOpening: 'Fuel costs rose.', briefTable: '', briefClosing: 'Check prices.' }) as {
      summary: string;
    };
    expect(assessReaderContractShape(empty.summary, contract, breadth).compliant).toBe(false);
  });

  it('a contract with only a word limit does not claim the one-brief shape', () => {
    expect(renderOutputContract(readOutputContract('What happened in Kenya this week? Under 100 words.'))).not.toMatch(
      /part of the ONE brief/,
    );
  });
});

describe('Budget · a reader-requested table reserves more generation time', () => {
  it('table contracts leave 17 s for generation; every other request keeps 13 s', () => {
    expect(retrievalBudgetMs(28_000, TABLE_GENERATION_RESERVE_MS)).toBe(11_000);
    expect(retrievalBudgetMs(28_000)).toBe(28_000 - GENERATION_RESERVE_MS);
    expect(GENERATION_RESERVE_MS).toBe(13_000);
  });
});

describe('Prompt · the reader contract is emitted whatever the measured breadth', () => {
  it('a narrow evidence set (one editorial domain) still gets the reader contract, not "one paragraph"', () => {
    const narrow = { clusters: 3, categories: 1, multiDevelopment: false, readerContract: true } as const;
    const section = buildDevelopmentBreadthSection(narrow);
    expect(section).toMatch(/THE READER'S OUTPUT CONTRACT/);
    expect(section).not.toMatch(/NARROW EVIDENCE SET/);
  });

  it('a single-cluster contract keeps the single-source basis rule', () => {
    const one = { clusters: 1, categories: 1, multiDevelopment: false, readerContract: true } as const;
    expect(buildDevelopmentBreadthSection(one)).toMatch(/SINGLE-SOURCE BASIS/);
  });

  it('without a reader contract the narrow and broad sections are unchanged', () => {
    expect(buildDevelopmentBreadthSection({ clusters: 1, categories: 1, multiDevelopment: false })).toMatch(/NARROW EVIDENCE SET/);
  });
});

describe('Shape · a requested table cannot be skipped by short prose', () => {
  const contractA = readOutputContract(LIVE_A);
  const contractB = readOutputContract(LIVE_B);
  const withEvidence: DevelopmentBreadth = { clusters: 3, categories: 1, multiDevelopment: false };
  const noEvidence: DevelopmentBreadth = { clusters: 0, categories: 0, multiDevelopment: false };

  it('A live shape: two sentences of developments, no table → refused', () => {
    const live =
      'Recent agreements between Kenya and Rwanda aim to enhance trade and investment, which could benefit small shop owners through improved regional connectivity. Additionally, the opening of the Dangote IPO to Kenyan investors may provide new investment opportunities for local businesses.';
    const verdict = assessReaderContractShape(live, contractA, withEvidence);
    expect(verdict.compliant).toBe(false);
    expect(verdict.reason).toMatch(/requested table is missing/);
  });

  it('B live shape: "The following table summarizes…" with no table → refused', () => {
    const live =
      'In the past week, several developments have been reported that may impact small businesses importing into Rwanda via Mombasa or Dar es Salaam. However, no specific disruptions in customs, fuel, or security were reported directly affecting the routes in question. The following table summarizes the relevant developments.';
    expect(assessReaderContractShape(live, contractB, withEvidence).compliant).toBe(false);
  });

  it('an explicit honest "nothing verified" answer may omit the table', () => {
    const honest = 'No development in the past seven days could be verified as affecting a small shop in Kenya. Check back after the next fuel price review.';
    expect(opensWithNothingVerified(honest)).toBe(true);
    expect(assessReaderContractShape(honest, contractA, withEvidence).compliant).toBe(true);
  });

  it('with no admitted evidence (the D path) a missing table is not a contract failure', () => {
    expect(assessReaderContractShape('Nothing was found.', contractA, noEvidence).compliant).toBe(true);
  });

  it('a well-formed requested table is still accepted', () => {
    const ok =
      'Two developments qualify. Fuel prices rose.\n\n| What changed | Date | Why it matters to the shop | Source link |\n|---|---|---|---|\n| Pump prices up | 2026-10-05 | Delivery costs | [1] |\n\nCheck your supplier prices.';
    expect(assessReaderContractShape(ok, contractA, withEvidence).compliant).toBe(true);
  });
});
