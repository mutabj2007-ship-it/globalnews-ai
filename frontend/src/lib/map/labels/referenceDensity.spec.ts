import { REFERENCE_PLACE_SEEDS, REFERENCE_PLACE_COUNTS } from './referencePlaces';
import {
  REFERENCE_CLASS_CAP,
  REFERENCE_CLASS_FLOOR,
  referenceLabelCandidates,
  withinVisibleWorld,
  type ReferenceKind,
} from './labelSources';
import { MAX_ZOOM, MIN_ZOOM, WORLD_CAMERA } from '@/lib/map/camera/cameraState';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * REFERENCE LABEL DENSITY — PO RULING B, C906
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ACCEPTANCE EVIDENCE. The Alpha screenshots showed these names tiling the
 * viewport, many times each, over empty ocean:
 *
 *     ANGARA · ERTIS · ALBERT NILE · BAHR EL JEBEL · LUALABA · SHIRE
 *
 * The ruling names the world golden screenshot as the density authority and the
 * Rwanda golden screenshot as the regional-density authority, and asks for the
 * fix at the source rather than in CSS.
 *
 * ── WHAT THE MEASUREMENT ACTUALLY SHOWED, WHICH IS NOT ONLY THE HYPOTHESIS ──
 *
 * The ruling asked me to VERIFY that the generator emits one seed per feature.
 * It does — 449 river rows for 342 distinct names, worst offenders Ob x4,
 * Abay x3, Huang x3 — so the deduplication below is real work. But 2x
 * duplication cannot by itself tile a viewport, and two further causes were
 * measured:
 *
 *   THE ZOOM GATE WAS IN THE WRONG SCALE. It used Natural Earth's own
 *   `min_zoom` column, which puts major rivers at 2–3 — barely above this
 *   product's world view of 1.1. Every one of the names above was eligible
 *   almost immediately.
 *
 *   PROJECTION RETURNED ON-SCREEN POINTS FOR OFF-WORLD FEATURES. With one
 *   painted world and a camera outside it, screen-space filtering cannot tell
 *   a visible feature from a projected ghost. The guard is therefore
 *   geographic and runs before projection.
 *
 * All three are asserted here, and the six Alpha names are pinned as fixtures.
 */

const ALPHA_RIVER_NAMES = [
  'Angara',
  'Ertis',
  'Albert Nile',
  'Bahr el Jebel',
  'Lualaba',
  'Shire',
] as const;

const VIEWPORT = { width: 1400, height: 900 };

/** A candidate run at a given camera, with an engine-free flat projection. */
function candidatesAt(zoom: number, centerLon: number, centerLat: number) {
  return referenceLabelCandidates({
    zoom,
    language: 'en',
    enabled: true,
    continentNames: {},
    waterNames: {},
    territoryNames: {},
    centerLon,
    centerLat,
    viewportWidth: VIEWPORT.width,
    viewportHeight: VIEWPORT.height,
    project: (lon, lat) => ({
      x: VIEWPORT.width / 2 + (lon - centerLon) * 4,
      y: VIEWPORT.height / 2 - (lat - centerLat) * 4,
    }),
  });
}

const kindsOf = (kind: ReferenceKind, zoom: number, lon: number, lat: number) =>
  candidatesAt(zoom, lon, lat).filter((candidate) => candidate.kind === kind);

describe('1 · THE ALPHA RIVER-WALL, PINNED', () => {
  it.each(ALPHA_RIVER_NAMES)('%s exists exactly once in the seed data', (name) => {
    /*
     * The deduplication half. Natural Earth splits a long river into named
     * reaches; one governed identity now carries one label, anchored on the
     * longest reach.
     */
    const matches = REFERENCE_PLACE_SEEDS.filter(
      (seed) => seed.kind === 'river' && seed.name === name,
    );

    expect(matches).toHaveLength(1);
  });

  it.each(ALPHA_RIVER_NAMES)('%s is never drawn at or near the world view', (name) => {
    for (const zoom of [MIN_ZOOM, 1.0, WORLD_CAMERA.zoom, 2.0, 3.0, 4.0]) {
      const drawn = candidatesAt(zoom, 12, 20).map((candidate) => candidate.text);

      expect(drawn).not.toContain(name);
    }
  });

  it('NO name of any class is ever emitted twice in one frame', () => {
    /*
     * The symptom the reader saw, asserted directly and at every scale: the
     * same word appearing again and again. Ids are `kind:name`, so a repeat
     * would also be a duplicate React key.
     */
    for (const [zoom, lon, lat] of [
      [MIN_ZOOM, 12, 20],
      [1.1, 12, 20],
      [3.6, 35, 0],
      [5.9, 30.06, -1.94],
      [MAX_ZOOM, 30.06, -1.94],
    ] as const) {
      const ids = candidatesAt(zoom, lon, lat).map((candidate) => candidate.id);

      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('2 · WORLD VIEW — the golden world frame is the density authority', () => {
  it('draws no river, city or lake label at any world-scale zoom', () => {
    /*
     * "WORLD VIEW: continents, oceans / major seas, important country labels
     * where appropriate. NO river-wall. NO city-wall. NO dense lake labels."
     *
     * Continents, oceans and countries come from the other three loops in
     * `referenceLabelCandidates` and are untouched; this asserts the three
     * classes the ruling excludes.
     */
    for (const zoom of [MIN_ZOOM, 0.8, 1.0, WORLD_CAMERA.zoom, 1.5, 2.0, 2.5]) {
      expect(kindsOf('river', zoom, 12, 20)).toHaveLength(0);
      expect(kindsOf('city', zoom, 12, 20)).toHaveLength(0);
      expect(kindsOf('lake', zoom, 12, 20)).toHaveLength(0);
    }
  });

  it('every class floor sits above the world camera, by construction', () => {
    for (const kind of ['lake', 'city', 'river'] as const) {
      expect(REFERENCE_CLASS_FLOOR[kind]).toBeGreaterThan(WORLD_CAMERA.zoom);
    }
  });

  it('rivers are the strictest class, because rivers are what failed', () => {
    expect(REFERENCE_CLASS_FLOOR.river).toBeGreaterThan(REFERENCE_CLASS_FLOOR.city);
    expect(REFERENCE_CLASS_FLOOR.city).toBeGreaterThan(REFERENCE_CLASS_FLOOR.lake);
  });
});

describe('3 · REGIONAL — the golden Rwanda frame is the regional authority', () => {
  const RWANDA = { zoom: 5.9, lon: 30.06, lat: -1.94 };

  it('names the settlements the golden frame names, where the source supplies them', () => {
    const drawn = candidatesAt(RWANDA.zoom, RWANDA.lon, RWANDA.lat).map((c) => c.text);
    const named = (name: string): boolean => drawn.some((text) => text.includes(name));

    expect(named('Kigali')).toBe(true);
    expect(named('Kampala')).toBe(true);
    expect(named('Goma')).toBe(true);
  });

  it('BUKAVU IS NOT IN THE 1:50m SOURCE, and that is recorded rather than faked', () => {
    /*
     * The ruling asks for "useful settlements such as Kigali / Kampala / Goma /
     * Bukavu WHERE SUPPLIED". Measured: Natural Earth 1:50m
     * `populated_places_simple` publishes 1 251 settlements and Bukavu is not
     * among them. Inventing a coordinate for it would be exactly the fabricated
     * geography this programme refuses, so its absence is asserted instead —
     * and this test turns red the day a finer source is adopted, which is when
     * someone should look again.
     */
    expect(REFERENCE_PLACE_SEEDS.some((s) => s.kind === 'city' && s.name === 'Bukavu')).toBe(false);
  });

  it('draws major lakes in view', () => {
    expect(kindsOf('lake', RWANDA.zoom, RWANDA.lon, RWANDA.lat).length).toBeGreaterThan(0);
  });

  it('draws only a handful of river labels, never a network', () => {
    expect(kindsOf('river', RWANDA.zoom, RWANDA.lon, RWANDA.lat).length).toBeLessThanOrEqual(
      REFERENCE_CLASS_CAP.river,
    );
  });

  it('no class exceeds its cap at any camera', () => {
    for (const [zoom, lon, lat] of [
      [3.6, 35, 0],
      [4.5, 30, 0],
      [5.9, 30.06, -1.94],
      [MAX_ZOOM, 30.06, -1.94],
      [MAX_ZOOM, 116.4, 39.9],
    ] as const) {
      for (const kind of ['lake', 'city', 'river'] as const) {
        expect(kindsOf(kind, zoom, lon, lat).length).toBeLessThanOrEqual(REFERENCE_CLASS_CAP[kind]);
      }
    }
  });
});

describe('4 · nothing outside the visible world projects back into it', () => {
  it('a feature far outside the frame is refused before projection', () => {
    /* Rwanda, from a camera over the Pacific at regional zoom. */
    expect(
      withinVisibleWorld(30.06, -1.94, {
        zoom: 4,
        centerLon: -150,
        centerLat: 0,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
      }),
    ).toBe(false);
  });

  it('LATITUDE IS CHECKED TOO — a longitude-only guard was a measured bug', () => {
    /*
     * Cairo sits within a degree of Kigali's longitude and 32° north of it.
     * With a longitude-only guard it was admitted into a Rwanda frame and
     * competed for the city cap against Kigali and Goma, which is how Goma
     * lost its slot.
     */
    expect(
      withinVisibleWorld(31.2, 30.05, {
        zoom: 5.9,
        centerLon: 30.06,
        centerLat: -1.94,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
      }),
    ).toBe(false);
  });

  it('a feature in the frame is admitted', () => {
    expect(
      withinVisibleWorld(30.06, -1.94, {
        zoom: 5.9,
        centerLon: 30.06,
        centerLat: -1.94,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
      }),
    ).toBe(true);
  });

  it('the guard measures the SHORTEST angular distance across the antimeridian', () => {
    expect(
      withinVisibleWorld(179, 0, {
        zoom: 3,
        centerLon: -179,
        centerLat: 0,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
      }),
    ).toBe(true);
  });

  it('a consumer that supplies no camera keeps every label rather than losing all of them', () => {
    /* Degrading to a blank map would be a worse failure than degrading to the
       previous behaviour, so the guard opts out when it is not told where the
       camera is. */
    expect(withinVisibleWorld(30.06, -1.94, { zoom: 5.9 })).toBe(true);
  });
});

describe('5 · the data itself carries one governed identity per label', () => {
  it.each(['lake', 'river', 'city'] as const)('%s names are unique in the seed data', (kind) => {
    const names = REFERENCE_PLACE_SEEDS.filter((seed) => seed.kind === kind).map((s) => s.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('the published counts match the seed table', () => {
    for (const kind of ['lake', 'river', 'city'] as const) {
      expect(REFERENCE_PLACE_SEEDS.filter((seed) => seed.kind === kind)).toHaveLength(
        REFERENCE_PLACE_COUNTS[kind],
      );
    }
  });
});
