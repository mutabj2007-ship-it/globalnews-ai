import { DEMONYM_SOURCE, normalizeAskQuestion } from './normalization/qualified-reading';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — THE BILATERAL RELATIONSHIP (§14, §15, PO-02)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live (PO-02): "Rwanda and Tanzania border commercial services" was answered as Rwanda current
 * news — the bilateral scope collapsed to the first country typed, and the evidence was ordinary
 * news about each country. A question about what happens BETWEEN two countries is a relationship:
 * entity A, entity B, the relation (border, corridor, trade, transport, energy…), the domain, and
 * both sides' vantage. Its evidence must be about the relationship itself — an item that is only
 * about one side is not evidence for it (co-occurrence is not causation, and one-sided reporting
 * is not the relationship).
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
  | 'GENERAL';

export interface BilateralRelationship {
  /** ISO3, in the order the reader named them. */
  readonly countries: readonly [string, string];
  readonly relations: readonly RelationKind[];
  /** The analytical domain of the relation ('commercial' for border trade / services). */
  readonly domain: 'COMMERCIAL' | 'TRANSPORT' | 'ENERGY' | 'SECURITY' | 'DIPLOMATIC' | 'GENERAL';
  /** A named corridor / crossing the reader typed, when one was named. */
  readonly corridor: string | null;
}

const RELATIONS: ReadonlyArray<readonly [RelationKind, RegExp]> = [
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
    /\b(?:relations?|relationship|ties|diplomatic|bilateral|agreements?|treaty|mou|cooperation|dispute|tensions?)\b|(?:stosunk\p{L}*|relacj\p{L}*|dwustronn\p{L}*|umow\p{L}*|współprac\p{L}*|spor\p{L}*|napięci\p{L}*)/iu,
  ],
  [
    'SECURITY',
    /\b(?:security|military|troops|rebels?|refugees?|incursions?)\b|(?:bezpieczeństw\p{L}*|wojsk\p{L}*|rebeli\p{L}*|uchodźc\p{L}*)/iu,
  ],
];

const BETWEEN = /\b(?:between|across|linking|connecting)\b|(?:między|pomiędzy|łącząc\p{L}*)/iu;
const COMPARISON =
  /\b(?:compare|comparison|versus|vs\.?|which\s+is|which\s+has)\b|(?:porównaj|porównani\p{L}*|któr\p{L}*\s+(?:jest|ma))/iu;
const NAMED_CORRIDOR =
  /\b((?:central|northern|southern|lobito|dar\s+es\s+salaam|mombasa)\s+corridor|rusumo(?:\s+(?:border|osbp|bridge))?|[\p{Lu}][\p{L}-]+\s+(?:one-?stop\s+)?border\s+post)\b/iu;

/** The relation kinds whose vocabulary appears in a text (an article title + summary). */
export function relationKindsIn(text: string): RelationKind[] {
  return RELATIONS.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}

function domainOf(relations: readonly RelationKind[]): BilateralRelationship['domain'] {
  if (relations.includes('TRADE')) return 'COMMERCIAL';
  if (relations.includes('TRANSPORT') || relations.includes('CORRIDOR')) return 'TRANSPORT';
  if (relations.includes('ENERGY')) return 'ENERGY';
  if (relations.includes('SECURITY')) return 'SECURITY';
  if (relations.includes('DIPLOMATIC') || relations.includes('INSTITUTIONAL')) return 'DIPLOMATIC';
  return 'GENERAL';
}

/** Null when the question is not about a relationship between exactly two named countries. */
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
  const countries = [
    ...new Set(
      outcome.reading.geography
        .filter((g) => g.value !== 'CONTESTED' && g.source !== DEMONYM_SOURCE)
        .map((g) => g.value),
    ),
  ];
  if (countries.length !== 2) return null;
  const relations = RELATIONS.filter(([, re]) => re.test(question)).map(([kind]) => kind);
  const between = BETWEEN.test(question);
  /* A comparison is two subjects side by side, not their relationship — unless a relation word
     ("Compare trade between…") says it is about what passes between them. */
  if (COMPARISON.test(question) && !between) return null;
  if (relations.length === 0 && !between) return null;
  const corridor = NAMED_CORRIDOR.exec(question)?.[1] ?? null;
  return {
    countries: [countries[0], countries[1]],
    relations: relations.length === 0 ? ['GENERAL'] : relations,
    domain: domainOf(relations),
    corridor,
  };
}
