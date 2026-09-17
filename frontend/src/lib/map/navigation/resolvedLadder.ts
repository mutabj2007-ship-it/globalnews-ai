import { COUNTRIES } from '@globalnews-ai/shared';
import type { CameraState } from '@/lib/map/camera/cameraState';
import { getCountryFeatureCollection } from '@/lib/map/countryGeometry';
import { DECLARED_PRODUCT_REGIONS, membersFor } from '@/lib/map/region/declaredProductRegions';
import { REFERENCE_PLACE_SEEDS } from '@/lib/map/labels/referencePlaces';
import { RUNG_MIN_ZOOM, type ScaleRung } from './breadcrumbs';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WHAT THE CAMERA IS ACTUALLY OVER — PO GOLDEN-FRAME CORRECTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ruling, verbatim: *"Restore the visible resolved-geography breadcrumb labels:
 * WORLD / AFRICA / EAST AFRICA / RWANDA / KIGALI. Do not display generic rung
 * names like CONTINENT / SUBREGION / COUNTRY when a resolved value exists."*
 *
 * ── THE TENSION THIS MODULE RESOLVES, RATHER THAN OVERRULES ─────────────────
 *
 * `BreadcrumbZoomNavigator` shipped generic words on purpose, and its reason
 * is still correct:
 *
 *     "The familiar map-UI failure is a breadcrumb trail that reads
 *      'World › Africa › Rwanda' because the zoom is high, while the camera is
 *      over the Pacific."
 *
 * That failure comes from ONE control conflating two facts — how far in the
 * camera is, and where it is. The fix is not to stop naming places. It is to
 * RESOLVE the place, and to name only what resolved.
 *
 * So every name below is derived from the camera's actual centre:
 *
 *   COUNTRY    point-in-polygon against the same bundled geometry the map
 *              draws. Over the Pacific this returns null and the rung falls
 *              back to the generic word — the old lie cannot be reconstructed,
 *              because there is no path here that names a country the camera
 *              is not inside.
 *
 *   CONTINENT  the resolved country's `region` from the SHARED REGISTRY. Not a
 *              bounding box, not a guess from the visible extent.
 *
 *   SUBREGION  a DECLARED PRODUCT REGION the resolved country is a member of.
 *              "East Africa" appears because Rwanda is a declared member of
 *              `region:east-africa`, which is a governed membership list with
 *              an authority and a provenance — never because a rectangle
 *              contained the camera.
 *
 *   CITY       the nearest bundled reference settlement, and only when the
 *              camera is close enough that it is genuinely the place on
 *              screen. Reference geography, not evidence.
 *
 * ── AND IT STILL RESOLVES NOTHING IT CANNOT SUPPORT ─────────────────────────
 *
 * Every field is nullable and null is the normal answer, not an error: ocean,
 * a country with no metadata, a region no declared list claims, a city beyond
 * the radius. The caller renders the generic rung word in those cases, which
 * is exactly what the pre-existing design did for every rung.
 *
 * PURE. No fetch, no engine, no evidence. The whole module is a function of
 * the camera and three bundled tables, so it is unit-testable and it keeps
 * working when `/geo/search` is down — which, when this ruling was written,
 * it was.
 */

export interface ResolvedPlace {
  readonly continent: string | null;
  readonly subregion: string | null;
  readonly country: string | null;
  readonly countryIso3: string | null;
  readonly city: string | null;
}

export const UNRESOLVED: ResolvedPlace = {
  continent: null,
  subregion: null,
  country: null,
  countryIso3: null,
  city: null,
};

/* ── POINT IN POLYGON ─────────────────────────────────────────────────────── */

type Ring = ReadonlyArray<readonly [number, number]>;
type Poly = ReadonlyArray<Ring>;

function ringContains(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/** Inside the outer ring and outside every hole — a lake is not the country. */
function polygonContains(lon: number, lat: number, poly: Poly): boolean {
  if (poly.length === 0 || !ringContains(lon, lat, poly[0])) return false;
  for (let hole = 1; hole < poly.length; hole += 1) {
    if (ringContains(lon, lat, poly[hole])) return false;
  }
  return true;
}

function polygonsOf(geometry: unknown): readonly Poly[] {
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g?.type === 'Polygon') return [g.coordinates as Poly];
  if (g?.type === 'MultiPolygon') return g.coordinates as readonly Poly[];
  return [];
}

/**
 * THE COUNTRY THE CAMERA CENTRE IS INSIDE, OR NULL.
 *
 * Longitude is wrapped into [-180, 180) first. The camera is deliberately
 * unwrapped — panning west past the antimeridian keeps counting — so a centre
 * of -190° is a real state this function must handle, and without the wrap it
 * would silently resolve nothing over the Pacific rim.
 */
export function countryAt(lon: number, lat: number): string | null {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;

  for (const feature of getCountryFeatureCollection().features) {
    for (const poly of polygonsOf(feature.geometry)) {
      if (polygonContains(wrapped, lat, poly)) {
        return feature.properties.country?.iso3 ?? null;
      }
    }
  }

  return null;
}

/* ── CITY ─────────────────────────────────────────────────────────────────── */

/**
 * Degrees within which a settlement counts as the place on screen.
 *
 * It TIGHTENS WITH ZOOM, because the question "which city am I over" means
 * something different at Z8 and Z12. At the city rung's own floor (Z8) roughly
 * half a degree of latitude is on screen; naming a settlement further away
 * than that would be naming somewhere the reader cannot see.
 */
function cityRadiusDegrees(zoom: number): number {
  return Math.max(0.05, 2.5 / 2 ** (zoom - 6));
}

export function cityAt(lon: number, lat: number, zoom: number): string | null {
  /*
    BELOW CITY SCALE THERE IS NO CITY-SCALE ANSWER, and this guard is load
    bearing rather than tidy. The radius formula GROWS as zoom falls — at Z3 it
    is twenty degrees — so without it a continental view would confidently name
    the largest capital within two thousand kilometres of the screen centre.
    That is the same class of statement as naming a country the camera is not
    inside, and `RUNG_MIN_ZOOM.CITY` is already the product's own answer to
    "when is the camera looking at a city".
  */
  if (zoom < RUNG_MIN_ZOOM.CITY) return null;

  const radius = cityRadiusDegrees(zoom);
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;

  let best: { name: string; distance: number; weight: number } | null = null;

  for (const seed of REFERENCE_PLACE_SEEDS) {
    if (seed.kind !== 'city') continue;

    const dLon = (seed.lon - wrapped) * Math.cos((lat * Math.PI) / 180);
    const dLat = seed.lat - lat;
    const distance = Math.hypot(dLon, dLat);

    if (distance > radius) continue;

    /*
      Ties go to the more prominent settlement. Two towns can sit inside the
      radius of a capital; naming the smaller one because it is a few hundred
      metres nearer the exact centre pixel would be technically true and
      useless.
    */
    const weight = seed.weight ?? 0;

    if (best === null || weight > best.weight || (weight === best.weight && distance < best.distance)) {
      best = { name: seed.name, distance, weight };
    }
  }

  return best?.name ?? null;
}

/* ── THE LADDER ───────────────────────────────────────────────────────────── */

/**
 * The declared product region this country belongs to, by governed membership.
 *
 * `region:east-african-community` and `region:europe` publish `members: null`
 * because their membership lives in the backend registry; `membersFor` is the
 * accessor that knows the difference, and a region that cannot answer is
 * skipped rather than guessed at. Where more than one region claims the
 * country, the FIRST declared one wins — the table's order is itself a
 * governed decision, so this function does not invent a tie-break of its own.
 */
export function declaredRegionFor(iso3: string): string | null {
  for (const region of DECLARED_PRODUCT_REGIONS) {
    /*
      `membersFor` returns an EMPTY LIST, not null, for a BACKEND_PUBLISHED
      region when no backend membership is supplied — which is the state on a
      client that has not been told. An empty list therefore means "this
      region cannot answer here", and it is skipped. Reading empty as "no
      members, so not a member" would be the same mistake as reading missing
      data as zero.
    */
    const members = membersFor(region.id);
    if (members.length > 0 && members.includes(iso3)) return region.label;
  }

  return null;
}

export function resolveCameraPlace(camera: CameraState): ResolvedPlace {
  const [lon, lat] = camera.center;
  const iso3 = countryAt(lon, lat);

  if (iso3 === null) {
    /*
      OVER WATER, OR OVER A COUNTRY WE HAVE NO METADATA FOR. Nothing above the
      country rung can be resolved from a country we do not have, so the whole
      ladder falls back to its generic words rather than half-naming a place.
    */
    return { ...UNRESOLVED, city: cityAt(lon, lat, camera.zoom) };
  }

  const meta = COUNTRIES.find((country) => country.iso3 === iso3);

  return {
    continent: meta?.region ?? null,
    subregion: declaredRegionFor(iso3),
    country: meta?.name ?? null,
    countryIso3: iso3,
    city: cityAt(lon, lat, camera.zoom),
  };
}

/**
 * The name to print on a rung, or null to keep the generic scale word.
 *
 * A rung only ever shows a place the camera has actually REACHED. Printing
 * "Rwanda" on an unreached country rung while the camera is at continent scale
 * would be the same conflation in a different direction: the ladder would stop
 * describing the scale it exists to describe.
 */
export function rungName(
  rung: ScaleRung,
  place: ResolvedPlace,
  reached: boolean,
): string | null {
  if (!reached) return null;

  switch (rung) {
    case 'WORLD':
      return null;
    case 'CONTINENT':
      return place.continent;
    case 'SUBREGION':
      return place.subregion;
    case 'COUNTRY':
      return place.country;
    case 'CITY':
      return place.city;
    default:
      return null;
  }
}
