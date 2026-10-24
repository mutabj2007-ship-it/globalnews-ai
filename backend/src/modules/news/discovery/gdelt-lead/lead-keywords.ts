import {
  COUNTRIES,
  COUNTRY_ALIASES_BY_ISO3,
  getCuratedCityNames,
  normalizeGeographicLookupKey,
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
  | { readonly kind: 'SUPPRESSED' };

interface PlaceEntry {
  readonly key: string; // lowercase lookup form
  readonly sent: string; // gazetteer spelling sent to GDELT
}

let placeIndex: readonly PlaceEntry[] | null = null;

function places(): readonly PlaceEntry[] {
  if (placeIndex !== null) return placeIndex;
  const entries = new Map<string, string>();
  const key = normalizeGeographicLookupKey;
  for (const country of COUNTRIES) entries.set(key(country.name), country.name);
  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES_BY_ISO3)) {
    const country = COUNTRIES.find((c) => c.iso3 === iso3);
    /* aliases of 4+ letters only: "us", "uk", "drc" stay out — "us" is a pronoun */
    if (country !== undefined && alias.length >= 4) entries.set(key(alias), country.name);
  }
  for (const city of getCuratedCityNames()) entries.set(key(city), city);
  for (const ambiguous of AMBIGUOUS_PLACE_NAMES) entries.delete(ambiguous);
  /* longest first, so "south sudan" wins over "sudan" and "papua new guinea" over "guinea" */
  placeIndex = [...entries]
    .map(([key, sent]) => ({ key, sent }))
    .sort((a, b) => b.key.length - a.key.length);
  return placeIndex;
}

function containsTerm(haystack: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').exec(haystack);
  return match === null ? -1 : match.index;
}

/** Deterministic: the same question always yields the same keywords. */
export function deriveLeadKeywords(question: string): LeadKeywords {
  const text = question.slice(0, 500);
  if (SENSITIVE_MARKERS.some((pattern) => pattern.test(text))) return { kind: 'SUPPRESSED' };
  const lower = normalizeGeographicLookupKey(text);
  let place: string | null = null;
  for (const entry of places()) {
    if (containsTerm(lower, entry.key) >= 0) {
      place = entry.sent;
      break;
    }
  }
  if (place === null) return { kind: 'NO_PLACE' };
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
