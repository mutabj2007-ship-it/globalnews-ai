import {
  COUNTRIES,
  COUNTRY_ALIASES_BY_ISO3,
  getCuratedCityNames,
  normalizeGeographicLookupKey,
  resolveCountryByCity,
} from '@globalnews-ai/shared';

/*
  CTO R168 · PRIVACY — the reader's question NEVER leaves this server. What GDELT receives is built
  only from two closed, reviewable vocabularies:
    1. a PLACE: the canonical English name of a country from the shared gazetteer, or a curated city
       name from the same table. The gazetteer's spelling is sent, never the reader's.
    2. at most two TOPICS from LEAD_TOPICS below, sent as the canonical keyword on the right.
  A question with no place in the gazetteer looks nothing up (NO_PLACE): a generic or conceptual
  question gets zero leads rather than an unrelated list. A question carrying contact details, an
  address-like number or a personal/sensitive marker looks nothing up at all (SUPPRESSED), even
  though none of its words would be sent.
*/

/** surface form (lowercase, as it appears in a question) → the keyword sent to GDELT */
export const LEAD_TOPICS: Readonly<Record<string, string>> = Object.freeze({
  economy: 'economy',
  economic: 'economy',
  economics: 'economy',
  inflation: 'inflation',
  prices: 'prices',
  budget: 'budget',
  tax: 'tax',
  taxes: 'tax',
  debt: 'debt',
  currency: 'currency',
  shilling: 'currency',
  trade: 'trade',
  exports: 'exports',
  imports: 'imports',
  jobs: 'unemployment',
  unemployment: 'unemployment',
  fuel: 'fuel',
  oil: 'oil',
  energy: 'energy',
  electricity: 'electricity',
  food: 'food',
  drought: 'drought',
  flood: 'floods',
  floods: 'floods',
  flooding: 'floods',
  earthquake: 'earthquake',
  cyclone: 'cyclone',
  election: 'election',
  elections: 'election',
  vote: 'election',
  parliament: 'parliament',
  protest: 'protest',
  protests: 'protest',
  strike: 'strike',
  strikes: 'strike',
  conflict: 'conflict',
  fighting: 'fighting',
  war: 'war',
  ceasefire: 'ceasefire',
  refugees: 'refugees',
  displacement: 'displacement',
  humanitarian: 'humanitarian',
  aid: 'aid',
  outbreak: 'outbreak',
  cholera: 'cholera',
  ebola: 'ebola',
  mpox: 'mpox',
  security: 'security',
  attack: 'attack',
  attacks: 'attack',
  court: 'court',
  corruption: 'corruption',
  censorship: 'censorship',
  media: 'media',
  internet: 'internet',
  mining: 'mining',
  agriculture: 'agriculture',
  tourism: 'tourism',
  investment: 'investment',
  bank: 'central bank',
  rates: 'interest rates',
});

/* Names that are not one place, or not only a place. Never sent: Congo is two countries (the
   COD/COG trap), Georgia is also a US state. */
const AMBIGUOUS_PLACE_NAMES: ReadonlySet<string> = new Set(['congo', 'georgia']);

const SENSITIVE_MARKERS: readonly RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/u, // an e-mail address
  /https?:\/\/|www\./iu, // a link
  /(?:\d[\s().-]?){6,}/u, // a phone-, account- or ID-like run of digits
  /\b(?:my|mine|me|i'm|i am|our)\b.*\b(?:diagnos\w*|illness|pregnan\w*|hiv|lawyer|lawsuit|salary|password|bank account|address|visa|asylum case|debt collector)\b/iu,
  /\b(?:password|passport number|national id|pesel|social security)\b/iu,
];

export type LeadKeywords =
  | {
      readonly kind: 'QUERY';
      readonly place: string;
      readonly topics: readonly string[];
      readonly gdeltQuery: string;
    }
  | { readonly kind: 'NO_PLACE' }
  | { readonly kind: 'MULTI_PLACE' }
  | { readonly kind: 'SUPPRESSED' };

/*
  EA R168 (A) — places that are NOT countries but whose names contain a country's name. GDELT's
  phrase search for "niger" also finds the Niger Delta (Nigeria), "mexico" finds New Mexico,
  "ireland" finds Northern Ireland, "jersey" finds New Jersey. In a question they are masked (never
  read as the country); as a SENT name, a country contained in one is never sent.
  (Follow-up, not relied on: GDELT's minus operator could keep Sudan/Niger/Mexico with exclusions
  once its behaviour is verified; until then such places fail closed to zero leads.)
*/
const NON_COUNTRY_CONTAINERS: readonly string[] = [
  'niger delta',
  'niger river',
  'new mexico',
  'new jersey',
  'northern ireland',
  /* EA R168 P2-2 — a US territory absent from COUNTRIES; "samoa" alone would find it */
  'american samoa',
];

/*
  EA R168 P3 — country names that are also common words or people ("Michael Jordan", roast turkey,
  "Chad"). Only a locative cue right before them ("in Jordan", "from Turkey") makes them a place to
  SEND; without one they still count as a named place (detect-only), never sent alone.
*/
const CUE_REQUIRED: ReadonlySet<string> = new Set(['jordan', 'turkey', 'chad']);
const LOCATIVE_CUE = '(?:in|from|to|across|inside|at|near|between|within|into|throughout)';

interface PlaceEntry {
  readonly key: string; // normalized lookup form
  readonly sent: string; // gazetteer spelling sent to GDELT
  readonly iso3: string;
  readonly isCity: boolean;
  /*
    EA R168 P2-1 — an ambiguous place is still DETECTED: it counts toward "two places named"
    (MULTI_PLACE) and alone gives NO_PLACE, but it is never sent. Dropping it from detection let
    "Is Ethiopia's dam affecting Sudan?" send Ethiopia alone.
  */
  readonly detectOnly: boolean;
}

let placeIndex: readonly PlaceEntry[] | null = null;

function places(): readonly PlaceEntry[] {
  if (placeIndex !== null) return placeIndex;
  const key = normalizeGeographicLookupKey;
  const entries = new Map<string, PlaceEntry>();
  const put = (lookup: string, sent: string, iso3: string, isCity: boolean) =>
    entries.set(key(lookup), { key: key(lookup), sent, iso3, isCity, detectOnly: false });
  for (const country of COUNTRIES) put(country.name, country.name, country.iso3, false);
  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES_BY_ISO3)) {
    const country = COUNTRIES.find((c) => c.iso3 === iso3);
    /* aliases of 4+ letters only: "us", "uk", "drc" stay out — "us" is a pronoun */
    if (country !== undefined && alias.length >= 4) put(alias, country.name, iso3, false);
  }
  for (const city of getCuratedCityNames()) {
    const iso3 = resolveCountryByCity(city)?.iso3;
    if (iso3 !== undefined) put(city, city, iso3, true);
  }
  /*
    EA R168 P1 — ambiguity is judged on the name SENT, never on the reader's spelling: an alias of
    an ambiguous place ("congo brazzaville" → "Congo") is dropped with it. A sent name that sits
    word-bounded inside ANOTHER country's name ("republic of the congo" in the DRC's, "sudan" in
    "south sudan", "guinea" in "papua new guinea") or inside a non-country container is not one
    place to a phrase search either. Such a place looks nothing up: zero leads, never mixed ones.
  */
  const containers = [...COUNTRIES.map((c) => key(c.name)), ...NON_COUNTRY_CONTAINERS];
  const ambiguous = (sent: string): boolean => {
    const s = key(sent);
    return (
      AMBIGUOUS_PLACE_NAMES.has(s) ||
      containers.some((other) => other !== s && containsTerm(other, s) >= 0)
    );
  };
  for (const [lookup, entry] of [...entries]) {
    if (!ambiguous(entry.sent)) continue;
    /* bare "congo" / "georgia" name no single country: their own sentinel, so they never merge */
    const iso3 = AMBIGUOUS_PLACE_NAMES.has(lookup) ? `?${lookup}` : entry.iso3;
    entries.set(lookup, { ...entry, iso3, detectOnly: true });
  }
  /* longest first, so "south sudan" is read (and masked) before anything shorter inside it */
  placeIndex = [...entries.values()].sort((a, b) => b.key.length - a.key.length);
  return placeIndex;
}

function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
}

function containsTerm(haystack: string, term: string): number {
  const match = termPattern(term).exec(haystack);
  return match === null ? -1 : match.index;
}

/** Deterministic: the same question always yields the same keywords. */
export function deriveLeadKeywords(question: string): LeadKeywords {
  const text = question.slice(0, 500);
  if (SENSITIVE_MARKERS.some((pattern) => pattern.test(text))) return { kind: 'SUPPRESSED' };
  let lower = normalizeGeographicLookupKey(text);
  for (const container of NON_COUNTRY_CONTAINERS)
    lower = lower.replace(termPattern(container), ' ');
  /*
    EA R168 (C) — every place named, longest first, each match masked so a nested name is not
    counted twice ("south sudan" never also counts "sudan"). Two DIFFERENT countries named → nothing
    is looked up (MULTI_PLACE): picking one by string length would put Ukraine leads under a Kenya
    answer. A city and its own country are one place (Goma + DR Congo = COD); the country is sent.
  */
  const found: PlaceEntry[] = [];
  let rest = lower;
  for (const entry of places()) {
    const pattern = termPattern(entry.key);
    if (pattern.test(rest)) {
      const cued =
        !CUE_REQUIRED.has(entry.key) ||
        new RegExp(
          `(?<![\\p{L}\\p{N}])${LOCATIVE_CUE}\\s+${entry.key}(?![\\p{L}\\p{N}])`,
          'u',
        ).test(rest);
      found.push(cued ? entry : { ...entry, detectOnly: true });
      rest = rest.replace(termPattern(entry.key), ' ');
    }
  }
  if (found.length === 0) return { kind: 'NO_PLACE' };
  if (new Set(found.map((f) => f.iso3)).size > 1) return { kind: 'MULTI_PLACE' };
  if (found.some((f) => f.detectOnly)) return { kind: 'NO_PLACE' };
  const place = (found.find((f) => !f.isCity) ?? found[0]).sent;
  const topics: string[] = [];
  for (const word of lower.split(/[^\p{L}]+/u)) {
    const topic = Object.prototype.hasOwnProperty.call(LEAD_TOPICS, word)
      ? LEAD_TOPICS[word]
      : undefined;
    if (topic !== undefined && !topics.includes(topic)) topics.push(topic);
    if (topics.length === 2) break;
  }
  const quoted = (term: string) => `"${term.toLowerCase()}"`;
  const gdeltQuery =
    topics.length === 0
      ? quoted(place)
      : topics.length === 1
        ? `${quoted(place)} ${quoted(topics[0])}`
        : `${quoted(place)} (${topics.map(quoted).join(' OR ')})`;
  return { kind: 'QUERY', place, topics, gdeltQuery };
}
