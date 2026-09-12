import { cleanSourceName } from './source-name-suffix';
import { searchGazetteer } from './gazetteer-search';
import { mapGeographyForQuery } from './map-feed.contract';
import { foldPlaceName } from './geo-normalize.util';
import gazetteer from './data/gazetteer.v1.json';
import { COUNTRIES } from '@globalnews-ai/shared';

/**
 * R-GEO-NAME-SUFFIX — 121 SOURCE NAMES CARRY A `", <Country>"` DISAMBIGUATOR.
 *
 * The correction is ADDITIVE. Nothing is stripped destructively, no source
 * string is rewritten, and no identifier moves. A derived `searchLabel` travels
 * beside the source `name`, and only the record's OWN country may be removed.
 */

const byIso2 = new Map(COUNTRIES.map((c) => [c.iso2, c] as const));
type Region = { readonly n: string; readonly cc: string; readonly al?: readonly string[] };
type City = { readonly n: string; readonly cc: string };
const REGIONS = gazetteer.regions as unknown as Region[];
const CITIES = gazetteer.cities as unknown as City[];

/* ── 1 · THE RULE ───────────────────────────────────────────────────────── */

describe('1 · only the record’s OWN country may be removed', () => {
  it('removes it when the tail is exactly that country', () => {
    expect(cleanSourceName('Bari, Somalia', 'Somalia')).toEqual({
      sourceLabel: 'Bari, Somalia',
      searchLabel: 'Bari',
      suffixRemoved: true,
    });
  });

  it.each([
    ['Bay, Somalia', 'Bay'],
    ['Hiran, Somalia', 'Hiran'],
    ['Nugal, Somalia', 'Nugal'],
    ['Saint George Parish, Antigua and Barbuda', 'Saint George Parish'],
  ])('%s -> %s', (source, expected) => {
    const country = source.slice(source.lastIndexOf(',') + 1).trim();

    expect(cleanSourceName(source, country).searchLabel).toBe(expected);
  });

  it('FONTANA, GOZO SURVIVES INTACT — Gozo is an island, not Malta', () => {
    const cleaned = cleanSourceName('Fontana, Gozo', 'Malta');

    expect(cleaned.searchLabel).toBe('Fontana, Gozo');
    expect(cleaned.suffixRemoved).toBe(false);
    expect(cleaned.sourceLabel).toBe('Fontana, Gozo');
  });

  it.each([
    ['Moravče, Moravče', 'Slovenia'],
    ['Tabor, Tabor', 'Slovenia'],
    ['Kareliya, Respublika', 'Russia'],
    ['Severnaya Osetiya-Alaniya, Respublika', 'Russia'],
    ['Archipelago of San Andrés, Providencia and Santa Catalina', 'Colombia'],
    ["Southern Nations, Nationalities, and Peoples' Region", 'Ethiopia'],
  ])('%s is left exactly as the source wrote it', (source, country) => {
    expect(cleanSourceName(source, country).searchLabel).toBe(source);
  });

  it('VINICA MUNICIPALITY, MACEDONIA IS DELIBERATELY LEFT ALONE', () => {
    /*
     * Its country is "North Macedonia" and the tail is "Macedonia". Not an
     * exact match, so nothing happens — and that is the intended outcome, not
     * a gap. Deciding that "Macedonia" names North Macedonia is a judgement
     * with a contested history, and a label-tidying helper may not make it.
     * One redundant-looking label is the correct price.
     */
    expect(cleanSourceName('Vinica Municipality, Macedonia', 'North Macedonia').searchLabel).toBe(
      'Vinica Municipality, Macedonia',
    );
  });

  it('a name with no comma is returned untouched', () => {
    expect(cleanSourceName('Kigali', 'Rwanda')).toEqual({
      sourceLabel: 'Kigali',
      searchLabel: 'Kigali',
      suffixRemoved: false,
    });
  });

  it('never empties a name, even if the head is only punctuation', () => {
    expect(cleanSourceName(', Somalia', 'Somalia').searchLabel).toBe(', Somalia');
    expect(cleanSourceName('-, Somalia', 'Somalia').searchLabel).toBe('-, Somalia');
  });

  it('does nothing when no country is known', () => {
    expect(cleanSourceName('Bari, Somalia', undefined).searchLabel).toBe('Bari, Somalia');
  });

  it('matches on the folded form, so casing and diacritics do not decide', () => {
    expect(cleanSourceName('Bari, SOMALIA', 'Somalia').suffixRemoved).toBe(true);
    expect(cleanSourceName('Bari, Sómalia', 'Somalia').suffixRemoved).toBe(true);
  });
});

/* ── 2 · THE WHOLE CORPUS ───────────────────────────────────────────────── */

describe('2 · applied across the shipped gazetteer, the counts are exact', () => {
  const suffixed = REGIONS.filter((r) => {
    const country = byIso2.get(r.cc);

    return country ? cleanSourceName(r.n, country.name).suffixRemoved : false;
  });

  it('exactly 113 of the 121 comma-bearing admin1 names are country-suffixed', () => {
    expect(REGIONS.filter((r) => r.n.includes(',')).length).toBe(121);
    expect(suffixed.length).toBe(113);
  });

  it('the other 8 are untouched — the rule refuses them by construction', () => {
    const untouched = REGIONS.filter((r) => r.n.includes(',')).filter((r) => {
      const country = byIso2.get(r.cc);

      return !country || !cleanSourceName(r.n, country.name).suffixRemoved;
    });

    expect(untouched.map((r) => r.n).sort()).toEqual([
      'Archipelago of San Andrés, Providencia and Santa Catalina',
      'Fontana, Gozo',
      'Kareliya, Respublika',
      'Moravče, Moravče',
      'Severnaya Osetiya-Alaniya, Respublika',
      "Southern Nations, Nationalities, and Peoples' Region",
      'Tabor, Tabor',
      'Vinica Municipality, Macedonia',
    ]);
  });

  it('EXACTLY ONE CITY IS AFFECTED, AND ITS ID DOES NOT MOVE', () => {
    /*
     * FOUND BY THIS TEST FAILING, AND THE FIRST MEASUREMENT WAS WRONG.
     *
     * My earlier probe split on the FIRST comma and reported that none of the
     * ten comma-bearing city names was country-suffixed. The rule splits on the
     * LAST comma, which is the correct reading of a trailing disambiguator, and
     * under it one city qualifies:
     *
     *     "Villa Presidente Frei, Ñuñoa, Santiago, Chile"
     *          -> "Villa Presidente Frei, Ñuñoa, Santiago"
     *
     * That is the right answer for that record. It matters more than the other
     * 113 because CITY ids ARE built from the name, so this is the one place a
     * label change could have moved an identifier. It does not: the id is built
     * from `name`, which is untouched, and is asserted below unchanged.
     */
    const affected = CITIES.filter((c) => {
      const country = byIso2.get(c.cc);

      return country ? cleanSourceName(c.n, country.name).suffixRemoved : false;
    });

    expect(CITIES.filter((c) => c.n.includes(',')).length).toBe(10);
    expect(affected.map((c) => c.n)).toEqual(['Villa Presidente Frei, Ñuñoa, Santiago, Chile']);

    const node = searchGazetteer('Villa Presidente Frei', { limit: 4 }).nodes[0];

    expect(node.geographyId).toBe(
      'city:CHL:villa-presidente-frei-nunoa-santiago-chile@-33.46069,-70.58024',
    );
    expect(node.name).toBe('Villa Presidente Frei, Ñuñoa, Santiago, Chile');
    expect(node.searchLabel).toBe('Villa Presidente Frei, Ñuñoa, Santiago');
  });

  it('no cleaned label collides with another admin1 in the same country', () => {
    for (const r of suffixed) {
      const country = byIso2.get(r.cc)!;
      const clean = foldPlaceName(cleanSourceName(r.n, country.name).searchLabel);
      const clash = REGIONS.filter((x) => x.cc === r.cc && x.n !== r.n).find(
        (x) => foldPlaceName(x.n) === clean,
      );

      expect(clash).toBeUndefined();
    }
  });

  it('every cleaned label is non-empty and shorter than its source', () => {
    for (const r of suffixed) {
      const country = byIso2.get(r.cc)!;
      const { searchLabel, sourceLabel } = cleanSourceName(r.n, country.name);

      expect(searchLabel.length).toBeGreaterThan(0);
      expect(searchLabel.length).toBeLessThan(sourceLabel.length);
    }
  });
});

/* ── 3 · SEARCHABILITY ──────────────────────────────────────────────────── */

describe('3 · searchable by the bare name — which it already was', () => {
  /*
   * WORTH STATING BECAUSE I PREVIOUSLY GOT IT WRONG. An earlier note of mine
   * claimed "the alias arrays do not carry the bare form". They do — all 113
   * carry the clean head as an alias in the shipped data, so `Bari` already
   * found `Bari, Somalia` before this package. The gap was never search; it was
   * the LABEL that search and the map feed then showed.
   */
  it('BARI FINDS THE SOMALI REGION, and shows it as Bari', () => {
    const hit = searchGazetteer('Bari', { limit: 10 }).nodes.find(
      (n) => n.geographyId === 'admin1:SO-BR',
    );

    expect(hit).toBeDefined();
    expect(hit!.name).toBe('Bari, Somalia');
    expect(hit!.searchLabel).toBe('Bari');
  });

  it.each([
    ['Bay', 'admin1:SO-BY', 'Bay, Somalia', 'Bay'],
    ['Hiran', 'admin1:SO-HI', 'Hiran, Somalia', 'Hiran'],
    ['Nugal', 'admin1:SO-NU', 'Nugal, Somalia', 'Nugal'],
  ])('%s -> %s keeps the source name and adds the clean one', (q, id, source, clean) => {
    const hit = searchGazetteer(q, { limit: 10 }).nodes.find((n) => n.geographyId === id);

    expect(hit).toBeDefined();
    expect(hit!.name).toBe(source);
    expect(hit!.searchLabel).toBe(clean);
  });

  it('the clean head is present as an alias in the shipped data, for all 113', () => {
    for (const r of REGIONS) {
      const country = byIso2.get(r.cc);
      if (!country) continue;
      const { searchLabel, suffixRemoved } = cleanSourceName(r.n, country.name);
      if (!suffixRemoved) continue;

      expect((r.al ?? []).some((a) => foldPlaceName(a) === foldPlaceName(searchLabel))).toBe(true);
    }
  });

  it('FONTANA, GOZO STAYS SEMANTICALLY INTACT THROUGH SEARCH', () => {
    const hit = searchGazetteer('Fontana', { limit: 10 }).nodes.find(
      (n) => n.geographyId === 'admin1:MT-10',
    );

    expect(hit).toBeDefined();
    expect(hit!.name).toBe('Fontana, Gozo');
    expect(hit!.searchLabel).toBe('Fontana, Gozo');
  });
});

/* ── 4 · THE DOUBLED COUNTRY ────────────────────────────────────────────── */

describe('4 · the analysis round trip no longer names the country twice', () => {
  it.each([
    ['Hiran', 'Hiran, Somalia'],
    ['Nugal', 'Nugal, Somalia'],
  ])('%s produces "%s", not "…, Somalia, Somalia"', (query, expected) => {
    /*
     * MEASURED ON C10 BEFORE THE CHANGE: analysisQuery was
     * "Hiran, Somalia, Somalia", because it is built as
     * `${canonicalName}, ${country}` and the canonical name already ended in
     * the country. This is the one behaviour in the package that a user could
     * have noticed, since analysisQuery is the round-trip retrieval string.
     */
    const feed = mapGeographyForQuery(`what is happening in ${query}?`);

    expect(feed.place?.analysisQuery).toBe(expected);
    expect(feed.place?.analysisQuery).not.toContain('Somalia, Somalia');
  });

  it('no analysisQuery anywhere repeats its own country', () => {
    for (const q of ['Hiran', 'Nugal', 'Kigali', 'Warsaw', 'Musanze']) {
      const feed = mapGeographyForQuery(`what is happening in ${q}?`);
      const place = feed.place;
      if (!place) continue;

      const country = place.countryName;
      const occurrences = place.analysisQuery.split(country).length - 1;
      expect(occurrences).toBeLessThanOrEqual(1);
    }
  });

  it('the canonical name is UNCHANGED — provenance is not rewritten', () => {
    const feed = mapGeographyForQuery('what is happening in Hiran?');

    expect(feed.place?.canonicalName).toBe('Hiran, Somalia');
    expect(feed.place?.searchLabel).toBe('Hiran');
  });

  it('a country query is unaffected', () => {
    expect(mapGeographyForQuery('what is happening in Rwanda?').place?.analysisQuery).toBe('Rwanda');
  });
});

/* ── 5 · NOTHING ELSE MOVED ─────────────────────────────────────────────── */

describe('5 · no geography id changes and no source label is rewritten', () => {
  it('ids are byte-identical to C10 for the affected records', () => {
    // admin1 ids come from the ISO 3166-2 code, never from the name, which is
    // why a label correction cannot move one. Asserted rather than argued.
    expect(searchGazetteer('Bari', { limit: 10 }).nodes.map((n) => n.geographyId)).toContain(
      'admin1:SO-BR',
    );
    expect(mapGeographyForQuery('what is happening in Hiran?').place?.geographyId).toBe(
      'admin1:SO-HI',
    );
    expect(mapGeographyForQuery('what is happening in Rwanda?').place?.geographyId).toBe(
      'country:RWA',
    );
  });

  it('EVERY node still carries the source name verbatim', () => {
    for (const q of ['Bari', 'Bay', 'Hiran', 'Nugal', 'Fontana']) {
      for (const node of searchGazetteer(q, { limit: 10 }).nodes) {
        const source =
          REGIONS.find((r) => r.n === node.name) ?? CITIES.find((c) => c.n === node.name);

        // The node's `name` must be findable in the gazetteer exactly as it is.
        if (node.kind === 'admin1' || node.kind === 'city') expect(source).toBeDefined();
      }
    }
  });

  it('searchLabel equals name for everything that is not country-suffixed', () => {
    let checked = 0;

    for (const node of searchGazetteer('Kigali', { limit: 10 }).nodes) {
      expect(node.searchLabel).toBe(node.name);
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
  });
});
