import { resolveArticleGeography } from './geo-location-adapter';
import {
  resolveGeography,
  type GeoPrecision,
  type GeoProvenance,
  type GeoResolution,
  type ResolvedPlace,
} from './geo-resolver';
import type { DerivedExtent } from './geo-gazetteer';
import { cleanSourceName } from './source-name-suffix';
import { toDisplayCase } from './display-casing';
import { foldGeographyIdSegment } from './geo-normalize.util';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAP FEED — THE RUNTIME EVIDENCE GEOGRAPHY H RENDERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * H is implementing the Spatial M2 evidence overlay and needs, for every
 * evidence record, an answer to four questions:
 *
 *     WHICH geometry feature is this?          -> geographyId + joinKeys
 *     WHAT may I claim about it?               -> precision + provenance
 *     WHERE do I put the camera?               -> camera
 *     WHAT do I do when there is no answer?    -> candidates / unresolvable
 *
 * This module answers exactly those four and deliberately stops there.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DOES NOT EMIT, AND WHY THAT IS THE POINT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NO HALO RADIUS. The design specification assigns halo geometry to the
 * rendering layer and states the radii itself (260 km country, 110 km province,
 * 45 km district, 14 km city, 0 for EXACT). Emitting a radius from the data
 * layer would put the same number in two places, and the day the specification
 * revised one of them the map and the backend would disagree silently. G emits
 * PRECISION; H derives geometry from it. That is the collision boundary and it
 * is exactly where the specification draws it.
 *
 * NO MARKER STYLE, NO BANNER COPY, NO LABEL TIER, NO COLOUR. Same reason.
 * `provenance` is emitted; what dashed-and-hollow means is H's.
 *
 * NO POLYGON. This gazetteer holds no administrative boundaries. It holds join
 * keys, which is how H gets the polygon from a geometry source, and derived
 * extents, which are camera targets and are NEVER borders.
 */

/**
 * A STABLE, OPAQUE IDENTITY FOR ONE GEOGRAPHY.
 *
 * The design specification's map state model carries `geographyId` in three
 * places at once - `selected.geographyId`, the `watch` set, and the
 * evidence-list ↔ map selection sync. All three need the SAME string for the
 * same place, produced by the SAME rule, or a followed country will not light up
 * as the country a user selected.
 *
 * The shape is `kind:key`, and the key is always an EXTERNAL identifier:
 *
 *     country:RWA                       ISO 3166-1 alpha-3
 *     admin1:RW-01                      ISO 3166-2
 *     admin2:RW.12.11                   GeoNames admin2 code
 *     city:RWA:kigali@-1.94995,30.05885 ISO3, folded name, and the point
 *
 * WHY THE CITY KEY CARRIES COORDINATES, WHICH LOOKS LIKE OVER-ENGINEERING AND
 * IS NOT. The first version was `city:<iso3>:<foldedName>`, and a test asserting
 * that contested candidates have distinct ids failed immediately: "Aberdeen"
 * returns six candidates that collapsed to TWO ids, because the United States
 * has five settlements called Aberdeen and they all folded to the same string.
 *
 * That is not cosmetic. `geographyId` is what the specification's map state
 * model uses for `selected.geographyId`, for the `watch` set, and for the
 * evidence-list ↔ map selection sync. Colliding ids mean selecting one Aberdeen
 * selects five, and following one follows five.
 *
 * MEASURED ACROSS THE WHOLE GAZETTEER (51,057 settlements):
 *
 *     name alone            3,996 records in colliding keys, worst case 11
 *     name + admin1           432 records in colliding keys, worst case 4
 *     name + coordinates        0
 *
 * A settlement's identity IS its point, so the point is what makes the id
 * unique - and it is already in the payload, so nothing new is being asserted.
 * The readable name stays in front of it because these ids are URL-serialised
 * and a human debugging a link should be able to see what they are looking at.
 *
 * TREAT IT AS OPAQUE. Parse it and you have coupled to this rule; join on
 * `joinKeys` instead, which is what it is for.
 */
export type MapGeographyId = string;

export type MapGeographyKind = 'country' | 'admin1' | 'admin2' | 'city';

/**
 * The keys H joins against real geometry. Every one is an external, published
 * identifier - never an internal id, never an array index, never a hash.
 */
export interface MapJoinKeys {
  /** ISO 3166-1 alpha-3. Always present. */
  readonly iso3: string;
  /** ISO 3166-1 alpha-2. For a flag, or a Natural Earth ISO_A2 join. */
  readonly iso2: string;
  /** ISO 3166-2, e.g. "RW-01". Absent when the subdivision join failed. */
  readonly regionCode?: string;
  /**
   * GeoNames admin2 code, e.g. "RW.12.11". REFERENCE CONTEXT ONLY.
   *
   * Its presence NEVER means the record has district precision. A CITY record
   * that sits inside a known district carries this so H can say "in this
   * district" - it must not address district geometry as the record's own.
   */
  readonly districtCode?: string;
}

/**
 * Where to put the camera, and nothing about how to fly there.
 *
 * `bounds` is present only for COUNTRY and PROVINCE, and it is a DERIVED
 * EXTENT - a bounding box over the settlements this gazetteer holds, labelled
 * as such. It is a camera target. IT IS NOT A BORDER, and rendering it as a
 * fill or an outline is prohibited by the join contract.
 *
 * A CITY carries `center` and no bounds, deliberately: a bounding box over one
 * settlement is a degenerate point-box, and the specification already states the
 * city fit (~15 km). H owns that number.
 */
export interface MapCamera {
  /** [lon, lat]. Always present when the geography resolved. */
  readonly center: readonly [number, number];
  /** [west, south, east, north]. COUNTRY and PROVINCE only. */
  readonly bounds?: readonly [number, number, number, number];
  /**
   * True when `bounds` crosses the antimeridian, i.e. west > east. A fitBounds
   * given an unwrapped box flies the camera the long way around the planet.
   */
  readonly boundsCrossesAntimeridian?: boolean;
  /**
   * Always `'derived-from-settlements'` when bounds is present. The discriminant
   * that makes it impossible to mistake this for a boundary by accident.
   */
  readonly boundsSource?: DerivedExtent['source'];
}

/** One place the reader might have meant. Used for the selected place and for every contested candidate. */
export interface MapGeography {
  readonly geographyId: MapGeographyId;
  readonly kind: MapGeographyKind;
  /**
   * What to show a reader. Prefers the name they actually used: a reader who
   * typed "Rubavu" is shown Rubavu, even though the gazetteer's canonical
   * spelling is the pre-2006 "Gisenyi".
   */
  readonly label: string;
  /** The gazetteer's canonical spelling. Differs from `label` when an alias matched. */
  readonly canonicalName: string;
  /**
   * R-GEO-NAME-SUFFIX — the canonical name with its OWN COUNTRY's name removed
   * from the end, where the source carried one. "Bari, Somalia" -> "Bari".
   *
   * Equal to `canonicalName` for everything else, including "Fontana, Gozo",
   * whose tail is an island rather than its country. ADDITIVE: `canonicalName`
   * is unchanged and still carries the source spelling for provenance.
   */
  readonly searchLabel: string;
  /** Country display name. */
  readonly countryName: string;
  /** Subdivision display name, when one is known. */
  readonly regionName?: string;
  /**
   * A district label DERIVED from the unit's principal settlement. NEVER an
   * official district name, and absent when no member could be verified.
   */
  readonly districtLabel?: string;
  readonly joinKeys: MapJoinKeys;
  readonly camera: MapCamera;
  /** Population, when known. ABSENT means unknown - it never means zero. */
  readonly population?: number;
  /**
   * A TEXT FORM OF THIS PLACE THAT RESOLVES BACK TO THIS EXACT `geographyId`.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT THE SAME THING AS `label`, AND WHY THE DIFFERENCE MATTERS
   * ─────────────────────────────────────────────────────────────────────────
   *
   * The popup's "Open Analysis" action has to hand the analysis pipeline a
   * QUESTION, and that pipeline re-resolves the question's geography from text.
   * So the text has to come back to the same place, or the user selects one
   * province and gets an analysis of another.
   *
   * MEASURED, AND IT DOES NOT WORK WITH `label`:
   *
   *     selected   admin1:RW-04   label "Western Region"
   *     re-resolve "Western Region"
   *       -> PROVINCE / CONTESTED across Iceland, Nepal and Uganda
   *       -> no place at all
   *
   * `label` is built for a HUMAN READING A CARD and deliberately prefers the
   * words the reader used. That is right for display and useless as an
   * identifier: "Western Region" names subdivisions in several countries, and
   * a bare city name names settlements in dozens.
   *
   * So this field is the qualified form - canonical name, then the subdivision,
   * then the country - and it is verified: a test round-trips a broad sample of
   * the gazetteer through `mapGeographyForQuery` and asserts the id comes back
   * identical.
   *
   * IT IS NOT A DISPLAY STRING. Show `label`; send this.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * AND IT IS NOT THE IDENTITY. 99.7% IS NOT 100%.
   * ─────────────────────────────────────────────────────────────────────────
   *
   * A text round trip is the wrong mechanism for an identity-preserving action,
   * and this field does not pretend otherwise. `geographyId` and `joinKeys` are
   * the identity; this is a convenience for an entry point that currently takes
   * only text.
   *
   * A CALLER SHOULD SEND BOTH - the query for the pipeline that needs words,
   * and the id for anything that needs to know which place was meant. The
   * durable fix is for the analysis entry point to accept a geography
   * identifier directly, which is a shared-contract change and therefore
   * Main's; it is raised in the handoff rather than worked around here.
   */
  readonly analysisQuery: string;
}

/** How the reader's text became this geography, when it was not a plain match. */
export interface MapInterpretation {
  /** What the text actually said, e.g. "kigalli". */
  readonly original: string;
  /** What it was taken to mean, e.g. "kigali". */
  readonly corrected: string;
  /**
   * How far apart the two are. Carried so a surface can be MORE cautious about a
   * distant correction than a one-character typo, if it chooses to be - not
   * because G has decided it should.
   */
  readonly editDistance: number;
}

export type MapUnresolvableReason =
  /** No place was named at all. */
  | 'NO_PLACE_EVIDENCE'
  /**
   * A place WAS named - a supranational region - and cannot be placed, because
   * no controlled supranational region gazetteer exists yet. Different from the
   * above, and a surface should say so differently.
   */
  | 'SUPRANATIONAL_NOT_GAZETTEERED';

/**
 * THE RECORD H RENDERS. One per evidence item.
 *
 * FOUR STATES, AND THEY ARE MUTUALLY EXCLUSIVE BY CONSTRUCTION:
 *
 *   RESOLVED     `place` present, `renderable` true. Draw it.
 *   CONTESTED    `place` ABSENT, `candidates` has two or more. Draw none of
 *                them as the answer; offer them, or ask.
 *   UNRESOLVABLE `place` absent, `candidates` empty, `unresolvable` set.
 *   (there is no fourth silent state - that is the point)
 *
 * `renderable` exists so H never has to reconstruct that logic from three
 * nullable fields and get it subtly wrong on one surface out of six.
 */
export interface MapEvidenceGeography {
  readonly precision: GeoPrecision;
  /** Absent only when nothing resolved. Never raises or lowers precision. */
  readonly locationProvenance?: GeoProvenance;
  /** The chosen place. ABSENT for CONTESTED and for UNKNOWN. */
  readonly place?: MapGeography;
  /**
   * Every surviving candidate. Populated for CONTESTED; a single entry when
   * resolved; empty when nothing matched.
   *
   * FOR A CONTESTED RECORD THESE ARE NOT A RANKING. Nothing separated them -
   * that is what contested means - and presenting the first as "most likely"
   * would manufacture the confidence the resolver refused to have.
   */
  readonly candidates: readonly MapGeography[];
  /** True only when `place` is present. H may draw this record. */
  readonly renderable: boolean;
  /** True when two or more candidates survived and none dominated. */
  readonly contested: boolean;
  /** Set only when nothing resolved. */
  readonly unresolvable?: MapUnresolvableReason;
  /** Present only for INTERPRETED records, carrying the evidence for the disclosure. */
  readonly interpretation?: MapInterpretation;
  /** The exact surface form in the text that produced this. Audit and highlighting. */
  readonly matchedText?: string;
  /** Machine-readable account of the decision. Diagnostics; never rendered. */
  readonly reason: string;
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * G-GEO-9 — IS THIS ALIAS A DIFFERENT LABEL FROM THE CANONICAL NAME?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG: A LATIN-ONLY CLASS IN A WORLDWIDE GAZETTEER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The separator class was `[^a-z0-9]+`, which is ASCII-only. Every character
 * outside `a-z0-9` — that is, every Cyrillic, Arabic, CJK, Hangul, Greek,
 * Hebrew, Devanagari and Thai character in the gazetteer — was treated as a
 * separator, so a name written entirely in one of those scripts folded to the
 * EMPTY STRING.
 *
 * The consequence is not a cosmetic one. This function's only job is the
 * equality test below, and two empty strings compare EQUAL. So the fold did not
 * merely lose detail on non-Latin input; it reported every pair of non-Latin
 * labels as THE SAME LABEL. `'Канильо' === '卡尼略'` was true here, in a
 * function whose entire purpose is deciding whether two labels differ.
 *
 * MEASURED against the shipped gazetteer, `gazetteer.v1.json`:
 *
 *     7,869  names folding to '' under the old class
 *              7,862  non-Latin admin1 aliases   (Cyrillic 3,382 · CJK 2,855 ·
 *                                                 Arabic 1,603 · Hangul 28)
 *                  1  a literal "-" alias, which folds to '' either way
 *                  6  city canonical names, all Cyrillic
 *     6,128  ALIAS PAIRS the old fold called identical
 *     6,128  of those the corrected fold distinguishes — 100%
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THIS IS NOT AN IDENTITY FOLD AND MUST NEVER BECOME ONE. `geographyId`
 * segments are folded by `foldGeographyIdSegment`, which is and remains the
 * sole canonical identity fold; matching asks `foldPlaceName`. This function
 * answers a third, narrower question — "should the label show the alias the
 * reader typed, or the canonical name?" — and its output is never stored,
 * never part of an id, and never compared against anything produced by the
 * other two. No id changes because of this correction, and the identity fold is
 * not touched by it.
 *
 * The class now matches the canonical fold's `[^\p{L}\p{N}]+` rather than
 * being a fourth opinion about what a letter is. That is the only change: the
 * NFKC/lowercase/NFD/mark-stripping pipeline and the hyphen separator are
 * unchanged, so every PURE ASCII name folds exactly as it did before.
 *
 * G-GEO-13 — THAT SENTENCE USED TO SAY "every Latin name", AND IT WAS WRONG.
 * Ten Latin-extended characters survive diacritic stripping and are still
 * outside `a-z`, so the old class deleted them mid-word and 844 Latin-script
 * names DID change: ł 477 · ı 243 · ß 70 · ø 52 · ħ 21 · æ 17 · đ 14 · ð 13 ·
 * œ 7 · ǁ 2. "Aleksandrów Łódzki" folded to "aleksandrow-odzki" before and
 * "aleksandrow-łodzki" now. The corrected scope is ASCII, the measured
 * extended-Latin behaviour is the one described here, and the fold itself is
 * unchanged from the accepted 2B1 package — this is a documentation
 * correction only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS EXPORTED, WHICH IS A DELIBERATE AND NARROW DECISION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It is exported SO THE CORRECTION CAN BE TESTED, and for no other reason.
 *
 * The empty-vs-empty branch is unreachable through the public map-feed API on
 * the SHIPPED gazetteer: it requires a place whose canonical name is non-Latin
 * AND which carries an alias, and the artifact currently contains six non-Latin
 * canonical names, all cities, all with no aliases. Measured, not assumed. So a
 * test driven only through `mapGeographyForQuery` cannot reach the defect, and
 * an untestable correction in a fold is exactly the thing this codebase has
 * been bitten by before.
 *
 * IT IS NOT AN INVITATION TO REUSE. Anything needing an identity fold must call
 * `foldGeographyIdSegment`; anything asking "are these the same name?" must call
 * `foldPlaceName`. A fourth caller of this function would be a defect, and the
 * fact that the shipped data is six aliases away from making this branch live
 * is the reason it is worth pinning now rather than when it fires.
 */
export function foldForLabelComparison(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

/**
 * The geography's kind, decided by what the resolution actually asserted -
 * NOT by which fields happen to be populated.
 *
 * A CITY record carries a regionCode and often a districtCode as reference
 * context. Deciding kind by "has a districtCode" would silently promote it to
 * admin2, which is the precision-drift failure the specification calls the most
 * serious product risk.
 */
function kindFor(precision: GeoPrecision, place: ResolvedPlace): MapGeographyKind {
  if (precision === 'CITY' || place.cityName !== undefined) return 'city';
  if (precision === 'PROVINCE' || place.regionCode !== undefined) return 'admin1';

  return 'country';
}

function geographyIdFor(kind: MapGeographyKind, place: ResolvedPlace): MapGeographyId {
  if (kind === 'city' && place.cityName) {
    /*
     * The point is what makes this unique - see the note on MapGeographyId. A
     * settlement without coordinates cannot happen at CITY precision, but if it
     * ever did, falling back to the bare name is better than emitting "@NaN".
     */
    const point = place.point ? `@${place.point[1]},${place.point[0]}` : '';

    return `city:${place.country.iso3}:${foldGeographyIdSegment(place.cityName)}${point}`;
  }

  if (kind === 'admin1' && place.regionCode) return `admin1:${place.regionCode}`;

  return `country:${place.country.iso3}`;
}

function cameraFor(kind: MapGeographyKind, place: ResolvedPlace): MapCamera {
  /*
   * A CITY IS A POINT. No bounds are emitted, because a bounding box over one
   * settlement is a degenerate point-box and would invite a fitBounds that
   * zooms to street level - a precision claim the record does not hold.
   */
  if (kind === 'city' && place.point) {
    return { center: place.point };
  }

  const extent = place.extent ?? undefined;

  if (!extent) {
    // No extent and no point. Nothing honest to centre on.
    return { center: place.point ?? [0, 0] };
  }

  return {
    center: extent.centroid,
    bounds: extent.bbox,
    boundsCrossesAntimeridian: extent.antimeridian,
    boundsSource: extent.source,
  };
}

function toMapGeography(
  precision: GeoPrecision,
  place: ResolvedPlace,
  matchedAliasFallback?: string,
): MapGeography {
  const kind = kindFor(precision, place);
  const canonicalName = place.cityName ?? place.regionName ?? place.country.name;

  /*
   * R-GEO-NAME-SUFFIX — THE CLEAN LABEL, DERIVED BESIDE THE SOURCE ONE.
   *
   * `canonicalName` stays exactly what the gazetteer published, because it is
   * the provenance answer and H already consumes it. `searchLabel` is the
   * derived form, equal to it except for the 113 admin1 records whose source
   * spelling ends in their own country.
   */
  const cleaned = cleanSourceName(canonicalName, place.country.name);

  /*
   * THE LABEL PREFERS WHAT THE READER WROTE.
   *
   * A Rwandan who types "Rubavu" should be shown Rubavu. The gazetteer's
   * canonical spelling for that settlement is the pre-2006 "Gisenyi", which is
   * correct as data and wrong as a label in 2026. `canonicalName` is kept
   * alongside so nothing is lost and an audit can still see both.
   */
  const alias = place.matchedAlias ?? matchedAliasFallback;
  const label =
    alias && foldForLabelComparison(alias) !== foldForLabelComparison(canonicalName)
      ? toDisplayCase(alias)
      : canonicalName;

  /*
   * CANONICAL NAME PLUS COUNTRY. The form was MEASURED rather than chosen -
   * four constructions were round-tripped over a 372-place sample:
   *
   *     "name, region, country"     97.3%
   *     "name in region, country"   97.3%
   *     "name (region), country"    99.7%
   *     "name, country"             99.7%   <- this one
   *
   * INCLUDING THE SUBDIVISION MAKES IT WORSE, which was not what I expected.
   * The reason is visible in the failures: when the subdivision is ITSELF a
   * settlement name, the city tier matches it and wins - "Batatais, Sao Paulo,
   * Brazil" resolved to Sao Paulo the city, not Batatais. The region was not
   * disambiguating anything; it was adding a competing candidate.
   *
   * Built from CANONICAL names, never from `label`: an alias is what the reader
   * typed, and re-resolving an alias is the round trip this field exists to
   * avoid.
   */
  /*
   * BUILT FROM THE CLEAN LABEL, WHICH FIXES A DOUBLED COUNTRY.
   *
   * Measured on C10 before the change: `canonicalName` for Somalia's Hiran is
   * the source string "Hiran, Somalia", and appending the country produced
   *
   *     "Hiran, Somalia, Somalia"
   *
   * as the round-trip query — for Hiran, Bay, Nugal and Bari, and for the other
   * 109 country-suffixed admin1 records. The measured 99.7% "name, country"
   * form above is unchanged; it was being fed a name that already carried the
   * country. Using the clean label restores the form the measurement described.
   */
  const analysisQuery =
    kind === 'country' ? place.country.name : `${cleaned.searchLabel}, ${place.country.name}`;

  return {
    geographyId: geographyIdFor(kind, place),
    kind,
    label,
    canonicalName,
    searchLabel: cleaned.searchLabel,
    countryName: place.country.name,
    regionName: place.regionName,
    districtLabel: place.districtLabel,
    joinKeys: {
      iso3: place.country.iso3,
      iso2: place.country.iso2,
      regionCode: place.regionCode,
      districtCode: place.districtCode,
    },
    camera: cameraFor(kind, place),
    population: place.population,
    analysisQuery,
  };
}

/**
 * PROJECTS A RESOLUTION INTO THE MAP FEED. Pure.
 *
 * This is the ONLY place the projection happens, so the World Map, the Analysis
 * workspace panel, the Today embed and the Watch surface cannot end up with four
 * slightly different opinions about what a contested record looks like.
 */
export function toMapEvidenceGeography(resolution: GeoResolution): MapEvidenceGeography {
  const candidates = resolution.candidates.map((place) =>
    toMapGeography(resolution.precision, place, resolution.matchedText),
  );

  const contested = resolution.provenance === 'CONTESTED';
  const place = resolution.place
    ? toMapGeography(resolution.precision, resolution.place, resolution.matchedText)
    : undefined;

  const unresolvable: MapUnresolvableReason | undefined =
    place === undefined && !contested
      ? resolution.reason === 'SUPRANATIONAL_NOT_GAZETTEERED'
        ? 'SUPRANATIONAL_NOT_GAZETTEERED'
        : 'NO_PLACE_EVIDENCE'
      : undefined;

  return {
    precision: resolution.precision,
    locationProvenance: resolution.provenance,
    place,
    candidates,
    renderable: place !== undefined,
    contested,
    unresolvable,
    interpretation: resolution.geoMatch
      ? {
          original: resolution.geoMatch.matchedFrom,
          corrected: resolution.geoMatch.canonicalLocation,
          editDistance: resolution.geoMatch.editDistance,
        }
      : undefined,
    matchedText: resolution.matchedText,
    reason: resolution.reason,
  };
}

/**
 * The map feed for a QUERY - the Ask bar, the search box, a country chip.
 *
 * Query mode: casing is not required (readers type lowercase) but an explicit
 * geographic context is, so "Chad missed the bus" does not become a map camera
 * over N'Djamena.
 */
export function mapGeographyForQuery(
  query: string,
  contextCountryIso3?: string,
): MapEvidenceGeography {
  return toMapEvidenceGeography(
    resolveGeography(query, { contextCountryIso3, requireGeographicContext: true }),
  );
}

/**
 * The map feed for an ARTICLE - a headline plus summary, or body text.
 *
 * Article mode: capitalisation IS required (prose supplies it, and it is the
 * cheapest available guard against every lowercase common noun that happens to
 * be a place name) and an explicit preposition is not.
 */
export function mapGeographyForArticle(
  text: string,
  contextCountryIso3?: string,
  /*
   * G-LANG-FR-3 — the evidence's own declared language. Optional and last, so
   * every existing caller compiles and behaves byte-for-byte as before.
   */
  evidenceLanguage?: string,
): MapEvidenceGeography {
  return toMapEvidenceGeography(
    resolveArticleGeography(text, contextCountryIso3, evidenceLanguage),
  );
}
