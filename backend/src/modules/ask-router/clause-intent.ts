import { plTolerant } from './pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 FIFTH PASS — CLAUSE INTENT, NOT QUESTION-FORM INTENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A turn is a set of clauses, each with its own intent. "What exactly does a central bank do,
 * and what has Poland's central bank changed this week?" is a STABLE clause plus a CURRENT clause;
 * "I get what a downgrade means in theory. Has France been downgraded lately?" is a stable
 * statement of context plus a current question. The whole turn never inherits the job of its most
 * obviously current clause: MIXED emerges from the SET of clause intents.
 *
 * Clauses are split on sentence boundaries, semicolons, coordinating conjunctions and commas that
 * introduce a new interrogative / auxiliary clause — EN and PL, with informal punctuation. A clause
 * need not be a grammatical question: a statement establishing conceptual context ("I understand X
 * in theory") is a STABLE clause when it is joined to a current request.
 */
export type ClauseIntentKind = 'STABLE' | 'CURRENT' | 'HISTORICAL' | 'OTHER';

export interface ClauseIntent {
  readonly text: string;
  readonly intent: ClauseIntentKind;
  /** the job this clause alone asks for */
  readonly job: 'EXPLANATION' | 'CURRENT_REPORTING' | 'HISTORICAL_REFERENCE' | 'UNRESOLVED';
  readonly freshness: 'NONE' | 'CURRENT';
  readonly evidence: 'NONE' | 'CURRENT_REPORTING';
  /** places (ISO3) and a two-country relationship the clause names, when a reader supplies them */
  readonly places?: readonly string[];
  readonly relationship?: readonly [string, string] | null;
}

type Lang = 'en' | 'pl';

const INTERROGATIVE_EN =
  'what|which|who|whom|how|where|when|why|is|are|was|were|has|have|had|do|does|did|can|could|will|would|should|tell|give|show|update|explain';
const INTERROGATIVE_PL =
  'co|jak|jaki|jaka|jakie|jakich|kto|czy|ile|gdzie|kiedy|dlaczego|czemu|powiedz|podaj|pokaż|pokaz|czym|skąd|skad|wyjaśnij|wyjasnij';

const SPLIT: Readonly<Record<Lang, RegExp>> = {
  en: new RegExp(
    String.raw`(?<=[?.!;])\s+|;\s*|,\s+(?:and|but|while|plus|also)\s+|,?\s+(?:and|but|plus|also)\s+(?=(?:${INTERROGATIVE_EN})\b)|,\s*(?=(?:${INTERROGATIVE_EN})\b)`,
    'iu',
  ),
  pl: new RegExp(
    String.raw`(?<=[?.!;])\s+|;\s*|,\s+(?:a|i|ale|oraz|także|też)\s+|,?\s+(?:i|a|ale|oraz)\s+(?=(?:${INTERROGATIVE_PL})(?![\p{L}\d]))|,\s*(?=(?:${INTERROGATIVE_PL})(?![\p{L}\d]))`,
    'iu',
  ),
};
const LEADING_LINK: Readonly<Record<Lang, RegExp>> = {
  en: /^(?:also|and|plus|but|so|ok(?:ay)?|now)[,]?\s+/i,
  pl: /^(?:a|i|także|też|oraz|ale|więc|ok)[,]?\s+/iu,
};

/** The clauses of a turn (never empty: a single clause is the whole text). */
export function splitClauses(text: string, language: string): string[] {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const parts = text
    .split(SPLIT[lang])
    .map((c) => (c ?? '').trim().replace(LEADING_LINK[lang], '').trim())
    .filter((c) => /\p{L}/u.test(c));
  return parts.length === 0 ? [text.trim()] : parts;
}

/*
  Stable clause FORMS beyond interrogative templates: what something does / is for, what makes
  something what it is, its role, why it matters, how it differs, and statements of understanding
  ("I get what X means in theory"). They describe CONCEPTS; a time marker in the same clause makes
  it current instead (the caller tests currentness first).
*/
const STABLE_CLAUSE: Readonly<Record<Lang, RegExp>> = {
  en: /^(?:please\s+)?(?:what\s+(?:exactly\s+|actually\s+|really\s+)?(?:does|do|did)\s+.{1,80}?\s+(?:do|mean|involve|cover|entail)\b|what\s+(?:exactly\s+)?makes\b|explain\b|describe\b|define\b|what\s+is\s+the\s+(?:role|purpose|function|point|idea)\s+of\b|why\s+(?:does|do|did|would|should)\s+.{1,80}?\s+matter\b|how\s+(?:is|are|was|were)\s+.{1,80}?\s+different\b|(?:i|we)\s+(?:get|understand|know|see|grasp|follow|realise|realize)\b)|\b(?:in\s+theory|in\s+principle|conceptually|in\s+general|generally\s+speaking|as\s+a\s+concept)\b/i,
  pl: plTolerant(
    /^(?:czym\s+(?:właściwie\s+|dokładnie\s+)?(?:zajmuje\s+się|jest|są|różni)|co\s+(?:właściwie\s+|dokładnie\s+)?(?:robi|oznacza|znaczy)|co\s+sprawia|jaka\s+jest\s+rola|na\s+czym\s+polega|wyjaśnij|opisz|dlaczego\s+.{1,80}?\s+(?:ma\s+znaczenie|jest\s+(?:ważn|istotn)\p{L}*)|(?:rozumiem|wiem|znam|kojarzę)(?![\p{L}]))|(?:^|\s)(?:w\s+teorii|teoretycznie|w\s+zasadzie|co\s+do\s+zasady|ogólnie\s+rzecz\s+biorąc)(?![\p{L}])/iu,
  ),
};

/** Is the clause a STABLE (conceptual / explanatory / context) clause by form? */
export function stableClauseForm(clause: string, language: string): boolean {
  return STABLE_CLAUSE[language === 'pl' ? 'pl' : 'en'].test(clause.trim());
}

export interface ClauseReaders {
  /** is this clause current (time, present state, a particular current event, a news request)? */
  readonly current: (clause: string) => boolean;
  /** is this clause a completed historical reference ("who won the 2000 election")? */
  readonly historical: (clause: string) => boolean;
  /** does this clause have one of the governed stable shapes? */
  readonly stableShape: (clause: string) => boolean;
  readonly places?: (clause: string) => readonly string[];
  readonly relationship?: (clause: string) => readonly [string, string] | null;
}

/** Each clause with its own intent, job, freshness, evidence and scope. */
export function readClauseIntents(
  text: string,
  language: string,
  readers: ClauseReaders,
): ClauseIntent[] {
  return splitClauses(text, language).map((clause) => {
    const current = readers.current(clause);
    const historical = !current && readers.historical(clause);
    const stable =
      !current &&
      !historical &&
      (readers.stableShape(clause) || stableClauseForm(clause, language));
    const intent: ClauseIntentKind = current
      ? 'CURRENT'
      : historical
        ? 'HISTORICAL'
        : stable
          ? 'STABLE'
          : 'OTHER';
    return {
      text: clause,
      intent,
      job:
        intent === 'CURRENT'
          ? 'CURRENT_REPORTING'
          : intent === 'HISTORICAL'
            ? 'HISTORICAL_REFERENCE'
            : intent === 'STABLE'
              ? 'EXPLANATION'
              : 'UNRESOLVED',
      freshness: current ? 'CURRENT' : 'NONE',
      evidence: current ? 'CURRENT_REPORTING' : 'NONE',
      ...(readers.places === undefined ? {} : { places: readers.places(clause) }),
      ...(readers.relationship === undefined ? {} : { relationship: readers.relationship(clause) }),
    };
  });
}

/** MIXED emerges from the set: at least one stable-or-historical clause and one current clause. */
export function mixedFromIntents(intents: readonly ClauseIntent[]): boolean {
  return (
    intents.some((c) => c.intent === 'CURRENT') &&
    intents.some((c) => c.intent === 'STABLE' || c.intent === 'HISTORICAL')
  );
}
