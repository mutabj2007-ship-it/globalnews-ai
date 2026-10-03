import {
  findCountryByIso2,
  findCountryByIso3,
  resolveCountryByAnyIdentifier,
} from '@globalnews-ai/shared';
import { resolvePolishCountry } from '../../analysis/query/polish-country-forms.util';
import { citiesByExonym, citiesNamed } from '../../geo/geo-gazetteer';
import { foldPlaceName } from '../../geo/geo-normalize.util';
import { combinedCountryAdjectiveSpans, resolvePolishCountryForm } from '../country-morphology';
import { foldPl } from '../pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §11 — STAGE A: CANONICAL ENTITY CANDIDATES (identity, never role)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every place the reader wrote is resolved to ONE canonical identity with its span and TYPE
 * before any role is assigned:
 *
 *   COUNTRY     a state in the registry — any case, possessive, Polish grammatical case, a
 *               governed alias ("DR Congo" → COD, "Republic of the Congo" → COG, "U.S." / "US" →
 *               USA, "UK" / "U.K." / "Britain" → GBR)
 *   TERRITORY   a registry entry with a territorial status ("Falkland Islands" → FLK)
 *   REGION      a governed disputed / named region that is not a state (Senkaku, Kashmir, Crimea)
 *   CITY        a settlement in the gazetteer, read only where a place preposition introduces it
 *               ("in Doha", "w Taszkencie") — it keeps its parent country as a fact about the
 *               city, NEVER as a country the reader named
 *
 * Lowercase: a full country name is read in lowercase ("venezuela"); a word that is also an
 * ordinary English word ("turkey", "china", "chad", "jordan", "georgia"…) and the pronoun-like
 * "us" are read ONLY in context — coordinated with another country ("the us and venezuela"),
 * after "the" ("the us"), or before a state noun ("us officials"). "tell us why" is never a
 * country. Stage B (roles.ts) may never change an identity resolved here. Pure.
 */
/** PLACE: a place candidate the gazetteer could not resolve — unresolved, never an actor */
export type EntityType = 'COUNTRY' | 'TERRITORY' | 'REGION' | 'CITY' | 'PLACE';
export type EntityBasis =
  | 'NAME'
  | 'ALIAS'
  | 'PL_CASE'
  | 'LOWERCASE_IN_CONTEXT'
  | 'COMBINED_ADJECTIVE'
  | 'GAZETTEER_CITY'
  | 'GOVERNED_REGION'
  | 'UNRESOLVED_PLACE';

export interface EntityCandidate {
  /** canonical id: COUNTRY:ISO3 · TERRITORY:ISO3 · REGION:KEY · CITY:ISO2:Name */
  readonly id: string;
  readonly type: EntityType;
  /** ISO3 for a COUNTRY / TERRITORY; null for a REGION / CITY */
  readonly iso3: string | null;
  /** a CITY's / TERRITORY's country (a fact about the place, never a named actor) */
  readonly parentIso3: string | null;
  readonly surface: string;
  readonly start: number;
  readonly end: number;
  readonly basis: EntityBasis;
}

type Lang = 'en' | 'pl';

/* JS `\b` is ASCII-only: Polish forms ending in "ą" / "ł" need a Unicode word boundary */
const UNICODE_BOUNDARY = String.raw`(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))`;
function ub(re: RegExp): RegExp {
  const flags = re.flags.includes('u') ? re.flags : `${re.flags}u`;
  return new RegExp(re.source.replace(/\\b/g, UNICODE_BOUNDARY), flags);
}

/* ── governed aliases (identity data) ─────────────────────────────────────────────────────── */
const ALIASES: ReadonlyArray<readonly [RegExp, string]> = (
  [
    [
      /\b(?:the\s+)?(?:democratic\s+republic\s+of\s+(?:the\s+)?congo|d\.?\s?r\.?\s?congo|drc|congo[-\s]kinshasa|demokratyczn\p{L}*\s+republik\p{L}*\s+kong\p{L}*|dr\s+kong\p{L}*|drk)\b/giu,
      'COD',
    ],
    [
      /\b(?:the\s+)?(?:republic\s+of\s+(?:the\s+)?congo|congo[-\s]brazzaville|republik\p{L}*\s+kong\p{L}*|kongo[-\s]brazzaville)\b/giu,
      'COG',
    ],
    [/\bU\.\s?S\.(?:\s?A\.)?|\bUSA\b|\bUS\b/gu, 'USA'],
    [/\bU\.\s?K\.|\bUK\b|\b(?:great\s+)?britain\b/giu, 'GBR'],
    [/\bU\.\s?A\.\s?E\.|\bUAE\b/gu, 'ARE'],
    [/\b(?:falklandy|falklandów|falklandach|falklandami|malwiny|malwinów|malwinach)\b/giu, 'FLK'],
  ] as ReadonlyArray<readonly [RegExp, string]>
).map(([re, iso3]) => [ub(re), iso3] as const);
/* lowercase forms that are ALSO ordinary words: read only in context */
const EN_HOMOGRAPHS = new Set([
  'turkey',
  'chad',
  'jordan',
  'georgia',
  'china',
  'japan',
  'niger',
  'guinea',
  'panama',
  'cuba',
  'chile',
  'malta',
  'congo',
]);
/* a state noun after a lowercase short form makes it the country ("us officials", "uk government") */
const STATE_NOUN_AFTER =
  /^\s*(?:-|\s)?(?:officials?|government|administration|president|presidency|military|army|navy|forces|troops|economy|sanctions|tariffs?|dollar|treasury|congress|senate|parliament|election|elections|embassy|policy|policies|relations|ties|trade|ambassador|diplomats?|intelligence|federal|state\s+department|defen[cs]e|interest\s+rates?|inflation|markets?|stocks?|banks?|-\p{L}+)\b/iu;

/* ── governed regions (non-state places that can be disputed objects) ─────────────────────── */
const REGIONS: ReadonlyArray<readonly [string, RegExp]> = (
  [
    [
      'SENKAKU',
      /\b(?:senkaku(?:\s+islands)?|senkakus|diaoyu(?:\s+islands)?|wysp\p{L}*\s+senkaku)\b/giu,
    ],
    ['KASHMIR', /\b(?:kashmir|kaszmir\p{L}*)\b/giu],
    [
      'CRIMEA',
      /\b(?:crimea(?:n\s+peninsula)?|krym|krymu|krymie|półwysp\p{L}*\s+krymsk\p{L}*)\b/giu,
    ],
    [
      'KARABAKH',
      /\b(?:nagorno[-\s]karabakh|karabakh|artsakh|górsk\p{L}*\s+karabach\p{L}*|karabach\p{L}*)\b/giu,
    ],
    ['GOLAN', /\b(?:(?:the\s+)?golan(?:\s+heights)?|wzgórz\p{L}*\s+golan)\b/giu],
    [
      'KURILS',
      /\b(?:kuril(?:e)?\s+islands|kurils|kuryl\p{L}*|wysp\p{L}*\s+kurylsk\p{L}*|northern\s+territories)\b/giu,
    ],
    ['SPRATLY', /\b(?:spratly(?:\s+islands)?|spratlys|wysp\p{L}*\s+spratly)\b/giu],
    ['PARACEL', /\b(?:paracel(?:\s+islands)?|wysp\p{L}*\s+paracelsk\p{L}*)\b/giu],
    [
      'SOUTH_CHINA_SEA',
      /\b(?:south\s+china\s+sea|morz\p{L}*\s+południowochińsk\p{L}*|morz\p{L}*\s+poludniowochinsk\p{L}*)\b/giu,
    ],
    ['ESSEQUIBO', /\b(?:essequibo|esequibo)\b/giu],
    ['ABYEI', /\babyei\b/giu],
    ['TRANSNISTRIA', /\b(?:transnistria|naddniestrz\p{L}*)\b/giu],
    ['DONBAS', /\b(?:donbas+|donbas\p{L}*)\b/giu],
    ['ABKHAZIA', /\b(?:abkhazia|abchazj\p{L}*)\b/giu],
    ['SOUTH_OSSETIA', /\b(?:south\s+ossetia|osetii?\s+południow\p{L}*|osetia\s+południowa)\b/giu],
    ['ARUNACHAL', /\barunachal(?:\s+pradesh)?\b/giu],
    ['AKSAI_CHIN', /\baksai\s+chin\b/giu],
    ['CHAGOS', /\b(?:chagos(?:\s+(?:islands|archipelago))?|czagos)\b/giu],
    ['GAZA', /\b(?:gaza(?:\s+strip)?|stref\p{L}*\s+gazy)\b/giu],
    ['WEST_BANK', /\b(?:west\s+bank|zachodni\p{L}*\s+brzeg\p{L}*)\b/giu],
    ['HANS_ISLAND', /\bhans\s+island\b/giu],
    ['CEUTA_MELILLA', /\b(?:ceuta|melilla)\b/giu],
  ] as ReadonlyArray<readonly [string, RegExp]>
).map(([key, re]) => [key, ub(re)] as const);

/* ── Polish city exonyms with their case forms (closed identity data) ─────────────────────── */
const PL_CITIES: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ['Doha', 'QA', ['doha', 'dohy', 'dosze', 'dohą', 'doha']],
  ['Geneva', 'CH', ['genewa', 'genewy', 'genewie', 'genewą']],
  ['Vienna', 'AT', ['wiedeń', 'wiednia', 'wiedniu', 'wiedniem']],
  ['Istanbul', 'TR', ['stambuł', 'stambułu', 'stambule', 'stambułem']],
  ['Tashkent', 'UZ', ['taszkent', 'taszkentu', 'taszkencie', 'taszkentem']],
  ['Moscow', 'RU', ['moskwa', 'moskwy', 'moskwie', 'moskwą']],
  ['Washington', 'US', ['waszyngton', 'waszyngtonu', 'waszyngtonie', 'waszyngtonem']],
  ['Paris', 'FR', ['paryż', 'paryża', 'paryżu', 'paryżem']],
  ['Cairo', 'EG', ['kair', 'kairu', 'kairze', 'kairem']],
  ['Brussels', 'BE', ['bruksela', 'brukseli', 'brukselą']],
  ['Sochi', 'RU', ['soczi']],
  ['Astana', 'KZ', ['astana', 'astany', 'astanie', 'astaną']],
  ['Riyadh', 'SA', ['rijad', 'rijadu', 'rijadzie', 'rijadem']],
  ['Jeddah', 'SA', ['dżudda', 'dżuddy', 'dżuddzie']],
  ['Abu Dhabi', 'AE', ['abu zabi', 'abu dhabi']],
  ['Dubai', 'AE', ['dubaj', 'dubaju', 'dubajem']],
  ['Beijing', 'CN', ['pekin', 'pekinu', 'pekinie', 'pekinem']],
  ['Tehran', 'IR', ['teheran', 'teheranu', 'teheranie', 'teheranem']],
  ['Ankara', 'TR', ['ankara', 'ankary', 'ankarze', 'ankarą']],
  ['Kyiv', 'UA', ['kijów', 'kijowa', 'kijowie', 'kijowem']],
  ['Minsk', 'BY', ['mińsk', 'mińska', 'mińsku', 'mińskiem']],
  ['The Hague', 'NL', ['haga', 'hagi', 'hadze', 'hagą']],
  ['Lausanne', 'CH', ['lozanna', 'lozanny', 'lozannie']],
  ['Rome', 'IT', ['rzym', 'rzymu', 'rzymie', 'rzymem']],
  ['London', 'GB', ['londyn', 'londynu', 'londynie', 'londynem']],
  ['Berlin', 'DE', ['berlin', 'berlina', 'berlinie', 'berlinem']],
  ['Warsaw', 'PL', ['warszawa', 'warszawy', 'warszawie', 'warszawą']],
  ['Baghdad', 'IQ', ['bagdad', 'bagdadu', 'bagdadzie']],
  ['Damascus', 'SY', ['damaszek', 'damaszku', 'damaszkiem']],
  ['Beirut', 'LB', ['bejrut', 'bejrutu', 'bejrucie']],
  ['Yerevan', 'AM', ['erywań', 'erywania', 'erywaniu']],
  ['Tbilisi', 'GE', ['tbilisi']],
  ['Baku', 'AZ', ['baku']],
  ['Oslo', 'NO', ['oslo']],
  ['Helsinki', 'FI', ['helsinki', 'helsinkach']],
  ['Nairobi', 'KE', ['nairobi']],
  ['Kampala', 'UG', ['kampala', 'kampali']],
  ['Luanda', 'AO', ['luanda', 'luandy', 'luandzie']],
  ['Arusha', 'TZ', ['arusza', 'aruszy', 'aruszą']],
  ['Addis Ababa', 'ET', ['addis abeba', 'addis abebie', 'addis abeby']],
  ['Havana', 'CU', ['hawana', 'hawany', 'hawanie']],
  ['Muscat', 'OM', ['maskat', 'maskatu', 'maskacie']],
  ['Madrid', 'ES', ['madryt', 'madrytu', 'madrycie']],
  ['Lisbon', 'PT', ['lizbona', 'lizbony', 'lizbonie']],
  ['Prague', 'CZ', ['praga', 'pragi', 'pradze']],
  ['Budapest', 'HU', ['budapeszt', 'budapesztu', 'budapeszcie']],
  ['Belgrade', 'RS', ['belgrad', 'belgradu', 'belgradzie']],
  ['Kabul', 'AF', ['kabul', 'kabulu']],
  ['Islamabad', 'PK', ['islamabad', 'islamabadu', 'islamabadzie']],
  ['Tokyo', 'JP', ['tokio']],
  ['Seoul', 'KR', ['seul', 'seulu']],
  ['Pyongyang', 'KP', ['phenian', 'phenianu', 'phenianie']],
  ['Kigali', 'RW', ['kigali']],
  ['Munich', 'DE', ['monachium']],
  ['Davos', 'CH', ['davos']],
  ['Vilnius', 'LT', ['wilno', 'wilna', 'wilnie']],
  ['Riga', 'LV', ['ryga', 'rygi', 'rydze']],
  ['Tallinn', 'EE', ['tallin', 'tallinn', 'tallinie']],
  ['Athens', 'GR', ['ateny', 'aten', 'atenach']],
  ['Copenhagen', 'DK', ['kopenhaga', 'kopenhagi', 'kopenhadze']],
  ['Stockholm', 'SE', ['sztokholm', 'sztokholmu', 'sztokholmie']],
  ['Ottawa', 'CA', ['ottawa', 'ottawy', 'ottawie']],
  ['Jerusalem', '', ['jerozolima', 'jerozolimy', 'jerozolimie']],
  ['Camp David', 'US', ['camp david']],
  ['Dayton', 'US', ['dayton']],
  ['Hanoi', 'VN', ['hanoi']],
  ['Singapore', 'SG', ['singapur', 'singapurze']],
];
const PL_CITY_INDEX: ReadonlyMap<string, readonly [string, string]> = (() => {
  const m = new Map<string, readonly [string, string]>();
  for (const [name, iso2, forms] of PL_CITIES)
    for (const f of forms) m.set(foldPl(f.toLowerCase()), [name, iso2]);
  return m;
})();

/* a place preposition right before a span: where a city may be read */
const EN_PLACE_PREP =
  /(?:\b(?:in|at|near|from|to|outside|inside|hosted\s+(?:in|by)|held\s+in|brokered\s+in|signed\s+in|met\s+in|talks\s+in|summit\s+in|meeting\s+in|venue\s+(?:of|in)|via)\s+(?:the\s+)?)$/i;
const PL_PLACE_PREP = /(?:(?:^|\s)(?:w|we|do|z|ze|pod|koło|obok|przez)\s+)$/iu;
/* a venue context: the event happened there */
const MIN_CITY_POPULATION = 100_000;
const MIN_VENUE_CITY_POPULATION = 20_000;

interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(/[\p{L}][\p{L}\p{M}]*(?:['’][\p{L}]+)?/gu))
    out.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  return out;
}

const isCapitalised = (s: string): boolean => /^\p{Lu}/u.test(s);
const stripPossessive = (s: string): string => s.replace(/['’]s$/u, '').replace(/['’]$/u, '');

function countryMeta(iso3: string) {
  return findCountryByIso3(iso3);
}
function typeOf(iso3: string): 'COUNTRY' | 'TERRITORY' {
  const c = countryMeta(iso3) as { status?: string } | undefined;
  return c?.status === undefined || c.status === 'CONTESTED_STATUS' ? 'COUNTRY' : 'TERRITORY';
}
function parentOf(iso3: string): string | null {
  const c = countryMeta(iso3) as { partOf?: string } | undefined;
  return c?.partOf ?? null;
}

function overlaps(spans: readonly { start: number; end: number }[], s: number, e: number): boolean {
  return spans.some((x) => s < x.end && e > x.start);
}

interface Pending extends EntityCandidate {
  /** read only if context confirms it (a lowercase homograph / "us") */
  readonly needsContext: boolean;
}

function countryCandidate(
  iso3: string,
  surface: string,
  start: number,
  end: number,
  basis: EntityBasis,
  needsContext = false,
): Pending {
  const type = typeOf(iso3);
  return {
    id: `${type}:${iso3}`,
    type,
    iso3,
    parentIso3: type === 'TERRITORY' ? parentOf(iso3) : null,
    surface,
    start,
    end,
    basis,
    needsContext,
  };
}

/* resolve one window of words to a country / territory, or null */
function resolveWindow(
  surface: string,
  lang: Lang,
): { iso3: string; basis: EntityBasis; needsContext: boolean } | null {
  const clean = stripPossessive(surface).replace(/[^\p{L}\s.-]/gu, '');
  const lower = clean.toLowerCase();
  if (lower === 'us')
    return surface === 'US' ? { iso3: 'USA', basis: 'ALIAS', needsContext: false } : null;
  if (lower === 'uk') return { iso3: 'GBR', basis: 'ALIAS', needsContext: false };
  if (clean.length < 4) return null;
  if (lang === 'pl') {
    const p = resolvePolishCountry(clean);
    if (p !== undefined && p !== null)
      return { iso3: p.iso3, basis: 'NAME', needsContext: !isCapitalised(surface) };
    const inflected = resolvePolishCountryForm(clean);
    if (inflected !== null)
      return { iso3: inflected, basis: 'PL_CASE', needsContext: !isCapitalised(surface) };
  }
  const c = resolveCountryByAnyIdentifier(clean);
  if (c === undefined) return null;
  if (clean.toUpperCase() === c.iso2 || clean.toUpperCase() === c.iso3) return null;
  const homograph = EN_HOMOGRAPHS.has(lower);
  return {
    iso3: c.iso3,
    basis: 'NAME',
    needsContext: homograph && !isCapitalised(surface),
  };
}

function cityOf(
  surface: string,
  lang: Lang,
  venue: boolean,
): { name: string; iso2: string } | null {
  if (!isCapitalised(surface)) return null;
  const folded = foldPl(surface.toLowerCase());
  const pl = PL_CITY_INDEX.get(folded);
  if (pl !== undefined) return { name: pl[0], iso2: pl[1] };
  if (lang === 'pl') return null;
  const key = foldPlaceName(surface);
  const found = [...citiesNamed(key), ...citiesByExonym(key)];
  if (found.length === 0) return null;
  const best = [...found].sort((a, b) => (b.p ?? 0) - (a.p ?? 0))[0];
  const floor = venue ? MIN_VENUE_CITY_POPULATION : MIN_CITY_POPULATION;
  if ((best.p ?? 0) < floor && best.fc !== 'PPLC') return null;
  const countries = new Set(found.filter((c) => (c.p ?? 0) >= floor).map((c) => c.cc));
  return { name: best.n, iso2: countries.size === 1 ? best.cc : '' };
}

const VENUE_PREP =
  /(?:\b(?:hosted\s+(?:in|by)|held\s+in|brokered\s+in|signed\s+in|met\s+in|talks\s+in|summit\s+in|meeting\s+in|negotiations\s+in|agreed\s+in|concluded\s+in)\s+(?:the\s+)?)$/i;
const PL_VENUE_PREP =
  /(?:(?:rozmow|szczyt|spotkani|negocjacj|konferencj|podpisan|zawart)\p{L}*\s+(?:\p{L}+\s+){0,4}?(?:w|we)\s+)$/iu;
/* capitalised words after a venue preposition that are not places (a month, a weekday, a year word) */
const NOT_A_PLACE =
  /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Styczniu|Lutym|Marcu|Kwietniu|Maju|Czerwcu|Lipcu|Sierpniu|Wrześniu|Październiku|Listopadzie|Grudniu|English|Polish|Secret|Private|Public|Person|Parliament|Congress)$/;

/** STAGE A — every place the reader wrote, with canonical identity, type and span. */
export function readEntityCandidates(text: string, language: string): EntityCandidate[] {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const taken: Pending[] = [];

  /* 1 · governed aliases (longest, most specific identities first) */
  for (const [re, iso3] of ALIASES) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const start = (m.index ?? 0) + (m[0].length - m[0].trimStart().length);
      const surface = m[0].trim().replace(/^the\s+/i, '');
      const s = start + (m[0].trim().length - surface.length);
      if (!overlaps(taken, s, s + surface.length))
        taken.push(countryCandidate(iso3, surface, s, s + surface.length, 'ALIAS'));
    }
  }
  /* 2 · governed regions (a disputed place is not a state) */
  for (const [key, re] of REGIONS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const surface = m[0].trim().replace(/^the\s+/i, '');
      const s = (m.index ?? 0) + (m[0].length - surface.length);
      if (!overlaps(taken, s, s + surface.length))
        taken.push({
          id: `REGION:${key}`,
          type: 'REGION',
          iso3: null,
          parentIso3: null,
          surface,
          start: s,
          end: s + surface.length,
          basis: 'GOVERNED_REGION',
          needsContext: false,
        });
    }
  }
  /* 3 · combined adjectives ("Franco-German", "polsko-litewskie"): two identities, one span */
  for (const adj of combinedCountryAdjectiveSpans(text, lang)) {
    if (overlaps(taken, adj.start, adj.end)) continue;
    const hyphen = adj.surface.indexOf('-');
    taken.push(
      countryCandidate(
        adj.a,
        adj.surface.slice(0, hyphen),
        adj.start,
        adj.start + hyphen,
        'COMBINED_ADJECTIVE',
      ),
      countryCandidate(
        adj.b,
        adj.surface.slice(hyphen + 1),
        adj.start + hyphen + 1,
        adj.end,
        'COMBINED_ADJECTIVE',
      ),
    );
  }
  /* 4 · country names: windows of up to four words, longest first, left to right */
  const toks = tokens(text);
  for (let i = 0; i < toks.length; i++) {
    for (let k = Math.min(4, toks.length - i); k >= 1; k--) {
      const first = toks[i];
      const last = toks[i + k - 1];
      const gap = text.slice(first.start, last.end);
      /* only words joined by spaces / hyphens form one name */
      if (k > 1 && !/^[\p{L}\p{M}'’]+(?:[\s-]+[\p{L}\p{M}'’]+)*$/u.test(gap)) continue;
      if (overlaps(taken, first.start, last.end)) continue;
      const hit = resolveWindow(gap, lang);
      if (hit === null) continue;
      taken.push(
        countryCandidate(
          hit.iso3,
          gap,
          first.start,
          last.end,
          hit.needsContext ? 'LOWERCASE_IN_CONTEXT' : hit.basis,
          hit.needsContext,
        ),
      );
      i += k - 1;
      break;
    }
  }
  /* 5 · lowercase "us": a pronoun unless the context makes it the country */
  for (const m of text.matchAll(/\bus\b/g)) {
    const s = m.index ?? 0;
    if (overlaps(taken, s, s + 2)) continue;
    taken.push(countryCandidate('USA', 'us', s, s + 2, 'LOWERCASE_IN_CONTEXT', true));
  }
  /* 6 · cities, only where a place preposition introduces them */
  for (let i = 0; i < toks.length; i++) {
    for (let k = Math.min(3, toks.length - i); k >= 1; k--) {
      const first = toks[i];
      const last = toks[i + k - 1];
      const surface = text.slice(first.start, last.end);
      if (k > 1 && !/^[\p{L}\p{M}'’]+(?:[\s-]+[\p{L}\p{M}'’]+)*$/u.test(surface)) continue;
      if (overlaps(taken, first.start, last.end)) continue;
      const before = text.slice(Math.max(0, first.start - 40), first.start);
      const prep = lang === 'pl' ? PL_PLACE_PREP.test(before) : EN_PLACE_PREP.test(before);
      if (!prep) continue;
      const venueContext = lang === 'pl' ? PL_VENUE_PREP.test(before) : VENUE_PREP.test(before);
      const city = cityOf(surface, lang, venueContext);
      if (city === null) {
        /* hardening §9 — an UNKNOWN place where an event happened ("talks held in Zarvana") is
           an unresolved PLACE candidate: never a country, never an actor, no invented identity */
        if (k === 1 && venueContext && isCapitalised(surface) && !NOT_A_PLACE.test(surface))
          taken.push({
            id: `PLACE:${first.start}`,
            type: 'PLACE',
            iso3: null,
            parentIso3: null,
            surface,
            start: first.start,
            end: last.end,
            basis: 'UNRESOLVED_PLACE',
            needsContext: false,
          });
        continue;
      }
      const parent = city.iso2 === '' ? null : (findCountryByIso2(city.iso2)?.iso3 ?? null);
      taken.push({
        id: `CITY:${city.iso2 || 'XX'}:${city.name}`,
        type: 'CITY',
        iso3: null,
        parentIso3: parent,
        surface,
        start: first.start,
        end: last.end,
        basis: 'GAZETTEER_CITY',
        needsContext: false,
      });
      i += k - 1;
      break;
    }
  }

  /* lowercase-in-context confirmation (coordination / "the us" / a state noun after it) */
  const sorted = taken.sort((a, b) => a.start - b.start);
  const confirmed = (p: Pending): boolean => {
    if (!p.needsContext) return true;
    const before = text.slice(Math.max(0, p.start - 30), p.start);
    const after = text.slice(p.end, p.end + 40);
    if (p.surface.toLowerCase() === 'us' && /\bthe\s+$/i.test(before)) return true;
    if (STATE_NOUN_AFTER.test(after)) return true;
    /* two names coordinated WITH EACH OTHER confirm each other ("polski i szwecji", "china and
       japan"): the pair itself is the evidence — never the pronoun-like "us" on its own side */
    const coordinated = (other: Pending, between: string) =>
      other !== p &&
      (!other.needsContext || other.surface.toLowerCase() !== 'us') &&
      (other.type === 'COUNTRY' || other.type === 'TERRITORY') &&
      /^\s*(?:,\s*)?(?:and|&|-|\/|vs\.?|versus|or|i|a|oraz|z|ze|with)\s*(?:the\s+)?$/iu.test(
        between,
      );
    return sorted.some((o) =>
      o.start >= p.end
        ? coordinated(o, text.slice(p.end, o.start))
        : o.end <= p.start
          ? coordinated(o, text.slice(o.end, p.start))
          : false,
    );
  };
  return sorted.filter(confirmed).map(({ needsContext: _n, ...c }) => {
    void _n;
    return c;
  });
}
