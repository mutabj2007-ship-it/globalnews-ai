import { resolveCountriesByDemonym } from '../news/country/country-relevance.util';
import { resolvePrimaryCountry } from '../news/country/country-relevance.util';
import { deriveEventFrame } from '../analysis/query/event-frame.util';
import { solveComputation } from '../ask-v2/computation/deterministic-computation';
import { assertsFreshness } from '../analysis/query/query-intent.util';
import { readAdvisory } from './advisory-requirement';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — THE KNOWLEDGE-REQUIREMENT AXIS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production: 14 of 15 stable technical questions ("Why does a three-phase induction motor draw
 * a high inrush current …", "What is the difference between TCP and UDP?") were sent to NEWS or
 * asked to "add a place, topic or period". Two couplings did it:
 *
 *   1  a DOMAIN was read as FRESHNESS — frozen C's planner requires NEWS_REPORTING whenever an
 *      analytical domain is present (planner.ts `wantsReporting … || domains.length > 0`); and
 *   2  the landed intent defaults to CURRENT_EVENT (a news product reading a topic as news), and
 *      "difference between X and Y" with no named country is a CLARIFICATION (comparison with
 *      no determinable members).
 *
 * Frozen C is vendored byte-identical and verified on every run, so it is not edited. This axis
 * is derived BEFORE the envelope is composed, orthogonal to the domain:
 *
 *   DOMAIN                answers WHAT the question is about        (engineering, economy …)
 *   KNOWLEDGE REQUIREMENT answers WHAT KIND of evidence / execution it needs
 *
 *   STABLE_REFERENCE         a stable conceptual / mechanism / difference question with no
 *                            freshness marker, no place and no event → model background
 *   COMPUTATION              explicit values + a quantity to compute → deterministic engine
 *   CURRENT_REPORTING        a freshness marker, a place, or a changing quantity → news
 *   EVENT_DISCOVERY          an event frame (R2A) → event retrieval
 *   OFFICIAL_REFERENCE       the current edition / latest requirements of a standard or rule
 *   MIXED_REFERENCE_CURRENT  a stable shape that ALSO asserts freshness → current path
 *
 * Only STABLE_REFERENCE and COMPUTATION change what frozen C is handed; every other value keeps
 * the question's existing routing exactly and is recorded for the trace.
 */
export type KnowledgeRequirement =
  | 'STABLE_REFERENCE'
  | 'COMPUTATION'
  | 'CURRENT_REPORTING'
  | 'EVENT_DISCOVERY'
  | 'OFFICIAL_REFERENCE'
  | 'MIXED_REFERENCE_CURRENT'
  /**
   * TRUST & CONVERSATIONAL EXPERIENCE R1 — a NAMED PLACE asked about for its history, its
   * background, or travel preparation, with no freshness marker ("What caused the Rwandan
   * genocide?", "When did Poland join the EU?", "I want to visit Tanzania … before going there").
   * Answered as background SCOPED to the place, never as an empty news search; current details
   * (requirements, safety, prices) are named as needing current sources, never supplied from memory.
   */
  | 'PLACE_REFERENCE'
  /**
   * CTO P0 — advice / decision support (advisory-requirement.ts): answered by the background /
   * reasoning provider as general guidance, never as current sourced fact, with NO news call.
   */
  | 'ADVISORY'
  /** CTO P0 — advice plus an explicitly time-anchored part: the advice is answered, the current
   *  part is named as needing current sourced evidence (never the whole answer INSUFFICIENT). */
  | 'MIXED_ADVISORY_CURRENT';

export interface KnowledgeRequirementReading {
  readonly requirement: KnowledgeRequirement | null;
  readonly reason: string;
  /** TRUST R1 §14 — which PLACE_REFERENCE frame matched (travel preparation or the past). */
  readonly frame?: 'TRAVEL' | 'HISTORY';
  /** CTO P0 — for MIXED_ADVISORY_CURRENT, the time-anchored clauses that need current evidence. */
  readonly currentClauses?: readonly string[];
}

/**
 * Stable conceptual shapes — question FORMS, never topic nouns — tested on the first clause.
 * The FIRST entry of each list is the bare "what is" opener; the rest are EXPLANATORY shapes.
 * English and Polish mirror each other so EN/PL twins always route identically (L-corpus).
 */
const STABLE_SHAPES: Readonly<Record<'en' | 'pl', readonly RegExp[]>> = {
  en: [
    /^(?:what\s+is|what\s+are)\s+(?:a|an|the)?\s*/i,
    /^explain\b/i,
    /^describe\b/i,
    /^how\s+(?:does|do|can|could|is|are)\s+/i,
    /^why\s+(?:does|do|can|could|is|are|must|should|would)\s+/i,
    /^what\s+happens\s+(?:inside|in|when|to|during)\b/i,
    /^what\s+(?:is|are)\s+the\s+differences?\s+between\b/i,
    /^explain\s+the\s+differences?\s+between\b/i,
    /^under\s+what\s+conditions\b/i,
    /^explain\s+the\s+roles?\s+of\b/i,
    /^what\s+causes\b/i,
    /^what\s+physically\s+happens\b/i,
    /^what\s+does\s+.+\s+mean\b/i,
  ],
  pl: [
    /^(?:czym\s+(?:jest|s[ąa])|co\s+to\s+(?:jest|s[ąa]|za))\b/iu,
    /^wyja[śs]nij\b/iu,
    /^opisz\b/iu,
    /^jak\s+dzia[łl]a(?:j[ąa])?\b/iu,
    /^(?:dlaczego|czemu)\b/iu,
    /^co\s+oznacza\b/iu,
    /^jaka\s+jest\s+r[óo][żz]nica\s+mi[ęe]dzy\b/iu,
    /^na\s+czym\s+polega\b/iu,
    /^co\s+powoduje\b/iu,
  ],
};

/**
 * Freshness markers: these always outrank a stable shape (→ MIXED / CURRENT). They include
 * PRESENT-STATE nouns ("the security situation", "the status of …"): a situation is now.
 */
const FRESHNESS: Readonly<Record<'en' | 'pl', RegExp>> = {
  /* "current" counts only as a TIME adjective before a state noun ("current price", "the current
     security situation") — never as the electrical quantity ("inrush current"). */
  en: /\b(?:today|tonight|now|right\s+now|currently|current\s+(?:\w+\s+)?(?:price|prices|rate|rates|level|levels|status|situation|state|regulation|regulations|policy|policies|law|laws|edition|version|government|president|leader|leadership|events?|affairs|conflict|war)|latest|recent|recently|this\s+(?:week|month|year)|yesterday|announced|breaking|new\s+(?:law|policy|policies|rule|rules|regulation|regulations|standard|bill|tariff)|price\s+of|so\s+far|in\s+20\d\d|20\d\d|situation|status|developments?|crisis|outlook|tensions|negotiations|headlines|news)\b/i,
  pl: /(?:^|[\s,])(?:dzi[śs]|dzisiaj|teraz|obecn\p{L}*|aktualn\p{L}*|najnowsz\p{L}*|ostatni\p{L}*|w\s+tym\s+(?:tygodniu|miesi[ąa]cu|roku)|wczoraj|og[łl]osi\p{L}*|og[łl]oszon\p{L}*|sytuacj\p{L}*|stan\p{L}*|kurs\p{L}*|cen[aeyę]|kryzys\p{L}*|wiadomo[śs]\p{L}*|nag[łl][óo]wk\p{L}*|20\d\d)(?=$|[\s,?.!])/iu,
};

/**
 * A changing quantity asked in the progressive is news ("Why is the dollar falling?", "How is
 * trade developing?"). The auxiliary is REQUIRED in English: "Why does increasing a pipe's
 * diameter …" is a gerund, not a trend.
 */
const CHANGING: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:is|are|was|were|has\s+been|have\s+been|keeps?)\b[^.?!]{0,40}?\b(?:rising|falling|increasing|decreasing|surging|soaring|dropping|plunging|climbing|slumping|happening|going\s+on|changing|collapsing|escalating|developing|evolving|growing|shrinking|progressing|worsening|improving)\b/i,
  pl: /(?:ro[śs]nie|rosn[ąa]|spada(?:j[ąa])?|rozwija(?:j[ąa])?\s+si[ęe]|zmienia(?:j[ąa])?\s+si[ęe]|pogarsza\s+si[ęe]|poprawia\s+si[ęe]|dzieje\s+si[ęe])/iu,
};

/** The current edition / requirements of a named standard or rule: an official reference. */
const OFFICIAL_REFERENCE =
  /\b(?:IEC|ISO|IEEE|EN|ANSI|ASTM|NFPA|UL|RFC|ETSI|ITU-T)\s*[\d-]|\b(?:standard|regulation|directive|code|specification)\b.*\b(?:latest|current\s+edition|current\s+version|in\s+force|require[sd]?|specif(?:y|ies))\b/i;

/** Asked for a computed quantity. */
const COMPUTE_CUE =
  /\b(?:estimate|determine|find|derive|calculate|compute|work\s+out|show\s+the\s+calculation|what\s+(?:is|are)\s+the\s+(?:output|input|power|current|voltage|efficiency|energy|resistance))\b/i;

/*
  TRUST & CONVERSATIONAL EXPERIENCE R1 — PLACE_REFERENCE frames. These are question FRAMES (how a
  past event or a journey is asked about), not topic nouns, tested together with a named place.

  HISTORY  a completed past: "when did / when was / who was / who founded / what caused / what led
           to / why did / how did", or "history of", "historical", "independence", "colonial".
  TRAVEL   the reader preparing a journey: visiting, travelling to, a trip/holiday/safari, packing,
           "before going". A travel question that ALSO asserts freshness ("Is it safe to travel to
           Kenya now?") stays current reporting.
*/
const HISTORY_FRAME: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^(?:when\s+(?:did|was|were)|who\s+(?:was|were|founded|ruled|colonized|colonised)|what\s+(?:caused|led\s+to|was\s+the\s+cause)|why\s+did|how\s+did)\b|\b(?:history\s+of|historical(?:ly)?|independence|colonial|pre-?colonial|ancient)\b/i,
  pl: /^(?:kiedy\s+(?:\p{L}+\s+)?(?:by[łl]\p{L}*|wst[ąa]pi\p{L}*|uzyska\p{L}*)|kto\s+(?:by[łl]\p{L}*|za[łl]o[żz]y[łl]\p{L}*)|co\s+spowodowa[łl]\p{L}*|dlaczego\s+dosz[łl]o)|(?:histori\p{L}*|niepodleg[łl]o[śs]\p{L}*|kolonial\p{L}*|staro[żz]ytn\p{L}*)/iu,
};
const TRAVEL_FRAME: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:visit(?:ing)?|travel(?:l?ing)?\s+(?:to|in|around)|trip\s+to|holiday\s+in|vacation\s+in|safari|itinerary|pack\s+for|before\s+(?:going|travelling|traveling|my\s+trip)|tourist(?:s)?\s+(?:attractions|sites)|things\s+to\s+(?:do|see))\b/i,
  pl: /(?:odwiedzi\p{L}*|podr[óo][żz]\p{L}*\s+do|wycieczk\p{L}*|wakacj\p{L}*\s+w|zwiedz\p{L}*|safari|spakowa\p{L}*|przed\s+wyjazdem|atrakcj\p{L}*\s+turystyczn\p{L}*)/iu,
};

/*
  TRUST R1 §14 — A FUTURE PERIOD INSIDE A TRAVEL REQUEST IS THE TRIP'S TIMING, NOT A NEWS WINDOW.
  "Going on holiday in Tanzania next year, any tips?" states WHEN the reader travels; it never
  asks what was reported next year. Within a TRAVEL frame these spans are set aside before the
  freshness test, and the router keeps the question on the place-background path. Only
  forward-pointing spans: "this year", "now", "latest" and every past period still mean current
  reporting ("Is it safe to travel to Kenya now?" stays news). A bare year counts only when it is
  after the request year, so "Kenya in 2025" is never treated as a future trip.
*/
const FUTURE_PERIOD: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:(?:next|coming|upcoming|following)\s+(?:year|month|week|weekend|summer|winter|spring|autumn|fall|season|holidays?|christmas|easter)|this\s+coming\s+(?:year|month|week|weekend|summer|winter|spring|autumn|fall)|in\s+(?:a\s+few|a\s+couple\s+of|\d{1,2}|two|three|four|five|six)\s+(?:days|weeks|months|years)(?:'?\s*time)?)\b/gi,
  pl: /(?:w\s+)?(?:przysz[łl]\p{L}*|nast[ęe]pn\p{L}*|nadchodz[ąa]c\p{L}*)\s+(?:rok\p{L}*|roku|miesi[ąa]c\p{L}*|tydzie\p{L}*|tygodni\p{L}*|lat\p{L}*|wakacj\p{L}*|weekend\p{L}*|zim\p{L}*|wiosn\p{L}*|jesie\p{L}*|sezon\p{L}*)|za\s+(?:\d{1,2}|kilka|dwa|trzy|par[ęe])\s+(?:dni|tygodni|miesi[ęe]cy|lat)/giu,
};
const YEAR_SPAN = /(?:(?:in|w)\s+)?\b(20\d\d)\b(?:\s+roku)?/giu;

/** The question with every forward-pointing period removed (for a travel-frame freshness test). */
export function withoutFuturePeriods(
  text: string,
  lang: 'en' | 'pl',
  requestYear?: number,
): string {
  const stripped = text.replace(FUTURE_PERIOD[lang], ' ');
  return requestYear === undefined
    ? stripped
    : stripped.replace(YEAR_SPAN, (span, year: string) =>
        Number(year) > requestYear ? ' ' : span,
      );
}

/** Is this stated period (the reader's own span) entirely forward-pointing? */
export function isFuturePeriod(span: string, language: string, requestYear?: number): boolean {
  if (language !== 'en' && language !== 'pl') return false;
  return span.trim().length > 0 && withoutFuturePeriods(span, language, requestYear).trim() === '';
}

/*
  TRUST R1 §14 — A HISTORICAL ENTITY ASKED ABOUT IN THE PAST TENSE IS BACKGROUND. "What was the
  Ottoman Empire?" / "What were the Crusades?" / "Czym było Imperium Osmańskie?": an identity
  question in the past tense whose whole remainder is a proper name. A FORM, never a list of
  entities; a common-noun remainder ("What was the outcome of the election?") is untouched, and
  any freshness marker ("… in the news today") keeps the current path.
*/
const HISTORICAL_IDENTITY: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^[Ww]hat\s+(?:was|were)\s+(?:[Tt]he\s+|[Aa]n?\s+)?\p{Lu}[\p{L}'’.-]*(?:\s+(?:(?:of|and|de|the)\s+)*\p{Lu}[\p{L}'’.-]*)*\s*\??$/u,
  pl: /^(?:[Cc]zym|[Cc]o\s+to)\s+by[łl](?:a|o|y)?\s+\p{Lu}[\p{L}'’.-]*(?:\s+[\p{L}'’.-]+){0,4}\s*\??$/u,
};

function firstClause(text: string): string {
  const first = text.split(/(?<=[.?!])\s+/)[0] ?? text;
  return first.trim();
}

export function deriveKnowledgeRequirement(
  question: string,
  language: string,
  /** The router's reading: did the reader NAME a place (its words are in the question)? */
  namedPlace = false,
  /** TRUST R1 §14 — the request year, so a stated year can be read as a future trip. */
  requestYear?: number,
): KnowledgeRequirementReading {
  const text = question.trim();
  if ((language !== 'en' && language !== 'pl') || text.length === 0) {
    return { requirement: null, reason: 'only English and Polish shapes are governed in R1' };
  }
  const lang: 'en' | 'pl' = language;

  const computation = lang === 'en' && COMPUTE_CUE.test(text) ? solveComputation(text) : undefined;
  if (computation !== undefined) {
    return {
      requirement: 'COMPUTATION',
      reason: `deterministic ${computation.status === 'SOLVED' ? computation.result.kind : computation.kind}`,
    };
  }
  if (lang === 'en' && deriveEventFrame(text, 'en') !== undefined) {
    return {
      requirement: 'EVENT_DISCOVERY',
      reason: 'an event frame (type + route or identifier)',
    };
  }
  const official =
    lang === 'en' &&
    OFFICIAL_REFERENCE.test(text) &&
    /\b(?:latest|current|in\s+force|require|specif)/i.test(text);
  if (official)
    return {
      requirement: 'OFFICIAL_REFERENCE',
      reason: 'the current requirements of a named standard or rule',
    };

  /* PR #72 — the governed freshness reading (event participles; "new" qualifying a changeable
     instrument) is the same authority the landed classifier uses; never a second copy. */
  const travel = TRAVEL_FRAME[lang].test(text);
  /* TRUST R1 §14 — inside a travel request a forward-pointing period is the trip's timing. */
  const freshText = travel ? withoutFuturePeriods(text, lang, requestYear) : text;
  const fresh =
    assertsFreshness(freshText) ||
    FRESHNESS[lang].test(freshText) ||
    CHANGING[lang].test(freshText);
  const historicalIdentity = HISTORICAL_IDENTITY[lang].test(text);
  const place =
    namedPlace ||
    resolvePrimaryCountry({ title: text, summary: '' }) !== undefined ||
    resolveCountriesByDemonym(text).length > 0;
  const stableShape = STABLE_SHAPES[lang].some((shape) => shape.test(firstClause(text)));
  /* An EXPLANATORY shape (everything but the bare "what is / what are" opener) that also asserts
     freshness is mixed; "What is the current price of …" is simply current. */
  const explanatory = STABLE_SHAPES[lang].slice(1).some((shape) => shape.test(firstClause(text)));

  /* TRUST & CONVERSATIONAL EXPERIENCE R1 — a named place asked about for its past or for a
     journey, with no freshness marker, is place background (not an empty news search). */
  if (
    place &&
    !fresh &&
    (HISTORY_FRAME[lang].test(firstClause(text)) ||
      HISTORY_FRAME[lang].test(text) ||
      historicalIdentity ||
      travel)
  ) {
    return {
      requirement: 'PLACE_REFERENCE',
      reason: travel ? 'travel preparation for a named place' : 'history of a named place',
      frame: travel ? 'TRAVEL' : 'HISTORY',
    };
  }
  /*
    CTO P0 — advice / decision support. Read BEFORE the news-oriented freshness rules below: their
    topic nouns ("news", "situation", "status") are not time, and an advisory question about a
    "news intelligence product" is not a request for news. Genuine freshness (an explicit time
    marker) still outranks advice: it makes the question MIXED, and the timed part is named.
  */
  const advisory = readAdvisory(text, lang);
  if (advisory !== null) {
    return advisory.mode === 'ADVISORY'
      ? { requirement: 'ADVISORY', reason: 'a request for advice / decision support' }
      : {
          requirement: 'MIXED_ADVISORY_CURRENT',
          reason: 'advice with an explicitly time-anchored part',
          currentClauses: advisory.currentClauses,
        };
  }
  if (!place && !fresh && historicalIdentity) {
    return {
      requirement: 'STABLE_REFERENCE',
      reason: 'a historical entity asked about in the past tense',
    };
  }
  if (explanatory && fresh) {
    return {
      requirement: 'MIXED_REFERENCE_CURRENT',
      reason: 'a stable shape that also asserts freshness',
    };
  }
  if (fresh || place) {
    return {
      requirement: 'CURRENT_REPORTING',
      reason: fresh ? 'a freshness marker' : 'a named place',
    };
  }
  if (stableShape) {
    return {
      requirement: 'STABLE_REFERENCE',
      reason: 'a stable conceptual / mechanism / difference question',
    };
  }
  return { requirement: null, reason: 'no governed shape — existing routing' };
}
