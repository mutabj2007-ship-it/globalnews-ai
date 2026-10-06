import { maskOutputVocabulary } from './output-instructions';
import { resolveGeography } from '../../geo/geo-resolver';

/**
 * ASK R2 LIVE-GATE REPAIR (P0-1) — requested columns / headers / output instructions are not
 * places. Live Alpha (fe96eb1, TEST A): "| Date |" resolved to Date, Hokkaido → JPN, Kenya lost.
 * Unseen variants are tested against the REAL resolver (full gazetteer), and a genuine Date,
 * Japan question must still resolve.
 */
const iso = (text: string): string[] => {
  const geo = resolveGeography(maskOutputVocabulary(text));
  if (geo.precision === 'UNKNOWN') return [];
  return (geo.place ? [geo.place] : geo.candidates).map((p) => p.country.iso3);
};

describe('P0-1 · output vocabulary never becomes geography', () => {
  it('the live failure: "What changed | Date | Why it matters | Source link" keeps Kenya', () => {
    const live =
      'What are the three most important developments reported in the past seven days that could affect a small shop owner in Kenya? Start with a two-sentence summary. Then use a compact table: What changed | Date | Why it matters to the shop | Source link. Finish with one practical thing the shopkeeper should check next.';
    expect(resolveGeography(live).place?.country.iso3 ?? null).not.toBe('KEN'); /* the defect, measured */
    expect(iso(live)).toEqual(['KEN']);
  });

  it.each([
    ['Date | Development | Source', 'What happened in Uganda this week? Answer as a table: Date | Development | Source.', 'UGA'],
    ['show date and source', 'List recent fuel price changes in Tanzania and show date and source for each.', 'TZA'],
    ['columns: location, facts, impact', 'Summarise flooding in Malawi this month. Columns: location, facts, impact.', 'MWI'],
    ['table with: development, date, route', 'Ports news for Kenya this week — table with: development, date, route, source.', 'KEN'],
    ['headers', 'Give me Rwanda trade updates with headers Date, Summary, Analysis, Source.', 'RWA'],
  ])('%s → the named country, never a column-word town', (_n, text, want) => {
    expect(iso(text)).toEqual([want]);
  });

  it('a genuine question about Date, Japan still resolves to Japan (no output context)', () => {
    expect(iso('What is the weather like in Date, Hokkaido this week?')).toEqual(['JPN']);
  });

  it('masking is span-preserving and touches only format words inside the instruction', () => {
    const text = 'News from Kenya. Table: Date | Source | Impact.';
    const masked = maskOutputVocabulary(text);
    expect(masked).toHaveLength(text.length);
    expect(masked.startsWith('News from Kenya.')).toBe(true);
    expect(masked).not.toMatch(/Date|Source|Impact/);
  });

  it('no output-instruction context → the text is returned unchanged', () => {
    const text = 'What changed in the Kenyan shilling exchange rate since the last policy date?';
    expect(maskOutputVocabulary(text)).toBe(text);
  });
});
