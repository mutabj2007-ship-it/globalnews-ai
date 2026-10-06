import { readOutputContract, renderOutputContract } from './output-contract.util';
import { buildAnalysisUserPrompt } from './build-analysis-prompt.util';

/**
 * ASK R2 LIVE-GATE REPAIR (P0-2) — the complete output contract reaches the generation request.
 * Live Alpha (fe96eb1, TEST A): no two-sentence opening, no table, no columns, no closing check.
 */
const LIVE_A =
  'What are the three most important developments reported in the past seven days that could affect a small shop owner in Kenya? Start with a two-sentence summary. Then use a compact table: What changed | Date | Why it matters to the shop | Source link. Prioritize credible Kenyan reporting and official sources. Separate reported facts from your analysis. If you can verify fewer than three developments, show only those. Finish with one practical thing the shopkeeper should check next. Keep the entire answer under 250 words.';
const CONTRACT_A =
  'What were the three most significant developments affecting small businesses in Kenya over the past seven days? Present a concise table with: development, date, likely business impact, and a clickable source supporting the development. Prioritize Kenyan reporting and official sources. Distinguish reported facts from your analysis, and give fewer than three developments if the evidence is insufficient. Finish by explaining, in no more than 60 words, which development a small shopkeeper should watch most closely and why.';

describe('P0-2 · the exact Kenya contract is read completely', () => {
  it('live TEST A: opening, exact columns in order, cap, fewer, sources, facts/analysis, closing, word limit', () => {
    const c = readOutputContract(LIVE_A);
    expect(c.openingSentences).toBe(2);
    expect(c.table?.columns).toEqual(['What changed', 'Date', 'Why it matters to the shop', 'Source link']);
    expect(c.itemCap).toBe(3);
    expect(c.fewerAllowed).toBe(true);
    expect(c.sourcePerItem).toBe(true);
    expect(c.factsVsAnalysis).toBe(true);
    expect(c.closing).toBe('Finish with one practical thing the shopkeeper should check next.');
    expect(c.wordLimit).toBe(250);
  });

  it('contract TEST A: listed columns, closing with its own 60-word limit (not the answer limit)', () => {
    const c = readOutputContract(CONTRACT_A);
    expect(c.table?.columns).toEqual(['development', 'date', 'likely business impact', 'source supporting the development']);
    expect(c.itemCap).toBe(3);
    expect(c.fewerAllowed).toBe(true);
    expect(c.closing).toMatch(/^Finish by explaining, in no more than 60 words/);
    expect(c.wordLimit).toBeNull(); /* the 60 words belong to the closing, which carries them */
  });

  it.each([
    [
      'Columns: Source | Impact | Event date | What happened. List up to five items about Rwanda trade this week. End with two risks to watch. Under 300 words.',
      ['Source', 'Impact', 'Event date', 'What happened'],
      5,
      300,
    ],
    [
      'Give me the top 4 developments for Ugandan exporters this month in a table showing date, location, facts and analysis. Conclude with one recommendation.',
      ['date', 'location', 'facts', 'analysis'],
      4,
      null,
    ],
  ])('paraphrase with other columns/order: %s', (q, columns, cap, words) => {
    const c = readOutputContract(q);
    expect(c.table?.columns).toEqual(columns);
    expect(c.itemCap).toBe(cap);
    expect(c.wordLimit).toBe(words);
    expect(c.closing).not.toBeNull();
  });

  it('the corridor prompt (TEST C) carries its table, cap, closing and word limit', () => {
    const c = readOutputContract(
      'As of 6 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. End with three practical checks for the importer. Under 600 words.',
    );
    expect(c.table?.columns).toEqual(['development', 'event/publication dates', 'affected route', 'facts', 'likely impact', 'source link']);
    expect(c.itemCap).toBe(5);
    expect(c.closing).toBe('End with three practical checks for the importer.');
    expect(c.wordLimit).toBe(600);
  });
});

describe('P0-2 · the contract is IN the generation request, after the verbatim question', () => {
  it('the user prompt carries the full question AND the ordered contract with the exact columns', () => {
    const prompt = buildAnalysisUserPrompt(LIVE_A, []);
    expect(prompt).toContain(`User question: "${LIVE_A}"`);
    expect(prompt).toContain("THE READER'S OUTPUT CONTRACT");
    expect(prompt).toContain('OPEN the brief with exactly 2 sentences');
    expect(prompt).toContain('"What changed" | "Date" | "Why it matters to the shop" | "Source link"');
    expect(prompt).toContain('At most 3 developments; give fewer');
    expect(prompt).toContain('END the brief with a short final paragraph that does exactly this: "Finish with one practical thing the shopkeeper should check next."');
    expect(prompt).toContain('under 250 words');
    /* order: opening → table → cap → facts → closing → limit */
    const at = (s: string) => prompt.indexOf(s);
    expect(at('OPEN the brief')).toBeLessThan(at('Markdown table'));
    expect(at('Markdown table')).toBeLessThan(at('END the brief'));
  });

  it('a question with no output instructions gets no contract block (byte-identical prompt shape)', () => {
    const q = 'What is happening in Kenya this week?';
    expect(renderOutputContract(readOutputContract(q))).toBe('');
    expect(buildAnalysisUserPrompt(q, [])).not.toContain('OUTPUT CONTRACT');
  });
});

describe('P0-2 · a reader contract keeps ONE summary, filled in the contract order', () => {
  it('broad evidence + reader contract: schema asks for "summary" (not the primary/additional split); the section says so', async () => {
    const { buildAnalysisJsonSchema, buildDevelopmentBreadthSection } = await import('./build-analysis-prompt.util');
    const broad = { clusters: 7, categories: 3, multiDevelopment: true };
    const split = JSON.stringify(buildAnalysisJsonSchema(broad));
    expect(split).toContain('primaryDevelopment');
    const contract = JSON.stringify(buildAnalysisJsonSchema({ ...broad, readerContract: true }));
    expect(contract).not.toContain('primaryDevelopment');
    expect(contract).toContain('"summary"');
    const section = buildDevelopmentBreadthSection({ ...broad, readerContract: true });
    expect(section).toContain("THE READER'S OUTPUT CONTRACT");
    expect(section).toContain('BLANK LINE');
  });
});
