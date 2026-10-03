import { plTolerant } from '../pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC IR §8 — CURRENTNESS IS A SEMANTIC FIELD, READ PER CLAUSE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A time word is not currentness; its FUNCTION in the clause is. This reader returns what the
 * clause's time language DOES, with a strength:
 *
 *   CURRENT_STATE  STRONG  "current" modifying a mutable-state head ("the current federal funds
 *                          target range", "aktualna stopa"), "currently", "at the moment", "right
 *                          now", "as of now", "as things stand", "today", "obecnie", "teraz"…
 *   STATUS         STRONG  a status question in the perfect / continuous aspect: "been signed
 *                          yet?", "still clashing", "is X still in force", "czy już podpisano",
 *                          "czy nadal trwa"
 *   SINCE_TO_NOW   STRONG  "so far", "to date", "up to now", "do tej pory", "jak dotąd"
 *   RECENT         STRONG  "lately", "recently", "of late", "ostatnio", "niedawno"
 *   CONTEMPORARY   WEAK    "nowadays", "these days", "still" inside an explanation ("why do
 *                          firms still use COBOL"), "w dzisiejszych czasach" — a present-era
 *                          claim that an explanation may answer from stable knowledge
 *
 * STRONG currentness outranks every question-shape heuristic ("What is X" is a frame, not a
 * time). WEAK currentness never decides on its own: it is a conflict signal for the bounded
 * semantic interpreter. Compounds where "current" is not time ("current account", "electric
 * current", "inrush current") are excluded by their own words. Pure: no I/O, no clock.
 */
export type CurrentnessFunction =
  'CURRENT_STATE' | 'STATUS' | 'SINCE_TO_NOW' | 'RECENT' | 'CONTEMPORARY';

export interface CurrentnessMarker {
  readonly fn: CurrentnessFunction;
  readonly strength: 'STRONG' | 'WEAK';
  /** the reader's own words that carry it */
  readonly text: string;
}

type Lang = 'en' | 'pl';

/* the HEAD of a noun phrase whose value changes over time: what "current" can modify as time */
const EN_STATE_HEAD = String.raw`(?:price|prices|rate|rates|range|level|levels|status|situation|state|regulations?|polic(?:y|ies)|laws?|rules?|requirements?|restrictions?|edition|version|government|president|prime\s+minister|premier|chancellor|leader|leaders|leadership|ministers?|cabinet|ceo|chair(?:man|woman|person)?|governor|head|holders?|champions?|record|figures?|numbers?|total|count|tally|standings|rankings?|score|forecasts?|outlook|estimates?|guidance|target|targets|inflation|unemployment|yields?|spreads?|deficit|debt|reserves|composition|line-?up|squad|roster|sanctions|tariffs?|ceasefire|truce|approach|strategy|position|stance|plans?|crisis|conflict|war|affairs|events?|trends?|debate|negotiations|talks|deal|agreements?|members?|membership|coalition|majority|polls?|polling|ratings?|valuation|market|markets|account\s+balance|limits?|caps?|ceilings?|thresholds?|quotas?|allowances?|fees?|charges?|ratios?|spending|budgets?)`;
const EN_CURRENT_MODIFIER = new RegExp(
  String.raw`\b(?:current|present|existing|prevailing|latest|today['’]?s|up-to-date|up\s+to\s+date)\s+(?:(?!account\b|accounts\b|affairs\s+program)[\p{L}'’-]+\s+){0,4}?${EN_STATE_HEAD}\b`,
  'iu',
);
/* "current" that is NOT time: the electrical quantity and fixed compounds */
const EN_NOT_TIME_CURRENT =
  /\b(?:current\s+account|electric(?:al)?\s+current|alternating\s+current|direct\s+current|inrush\s+current|eddy\s+currents?|ocean\s+currents?|current\s+(?:flow|flows|density|draw|limit|source|sensor|transformer|loop|divider|gain)|(?:amp(?:ere)?s?|voltage|circuit|resistor|coil|motor|battery)\b[^.?!]{0,40}\bcurrent)\b/i;

const EN_CURRENT_STATE_ADVERB =
  /\b(?:currently|at\s+the\s+(?:moment|present\s+time)|at\s+present|presently|right\s+now|as\s+(?:of\s+)?(?:now|today|this\s+(?:week|month|year))|as\s+things\s+stand|as\s+we\s+speak|at\s+this\s+(?:point|time)\s+in|today|tonight|now(?!\s+that\b))\b/i;
/* a status question: perfect aspect + "yet"; "still" / "already" with a state or progressive */
const EN_STATUS_YET =
  /\b(?:has|have|had)\b[^.?!]{0,80}?\byet\b|\byet\s*\?|\bnot\s+yet\b|\b(?:is|are|was|were)\b[^.?!]{0,60}?\b(?:been\s+)?\w+ed\s+yet\b/i;
const EN_STATUS_STILL =
  /^\s*(?:is|are|was|were|does|do|did|has|have|can|will|would)\b[^.?!]{0,60}?\bstill\b|\bstill\s+(?:(?:not|be|being)\s+)?(?:happening|going\s+on|ongoing|underway|holding|in\s+(?:force|place|effect|power|office|charge|operation|talks|negotiations|session|control)\b|at\s+war\b|on\s+(?:track|hold|the\s+table)\b|(?:open|closed|active|valid|alive|suspended|blocked|banned|unresolved|stalled|frozen|deadlocked|disputed|contested|occupied|running|standing|clashing|fighting|negotiating|talking|arguing|feuding)\b)/i;
const EN_SINCE_TO_NOW =
  /\b(?:so\s+far|to\s+date|up\s+(?:to|until)\s+now|until\s+now|thus\s+far|as\s+yet|by\s+now)\b/i;
const EN_RECENT =
  /\b(?:lately|recently|of\s+late|in\s+recent\s+(?:days|weeks|months)|over\s+the\s+(?:past|last)\s+(?:few\s+)?(?:days|weeks|months)|latest|newest|most\s+recent|just\s+(?:announced|happened|released|signed|agreed))\b/i;
const EN_CONTEMPORARY =
  /\b(?:nowadays|these\s+days|in\s+this\s+day\s+and\s+age|in\s+today['’]?s\s+(?:world|economy|society|market)|any\s*more|any\s+longer)\b/i;
/* an explanation frame: weak currentness inside it ("why do firms still use COBOL") */
const EN_EXPLANATION_FRAME = /^\s*(?:why|how\s+come|what\s+explains|what\s+makes)\b/i;

const PL_CURRENT_MODIFIER = plTolerant(
  /(?:^|[\s,])(?:obecn\p{L}*|aktualn\p{L}*|bieżąc\p{L}*|dzisiejsz\p{L}*|najnowsz\p{L}*|teraźniejsz\p{L}*)\s+(?:\p{L}+\s+){0,3}?(?:cen\p{L}*|stop\p{L}*|kurs\p{L}*|poziom\p{L}*|stan\p{L}*|sytuacj\p{L}*|przepis\p{L}*|regulacj\p{L}*|polityk\p{L}*|praw\p{L}*|zasad\p{L}*|wymog\p{L}*|wymagani\p{L}*|ograniczeni\p{L}*|wersj\p{L}*|wydani\p{L}*|rząd\p{L}*|rzad\p{L}*|prezydent\p{L}*|premier\p{L}*|kanclerz\p{L}*|lider\p{L}*|minist\p{L}*|prezes\p{L}*|szef\p{L}*|rekord\p{L}*|dan\p{L}*|liczb\p{L}*|wynik\p{L}*|notowani\p{L}*|prognoz\p{L}*|inflacj\p{L}*|bezroboci\p{L}*|deficyt\p{L}*|dług\p{L}*|rezerw\p{L}*|skład\p{L}*|sankcj\p{L}*|cł\p{L}*|taryf\p{L}*|rozejm\p{L}*|strategi\p{L}*|stanowisk\p{L}*|plan\p{L}*|kryzys\p{L}*|konflikt\p{L}*|wojn\p{L}*|negocjacj\p{L}*|rozmow\p{L}*|porozumie\p{L}*|umow\p{L}*|sondaż\p{L}*|większoś\p{L}*|koalicj\p{L}*|wydarze\p{L}*)/iu,
);
const PL_CURRENT_STATE_ADVERB = plTolerant(
  /(?:^|[\s,])(?:obecnie|aktualnie|teraz|dziś|dzisiaj|w\s+tej\s+chwili|w\s+tym\s+momencie|na\s+chwilę\s+obecną|na\s+dzień\s+dzisiejszy|na\s+dziś|na\s+bieżąco|w\s+chwili\s+obecnej)(?=$|[\s,.?!])/iu,
);
const PL_STATUS = plTolerant(
  /(?:^|\s)czy\s+(?:\p{L}+\s+){0,6}?(?:już|nadal|wciąż|jeszcze|dalej)(?=$|[\s,.?!])|(?:^|\s)(?:nadal|wciąż|ciągle|dalej)\s+(?:się\s+)?(?:\p{L}+(?:ją|a|e|i|y|uje|ują)|trwa\p{L}*|obowiązuj\p{L}*|toczy\p{L}*|są|jest|mają|ma)(?=$|[\s,.?!])|(?:^|\s)(?:jeszcze|dotąd)\s+nie(?=$|[\s,.?!])/iu,
);
const PL_SINCE_TO_NOW = plTolerant(
  /(?:^|[\s,])(?:do\s+tej\s+pory|jak\s+dotąd|dotychczas|dotąd|na\s+razie|do\s+chwili\s+obecnej|do\s+teraz)(?=$|[\s,.?!])/iu,
);
const PL_RECENT = plTolerant(
  /(?:^|[\s,])(?:ostatnio|niedawno|w\s+ostatnim\s+czasie|ostatnimi\s+czasy|w\s+ostatnich\s+(?:dniach|tygodniach|miesiącach)|najnowsz\p{L}*)(?=$|[\s,.?!])/iu,
);
const PL_CONTEMPORARY = plTolerant(
  /(?:^|[\s,])(?:w\s+dzisiejszych\s+czasach|współcześnie|w\s+obecnych\s+czasach|w\s+naszych\s+czasach|już\s+nie|nadal|wciąż)(?=$|[\s,.?!])/iu,
);
const PL_EXPLANATION_FRAME = plTolerant(
  /^\s*(?:dlaczego|czemu|z\s+czego\s+wynika|co\s+sprawia|skąd\s+się\s+bierze)(?![\p{L}])/iu,
);

function first(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m === null ? null : m[0].trim();
}

/** The currentness markers of ONE clause (its own words), strongest first. */
export function readCurrentnessMarkers(clause: string, language: string): CurrentnessMarker[] {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const out: CurrentnessMarker[] = [];
  const push = (fn: CurrentnessFunction, strength: 'STRONG' | 'WEAK', text: string | null) => {
    if (text !== null) out.push({ fn, strength, text });
  };
  if (lang === 'en') {
    const explanation = EN_EXPLANATION_FRAME.test(clause);
    if (!EN_NOT_TIME_CURRENT.test(clause))
      push('CURRENT_STATE', 'STRONG', first(EN_CURRENT_MODIFIER, clause));
    push('CURRENT_STATE', 'STRONG', first(EN_CURRENT_STATE_ADVERB, clause));
    push('STATUS', explanation ? 'WEAK' : 'STRONG', first(EN_STATUS_YET, clause));
    /* "still" in an explanation ("why do people still believe…") is a present-era claim */
    push('STATUS', explanation ? 'WEAK' : 'STRONG', first(EN_STATUS_STILL, clause));
    push('SINCE_TO_NOW', 'STRONG', first(EN_SINCE_TO_NOW, clause));
    push('RECENT', 'STRONG', first(EN_RECENT, clause));
    push('CONTEMPORARY', 'WEAK', first(EN_CONTEMPORARY, clause));
    /* "why do banks still use COBOL" — inside an explanation, "still" is a present-era claim */
    if (explanation && !out.some((m) => m.fn === 'STATUS'))
      push('CONTEMPORARY', 'WEAK', first(/\bstill\b/i, clause));
  } else {
    const explanation = PL_EXPLANATION_FRAME.test(clause);
    push('CURRENT_STATE', 'STRONG', first(PL_CURRENT_MODIFIER, clause));
    push('CURRENT_STATE', 'STRONG', first(PL_CURRENT_STATE_ADVERB, clause));
    push('STATUS', explanation ? 'WEAK' : 'STRONG', first(PL_STATUS, clause));
    push('SINCE_TO_NOW', 'STRONG', first(PL_SINCE_TO_NOW, clause));
    push('RECENT', 'STRONG', first(PL_RECENT, clause));
    if (!out.some((m) => m.fn === 'STATUS'))
      push('CONTEMPORARY', 'WEAK', first(PL_CONTEMPORARY, clause));
  }
  return out.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'STRONG' ? -1 : 1));
}

/** Does the clause carry STRONG currentness (a present state / status / recent period)? */
export function strongCurrentness(clause: string, language: string): boolean {
  return readCurrentnessMarkers(clause, language).some((m) => m.strength === 'STRONG');
}
