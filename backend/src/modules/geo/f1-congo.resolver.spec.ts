import { resolveGeography } from './geo-resolver';
import { toMapEvidenceGeography } from './map-feed.contract';

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

describe('F1 — EA F1-FIX-1/2/3 (Polish/German bare forms, ISO2 context, matched text)', () => {
  const isos = (text: string, options: Parameters<typeof resolveGeography>[1] = {}) => {
    const r = resolveGeography(text, options);
    return { r, set: r.candidates.map((c) => c.country.iso3).sort() };
  };
  it.each([['Co się dzieje w Kongo?'], ['Powódź w Kongo'], ['Walki we wschodnim Kongo'], ['Was passiert im Kongo?'], ['Kämpfe im Osten des Kongo']])(
    'F1-FIX-1 bare form never becomes a single COG or Tonga — %s',
    (text) => {
      const { r, set } = isos(text);
      expect(set).not.toContain('TON');
      expect(r.provenance === 'CONTESTED' ? true : !(set.length === 1 && set[0] === 'COG')).toBe(true);
    },
  );
  it('F1-FIX-1 bare "Kongo" with no other signal is CONTESTED [COD, COG] (not rendered)', () => {
    const { r, set } = isos('Co się dzieje w Kongo?');
    expect(r.provenance).toBe('CONTESTED');
    expect(set).toEqual(['COD', 'COG']);
  });
  it('F1-FIX-1 "Kongo" + a NAMED DRC city (Goma) → COD (the city itself is stated)', () => {
    const { set } = isos('Walki w pobliżu Gomy w Kongo — Goma');
    expect(set).toEqual(['COD']);
  });
  it('F1-FIX-1 qualified PL "Republika Konga" → COG (named), never Tonga', () => {
    const { r, set } = isos('Republika Konga: wybory');
    expect(set).toEqual(['COG']);
    expect(r.provenance).toBe('STATED');
  });
  it('P-08 "Demokratyczna Republika Konga" stays COD', () => {
    expect(isos('Wybory w Demokratycznej Republice Konga', {}).set).toEqual(['COD']);
  });
  it('F1-FIX-2 an ISO2 context "CD" corroborates exactly like "COD"', () => {
    const { r, set } = isos('Congo election results', { contextCountryIso3: 'CD' });
    expect(set).toEqual(['COD']);
    expect(r.provenance).toBe('INTERPRETED');
  });
  it('F1-FIX-3 an inferred country never reports a matched text the reader did not write ("dr congo")', () => {
    expect(isos('Clashes in eastern Congo leave dozens dead').r.matchedText).toBe('congo');
  });
});

describe('F1 — EA F1-R2-1/2/3 ("democratic" in any language, the inferred label, both named)', () => {
  it.each([
    ['Kämpfe in der Demokratischen Republik Kongo'],
    ['Demokratische Republik Kongo: Wahlen'],
    ['Demokratická republika Kongo: boje u Gomy'],
    ['Demokratiska republiken Kongo'],
    ['Republik Demokratik Kongo'],
  ])('F1-R2-1 %s → COD STATED, never COG', (text) => {
    const r = resolveGeography(text, { contextCountryIso3: 'COG' });
    const isos = r.candidates.map((c) => c.country.iso3);
    expect(isos).toContain('COD');
    expect(isos).not.toContain('COG');
    expect(r.provenance).not.toBe('INTERPRETED');
  });
  it('F1-R2-1 "Republik Kongo … Brazzaville" stays COG', () => {
    const r = resolveGeography('Republik Kongo: Proteste in Brazzaville');
    expect(r.candidates.map((c) => c.country.iso3)).toContain('COG');
    expect(r.candidates.map((c) => c.country.iso3)).not.toContain('COD');
  });
  it('F1-R2-3 both named → both countries, neither dropped', () => {
    const isos = resolveGeography('Republika Konga i Demokratyczna Republika Konga').candidates.map((c) => c.country.iso3);
    expect(isos).toEqual(expect.arrayContaining(['COD', 'COG']));
  });
  it('F1-R2-2 an inferred COD keeps matchedText "congo" but is LABELLED by its own name', () => {
    const r = resolveGeography('Clashes in eastern Congo leave dozens dead');
    expect(r.matchedText).toBe('congo');
    const m = toMapEvidenceGeography(r);
    expect(m.place?.label).toBe(m.place?.canonicalName);
    expect(m.place?.label).not.toBe('Congo');
  });
});
