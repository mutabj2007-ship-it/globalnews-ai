import {
  COUNTRY_ALIASES_BY_ISO3,
  accountSourceCoverage,
  resolveCountryByAnyIdentifier,
} from '@globalnews-ai/shared';
import type { CountryMeta, LanguageCode } from '@globalnews-ai/shared';
import { resolvePrimaryCountry } from '../../news/country/country-relevance.util';
import {
  foldForPlan,
  type CompoundFacet,
  type CompoundRetrievalPlanAdmission,
  type CompoundRetrievalScope,
  type QualifiedCountryPhrase,
} from '../../news/relevance/compound-plan-relevance.util';
import { allCities, allRegions, countryExtent } from '../../geo/geo-gazetteer';
import {
  GLOBAL_REACH_REGIONS,
  GLOBAL_REACH_SOURCE_PACKS,
} from '../../global-reach/source-pack.registry';
import { resolveSearchEndpointLanguage } from '../language/resolve-retrieval-language.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA RETRIEVAL REPAIR R1 — THE BOUNDED COMPOUND RETRIEVAL PLAN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A long, compound question ("What are the most recent verified security or territorial
 * changes in eastern Democratic Republic of the Congo, and what effects on civilians or
 * displacement are currently reported? Separate confirmed facts from analytical inference, …")
 * is not a search phrase. Sent whole, every word became a required provider term and a
 * required gate term, and the answer was "0 matching reports" (Production op 5944db16).
 *
 * This derives, deterministically and with no model call, what to FETCH and what to ADMIT:
 *
 *   FORMAT DIRECTIVES ARE NOT TERMS  trailing sentences that tell the answer how to be written
 *                                    ("Separate …", "Distinguish …", "Cite …") are dropped
 *                                    from retrieval. The prompt still carries them unchanged.
 *   ONE COUNTRY                      resolved by the existing country authority over the kept
 *                                    text; zero or several countries → no plan.
 *   SUB-NATIONAL SCOPE SURVIVES      a compass qualifier on that country ("eastern") is kept.
 *                                    Its places are read from the governed gazetteer: regions
 *                                    whose centroid lies in that quarter of the country's
 *                                    extent, and their towns of ≥ 50,000. No place is written
 *                                    here, so the scope follows the data, not a village list.
 *   FACETS                           the closed security / humanitarian concepts the reader
 *                                    asked about; a question with none gets no plan.
 *   BOUNDED FAN-OUT                  at most 3 reader-language searches (scope, + one per facet)
 *                                    and at most 1 search in a language the country's governed
 *                                    source pack observes (French for DRC). Evidence language
 *                                    is not answer language: the answer stays in the reader's
 *                                    language, each report keeps its own sourceLanguage.
 *
 * Every other question returns undefined and keeps exactly the path it had.
 */

export interface CompoundPlanQuery {
  readonly q: string;
  /** Provider language for this search; undefined = the reader's default. */
  readonly lang?: string;
  readonly facet: CompoundFacet | null;
  /** Only the first search may consult the (slow, serial) fallback tier. */
  readonly allowFallback: boolean;
}

export interface CompoundRetrievalPlan extends CompoundRetrievalPlanAdmission {
  readonly country: CountryMeta;
  readonly queries: readonly CompoundPlanQuery[];
  readonly evidenceLanguages: readonly string[];
}

/** Below this many words the existing single-phrase derivations are left alone. */
export const MIN_COMPOUND_WORDS = 12;
export const MAX_READER_LANGUAGE_SEARCHES = 3;
export const MAX_ADDITIONAL_LANGUAGE_SEARCHES = 1;
/** A town must be at least this populous to stand for a sub-national scope. */
const MIN_SCOPE_TOWN_POPULATION = 50_000;

/** First words of a sentence that only instructs how the answer is to be written. */
const FORMAT_DIRECTIVE_VERBS = new Set([
  'separate',
  'distinguish',
  'differentiate',
  'cite',
  'attribute',
  'include',
  'provide',
  'list',
  'give',
  'label',
  'mark',
  'flag',
  'note',
  'quote',
  'reference',
  'keep',
  'use',
  'show',
  'source',
  'link',
  'indicate',
  'specify',
  'state',
  'please',
  'be',
  'format',
  'answer',
  'respond',
  'write',
]);

/** Question-side facet vocabulary (English; the reader's own words). */
const FACET_QUESTION_TERMS: Readonly<Record<CompoundFacet, RegExp>> = {
  SECURITY:
    /\b(?:security|conflicts?|fighting|clash(?:es)?|violence|attacks?|armed|military|rebels?|rebellion|militias?|war|territorial|territory|territories|front ?lines?|offensives?|ceasefire|insurgen(?:cy|ts?))\b/i,
  HUMANITARIAN: /\b(?:civilians?|displacement|displaced|refugees?|humanitarian|casualties|aid)\b/i,
};

/** The single provider term each facet contributes to its search (commonest reporting word). */
const FACET_QUERY_TERM: Readonly<Record<CompoundFacet, string>> = {
  SECURITY: 'fighting',
  HUMANITARIAN: 'displaced',
};

/**
 * Compass qualifiers, their governed band of the country's extent, and the French compass
 * noun a French report uses for the same scope ("l'est de la RDC").
 */
const QUALIFIERS: Readonly<
  Record<string, { readonly lon?: 'E' | 'W'; readonly lat?: 'N' | 'S'; readonly fr: string }>
> = {
  eastern: { lon: 'E', fr: 'est' },
  western: { lon: 'W', fr: 'ouest' },
  northern: { lat: 'N', fr: 'nord' },
  southern: { lat: 'S', fr: 'sud' },
  northeastern: { lon: 'E', lat: 'N', fr: 'nord est' },
  northwestern: { lon: 'W', lat: 'N', fr: 'nord ouest' },
  southeastern: { lon: 'E', lat: 'S', fr: 'sud est' },
  southwestern: { lon: 'W', lat: 'S', fr: 'sud ouest' },
};
/** A region is in a compass band when its centroid lies in the outer quarter of the extent. */
const BAND_FRACTION = 0.25;

const QUALIFIER_PATTERN =
  /\b(north[- ]?eastern|north[- ]?western|south[- ]?eastern|south[- ]?western|eastern|western|northern|southern)\s+((?:the\s+)?[\p{L}'’.-]+(?:\s+[\p{L}'’.-]+){0,6})/iu;

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/** The question without its trailing answer-format sentences. The first sentence is always kept. */
export function withoutFormatDirectives(question: string): string {
  const sentences = question
    .trim()
    .split(/(?<=[.?!])\s+/)
    .filter((s) => s.length > 0);
  const kept = sentences.filter((sentence, index) => {
    if (index === 0) return true;
    const first = sentence.match(/^[\p{L}]+/u)?.[0]?.toLowerCase();
    return first === undefined || !FORMAT_DIRECTIVE_VERBS.has(first);
  });
  return kept.join(' ');
}

export function detectCompoundFacets(text: string): CompoundFacet[] {
  return (Object.keys(FACET_QUESTION_TERMS) as CompoundFacet[]).filter((facet) =>
    FACET_QUESTION_TERMS[facet].test(text),
  );
}

function countryOf(text: string): CountryMeta | undefined {
  const iso2 = resolvePrimaryCountry({ title: text, summary: '' })?.countryCode;
  return iso2 === undefined ? undefined : resolveCountryByAnyIdentifier(iso2);
}

/** The reader's compass qualifier, only when it directly qualifies the resolved country. */
export function readCompassQualifier(text: string, country: CountryMeta): string | null {
  const match = text.match(QUALIFIER_PATTERN);
  if (!match?.[1] || !match[2]) return null;
  const qualifier = match[1].toLowerCase().replace(/[- ]/g, '');
  if (QUALIFIERS[qualifier] === undefined) return null;
  return countryOf(match[2])?.iso3 === country.iso3 ? qualifier : null;
}

/** The country's folded name forms from the shared alias authority (no second vocabulary). */
function countryNameForms(country: CountryMeta): string[] {
  const forms = new Set<string>([
    foldForPlan(country.name),
    foldForPlan(countrySearchWords(country)),
  ]);
  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES_BY_ISO3)) {
    if (iso3 === country.iso3) forms.add(foldForPlan(alias));
  }
  return [...forms].filter((f) => f.length >= 3);
}

/**
 * Folded forms that establish ANOTHER country outright: its name forms, its Intl display names
 * (en, fr) and its gazetteer capital ("brazzaville"). Used only to disqualify a shared form.
 */
function countryMarkers(other: CountryMeta): string[] {
  const markers = new Set<string>(countryNameForms(other));
  for (const lang of ['en', 'fr']) {
    const display = new Intl.DisplayNames([lang], { type: 'region' }).of(other.iso2);
    if (display !== undefined) markers.add(foldForPlan(display));
  }
  for (const city of allCities()) {
    if (city.cc === other.iso2 && city.fc === 'PPLC') markers.add(foldForPlan(city.n));
  }
  return [...markers].filter((m) => m.length >= 3);
}

const scopeCache = new Map<string, CompoundRetrievalScope>();

/** Governed places in the qualified part of the country (gazetteer regions + major towns). */
export function governedScope(country: CountryMeta, qualifier: string): CompoundRetrievalScope {
  const key = `${country.iso2}|${qualifier}`;
  const cached = scopeCache.get(key);
  if (cached !== undefined) return cached;

  const band = QUALIFIERS[qualifier];
  const extent = countryExtent(country.iso2);
  const inBand = (lon: number, lat: number): boolean => {
    if (extent === null || band === undefined) return false;
    const [minLon, minLat, maxLon, maxLat] = extent.bbox;
    const dLon = (maxLon - minLon) * BAND_FRACTION;
    const dLat = (maxLat - minLat) * BAND_FRACTION;
    const lonOk =
      band.lon === undefined || (band.lon === 'E' ? lon >= maxLon - dLon : lon <= minLon + dLon);
    const latOk =
      band.lat === undefined || (band.lat === 'N' ? lat >= maxLat - dLat : lat <= minLat + dLat);
    return lonOk && latOk;
  };

  const regions = allRegions().filter(
    (r) => r.cc === country.iso2 && r.ext !== null && inBand(r.ext.centroid[0], r.ext.centroid[1]),
  );
  const regionCodes = new Set(regions.map((r) => r.a1));
  const latin = (name: string): boolean => /^[\p{Script=Latin}\s'’.-]+$/u.test(name);
  const places = new Set<string>();
  for (const region of regions) {
    for (const name of [region.n, ...region.al].filter(latin)) places.add(foldForPlan(name));
  }
  for (const city of allCities()) {
    if (
      city.cc === country.iso2 &&
      city.a1 !== null &&
      regionCodes.has(city.a1) &&
      (city.p ?? 0) >= MIN_SCOPE_TOWN_POPULATION
    ) {
      places.add(foldForPlan(city.n));
    }
  }
  /* The qualified country stated directly: "eastern Congo", "eastern DRC", "l'est de la RDC" —
     the country's own governed name forms, never a free-standing compass word. */
  const fr = band?.fr ?? qualifier;
  const countryPhrases: QualifiedCountryPhrase[] = [];
  for (const form of countryNameForms(country)) {
    const other = resolveCountryByAnyIdentifier(form);
    const unlessAny =
      other !== undefined && other.iso3 !== country.iso3
        ? countryMarkers(other).filter((marker) => marker !== form)
        : undefined;
    for (const phrase of [
      `${qualifier} ${form}`,
      ...['de la', 'du', 'de l'].map((joiner) => `${fr} ${joiner} ${form}`),
    ]) {
      countryPhrases.push(unlessAny === undefined ? { phrase } : { phrase, unlessAny });
    }
  }
  const scope: CompoundRetrievalScope = {
    qualifier,
    places: [...places].filter((p) => p.length >= 3).sort(),
    countryPhrases,
    /* Only forms that are THIS country's alone — a shared form ("congo") is never stripped. */
    ownForms: countryNameForms(country).filter((form) => {
      const owner = resolveCountryByAnyIdentifier(form);
      return owner === undefined || owner.iso3 === country.iso3;
    }),
    plainPhrases: [`${qualifier} part of the country`, `${fr} du pays`],
  };
  scopeCache.set(key, scope);
  return scope;
}

let packLanguageCache: Map<string, readonly string[]> | undefined;

/** Languages the country's governed source pack observes (local entries). */
export function governedEvidenceLanguages(iso3: string): readonly string[] {
  if (packLanguageCache === undefined) {
    packLanguageCache = new Map(
      accountSourceCoverage(GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS).map((row) => [
        row.iso3,
        row.languages,
      ]),
    );
  }
  return packLanguageCache.get(iso3) ?? [];
}

/** The country's search words: its canonical name without two-letter abbreviations ("DR"). */
function countrySearchWords(country: CountryMeta): string {
  const kept = words(country.name).filter((w) => w.replace(/[^\p{L}]/gu, '').length >= 3);
  return (kept.length > 0 ? kept : words(country.name)).join(' ');
}

export function deriveCompoundRetrievalPlan(
  question: string,
  requestedLanguage: LanguageCode,
): CompoundRetrievalPlan | undefined {
  if (requestedLanguage !== 'en') return undefined;

  const kept = withoutFormatDirectives(question);
  if (words(kept).length < MIN_COMPOUND_WORDS) return undefined;

  const facets = detectCompoundFacets(kept);
  if (facets.length === 0) return undefined;

  const country = countryOf(kept);
  if (country === undefined) return undefined;

  const qualifier = readCompassQualifier(kept, country);
  const scope = qualifier === null ? null : governedScope(country, qualifier);
  /* A qualified scope the gazetteer cannot place is not narrowed by guesswork. */
  const usableScope = scope !== null && scope.places.length > 0 ? scope : null;

  const base = [usableScope?.qualifier, countrySearchWords(country)].filter(Boolean).join(' ');
  const queries: CompoundPlanQuery[] = [{ q: base, facet: null, allowFallback: true }];
  for (const facet of facets) {
    if (queries.length >= MAX_READER_LANGUAGE_SEARCHES) break;
    queries.push({ q: `${base} ${FACET_QUERY_TERM[facet]}`, facet, allowFallback: false });
  }

  const additional = governedEvidenceLanguages(country.iso3)
    .filter((lang) => lang !== requestedLanguage)
    .filter((lang) => resolveSearchEndpointLanguage(lang) === lang)
    .slice(0, MAX_ADDITIONAL_LANGUAGE_SEARCHES);
  for (const lang of additional) {
    queries.push({ q: countrySearchWords(country), lang, facet: null, allowFallback: false });
  }

  return {
    iso3: country.iso3,
    country,
    scope: usableScope,
    facets,
    queries,
    evidenceLanguages: [requestedLanguage, ...additional],
  };
}
