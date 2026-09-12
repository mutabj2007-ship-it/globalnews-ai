import {
  ALL_ISO3_CODES,
  resolveCountryByAnyIdentifier,
  resolveGeoTypo,
  type CountryMeta,
  type GeoFuzzyMatch,
} from '@globalnews-ai/shared';
import { isRoutingFunctionWord } from '../analysis/query/routing-function-words.util';
import { findSupranationalSpans, maskSupranationalSpans } from './supranational-regions';
import {
  candidateRuns,
  foldPlaceName,
  foldTokens,
  rawTokens as splitRawTokens,
  segmentStarts,
  tokenCasing,
} from './geo-normalize.util';
import { localizedCountriesNamedIn } from './language/localized-country-surface';
import {
  admin2For,
  citiesByExonym,
  citiesNamed,
  countryExtent,
  maxNameWords,
  regionFor,
  regionStem,
  regionsByStem,
  regionsNamed,
  type DerivedExtent,
  type GazetteerCity,
  type GazetteerRegion,
} from './geo-gazetteer';

/**
 * GEOGRAPHY — THE SCALABLE RESOLVER.
 *
 * WHAT THIS REPLACES AND WHY IT MATTERS. The previous resolver was a curated
 * table of roughly two dozen cities. Its failure mode was not an error - it was
 * SILENCE. A question about Perth, Shanghai, São Paulo or Istanbul resolved to
 * nothing, fell through to keyword retrieval, and the reader was told there was
 * no reporting. This resolves against 48,702 settlements and 3,940 first-level
 * subdivisions with real coordinates.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THREE THINGS IT MUST GET RIGHT, IN PRIORITY ORDER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. NEVER INVENT A PLACE. An unresolvable name yields UNKNOWN, and UNKNOWN is
 *    an honest answer rather than a failure. "Nyabugogo" is a real Kigali
 *    neighbourhood that is not in any gazetteer tier this product carries; it
 *    resolves to UNKNOWN and must not be silently upgraded to Kigali.
 *
 * 2. NEVER SILENTLY PICK A WINNER FROM A GENUINE TIE. "Perth" is three real
 *    cities. With no context, the honest answer is CONTESTED - which the M1.0A
 *    contract declared and could not produce, because a single-candidate
 *    resolver has nothing to contest. It is producible now, and that is the
 *    substantive contract change this work delivers.
 *
 * 3. NEVER LET PROVENANCE RAISE PRECISION. Design v1.1, unchanged. A location
 *    STATED in the text is not more precise for being stated. The two axes stay
 *    independent, and `assertProvenanceDoesNotRaisePrecision` in the spatial
 *    contract still holds.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISAMBIGUATION, AND WHY POPULATION IS THE LAST RESORT AND NOT THE FIRST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Evidence in the text outranks any prior. In order:
 *
 *   a. COUNTRY CO-MENTION. "Perth, Australia" and "a report from Perth said the
 *      Australian government..." both name the country. One surviving candidate
 *      -> resolved, provenance STATED.
 *   b. REGION CO-MENTION. "Perth, Western Australia". Same shape, finer.
 *   c. POPULATION DOMINANCE. Only when no textual evidence separates the
 *      candidates. A candidate is dominant only if it is at least
 *      POPULATION_DOMINANCE_RATIO times the next - a bar Perth's 1.9M vs
 *      Scotland's 47k clears and which a genuine tie does not. Because this is
 *      a prior rather than evidence, the result is INTERPRETED, never STATED.
 *   d. NOTHING SEPARATES THEM -> CONTESTED, with every surviving candidate
 *      reported so a consumer can show the ambiguity rather than guess at it.
 *
 * POPULATION DOMINANCE IS DELIBERATELY NOT A TIE-BREAK OF LAST RESORT THAT
 * ALWAYS FIRES. If two candidates are close, the resolver declines. A confident
 * wrong answer about which Perth is worse than an honest "which one?".
 */

/** Longest place name the scanner will assemble from adjacent tokens. */
const MAX_NAME_WORDS = 5;

/**
 * G3 — A DISCARDED SUBDIVISION QUALIFIER IS NOT PERMISSION TO CLAIM THE
 * SOVEREIGN COUNTRY.
 *
 * Ported from the legacy resolver, which established the rule and whose tests
 * still assert it. "Niger State" is a Nigerian subdivision, not sovereign Niger;
 * "Georgia State" is not the country. A scan that gives up the one token proving
 * the place was subnational, then matches the bare head word, routes retrieval
 * into the wrong country feed entirely.
 *
 * The v2 resolver initially lost this guard and the legacy suite caught it. Kept
 * in the same closed-table idiom as the original.
 */
const SUBDIVISION_QUALIFIERS: ReadonlySet<string> = new Set([
  'state',
  'province',
  'region',
  'district',
  'county',
  'prefecture',
  'territory',
  'oblast',
  'voivodeship',
  'canton',
  'emirate',
  'governorate',
  'municipality',
]);

/**
 * A SINGLE-TOKEN place name shorter than this needs corroborating context.
 *
 * MEASURED: 270 settlements in this gazetteer have names of three characters or
 * fewer, and three of them are common function words - "As" (Norway), "Of"
 * (Turkey), "Un" (India). A two-letter token is weak evidence of anything, and
 * the cost of accepting it is a French article resolving to a town in Gujarat,
 * which is exactly what happened before this guard existed.
 *
 * Multi-word names are exempt: "Un" is noise, "Las Vegas" is not.
 */
const MIN_UNCORROBORATED_NAME_LENGTH = 4;

/**
 * How much larger the leading candidate must be before population alone decides.
 *
 * TEN, AND THE NUMBER IS A JUDGEMENT I AM FLAGGING RATHER THAN BURYING. It is
 * chosen so that Perth AU (1,896,548) beats Perth GB (47,180) at 40x, while two
 * comparable cities of the same name do not resolve at all. It is not fitted to
 * live data - there is no live corpus of ambiguous place mentions to fit it to -
 * and it is the one tunable in this module. `geo-resolver.spec.ts` pins both
 * directions so a change to it fails loudly.
 */
export const POPULATION_DOMINANCE_RATIO = 10;

/**
 * PRECISION — THE APPROVED SPATIAL DESIGN VOCABULARY, ADOPTED VERBATIM.
 *
 * Reconciled against the Spatial Intelligence Map specification v1.1, which is
 * authoritative for these names. Two corrections came out of that reconciliation
 * and both are made here:
 *
 *   REGION IS SUPRANATIONAL, NOT SUBNATIONAL. The spec is explicit - "REGION is
 *   SUPRANATIONAL (East Africa, the Baltic region, the Sahel)... Subnational
 *   areas are PROVINCE or DISTRICT - including English usages such as 'the
 *   Western Region of Rwanda', which is PROVINCE." An earlier version of this
 *   resolver used REGION for ISO 3166-2 first-level subdivisions, which is the
 *   opposite direction on the ladder. Those now resolve as PROVINCE, and REGION
 *   is reserved and unproducible, exactly as the M1.0A contract already had it.
 *
 *   NONE IS NOT UNKNOWN. The spec carries eight values and distinguishes them:
 *   UNKNOWN means evidence exists but no geographic level can honestly be
 *   asserted; NONE means there is no evidence at all. The resolver only ever
 *   returns UNKNOWN - NONE is an evidence-layer state, not a resolution outcome,
 *   and emitting it here would be the resolver claiming something about
 *   retrieval that it cannot know.
 *
 * PRODUCIBLE TODAY: COUNTRY, PROVINCE, CITY, UNKNOWN.
 * DECLARED AND UNPRODUCIBLE: EXACT (no provider supplies coordinates for an
 * event), DISTRICT (see DISTRICT_IS_ATTACHED_NOT_RESOLVED), REGION (needs the
 * controlled supranational gazetteer, still empty), NONE (evidence layer).
 */
export type GeoPrecision =
  | 'EXACT'
  | 'CITY'
  | 'SECTOR'
  | 'DISTRICT'
  | 'PROVINCE'
  | 'COUNTRY'
  | 'REGION'
  | 'UNKNOWN'
  | 'NONE';

export type GeoProvenance = 'STATED' | 'INTERPRETED' | 'CONTESTED';

/** The levels this resolver can actually emit. The rest are declared, not claimed. */
export const PRODUCIBLE_GEO_PRECISION: readonly GeoPrecision[] = [
  'COUNTRY',
  'PROVINCE',
  'SECTOR',
  'CITY',
  'UNKNOWN',
];

/**
 * WHY DISTRICT IS ATTACHED TO A CITY RATHER THAN RESOLVED AS A LEVEL.
 *
 * The design spec requires ceiling enforcement IN THE DATA LAYER - "a record
 * without district precision cannot address a district geometry". The safest way
 * to honour that is not to emit DISTRICT precision at all.
 *
 * Two reasons, both measured. First, admin2 LABELS in this gazetteer are derived
 * from a unit's principal settlement and 11 of Rwanda's 21 units have no
 * verified label at all, so resolving BY district name would rest on a name the
 * build itself declines to assert. Second, every verified district label IS a
 * settlement name, so it already resolves at CITY - which is finer, and correct.
 *
 * So a district is reported as an ATTRIBUTE of a CITY resolution
 * (`districtCode`, the join key for external ADM2 geometry) and never as a
 * precision level. A COUNTRY- or PROVINCE-precision record carries no
 * districtCode at all, which is the ceiling rule enforced structurally rather
 * than by convention.
 */
export const DISTRICT_IS_ATTACHED_NOT_RESOLVED = true as const;

export interface ResolvedPlace {
  readonly country: CountryMeta;
  readonly regionName?: string;
  /** ISO 3166-2, e.g. "AU-WA". */
  readonly regionCode?: string;
  readonly cityName?: string;
  /**
   * The alias the text actually used, when it differed from the canonical name.
   * "Munich" for München, "Firenze" for Florence. Audit only - `cityName` is
   * always the canonical spelling.
   */
  readonly matchedAlias?: string;
  /**
   * GeoNames admin2 code, e.g. "PL.72.0201". Present only for settlements in a
   * priority-programme country. THIS IS THE JOIN KEY for external ADM2 geometry.
   */
  readonly districtCode?: string;
  /**
   * Derived from the unit's principal verified settlement, NOT an official
   * district name, and absent when no member could be verified.
   */
  readonly districtLabel?: string;
  readonly districtLabelSource?: 'derived-from-principal-settlement' | 'unavailable';
  readonly population?: number;
  /** [lon, lat] of the settlement itself. Present only at CITY precision. */
  readonly point?: readonly [number, number];
  /**
   * Camera target and extent. At CITY precision this is the point itself; at
   * REGION and COUNTRY it is DERIVED FROM SETTLEMENTS and is explicitly not a
   * boundary - see DerivedExtent.source.
   */
  readonly extent?: DerivedExtent | null;
}

export interface GeoResolution {
  readonly precision: GeoPrecision;
  readonly provenance?: GeoProvenance;
  /** The chosen place. Absent for UNKNOWN and for CONTESTED. */
  readonly place?: ResolvedPlace;
  /** Every surviving candidate. Populated for CONTESTED; single entry otherwise. */
  readonly candidates: readonly ResolvedPlace[];
  /** The exact surface form in the text that produced the match. */
  readonly matchedText?: string;
  /**
   * Present only when the match came through fuzzy typo correction. Carries the
   * correction so a consumer can DISCLOSE it - the spec requires such a record
   * be "drawn and described as unverified", which needs the evidence to say so.
   */
  readonly geoMatch?: GeoFuzzyMatch;
  /** Machine-readable account of how the decision was reached. */
  readonly reason: GeoReason;
  /** Human-readable, diagnostic only. Never rendered. */
  readonly detail: string;
  /**
   * G-GEO-D14-B1-RUNG · MAIN-GEO-D14-1 — WHICH COUNTRY THIS RESOLVER DECLINED.
   *
   * Present only on `ARTICLE_COUNTRY_UNCORROBORATED`. It exists because
   * `precision: 'UNKNOWN'` cannot distinguish two very different facts, and a
   * later producer was reading only the precision:
   *
   *     "there was nothing here"             -> a gap worth filling
   *     "I saw it and deliberately declined" -> an answer, not an absence
   *
   * Main registered that as MAIN-GEO-D14-1. Carrying the DECLINED IDENTITY
   * rather than a bare "was refused" flag is deliberate and measured: a blanket
   * sticky-refusal rule breaks `Guinea Ecuatorial firmó el acuerdo`, where the
   * resolver declined GUINEA and the localized rung legitimately names
   * EQUATORIAL GUINEA — a different country, from a longer surface. The refusal
   * binds the claim that was refused, not the sentence.
   *
   * METADATA ONLY. Nothing reads it inside this resolver; no weight, threshold,
   * tier order or outcome depends on it.
   */
  readonly refusedSurface?: string;
}

export type GeoReason =
  | 'NO_PLACE_EVIDENCE'
  /**
   * The text named a SUPRANATIONAL region - East Africa, the Sahel, the Baltic
   * region. Distinct from NO_PLACE_EVIDENCE, which means no place was named at
   * all. Here a place WAS named and is simply not resolvable: no controlled
   * supranational region gazetteer exists yet, so no bounds can honestly be
   * asserted. A caller that wants to say "I know you mean a region, and I
   * cannot place it" needs this distinction to say it.
   */
  | 'SUPRANATIONAL_NOT_GAZETTEERED'
  /**
   * Article mode matched a COUNTRY or PROVINCE name and nothing corroborated
   * it. Distinct from NO_PLACE_EVIDENCE: a name WAS matched, and this resolver
   * declined it because article-level country is owned by the scored relevance
   * path (scoreCountryRelevance), not by a bare name match in a headline.
   */
  | 'ARTICLE_COUNTRY_UNCORROBORATED'
  | 'CITY_UNIQUE'
  | 'CITY_BY_COUNTRY_CONTEXT'
  | 'CITY_BY_REGION_CONTEXT'
  | 'CITY_BY_POPULATION_DOMINANCE'
  | 'CITY_CONTESTED'
  | 'PROVINCE_UNIQUE'
  | 'PROVINCE_BY_COUNTRY_CONTEXT'
  | 'PROVINCE_CONTESTED'
  | 'COUNTRY_BY_ISO_CODE'
  | 'COUNTRY_BY_FUZZY'
  | 'CITY_BY_FUZZY'
  | 'COUNTRY_ONLY'
  /*
   * G-LANG-FR-3 — the country was named in the EVIDENCE'S OWN LANGUAGE and in
   * no other way this resolver could see. Its own reason code, not folded into
   * COUNTRY_ONLY, so a consumer can always tell an English-surface match from a
   * localized-surface one without inspecting the text.
   */
  | 'COUNTRY_BY_LOCALIZED_NAME';

/**
 * Prepositions that introduce an explicit geographic subject.
 *
 * The same set AnalysisService has always used, for the same reason: Georgia,
 * Turkey, Chad and Jordan are ordinary English words as well as countries, so an
 * ungated scan of every token misroutes prose.
 */
const GEOGRAPHIC_PREPOSITIONS: ReadonlySet<string> = new Set([
  'in',
  'from',
  'about',
  'across',
  'inside',
  'within',
]);

/**
 * Head nouns after which "of" introduces a place - the ALPHA-RC (B) frame,
 * already approved and already shipped in the analysis service. Repeated here
 * because the resolver must gate identically or the two disagree about the same
 * sentence.
 */
/**
 * Conjunctions that join two members of ONE list, so that context established
 * for the first member reaches the second. Deliberately three words: this set
 * only ever widens what the geographic gate admits, so every addition has to
 * earn itself against the false-positive corpus.
 */
const COORDINATING_CONJUNCTIONS: ReadonlySet<string> = new Set(['and', 'or', '&']);

/**
 * Country names that are ALSO ordinary English words or common given names.
 *
 * MEASURED FAILURES THIS EXISTS FOR, all in article mode before the gate:
 *
 *     "Chad missed the bus this morning"          -> Chad (TCD)
 *     "Turkey prices rise ahead of the holiday"   -> Turkey (TUR)
 *     "Republic of Georgia signs new trade deal"  -> Georgia (US state)
 *
 * Deliberately small and deliberately not "every country that could ever be
 * confused". An entry costs a real country a little sensitivity in headlines
 * where nothing corroborates it, so the bar is that the word genuinely appears
 * in ordinary English or as a common personal name.
 *
 * These are folded forms, matching the resolver's own normalisation.
 */
const AMBIGUOUS_COUNTRY_NAMES: ReadonlySet<string> = new Set([
  'chad',
  'turkey',
  'georgia',
  'jordan',
  'niger',
  'mali',
  'guinea',
  'chile',
  'china',
  'india',
  'israel',
  'oman',
  'togo',
  'cuba',
  'malta',
  'monaco',
  'grenada',
  'dominica',
  'jersey',
]);

/**
 * Generic administrative nouns, as they appear BEFORE "of" in a subdivision
 * phrase: "the Western Region OF Rwanda", "the Eastern Province OF Rwanda".
 *
 * They are added to the "of" gate for one narrow purpose - letting the country
 * after "of" count as geographic context - and for no other. Without this,
 * "the Western Region of Rwanda" named no country at all, so the subdivision
 * recovery had nothing to scope itself to and the whole phrase resolved to
 * UNKNOWN. The approved change log names that exact phrase as a case that must
 * work.
 *
 * SAFE BECAUSE THE HEAD IS STILL EXCLUDED. The existing rule that a place name
 * is never followed by "of" is untouched: "Region" itself is not admitted as a
 * place, only the country after it. "The University of Chad" is unaffected -
 * "university" is in neither set.
 */
const ADMINISTRATIVE_HEAD_NOUNS: ReadonlySet<string> = new Set([
  'region',
  'province',
  'district',
  'county',
  'governorate',
  'prefecture',
  'voivodeship',
  'oblast',
  'department',
  'division',
  'territory',
  'municipality',
  'canton',
  'emirate',
  'parish',
]);

const RETRIEVAL_HEAD_NOUNS: ReadonlySet<string> = new Set([
  'analysis',
  'analyses',
  'news',
  'reporting',
  'coverage',
  'situation',
  'developments',
  'overview',
  'summary',
  'picture',
  'state',
  'update',
  'updates',
  'roundup',
  'briefing',
]);

export interface GeoResolveOptions {
  /**
   * G-GEO-D13-B1 — the EVIDENCE's own declared language, when known. Used for
   * one purpose only: to tell whether a fuzzy country correction is
   * contradicted by a country the text actually names. Optional, so every
   * existing caller behaves identically.
   */
  readonly evidenceLanguage?: string;
  /**
   * A country the CALLER already knows, e.g. from a country feed. Used only to
   * break a tie, NEVER to manufacture a location - if the text names no place,
   * the answer is UNKNOWN regardless of what the caller knows. This is the
   * M1.0A rule that retrieval geography must never become article geography.
   */
  readonly contextCountryIso3?: string;
  /**
   * REQUIRE A COUNTRY NAME TO SIT IN EXPLICIT GEOGRAPHIC CONTEXT.
   *
   * THE RESOLVER SERVES TWO CALLERS WITH GENUINELY DIFFERENT NEEDS, and
   * collapsing them is what broke 42 existing tests:
   *
   *   AN ARTICLE (default, false). "Rwanda announced a new trade policy" is a
   *   headline about Rwanda. There is no preposition and none is needed - the
   *   sentence is ABOUT its subject. Gating here would make most headlines
   *   resolve nothing.
   *
   *   A USER QUERY (true). "University of Chad", "the geography of Turkey", "a
   *   report from the Republic of Georgia" name countries that are also ordinary
   *   words, in sentences that are not about those countries. The pipeline has
   *   always required a preposition here, and dropping that requirement made
   *   "Chad" resolve from "University of Chad".
   *
   * Only COUNTRY NAMES are gated. ISO codes stay ungated - an ALL-CAPS code is
   * a low-ambiguity signal that ordinary prose does not produce. Cities stay
   * ungated too, guarded instead by capitalization, length and function words.
   */
  readonly requireGeographicContext?: boolean;
}

function toPlaceFromCity(city: GazetteerCity, matchedAlias?: string): ResolvedPlace | undefined {
  const country = resolveCountryByAnyIdentifier(city.cc);

  if (!country) return undefined;

  const region = regionFor(city.cc, city.a1);
  const district = admin2For(city);
  const point: readonly [number, number] = [city.lon, city.lat];

  return {
    country,
    regionName: region?.n,
    regionCode: region?.iso ?? undefined,
    cityName: city.n,
    matchedAlias,
    districtCode: district?.code,
    districtLabel: district?.label ?? undefined,
    districtLabelSource: district?.labelSource,
    population: city.p ?? undefined,
    point,
    extent: {
      bbox: [city.lon, city.lat, city.lon, city.lat],
      centroid: point,
      members: 1,
      antimeridian: false,
      source: 'settlement-point',
    },
  };
}

function toPlaceFromRegion(region: GazetteerRegion): ResolvedPlace | undefined {
  const country = resolveCountryByAnyIdentifier(region.cc);

  if (!country) return undefined;

  return {
    country,
    regionName: region.n,
    regionCode: region.iso ?? undefined,
    extent: region.ext,
  };
}

export function toPlaceFromCountry(country: CountryMeta): ResolvedPlace {
  return { country, extent: countryExtent(country.iso2) };
}

/**
 * SCANS SUBDIVISIONS AND COUNTRIES TOGETHER, LONGEST-FIRST, CONSUMING POSITIONS.
 *
 * THE DEFECT THIS EXISTS TO PREVENT, MEASURED ON THE REAL CATALOGUE. Five
 * country names are contained inside another country name as whole-word runs:
 *
 *   "Sudan"  inside "South Sudan"
 *   "Guinea" inside "Guinea-Bissau", "Equatorial Guinea", "Papua New Guinea"
 *   "Congo"  inside "DR Congo"
 *
 * An independent scan of every token run therefore reports Guinea for an article
 * about Papua New Guinea, and Congo for one about DR Congo - the second of which
 * lands squarely on the Rwanda/DRC reporting this product already handles.
 *
 * The same containment holds between subdivisions and countries: "Western
 * Australia" contains "Australia", so a naive country scan reads a subdivision
 * mention as a country mention and the finer evidence is thrown away.
 *
 * So the two tiers are scanned in ONE pass, longest run first, and every matched
 * run CONSUMES its token positions. "Western Australia" is taken as a
 * subdivision and "Australia" is then no longer available; "Papua New Guinea" is
 * taken whole and "Guinea" never fires.
 *
 * CITIES ARE SCANNED SEPARATELY AND DELIBERATELY DO NOT PARTICIPATE. A city and
 * its subdivision legitimately share a name - Kigali the city sits in Kigali the
 * province, Shanghai in Shanghai - and consuming the city's tokens would destroy
 * the finer of two true answers.
 */
interface PlaceScan {
  readonly regions: readonly GazetteerRegion[];
  readonly regionText?: string;
  readonly countries: readonly CountryMeta[];
}

/**
 * Builds the geographic-context predicate for a query.
 *
 * EXTRACTED SO CITIES ARE GATED BY THE SAME RULE AS COUNTRIES, which they were
 * not at first - and the corpus punished it immediately. There are real United
 * States settlements named "University", "Republic" and "Poland", so gating only
 * country names turned "the University of Chad" into a city in the USA. Any gate
 * applied to one tier and not the other just moves the false positive.
 */
function buildContextPredicate(
  tokens: readonly string[],
  segStarts: readonly boolean[],
): (start: number, words: number) => boolean {
  const wholeQuery = tokens.join(' ');
  /*
   * "PLACE, QUALIFIER" IS ITSELF GEOGRAPHIC CONTEXT.
   *
   * "Musanze, Rwanda" and "Washington DC, United States" are the standard way a
   * place is written, and the place sits in the FIRST segment - which the
   * sentence-initial rule would otherwise refuse. When a query has more than one
   * comma segment, every segment start counts; when it has one, only the whole
   * query does, so "Chad missed the bus this morning" stays out.
   */
  const multiSegment = segStarts.filter(Boolean).length > 1;

  return (start: number, words: number): boolean => {
    if (tokens.slice(start, start + words).join(' ') === wholeQuery) return true;

    /*
     * Segment membership is checked FIRST. An earlier ordering returned on
     * "nothing before it" and never reached this, so "Musanze, Rwanda" lost its
     * city - the place sits in the first segment, which has no preceding token.
     */
    if (segStarts[start] === true && (start > 0 || multiSegment)) return true;

    const before = tokens[start - 1];

    /*
     * SENTENCE-INITIAL IS NOT GEOGRAPHIC CONTEXT IN QUERY MODE. "Chad missed the
     * bus this morning" opens with a country name and is not about Chad. An
     * earlier version treated "nothing before it" as context and routed that
     * question into the Chadian country feed. Only the WHOLE query counts (above),
     * or the multi-segment "place, qualifier" form (immediately above).
     */
    /*
     * "RWANDA NEWS TODAY" - A PLACE FOLLOWED BY A RETRIEVAL HEAD NOUN.
     *
     * The mirror image of the "news OF Rwanda" rule immediately above, and it
     * is the commoner English form by some distance: readers type "Rwanda news",
     * "Poland analysis", "Kenya update". Before this, all three opened their
     * sentence and were refused by the sentence-initial rule - the rule that
     * exists to stop "Chad missed the bus this morning" from routing into the
     * Chadian feed.
     *
     * "Chad missed the bus" stays refused, because "missed" is not a retrieval
     * head noun and the set is closed. The head noun is doing the same work here
     * that a preposition does elsewhere: it declares the phrase to be ABOUT the
     * place rather than merely containing its name.
     */
    if (RETRIEVAL_HEAD_NOUNS.has(tokens[start + words] ?? '')) return true;

    if (before === undefined) return false;

    if (GEOGRAPHIC_PREPOSITIONS.has(before)) return true;
    if (before === 'the' && GEOGRAPHIC_PREPOSITIONS.has(tokens[start - 2] ?? '')) return true;
    if (
      before === 'of' &&
      (RETRIEVAL_HEAD_NOUNS.has(tokens[start - 2] ?? '') ||
        ADMINISTRATIVE_HEAD_NOUNS.has(tokens[start - 2] ?? ''))
    ) {
      return true;
    }

    /*
     * A COORDINATED PLACE INHERITS ITS PARTNER'S CONTEXT.
     *
     * "What is happening in East Africa and Rwanda?" - Rwanda follows "and",
     * not a preposition, so the gate refused it and the whole question resolved
     * to nothing. The second member of a coordination is exactly as geographic
     * as the first; "in X and Y" means in X and in Y, and English simply does
     * not repeat the preposition.
     *
     * BOUNDED THREE WAYS, because widening this gate is how false positives got
     * in before:
     *
     *   1. Only a coordinating conjunction counts - "and", "or", "&". Not
     *      commas, which the segment rule already handles, and not "then" or
     *      "with", which coordinate events rather than places.
     *   2. A GEOGRAPHIC PREPOSITION MUST ALREADY HAVE OCCURRED EARLIER IN THE
     *      SAME SEGMENT. Without that, "compare Rwanda and Kenya" would open the
     *      gate on a bare list, and so would "he met Georgia and left" - the
     *      coordination inherits context, it cannot manufacture it.
     *   3. The preposition must be BEFORE this run, not anywhere in the text, so
     *      a later clause cannot reach backwards to license an earlier word.
     */
    if (COORDINATING_CONJUNCTIONS.has(before)) {
      for (let index = start - 2; index >= 0; index -= 1) {
        if (segStarts[index + 1] === true) break;
        if (GEOGRAPHIC_PREPOSITIONS.has(tokens[index] ?? '')) return true;
      }
    }

    /*
     * A LATER COMMA SEGMENT IS GEOGRAPHIC CONTEXT BY CONVENTION.
     *
     * "Musanze, Rwanda" and "Washington DC, United States" are the standard way
     * a place is qualified, and neither carries a preposition. Requiring one
     * additionally lost both - which the GEO-PRECISION-1 matrix caught.
     *
     * Only a LATER segment counts. The first segment of a bare sentence is the
     * sentence-initial case refused above, so "Chad missed the bus this morning"
     * stays out.
     */
    return false;
  };
}

function scanRegionsAndCountries(
  tokens: readonly string[],
  casing: readonly boolean[],
  maxRegionWords: number,
  rawTokens: readonly string[],
  requireGeographicContext: boolean,
  segStarts: readonly boolean[],
): PlaceScan {
  const hasGeographicContext = buildContextPredicate(tokens, segStarts);
  /*
   * ALIASES AND CODES COME FROM THE EXISTING SHARED RESOLVER, NOT A SECOND LIST.
   *
   * An earlier v2 indexed only `country.name`, which silently dropped every
   * alias and every ISO code the product already supported - "Britain" stopped
   * resolving to the United Kingdom, and "is USA under pressure of war?" stopped
   * resolving at all. Both were caught by the legacy suite.
   *
   * resolveCountryByAnyIdentifier already accepts names, aliases, ISO2, ISO3 and
   * numeric codes, and is the pipeline's single answer to "is this a country".
   * Using it here means the two can never diverge.
   */
  const resolveCountryRun = (folded: string): CountryMeta | undefined => {
    if (folded.length < 2) return undefined;

    return resolveCountryByAnyIdentifier(folded);
  };

  const runs = [...candidateRuns(tokens, MAX_NAME_WORDS)].sort(
    (a, b) => b.words - a.words || a.start - b.start,
  );

  const consumed = new Array<boolean>(tokens.length).fill(false);
  const regions: GazetteerRegion[] = [];
  const countries = new Map<string, CountryMeta>();
  let regionText: string | undefined;

  for (const run of runs) {
    let overlaps = false;

    for (let i = run.start; i < run.start + run.words; i += 1) {
      if (consumed[i]) {
        overlaps = true;
        break;
      }
    }

    if (overlaps || !isAdmissibleRun(run, casing, !requireGeographicContext, rawTokens)) continue;

    /*
     * The same "a place name is not followed by 'of'" rule the city gate applies.
     * Without it "the Republic of Georgia" matched Georgia the US state as a
     * subdivision, having just been stopped from matching it as a city.
     */
    if (requireGeographicContext && tokens[run.start + run.words] === 'of') continue;

    const take = (): void => {
      for (let i = run.start; i < run.start + run.words; i += 1) consumed[i] = true;
    };

    if (run.words <= maxRegionWords) {
      /*
       * SUBDIVISIONS ARE GATED EXACTLY LIKE COUNTRIES IN QUERY MODE.
       *
       * Gating only countries moved the false positive down a tier rather than
       * removing it: "the Republic of Georgia" stopped resolving Georgia the
       * country and started resolving Georgia the US state as a subdivision.
       */
      const gated = requireGeographicContext && !hasGeographicContext(run.start, run.words);
      const matched = gated ? [] : regionsNamed(run.text);

      if (matched.length > 0) {
        for (const region of matched) if (!regions.includes(region)) regions.push(region);

        regionText ??= run.text;
        take();
        continue;
      }
    }

    /*
     * G3 GUARD. If the token immediately after this run is a subdivision
     * qualifier, the run is the head of a SUBNATIONAL name - "Niger State",
     * "Georgia State" - and must not be accepted as the sovereign country.
     */
    const nextToken = tokens[run.start + run.words];

    if (nextToken !== undefined && SUBDIVISION_QUALIFIERS.has(nextToken)) {
      take();
      continue;
    }

    if (requireGeographicContext && !hasGeographicContext(run.start, run.words)) continue;

    const country = resolveCountryRun(run.text);

    if (country) {
      countries.set(country.iso3, country);
      take();
    }
  }

  /*
   * ALL-CAPS ISO CODE SCAN, ON THE RAW TOKENS.
   *
   * "is USA under pressure of war?" carries no country NAME and no preposition.
   * The legacy resolver accepted a standalone ALL-CAPS 2-3 letter token as a
   * country because ordinary prose essentially never spells a common word in
   * full caps mid-sentence - a low-ambiguity signal that country names, being
   * ordinary words, do not get.
   *
   * It runs on rawTokens because folding lowercases everything and destroys the
   * only thing that makes this safe.
   */
  for (let i = 0; i < rawTokens.length; i += 1) {
    const raw = rawTokens[i];

    if (raw.length < 2 || raw.length > 3) continue;
    if (raw !== raw.toUpperCase() || raw === raw.toLowerCase()) continue;
    if (!ALL_ISO3_CODES.includes(raw) && !/^[A-Z]{2,3}$/.test(raw)) continue;

    const country = resolveCountryByAnyIdentifier(raw);

    if (country) countries.set(country.iso3, country);
  }

  return { regions, regionText, countries: [...countries.values()] };
}

interface Match<T> {
  readonly entries: readonly T[];
  readonly text: string;
  readonly words: number;
}

/**
 * Is this token run admissible as a place mention at all?
 *
 * TWO GUARDS, BOTH MEASURED INTO EXISTENCE BY A REAL FALSE POSITIVE:
 *
 *   CASE. A place name is capitalized; an ordinary word mid-sentence is not.
 *   Folding destroys that signal, so it is captured before folding and required
 *   here. Caseless scripts are exempt - see tokenCasing().
 *
 *   LENGTH AND FUNCTION WORDS. A single short token, or a single token that is
 *   an ordinary function word, is not evidence of a place.
 *
 * KNOWN RESIDUE, STATED RATHER THAN OVER-ENGINEERED: a SENTENCE-INITIAL common
 * noun that is also a settlement - "Nice weather today", "Reading is down" -
 * still passes both guards, because sentence-initial capitalization carries no
 * information. Distinguishing those needs part-of-speech evidence, which is a
 * different kind of machinery than a gazetteer. It is reported in the handoff.
 */
function isAdmissibleRun(
  run: { text: string; start: number; words: number },
  casing: readonly boolean[],
  requireCasing: boolean,
  raw: readonly string[] = [],
): boolean {
  /*
   * AN ALL-CAPS TOKEN IS AN ACRONYM, NOT A SETTLEMENT.
   *
   * MEASURED: "What are the most important developments in NATO right now?"
   * resolved to Nato, Bicol Region, Philippines - a village of 5,583 people -
   * because a 48,702-settlement gazetteer contains it and "in" supplied the
   * geographic context. The legacy resolver never hit this because its curated
   * table held two dozen cities.
   *
   * Ordinary prose does not spell a place name in full caps, and the codebase
   * already relies on that asymmetry in the opposite direction: an ALL-CAPS
   * 2-3 letter token is accepted UNGATED as an ISO country code. The same signal
   * that makes "USA" a country makes "NATO" not a village.
   *
   * ISO codes are exempt, because that is exactly what the country tier wants.
   */
  const rawToken = raw[run.start];

  if (
    run.words === 1 &&
    rawToken !== undefined &&
    rawToken.length >= 3 &&
    rawToken === rawToken.toUpperCase() &&
    rawToken !== rawToken.toLowerCase() &&
    !ALL_ISO3_CODES.includes(rawToken)
  ) {
    return false;
  }
  /*
   * CASE IS EVIDENCE IN AN ARTICLE AND NOISE IN A QUERY.
   *
   * Prose capitalises its place names, so requiring case is what stops
   * "reading", "nice" and "mobile" resolving mid-sentence in a headline.
   *
   * A USER TYPING A QUESTION DOES NOT CAPITALISE. "what;s happening in kigali?"
   * is a real query from the existing test corpus, and requiring case refused it
   * - the legacy resolver had no such guard and resolved it fine. In query mode
   * the geographic-context gate already does this job, and does it better: it
   * demands a preposition, which "the reading was nice on mobile" does not have.
   */
  if (requireCasing && casing[run.start] === false) return false;

  if (run.words === 1) {
    if (run.text.length < MIN_UNCORROBORATED_NAME_LENGTH) return false;
    if (isRoutingFunctionWord(run.text)) return false;
  }

  return true;
}

/** Longest run wins, so "New York City" is preferred over "New York". */
function longestMatch<T>(
  tokens: readonly string[],
  casing: readonly boolean[],
  maxWords: number,
  lookup: (folded: string) => readonly T[],
  inContext?: (start: number, words: number) => boolean,
  requireCasing = true,
  raw: readonly string[] = [],
): Match<T> | undefined {
  const runs = [...candidateRuns(tokens, Math.min(maxWords, MAX_NAME_WORDS))].sort(
    (a, b) => b.words - a.words || a.start - b.start,
  );

  for (const run of runs) {
    if (!isAdmissibleRun(run, casing, requireCasing, raw)) continue;
    if (inContext && !inContext(run.start, run.words)) continue;

    const entries = lookup(run.text);

    if (entries.length > 0) {
      return { entries, text: run.text, words: run.words };
    }
  }

  return undefined;
}

/**
 * Merges canonical and alias candidate sets for the same surface form.
 *
 * When both indexes matched the SAME text the two candidate lists are unioned.
 * When they matched different text the LONGER run wins, on the same
 * longest-match principle that makes "New York City" beat "New York".
 */
function mergeCityMatches(
  canonical: Match<GazetteerCity> | undefined,
  alias: Match<GazetteerCity> | undefined,
): Match<GazetteerCity> | undefined {
  if (!canonical) return alias;
  if (!alias) return canonical;

  if (canonical.text !== alias.text) {
    return alias.words > canonical.words ? alias : canonical;
  }

  const seen = new Set(canonical.entries);
  const merged = [...canonical.entries];

  for (const city of alias.entries) {
    if (!seen.has(city)) merged.push(city);
  }

  return { entries: merged, text: canonical.text, words: canonical.words };
}

/**
 * Single-token fuzzy correction against the existing shared typo resolver.
 *
 * Returns CITY or COUNTRY precision with INTERPRETED provenance, and carries the
 * correction on `geoMatch` so a consumer can disclose it rather than present a
 * guess as a fact.
 */
/**
 * G-GEO-D13-B1 — does the text name a country, in its own language, OTHER than
 * the one this fuzzy correction produced?
 *
 * Returns false whenever nothing can be compared — no language declared, or no
 * localized country name present. Fuzzy is then left exactly as it was, which
 * is the property that keeps the 128 correct fuzzy resolutions alive.
 */
function contradictsNamedCountry(
  rawText: string,
  evidenceLanguage: string | undefined,
  correctedIso3: string,
): boolean {
  if (!evidenceLanguage) return false;

  const named = localizedCountriesNamedIn(rawText, evidenceLanguage);

  if (named.length === 0) return false;

  return !named.some((entry) => entry.country.iso3 === correctedIso3);
}

function resolveFuzzy(
  tokens: readonly string[],
  casing: readonly boolean[],
  restrictToCountryIso2?: string,
  requireCasing = true,
  inContext?: (start: number, words: number) => boolean,
  rawTextForFuzzy = '',
  evidenceLanguage?: string,
): GeoResolution | undefined {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (requireCasing && casing[i] === false) continue;

    /*
     * FUZZY IS GATED BY GEOGRAPHIC CONTEXT TOO, IN QUERY MODE.
     *
     * MEASURED: "Porównaj Nigerię, Kenię, Rwandę i Ugandę" - Polish for "compare
     * Nigeria, Kenya, Rwanda and Uganda" - had "Nigerię" fuzzy-corrected to
     * Nigeria and routed straight into the Nigerian country feed, silently
     * answering a quarter of a four-way comparison. The legacy resolver never
     * reached fuzzy for that shape because it required a prepositional phrase
     * first. Correcting a spelling is an interpretation, and an interpretation
     * with no geographic context behind it is a guess.
     */
    if (inContext && !inContext(i, 1)) continue;
    if (token.length < MIN_UNCORROBORATED_NAME_LENGTH) continue;
    if (isRoutingFunctionWord(token)) continue;

    let match: GeoFuzzyMatch | undefined;

    try {
      match = resolveGeoTypo(token);
    } catch {
      continue;
    }

    if (!match) continue;

    const canonical = match.canonicalLocation;

    if (match.matchKind === 'city') {
      const cities = citiesNamed(foldPlaceName(canonical)).filter(
        (candidate) =>
          restrictToCountryIso2 === undefined || candidate.cc === restrictToCountryIso2,
      );
      const city = [...cities].sort((a, b) => (b.p ?? -1) - (a.p ?? -1))[0];
      const place = city ? toPlaceFromCity(city) : undefined;

      if (place) {
        return {
          precision: 'CITY',
          // Never STATED - the text did not say this. See the spec quote above.
          provenance: 'INTERPRETED',
          place,
          candidates: [place],
          matchedText: token,
          geoMatch: match,
          reason: 'CITY_BY_FUZZY',
          detail: `"${token}" corrected to "${canonical}" by the shared typo resolver`,
        };
      }
    }

    /*
     * When the caller restricted us to one country, a fuzzy COUNTRY correction
     * is not what was asked for - the country is already known. Refusing here is
     * what makes "a fuzzy city correction is refused when it does not belong to
     * the explicit country" hold.
     */
    if (restrictToCountryIso2 !== undefined) continue;

    const country = resolveCountryByAnyIdentifier(canonical);

    if (country) {
      /*
       * ═══════════════════════════════════════════════════════════════════
       * G-GEO-D13-B1 — A CORRECTION THE TEXT CONTRADICTS IS NOT A RESOLUTION.
       * ═══════════════════════════════════════════════════════════════════
       *
       * BINDING POLICY: "fuzzy matching may assist recognition, but it may not
       * create a confident geographic resolution where stronger geographic
       * evidence is absent or contradictory."
       *
       * THE SIX MEASURED F5 CASES. Every one corrects ONE TOKEN out of a longer
       * country name into an UNRELATED country:
       *
       *   "Soudan du Sud"                 soudan   -> Sudan     (text names South Sudan)
       *   "Guinee equatoriale"            guinee   -> Guinea    (text names Equatorial Guinea)
       *   "Papouasie-Nouvelle-Guinee"     guinee   -> Guinea    (text names Papua New Guinea)
       *   "Gwinea Rownikowa"              gwinea   -> Guinea    (text names Equatorial Guinea)
       *   "Jamhuri ya Dominika"           dominika -> Dominica  (text names Dominican Republic)
       *   "Demokratyczna Republika Konga" konga    -> TONGA     (text names DR Congo)
       *
       * The last is the whole argument in one line: a DR Congo article put a
       * marker on Tonga.
       *
       * ─────────────────────────────────────────────────────────────────
       * WHY *CONTRADICTION* AND NOT *CORROBORATION*. I MEASURED BOTH.
       * ─────────────────────────────────────────────────────────────────
       *
       * My first implementation required POSITIVE corroboration before any
       * fuzzy country correction could stand. It fixed all six — and the replay
       * caught what it cost: on the population where no evidence language is
       * declared, it turned **128 previously CORRECT country resolutions into
       * UNKNOWN**. "Argentine", "Colombie", "Kenia", "Japonia" and 124 others
       * were being resolved BY FUZZY, one edit away from their English
       * spelling, and a corroboration gate silently deletes all of them.
       *
       * That is precisely the failure the acceptance criteria name: a reduction
       * in wrong answers is not sufficient if correct answers disappear
       * materially. So the corroboration gate was withdrawn, not shipped.
       *
       * What ships is the narrower half of the same policy clause. The text
       * itself already names a country — in its own language — whenever the
       * evidence language is known. If that name identifies a DIFFERENT country
       * from the one fuzzy invented, the correction is not merely
       * uncorroborated, it is CONTRADICTED, and the policy forbids exactly
       * that. Where the text names no country, or names the same one, fuzzy is
       * left alone — which is why the 128 survive untouched.
       *
       * NO CONTAINMENT RULE, NO TIER-ORDER CHANGE, NO COUNTRY-ALWAYS-WINS, NO
       * CITY-TABLE CHANGE, NO LANGUAGE-SPECIFIC RULE. The comparison uses the
       * generic localized-country index already shipped by G-LANG-FR-3, which
       * writes down no name in any language.
       *
       * CITY FUZZY IS UNTOUCHED — the approved Spatial spec requires
       * "Kigalli" -> Kigali verbatim, and the city branch returns above.
       */
      const contradicted = contradictsNamedCountry(rawTextForFuzzy, evidenceLanguage, country.iso3);

      if (contradicted) continue;

      const place = toPlaceFromCountry(country);

      return {
        precision: 'COUNTRY',
        provenance: 'INTERPRETED',
        place,
        candidates: [place],
        matchedText: token,
        geoMatch: match,
        reason: 'COUNTRY_BY_FUZZY',
        detail: `"${token}" corrected to "${canonical}" by the shared typo resolver`,
      };
    }
  }

  return undefined;
}

/**
 * THE RESOLVER.
 *
 * Pure. No I/O beyond the one-time gazetteer load, no clock, no network. Given
 * the same text it returns the same answer for ever, which is what lets its
 * output be cached, compared and audited.
 */
export function resolveGeography(rawText: string, options: GeoResolveOptions = {}): GeoResolution {
  /*
   * SUPRANATIONAL PHRASES ARE MASKED BEFORE ANYTHING ELSE RUNS.
   *
   * MEASURED, BEFORE THIS: resolveGeography('unrest in East Africa') returned
   * precision PROVINCE, provenance CONTESTED, candidates [East Region
   * (Cameroon), Eastern Region (Iceland)]. No index holds "east africa", so the
   * scanner fell back to the shorter run "east" - which genuinely is an alias
   * for those two subdivisions - and answered a question nobody asked.
   *
   * A supranational region is not a coarse subnational one. Matching a PREFIX
   * of "East Africa" against a SUBNATIONAL index is a category error, and the
   * approved specification already rules on the outcome: a region with no
   * gazetteer entry "degrades to UNKNOWN rather than to an invented radius".
   * That gazetteer does not exist yet. So the phrase is removed from the text
   * before any scan sees it, and if it was the only place evidence the answer
   * is UNKNOWN - stated with its own reason, so a caller can tell "I do not
   * know where that is" from "there was no place here at all".
   *
   * The mask is LENGTH-PRESERVING. Four tokenizers run over this text and every
   * downstream rule indexes across them by position; deleting characters would
   * desynchronise them, which is the bug class that made "Washington, D.C."
   * unreachable until the tokenizers were made to agree.
   */
  const supranationalSpans = findSupranationalSpans(rawText ?? '');
  const text = maskSupranationalSpans(rawText ?? '', supranationalSpans);

  const supranationalRefusal = (): GeoResolution => ({
    precision: 'UNKNOWN',
    candidates: [],
    matchedText: supranationalSpans.map((span) => span.phrase).join(', '),
    reason: 'SUPRANATIONAL_NOT_GAZETTEERED',
    detail:
      `"${supranationalSpans.map((span) => span.phrase).join('", "')}" names a supranational ` +
      'region. No controlled supranational region gazetteer exists yet, so no bounds can be ' +
      'asserted, and a region with no gazetteer entry degrades to UNKNOWN rather than to an ' +
      'invented extent.',
  });

  const tokens = foldTokens(text);

  if (tokens.length === 0) {
    return supranationalSpans.length > 0
      ? supranationalRefusal()
      : {
          precision: 'UNKNOWN',
          candidates: [],
          reason: 'NO_PLACE_EVIDENCE',
          detail: 'no text',
        };
  }

  const casing = tokenCasing(text);
  const limits = maxNameWords();
  const raw = splitRawTokens(text);
  const scan = scanRegionsAndCountries(
    tokens,
    casing,
    limits.region,
    raw,
    options.requireGeographicContext === true,
    segmentStarts(text),
  );
  const namedCountries = scan.countries;
  const contextCountry = options.contextCountryIso3
    ? resolveCountryByAnyIdentifier(options.contextCountryIso3)
    : undefined;

  /*
   * ALIAS AND CANONICAL CANDIDATES ARE MERGED, THEN DISAMBIGUATED TOGETHER.
   *
   * An earlier version preferred canonical matches and consulted the alias index
   * only when nothing canonical matched. MEASURED, that resolved "Cologne" to a
   * comune in Italy of 7,032 people rather than Köln, because "Cologne" happens
   * to be a canonical gazetteer name in Italy. Preferring one index over the
   * other answers the wrong question: both are real candidates, and the existing
   * disambiguation - country context, region context, then population dominance
   * - is exactly the machinery for choosing between them.
   *
   * THE COROLLARY IS A RULE FOR THE ALIAS TABLE ITSELF: an exonym that is
   * archaic AND shadows a real place must not be in it, because merging will let
   * population carry it. 'Peking' and 'Canton' were removed for precisely that -
   * see scripts/exonyms.mjs.
   */
  /**
   * QUERY-MODE CITY GATE. Context, plus two rules that only a 48,702-settlement
   * gazetteer needs - both measured into existence, neither guessable.
   *
   * RULE 1 - A PLACE NAME IS NOT FOLLOWED BY "of". There are real United States
   * settlements named "University" and "Republic", so "the University of Chad"
   * and "the Republic of Georgia" resolved to towns in America. The token before
   * an "of" is the head of a noun phrase, not the place the phrase is about. The
   * legacy resolver never hit this because its curated table held two dozen
   * cities; it is the price of real coverage, and this is the payment.
   *
   * RULE 2 lives below in the country-preference check.
   */
  const contextGate = buildContextPredicate(tokens, segmentStarts(text));

  /**
   * TITLE CASE DEFEATS THE CASING GATE, AND THE GATE CANNOT TELL.
   *
   * Article mode's premise is that CAPITALISATION IS EVIDENCE: prose capitalises
   * proper nouns, so a capitalised token is probably a name. Headlines routinely
   * break that premise by capitalising EVERY word, at which point the gate is
   * measuring nothing and admits any common noun that happens to be a
   * settlement somewhere.
   *
   * MEASURED, on a real provider-shaped headline:
   *
   *     "Turkey Prices Rise Ahead Of The Holiday"  ->  HOLIDAY, FLORIDA
   *
   * An article about the price of turkeys, placed in Florida, because "Holiday"
   * was capitalised and Holiday, FL exists.
   *
   * SO THE PREMISE IS TESTED RATHER THAN ASSUMED. When most words are
   * capitalised, the text is Title Case, capitalisation carries no signal, and a
   * bare capitalised token is no longer sufficient on its own - the run must
   * ALSO sit behind a geographic preposition or in a qualifying comma segment,
   * which is the evidence query mode requires. "Kigali Hosts Regional Summit"
   * still resolves, because Kigali is not an English word and reaches the city
   * tier by name; "The Holiday" does not, because nothing places it.
   *
   * THE THRESHOLD IS MEASURED, NOT CHOSEN BY TASTE. Ordinary sentence-case prose
   * capitalises its first word plus proper nouns - well under half the tokens.
   * Title Case capitalises nearly all of them, skipping only short function
   * words. 0.7 sits between the two with room on both sides, and the check
   * requires at least four words so a three-word fragment cannot trip it.
   */
  const titleCased = ((): boolean => {
    const words = casing.filter((_flag, index) => (tokens[index] ?? '').length > 0);

    if (words.length < 4) return false;

    return casing.filter(Boolean).length / words.length >= 0.7;
  })();

  /*
   * THE "of" RULE RUNS IN BOTH MODES, AND AN EARLIER VERSION HAD IT IN ONE.
   *
   * "A place name is not followed by 'of'" is a fact about NOUN-PHRASE
   * STRUCTURE, not about geographic context: the token before an "of" is the
   * head of a phrase, not the place the phrase is about. Building it into the
   * query-only gate meant article mode never applied it, and MEASURED, article
   * mode resolved "The University of Chad announces new courses" to
   * University, USA - a real settlement of that name, reached by exactly the
   * defect this rule exists to close.
   *
   * So the rule is now unconditional and the CONTEXT requirement is what stays
   * query-only. Two different rules that had been sharing one gate.
   */
  const notFollowedByOf = (start: number, words: number): boolean => tokens[start + words] !== 'of';

  const cityGate =
    options.requireGeographicContext === true || titleCased
      ? (start: number, words: number): boolean =>
          contextGate(start, words) && notFollowedByOf(start, words)
      : notFollowedByOf;

  const requireCasing = options.requireGeographicContext !== true;

  const canonicalMatch = longestMatch(
    tokens,
    casing,
    limits.city,
    citiesNamed,
    cityGate,
    requireCasing,
    raw,
  );
  const aliasMatch = longestMatch(
    tokens,
    casing,
    limits.exonym,
    citiesByExonym,
    cityGate,
    requireCasing,
    raw,
  );

  let cityMatch = mergeCityMatches(canonicalMatch, aliasMatch);

  /*
   * RULE 2 - A COUNTRY NAME OUTRANKS A SAME-NAMED FOREIGN CITY.
   *
   * "Explain the situation of Poland" resolved to Poland, Ohio, because the city
   * tier runs first and a US settlement of that name exists. When the matched
   * token IS a country name and nothing in the text corroborates the city's own
   * country, the country is what the sentence means. Corroboration still wins:
   * "Poland, Ohio" names the region and keeps the city.
   *
   * APPLIED IN BOTH MODES, AND AN EARLIER VERSION SAID QUERY-ONLY. The claim was
   * that "articles reach the same answer through the country tier without
   * needing the city suppressed". MEASURED AGAINST REAL HEADLINES, THAT IS
   * FALSE - the city tier runs FIRST and returns before the country tier is
   * ever consulted:
   *
   *     "Poland Approves New Energy Bill"  ->  Poland, OHIO
   *
   * A story about the country placed in the United States. This is a rule about
   * PRECEDENCE between two readings of one token, not about geographic context,
   * so it belongs in both modes - the same correction the "of" rule needed.
   */
  if (cityMatch) {
    const asCountry = resolveCountryByAnyIdentifier(cityMatch.text);

    if (asCountry) {
      const corroborated = cityMatch.entries.some(
        (city) =>
          scan.countries.some((country) => country.iso2 === city.cc) ||
          scan.regions.some((region) => region.cc === city.cc),
      );

      if (!corroborated) cityMatch = undefined;
    }
  }
  const regionMatch =
    scan.regions.length > 0
      ? { entries: scan.regions, text: scan.regionText ?? '', words: 0 }
      : undefined;

  /* ── ARTICLE-MODE CORROBORATION FOR COUNTRY-LEVEL CLAIMS ─────────────────
   *
   * THE DEFECT THIS CLOSES, MEASURED:
   *
   *     article mode, "Turkey prices rise ahead of the holiday"
   *       -> COUNTRY / STATED / Turkey (TUR)
   *     article mode, "Chad missed the bus this morning"
   *       -> COUNTRY / STATED / Chad (TCD)
   *
   * Article mode requires CAPITALISATION rather than a preposition, which is
   * the right trade for city names in prose - it is what makes "Goma residents
   * flee" resolve. It is the wrong trade for country names that are also
   * ordinary English words, because a headline capitalises its first word
   * whatever that word is.
   *
   * WHY THE ANSWER IS NOT A LIST OF AMBIGUOUS COUNTRY NAMES. This product
   * ALREADY has an accepted, scored, threshold-gated mechanism for deciding an
   * article's country: scoreCountryRelevance, at >= 35, where a title mention
   * scores 60 and an article with no topical signal scores 15 and is refused.
   * That is the intended article-level country path and it is already wired to
   * NewsArticle.countryCode.
   *
   * A SECOND, UNSCORED PATH THAT FIRES ON "Turkey prices rise" IS STRICTLY
   * WORSE THAN THE ONE THAT EXISTS. So this resolver stops competing for that
   * claim: in article mode it asserts COUNTRY or PROVINCE only when something
   * corroborates it, and the caller's contextCountryIso3 - which
   * toEvidenceSourceCard populates from the SCORED countryCode - is exactly
   * that corroboration.
   *
   * WHAT IS UNAFFECTED: city and settlement resolution, which is what the
   * gazetteer adds and what the Spatial overlay needs. Goma, Musanze and
   * Rubavu are cities and never reach this gate.
   */
  const articleModeCorroborates = (countryIso2: string, foldedName: string): boolean => {
    if (options.requireGeographicContext === true) return true;

    /*
     * ONLY THE GENUINELY AMBIGUOUS NAMES ARE GATED, and the first version of
     * this gate was wrong about that.
     *
     * It refused EVERY uncorroborated article-mode country, and the existing
     * corpus caught it immediately: "Papua New Guinea reported a landslide",
     * "South Sudan signed the agreement" and "Equatorial Guinea announced the
     * budget" all stopped resolving. Those are not ambiguous - no English
     * sentence contains "Papua New Guinea" by accident - and refusing them
     * threw away real signal to fix a problem they do not have.
     *
     * The problem is specifically a country name that is ALSO an ordinary
     * English word or a common given name, capitalised at the head of a
     * headline where every first word is capitalised. That set is small,
     * closed, and already named in this file's own query-mode comment: "a
     * country name that is also an ordinary word - Chad, Georgia, Turkey,
     * Jordan".
     *
     * This is a DISAMBIGUATION list, of the same kind as SUBDIVISION_QUALIFIERS
     * above - not a curated table standing in for the gazetteer. Every country
     * still resolves by name; these few additionally require something to
     * corroborate them when the only evidence is a capitalised word in prose.
     */
    if (!AMBIGUOUS_COUNTRY_NAMES.has(foldedName)) return true;

    // The caller already knows the country - typically from the scored path.
    if (contextCountry?.iso2 === countryIso2) return true;

    /*
     * Or the text puts it behind an EXPLICIT GEOGRAPHIC PREPOSITION - "unrest in
     * Chad", "reporting from Turkey".
     *
     * DELIBERATELY STRICTER THAN `contextGate`, AND AN EARLIER VERSION REUSED
     * THAT AND WAS WRONG. `contextGate` also accepts a comma-segment start,
     * which exists for the "Musanze, Rwanda" form - but an article is TITLE plus
     * SUMMARY, so it always has several segments and every sentence-initial
     * token qualified. Measured:
     *
     *     "Turkey Prices Rise Ahead Of The Holiday. Retailers reported
     *      higher demand."   ->   TURKEY (the country)
     *
     * An article about the price of birds, filed to Ankara, because "Turkey"
     * started a sentence. A preposition is a positive statement that what
     * follows is a place; a sentence boundary is not a statement about anything.
     */
    const words = foldedName.split(' ');

    for (let start = 0; start + words.length <= tokens.length; start += 1) {
      if (tokens.slice(start, start + words.length).join(' ') !== foldedName) continue;

      const before = tokens[start - 1];

      if (before !== undefined && GEOGRAPHIC_PREPOSITIONS.has(before)) return true;
      if (before === 'the' && GEOGRAPHIC_PREPOSITIONS.has(tokens[start - 2] ?? '')) {
        return true;
      }
    }

    return false;
  };

  const uncorroboratedArticleCountry = (
    detail: string,
    refusedSurface?: string,
  ): GeoResolution => ({
    precision: 'UNKNOWN',
    candidates: [],
    reason: 'ARTICLE_COUNTRY_UNCORROBORATED',
    detail,
    ...(refusedSurface === undefined ? {} : { refusedSurface }),
  });

  /* ── CITY TIER ─────────────────────────────────────────────────────────── */
  if (cityMatch) {
    const all = cityMatch.entries;

    const aliasUsed = (city: GazetteerCity): string | undefined =>
      foldPlaceName(city.n) === cityMatch.text ? undefined : cityMatch.text;

    if (all.length === 1) {
      const place = toPlaceFromCity(all[0], aliasUsed(all[0]));

      if (place) {
        return {
          precision: 'CITY',
          provenance: 'STATED',
          place,
          candidates: [place],
          matchedText: cityMatch.text,
          reason: 'CITY_UNIQUE',
          detail: `"${cityMatch.text}" names exactly one settlement in the gazetteer`,
        };
      }
    }

    // (a) country co-mention, then the caller's context country.
    const countryIso2 = new Set([
      ...namedCountries.map((country) => country.iso2),
      ...(contextCountry ? [contextCountry.iso2] : []),
    ]);

    const byCountry = all.filter((city) => countryIso2.has(city.cc));

    if (byCountry.length === 1) {
      const place = toPlaceFromCity(byCountry[0], aliasUsed(byCountry[0]));

      if (place) {
        const stated = namedCountries.some((country) => country.iso2 === byCountry[0].cc);

        return {
          precision: 'CITY',
          // The CITY was named outright either way; the country only chose
          // between spellings of it. So this is STATED when the country is in
          // the text, and INTERPRETED when it came from the caller's context.
          provenance: stated ? 'STATED' : 'INTERPRETED',
          place,
          candidates: [place],
          matchedText: cityMatch.text,
          reason: 'CITY_BY_COUNTRY_CONTEXT',
          detail: `"${cityMatch.text}" is ambiguous across ${all.length} settlements; the ${
            stated ? 'country named in the text' : 'caller-supplied country'
          } leaves one`,
        };
      }
    }

    /*
     * (b) REGION CO-MENTION - BUT ONLY WHEN IT IS INDEPENDENT EVIDENCE.
     *
     * MEASURED BUG THIS GUARD CLOSES. A city very often shares its name with the
     * subdivision containing it - Vienna in Vienna, Shanghai in Shanghai, Kigali
     * in Kigali. Without this check the resolver matched "Vienna" as a region,
     * used that to disambiguate the city "Vienna", and reported provenance
     * STATED. That is SELF-CORROBORATION: one word certifying itself, dressed up
     * as two pieces of evidence.
     *
     * The honest answer for a bare "Vienna" is population dominance, which is a
     * prior and therefore INTERPRETED. So a region whose matched text is the
     * same string as the city's is refused as corroboration.
     */
    if (regionMatch && regionMatch.text !== cityMatch.text) {
      const regionKeys = new Set(regionMatch.entries.map((region) => `${region.cc}:${region.a1}`));
      const byRegion = all.filter((city) => regionKeys.has(`${city.cc}:${city.a1}`));

      if (byRegion.length === 1) {
        const place = toPlaceFromCity(byRegion[0], aliasUsed(byRegion[0]));

        if (place) {
          return {
            precision: 'CITY',
            provenance: 'STATED',
            place,
            candidates: [place],
            matchedText: cityMatch.text,
            reason: 'CITY_BY_REGION_CONTEXT',
            detail: `"${cityMatch.text}" disambiguated by the subdivision named in the text`,
          };
        }
      }
    }

    // (c) population dominance — a PRIOR, so never STATED.
    const ranked = [...all].sort((a, b) => (b.p ?? -1) - (a.p ?? -1));
    const leader = ranked[0];
    const runnerUp = ranked[1];

    /*
     * A TIE CANNOT BE BROKEN BY A NUMBER WE DO NOT HAVE.
     *
     * Settlements admitted by the priority current-name completion carry
     * population NULL - genuinely unknown, because the source has no such field.
     * If either side of this comparison is unknown, dominance is not merely
     * unproven, it is UNMEASURABLE, and claiming it would be inventing the
     * evidence for the claim. Both sides must be known for the ratio to mean
     * anything, and where they are not the answer falls through to CONTESTED,
     * which is the honest outcome.
     */
    const bothPopulationsKnown =
      leader?.p !== null &&
      leader?.p !== undefined &&
      runnerUp?.p !== null &&
      runnerUp?.p !== undefined;

    if (
      leader &&
      runnerUp &&
      bothPopulationsKnown &&
      (leader.p ?? 0) >= (runnerUp.p ?? 0) * POPULATION_DOMINANCE_RATIO
    ) {
      const place = toPlaceFromCity(leader, aliasUsed(leader));

      if (place) {
        return {
          precision: 'CITY',
          provenance: 'INTERPRETED',
          place,
          candidates: [place],
          matchedText: cityMatch.text,
          reason: 'CITY_BY_POPULATION_DOMINANCE',
          detail:
            `"${cityMatch.text}" is ambiguous; ${leader.n}, ${leader.cc} (${leader.p}) exceeds ` +
            `the next candidate (${runnerUp.p}) by at least ${POPULATION_DOMINANCE_RATIO}x`,
        };
      }
    }

    // (d) nothing separates them.
    const candidates = ranked
      .map((city) => toPlaceFromCity(city, aliasUsed(city)))
      .filter((place): place is ResolvedPlace => place !== undefined);

    if (candidates.length > 0) {
      return {
        precision: 'CITY',
        provenance: 'CONTESTED',
        candidates,
        matchedText: cityMatch.text,
        reason: 'CITY_CONTESTED',
        detail:
          `"${cityMatch.text}" names ${candidates.length} comparable settlements and nothing in ` +
          'the text separates them',
      };
    }
  }

  /* ── SUBDIVISION RECOVERY BY GENERIC-NOUN STEM ─────────────────────────── */
  /*
   * "THE WESTERN REGION OF RWANDA", WHICH THE APPROVED CHANGE LOG NAMES.
   *
   *   "including English usages such as 'the Western Region of Rwanda', which
   *    is PROVINCE."
   *
   * Rwanda's ISO 3166-2 name for that unit is "Western PROVINCE". A reader
   * writes Region, the database holds Province, and before this block the
   * resolver answered UNKNOWN - a miss on a case the specification calls out by
   * name. Half the world's admin1 layer carries one of these generic nouns
   * (1,989 of 3,940 units), so it is not an edge case.
   *
   * WHY IT RUNS HERE AND NOT EARLIER. It is a RECOVERY, reached only after the
   * exact region tier has already failed, so a correctly named subdivision never
   * goes near it. Same placement, and the same reasoning, as the fuzzy city
   * recovery immediately below.
   *
   * WHY IT IS GATED ON A SINGLE COUNTRY. The stems are words like "western",
   * "northern" and "central", which name subdivisions in dozens of countries. As
   * a global key they would be a false-positive generator of exactly the kind
   * this corpus has punished before. With the country fixed, the question stops
   * being hopeless and becomes usually-unique - and where it is NOT unique
   * (23 stems in the whole gazetteer, mostly capital-and-surrounding-region
   * pairs like Buenos Aires and Sofia) the answer is CONTESTED, not a pick.
   */
  const stemCountry =
    namedCountries.length === 1
      ? namedCountries[0]
      : namedCountries.length === 0
        ? contextCountry
        : undefined;

  /*
   * WHEN THE EXACT TIER MATCHED, BUT NOT HERE.
   *
   * "Western Region, Rwanda" DOES match the exact index - Iceland, Nepal and
   * Uganda all have a "Western Region" - and none of them is Rwanda. The exact
   * tier then reported three subdivisions in different countries as CONTESTED,
   * which is a worse answer than the one the reader could have had: Rwanda's
   * Western Province, named unambiguously, in the same sentence.
   *
   * So recovery runs whenever the exact tier produced nothing FOR THE COUNTRY IN
   * PLAY, not merely when it produced nothing at all.
   */
  const exactMatchedTheCountry =
    regionMatch !== undefined &&
    stemCountry !== undefined &&
    regionMatch.entries.some((region) => region.cc === stemCountry.iso2);

  if (!exactMatchedTheCountry && stemCountry) {
    const gate =
      options.requireGeographicContext === true
        ? contextGate
        : (start: number, words: number): boolean =>
            casing.slice(start, start + words).every(Boolean);

    for (const run of candidateRuns(tokens, limits.region)) {
      /*
       * A TRAILING ADMINISTRATIVE NOUN IS ITSELF THE CONTEXT.
       *
       * "The Western Region of Rwanda" opens the sentence, so the ordinary
       * gate - preposition, comma segment, or whole query - refuses "western"
       * and refuses "western region" with it. But the word "Region" sitting at
       * the end of the run is exactly the signal the gate is looking for: no
       * ordinary English noun phrase ends that way by accident, and the country
       * is named in the same breath. Both conditions are required together, so
       * this cannot open on a bare "Region" or on a subdivision name with no
       * country to scope it.
       */
      const endsInAdministrativeNoun =
        run.words > 1 && ADMINISTRATIVE_HEAD_NOUNS.has(tokens[run.start + run.words - 1] ?? '');

      if (!gate(run.start, run.words) && !endsInAdministrativeNoun) continue;

      /*
       * The QUERY run is stemmed too, not only the gazetteer names. The reader
       * wrote "Western Region"; the database holds "Western Province"; the two
       * meet only if both sides drop the generic noun.
       */
      const stem = endsInAdministrativeNoun ? regionStem(run.text) : run.text;

      const stemmed = regionsByStem(stemCountry.iso2, stem);

      if (stemmed.length === 0) continue;

      /*
       * NO FURTHER "HAS THE EXACT TIER SEEN THIS?" CHECK IS MADE HERE, AND THAT
       * IS DELIBERATE - an earlier version had one and it was wrong.
       *
       * It asked the index directly: "does this run name a subdivision of this
       * country?" and skipped when it did. But the exact tier answers a
       * different question - "did the SCAN, with its gate, match one?" - and the
       * gate refuses a sentence-initial phrase. So "the Eastern Province of
       * Rwanda" was skipped as already-handled by a tier that had in fact
       * refused it, and the reader got the country instead of the province.
       *
       * `exactMatchedTheCountry`, computed once above from the scan's own
       * result, is the correct and only guard: if the exact tier really did
       * match inside this country, this whole block never runs.
       */

      if (stemmed.length === 1) {
        const place = toPlaceFromRegion(stemmed[0]);

        if (place) {
          return {
            precision: 'PROVINCE',
            provenance: 'STATED',
            place,
            candidates: [place],
            matchedText: run.text,
            reason: 'PROVINCE_BY_COUNTRY_CONTEXT',
            detail:
              `"${run.text}" matched "${stemmed[0].n}" in ${stemCountry.name} once the generic ` +
              'administrative noun was set aside. Provenance stays STATED: the reader named this ' +
              'subdivision, in a normal English form, and nothing was inferred beyond the word ' +
              'for what kind of unit it is.',
          };
        }
      }

      const contested = stemmed
        .map(toPlaceFromRegion)
        .filter((place): place is ResolvedPlace => place !== undefined);

      if (contested.length > 1) {
        return {
          precision: 'PROVINCE',
          provenance: 'CONTESTED',
          candidates: contested,
          matchedText: run.text,
          reason: 'PROVINCE_CONTESTED',
          detail:
            `"${run.text}" matches ${contested.length} subdivisions of ${stemCountry.name} once ` +
            'the generic administrative noun is set aside, and nothing separates them',
        };
      }
    }
  }

  /* ── REGION TIER ───────────────────────────────────────────────────────── */
  if (regionMatch) {
    const all = regionMatch.entries;

    if (all.length === 1) {
      const place = toPlaceFromRegion(all[0]);

      /*
       * SAME RULE AS THE COUNTRY TIER, AND FOR THE SAME REASON. Measured,
       * article mode resolved "Republic of Georgia signs new trade deal" to
       * Georgia the US state. A subdivision name in a headline, with nothing
       * corroborating it, is not evidence that the article is about that
       * subdivision.
       */
      if (place && !articleModeCorroborates(all[0].cc, regionMatch.text)) {
        return uncorroboratedArticleCountry(
          `"${regionMatch.text}" appears in article text with nothing corroborating it.`,
          regionMatch.text,
        );
      }

      if (place) {
        return {
          precision: 'PROVINCE',
          provenance: 'STATED',
          place,
          candidates: [place],
          matchedText: regionMatch.text,
          reason: 'PROVINCE_UNIQUE',
          detail: `"${regionMatch.text}" names exactly one subdivision`,
        };
      }
    }

    const countryIso2 = new Set([
      ...namedCountries.map((country) => country.iso2),
      ...(contextCountry ? [contextCountry.iso2] : []),
    ]);
    const byCountry = all.filter((region) => countryIso2.has(region.cc));

    if (byCountry.length === 1) {
      const place = toPlaceFromRegion(byCountry[0]);

      if (place) {
        return {
          precision: 'PROVINCE',
          provenance: 'STATED',
          place,
          candidates: [place],
          matchedText: regionMatch.text,
          reason: 'PROVINCE_BY_COUNTRY_CONTEXT',
          detail: `"${regionMatch.text}" disambiguated by the country named in the text`,
        };
      }
    }

    const candidates = all
      .map(toPlaceFromRegion)
      .filter((place): place is ResolvedPlace => place !== undefined);

    if (candidates.length > 1) {
      return {
        precision: 'PROVINCE',
        provenance: 'CONTESTED',
        candidates,
        matchedText: regionMatch.text,
        reason: 'PROVINCE_CONTESTED',
        detail: `"${regionMatch.text}" names ${candidates.length} subdivisions in different countries`,
      };
    }
  }

  /* ── COUNTRY TIER ──────────────────────────────────────────────────────── */
  if (namedCountries.length === 1) {
    if (!articleModeCorroborates(namedCountries[0].iso2, foldPlaceName(namedCountries[0].name))) {
      return uncorroboratedArticleCountry(
        `"${namedCountries[0].name}" appears in article text with nothing corroborating it. ` +
          'Article-level country is decided by the scored relevance path, not by a bare name ' +
          'match, so this resolver declines rather than competing with it.',
        foldPlaceName(namedCountries[0].name),
      );
    }

    /*
     * FUZZY CITY RECOVERY INSIDE THE RESOLVED COUNTRY.
     *
     * "Kigalli, Rwanda" must recover BOTH - the country exactly and the city
     * through typo correction - and the correction must be REFUSED if it belongs
     * to a different country. That is the legacy GEO-PRECISION-1 rule, and it is
     * also what the approved Spatial spec asks for: "Kigalli" -> Kigali is
     * precision CITY, provenance INTERPRETED.
     *
     * It runs only after the exact city tier has failed, so a correctly spelled
     * city is never routed through fuzzy.
     */
    const recovered = resolveFuzzy(tokens, casing, namedCountries[0].iso2, requireCasing, cityGate);

    if (recovered) return recovered;

    const place = toPlaceFromCountry(namedCountries[0]);

    return {
      precision: 'COUNTRY',
      provenance: 'STATED',
      place,
      candidates: [place],
      matchedText: foldPlaceName(namedCountries[0].name),
      reason: 'COUNTRY_ONLY',
      detail: `"${namedCountries[0].name}" named with no finer place resolved`,
    };
  }

  if (namedCountries.length > 1) {
    const candidates = namedCountries.map(toPlaceFromCountry);

    return {
      precision: 'COUNTRY',
      provenance: 'CONTESTED',
      candidates,
      reason: 'COUNTRY_ONLY',
      detail: `${namedCountries.length} countries named and none is the subject`,
    };
  }

  /* ── FUZZY TYPO CORRECTION, LAST RESORT ────────────────────────────────── */
  /*
   * REQUIRED BY THE APPROVED SPATIAL SPEC, VERBATIM: "A source misspelling
   * resolved to a real place - 'Kigalli' -> Kigali - is precision: CITY,
   * locationProvenance: INTERPRETED: it keeps city geometry and the city camera
   * ceiling, while being drawn and described as unverified."
   *
   * So the correction keeps its precision and is NEVER STATED. A corrected
   * spelling is an interpretation of what the source meant, and calling it
   * STATED would be the resolver asserting something the text does not say.
   *
   * LAST RESORT, AND DELIBERATELY NARROW. It runs only after every exact path
   * has failed, over single tokens only, using the EXISTING shared resolveGeoTypo
   * - no new fuzzy logic and no new threshold. The v2 resolver initially dropped
   * this capability entirely and the legacy suite caught it.
   */
  /*
   * THE UNRESTRICTED FUZZY GATE IS STRICTER THAN THE EXACT ONE.
   *
   * A comma segment is enough context for an EXACT match - "Musanze, Rwanda" is
   * unambiguous. It is NOT enough for a CORRECTION. MEASURED: "Porównaj Nigerię,
   * Kenię, Rwandę i Ugandę" put each Polish declension at a segment start, and
   * fuzzy turned "Rwandę" into Rwanda and answered a quarter of a four-way
   * comparison as though it were the whole question.
   *
   * So an unrestricted correction requires a real preposition or the whole
   * query. The RESTRICTED recovery inside an already-resolved country keeps the
   * looser gate, because there the country is known and the correction can only
   * pick a city within it - which is exactly the "Kigalli, Rwanda" case.
   */
  const strictGate = (start: number, words: number): boolean => {
    if (options.requireGeographicContext !== true) return true;
    if (tokens.slice(start, start + words).join(' ') === tokens.join(' ')) return true;

    const before = tokens[start - 1];

    if (before === undefined) return false;
    if (GEOGRAPHIC_PREPOSITIONS.has(before)) return true;

    return before === 'the' && GEOGRAPHIC_PREPOSITIONS.has(tokens[start - 2] ?? '');
  };

  const fuzzy = resolveFuzzy(
    tokens,
    casing,
    undefined,
    requireCasing,
    strictGate,
    rawText,
    options.evidenceLanguage,
  );

  if (fuzzy) return fuzzy;

  /* ── HONEST UNKNOWN ────────────────────────────────────────────────────── */
  /*
   * Both outcomes are UNKNOWN, and they are DIFFERENT KINDS of not-knowing. If
   * a supranational phrase was masked out and nothing else matched, the text
   * did name a place - one this system cannot yet locate. Reporting that as
   * NO_PLACE_EVIDENCE would tell a caller no place was mentioned, which is
   * false, and would deny a surface the chance to say the useful thing:
   * "East Africa is not a level I can place."
   */
  if (supranationalSpans.length > 0) return supranationalRefusal();

  return {
    precision: 'UNKNOWN',
    candidates: [],
    reason: 'NO_PLACE_EVIDENCE',
    detail:
      'no country, subdivision or settlement in the gazetteer matched. UNKNOWN is the answer, ' +
      'not a failure - and it is never filled in from the retrieval query.',
  };
}
