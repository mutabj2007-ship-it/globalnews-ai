import {
  decodeSelection,
  encodeSelection,
  mapStateFromSearchParams,
  searchParamsWithMapState,
  SELECTION_QUERY_KEY,
} from './mapUrl';
import type { MapSelection } from './mapState';

/**
 * ══ THE URL CONTRACT FOR WORLD / REGION / CITY ════════════════════════════
 *
 * MAP-REGION-SCOPE-NOT-URL-BORNE-1 · MAP-SEARCH-CITY/REGION-URL-STATE
 *
 * The live inspection found the same thing for East Africa, for Kigali CITY and
 * for Kigali REGION: the camera moved, and the URL carried `cam=` and nothing
 * else. A reload therefore restored a viewport with no scope — which is why the
 * rail still said World while the map was over East Africa.
 *
 * THE IDS BELOW ARE REAL. They were taken from the deployed Alpha backend
 * (`/geo/search?q=Kigali`), not invented for the test, because the defect this
 * file exists to prevent is precisely a codec that works on tidy fixtures and
 * refuses what the gazetteer actually publishes. `city:RWA:kigali@-1.94995,
 * 30.05885` contains `:`, `@` and `,` — all three of which the shipped charset
 * refused, so a city selection could not have survived a reload even once the
 * rest of the wiring existed.
 *
 * WHAT IS ASSERTED IS THE ROUND TRIP, not the encoded string alone. An encoder
 * and a decoder that disagree produce a URL that looks right and restores
 * nothing, and that is exactly the failure mode being corrected.
 */

/** Verbatim from the live Alpha navigator. Do not tidy these. */
const REAL = {
  kigaliCity: 'city:RWA:kigali@-1.94995,30.05885',
  kigaliAdmin1: 'admin1:RW-01',
  kigaliAdmin3: 'admin3:RW:nisr:1103',
  easternAfrica: 'region:eastern-africa',
  governedEastAfrica: 'region:east-africa',
} as const;

const roundTrip = (selection: MapSelection): MapSelection | null =>
  decodeSelection(encodeSelection(selection));

describe('the real ids the gazetteer publishes survive the URL', () => {
  const cases: ReadonlyArray<readonly [string, MapSelection]> = [
    ['Kigali CITY', { kind: 'CITY', id: REAL.kigaliCity }],
    ['Kigali REGION (admin1)', { kind: 'REGION', id: REAL.kigaliAdmin1 }],
    ['a deeper subnational region (admin3)', { kind: 'REGION', id: REAL.kigaliAdmin3 }],
    ['Eastern Africa (supranational)', { kind: 'REGION', id: REAL.easternAfrica }],
    ['the governed East Africa product region', { kind: 'REGION', id: REAL.governedEastAfrica }],
    ['a country', { kind: 'COUNTRY', id: 'RWA' }],
  ];

  for (const [name, selection] of cases) {
    it(`${name} round-trips unchanged`, () => {
      expect(roundTrip(selection)).toEqual(selection);
    });
  }

  it('POSITIVE CONTROL — the shipped charset REFUSED the real city id', () => {
    /*
      The guard as it stood before this correction, reproduced exactly. If this
      ever stops throwing, the widening below has lost its reason and the
      comment in mapUrl.ts is describing a problem that no longer exists.
    */
    const shipped = /^[A-Za-z0-9._-]+$/;
    expect(shipped.test('RWA:kigali@-1.94995,30.05885')).toBe(false);
  });
});

describe('the fold is symmetric per kind, and mints nothing', () => {
  it('a supranational region folds its own prefix and gets it back', () => {
    expect(encodeSelection({ kind: 'REGION', id: REAL.easternAfrica })).toBe(
      'region:eastern-africa',
    );
    expect(decodeSelection('region:eastern-africa')).toEqual({
      kind: 'REGION',
      id: REAL.easternAfrica,
    });
  });

  it('a subnational region is NOT given a second prefix', () => {
    /*
      The bug this pins: `unfold` prepending `region:` to an id that already
      carries `admin1:` produces `region:admin1:RW-01`, a node that does not
      exist, and the selection then resolves to nothing on every reload.
    */
    const decoded = decodeSelection(encodeSelection({ kind: 'REGION', id: REAL.kigaliAdmin1 }));

    expect(decoded?.id).toBe(REAL.kigaliAdmin1);
    expect(decoded?.id).not.toBe('region:admin1:RW-01');
    expect(decoded?.id.startsWith('region:')).toBe(false);
  });

  it('a city folds to a readable parameter rather than stating its kind twice', () => {
    expect(encodeSelection({ kind: 'CITY', id: REAL.kigaliCity })).toBe(
      'city:RWA:kigali@-1.94995,30.05885',
    );
    expect(encodeSelection({ kind: 'CITY', id: REAL.kigaliCity })).not.toContain('city:city:');
  });
});

describe('CITY and REGION are distinguishable in the URL, and stay so', () => {
  it('the same place name under two kinds produces two different parameters', () => {
    const city = encodeSelection({ kind: 'CITY', id: REAL.kigaliCity });
    const region = encodeSelection({ kind: 'REGION', id: REAL.kigaliAdmin1 });

    expect(city).not.toBe(region);
    expect(decodeSelection(city)?.kind).toBe('CITY');
    expect(decodeSelection(region)?.kind).toBe('REGION');
  });

  it('neither decodes to a COUNTRY — a scope may not silently collapse', () => {
    for (const encoded of [
      encodeSelection({ kind: 'CITY', id: REAL.kigaliCity }),
      encodeSelection({ kind: 'REGION', id: REAL.kigaliAdmin1 }),
      encodeSelection({ kind: 'REGION', id: REAL.governedEastAfrica }),
    ]) {
      expect(decodeSelection(encoded)?.kind).not.toBe('COUNTRY');
    }
  });
});

describe('a full reload restores the scope, which is what the live defect lost', () => {
  const restore = (selection: MapSelection): MapSelection | null => {
    const params = searchParamsWithMapState(new URLSearchParams(), {
      mode: 'WORLD',
      period: '24H',
      selection,
    });

    // The camera is a separate parameter and is deliberately not supplied:
    // scope must restore from `sel=` alone.
    return mapStateFromSearchParams(new URLSearchParams(params.toString())).selection;
  };

  it('Kigali CITY survives a reload as CITY', () => {
    expect(restore({ kind: 'CITY', id: REAL.kigaliCity })).toEqual({
      kind: 'CITY',
      id: REAL.kigaliCity,
    });
  });

  it('Kigali REGION survives a reload as REGION', () => {
    expect(restore({ kind: 'REGION', id: REAL.kigaliAdmin1 })).toEqual({
      kind: 'REGION',
      id: REAL.kigaliAdmin1,
    });
  });

  it('East Africa survives a reload as the governed region', () => {
    expect(restore({ kind: 'REGION', id: REAL.governedEastAfrica })).toEqual({
      kind: 'REGION',
      id: REAL.governedEastAfrica,
    });
  });

  it('the world view writes no selection parameter at all', () => {
    const params = searchParamsWithMapState(new URLSearchParams(), {
      mode: 'WORLD',
      period: '24H',
      selection: null,
    });

    expect(params.get(SELECTION_QUERY_KEY)).toBeNull();
    expect(params.toString()).toBe('');
  });
});

describe('the widened charset did not open the door it was guarding', () => {
  it('still refuses a path, whitespace and an escape', () => {
    expect(decodeSelection('city:../../etc/passwd')).toBeNull();
    expect(decodeSelection('city:RWA kigali')).toBeNull();
    expect(decodeSelection('city:RWA%2Fkigali')).toBeNull();
    expect(decodeSelection('region:a/b')).toBeNull();
  });

  it('still refuses an unknown kind and a missing separator', () => {
    expect(decodeSelection('planet:mars')).toBeNull();
    expect(decodeSelection('cityRWA')).toBeNull();
    expect(decodeSelection(':RWA')).toBeNull();
    expect(decodeSelection('')).toBeNull();
    expect(decodeSelection(null)).toBeNull();
  });

  it('still refuses an over-long id', () => {
    expect(decodeSelection(`city:${'a'.repeat(200)}`)).toBeNull();
  });
});
