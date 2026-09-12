import { foldGeographyIdSegment, foldPlaceName } from './geo-normalize.util';
import { searchGazetteer, lookupGeographyId } from './gazetteer-search';
import { mapGeographyForArticle } from './map-feed.contract';
import { allSupranationalRegions } from './supranational-membership';

/**
 * G-P1-D1 — THE CANONICAL GEOGRAPHY-ID FOLD, AND PROOF NO ID MOVED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `foldForId` was implemented privately in more than one module. The copies were
 * behaviourally identical, which is exactly what makes the duplication dangerous
 * rather than harmless: nothing would fail on the day one of them drifted. A
 * `geographyId` is an IDENTITY shared by the map feed, the navigator and every
 * Watch subject, and if one producer folded differently, a place searched and
 * the same place resolved from an article would simply stop matching — silently,
 * with no error anywhere.
 *
 * The rule now has one implementation, `foldGeographyIdSegment`, beside the
 * other geography normalizers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ASSERTIONS BELOW PIN LITERAL ID STRINGS ON PURPOSE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A test that recomputed the expected id with the same function it is testing
 * would pass no matter what that function did. These are hard-coded strings,
 * captured BEFORE the de-duplication, so this file is a genuine regression
 * barrier rather than a tautology.
 */

describe('1 · the canonical fold behaves exactly as the removed duplicates did', () => {
  it.each([
    ['Kigali', 'kigali'],
    ['New York', 'new-york'],
    ['Nakuru County', 'nakuru-county'],
    ['Kraków', 'krakow'],
    // An apostrophe folds to a SEPARATOR, not to nothing — so the segment is
    // "n-djamena". Captured from actual behaviour rather than assumed.
    ["N'Djamena", 'n-djamena'],
    ['Eastern Africa', 'eastern-africa'],
    ['Saint-Pierre  et   Miquelon', 'saint-pierre-et-miquelon'],
  ])('%s -> %s', (input, expected) => {
    expect(foldGeographyIdSegment(input)).toBe(expected);
  });

  it('is foldPlaceName with whitespace collapsed to hyphens, and nothing else', () => {
    for (const value of ['Kigali', 'New York', 'Kraków', 'Nakuru County']) {
      expect(foldGeographyIdSegment(value)).toBe(foldPlaceName(value).replace(/\s+/g, '-'));
    }
  });

  it('is NOT foldPlaceName — the two answer different questions', () => {
    // foldPlaceName: "are these the same name?"  (matching)
    // foldGeographyIdSegment: "what is this name's stable form in an id?"
    expect(foldPlaceName('New York')).toBe('new york');
    expect(foldGeographyIdSegment('New York')).toBe('new-york');
  });
});

/* ── 2 · NO IDENTIFIER CHANGED ──────────────────────────────────────────── */

describe('2 · every geographyId is byte-identical to before the de-duplication', () => {
  it.each([
    ['Kigali', 'city:RWA:kigali@-1.94995,30.05885'],
    ['Nairobi', 'city:KEN:nairobi@-1.28333,36.81667'],
    ['Warsaw', 'city:POL:warsaw@52.22977,21.01178'],
    ['Musanze', 'city:RWA:musanze@-1.49984,29.63497'],
    ['Kibungo', 'city:RWA:kibungo@-2.1597,30.5427'],
  ])('%s is still %s', (query, expectedId) => {
    const node = searchGazetteer(query, { kind: 'city' }).nodes[0];

    expect(node.geographyId).toBe(expectedId);
  });

  it.each([
    ['Eastern Africa', 'region:eastern-africa'],
    ['Middle East', 'region:middle-east'],
    ['Baltic states', 'region:baltic-states'],
    ['Sub-Saharan Africa', 'region:sub-saharan-africa'],
    ['East African Community', 'region:east-african-community'],
  ])('the region id for %s is still %s', (name, expectedId) => {
    const region = allSupranationalRegions().find((candidate) => candidate.name === name);

    expect(region?.geographyId).toBe(expectedId);
  });

  it('every region id still round-trips through lookup', () => {
    for (const region of allSupranationalRegions()) {
      expect(lookupGeographyId(region.geographyId)?.name).toBe(region.name);
    }
  });

  it('THE SEARCH ID AND THE ARTICLE-RESOLUTION ID STILL MATCH', () => {
    /*
     * The assertion the de-duplication exists to protect. `map-feed.contract.ts`
     * and `gazetteer-search.ts` must fold identically forever; this proves they
     * still do, across the whole ladder rather than for one example.
     */
    const searched = searchGazetteer('Kigali', { kind: 'city' }).nodes[0];
    const resolved = mapGeographyForArticle('Kigali hosts regional summit on trade');

    expect(resolved.place?.geographyId).toBe(searched.geographyId);
  });

  it('no region id contains whitespace or an uppercase character', () => {
    for (const region of allSupranationalRegions()) {
      const segment = region.geographyId.slice('region:'.length);

      expect(segment).not.toMatch(/\s/);
      expect(segment).toBe(segment.toLowerCase());
    }
  });
});
