import { yearRoles } from './advisory-requirement';
import { plTolerant } from './pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 FOURTH PASS — THE TEMPORAL INTERPRETATION LAYER (resolved BEFORE job / freshness)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Time language is not one thing. Each span gets a ROLE, and the roles resolve into ONE
 * currentness reading in a fixed precedence:
 *
 *   PAST_COMPLETED / HISTORICAL_PERIOD   a completed dated event or period ("the 1997 Asian
 *                                        financial crisis", "w okresie międzywojennym")
 *   CURRENT_STATE                        the present state ("at the moment", "currently", "right
 *                                        now", "presently", "w tej chwili", "obecnie")
 *   RECENT_PERIOD                        recent developments ("lately", "recently", "of late",
 *                                        "in recent weeks", "ostatnio", "w ostatnim czasie")
 *   CONTEMPORARY_TENDENCY                a present-era claim ("nowadays", "these days", "in this
 *                                        day and age", "w dzisiejszych czasach", "współcześnie")
 *   SINCE_PAST_TO_PRESENT                "since 2008", "since then", "od 2015 roku" — BOTH
 *                                        endpoints kept (the past anchor and the present)
 *   REPORTING_WINDOW                     a bounded window reaching now ("this week", "the last
 *                                        30 days", "yesterday")
 *   CURRENT_DISCOURSE_MARKER             a turn-taking "Now," / "A teraz" — form, never time
 *   CONTEST_STATE                        the present standing of a live contest ("who is ahead
 *                                        in the election") — current unless the contest is dated
 *   PLAN_HORIZON / TRIP_DURATION         read by user-job.ts; never news windows
 *   NONE
 *
 * Resolution (first rule that applies):
 *   1 · a completed past anchor + an explicit present comparison → HISTORICAL_AND_CURRENT (MIXED)
 *   2 · CURRENT_STATE / RECENT_PERIOD / REPORTING_WINDOW / SINCE_PAST_TO_PRESENT / a live
 *       CONTEST_STATE → CURRENT
 *   3 · PAST_COMPLETED (a dated event or a historical period) → HISTORICAL — it OUTRANKS the
 *       "particular named event" rule: a dated crisis is history, not the news
 *   4 · CONTEMPORARY_TENDENCY → CONTEMPORARY (an explanation of a present tendency is MIXED; a
 *       factual present-state question is current)
 *   5 · otherwise NONE
 * Pure: no clock is read; the request year comes from the server-held request instant.
 */
export type TemporalSemanticRole =
  | 'PAST_COMPLETED'
  | 'HISTORICAL_PERIOD'
  | 'CURRENT_STATE'
  | 'RECENT_PERIOD'
  | 'CONTEMPORARY_TENDENCY'
  | 'SINCE_PAST_TO_PRESENT'
  | 'REPORTING_WINDOW'
  | 'CURRENT_DISCOURSE_MARKER'
  | 'CONTEST_STATE'
  | 'NONE';

export type TemporalCurrentness =
  'CURRENT' | 'HISTORICAL' | 'HISTORICAL_AND_CURRENT' | 'CONTEMPORARY' | 'NONE';

export interface TemporalSpan {
  readonly role: TemporalSemanticRole;
  readonly text: string;
  /** SINCE_PAST_TO_PRESENT keeps both endpoints. */
  readonly from?: number | string;
  readonly to?: 'PRESENT';
}

export interface TemporalSemantics {
  readonly spans: readonly TemporalSpan[];
  readonly currentness: TemporalCurrentness;
}

type Lang = 'en' | 'pl';

const CURRENT_STATE: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:at\s+the\s+(?:moment|present\s+time)|at\s+present|presently|currently|right\s+now|as\s+(?:of\s+)?(?:now|today|things\s+stand)|as\s+we\s+speak|at\s+this\s+(?:point|time)|today|tonight|(?:is|are)\s+(?:\w+\s+){0,3}(?:happening|going\s+on|unfolding|underway|ongoing)|(?:is|are)\s+being\s+\w+ed)\b/i,
  pl: plTolerant(
    /(?:^|[\s,])(?:w\s+tej\s+chwili|obecnie|aktualnie|teraz|dziś|dzisiaj|na\s+chwilę\s+obecną|w\s+tym\s+momencie|na\s+bieżąco|(?:co\s+)?(?:się\s+)?dzieje\s+się|dzieje)(?=$|[\s,.?!])/iu,
  ),
};
const RECENT_PERIOD: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:lately|recently|of\s+late|as\s+of\s+late|in\s+recent\s+(?:days|weeks|months|times|years)|over\s+the\s+(?:past|last)\s+(?:few\s+)?(?:days|weeks|months)|the\s+(?:past|last)\s+(?:few\s+)?(?:days|weeks|months)|newly|just\s+(?:announced|happened|released))\b/i,
  pl: plTolerant(
    /(?:^|[\s,])(?:ostatnio|niedawno|w\s+ostatnim\s+czasie|ostatnimi\s+czasy|w\s+ostatnich\s+(?:dniach|tygodniach|miesiącach)|w\s+ostatnim\s+(?:tygodniu|miesiącu))(?=$|[\s,.?!])/iu,
  ),
};
const CONTEMPORARY: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:nowadays|these\s+days|in\s+this\s+day\s+and\s+age|in\s+today['’]?s\s+(?:world|economy|society|climate|market)|in\s+the\s+modern\s+(?:era|world|age)|in\s+our\s+time)\b/i,
  pl: plTolerant(
    /(?:^|[\s,])(?:w\s+dzisiejszych\s+czasach|współcześnie|w\s+obecnych\s+czasach|dziś\s+coraz|w\s+naszych\s+czasach)(?=$|[\s,.?!])/iu,
  ),
};
const REPORTING_WINDOW: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:this\s+(?:week|month|quarter|year|morning|weekend)|last\s+(?:week|month|quarter|weekend|night)|yesterday|(?:the\s+)?(?:past|last)\s+\d{1,3}\s+(?:days|weeks|months)|\d{1,3}\s+(?:days|weeks|months)\s+ago)\b/i,
  pl: plTolerant(
    /(?:^|[\s,])(?:w\s+tym\s+(?:tygodniu|miesiącu|kwartale|roku)|w\s+zeszłym\s+(?:tygodniu|miesiącu)|wczoraj|(?:w\s+)?ostatnich\s+\d{1,3}\s+(?:dni|tygodni|miesięcy)|\d{1,3}\s+(?:dni|tygodni|miesięcy)\s+temu)(?=$|[\s,.?!])/iu,
  ),
};
const SINCE_PRESENT: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:ever\s+)?since(?:\s+then|\s+that\s+time)?\s*[?.!]?\s*$|\bsince\s+(?:then|that\s+time|january|february|march|april|may|june|july|august|september|october|november|december|last\s+\w+)\b/i,
  pl: plTolerant(
    /(?:od\s+(?:tamtej|tej)\s+pory|od\s+(?:tamtego|tego)\s+czasu|od\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia))/iu,
  ),
};
/* an explicit comparison with the present ("compare with conditions today", "than today") */
const PRESENT_COMPARISON: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:compare[sd]?|comparison|differ\w*|similar\w*|versus|vs\.?|than|like)\b[^.?!]{0,60}\b(?:today|now|current(?:ly)?|the\s+present|present-?day|nowadays|these\s+days)\b|\b(?:today|now|present-?day)\b[^.?!]{0,40}\b(?:compare[sd]?|versus|vs\.?|than)\b/i,
  pl: plTolerant(
    /(?:porówn\p{L}*|różni\p{L}*|podobn\p{L}*|w\s+porównaniu)[^.?!]{0,60}(?:dziś|dzisiaj|obecn\p{L}*|teraz|współczesn\p{L}*)/iu,
  ),
};
/* named historical periods that are completed by definition */
const HISTORICAL_PERIOD: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:interwar|inter-war|post-?war\s+(?:era|period|decades)|cold\s+war\s+era|during\s+the\s+cold\s+war|in\s+the\s+(?:\d{1,2}(?:st|nd|rd|th)|(?:eighteenth|nineteenth|twentieth|seventeenth|sixteenth))\s+century|medieval|antiquity|colonial\s+(?:era|period|rule)|in\s+the\s+(?:19|18|17)\d0s)\b/i,
  pl: plTolerant(
    /(?:międzywojenn\p{L}*|w\s+okresie\s+(?:międzywojennym|powojennym|PRL)|w\s+czasach\s+PRL|w\s+(?:XV|XVI|XVII|XVIII|XIX|XX)\s+wieku|średniowiecz\p{L}*|starożytn\p{L}*|w\s+latach\s+(?:dwudziestych|trzydziestych|czterdziestych|pięćdziesiątych|sześćdziesiątych|siedemdziesiątych|osiemdziesiątych|dziewięćdziesiątych))/iu,
  ),
};
/* the present standing of a live contest (never the word "ahead" alone) */
const CONTEST_STATE: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:who|which\s+(?:party|candidate|team|side|country))\s+(?:is|are)\s+(?:ahead|leading|winning|in\s+the\s+lead|the\s+favou?rite|favou?red|polling\s+(?:best|highest|first)|on\s+top)\b|\bwho\s+leads\b|\b(?:latest|current)\s+(?:polls?|standings?|tally|count|score)\b/i,
  pl: plTolerant(
    /(?:kto|która\s+partia|który\s+kandydat|która\s+drużyna)\s+(?:obecnie\s+)?(?:prowadzi|wygrywa|jest\s+na\s+prowadzeniu|ma\s+przewagę|jest\s+faworytem)|(?:najnowsze|aktualne)\s+(?:sondaże|wyniki)/iu,
  ),
};
const CONTEST_CONTEXT: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:election|elections|race|primary|primaries|poll|polls|polling|vote|voting|ballot|campaign|contest|league|championship|tournament|match|cup|standings|referendum|runoff|run-off)\b/i,
  pl: plTolerant(
    /(?:wybor\p{L}*|wyścig\p{L}*|prawybor\p{L}*|sondaż\p{L}*|głosowani\p{L}*|kampani\p{L}*|lig\p{L}*|mistrzostw\p{L}*|turniej\p{L}*|mecz\p{L}*|referend\p{L}*|dogrywk\p{L}*)/iu,
  ),
};
/* a past-tense frame for the contest ("who WAS ahead after round 3") */
const PAST_FRAME: Readonly<Record<Lang, RegExp>> = {
  en: /\b(?:was|were|had\s+been|did|led|won|lost)\b/i,
  pl: plTolerant(
    /(?:^|\s)(?:był\p{L}*|prowadził\p{L}*|wygrał\p{L}*|przegrał\p{L}*)(?=$|[\s,.?!])/iu,
  ),
};

function spansOf(re: RegExp, text: string, role: TemporalSemanticRole): TemporalSpan[] {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m === null ? [] : [{ role, text: m[0].trim() }];
}

export function readTemporalSemantics(
  text: string,
  language: string,
  requestYear?: number,
  discourseMarker = false,
): TemporalSemantics {
  const lang: Lang = language === 'pl' ? 'pl' : 'en';
  const spans: TemporalSpan[] = [];
  if (discourseMarker) spans.push({ role: 'CURRENT_DISCOURSE_MARKER', text: 'now' });
  const years = yearRoles(text, lang, requestYear);
  if (years.historical.length > 0)
    spans.push({ role: 'PAST_COMPLETED', text: years.historical.join(', ') });
  spans.push(...spansOf(HISTORICAL_PERIOD[lang], text, 'HISTORICAL_PERIOD'));
  const since = SINCE_PRESENT[lang].exec(text);
  if (since !== null)
    spans.push({ role: 'SINCE_PAST_TO_PRESENT', text: since[0].trim(), to: 'PRESENT' });
  if (years.current) {
    /* "since 2008" keeps both endpoints; the request year itself is the present */
    const sinceYear = /(?:since|from|od)\s+(?:roku\s+)?(\d{4})/i.exec(text);
    spans.push(
      sinceYear !== null
        ? {
            role: 'SINCE_PAST_TO_PRESENT',
            text: sinceYear[0],
            from: Number(sinceYear[1]),
            to: 'PRESENT',
          }
        : { role: 'REPORTING_WINDOW', text: 'the current year' },
    );
  }
  spans.push(...spansOf(CURRENT_STATE[lang], text, 'CURRENT_STATE'));
  spans.push(...spansOf(RECENT_PERIOD[lang], text, 'RECENT_PERIOD'));
  spans.push(...spansOf(REPORTING_WINDOW[lang], text, 'REPORTING_WINDOW'));
  spans.push(...spansOf(CONTEMPORARY[lang], text, 'CONTEMPORARY_TENDENCY'));
  const contest =
    CONTEST_STATE[lang].test(text) &&
    CONTEST_CONTEXT[lang].test(text) &&
    !PAST_FRAME[lang].test(text);
  if (contest) spans.push({ role: 'CONTEST_STATE', text: 'the present standing of a contest' });

  const has = (r: TemporalSemanticRole) => spans.some((s) => s.role === r);
  const past = has('PAST_COMPLETED') || has('HISTORICAL_PERIOD');
  const present =
    has('CURRENT_STATE') ||
    has('RECENT_PERIOD') ||
    has('REPORTING_WINDOW') ||
    has('SINCE_PAST_TO_PRESENT') ||
    has('CONTEST_STATE');
  const currentness: TemporalCurrentness =
    past && (PRESENT_COMPARISON[lang].test(text) || has('SINCE_PAST_TO_PRESENT'))
      ? 'HISTORICAL_AND_CURRENT'
      : present && !(past && !has('SINCE_PAST_TO_PRESENT') && onlyPastTense(text, lang))
        ? 'CURRENT'
        : past
          ? 'HISTORICAL'
          : has('CONTEMPORARY_TENDENCY')
            ? 'CONTEMPORARY'
            : 'NONE';
  return { spans: spans.length === 0 ? [{ role: 'NONE', text: '' }] : spans, currentness };
}

/* "currently" inside a past frame ("what was happening at the time in 1997") stays historical */
function onlyPastTense(text: string, lang: Lang): boolean {
  return lang === 'en'
    ? /\b(?:at\s+the\s+time|back\s+then|in\s+those\s+days)\b/i.test(text)
    : plTolerant(/(?:wówczas|wtedy|w\s+tamtych\s+czasach|w\s+tamtym\s+okresie)/iu).test(text);
}

/** Does the temporal reading put the question (or this clause) in the present? */
export function temporallyCurrent(text: string, language: string, requestYear?: number): boolean {
  const c = readTemporalSemantics(text, language, requestYear).currentness;
  return c === 'CURRENT' || c === 'HISTORICAL_AND_CURRENT' || c === 'CONTEMPORARY';
}

/** A completed past anchor with nothing reaching the present (a dated event / period). */
export function temporallyPastOnly(text: string, language: string, requestYear?: number): boolean {
  return readTemporalSemantics(text, language, requestYear).currentness === 'HISTORICAL';
}
