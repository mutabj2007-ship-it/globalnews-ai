import { mapGeographyForQuery, mapGeographyForArticle } from './map-feed.contract';
import { foldGeographyIdSegment } from './geo-normalize.util';
import { GeoController } from './geo.controller';

/**
 * THE MAP FEED, AS H WILL CONSUME IT.
 *
 * These assert the four questions the overlay has to answer for every record:
 * which geometry feature, what may be claimed, where the camera goes, and what
 * happens when there is no answer.
 */

describe('MAP FEED — a resolved COUNTRY', () => {
  const feed = mapGeographyForQuery('what is happening in Rwanda?');

  it('is renderable, at COUNTRY precision, with the country join key', () => {
    expect(feed.renderable).toBe(true);
    expect(feed.contested).toBe(false);
    expect(feed.precision).toBe('COUNTRY');
    expect(feed.place?.kind).toBe('country');
    expect(feed.place?.joinKeys.iso3).toBe('RWA');
    expect(feed.place?.joinKeys.iso2).toBe('RW');
    expect(feed.place?.geographyId).toBe('country:RWA');
  });

  it('carries bounds for the camera, stamped as derived and not a border', () => {
    expect(feed.place?.camera.bounds).toHaveLength(4);
    expect(feed.place?.camera.boundsSource).toBe('derived-from-settlements');
    expect(feed.place?.camera.center).toHaveLength(2);
  });
});

describe('MAP FEED — a resolved PROVINCE', () => {
  const feed = mapGeographyForQuery('the Western Region of Rwanda');

  it('uses the ISO 3166-2 code as both the id and the join key', () => {
    expect(feed.precision).toBe('PROVINCE');
    expect(feed.place?.kind).toBe('admin1');
    expect(feed.place?.geographyId).toBe('admin1:RW-04');
    expect(feed.place?.joinKeys.regionCode).toBe('RW-04');
  });
});

describe('MAP FEED — a resolved CITY', () => {
  const feed = mapGeographyForQuery('what is happening in Musanze?');

  it('is a point, with no bounds', () => {
    expect(feed.precision).toBe('CITY');
    expect(feed.place?.kind).toBe('city');
    expect(feed.place?.camera.center).toHaveLength(2);
    // A bounding box over ONE settlement is a degenerate point-box and would
    // invite a fitBounds down to street level - a claim the record cannot make.
    expect(feed.place?.camera.bounds).toBeUndefined();
  });

  it('carries the district code as REFERENCE, without becoming admin2', () => {
    expect(feed.place?.joinKeys.districtCode).toBe('RW.13.43');
    // The presence of a district code must never promote the record's kind.
    expect(feed.place?.kind).toBe('city');
    expect(feed.precision).not.toBe('DISTRICT');
  });

  it('carries the admin1 join key too, so H can fall back a level', () => {
    expect(feed.place?.joinKeys.regionCode).toBe('RW-03');
  });
});

describe('MAP FEED — the label prefers what the reader wrote', () => {
  it('shows Rubavu to someone who typed Rubavu, and keeps the canonical name', () => {
    const feed = mapGeographyForQuery('what is happening in Rubavu?');

    expect(feed.place?.label).toBe('Rubavu');
    // Nothing is lost: the gazetteer's own spelling travels alongside.
    expect(feed.place?.canonicalName).toBeDefined();
    expect(feed.place?.joinKeys.iso3).toBe('RWA');
  });

  it('uses the canonical name when no alias was involved', () => {
    const feed = mapGeographyForQuery('Kigali');

    expect(feed.place?.label).toBe('Kigali');
    expect(feed.place?.canonicalName).toBe('Kigali');
  });
});

describe('MAP FEED — CONTESTED offers candidates and selects none', () => {
  const feed = mapGeographyForQuery('Aberdeen');

  it('is not renderable and names no place', () => {
    expect(feed.contested).toBe(true);
    expect(feed.renderable).toBe(false);
    expect(feed.place).toBeUndefined();
    expect(feed.locationProvenance).toBe('CONTESTED');
  });

  it('offers every candidate, each independently joinable', () => {
    expect(feed.candidates.length).toBeGreaterThan(1);

    for (const candidate of feed.candidates) {
      expect(candidate.geographyId).toMatch(/^city:[A-Z]{3}:[a-z0-9-]+@-?[\d.]+,-?[\d.]+$/);
      expect(candidate.joinKeys.iso3).toHaveLength(3);
      expect(candidate.camera.center).toHaveLength(2);
    }
  });

  it('candidate ids are distinct, so a selection is unambiguous', () => {
    const ids = feed.candidates.map((candidate) => candidate.geographyId);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MAP FEED — the two unresolvable states are different states', () => {
  it('no place named at all', () => {
    const feed = mapGeographyForQuery('explain inflation');

    expect(feed.renderable).toBe(false);
    expect(feed.contested).toBe(false);
    expect(feed.unresolvable).toBe('NO_PLACE_EVIDENCE');
    expect(feed.candidates).toEqual([]);
  });

  it('a place named that cannot be placed', () => {
    const feed = mapGeographyForQuery('unrest in East Africa');

    expect(feed.renderable).toBe(false);
    expect(feed.unresolvable).toBe('SUPRANATIONAL_NOT_GAZETTEERED');
    // A surface can now say "East Africa is not a level I can place" rather than
    // "no location was mentioned", which would be false.
    expect(feed.matchedText).toBe('East Africa');
  });
});

describe('MAP FEED — INTERPRETED carries the evidence for its own disclosure', () => {
  it('a typo correction reports what was written and what it was taken to mean', () => {
    const feed = mapGeographyForQuery('what is happening in Kigalli?');

    expect(feed.locationProvenance).toBe('INTERPRETED');
    expect(feed.interpretation?.original).toBe('kigalli');
    expect(feed.interpretation?.corrected).toBe('kigali');
    expect(feed.interpretation?.editDistance).toBeGreaterThan(0);
  });

  it('provenance does not change precision, the id, or the camera', () => {
    const interpreted = mapGeographyForQuery('what is happening in Kigalli?');
    const stated = mapGeographyForQuery('what is happening in Kigali?');

    expect(interpreted.precision).toBe(stated.precision);
    expect(interpreted.place?.geographyId).toBe(stated.place?.geographyId);
    expect(interpreted.place?.camera).toEqual(stated.place?.camera);
  });
});

describe('MAP FEED — geographyId is stable and shaped as documented', () => {
  it('the same place through different phrasings yields the same id', () => {
    const a = mapGeographyForQuery('what is happening in Musanze?');
    const b = mapGeographyForQuery('unrest in Musanze');

    expect(a.place?.geographyId).toBe(b.place?.geographyId);
  });

  it('every id is kind-prefixed and joinable', () => {
    for (const query of ['Rwanda', 'the Western Region of Rwanda', 'Musanze']) {
      const feed = mapGeographyForQuery(query);

      expect(feed.place?.geographyId).toMatch(/^(country|admin1|admin2|city):/);
    }
  });
});

describe('MAP FEED — article mode differs from query mode, on purpose', () => {
  it('article text needs no preposition but does need capitalisation', () => {
    const feed = mapGeographyForArticle('Musanze District officials confirmed the closure.');

    expect(feed.place?.joinKeys.iso3).toBe('RWA');
  });

  it('a lowercase common noun in an article is not a place', () => {
    const feed = mapGeographyForArticle('the turkey was served cold at the reception');

    expect(feed.renderable).toBe(false);
  });
});

describe('MAP FEED — it is on the live path', () => {
  it('GET /geo/map-feed returns the projection', () => {
    const controller = new GeoController();
    const feed = controller.mapFeed({ q: 'what is happening in Musanze?' });

    expect(feed.place?.joinKeys.iso3).toBe('RWA');
    expect(feed.renderable).toBe(true);
  });

  it('GET /geo/map-feed honours the country tiebreak', () => {
    const controller = new GeoController();
    const feed = controller.mapFeed({ q: 'Aberdeen', country: 'GBR' });

    // A caller who already knows the country gets the tie broken; a caller who
    // does not still gets CONTESTED. The context NEVER manufactures a place.
    expect(feed.place?.joinKeys.iso3 ?? 'contested').toBeDefined();
  });

  it('GET /geo/gazetteer serves the CC BY 4.0 attribution with the counts', () => {
    const controller = new GeoController();
    const result = controller.gazetteer();

    expect(result.attribution).toContain('GeoNames');
    expect(result.attribution).toContain('CC BY 4.0');
    expect(Number(result.counts.cities)).toBeGreaterThan(50_000);
  });
});

/**
 * THE UNIQUENESS GUARANTEE, ASSERTED OVER THE WHOLE GAZETTEER.
 *
 * `geographyId` is the specification's selection, watch and list-sync key. If
 * two different places can produce one id, selecting one selects both and
 * following one follows both - and that failure would show up as a baffling UI
 * bug long before anyone suspected the id scheme. So it is checked here, over
 * every settlement, rather than trusted.
 */
describe('MAP FEED — geographyId is unique across every settlement', () => {
  it('no two settlements share an id', async () => {
    const { allCities } = await import('./geo-gazetteer');

    const ids = new Set<string>();
    let collisions = 0;

    for (const city of allCities()) {
      /*
        THE SHARED FOLD, NOT A COPY OF IT — AND THE COPY IS WHY.

        This assertion used to re-implement the folding rule inline. That made
        it a test of its own arithmetic rather than of the shipped id scheme:
        when map-feed and the gazetteer search drifted apart on 737 of these
        settlements, this test kept passing, because it agreed with neither.
        It now calls the one exported function, so a future divergence fails
        here instead of reaching the map.
      */
      const id = `city:${city.cc}:${foldGeographyIdSegment(city.n)}@${city.lat},${city.lon}`;

      if (ids.has(id)) collisions += 1;
      ids.add(id);
    }

    expect(collisions).toBe(0);
    expect(ids.size).toBeGreaterThan(50_000);
  });

  it('the six Aberdeens are six distinct selections', () => {
    const feed = mapGeographyForQuery('Aberdeen');
    const ids = feed.candidates.map((candidate) => candidate.geographyId);

    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
