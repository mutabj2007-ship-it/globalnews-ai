import { MAP_MODES, MAP_PERIODS, type MapMode, type MapPeriod, type MapSelection, type SelectionKind } from './mapState';

/**
 * SPATIAL M2 — MODE, PERIOD AND SELECTION IN THE URL, ADDITIVELY.
 *
 * Part II §3: "URL: camera, mode, period, selection." M1a serialised the
 * camera; this adds the other three.
 *
 * ── WHY THIS FILE ADDS NO SECOND WRITER ───────────────────────────────────
 *
 * `c2RuntimeDefects.spec.ts` pins an invariant this repository paid for:
 * there is EXACTLY ONE writer of the URL on the map route, so a restore cannot
 * fight a click. Two writers racing is the original H-C2 defect. So, exactly
 * as the camera did at M1a, these parameters arrive as PURE FUNCTIONS over a
 * `URLSearchParams` — `searchParamsWithMapState` composes onto whatever the
 * single writer has already built, and this module calls no router and touches
 * no history.
 *
 * ── AND WHY DEFAULTS ARE ABSENT RATHER THAN WRITTEN ───────────────────────
 *
 * WORLD mode, the 24H period and no selection are all omitted from the query
 * rather than spelled out. A plain `/map` therefore stays a plain `/map`, and
 * "no parameter" and "the default" are the same thing in both directions —
 * the property that keeps a shared link short and keeps a reload idempotent.
 */

export const MODE_QUERY_KEY = 'mode';
export const PERIOD_QUERY_KEY = 'period';
export const SELECTION_QUERY_KEY = 'sel';
/** RSC-1.1: "the URL gains `def=<definitionId>` so a shared link reproduces the same claim." */
export const DEFINITION_QUERY_KEY = 'def';

export const DEFAULT_MAP_MODE: MapMode = 'WORLD';
export const DEFAULT_MAP_PERIOD: MapPeriod = '24H';

/** Lowercase in the URL — shorter, and conventional for query values. */
const encodeMode = (mode: MapMode): string => mode.toLowerCase();
const encodePeriod = (period: MapPeriod): string => period.toLowerCase();

export function decodeMode(raw: string | null | undefined): MapMode | null {
  if (typeof raw !== 'string') return null;

  const upper = raw.toUpperCase();

  return (MAP_MODES as readonly string[]).includes(upper) ? (upper as MapMode) : null;
}

export function decodePeriod(raw: string | null | undefined): MapPeriod | null {
  if (typeof raw !== 'string') return null;

  const upper = raw.toUpperCase();

  return (MAP_PERIODS as readonly string[]).includes(upper) ? (upper as MapPeriod) : null;
}

const SELECTION_KINDS: readonly SelectionKind[] = [
  'COUNTRY',
  'CITY',
  'EVIDENCE',
  'SITUATION',
  'SOURCE',
  'REGION',
];

/**
 * RSC-1 step 4: `sel=region:<folded>`.
 *
 * ── WHAT "FOLDED" MEANS, AND WHY IT IS NOT A SECOND ID SCHEME ─────────────
 *
 * A region's canonical geographyId ALREADY carries the prefix:
 * `region:eastern-africa`. The URL form is `kind:id`, so encoding it naively
 * would produce `sel=region:region:eastern-africa` — the kind stated twice, and
 * a reader-visible parameter that looks like a bug.
 *
 * So the encoder FOLDS the id's own `region:` prefix into the kind prefix the
 * URL form already writes, and the decoder unfolds it back. The value is
 * lossless and symmetric:
 *
 *     region:eastern-africa  ->  sel=region:eastern-africa  ->  region:eastern-africa
 *
 * This is a display fold, NOT id construction. The decoder restores exactly the
 * prefix it removed and mints nothing: `sel=region:east-africa` decodes to
 * `region:east-africa`, which G's `/geo/place` does not hold, so the lookup
 * fails and the selection is dropped — which is the correct outcome for a
 * hand-typed region that does not exist. See RSC-1's alias trap.
 */
const REGION_ID_PREFIX = 'region:';

const foldRegionId = (id: string): string =>
  id.startsWith(REGION_ID_PREFIX) ? id.slice(REGION_ID_PREFIX.length) : id;

const unfoldRegionId = (folded: string): string =>
  folded.startsWith(REGION_ID_PREFIX) ? folded : `${REGION_ID_PREFIX}${folded}`;

/**
 * ══ THE CHARSET, WIDENED TO WHAT G ACTUALLY PUBLISHES ═════════════════════
 *
 * Verbatim from the live Alpha navigator, `/geo/search?q=Kigali`:
 *
 *     city:RWA:kigali@-1.94995,30.05885
 *     admin1:RW-01
 *     admin3:RW:nisr:1103
 *     region:eastern-africa
 *
 * Two consequences, neither optional:
 *
 * 1. THE ID IS OPAQUE. `NavigatorPlace.geographyId` is documented "Join and
 *    look up by it; never parse it." So the codec carries it whole. It does not
 *    split the country out of it, does not read the coordinates off the end,
 *    and does not reconstruct it from parts. The fold below removes a prefix it
 *    provably put back; that is the only structural claim made about an id.
 *
 * 2. THE CHARSET MUST ADMIT `:`, `@` AND `,`. It did not, so a city selection
 *    could not survive the URL at all — `decodeSelection` would have refused
 *    the very value `encodeSelection` produced, and the selection would have
 *    been dropped on every reload. The guard is WIDENED, not removed: `/`,
 *    whitespace and `%` are still refused, which is what keeps a hand-edited
 *    parameter from reaching a lookup looking like a path or an escape. The
 *    three characters added are the ones G publishes and no others.
 */
const SELECTION_ID_PATTERN = /^[A-Za-z0-9._:@,-]+$/;

const SELECTION_ID_MAX = 128;

/** Shared by both halves of the codec so they cannot drift apart. */
function selectionIdIsWellFormed(id: string): boolean {
  return id.length > 0 && id.length <= SELECTION_ID_MAX && SELECTION_ID_PATTERN.test(id);
}

const CITY_ID_PREFIX = 'city:';

/**
 * ══ THE FOLD IS PER KIND, BECAUSE ONE RULE CANNOT BE SYMMETRIC FOR BOTH ═══
 *
 * A first attempt at this used one fold for everything and was WRONG in a way
 * worth recording, because it corrupts silently rather than failing:
 *
 *     region:admin1:RW-01  --decode-->  id "admin1:RW-01"
 *                          --unfold-->  "region:admin1:RW-01"   <- a node that
 *                                                                  does not exist
 *
 * The asymmetry is that a REGION selection carries TWO shapes of id — G's
 * supranational `region:eastern-africa`, which owns the `region:` prefix, and a
 * subnational `admin1:RW-01`, which owns a different one. A decoder cannot tell
 * a folded id from an unfolded one by inspection, so the rule is fixed per kind
 * instead of guessed:
 *
 *   REGION  fold `region:` when present. Unfold ONLY when the decoded id
 *           contains no `:` at all — `eastern-africa` unfolds, `admin1:RW-01`
 *           is already whole and is left exactly as it arrived.
 *
 *   CITY    fold `city:` and always restore it. Every city id G publishes is in
 *           the `city:` namespace, so the prefix is known rather than inferred,
 *           and folding keeps `sel=city:RWA:kigali@…` from reading
 *           `sel=city:city:RWA:kigali@…`.
 *
 * Both directions are exercised against the REAL ids the live navigator returns
 * in `mapUrl.spec.ts`; a fold that is not round-trip tested is a fold that will
 * be wrong on the one id nobody tried.
 */
const foldCityId = (id: string): string =>
  id.startsWith(CITY_ID_PREFIX) ? id.slice(CITY_ID_PREFIX.length) : id;

const unfoldCityId = (folded: string): string =>
  folded.startsWith(CITY_ID_PREFIX) ? folded : `${CITY_ID_PREFIX}${folded}`;

/**
 * A subnational region id carries its own namespace prefix and must not be
 * given a second one. `eastern-africa` has none and is G's folded supranational
 * form; `admin1:RW-01` has one and is whole.
 */
const regionIdIsWhole = (folded: string): boolean => folded.includes(':');

/**
 * `kind:id`, e.g. `country:RWA`.
 *
 * TYPED IN THE URL, not a bare id. A selection is `{kind, id}` in the state
 * model, and an id alone cannot be resolved without guessing which registry it
 * belongs to — a guess that would silently pick the wrong record the first
 * time an evidence id looked like an ISO3.
 */
export function encodeSelection(selection: MapSelection): string {
  const id =
    selection.kind === 'REGION'
      ? foldRegionId(selection.id)
      : selection.kind === 'CITY'
        ? foldCityId(selection.id)
        : selection.id;

  return `${selection.kind.toLowerCase()}:${id}`;
}

/**
 * The definition id a selection asserts, or null.
 *
 * REGION ONLY. A `definitionId` on any other kind is not written: it would be a
 * parameter with no contract behind it, and a shared link carrying one would
 * imply a claim the product cannot make.
 */
export function encodeDefinition(selection: MapSelection | null): string | null {
  if (selection === null || selection.kind !== 'REGION') return null;

  return typeof selection.definitionId === 'string' && selection.definitionId.length > 0
    ? selection.definitionId
    : null;
}

/**
 * EVERY INPUT IS UNTRUSTED, and this one is inert besides: G has not landed
 * attributed definitions (G-REG-3), so nothing can currently produce a value
 * this accepts. It is validated to the same charset as an id rather than being
 * waved through, because "inert today" is not a property a parser may assume.
 */
export function decodeDefinition(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0 || raw.length > 96 || !/^[A-Za-z0-9._-]+$/.test(raw)) return null;

  return raw;
}

/**
 * EVERY INPUT IS UNTRUSTED — this arrives from an address bar a person can
 * type into. Never throws; returns null for anything it cannot read, and the
 * caller falls back to no selection.
 */
export function decodeSelection(raw: string | null | undefined): MapSelection | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) return null;

  const separator = raw.indexOf(':');

  if (separator <= 0) return null;

  const kind = raw.slice(0, separator).toUpperCase();
  const id = raw.slice(separator + 1);

  if (!(SELECTION_KINDS as readonly string[]).includes(kind)) return null;

  /*
    THE CHARSET IS CHECKED ON THE FOLDED FORM, BEFORE ANY UNFOLDING, so what is
    validated is exactly what the URL carried.
  */
  if (!selectionIdIsWellFormed(id)) return null;

  /*
    REGION UNFOLDS; NOTHING ELSE DOES. `region:eastern-africa` was folded to
    `eastern-africa` by the encoder and is restored here. A subnational region
    id — `admin1:RW-01` — was NOT folded, still carries its own prefix, and is
    returned untouched: unfolding it would mint `region:admin1:RW-01`, a node
    that does not exist.
  */
  if (kind === 'REGION') {
    return { kind: 'REGION', id: regionIdIsWhole(id) ? id : unfoldRegionId(id) };
  }

  if (kind === 'CITY') {
    return { kind: 'CITY', id: unfoldCityId(id) };
  }

  return { kind: kind as SelectionKind, id };
}

export interface UrlMapState {
  readonly mode: MapMode;
  readonly period: MapPeriod;
  readonly selection: MapSelection | null;
}

/** A definition only ever attaches to the selection it refines. */
function withDefinition(
  selection: MapSelection | null,
  definitionId: string | null,
): MapSelection | null {
  if (selection === null || selection.kind !== 'REGION' || definitionId === null) return selection;

  return { ...selection, definitionId };
}

/** The state a URL asks for. Absent or unreadable parameters fall to defaults. */
export function mapStateFromSearchParams(params: URLSearchParams | null | undefined): UrlMapState {
  return {
    mode: decodeMode(params?.get(MODE_QUERY_KEY)) ?? DEFAULT_MAP_MODE,
    period: decodePeriod(params?.get(PERIOD_QUERY_KEY)) ?? DEFAULT_MAP_PERIOD,
    selection: withDefinition(
      decodeSelection(params?.get(SELECTION_QUERY_KEY)),
      decodeDefinition(params?.get(DEFINITION_QUERY_KEY)),
    ),
  };
}

/**
 * Compose map state onto params the single writer has already built.
 *
 * PRESERVES EVERY OTHER PARAMETER, including the camera and the route's own
 * `country` and `category`. Defaults DELETE their key rather than writing it,
 * so switching back to WORLD leaves the URL exactly as clean as it started.
 */
export function searchParamsWithMapState(
  existing: URLSearchParams | null | undefined,
  state: UrlMapState,
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? '');

  if (state.mode === DEFAULT_MAP_MODE) params.delete(MODE_QUERY_KEY);
  else params.set(MODE_QUERY_KEY, encodeMode(state.mode));

  if (state.period === DEFAULT_MAP_PERIOD) params.delete(PERIOD_QUERY_KEY);
  else params.set(PERIOD_QUERY_KEY, encodePeriod(state.period));

  if (state.selection === null) params.delete(SELECTION_QUERY_KEY);
  else params.set(SELECTION_QUERY_KEY, encodeSelection(state.selection));

  /*
    RSC-1.1: absent means no definition is asserted, so the DEFAULT DELETES ITS
    KEY exactly as mode and period do. `def=` never appears on a selection that
    has not chosen one, and clearing a definition removes the parameter rather
    than writing an empty value that would read as a choice of nothing.
  */
  const definitionId = encodeDefinition(state.selection);

  if (definitionId === null) params.delete(DEFINITION_QUERY_KEY);
  else params.set(DEFINITION_QUERY_KEY, definitionId);

  return params;
}
