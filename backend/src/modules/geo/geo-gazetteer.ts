import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { foldPlaceName } from './geo-normalize.util';

/**
 * GEOGRAPHY — THE GAZETTEER, LOADED ONCE AND INDEXED.
 *
 * WHAT THIS REPLACES. A hand-curated table of a couple of dozen cities, which
 * could never answer a question about Perth, Shanghai or São Paulo and whose
 * failure mode was silence. This loads 48,702 settlements and 3,940 first-level
 * subdivisions built from the GeoNames gazetteer, with real coordinates.
 *
 * BUILT OFFLINE, COMMITTED, LOADED FROM DISK. Resolving a place name must never
 * depend on a network call. scripts/build-gazetteer.mjs produces the artifact
 * deterministically and prints its SHA256; the artifact is the contract.
 *
 * ATTRIBUTION IS A LICENCE OBLIGATION, NOT A COURTESY. The underlying data is
 * GeoNames, CC BY 4.0. `GAZETTEER_ATTRIBUTION` below is exported so the product
 * can surface it, and a test asserts it is non-empty.
 */

export interface GazetteerCity {
  /** Canonical name as the gazetteer spells it. */
  readonly n: string;
  readonly cc: string;
  /** GeoNames admin1 code, or null when the subdivision join failed. */
  readonly a1: string | null;
  /** GeoNames admin2 code, present only for priority-programme countries. */
  readonly a2?: string;
  /**
   * Population, or NULL when it is genuinely unknown.
   *
   * NULL IS NOT ZERO AND THE DIFFERENCE IS LOAD-BEARING. Settlements admitted by
   * the priority current-name completion come from a source with no population
   * field. Zero would be a claim - "nobody lives here" - and would additionally
   * lose every population tiebreak it entered, silently and wrongly. Null means
   * unknown, and the resolver REFUSES to break a tie it cannot see.
   */
  readonly p: number | null;
  readonly lat: number;
  readonly lon: number;
  /** GeoNames feature code: PPLC = national capital, PPLA = admin1 seat, etc. */
  readonly fc: string;
  /**
   * Present only on records admitted by the priority current-name completion,
   * so the audit surface can report where a settlement came from.
   */
  readonly src?: 'completion';
}

export interface DerivedExtent {
  /** [minLon, minLat, maxLon, maxLat] over the settlements held here. */
  readonly bbox: readonly [number, number, number, number];
  /** [lon, lat], population-weighted over those settlements. */
  readonly centroid: readonly [number, number];
  readonly members: number;
  /** True when the bbox spans the antimeridian and must NOT be fitted naively. */
  readonly antimeridian: boolean;
  /** Always 'derived-from-settlements'. NEVER an administrative boundary. */
  readonly source: string;
}

export interface GazetteerRegion {
  readonly n: string;
  readonly cc: string;
  readonly a1: string;
  /** ISO 3166-2, e.g. "AU-WA". Null when the subdivision has no ISO code. */
  readonly iso: string | null;
  /** Real multilingual names from iso3166-2-db. Unlike the city aliases, these exist. */
  readonly al: readonly string[];
  readonly ext: DerivedExtent | null;
}

/**
 * A second-level administrative unit (district / powiat / county).
 *
 * `code` is the real identifier and the join key for external ADM2 geometry.
 * `label` is a CONVENIENCE derived from the unit's principal gazetteer-verified
 * settlement and is null when no member could be verified - see the build
 * script for why a null label is preferred to a guessed one.
 */
export interface GazetteerAdmin2 {
  /** "PL.72.0201" - country.admin1.admin2, GeoNames codes. */
  readonly code: string;
  readonly cc: string;
  readonly a1: string;
  readonly a2: string;
  readonly label: string | null;
  readonly labelSource: 'derived-from-principal-settlement' | 'unavailable';
  readonly settlements: number;
  readonly settlementsInGazetteer: number;
  readonly ext: DerivedExtent | null;
}

/** A verified alias pointing at a canonical gazetteer spelling. */
export interface GazetteerExonym {
  /** Folded alias, e.g. "muenchen" or "munich". */
  readonly x: string;
  /** Canonical settlement name in the gazetteer. */
  readonly n: string;
  readonly cc: string;
}

export interface GazetteerArtifact {
  readonly schema: string;
  readonly attribution: string;
  readonly counts: Record<string, number>;
  readonly admin2Priority: readonly string[];
  readonly admin2: readonly GazetteerAdmin2[];
  readonly exonyms: readonly GazetteerExonym[];
  readonly countryExtents: Record<string, DerivedExtent | null>;
  readonly regions: readonly GazetteerRegion[];
  readonly cities: readonly GazetteerCity[];
}

let artifact: GazetteerArtifact | undefined;
let cityIndex: Map<string, GazetteerCity[]> | undefined;
let regionIndex: Map<string, GazetteerRegion[]> | undefined;
let regionStemIndex: Map<string, GazetteerRegion[]> | undefined;
let exonymIndex: Map<string, GazetteerExonym> | undefined;
let admin2Index: Map<string, GazetteerAdmin2> | undefined;
let maxCityWords = 1;
let maxRegionWords = 1;
let maxExonymWords = 1;

function load(): GazetteerArtifact {
  if (artifact) return artifact;

  /*
   * Resolved relative to this module so it works identically from src under
   * ts-jest and from dist under the compiled build. The data directory is
   * copied by nest-cli's asset rule; a missing artifact is a build error worth
   * failing loudly on rather than degrading to an empty gazetteer, because an
   * empty gazetteer looks exactly like "this place does not exist".
   */
  const path = join(__dirname, 'data', 'gazetteer.v1.json');

  artifact = JSON.parse(readFileSync(path, 'utf8')) as GazetteerArtifact;

  return artifact;
}

/**
 * Generic administrative nouns that end a subdivision's name.
 *
 * WHY THIS EXISTS. The approved change log names the case directly: "including
 * English usages such as 'the Western Region of Rwanda', which is PROVINCE."
 * Rwanda's ISO 3166-2 name for that unit is "Western Province". A reader
 * writing "Region" and a database holding "Province" mean the same place, and
 * before this index the resolver answered UNKNOWN.
 *
 * 1,989 of the 3,940 subdivisions carry one of these nouns, so this is not an
 * edge case - it is half the world's admin1 layer.
 */
const GENERIC_ADMIN_NOUN =
  /[\s-]+(region|regions|province|provinces|state|district|districts|county|governorate|prefecture|voivodeship|oblast|krai|okrug|department|division|territory|municipality|canton|emirate|parish|zone|area)$/i;

/**
 * The name with its generic administrative noun removed, folded.
 * "Western Province" and "Western Region" both stem to "western".
 * A name that IS only a generic noun stems to itself, never to nothing.
 */
export function regionStem(name: string): string {
  const stripped = name.replace(GENERIC_ADMIN_NOUN, '');

  return foldPlaceName(stripped.length > 0 ? stripped : name);
}

function buildIndexes(): void {
  if (cityIndex && regionIndex) return;

  const data = load();

  cityIndex = new Map();
  regionIndex = new Map();
  regionStemIndex = new Map();

  for (const city of data.cities) {
    const folded = foldPlaceName(city.n);

    if (folded.length === 0) continue;

    maxCityWords = Math.max(maxCityWords, folded.split(' ').length);

    const bucket = cityIndex.get(folded);

    if (bucket) bucket.push(city);
    else cityIndex.set(folded, [city]);
  }

  for (const region of data.regions) {
    /*
     * The canonical name AND every multilingual alias index to the same record.
     * "Australie-Occidentale" and "西澳大利亚州" both reach Western Australia.
     */
    for (const name of [region.n, ...region.al]) {
      const folded = foldPlaceName(name);

      if (folded.length === 0) continue;

      maxRegionWords = Math.max(maxRegionWords, folded.split(' ').length);

      const bucket = regionIndex.get(folded);

      if (bucket) {
        if (!bucket.includes(region)) bucket.push(region);
      } else {
        regionIndex.set(folded, [region]);
      }

      /*
       * KEYED BY COUNTRY, DELIBERATELY. A bare stem is far too generic to be a
       * global key - "western", "northern", "central" and "eastern" name
       * subdivisions in dozens of countries, and an ungated stem index would be
       * a false-positive generator of exactly the kind the corpus has punished
       * before. Requiring the country turns a hopeless global question into a
       * usually-unique local one.
       */
      const stem = regionStem(name);

      if (stem.length > 0) {
        const key = `${region.cc}|${stem}`;
        const stemBucket = regionStemIndex.get(key);

        if (stemBucket) {
          if (!stemBucket.includes(region)) stemBucket.push(region);
        } else {
          regionStemIndex.set(key, [region]);
        }
      }
    }
  }

  exonymIndex = new Map();

  for (const exonym of data.exonyms) {
    exonymIndex.set(exonym.x, exonym);
    maxExonymWords = Math.max(maxExonymWords, exonym.x.split(' ').length);
  }

  admin2Index = new Map();

  for (const unit of data.admin2) {
    admin2Index.set(unit.code, unit);
  }

  /*
   * Within a bucket, the most populous candidate first. The resolver never
   * decides on population alone, but a deterministic order means an ambiguity
   * is reported in a stable sequence rather than in load order.
   */
  for (const bucket of cityIndex.values()) {
    bucket.sort((a, b) => (b.p ?? -1) - (a.p ?? -1) || (a.cc < b.cc ? -1 : 1));
  }
}

export function gazetteerCounts(): Record<string, number> {
  return load().counts;
}

export const GAZETTEER_ATTRIBUTION = (): string => load().attribution;

/**
 * Every settlement in the gazetteer.
 *
 * FOR AUDIT AND VERIFICATION, NOT FOR RESOLUTION. The resolver never scans this
 * - it uses the folded-name index - and a caller that iterates 51,057 records
 * per request has taken a wrong turn. It exists so a test can assert a property
 * over the WHOLE artifact rather than over a handful of examples, which is how
 * the geographyId collision was found.
 */
export function allCities(): readonly GazetteerCity[] {
  return load().cities;
}

export function citiesNamed(foldedName: string): readonly GazetteerCity[] {
  buildIndexes();

  return cityIndex?.get(foldedName) ?? [];
}

/**
 * Subdivisions of ONE country whose name-stem matches, ignoring the generic
 * administrative noun. "Western Region" finds Rwanda's "Western Province".
 *
 * Returns EVERY match. Measured, 23 stems in the whole gazetteer are ambiguous
 * within their own country (Buenos Aires the city-unit and the province, Sofia,
 * Minsk, Zagreb - capital-and-surrounding-region pairs, mostly). The caller must
 * treat more than one as CONTESTED rather than picking, because there is no
 * honest basis for a choice between them.
 */
export function regionsByStem(countryIso2: string, foldedStem: string): readonly GazetteerRegion[] {
  buildIndexes();

  return regionStemIndex?.get(`${countryIso2}|${foldedStem}`) ?? [];
}

export function regionsNamed(foldedName: string): readonly GazetteerRegion[] {
  buildIndexes();

  return regionIndex?.get(foldedName) ?? [];
}

export function regionFor(cc: string, a1: string | null): GazetteerRegion | undefined {
  if (!a1) return undefined;

  buildIndexes();

  return load().regions.find((region) => region.cc === cc && region.a1 === a1);
}

export function countryExtent(cc: string): DerivedExtent | null {
  return load().countryExtents[cc] ?? null;
}

/**
 * Resolves a verified alias to its canonical settlement.
 *
 * EXONYMS ARE AN ALIAS INDEX OVER THE GAZETTEER, NOT A GAZETTEER. Every entry
 * was verified against a real record at build time and the build FAILS if one
 * points nowhere. A place absent from this index still resolves by its
 * canonical name; removing the index loses aliases, never places.
 */
export function citiesByExonym(foldedName: string): readonly GazetteerCity[] {
  buildIndexes();

  const exonym = exonymIndex?.get(foldedName);

  if (!exonym) return [];

  return citiesNamed(foldPlaceName(exonym.n)).filter((city) => city.cc === exonym.cc);
}

/** The second-level unit a settlement sits in, when the country is in the programme. */
export function admin2For(city: GazetteerCity): GazetteerAdmin2 | undefined {
  if (!city.a1 || !city.a2) return undefined;

  buildIndexes();

  return admin2Index?.get(`${city.cc}.${city.a1}.${city.a2}`);
}

export function admin2PriorityCountries(): readonly string[] {
  return load().admin2Priority;
}

/** Longest multi-word name in each index, so the scanner knows its run length. */
export function maxNameWords(): { city: number; region: number; exonym: number } {
  buildIndexes();

  return { city: maxCityWords, region: maxRegionWords, exonym: maxExonymWords };
}

/**
 * Every first-level subdivision, and every second-level unit.
 *
 * SAME CONTRACT AS `allCities`: audit, verification and INDEX CONSTRUCTION, not
 * per-request scanning. The Navigator's search index is built once from these
 * and then queried; a caller filtering these arrays inside a request handler
 * has taken the same wrong turn `allCities` warns about.
 */
export function allRegions(): readonly GazetteerRegion[] {
  return load().regions;
}

export function allAdmin2(): readonly GazetteerAdmin2[] {
  return load().admin2;
}

export function allExonyms(): readonly GazetteerExonym[] {
  return load().exonyms;
}

/** What the artifact says it was built from, for provenance on the wire. */
export function gazetteerProvenance(): Record<string, string> {
  const artifactValue = load() as unknown as { builtFrom?: Record<string, string> };

  return artifactValue.builtFrom ?? {};
}

/** The retention policy the artifact was built under. Served so it is auditable. */
export function gazetteerPolicy(): Record<string, number> {
  const artifactValue = load() as unknown as { policy?: Record<string, number> };

  return artifactValue.policy ?? {};
}
