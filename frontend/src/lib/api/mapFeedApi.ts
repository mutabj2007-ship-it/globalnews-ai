
import type { GeoPrecision } from '@/lib/spatial/geoResolution';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 — G's MAP FEED, CONSUMED ON THE LIVE PATH.
 *
 * `GET /geo/map-feed?q=…` — G's own route, shipped in the R2 handoff and
 * serving today. It resolves against the gazetteer in memory, spends no
 * provider quota and writes nothing.
 *
 * This REPLACES the `/geo/country/:iso3` shape I proposed while the endpoint
 * did not exist. G built a better one — a single projection per query rather
 * than a list per country, carrying a collision-free `geographyId` and the join
 * keys — so the speculative consumer is deleted rather than adapted. Where H
 * and G disagreed on shape, the producer wins.
 *
 * ── THE FOUR STATES ARE READ, NOT RECONSTRUCTED ───────────────────────────
 *
 * G's §1 is explicit that `renderable` and `contested` exist "so you never
 * reconstruct this from three nullable fields and get it subtly wrong on one
 * surface out of six". So this module branches on those two booleans and on
 * `unresolvable`, and never infers a state from whether `place` happens to be
 * present.
 *
 * ── AND IT STILL FAILS SOFT ───────────────────────────────────────────────
 *
 * A 404, a timeout or a malformed payload yields `null`, and the map draws what
 * the country feed gives it. The endpoint is live now, but a frontend that
 * breaks when a backend is down is a frontend that cannot be deployed
 * independently of one.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 8000;

/** G's collision-free id. OPAQUE — join on `joinKeys`, never parse this. */
export type MapGeographyId = string;

export type MapGeographyKind = 'country' | 'admin1' | 'admin2' | 'city';

export interface MapJoinKeys {
  readonly iso3: string;
  readonly iso2: string;
  readonly regionCode?: string;
  /**
   * REFERENCE CONTEXT ONLY. Its presence NEVER means district precision — a
   * CITY record carrying one still has a CITY ceiling and must not address
   * district geometry as its own.
   */
  readonly districtCode?: string;
}

export interface MapCamera {
  readonly center: readonly [number, number];
  /** COUNTRY and PROVINCE only. A CAMERA TARGET, NEVER A BORDER. */
  readonly bounds?: readonly [number, number, number, number];
  readonly boundsCrossesAntimeridian?: boolean;
  /** Always 'derived-from-settlements' when bounds is present. The discriminant. */
  readonly boundsSource?: string;
}

export interface MapGeography {
  readonly geographyId: MapGeographyId;
  readonly kind: MapGeographyKind;
  /** What to show a reader — prefers the name they actually used. */
  readonly label: string;
  readonly canonicalName: string;
  readonly countryName: string;
  readonly regionName?: string;
  /** Derived from the unit's principal settlement. NEVER an official district name. */
  readonly districtLabel?: string;
  readonly joinKeys: MapJoinKeys;
  readonly camera: MapCamera;
  /** ABSENT means unknown — it never means zero. */
  readonly population?: number;
}

export interface MapInterpretation {
  readonly original: string;
  readonly corrected: string;
  readonly editDistance: number;
}

export type MapUnresolvableReason = 'NO_PLACE_EVIDENCE' | 'SUPRANATIONAL_NOT_GAZETTEERED';

export interface MapEvidenceGeography {
  readonly precision: GeoPrecision;
  readonly locationProvenance?: LocationProvenance;
  readonly place?: MapGeography;
  /** NOT A RANKING when contested. Nothing separated them. */
  readonly candidates: readonly MapGeography[];
  readonly renderable: boolean;
  readonly contested: boolean;
  readonly unresolvable?: MapUnresolvableReason;
  readonly interpretation?: MapInterpretation;
  readonly matchedText?: string;
  /** Diagnostics. NEVER rendered. */
  readonly reason: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * UNTRUSTED INPUT, VALIDATED STRUCTURALLY.
 *
 * A payload without a readable `precision` is rejected outright rather than
 * defaulted: a record whose geography could not be read is not a record at
 * UNKNOWN precision, and inventing a level is the failure the precision model
 * exists to prevent.
 *
 * ── MAP-ANALYSIS-CONTEXT — THE SAME RULE, APPLIED TO THE COUNTRY ──────────
 *
 * THE MEASURED DEFECT. `contextCountryIso3` was already being sent, and the
 * caller's own comment states the intent it was sent for: "so the global feed
 * cannot place a record in a country its article did not name." It did not
 * bind. A free-text lookup on a headline could therefore return a geography in
 * a country the article never mentioned, and the map presented it as that
 * record's evidence geography — the East Bengal / Mohun Bagan class, where an
 * Indian football fixture acquired a Russian location.
 *
 * WHY THE GUARD LIVES HERE AND NOT SOMEWHERE NEW. This function already holds
 * the product's one rule for "a payload we cannot substantiate is not a
 * payload": no readable `precision` means no record. A resolved place that
 * contradicts the structured context the caller supplied is the same class of
 * unsubstantiated answer, so it is refused in the same place, in the same
 * shape, and it fails closed. No second geography system, no second gate.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 *   - It never PROMOTES a candidate. When `contested` is true the candidates
 *     are explicitly "NOT A RANKING — nothing separated them", so selecting the
 *     one that happens to match the context would invent a resolution the
 *     gazetteer refused to make. A contradiction yields NO record, never a
 *     substituted one.
 *   - It never downgrades precision or provenance. Those values are returned
 *     unchanged or not at all; there is no "same record at a coarser level"
 *     path here, because that would manufacture exactly the false confidence
 *     the precision model exists to prevent.
 *   - It does nothing at all when no structured context was supplied. The
 *     search path asks a reader's question and legitimately reaches other
 *     countries; only a caller that has already resolved an article's own
 *     country constrains anything.
 *
 * THE TRADE, STATED. An article whose evidence genuinely lies outside its own
 * country is CONTAINED — it produces no map mark — rather than placed. That is
 * the conservative direction and it is the caller's stated intent; a record
 * that is absent is honest, and a record in the wrong country is not.
 */
function readMapFeed(payload: unknown, contextCountryIso3?: string): MapEvidenceGeography | null {
  if (!isObject(payload)) return null;
  if (typeof payload.precision !== 'string') return null;
  if (typeof payload.renderable !== 'boolean' || typeof payload.contested !== 'boolean') return null;

  const feed: MapEvidenceGeography = {
    ...(payload as unknown as MapEvidenceGeography),
    candidates: Array.isArray(payload.candidates)
      ? (payload.candidates as readonly MapGeography[])
      : [],
  };

  const context = contextCountryIso3?.trim().toUpperCase();

  if (context !== undefined && context.length > 0 && feed.place !== undefined) {
    const resolved = feed.place.joinKeys?.iso3;

    /*
      An unreadable country on a place that DOES exist cannot be checked against
      the context, and an unverifiable answer is refused for the same reason an
      unreadable precision is: the alternative is to render it and hope.
    */
    if (typeof resolved !== 'string') return null;
    if (resolved.trim().toUpperCase() !== context) return null;
  }

  return feed;
}

/**
 * ── BOTH MODES ARE ROUTED, AND THIS CLIENT NOW SENDS THE MODE ────────────
 *
 * H-1, second finding. The note this replaces said article mode was "AUTHORED
 * BUT NOT ROUTED" and deliberately withheld the parameter. That was true when
 * it was written and is **false against the C2 baseline**: G's C-N correction
 * landed, and `backend/src/modules/geo/geo.controller.ts` in this very tree
 * declares
 *
 *     mode?: 'query' | 'article';        // @IsIn(['query','article'])
 *     GET /geo/map-feed?q=...&country=...&mode=query|article
 *
 * So the backend routes it and the frontend was still refusing to send it —
 * the live data contract consumed incorrectly, on the same tree, in opposite
 * directions.
 *
 *   QUERY    a USER QUESTION. Casing is not required — readers type lowercase —
 *            but an explicit geographic context is, so "Chad missed the bus"
 *            never becomes a camera over N'Djamena.
 *   ARTICLE  EVIDENCE TEXT — a headline, a summary, a body. Prose supplies the
 *            capitalisation, so casing is required instead of a preposition.
 *
 * NEITHER IS THE LENIENT ONE, in G's own words: "sending a user question
 * through the article gate is as wrong as the reverse." So the caller chooses
 * and this module defaults neither — the search box holds a question, the
 * evidence enrichment holds prose, and only the caller knows which.
 */
export type MapFeedMode = 'query' | 'article';

export async function fetchMapFeed(
  text: string,
  options: { mode?: MapFeedMode; contextCountryIso3?: string } = {},
): Promise<MapEvidenceGeography | null> {
  if (text.trim().length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const params = new URLSearchParams({ q: text });

  if (options.mode !== undefined) params.set('mode', options.mode);
  if (options.contextCountryIso3 !== undefined) params.set('country', options.contextCountryIso3);

  try {
    const response = await fetch(`${API_BASE_URL}/geo/map-feed?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) return null;

    /*
      The structured context travels with the payload into the guard: it was
      already on the request, and until now nothing checked the answer against
      it.
    */
    return readMapFeed(await response.json(), options.contextCountryIso3);
  } catch {
    /*
      The one place in this path that swallows. An endpoint that is down is not
      an error condition for the reader — it is a capability that is briefly
      absent — and surfacing it as a failure would say something false about
      their data.
    */
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface GazetteerAttribution {
  readonly attribution: string;
  readonly counts?: Readonly<Record<string, number>>;
}

/** G's §9. CC BY 4.0 requires this wherever the data is presented. */
export async function fetchGazetteerAttribution(): Promise<GazetteerAttribution | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/geo/gazetteer`, { cache: 'no-store' });

    if (!response.ok) return null;

    const payload: unknown = await response.json();

    return isObject(payload) && typeof payload.attribution === 'string'
      ? { attribution: payload.attribution, counts: payload.counts as never }
      : null;
  } catch {
    return null;
  }
}
