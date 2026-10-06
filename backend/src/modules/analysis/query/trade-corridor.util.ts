import { findCountryByIso3, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { resolveGeography } from '../../geo/geo-resolver';
import { citiesNamed } from '../../geo/geo-gazetteer';
import { foldPlaceName } from '../../geo/geo-normalize.util';
import { resolvePolishCountry } from './polish-country-forms.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 · GEOGRAPHY — A TRADE / SHIPPING CORRIDOR KEEPS EVERY PLACE THE READER NAMED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Measured (TEST B / TEST C): "…importing into Rwanda via Mombasa or Dar es Salaam…" reached the
 * Ask route with ONE place. The canonical resolver (resolveGeography) answers a single best place
 * per text, and its city tier returns before the country tier is consulted, so the longest city
 * ("Dar es Salaam" → TZA) won; the destination (Rwanda) and the other corridor (Mombasa → KEN)
 * were dropped, and the retrieval anchors lost them too.
 *
 * A corridor question has a grammar of its own, read here deterministically (no AI, no I/O):
 *   · DESTINATION — the country goods go INTO ("importing into Rwanda", "shipping to Uganda",
 *     "import do Rwandy");
 *   · ROUTES      — every place after a route marker ("via Mombasa or Dar es Salaam",
 *     "through Dar es Salaam", "przez Dar es Salaam"), coordinated lists included;
 *   · EXCLUDED    — a NEGATED place ("not Mombasa", "rather than Beira", "nie przez Mombasę"):
 *     the reader ruled it out, so it is never a place to retrieve.
 * A follow-up that names only a route ("My shipment goes through Dar es Salaam, not Mombasa")
 * keeps the earlier corridor question's destination.
 *
 * Places are resolved by the canonical resolvers (country registry, Polish country forms, the
 * gazetteer through resolveGeography); nothing is invented, and an unresolvable word is dropped.
 */
export interface CorridorPlace {
  readonly iso3: string;
  /** What the reader wrote (trimmed). */
  readonly surface: string;
  /** The search / display label: the city when the reader named one, else the country name. */
  readonly label: string;
  /** Canonical settlement name when the place is a city, else null. */
  readonly city: string | null;
}

export interface TradeCorridor {
  readonly destination: CorridorPlace | null;
  /** True when the destination came from the earlier corridor question, not this turn. */
  readonly destinationInherited: boolean;
  readonly routes: readonly CorridorPlace[];
  readonly excluded: readonly CorridorPlace[];
}

type Lang = 'en' | 'pl';

/* goods are moving: the frame that makes "into X" a destination and "via Y" a route */
const CUE_EN =
  /\b(?:import\w*|export\w*|ship(?:s|ped|ping|ment|ments)?|cargo|freight|goods|consignments?|containers?|transit\w*|truck(?:s|ing)?|haul\w*|logistics|supply\s+chains?|deliver(?:y|ies|ed|ing)?|corridors?)\b/i;
const CUE_PL =
  /(?:^|[^\p{L}])(?:import\p{L}*|eksport\p{L}*|przesyłk\p{L}*|ładun\p{L}*|towar\p{L}*|kontener\p{L}*|tranzyt\p{L}*|dostaw\p{L}*|korytarz\p{L}*|wysyłk\p{L}*)/iu;

/* "does not GO via X": the movement verb between the negation and the route marker */
const NEGATED_VERB = String.raw`(?:(?:go|goes|going|went|pass|passes|passing|run|runs|travel|travels|move|moves|be\s+routed|routed|come|comes)\s+)?`;
/* a place name: capitalised words, with the lowercase particles of real names ("Dar es Salaam") */
const ITEM = String.raw`\p{Lu}[\p{L}\p{M}'’-]*(?:\s+(?:(?:es|de|da|del|al|el|la|le|du|di|dos|das)\s+)?\p{Lu}[\p{L}\p{M}'’-]*){0,3}`;
const SEP = String.raw`(?:\s*,\s*(?:(?:or|and|and\/or|lub|albo|i|oraz)\s+)?|\s+(?:or|and|and\/or|lub|albo|i|oraz)\s+)`;
const LIST = `(${ITEM}(?:${SEP}${ITEM})*)`;

/* keywords spell their own sentence-initial capital: the ITEM must stay case-sensitive */
const ROUTE_EN = new RegExp(
  /* ASK R2 — "through EITHER Mombasa, Kenya, or Dar es Salaam, Tanzania" (the verbatim TEST B) */
  String.raw`\b(?:[Vv]ia|[Tt]hrough|thru|[Tt]ransiting|by\s+way\s+of)\s+(?:(?:either|both)\s+)?(?:the\s+)?(?:ports?\s+of\s+)?${LIST}`,
  'gu',
);
const ROUTE_PL = new RegExp(
  String.raw`(?:^|[^\p{L}])(?:[Pp]rzez|[Vv]ia|[Tt]ranzytem\s+przez)\s+(?:port\s+(?:w\s+)?)?${LIST}`,
  'gu',
);
const NEGATED_EN = new RegExp(
  String.raw`\b(?:[Nn]ot|[Nn]ever|rather\s+than|[Ii]nstead\s+of|[Aa]voiding|[Bb]ypassing|[Ee]xcluding|except)\s+(?:${NEGATED_VERB}(?:via|through|thru)\s+)?(?:the\s+)?(?:ports?\s+of\s+)?${LIST}`,
  'gu',
);
const NEGATED_PL = new RegExp(
  String.raw`(?:^|[^\p{L}])(?:[Nn]ie|[Zz]amiast|[Oo]mijając|z\s+pominięciem|[Bb]ez)\s+(?:(?:przez|via)\s+)?${LIST}`,
  'gu',
);
const DESTINATION_EN = new RegExp(
  String.raw`\b(?:[Ii]mport\w*|[Ee]xport\w*|[Ss]hip(?:s|ped|ping|ment|ments)?|[Dd]eliver\w*|[Ss]end\w*|[Bb]ring\w*|[Tt]ransport\w*|[Tt]ruck\w*|[Mm]ov(?:e|es|ed|ing)\s+goods|[Cc]argo|[Ff]reight|[Gg]oods)\b[^.?!\n]{0,40}?\b(?:into|to)\s+(?:the\s+)?(${ITEM})`,
  'gu',
);
const DESTINATION_PL = new RegExp(
  String.raw`(?:[Ii]mport\p{L}*|[Ee]ksport\p{L}*|[Dd]ostaw\p{L}*|[Ww]ysył\p{L}*|[Tt]ransport\p{L}*|[Pp]rzesyłk\p{L}*|[Tt]owar\p{L}*)[^.?!\n]{0,40}?(?:^|[^\p{L}])do\s+(${ITEM})`,
  'gu',
);
/* a route marker after a negated movement verb ("does not go through X") is an exclusion */
const NEGATION_BEFORE_EN = new RegExp(String.raw`\b(?:not|never)\s+${NEGATED_VERB}$`, 'u');
/* a route marker right after a negation ("not via X", "nie przez X") is an exclusion, not a route */
const NEGATION_BEFORE = /(?:\b(?:not|never)|(?:^|[^\p{L}])nie)\s*$/iu;

/** A settlement must be a real town, not a capitalised word that happens to name a hamlet. */
const MIN_ROUTE_CITY_POPULATION = 10_000;

function splitList(list: string): string[] {
  return list
    .split(new RegExp(SEP, 'u'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function resolveOne(surface: string, lang: Lang): CorridorPlace | null {
  const country =
    resolveCountryByAnyIdentifier(surface) ??
    (lang === 'pl' ? resolvePolishCountry(surface) : undefined);
  /* ISO codes are not names ("US", "TZ"): a corridor place is written as a name */
  if (country !== undefined && surface.length > 3)
    return { iso3: country.iso3, surface, label: country.name, city: null };
  const geo = resolveGeography(surface);
  const place = geo.place;
  if (place === undefined || geo.provenance === 'CONTESTED') return null;
  if (/FUZZY/.test(geo.reason) && lang !== 'pl') return null;
  if (geo.precision === 'COUNTRY')
    return { iso3: place.country.iso3, surface, label: place.country.name, city: null };
  if (geo.precision !== 'CITY' || place.cityName === undefined) return null;
  const known = citiesNamed(foldPlaceName(place.cityName));
  const big = known.some(
    (c) => (c.p ?? 0) >= MIN_ROUTE_CITY_POPULATION || c.fc === 'PPLC',
  );
  if (!big) return null;
  return { iso3: place.country.iso3, surface, label: place.cityName, city: place.cityName };
}

/** Longest-first: "Mombasa Port" → Mombasa; an unresolvable item is dropped, never guessed. */
function resolveItem(item: string, lang: Lang): CorridorPlace | null {
  const words = item.split(/\s+/);
  for (let k = words.length; k >= 1; k--) {
    const hit = resolveOne(words.slice(0, k).join(' '), lang);
    if (hit !== null) return hit;
  }
  return null;
}

/** Merge "Mombasa, Kenya": one place per country, the city (more specific) kept. */
function addPlace(into: CorridorPlace[], p: CorridorPlace): void {
  const at = into.findIndex((x) => x.iso3 === p.iso3);
  if (at < 0) into.push(p);
  else if (into[at]!.city === null && p.city !== null) into[at] = p;
}

interface Read {
  readonly destination: CorridorPlace | null;
  readonly routes: CorridorPlace[];
  readonly excluded: CorridorPlace[];
  readonly cue: boolean;
}

function readOnce(text: string, lang: Lang): Read {
  const routes: CorridorPlace[] = [];
  const excluded: CorridorPlace[] = [];
  const negated = lang === 'pl' ? NEGATED_PL : NEGATED_EN;
  const route = lang === 'pl' ? ROUTE_PL : ROUTE_EN;
  const dest = lang === 'pl' ? DESTINATION_PL : DESTINATION_EN;

  for (const m of text.matchAll(negated)) {
    for (const item of splitList(m[1] ?? '')) {
      const p = resolveItem(item, lang);
      if (p !== null) addPlace(excluded, p);
    }
  }
  for (const m of text.matchAll(route)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    if (NEGATION_BEFORE.test(before) || NEGATION_BEFORE_EN.test(before)) continue;
    for (const item of splitList(m[1] ?? '')) {
      const p = resolveItem(item, lang);
      if (p !== null && !excluded.some((x) => x.iso3 === p.iso3 && x.city === p.city))
        addPlace(routes, p);
    }
  }
  let destination: CorridorPlace | null = null;
  for (const m of text.matchAll(dest)) {
    const p = resolveItem(m[1] ?? '', lang);
    if (p === null) continue;
    /* the destination is a COUNTRY ("to Kigali" names Rwanda) */
    const meta = findCountryByIso3(p.iso3);
    destination = { iso3: p.iso3, surface: p.surface, label: meta?.name ?? p.label, city: null };
    break;
  }
  const cue = (lang === 'pl' ? CUE_PL : CUE_EN).test(text);
  return { destination, routes, excluded, cue };
}

function languageOf(text: string, language?: string): Lang {
  if (language === 'pl') return 'pl';
  if (language === 'en') return 'en';
  return /(?:^|[^\p{L}])(?:przez|nie\s+przez|do\s+\p{Lu})/u.test(text) ? 'pl' : 'en';
}

/**
 * The corridor this turn names, or null when it is not a corridor question. A corridor needs the
 * goods-moving frame (a cue word) — or an earlier corridor question it continues — and at least
 * one route or excluded place. The destination is never also a route; an excluded place is never
 * a route or the destination.
 */
export function readTradeCorridor(
  text: string,
  options: { language?: string; priorQuestion?: string } = {},
): TradeCorridor | null {
  const lang = languageOf(text, options.language);
  const own = readOnce(text, lang);
  const prior =
    options.priorQuestion === undefined || options.priorQuestion.trim() === ''
      ? null
      : (() => {
          const pr = readOnce(options.priorQuestion, languageOf(options.priorQuestion));
          return pr.cue && pr.routes.length > 0 ? pr : null;
        })();
  if (!own.cue && prior === null) return null;
  if (own.routes.length === 0 && own.excluded.length === 0) return null;
  /* nothing named as a route this turn ("not Mombasa" alone): the earlier routes, less the exclusion */
  const routesSource =
    own.routes.length === 0 && prior !== null ? prior.routes : own.routes;
  const excludedKeys = new Set(own.excluded.map((p) => `${p.iso3}:${p.city ?? ''}`));
  const excludedCountries = new Set(own.excluded.map((p) => p.iso3));
  let destination = own.destination;
  let destinationInherited = false;
  if (destination === null && prior?.destination != null) {
    destination = prior.destination;
    destinationInherited = true;
  }
  if (destination !== null && excludedCountries.has(destination.iso3)) destination = null;
  const routes = routesSource.filter(
    (p) =>
      !excludedKeys.has(`${p.iso3}:${p.city ?? ''}`) &&
      /* an excluded city's country is excluded too unless the reader also routed a city there */
      !(excludedCountries.has(p.iso3) && p.city === null) &&
      p.iso3 !== destination?.iso3,
  );
  if (routes.length === 0 && destination === null) {
    return own.excluded.length === 0
      ? null
      : { destination: null, destinationInherited: false, routes: [], excluded: own.excluded };
  }
  return { destination, destinationInherited, routes, excluded: own.excluded };
}

/** Every place the corridor keeps for retrieval, destination first, de-duplicated by country. */
export function corridorCountries(corridor: TradeCorridor): string[] {
  const out: string[] = [];
  for (const p of [...(corridor.destination === null ? [] : [corridor.destination]), ...corridor.routes]) {
    if (!out.includes(p.iso3)) out.push(p.iso3);
  }
  return out;
}
