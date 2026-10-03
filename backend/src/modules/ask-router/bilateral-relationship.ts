import { findCountryByIso3, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { resolvePolishCountry } from '../analysis/query/polish-country-forms.util';
import { DEMONYM_SOURCE, normalizeAskQuestion } from './normalization/qualified-reading';
import { combinedCountryAdjectives } from './country-morphology';
import { plTolerant } from './pl-tolerant';

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
      /\b(?:relations?|relationship|ties|diplomatic|bilateral|agreements?|treaty|treaties|mou|cooperation|dispute|disputes|tensions?|rivals?|rivalry|rivalries|partners?|partnership|allian\w*|allies|allied|reconcil\w*|enmity|friendship|feud\w*|hostilit\w*|normali[sz]\w*|d[ée]tente|rapprochement|antagonism|grievances?|each\s+other|one\s+another|f[ae]ll(?:s|en|ing)?\s+out|clash\w*|quarrel\w*|compet\w*\s+with|cooperat\w*|collaborat\w*|fought|fight(?:s|ing)?\s+(?:over|with)|sided\s+with|negotiat\w*|talks)\b|(?:kłóc\p{L}*|ściera\p{L}*|walczy\p{L}*\s+z|rywalizuj\p{L}*|współpracuj\p{L}*|pogodzi\p{L}*)|(?:stosunk\p{L}*|relacj\p{L}*|dwustronn\p{L}*|umow\p{L}*|współprac\p{L}*|sp[oó]r\p{L}*|napięci\p{L}*|rywal\p{L}*|partner\p{L}*|sojusz\p{L}*|pojedna\p{L}*|wrogoś\p{L}*|wrog\p{L}*|przyjaźń|przyjaźni|normalizacj\p{L}*|wzajemn\p{L}*|negocjacj\p{L}*|rozmow\p{L}*|konflikt\p{L}*\s+(?:między|pomiędzy))/iu,
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
      /\b(?:territor\w*|sovereignty|claims?\s+(?:over|to)|annex\w*|disputed|islands?|maritime\s+(?:border|boundary|dispute|claims?)|(?:dispute|disputes|quarrel\w*|conflict|clash\w*|standoff)\b[^.?!]{0,60}?\bover)\b|(?:terytori\p{L}*|suwerenno\p{L}*|roszczeni\p{L}*|aneksj\p{L}*|sp[oó]r\p{L}*\s+(?:o|terytorialn\p{L}*|graniczn\p{L}*)|wysp\p{L}*|granic\p{L}*\s+morsk\p{L}*)/iu,
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

const BETWEEN = plTolerant(
  /\b(?:between|across|linking|connecting)\b|(?:między|pomiędzy|łącząc\p{L}*)/iu,
);
const COMPARISON = plTolerant(
  /\b(?:compare|comparison|versus|vs\.?|which\s+is|which\s+has)\b|(?:porównaj|porównani\p{L}*|któr\p{L}*\s+(?:jest|ma))/iu,
);
const NAMED_CORRIDOR =
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

function domainOf(relations: readonly RelationKind[]): BilateralRelationship['domain'] {
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

/* the role of a third place, from the preposition that introduces it */
const OBJECT_ROLE: ReadonlyArray<readonly [EntityRole, RegExp]> = [
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
    /(?:\b(?:hosted\s+in|held\s+in|talks\s+in|summit\s+in|meeting\s+in|mediated\s+(?:by|in))|(?:^|\s)(?:rozmow\p{L}*\s+w|szczyt\p{L}*\s+w))\s+(?:the\s+)?$/iu,
  ],
];

/** Null when the question is not about a relationship between two named countries. */
export function readBilateralRelationship(
  question: string,
  language: string,
): BilateralRelationship | null {
  if (language !== 'en' && language !== 'pl') return null;
  const outcome = normalizeAskQuestion({
    originalQuestion: question,
    sourceLanguage: language,
    normalizationLanguage: language,
    displayLanguage: language,
    origin: 'ASK',
  });
  if (outcome.status === 'NOT_READ') return null;
  const places = outcome.reading.geography.filter(
    (g) => g.value !== 'CONTESTED' && g.source !== DEMONYM_SOURCE,
  );
  const read = [...new Set(places.map((g) => g.value))];
  /*
    CTO R4 fourth pass — the ACTORS: exactly two places read; else a combined adjective
    ("Franco-German", "polsko-litewskie"); else two coordinated names in any case ("japan and
    south korea", "Argentina and the United Kingdom … over the Falklands"). Any further place is
    an OBJECT / VENUE / CORRIDOR of the relation, never a reason to drop the pair.
  */
  const adjective = combinedCountryAdjectives(question, language)[0] ?? null;
  const actors: [string, string] | null =
    read.length === 2
      ? [read[0], read[1]]
      : (adjective ?? coordinatedCountryPair(question, language));
  if (actors === null) return null;
  const relations = RELATIONS.filter(([, re]) => re.test(question)).map(([kind]) => kind);
  const between = BETWEEN.test(question);
  /* A comparison is two subjects side by side, not their relationship — unless a relation word
     ("Compare trade between…") or a combined adjective ("the Franco-German relationship") says it
     is about what passes between them. */
  if (COMPARISON.test(question) && !between && adjective === null) return null;
  if (relations.length === 0 && !between) return null;
  const corridor = NAMED_CORRIDOR.exec(question)?.[1] ?? null;
  const objects: ScopeEntity[] = places
    .filter((g) => !actors.includes(g.value))
    .map((g) => {
      /* where the reader wrote the place: its matched text, else its first word ("Falklands") */
      const lower = question.toLowerCase();
      const words = (g.matchedText ?? findCountryByIso3(g.value)?.name ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4);
      const at =
        g.matchedText !== undefined && lower.includes(g.matchedText.toLowerCase())
          ? lower.indexOf(g.matchedText.toLowerCase())
          : (words.map((w) => lower.indexOf(w.replace(/s$/, ''))).find((i) => i >= 0) ?? -1);
      const before = at < 0 ? '' : question.slice(Math.max(0, at - 40), at);
      const role = OBJECT_ROLE.find(([, re]) => re.test(before))?.[0] ?? 'LOCATION';
      return { iso3: g.value, role };
    })
    .filter((e, i, all) => all.findIndex((x) => x.iso3 === e.iso3) === i);
  return {
    countries: actors,
    relations: relations.length === 0 ? ['GENERAL'] : relations,
    domain: domainOf(relations),
    corridor,
    entities: [
      { iso3: actors[0], role: 'ACTOR' },
      { iso3: actors[1], role: 'COUNTERPART' },
      ...objects,
    ],
  };
}
