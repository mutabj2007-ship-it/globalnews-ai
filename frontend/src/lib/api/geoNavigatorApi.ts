import type { Bounds } from '@/lib/map/camera/cameraState';

/**
 * THE DEEP GEOGRAPHIC NAVIGATOR — CONSUMED, NOT REIMPLEMENTED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES, AND WHY IT IS A DIFFERENT KIND OF SEARCH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `lib/map/search/placeSearch.ts` searches the shipped country table and the
 * configured jump targets. It is synchronous, it needs no backend, and it can
 * only ever know about countries and regions — which is why the surface it
 * powers had to tell the reader "countries and regions only". That statement
 * was honest, and it described a CEILING rather than a moment.
 *
 * G's navigator removes the ceiling. `GET /geo/search` resolves the whole
 * ladder — region -> country -> admin1 -> admin2 -> city — against the same
 * gazetteer, the same fold and the same identity scheme the rest of the
 * geographic foundation uses. So this module is a CLIENT and contains no
 * matching logic, no folding, no ranking and no id construction: every one of
 * those already exists behind the route, and a second implementation on this
 * side is exactly the "two implementations of one fold" failure the C3 verifier
 * was written to catch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NAVIGATION PRECISION IS NOT EVIDENCE PRECISION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A `GeoNode` carries a `precision` — CITY for Kigali, COUNTRY for Rwanda. That
 * is the precision of the PLACE THE READER NAVIGATED TO. It says nothing about
 * the precision of the evidence retained there, which arrives separately from
 * the map feed and is frequently coarser: a reader may fly the camera to Kigali
 * while every retained report for Rwanda is COUNTRY-level.
 *
 * These must never be merged. A navigation that carried its precision into the
 * trust banner would announce city-level evidence the platform does not hold —
 * the single most damaging thing this product could say. So `NavigatorPlace`
 * below exposes `navigationPrecision` under that name, and nothing in this
 * module produces, defaults or infers a `GeoPrecision` for the evidence model.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAIL SOFT, AND NEVER INVENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A 404, a timeout, an abort or a malformed payload yields an empty result and
 * the caller keeps whatever it already had. A frontend that breaks when a
 * backend is briefly absent cannot be deployed independently of one.
 *
 * And no result is ever synthesised. If the gazetteer does not hold a place,
 * this returns nothing for it — there is no local fallback list, no fuzzy
 * second pass and no hand-written entry. A named place that does not exist in
 * the data must not appear because a search box would look better with results
 * in it.
 */

// The existing public /geo rewrite resolves the backend in the Next server.

/**
 * A typeahead runs on every keystroke, and a keystroke that has already been
 * superseded is worth nothing. Kept well under the map feed's 8 s for that
 * reason: a stale suggestion list is worse than none.
 */
const REQUEST_TIMEOUT_MS = 4000;

/** G's ladder, coarsest first. */
export type NavigatorKind = 'region' | 'country' | 'admin1' | 'admin2' | 'city';

/**
 * THE PRECISION OF A PLACE, NOT OF AN OBSERVATION. Named `NavigationPrecision`
 * and deliberately NOT `GeoPrecision`, so the two cannot be passed to each
 * other's functions without the compiler objecting — see this file's header.
 */
export type NavigationPrecision = 'REGION' | 'COUNTRY' | 'PROVINCE' | 'DISTRICT' | 'CITY';

export type NavigatorMatchKind = 'EXACT' | 'ALIAS' | 'EXONYM' | 'PREFIX';

export interface NavigatorAncestor {
  readonly geographyId: string;
  readonly kind: NavigatorKind;
  readonly name: string;
  readonly code?: string;
}

/**
 * A DERIVED EXTENT, WHICH IS A CAMERA TARGET AND NEVER A BORDER.
 *
 * G says so on the wire — `source` is always 'derived-from-settlements' — and
 * this type keeps the field rather than dropping it, so a consumer that ever
 * wants to draw this as an outline has to read the sentence that forbids it.
 */
export interface NavigatorExtent {
  readonly bbox: readonly [number, number, number, number];
  readonly centroid: readonly [number, number];
  readonly members: number;
  /** True when the bbox spans the antimeridian and must NOT be fitted naively. */
  readonly antimeridian: boolean;
  readonly source: string;
}

export interface NavigatorPlace {
  /** OPAQUE. Join and look up by it; never parse it. */
  readonly geographyId: string;
  readonly kind: NavigatorKind;
  /** See the header: this is where the reader went, not what is known there. */
  readonly navigationPrecision: NavigationPrecision;
  readonly name: string;
  /** Verified other names as G publishes them. Never invented here. */
  readonly aliases: readonly string[];
  /** The surface form the query actually matched. */
  readonly matchedOn: string;
  readonly matchKind: NavigatorMatchKind;
  /** Coarsest first: region(s), country, admin1, admin2. */
  readonly hierarchy: readonly NavigatorAncestor[];
  /** [lon, lat]. Cities are points and carry this instead of an extent. */
  readonly center?: readonly [number, number];
  readonly extent?: NavigatorExtent;
  /** Null means UNKNOWN. It never means zero. */
  readonly population?: number | null;
  readonly datasetAttribution: string;
  /**
   * HOW G ADMITTED THIS NODE — `provenance.admittedBy`, verbatim.
   *
   * RSC-1 requires H to read a REGION TYPE and forbids it reading `basis`
   * directly at a surface. This carries G's published word unchanged so that
   * exactly ONE module maps it (`regionSelection.ts`) and every surface reads
   * the mapped `regionType`. Empty string when G published none — which maps to
   * UNDEFINED rather than to a guess.
   */
  readonly admittedBy: string;
  /**
   * How many members G derived the extent from. `null` is UNKNOWN, and for a
   * region with no agreed membership it is the honest value — it is NOT zero,
   * which would read as "a region with no members".
   */
  readonly memberCount: number | null;
}

export type NavigatorRefusal =
  | 'QUERY_TOO_SHORT'
  | 'NO_MATCH_IN_GAZETTEER'
  | 'REGION_MEMBERSHIP_UNDEFINED'
  /** This client's own state: the route could not be reached at all. */
  | 'NAVIGATOR_UNREACHABLE';

export interface NavigatorSearchResult {
  readonly query: string;
  readonly matched: boolean;
  /** True when several nodes matched at the SAME strength. NOT a ranking. */
  readonly ambiguous: boolean;
  readonly places: readonly NavigatorPlace[];
  readonly totalMatches: number;
  readonly reason?: NavigatorRefusal;
  readonly attribution: string;
}

const EMPTY = (query: string, reason: NavigatorRefusal): NavigatorSearchResult => ({
  query,
  matched: false,
  ambiguous: false,
  places: [],
  totalMatches: 0,
  reason,
  attribution: '',
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const KINDS: readonly string[] = ['region', 'country', 'admin1', 'admin2', 'city'];
const PRECISIONS: readonly string[] = ['REGION', 'COUNTRY', 'PROVINCE', 'DISTRICT', 'CITY'];
const MATCH_KINDS: readonly string[] = ['EXACT', 'ALIAS', 'EXONYM', 'PREFIX'];

const numberPair = (value: unknown): readonly [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  if (typeof value[0] !== 'number' || typeof value[1] !== 'number') return undefined;

  return [value[0], value[1]];
};

const readExtent = (value: unknown): NavigatorExtent | undefined => {
  if (!isObject(value)) return undefined;

  const bbox = value.bbox;
  const centroid = numberPair(value.centroid);

  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== 'number')) {
    return undefined;
  }
  if (centroid === undefined) return undefined;
  /*
    `source` is the discriminant that says this is derived rather than official.
    An extent that arrives without it is not a weaker extent — it is a shape of
    unknown provenance, and this product does not render those.
  */
  if (typeof value.source !== 'string') return undefined;

  return {
    bbox: bbox as unknown as readonly [number, number, number, number],
    centroid,
    members: typeof value.members === 'number' ? value.members : 0,
    antimeridian: value.antimeridian === true,
    source: value.source,
  };
};

/**
 * ONE NODE, VALIDATED STRUCTURALLY. A node missing an id, a kind, a precision
 * or a name is DROPPED rather than repaired: there is no defensible default for
 * any of the four, and a place with a guessed level is the failure the whole
 * precision model exists to prevent.
 */
function readPlace(value: unknown): NavigatorPlace | null {
  if (!isObject(value)) return null;
  if (typeof value.geographyId !== 'string' || value.geographyId.length === 0) return null;
  if (typeof value.kind !== 'string' || !KINDS.includes(value.kind)) return null;
  if (typeof value.precision !== 'string' || !PRECISIONS.includes(value.precision)) return null;
  if (typeof value.name !== 'string' || value.name.length === 0) return null;

  const hierarchy = Array.isArray(value.hierarchy)
    ? value.hierarchy.filter(
        (a): a is NavigatorAncestor =>
          isObject(a) &&
          typeof a.geographyId === 'string' &&
          typeof a.name === 'string' &&
          typeof a.kind === 'string' &&
          KINDS.includes(a.kind),
      )
    : [];

  const matchKind =
    typeof value.matchKind === 'string' && MATCH_KINDS.includes(value.matchKind)
      ? (value.matchKind as NavigatorMatchKind)
      : 'PREFIX';

  const provenance = isObject(value.provenance) ? value.provenance : {};

  return {
    geographyId: value.geographyId,
    kind: value.kind as NavigatorKind,
    navigationPrecision: value.precision as NavigationPrecision,
    name: value.name,
    aliases: Array.isArray(value.aliases)
      ? value.aliases.filter((a): a is string => typeof a === 'string')
      : [],
    matchedOn: typeof value.matchedOn === 'string' ? value.matchedOn : value.name,
    matchKind,
    hierarchy,
    center: numberPair(value.center),
    extent: readExtent(value.bounds),
    population: typeof value.population === 'number' ? value.population : null,
    datasetAttribution: typeof provenance.dataset === 'string' ? provenance.dataset : '',
    admittedBy: typeof provenance.admittedBy === 'string' ? provenance.admittedBy : '',
    /*
      Read from the extent G derived, not counted here. A region G serves with
      NO bounds — Middle East — therefore reports null rather than 0, because
      this client has no member list of its own and inventing the count would
      be the same class of error as inventing the polygon.
    */
    memberCount:
      isObject(value.bounds) && typeof value.bounds.members === 'number'
        ? value.bounds.members
        : null,
  };
}

export interface NavigatorSearchOptions {
  /** ISO2, ISO3 or a country name. Restricts results to that country. */
  readonly country?: string;
  /** Restrict to one rung of the ladder. */
  readonly kind?: NavigatorKind;
  /** G's ceiling is 100. */
  readonly limit?: number;
  /** Lets a typeahead cancel a keystroke that has already been superseded. */
  readonly signal?: AbortSignal;
}

/**
 * `GET /geo/search?q=…`
 *
 * SHORT QUERIES ARE REFUSED HERE RATHER THAN SENT. G refuses them too, with
 * QUERY_TOO_SHORT; refusing locally as well means a reader typing one letter
 * does not generate a request per keystroke that can only come back empty.
 * The refusal value is G's own, so the caller branches on one vocabulary.
 */
export async function searchNavigator(
  query: string,
  options: NavigatorSearchOptions = {},
): Promise<NavigatorSearchResult> {
  const trimmed = query.trim();

  if (trimmed.length < 2) return EMPTY(trimmed, 'QUERY_TOO_SHORT');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortOuter = (): void => controller.abort();

  options.signal?.addEventListener('abort', abortOuter);

  const params = new URLSearchParams({ q: trimmed });

  if (options.country !== undefined) params.set('country', options.country);
  if (options.kind !== undefined) params.set('kind', options.kind);
  if (options.limit !== undefined) params.set('limit', String(options.limit));

  try {
    const response = await fetch(`/geo/search?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) return EMPTY(trimmed, 'NAVIGATOR_UNREACHABLE');

    const payload: unknown = await response.json();

    if (!isObject(payload)) return EMPTY(trimmed, 'NAVIGATOR_UNREACHABLE');

    const places = Array.isArray(payload.nodes)
      ? payload.nodes.map(readPlace).filter((p): p is NavigatorPlace => p !== null)
      : [];

    return {
      query: typeof payload.query === 'string' ? payload.query : trimmed,
      matched: payload.matched === true && places.length > 0,
      ambiguous: payload.ambiguous === true,
      places,
      totalMatches: typeof payload.totalMatches === 'number' ? payload.totalMatches : places.length,
      reason:
        typeof payload.reason === 'string' ? (payload.reason as NavigatorRefusal) : undefined,
      attribution: typeof payload.attribution === 'string' ? payload.attribution : '',
    };
  } catch {
    /*
      Swallowed on purpose, and only here. An unreachable navigator is a
      capability that is briefly absent, not an error about the reader's data.
      The caller shows what it already had.
    */
    return EMPTY(trimmed, 'NAVIGATOR_UNREACHABLE');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortOuter);
  }
}

/**
 * `GET /geo/place?id=…`
 *
 * WHY A SELECTION IS RECOVERED BY ID AND NEVER BY RE-SEARCHING ITS NAME. A
 * selection, a watch entry and a shared link all carry a `geographyId` and no
 * name. G's own note records that 71 settlement names in this gazetteer are
 * duplicated inside a single country, so resolving a stored selection by name
 * is precisely how two different places quietly swap.
 *
 * `null` covers both "not found" and "unreachable", because a stale watch entry
 * is a normal state for a client to hold rather than an error to report.
 */
export async function lookupNavigatorPlace(geographyId: string): Promise<NavigatorPlace | null> {
  if (geographyId.trim().length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `/geo/place?${new URLSearchParams({ id: geographyId }).toString()}`,
      { cache: 'no-store', signal: controller.signal },
    );

    if (!response.ok) return null;

    const payload: unknown = await response.json();

    if (!isObject(payload) || payload.found !== true) return null;

    return readPlace(payload.node);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The camera target for a place, or null when it has none.
 *
 * TWO SHAPES, ONE RULE. A city is a point and gets a small square around its
 * coordinate so the camera has something to fit; everything else carries a
 * derived extent and gets its bbox. A place with NEITHER — a contested region
 * with no agreed membership, which G serves deliberately with no bounds — gets
 * null, and the caller must leave the camera where it is rather than inventing
 * somewhere to fly to.
 *
 * The antimeridian flag is honoured by REFUSING the fit rather than by fitting
 * it wrongly: G sets it exactly when the bbox cannot be read as a naive
 * west<east rectangle, and this module has no authority to decide which half of
 * such an extent the reader meant.
 */
export function navigatorCameraTarget(place: NavigatorPlace): Bounds | null {
  if (place.extent !== undefined && !place.extent.antimeridian) {
    /* `Bounds` is the product's own [west, south, east, north] tuple, and
       G's bbox is published in exactly that order. Copied, not rearranged. */
    const [west, south, east, north] = place.extent.bbox;

    return [west, south, east, north];
  }

  if (place.center !== undefined) {
    const [lon, lat] = place.center;
    /* A settlement is a point; this is the smallest honest frame around one. */
    const pad = 0.35;

    return [lon - pad, lat - pad, lon + pad, lat + pad];
  }

  return null;
}

/**
 * The ISO3 of the country a place belongs to, or undefined when none is
 * published.
 *
 * ── THE ID IS NEVER PARSED, INCLUDING HERE ────────────────────────────────
 *
 * `country:RWA` obviously contains the code, and reading it out of the string
 * would work today and couple this file to G's id rule forever — the exact
 * coupling G's §2 forbids and the C3 ruling repeats. So both branches read
 * PUBLISHED FIELDS instead:
 *
 *   sub-country nodes  the `code` of their own country ancestor, which G
 *                      populates with the ISO3 for that rung
 *   country nodes      their published aliases, which G sets to [iso2, iso3];
 *                      taken by SHAPE (three A-Z characters) rather than by
 *                      position, so a reordered or extended alias list still
 *                      resolves and a two-letter code is never mistaken for a
 *                      three-letter one
 *
 * `undefined` when neither is present — a supranational region belongs to no
 * single country, and that is an answer rather than a gap to fill.
 */
export function navigatorCountryIso3(place: NavigatorPlace): string | undefined {
  if (place.kind === 'country') {
    return place.aliases.find((alias) => /^[A-Z]{3}$/.test(alias));
  }

  return place.hierarchy.find((ancestor) => ancestor.kind === 'country')?.code;
}
