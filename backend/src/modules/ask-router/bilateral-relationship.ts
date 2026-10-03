import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { resolvePolishCountry } from '../analysis/query/polish-country-forms.util';
import { resolvePolishCountryForm } from './country-morphology';
import { plTolerant } from './pl-tolerant';
import { normalizeTurn } from './turn-normalization';
import { readEntityCandidates } from './semantic-ir/entities';
import { assignRoles, toBilateralRelationship } from './semantic-ir/roles';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — THE BILATERAL RELATIONSHIP (§14, §15, PO-02)
 * CTO R4 FOURTH PASS — A RELATIONSHIP SCOPE WITH ENTITY ROLES, INDEPENDENT OF FRESHNESS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live (PO-02): "Rwanda and Tanzania border commercial services" was answered as Rwanda current
 * news — the bilateral scope collapsed to the first country typed, and the evidence was ordinary
 * news about each country. A question about what happens BETWEEN two countries is a relationship:
 * entity A, entity B, the relation (border, corridor, trade, war, territory, alliance…), the
 * domain, and both sides' vantage. Its evidence must be about the relationship itself.
 *
 * CTO R4 fourth pass: the scope is a SEMANTIC OBJECT, owned by no job and no freshness. A country
 * mention is not an actor: "Argentina and the United Kingdom … over the Falklands" has two ACTORS
 * and a DISPUTED_OBJECT; "talks between Ethiopia and Egypt hosted in Washington" has a VENUE. A
 * third place never destroys the pair. Actors come, in order, from: exactly two places read, a
 * combined adjective ("Franco-German", "polsko-litewskie"), or two coordinated names (any case).
 *
 * This reader recognises the SHAPE (two named countries + a relation word, or "between A and B")
 * from closed vocabularies. A plain comparison ("Compare Rwanda and Tanzania") is not a
 * relationship. Pure: no I/O, no model.
 */
export type RelationKind =
  | 'BORDER'
  | 'CORRIDOR'
  | 'TRADE'
  | 'TRANSPORT'
  | 'ENERGY'
  | 'INSTITUTIONAL'
  | 'DIPLOMATIC'
  | 'SECURITY'
  /* CTO R4 fourth pass — relation families beyond current commerce */
  | 'WAR'
  | 'TERRITORIAL_DISPUTE'
  | 'ALLIANCE'
  | 'COMPETITION'
  | 'POLICY_COORDINATION'
  | 'ECONOMIC'
  | 'HISTORICAL_RELATION'
  | 'GENERAL';

/** CTO R4 semantic IR — the closed relation vocabulary (for validation). */
export const RELATION_KINDS: readonly RelationKind[] = [
  'BORDER',
  'CORRIDOR',
  'TRADE',
  'TRANSPORT',
  'ENERGY',
  'INSTITUTIONAL',
  'DIPLOMATIC',
  'SECURITY',
  'WAR',
  'TERRITORIAL_DISPUTE',
  'ALLIANCE',
  'COMPETITION',
  'POLICY_COORDINATION',
  'ECONOMIC',
  'HISTORICAL_RELATION',
  'GENERAL',
];

/** CTO R4 fourth pass — the role a place plays in a multi-place question. */
export type EntityRole =
  | 'ACTOR'
  | 'COUNTERPART'
  | 'LOCATION'
  | 'DISPUTED_OBJECT'
  | 'CORRIDOR'
  | 'VENUE'
  | 'INSTITUTION'
  | 'COMPARISON_MEMBER';

export interface ScopeEntity {
  /** ISO3 when the place is a country / territory the gazetteer knows, else null. */
  readonly iso3: string | null;
  readonly role: EntityRole;
}

export interface BilateralRelationship {
  /** The two ACTORS (ISO3), in the order the reader named them. */
  readonly countries: readonly [string, string];
  readonly relations: readonly RelationKind[];
  /** The analytical domain of the relation ('commercial' for border trade / services). */
  readonly domain: 'COMMERCIAL' | 'TRANSPORT' | 'ENERGY' | 'SECURITY' | 'DIPLOMATIC' | 'GENERAL';
  /** A named corridor / crossing the reader typed, when one was named. */
  readonly corridor: string | null;
  /** CTO R4 fourth pass — every place with its role: the actors first, then objects / venues. */
  readonly entities?: readonly ScopeEntity[];
}

/** CTO R4 fourth pass — the relationship scope, a semantic object independent of job/freshness. */
export type RelationshipScope = BilateralRelationship;

const RELATIONS: ReadonlyArray<readonly [RelationKind, RegExp]> = (
  [
    [
      'BORDER',
      /\b(?:border|borders|cross-?border|frontier|border\s+post|one-?stop\s+border|crossing|crossings)\b|(?:granic\p{L}*|przejś\p{L}*\s+graniczn\p{L}*|transgraniczn\p{L}*)/iu,
    ],
    [
      'CORRIDOR',
      /\b(?:corridor|corridors|central\s+corridor|northern\s+corridor|transit\s+route)\b|(?:korytarz\p{L}*)/iu,
    ],
    [
      'TRADE',
      /\b(?:trade|trading|commerc\w*|exports?|imports?|customs|tariffs?|duties|traders?|goods|services|market\s+access|business(?:es)?)\b|(?:handl\p{L}*|handel|eksport\p{L}*|import\p{L}*|cł\p{L}*|celn\p{L}*|towar\p{L}*|usług\p{L}*|biznes\p{L}*)/iu,
    ],
    [
      'TRANSPORT',
      /\b(?:railways?|rail|sgr|standard\s+gauge|roads?|highways?|trucks?|trucking|freight|ports?|shipping|logistics|transit)\b|(?:kolej\p{L}*|drog\p{L}*|transport\p{L}*|ciężarów\p{L}*|port\p{L}*|logistyk\p{L}*|tranzyt\p{L}*)/iu,
    ],
    [
      'ENERGY',
      /\b(?:power\s+(?:line|lines|interconnect\w*|trade)|interconnect\w*|electricity|pipeline|hydro\w*|energy)\b|(?:energ\p{L}*|elektrycz\p{L}*|rurociąg\p{L}*)/iu,
    ],
    [
      'INSTITUTIONAL',
      /\b(?:eac|east\s+african\s+community|comesa|sadc|afcfta|common\s+market|customs\s+union)\b|(?:wspóln\p{L}*\s+rynek|uni\p{L}*\s+celn\p{L}*)/iu,
    ],
    [
      'DIPLOMATIC',
      /\b(?:relations?|relationship|ties|diplomatic|bilateral|agreements?|treaty|treaties|mou|cooperation|dispute|disputes|tensions?|rivals?|rivalry|rivalries|partners?|partnership|allian\w*|allies|allied|reconcil\w*|enmity|friendship|feud\w*|hostilit\w*|normali[sz]\w*|d[ée]tente|rapprochement|antagonism|grievances?|each\s+other|one\s+another|f[ae]ll(?:s|en|ing)?\s+out|clash\w*|quarrel\w*|compet\w*\s+with|cooperat\w*|collaborat\w*|fought|fight(?:s|ing)?\s+(?:over|with)|sided\s+with|negotiat\w*|talks|argu(?:e|es|ed|ing)|spar(?:s|red|ring)?|wrangl\w*|bicker\w*)\b|(?:kłóc\p{L}*|ściera\p{L}*|spier\p{L}*\s+się|walczy\p{L}*\s+z|rywalizuj\p{L}*|współpracuj\p{L}*|pogodzi\p{L}*)|(?:stosunk\p{L}*|relacj\p{L}*|dwustronn\p{L}*|umow\p{L}*|współprac\p{L}*|sp[oó]r\p{L}*|napięci\p{L}*|rywal\p{L}*|partner\p{L}*|sojusz\p{L}*|pojedna\p{L}*|wrogoś\p{L}*|wrog\p{L}*|przyjaźń|przyjaźni|normalizacj\p{L}*|wzajemn\p{L}*|negocjacj\p{L}*|rozmow\p{L}*|konflikt\p{L}*\s+(?:między|pomiędzy))/iu,
    ],
    [
      'SECURITY',
      /\b(?:security|military|troops|rebels?|refugees?|incursions?|defen[cs]e)\b|(?:bezpieczeństw\p{L}*|wojsk\p{L}*|rebeli\p{L}*|uchodźc\p{L}*|obronn\p{L}*)/iu,
    ],
    [
      'WAR',
      /\b(?:wars?|warfare|went\s+to\s+war|go(?:es|ne)?\s+to\s+war|at\s+war|fought|invad\w*|invasion|armed\s+conflict|skirmish\w*|hostilities|ceasefire|truce|border\s+war)\b|(?:wojn\p{L}*|walczył\p{L}*|walk\p{L}*\s+zbrojn\p{L}*|inwazj\p{L}*|konflikt\p{L}*\s+zbrojn\p{L}*|rozejm\p{L}*|zawieszeni\p{L}*\s+broni)/iu,
    ],
    [
      'TERRITORIAL_DISPUTE',
      /\b(?:territor\w*|sovereignty|claims?\s+(?:over|to)|annex\w*|disputed|islands?|maritime\s+(?:border|boundary|dispute|claims?)|(?:dispute|disputes|quarrel\w*|conflict|clash\w*|standoff|argu(?:e|es|ed|ing)|fight\w*|fought|wrangl\w*|spar(?:s|red|ring)?)\b[^.?!]{0,60}?\bover)\b|(?:terytori\p{L}*|suwerenno\p{L}*|roszczeni\p{L}*|aneksj\p{L}*|sp[oó]r\p{L}*\s+(?:[^.?!]{0,60}?\s)?o\s|sp[oó]r\p{L}*\s+(?:terytorialn\p{L}*|graniczn\p{L}*)|spier\p{L}*\s+się\s+o\s|wysp\p{L}*|granic\p{L}*\s+morsk\p{L}*)/iu,
    ],
    [
      'ALLIANCE',
      /\b(?:allian\w*|allies|allied|ally|pact|defen[cs]e\s+(?:treaty|pact|cooperation))\b|(?:sojusz\p{L}*|pakt\p{L}*|sprzymierz\p{L}*)/iu,
    ],
    [
      'COMPETITION',
      /\b(?:rival\w*|compet\w*|arms\s+race|race\s+for)\b|(?:rywaliz\p{L}*|konkurencj\p{L}*|wyścig\p{L}*\s+zbroje\p{L}*)/iu,
    ],
    [
      'POLICY_COORDINATION',
      /\b(?:coordinat\w*|joint\s+(?:policy|policies|strategy|exercises?|patrols?|position)|cooperat\w*\s+on)\b|(?:koordynacj\p{L}*|wspóln\p{L}*\s+(?:polityk|strategi|ćwicze|stanowisk)\p{L}*)/iu,
    ],
    [
      'ECONOMIC',
      /\b(?:invest\w*|economic\s+(?:ties|relations|cooperation|links)|aid|loans?|debt)\b|(?:inwestycj\p{L}*|gospodarcz\p{L}*|pomoc\p{L}*\s+(?:finansow|gospodarcz)\p{L}*|pożyczk\p{L}*)/iu,
    ],
    [
      'HISTORICAL_RELATION',
      /\b(?:historically|history\s+of|historical\s+(?:relations|ties|grievances|disputes|rivalry)|over\s+the\s+(?:centuries|decades))\b|(?:histori\p{L}*|w\s+przeszłości|na\s+przestrzeni\s+(?:wieków|dekad|lat)|międzywojenn\p{L}*)/iu,
    ],
  ] as ReadonlyArray<readonly [RelationKind, RegExp]>
).map(([kind, re]) => [kind, plTolerant(re)] as const);

export const BETWEEN = plTolerant(
  /\b(?:between|across|linking|connecting)\b|(?:między|pomiędzy|łącząc\p{L}*)/iu,
);
export const COMPARISON = plTolerant(
  /\b(?:compare|comparison|versus|vs\.?|which\s+is|which\s+has)\b|(?:porównaj|porównani\p{L}*|któr\p{L}*\s+(?:jest|ma))/iu,
);
export const NAMED_CORRIDOR =
  /\b((?:central|northern|southern|lobito|dar\s+es\s+salaam|mombasa)\s+corridor|rusumo(?:\s+(?:border|osbp|bridge))?|[\p{Lu}][\p{L}-]+\s+(?:one-?stop\s+)?border\s+post)\b/iu;

/*
  CTO R4 THIRD PASS — COUNTRY IDENTITY DOES NOT DEPEND ON CAPITALISATION. The landed reader reads
  a lowercase name only after a place preposition and never a lowercase homograph ("japan",
  "china", "turkey" are also ordinary words). Two names COORDINATED with each other ("japan and
  south korea", "peru a chile", "france–germany") are unambiguous: the pair itself is the
  evidence that both are countries. ISO codes ("us", "uk" as words) are never read this way.
*/
const EN_PAIR =
  /(?:^|[^\p{L}])((?:the\s+)?[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,2})\s*(?:\band\b|&|–|-|\/|\bvs\.?\b|\bversus\b)\s*((?:the\s+)?[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,2})/giu;
const PL_PAIR =
  /(?:^|[^\p{L}])([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,1})\s*(?:\bi\b|\ba\b|\boraz\b|–|-|\/)\s*([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,1})/giu;

function countryOf(phrase: string, lang: 'en' | 'pl', fromEnd: boolean): string | null {
  const words = phrase
    .trim()
    .replace(/^the\s+/i, '')
    .split(/\s+/);
  /* the longest run of words adjacent to the conjunction that names a country */
  for (let k = Math.min(3, words.length); k >= 1; k -= 1) {
    const span = (fromEnd ? words.slice(words.length - k) : words.slice(0, k)).join(' ');
    const cleaned = span.replace(/[’']s$/u, '').replace(/[^\p{L}\s.-]/gu, '');
    if (cleaned.length < 4) continue;
    if (lang === 'pl') {
      const c = resolvePolishCountry(cleaned);
      if (c !== undefined && c !== null) return c.iso3;
      /* CTO R4 fifth pass — any common grammatical case ("Stanów Zjednoczonych", "Korei Północnej") */
      const inflected = resolvePolishCountryForm(cleaned);
      if (inflected !== null) return inflected;
    }
    const c = resolveCountryByAnyIdentifier(cleaned);
    if (c !== undefined && cleaned.toUpperCase() !== c.iso2 && cleaned.toUpperCase() !== c.iso3)
      return c.iso3;
  }
  return null;
}

/** Two countries coordinated in the text, case-insensitively (ISO3, in the order written). */
export function coordinatedCountryPair(text: string, lang: 'en' | 'pl'): [string, string] | null {
  for (const m of text.matchAll(lang === 'pl' ? PL_PAIR : EN_PAIR)) {
    const a = countryOf(m[1], lang, true);
    const b = countryOf(m[2], lang, false);
    if (a !== null && b !== null && a !== b) return [a, b];
  }
  return null;
}

/** The relation kinds whose vocabulary appears in a text (an article title + summary). */
export function relationKindsIn(text: string): RelationKind[] {
  return RELATIONS.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}

export function domainOf(relations: readonly RelationKind[]): BilateralRelationship['domain'] {
  if (relations.includes('TRADE') || relations.includes('ECONOMIC')) return 'COMMERCIAL';
  if (relations.includes('TRANSPORT') || relations.includes('CORRIDOR')) return 'TRANSPORT';
  if (relations.includes('ENERGY')) return 'ENERGY';
  if (
    relations.includes('SECURITY') ||
    relations.includes('WAR') ||
    relations.includes('ALLIANCE') ||
    relations.includes('TERRITORIAL_DISPUTE')
  )
    return 'SECURITY';
  if (
    relations.includes('DIPLOMATIC') ||
    relations.includes('INSTITUTIONAL') ||
    relations.includes('POLICY_COORDINATION') ||
    relations.includes('COMPETITION') ||
    relations.includes('HISTORICAL_RELATION')
  )
    return 'DIPLOMATIC';
  return 'GENERAL';
}

/*
  CTO R4 FIFTH PASS — TWO-ACTOR EVENTS ARE RELATIONSHIPS. A relation need not be named with
  "between", "border" or "trade": an EVENT can encode both actors ("the summit of the United
  States and North Korea", "the dissolution of the union of Norway and Sweden", "a deal Russia and
  Ukraine agreed", "konflikt Grecji i Turcji o Cypr"). The authority is the STRUCTURE — two
  COORDINATED actors (a pair or a combined adjective) — and the event / joint-action vocabulary
  below is only the evidence that a relation joins them. Without the coordinated structure these
  words never create a relationship.
*/
const TWO_ACTOR_EVENT: ReadonlyArray<readonly [RelationKind, RegExp]> = (
  [
    [
      'DIPLOMATIC',
      /\b(?:summits?|meetings?|talks|negotiat\w*|agreements?|deals?|accords?|treat(?:y|ies)|normali[sz]\w*|met|meets|meeting|agreed|signed|brokered|mediat\w*|reconcil\w*|conflicts?|disputes?|standoffs?)\b|(?:szczyt\p{L}*|spotkani\p{L}*|spotkał\p{L}*|rozmow\p{L}*|negocjacj\p{L}*|negocjował\p{L}*|porozumieni\p{L}*|umow\p{L}*|układ\p{L}*|traktat\p{L}*|zawarł\p{L}*|podpisał\p{L}*|pojedna\p{L}*|konflikt\p{L}*|sp[oó]r\p{L}*)/iu,
    ],
    [
      'HISTORICAL_RELATION',
      /\b(?:union|unions|unification|unified|united|merger|merged|dissolution|dissolv\w*|break-?up|split|separat\w*|secession|partition\w*|independence\s+from)\b|(?:uni[aięi]|unii|zjednoczeni\p{L}*|zjednoczył\p{L}*|rozpad\p{L}*|rozwiązani\p{L}*|rozwiązał\p{L}*|rozdzieleni\p{L}*|rozdzielił\p{L}*|secesj\p{L}*|podział\p{L}*)/iu,
    ],
    [
      'ECONOMIC',
      /\b(?:sanctions?|embargo\w*|tariff\s+war|trade\s+war)\b|(?:sankcj\p{L}*|embarg\p{L}*|wojn\p{L}*\s+handlow\p{L}*)/iu,
    ],
  ] as ReadonlyArray<readonly [RelationKind, RegExp]>
).map(([kind, re]) => [kind, plTolerant(re)] as const);

/** CTO R4 semantic IR — the two-actor event kinds whose vocabulary appears in a text. */
export function twoActorEventKinds(text: string): RelationKind[] {
  return TWO_ACTOR_EVENT.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}

/* the role of a third place, from the preposition that introduces it */
export const OBJECT_ROLE: ReadonlyArray<readonly [EntityRole, RegExp]> = [
  [
    'DISPUTED_OBJECT',
    /(?:\b(?:over|about|for\s+control\s+of|regarding|claims?\s+(?:to|over))|(?:^|\s)(?:o|nad|wokół))\s+(?:the\s+)?$/iu,
  ],
  [
    'CORRIDOR',
    /(?:\b(?:through|via|across|transiting)|(?:^|\s)(?:przez|tranzytem\s+przez))\s+(?:the\s+)?$/iu,
  ],
  [
    'VENUE',
    /(?:\b(?:hosted\s+(?:in|by)|held\s+in|talks\s+in|summit\s+in|meeting\s+in|mediated\s+(?:by|in)|brokered\s+(?:in|by)|signed\s+in|agreed\s+in|concluded\s+in|met\s+in|negotiated\s+in)|(?:^|\s)(?:rozmow\p{L}*\s+w|szczyt\p{L}*\s+w))\s+(?:the\s+)?$/iu,
  ],
];

/**
 * Null when the question is not about a relationship between two named countries.
 *
 * CTO R4 SEMANTIC IR — ONE AUTHORITY. The relationship is read by the semantic layer's two
 * stages (semantic-ir/entities.ts: canonical identities; semantic-ir/roles.ts: roles and relation
 * arguments from grammar), on the same normalized reader text the router reads. This export keeps
 * the established shape for the conversation state and the analysis executor, so every caller
 * agrees with the route: a venue city is never an actor, a disputed object never replaces both
 * actors, and "DR Congo" is never the Republic of the Congo.
 */
export function readBilateralRelationship(
  question: string,
  language: string,
): BilateralRelationship | null {
  if (language !== 'en' && language !== 'pl') return null;
  const text = normalizeTurn(question, language).text;
  return toBilateralRelationship(assignRoles(text, language, readEntityCandidates(text, language)));
}
