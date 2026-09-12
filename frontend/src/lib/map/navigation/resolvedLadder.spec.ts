import { WORLD_CAMERA, type CameraState } from '@/lib/map/camera/cameraState';
import { SCALE_RUNGS, breadcrumbLadder, validationStates, VALIDATION_STATE_IDS } from './breadcrumbs';
import { cityAt, countryAt, resolveCameraPlace, rungName } from './resolvedLadder';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RESOLVED BREADCRUMB — PO GOLDEN-FRAME CORRECTION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ruling: "Restore the visible resolved-geography breadcrumb labels: WORLD /
 * AFRICA / EAST AFRICA / RWANDA / KIGALI. Do not display generic rung names
 * like CONTINENT / SUBREGION / COUNTRY when a resolved value exists."
 *
 * The whole risk in satisfying that is the failure `BreadcrumbZoomNavigator`
 * was built to prevent — a trail reading "World › Africa › Rwanda" while the
 * camera is over the Pacific. Both halves are asserted here: the golden row
 * appears where it is true, and NOTHING appears where it is not.
 */

const at = (lon: number, lat: number, zoom: number): CameraState => ({
  ...WORLD_CAMERA,
  center: [lon, lat],
  zoom,
});

/** Kigali. The golden Rwanda frame's camera, near enough. */
const KIGALI = at(30.0619, -1.9441, 9);
/** Mid-Pacific: high zoom, no land. The lie this module must not tell. */
const OPEN_OCEAN = at(-150, 5, 9);

describe('1 · THE GOLDEN ROW, WHERE IT IS TRUE', () => {
  it('over Kigali the ladder reads WORLD · AFRICA · EAST AFRICA · RWANDA · KIGALI', () => {
    const place = resolveCameraPlace(KIGALI);
    const ladder = breadcrumbLadder(KIGALI);

    const rendered = ladder.map((entry) => rungName(entry.rung, place, entry.reached));

    expect(rendered).toEqual([null, 'Africa', 'East Africa', 'Rwanda', 'Kigali']);
  });

  it('the subregion comes from a DECLARED product region, not from a bounding box', () => {
    /*
     * "East Africa" is printed because Rwanda is a governed member of
     * `region:east-africa`, which carries an authority and a provenance. A
     * rectangle around East Africa would print the same word for the wrong
     * reason, and would print it for countries the product has not declared.
     */
    expect(resolveCameraPlace(KIGALI).subregion).toBe('East Africa');
  });

  it('the WORLD rung never takes a name — it is the scale, and it is always true', () => {
    expect(rungName('WORLD', resolveCameraPlace(KIGALI), true)).toBeNull();
  });
});

describe('2 · AND NOTHING, WHERE IT IS NOT', () => {
  it('over open ocean at city zoom, every rung falls back to its generic word', () => {
    const place = resolveCameraPlace(OPEN_OCEAN);

    expect(place).toEqual({
      continent: null,
      subregion: null,
      country: null,
      countryIso3: null,
      city: null,
    });

    for (const rung of SCALE_RUNGS) {
      expect(rungName(rung, place, true)).toBeNull();
    }
  });

  it('an UNREACHED rung is never named, even when the place resolves', () => {
    /*
     * The other direction of the same conflation. At the world view the camera
     * may well be over Rwanda, but the ladder's job is to say what SCALE the
     * reader is at — printing "Rwanda" on a rung the camera has not descended
     * to would make the control stop describing the thing it exists for.
     */
    const place = resolveCameraPlace(KIGALI);

    expect(rungName('COUNTRY', place, false)).toBeNull();
    expect(rungName('CITY', place, false)).toBeNull();
  });

  it('a country with no declared region shows no subregion rather than a guess', () => {
    /* Poland is a validation country and is in no PRODUCT_GOVERNED region. */
    const warsaw = resolveCameraPlace(at(21.0122, 52.2297, 9));

    expect(warsaw.country).toBe('Poland');
    expect(warsaw.subregion).toBeNull();
  });
});

describe('3 · the camera is unwrapped, and the resolver must cope', () => {
  it('a longitude wound past the antimeridian resolves the same country', () => {
    /*
     * Panning west keeps counting — the camera contract is explicitly
     * "SIGNED, UNWRAPPED, UNCLAMPED" — so -330° is a real state, and a
     * resolver that did not wrap would silently answer "ocean" for it.
     */
    expect(countryAt(30.0619, -1.9441)).toBe('RWA');
    expect(countryAt(30.0619 - 360, -1.9441)).toBe('RWA');
    expect(countryAt(30.0619 + 360, -1.9441)).toBe('RWA');
  });
});

describe('4 · the city radius tightens with zoom', () => {
  it('names the settlement at city zoom', () => {
    expect(cityAt(30.0619, -1.9441, 9)).toBe('Kigali');
  });

  it('does not name a city from the continental view', () => {
    /*
     * At Z3 the visible extent is thousands of kilometres. Naming the nearest
     * capital would be naming a place the reader is not looking at.
     */
    expect(cityAt(30.0619, -1.9441, 3)).toBeNull();
  });

  it('prefers the more prominent settlement when several are in range', () => {
    /* Kigali's neighbours are inside a loose radius; the capital wins. */
    expect(cityAt(30.1, -1.98, 8)).toBe('Kigali');
  });
});

describe('5 · validation states are a subset of real jump targets', () => {
  it('the rail offers exactly the four the golden frame shows', () => {
    expect(validationStates().map((target) => target.id)).toEqual([
      'rwanda',
      'eastAfrica',
      'kenya',
      'poland',
    ]);
  });

  it('every validation state has real bounds — no decorative entries', () => {
    /*
     * Ruling: "Do not create decorative states." A validation state that
     * existed only as a label would be exactly that, so each one is required
     * to resolve to a target with a real extent.
     */
    expect(validationStates()).toHaveLength(VALIDATION_STATE_IDS.length);

    for (const target of validationStates()) {
      const [west, south, east, north] = target.bounds;
      expect(east).toBeGreaterThan(west);
      expect(north).toBeGreaterThan(south);
    }
  });
});
