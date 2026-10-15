import { resolveGeography } from './geo-resolver';

/*
  F1 (EA R106 F1-READER-IMPACT, measured at 8ec1f4a): an unqualified "Congo" must never settle the
  Republic of the Congo (COG) as a STATED country. Before this change every row below marked "was
  COG" resolved to COUNTRY COG / STATED.
*/
const iso3 = (text: string) => {
  const r = resolveGeography(text);
  return { precision: r.precision, provenance: r.provenance, isos: r.candidates.map((c) => c.country.iso3) };
};

describe('F1 — Congo is decided by the reviewed reading, never by the gazetteer name alone', () => {
  it.each([
    ['M23 rebels advance in eastern Congo'],
    ['Clashes in eastern Congo leave dozens dead'],
    ['What is happening in eastern Congo?'],
    ['Fighting near Goma, Congo'],
    ['Kinshasa, Congo: parliament votes'],
  ])('COD signal: %s → COD, never COG (was COG)', (text) => {
    const r = iso3(text);
    expect(r.isos).toContain('COD');
    expect(r.isos).not.toContain('COG');
  });

  it.each([['Congo election results'], ['Flooding hits Congo capital'], ['news in Congo'], ['Shipping goods into Congo']])(
    'bare "Congo": %s → CONTESTED [COD, COG], never a STATED pick (was COG)',
    (text) => {
      const r = iso3(text);
      expect(r.provenance).toBe('CONTESTED');
      expect([...r.isos].sort()).toEqual(['COD', 'COG']);
    },
  );

  it.each([
    ['Brazzaville, Congo: talks resume'],
    ['Republic of the Congo holds a vote'],
    ['Pointe-Noire port, Congo'],
  ])('COG signal: %s → COG kept', (text) => {
    const r = iso3(text);
    expect(r.isos).toContain('COG');
    expect(r.isos).not.toContain('COD');
  });

  it.each([['DR Congo floods'], ['Democratic Republic of the Congo election']])('qualified DRC: %s → COD, unchanged', (text) => {
    expect(iso3(text).isos).toContain('COD');
    expect(iso3(text).isos).not.toContain('COG');
  });

  it('text without Congo is untouched', () => {
    expect(iso3('Protests in Kenya').isos).toEqual(['KEN']);
  });
});

describe('F1 — EA pre-commit notes (a)–(d)', () => {
  const full = (text: string, options: Parameters<typeof resolveGeography>[1] = {}) => resolveGeography(text, options);
  it('(a) a COD read from a locality is INTERPRETED, never STATED', () => {
    const r = full('Clashes in eastern Congo leave dozens dead');
    expect(r.candidates.map((c) => c.country.iso3)).toEqual(['COD']);
    expect(r.provenance).toBe('INTERPRETED');
  });
  it('(a) a NAMED DR Congo stays STATED', () => {
    expect(full('DR Congo floods').provenance).toBe('STATED');
  });
  it.each([['Co się dzieje w Kongo?'], ['Powódź w Kongo']])('(b) Polish bare "%s" is never COG STATED', (text) => {
    const r = full(text);
    expect(r.provenance === 'STATED' && r.candidates.some((c) => c.country.iso3 === 'COG')).toBe(false);
  });
  it.each([['M23 rebels advance in Congo'], ['Lake Kivu ferry capsizes off Congo'], ['FARDC and MONUSCO patrol in Congo']])(
    '(c) article text: an actor or the lake alone never decides COD — %s → not COD-only',
    (text) => {
      const r = full(text);
      expect(r.candidates.map((c) => c.country.iso3)).not.toEqual(['COD']);
      expect(r.provenance === 'STATED' && r.candidates.some((c) => c.country.iso3 === 'COG')).toBe(false);
    },
  );
  it('(c) the same actor in a QUESTION keeps the reviewed reading (COD)', () => {
    const r = full('What is M23 doing in Congo?', { requireGeographicContext: true });
    expect(r.candidates.map((c) => c.country.iso3)).not.toContain('COG');
  });
  it('(d) the caller\'s own country COD corroborates a bare "Congo" → COD, INTERPRETED; never COG', () => {
    const r = full('Congo election results', { contextCountryIso3: 'COD' });
    expect(r.candidates.map((c) => c.country.iso3)).toEqual(['COD']);
    expect(r.provenance).toBe('INTERPRETED');
  });
});
