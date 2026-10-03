import {
  COUNTRIES,
  getLocalizedCountryName,
  resolveCountryByAnyIdentifier,
} from '@globalnews-ai/shared';
import { resolveCountriesByDemonym } from '../news/country/country-relevance.util';
import { foldPl } from './pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 FOURTH PASS — SAFE COUNTRY-DERIVED FORMS → CANONICAL COUNTRIES (bounded, never fuzzy)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   combined adjectives   "Franco-German", "Sino-Japanese", "Polish-Lithuanian", "US-China",
 *                         PL "polsko-litewskie", "niemiecko-francuski" → two countries
 *   possessives           "Brazil's", and the omitted-apostrophe "brazils" ONLY when a noun
 *                         follows ("brazils presidential election") and the stem is a country
 *
 * Every form is COUNTRY IDENTITY DATA (an English combining form, a demonym the shared resolver
 * already knows, a Polish adjective stem) — never a near-spelling. A token that is not a known
 * form is not a country.
 */

/* English combining forms (the first half of a compound adjective) */
const EN_COMBINING: Readonly<Record<string, string>> = {
  franco: 'FRA',
  sino: 'CHN',
  indo: 'IND',
  anglo: 'GBR',
  russo: 'RUS',
  germano: 'DEU',
  italo: 'ITA',
  hispano: 'ESP',
  luso: 'PRT',
  greco: 'GRC',
  turco: 'TUR',
  austro: 'AUT',
  nippo: 'JPN',
  polono: 'POL',
  americano: 'USA',
  irano: 'IRN',
  israeli: 'ISR',
};
/* short forms that are country identifiers ONLY inside a compound ("US-China", "UK-EU") */
const COMPOUND_CODES: Readonly<Record<string, string>> = { us: 'USA', usa: 'USA', uk: 'GBR' };

/* Polish adjective stems (diacritic-folded), the country they name */
const PL_ADJECTIVE_STEMS: ReadonlyArray<readonly [string, string]> = [
  ['polsk', 'POL'],
  ['litewsk', 'LTU'],
  ['niemieck', 'DEU'],
  ['francusk', 'FRA'],
  ['rosyjsk', 'RUS'],
  ['ukrainsk', 'UKR'],
  ['bialorusk', 'BLR'],
  ['czesk', 'CZE'],
  ['slowack', 'SVK'],
  ['wegiersk', 'HUN'],
  ['rumunsk', 'ROU'],
  ['bulgarsk', 'BGR'],
  ['serbsk', 'SRB'],
  ['chorwack', 'HRV'],
  ['slowensk', 'SVN'],
  ['austriack', 'AUT'],
  ['szwajcarsk', 'CHE'],
  ['wlosk', 'ITA'],
  ['hiszpansk', 'ESP'],
  ['portugalsk', 'PRT'],
  ['brytyjsk', 'GBR'],
  ['angielsk', 'GBR'],
  ['irlandzk', 'IRL'],
  ['holendersk', 'NLD'],
  ['belgijsk', 'BEL'],
  ['dunsk', 'DNK'],
  ['szwedzk', 'SWE'],
  ['norwesk', 'NOR'],
  ['finsk', 'FIN'],
  ['estonsk', 'EST'],
  ['lotewsk', 'LVA'],
  ['greck', 'GRC'],
  ['tureck', 'TUR'],
  ['izraelsk', 'ISR'],
  ['palestynsk', 'PSE'],
  ['iransk', 'IRN'],
  ['irack', 'IRQ'],
  ['syryjsk', 'SYR'],
  ['saudyjsk', 'SAU'],
  ['egipsk', 'EGY'],
  ['indyjsk', 'IND'],
  ['pakistansk', 'PAK'],
  ['chinsk', 'CHN'],
  ['japonsk', 'JPN'],
  ['koreansk', 'KOR'],
  ['wietnamsk', 'VNM'],
  ['amerykansk', 'USA'],
  ['kanadyjsk', 'CAN'],
  ['meksykansk', 'MEX'],
  ['brazylijsk', 'BRA'],
  ['argentynsk', 'ARG'],
  ['chilijsk', 'CHL'],
  ['peruwiansk', 'PER'],
  ['australijsk', 'AUS'],
  ['afgansk', 'AFG'],
  ['kenijsk', 'KEN'],
  ['rwandyjsk', 'RWA'],
  ['tanzansk', 'TZA'],
  ['ugandyjsk', 'UGA'],
  ['etiopsk', 'ETH'],
  ['nigeryjsk', 'NGA'],
  ['marokansk', 'MAR'],
  ['algiersk', 'DZA'],
  ['gruzinsk', 'GEO'],
  ['ormiansk', 'ARM'],
  ['azerbejdzansk', 'AZE'],
  ['kazachsk', 'KAZ'],
  ['mongolsk', 'MNG'],
  ['tajwansk', 'TWN'],
  ['filipinsk', 'PHL'],
  ['indonezyjsk', 'IDN'],
  ['tajlandzk', 'THA'],
  ['wenezuelsk', 'VEN'],
  ['kolumbijsk', 'COL'],
  ['kubansk', 'CUB'],
];

function enPart(part: string): string | null {
  const p = part.toLowerCase();
  if (EN_COMBINING[p] !== undefined) return EN_COMBINING[p];
  if (COMPOUND_CODES[p] !== undefined) return COMPOUND_CODES[p];
  const demonym = resolveCountriesByDemonym(part);
  if (demonym.length === 1) return demonym[0].iso3;
  if (p.length >= 4) {
    const c = resolveCountryByAnyIdentifier(part);
    if (c !== undefined && p.toUpperCase() !== c.iso2 && p.toUpperCase() !== c.iso3) return c.iso3;
  }
  return null;
}

function plPart(part: string): string | null {
  const p = foldPl(part.toLowerCase());
  /* a combining form ends in -o ("polsko-", "niemiecko-"); an adjective in its case ending */
  for (const [stem, iso3] of PL_ADJECTIVE_STEMS) if (p.startsWith(stem)) return iso3;
  return null;
}

/** Country pairs written as a combined adjective ("Franco-German", "polsko-litewskie"). */
export function combinedCountryAdjectives(text: string, language: string): Array<[string, string]> {
  return combinedCountryAdjectiveSpans(text, language).map((s) => [s.a, s.b]);
}

export interface CombinedAdjectiveSpan {
  readonly a: string;
  readonly b: string;
  readonly start: number;
  readonly end: number;
  readonly surface: string;
}

/** CTO R4 semantic IR — the same combined adjectives, with where the reader wrote them. */
export function combinedCountryAdjectiveSpans(
  text: string,
  language: string,
): CombinedAdjectiveSpan[] {
  const out: CombinedAdjectiveSpan[] = [];
  for (const m of text.matchAll(/(?<![\p{L}-])([\p{L}]{2,})-([\p{L}]{2,})(?![\p{L}])/gu)) {
    const a = language === 'pl' ? (plPart(m[1]) ?? enPart(m[1])) : (enPart(m[1]) ?? plPart(m[1]));
    const b = language === 'pl' ? (plPart(m[2]) ?? enPart(m[2])) : (enPart(m[2]) ?? plPart(m[2]));
    if (a !== null && b !== null && a !== b) {
      /* a combining FORM ("Franco-", "Sino-", "polsko-") or a demonym pair; two full country names
         joined by a hyphen ("Congo-Rwanda") are a coordination, read by the entity scanner */
      const start = m.index ?? 0;
      out.push({ a, b, start, end: start + m[0].length, surface: m[0] });
    }
  }
  return out;
}

/*
  CTO R4 FIFTH PASS — POLISH COUNTRY NAMES IN ANY GRAMMATICAL CASE. "Stanów Zjednoczonych",
  "Korei Północnej", "Koreą Południową", "w Stanach Zjednoczonych" are cases of the canonical
  Polish names the registry already holds (Intl display names: "Stany Zjednoczone", "Korea
  Północna"). Each word is REVERSE-INFLECTED with a bounded set of Polish case endings and the
  candidate is accepted ONLY if it is exactly a registry nominative — never a near-spelling.
*/
let PL_NOMINATIVES: Map<string, string> | null = null;
function plNominatives(): Map<string, string> {
  if (PL_NOMINATIVES !== null) return PL_NOMINATIVES;
  const map = new Map<string, string>();
  for (const c of COUNTRIES) {
    const name = getLocalizedCountryName(c.iso2, 'pl' as never);
    if (name !== undefined) map.set(foldPl(name.toLowerCase()), c.iso3);
  }
  PL_NOMINATIVES = map;
  return map;
}
/* folded case endings → nominative endings (nouns and adjectives, singular and plural) */
const PL_CASE_ENDINGS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['ymi', ['e', 'y']],
  ['ami', ['y', 'a']],
  ['ach', ['y']],
  ['ych', ['e', 'y']],
  ['ich', ['ie']],
  ['ow', ['y']],
  ['om', ['y']],
  ['ym', ['e', 'y']],
  ['im', ['i']],
  ['ej', ['a']],
  ['ego', ['y', 'e']],
  /* neuter nouns ("Maroko" → Marokiem / Maroka, "Kosowo") */
  ['iem', ['', 'o']],
  ['em', ['', 'o']],
  ['ii', ['ia', 'ie']],
  ['ji', ['ja']],
  ['sce', ['ska']],
  ['dze', ['ga']],
  ['ie', ['', 'a', 'ia']],
  ['i', ['a', 'ia', 'ie', 'y']],
  ['y', ['a', 'y']],
  ['e', ['a']],
  ['a', ['a', '', 'o']],
  ['u', ['']],
  /* a genitive plural with an inserted vowel: Węgier ← Węgry, Niemiec ← Niemcy */
  ['ier', ['ry']],
  ['iec', ['cy']],
];
function plWordForms(word: string): string[] {
  const w = foldPl(word.toLowerCase());
  /* a zero-ending plural genitive ("Czech", "Węgier", "Chin") → its plural nominative (+y / +i) */
  const out = new Set([w, `${w}y`, `${w}i`]);
  for (const [ending, replacements] of PL_CASE_ENDINGS)
    if (w.endsWith(ending) && w.length > ending.length + 2)
      for (const r of replacements) out.add(w.slice(0, w.length - ending.length) + r);
  return [...out];
}

/** A Polish country name in any common case ("Stanów Zjednoczonych" → USA), or null. */
export function resolvePolishCountryForm(phrase: string): string | null {
  const words = phrase
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  if (words.length === 0 || words.length > 3) return null;
  const nominatives = plNominatives();
  let candidates = [''];
  for (const word of words) {
    const next: string[] = [];
    for (const prefix of candidates)
      for (const form of plWordForms(word)) next.push(prefix === '' ? form : `${prefix} ${form}`);
    candidates = next.slice(0, 600);
  }
  for (const c of candidates) {
    const iso3 = nominatives.get(c);
    if (iso3 !== undefined) return iso3;
  }
  return null;
}

/* lowercase words that are also countries: a possessive is read only when capitalised */
const HOMOGRAPHS = new Set([
  'turkey',
  'chad',
  'jordan',
  'georgia',
  'china',
  'japan',
  'niger',
  'guinea',
  'panama',
]);

/**
 * "brazils presidential election" → "brazil's presidential election": an omitted apostrophe on a
 * COUNTRY possessive is restored only when a noun follows and the stem is a country name (never a
 * homograph written in lowercase). Capitalisation is preserved as written.
 */
export function restoreCountryPossessives(text: string): string {
  return text.replace(/\b([\p{L}]{3,})s\b(?=\s+\p{L})/gu, (whole, stem: string) => {
    if (HOMOGRAPHS.has(stem)) return whole;
    const c = resolveCountryByAnyIdentifier(stem);
    if (c === undefined || stem.length < 4) return whole;
    if (stem.toUpperCase() === c.iso2 || stem.toUpperCase() === c.iso3) return whole;
    return `${stem}'s`;
  });
}
