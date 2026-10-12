import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { routeTypedCountryOf } from '../../ask-v2/ask-r2-execution.adapter';
import { anchorSubjectQuery, anchoredQueries, questionAnchorsOf, supplementQueries } from '../query/question-anchors.util';
import { supplementCredit } from './comparison-coverage-credit.util';

/*
  EA-GEO-R1 G-4 / G-4a / G-5 — a comparison keeps BOTH countries and the subject.
  Companion to ea-geo-r1.acceptance.spec.ts (A-03 / A-04 / A-05 there). Synthetic text only.
*/
const SENTINEL = 'Compare the latest economic news from Kenya and Rwanda.';
const route = (q: string): any =>
  routeAskR2(
    { originalQuestion: q, sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en', origin: 'ASK' } as never,
    { requestInstant: '2026-10-12T12:00:00Z' } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
const routeGeo = (q: string): string[] => route(q).envelope.geography.candidates.map((c: { value: string }) => c.value);
const kenya = (n: number) => ({ title: `Kenya inflation report ${n}`, summary: 'Prices in Kenya rose more slowly.' });
const rwanda = { title: 'Rwanda GDP grows 8.2%', summary: 'The National Institute of Statistics of Rwanda reported growth.' };

describe('G-4 · the top-up is per side', () => {
  const a = questionAnchorsOf(SENTINEL);

  it('a side no admitted report names is searched with the subject, whatever the total', () => {
    expect(supplementQueries(a, [kenya(1), kenya(2), kenya(3), kenya(4)])).toEqual(['Rwanda economy']);
    expect(supplementQueries(a, [rwanda])).toEqual(['Kenya economy']);
    expect(supplementQueries(a, [])).toEqual(['Kenya economy', 'Rwanda economy']);
  });

  it('every side covered: the unchanged total rule (fewer than three → both, three or more → none)', () => {
    expect(supplementQueries(a, [kenya(1), rwanda])).toEqual(['Kenya economy', 'Rwanda economy']);
    expect(supplementQueries(a, [kenya(1), kenya(2), rwanda])).toEqual([]);
  });

  it('a third side is searched too (bounded by the classifier\'s three sides)', () => {
    expect(anchoredQueries(questionAnchorsOf('Compare the latest economic news from Kenya, Rwanda and Tanzania.'))).toEqual([
      'Kenya economy',
      'Rwanda economy',
      'Tanzania economy',
    ]);
  });

  it('a LINKED question keeps its one joint query', () => {
    const linked = questionAnchorsOf('What is the conflict between Rwanda and DR Congo about?');
    if (linked.gated && linked.relation === 'LINKED') {
      expect(supplementQueries(linked, [])).toHaveLength(1);
    }
  });
});

describe('G-4a · each side is searched with the subject', () => {
  it('the subject words of a gated question; none for an ungated one', () => {
    expect(anchorSubjectQuery(questionAnchorsOf(SENTINEL))).toBe('economy');
    expect(anchorSubjectQuery(questionAnchorsOf('What is happening?'))).toBeUndefined();
    expect(anchorSubjectQuery(undefined)).toBeUndefined();
  });
});

describe('G-4 · coverage credits a supplement report to the country it evidences', () => {
  const own = { live: new Set(['ke-own']), retained: new Set<string>() };
  const supplement = { live: new Set(['ke-1', 'ke-2', 'ke-3', 'rw-1']), retained: new Set(['rw-2']) };
  const evidence = [{ id: 'ke-own' }, { id: 'ke-1' }, { id: 'ke-2' }, { id: 'ke-3' }, { id: 'rw-1' }, { id: 'rw-2' }, { id: 'other' }];
  const namesRwanda = (a: { id: string }) => a.id.startsWith('rw-');

  it('three Kenya reports never establish Rwanda; the Rwanda reports do, by how they arrived', () => {
    expect(supplementCredit(evidence, { live: new Set(), retained: new Set() }, supplement, namesRwanda)).toEqual({ live: 1, retained: 1 });
  });

  it('a country\'s own search results are not counted twice, and unrelated reports never count', () => {
    expect(supplementCredit(evidence, own, supplement, (a) => a.id.startsWith('ke-'))).toEqual({ live: 3, retained: 0 });
    expect(supplementCredit(evidence, own, supplement, () => false)).toEqual({ live: 0, retained: 0 });
  });
});

describe('G-5 · the Ask plan names every compared country', () => {
  it('both sides are TYPED_GEOGRAPHY candidates, in the reader\'s order', () => {
    expect(routeGeo(SENTINEL)).toEqual(['KEN', 'RWA']);
    expect(routeGeo('Compare the latest economic news from Rwanda and Kenya.')).toEqual(['RWA', 'KEN']);
  });

  it('a single-country question is unchanged, and a comparison hands Analysis no single typed country', () => {
    expect(routeGeo('What is happening in Kenya?')).toEqual(['KEN']);
    expect(routeTypedCountryOf(route(SENTINEL))).toBeUndefined();
  });
});
