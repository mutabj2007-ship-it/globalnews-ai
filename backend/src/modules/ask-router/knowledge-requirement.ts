import { resolveCountriesByDemonym } from '../news/country/country-relevance.util';
import { resolvePrimaryCountry } from '../news/country/country-relevance.util';
import { deriveEventFrame } from '../analysis/query/event-frame.util';
import { solveComputation } from '../ask-v2/computation/deterministic-computation';
import { assertsFreshness } from '../analysis/query/query-intent.util';
import {
  EN_PUBLIC_EVENT,
  hasExplicitTime,
  PL_PUBLIC_EVENT,
  readAdvisory,
  refersToCurrentYear,
} from './advisory-requirement';
import { readDecisionSupport } from './decision-support';
import { foldPl, plTolerant } from './pl-tolerant';
import { readTemporalSemantics, temporallyCurrent, temporallyPastOnly } from './temporal-semantics';
import { mixedFromIntents, readClauseIntents } from './clause-intent';
import { readEvaluationKind } from './decision-objective';

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
  | 'MIXED_ADVISORY_CURRENT'
  /**
   * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §12 — a choice weighed against the reader's objective
   * (decision-support.ts): reasoning over criteria and trade-offs, conditional on stated
   * assumptions, never a fake universal winner and never current figures from memory. With no
   * objective, the reader is asked "best for what?" at zero compute.
   */
  | 'DECISION_SUPPORT';

export interface KnowledgeRequirementReading {
  readonly requirement: KnowledgeRequirement | null;
  readonly reason: string;
  /** TRUST R1 §14 — which PLACE_REFERENCE frame matched (travel preparation, the past, or — R3 —
   *  a stable structural explanation of a place: "Why is Chile's economy so dependent on copper?"). */
  readonly frame?: 'TRAVEL' | 'HISTORY' | 'EXPLANATION';
  /** CTO P0 — for MIXED_ADVISORY_CURRENT, the time-anchored clauses that need current evidence. */
  readonly currentClauses?: readonly string[];
  /** R3 §12 — for DECISION_SUPPORT, the reader's objective (null: not stated). */
  readonly objective?: string | null;
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
    /* R3 — the past as explanation ("How did the Meiji restoration begin?") */
    /^how\s+did\b/i,
    /* CTO R4 fourth pass — the stable SEMANTIC forms (difference, similarity, mechanism, cause,
       implication), not a mirror of interrogatives */
    /^how\s+(?:is|are|was|were)\s+.{2,80}?\s+(?:different|similar)\s+(?:from|to)\b/i,
    /^what\s+(?:distinguishes|separates|explains|drives|determines|links|connects|unites)\b/i,
    /^what\s+do\s+.{2,80}?\s+have\s+in\s+common\b/i,
    /^where\s+(?:does|do)\s+.{2,60}?\s+come\s+from\b/i,
    /^what\s+(?:are|is)\s+the\s+(?:consequences?|effects?|implications?|impacts?|causes?|roots?|origins?|similarit(?:y|ies)|mechanisms?|drivers?)\s+of\b/i,
    /^what\s+(?:does|would|could)\s+.{2,80}?\s+mean\s+for\b/i,
    /^what\s+(?:impact|effect|role)\s+(?:does|do|can|could|did)\b/i,
    /* CTO R4 fifth pass — what something does / is for, what makes it what it is, why it matters */
    /^what\s+(?:exactly\s+|actually\s+|really\s+)?(?:does|do)\s+.{1,80}?\s+(?:do|involve|entail|cover)\b/i,
    /^what\s+(?:exactly\s+)?makes\b/i,
    /^what\s+is\s+the\s+(?:role|purpose|function|point)\s+of\b/i,
    /^why\s+(?:does|do)\s+.{1,80}?\s+matter\b/i,
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
    /^jak\s+dosz[łl]o\b/iu,
    /* CTO R4 fourth pass — the stable SEMANTIC forms in Polish (difference, similarity,
       mechanism, cause, implication), with or without diacritics (plTolerant) */
    /^czym\s+(?:się\s+)?różni\p{L}*/iu,
    /^co\s+(?:odróżnia|różni|łączy|wyróżnia)(?![\p{L}])/iu,
    /^jaka\s+jest\s+różnica(?![\p{L}])/iu,
    /^(?:jakie|jaki|jaka)\s+(?:są\s+|jest\s+|ma\s+|mają\s+)?(?:różnic\p{L}*|podobieństw\p{L}*|skutk\p{L}*|konsekwencj\p{L}*|przyczyn\p{L}*|źródł\p{L}*|mechanizm\p{L}*|wpływ\p{L}*|znaczeni\p{L}*|rol\p{L}*)(?![\p{L}])/iu,
    /^(?:z\s+czego\s+wynika|skąd\s+(?:się\s+)?(?:bierze|biorą|wziął|wzięła|wzięło|wzięli)|co\s+jest\s+przyczyną|w\s+czym\s+(?:tkwi|leży)|na\s+czym\s+opiera\s+się)(?![\p{L}])/iu,
    /^co\s+(?:oznacza|znaczy)\s+.{2,80}?\s+dla(?![\p{L}])/iu,
    /^czym\s+się\s+charakteryzuj\p{L}*/iu,
  ].map(plTolerant),
};

/**
 * Freshness markers: these always outrank a stable shape (→ MIXED / CURRENT). They include
 * PRESENT-STATE nouns ("the security situation", "the status of …"): a situation is now.
 */
const FRESHNESS: Readonly<Record<'en' | 'pl', RegExp>> = {
  /* "current" counts only as a TIME adjective before a state noun ("current price", "the current
     security situation") — never as the electrical quantity ("inrush current"). */
  en: /\b(?:today|tonight|now|right\s+now|currently|current\s+(?:\w+\s+)?(?:price|prices|rate|rates|level|levels|status|situation|state|regulation|regulations|policy|policies|law|laws|edition|version|government|president|leader|leadership|events?|affairs|conflict|war)|latest|recent|recently|this\s+(?:week|month|year)|yesterday|announced|breaking|new\s+(?:law|policy|policies|rule|rules|regulation|regulations|standard|bill|tariff)|price\s+of|so\s+far|since\s+(?:then|that\s+time|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|last\s+\w+|the\s+(?:start|beginning)\s+of\s+(?:the\s+)?(?:year|month|week))|(?:the\s+)?(?:past|last|previous)\s+(?:few\s+|couple\s+(?:of\s+)?|\d{1,3}\s+|[a-z]+\s+)?(?:days?|weeks?|months?|fortnight))\b/i,
  pl: plTolerant(
    /(?:^|[\s,])(?:dzi[śs]|dzisiaj|teraz|obecn\p{L}*|aktualn\p{L}*|najnowsz\p{L}*|ostatni\p{L}*|w\s+tym\s+(?:tygodniu|miesi[ąa]cu|roku)|od\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrze[śs]nia|pa[źz]dziernika|listopada|grudnia|poniedzia[łl]ku|wtorku|[śs]rody|czwartku|pi[ąa]tku|soboty|niedzieli|pocz[ąa]tku\s+(?:roku|miesi[ąa]ca|tygodnia)|tamtego\s+czasu|tego\s+czasu|tamtej\s+pory|tej\s+pory|zesz[łl]\p{L}*\s+\p{L}+)|(?:zesz[łl]\p{L}*|minion\p{L}*)\s+(?:\p{L}+\s+)?(?:dni|tygodni\p{L}*|tydzie[ńn]|miesi[ąa]c\p{L}*|miesi[ęe]cy)|wczoraj|og[łl]osi\p{L}*|og[łl]oszon\p{L}*)(?=$|[\s,?.!])/iu,
  ),
};

/*
  CTO R4 THIRD PASS — "NEWS" IS A SUBJECT NOUN UNLESS IT IS THE THING REQUESTED. "How should I
  judge whether a news outlet is trustworthy?" and "How can news framing affect understanding?"
  are about news as a subject. Reporting is requested when news / headlines are the OBJECT asked
  for: "the latest news", "any news about Kenya", "news on the Sudan talks", "in the news",
  "what is the news" (PL "najnowsze wiadomości", "wiadomości z Polski", "co słychać").
*/
const NEWS_REQUEST: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:the|any|latest|recent|today['’]?s|top|breaking|current|world|global|international|local|national|morning|evening|daily|this\s+week['’]?s)\s+(?:[\p{L}-]+\s+)?(?:news|headlines)\b(?!\s+(?:outlets?|organi[sz]ations?|media|literacy|industry|business(?:es)?|anchors?|framing|sources?|sites?|apps?|products?|consumption|values?|cycle|desk|agenc(?:y|ies)|reporters?|editors?|publishers?|platforms?|ecosystem))|\b(?:news|headlines)\s+(?:about|on|from|regarding|in|for|out\s+of|concerning)\s+(?:the\s+)?\p{Lu}|\bin\s+the\s+(?:news|headlines)\b|^\s*(?:any\s+)?(?:news|headlines)\b(?!\s+(?:outlets?|media|literacy|framing|organi[sz]ations?|industry|sources?))|\bwhat\s+is\s+(?:the\s+)?(?:news|headlines)\b|\b(?:news|headlines)\s+(?:today|this\s+(?:week|morning|evening)|right\s+now)\b/iu,
  pl: plTolerant(
    /(?:najnowsz\p{L}*|dzisiejsz\p{L}*|ostatni\p{L}*|aktualn\p{L}*|bieżąc\p{L}*|główn\p{L}*|jakie\s+(?:są\s+)?)\s+(?:\p{L}+\s+)?(?:wiadomoś\p{L}*|nagłówk\p{L}*)|(?:wiadomoś\p{L}*|nagłówk\p{L}*)\s+(?:z|ze|o|na\s+temat|dotycząc\p{L}*)\s+\p{Lu}|(?:wiadomoś\p{L}*|nagłówk\p{L}*)\s+(?:ze\s+świata|z\s+kraju)|^\s*(?:jakieś\s+)?(?:wiadomoś\p{L}*|nagłówk\p{L}*)(?=\s|$|[?,.!])|co\s+słychać/iu,
  ),
};

/** Is news / are headlines the OBJECT requested (a reporting request), not a subject noun? */
export function requestsNews(text: string, language: string): boolean {
  return NEWS_REQUEST[language === 'pl' ? 'pl' : 'en'].test(text);
}

/*
  CTO R4 CLOSEOUT — A WORD FOR A POTENTIALLY CURRENT PHENOMENON IS NOT A REQUEST FOR CURRENT
  REPORTING. State nouns ("situation", "status", "crisis", "tensions"…; PL "sytuacja", "stan",
  "kryzys", "kurs", "ceny") and public-event nouns ("war", "election"…) are SUBJECT MATTER. They
  count as currentness only when they refer to a PARTICULAR instance:
    · a named place in the question ("the crisis in Lebanon", "kryzys w Argentynie");
    · a definite / demonstrative / possessive determiner or a time adjective close before it
      ("the situation", "this war", "Argentina's currency crisis", "the ongoing talks",
       PL "ten kryzys", "obecna sytuacja", "trwająca wojna");
    · a proper-noun modifier ("the Eurozone crisis");
    · a request for the present state ("what is the situation", PL "jaka jest sytuacja",
      "jak wygląda sytuacja").
  A generic use ("into a big crisis", "how can a war reshape an economy", "w czasie kryzysu")
  is a conceptual subject, never time. The noun list names phenomena; the decision is the FORM.
*/
const STATE_NOUN: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:situation|status|developments?|crisis|crises|outlook|tensions|negotiations)\b/giu,
  pl: /(?:^|[\s,])(?:sytuacj\p{L}*|stan|stanu|stanie|kurs\p{L}*|cen[aeyę]|kryzys\p{L}*)(?=$|[\s,?.!])/giu,
};
const EN_ANCHOR_BEFORE =
  /(?:^|[\s(])(?:the|this|that|these|those|its|their|our|your|current|ongoing|recent|latest|present|unfolding|today['’]s)\s+(?:(?!(?:a|an|of|in|into|during|to|for|from|and|or|by)\s)[\p{L}-]+\s+){0,2}$/iu;
const PL_ANCHOR_BEFORE =
  /(?:^|\s)(?:ten|ta|to|tego|tej|tym|tę|obecn\p{L}*|aktualn\p{L}*|trwając\p{L}*|bieżąc\p{L}*|ostatni\p{L}*|najnowsz\p{L}*|obecnie|(?:jaki|jaka|jakie)\s+(?:jest|są|był\p{L}*)|jak\s+wygląda(?:ją)?)\s+(?:\p{L}+\s+){0,1}$/iu;
/* words that end a noun's modifier run: a proper modifier must sit inside the noun phrase */
const MODIFIER_STOP: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^(?:a|an|of|in|into|during|to|for|from|and|or|by|do|does|did|can|could|is|are|was|were|how|why|what|when|will|would|may|might)$/i,
  pl: /^(?:w|we|na|do|z|ze|i|oraz|o|od|dla|po|przy|przez|jak|dlaczego|czy|co|może|mogą|jest|są)$/i,
};

/**
 * A PROPER modifier inside the noun phrase ("the Eurozone crisis", "Argentina's currency crisis",
 * "Brexit negotiations"): a capitalised word that is NOT the first word of its sentence (that is
 * capitalised by grammar) or a possessive, within the two words before the noun, with no function
 * word in between.
 */
function properModifierBefore(textBefore: string, lang: 'en' | 'pl'): boolean {
  const sentence = textBefore.slice(
    Math.max(
      textBefore.lastIndexOf('.'),
      textBefore.lastIndexOf('?'),
      textBefore.lastIndexOf('!'),
    ) + 1,
  );
  const tokens = sentence
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  for (let i = tokens.length - 1; i >= Math.max(0, tokens.length - 2); i--) {
    const token = tokens[i].replace(/^[("“„'‘]+|[)"”'’,;:]+$/gu, '');
    if (MODIFIER_STOP[lang].test(token)) return false;
    if (/['’]s$/u.test(tokens[i])) return true;
    if (i > 0 && /^\p{Lu}/u.test(token)) return true;
  }
  return false;
}
const PL_ANCHOR_BEFORE_FOLDED = new RegExp(foldPl(PL_ANCHOR_BEFORE.source), PL_ANCHOR_BEFORE.flags);
const ANCHOR_AFTER: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^\s+(?:in|of|on|around|at|over|between)\s+(?:the\s+)?\p{Lu}/u,
  pl: /^\s+(?:w|we|na|wokół|między|nad)\s+\p{Lu}/u,
};

const PL_ANCHOR_AFTER_FOLDED = new RegExp(foldPl(ANCHOR_AFTER.pl.source), ANCHOR_AFTER.pl.flags);

/**
 * Does the text name a PARTICULAR instance of a phenomenon (a state or a public event)? A named
 * place, a determiner / time adjective / proper modifier before it, a proper noun after it, or a
 * present-state question form. Generic and indefinite uses are subject matter, not currentness.
 */
export function particularPhenomenon(
  originalText: string,
  language: string,
  nouns: RegExp,
  namedPlace = false,
  /* CTO R4 fourth pass — so a completed dated event is read as history */
  requestYear?: number,
): boolean {
  const lang: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';
  /* Polish is matched diacritic-folded (positions stay aligned with the original) */
  const text = lang === 'pl' ? foldPl(originalText) : originalText;
  const global = new RegExp(
    lang === 'pl' ? foldPl(nouns.source) : nouns.source,
    nouns.flags.includes('g') ? nouns.flags : `${nouns.flags}g`,
  );
  const anchorBefore = lang === 'pl' ? PL_ANCHOR_BEFORE_FOLDED : EN_ANCHOR_BEFORE;
  const anchorAfter = lang === 'pl' ? PL_ANCHOR_AFTER_FOLDED : ANCHOR_AFTER.en;
  let any = false;
  for (const m of text.matchAll(global)) {
    any = true;
    const lead = m[0].length - m[0].trimStart().length;
    const start = (m.index ?? 0) + lead;
    /* CTO R4 fourth pass — a DATED, COMPLETED instance ("the 1997 Asian financial crisis") is
       history: its temporal anchor outranks the particular-event rule */
    if (temporallyPastOnly(clauseAround(originalText, start), lang, requestYear)) continue;
    const before = text.slice(Math.max(0, start - 80), start);
    const after = text.slice(start + m[0].trimStart().length, start + m[0].length + 60);
    if (anchorBefore.test(before)) return true;
    if (properModifierBefore(text.slice(0, start), lang)) return true;
    if (anchorAfter.test(after)) return true;
  }
  return any && namedPlace && !temporallyPastOnly(originalText, lang, requestYear);
}

/** The clause around a position (between clause punctuation / a coordinating "and"). */
function clauseAround(text: string, at: number): string {
  const head = text.slice(0, at);
  const from =
    Math.max(
      head.lastIndexOf('.'),
      head.lastIndexOf('?'),
      head.lastIndexOf('!'),
      head.lastIndexOf(';'),
      head.lastIndexOf(', and'),
      head.lastIndexOf(', a '),
    ) + 1;
  const tail = text.slice(at);
  const stop = tail.search(/[.?!;]|,\s+(?:and|but|while|a|i)\s/u);
  return text.slice(from, stop < 0 ? text.length : at + stop);
}

/* "…what happened there since?" — an adverbial "since" runs to the present (a window, not a year) */
const SINCE_PRESENT: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:ever\s+)?since(?:\s+then|\s+that\s+time)?\s*[?.!]?\s*$/i,
  pl: plTolerant(/(?:od\s+(?:tamtej|tej)\s+pory|od\s+(?:tamtego|tego)\s+czasu)\s*[?.!]?\s*$/iu),
};

/** State nouns count as freshness only for a particular instance (see STATE_NOUN). */
function anchoredState(
  text: string,
  lang: 'en' | 'pl',
  place: boolean,
  requestYear?: number,
): boolean {
  return particularPhenomenon(text, lang, STATE_NOUN[lang], place, requestYear);
}

/**
 * A changing quantity asked in the progressive is news ("Why is the dollar falling?", "How is
 * trade developing?"). The auxiliary is REQUIRED in English: "Why does increasing a pipe's
 * diameter …" is a gerund, not a trend.
 */
const CHANGING: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:is|are|was|were|has\s+been|have\s+been|keeps?)\b[^.?!]{0,40}?\b(?:rising|falling|increasing|decreasing|surging|soaring|dropping|plunging|climbing|slumping|happening|going\s+on|changing|collapsing|escalating|developing|evolving|growing|shrinking|progressing|worsening|improving)\b/i,
  pl: plTolerant(
    /(?:ro[śs]nie|rosn[ąa]|spada(?:j[ąa])?|rozwija(?:j[ąa])?\s+si[ęe]|zmienia(?:j[ąa])?\s+si[ęe]|pogarsza\s+si[ęe]|poprawia\s+si[ęe]|dzieje\s+si[ęe])/iu,
  ),
};

/** R3 — something asked about as in progress ("What is driving…", "Why are … rising") is current. */
const IN_PROGRESS: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:is|are|was|were|has\s+been|have\s+been)\s+(?:[\p{L}']+\s+){0,2}[\p{L}]+ing\b(?<!\bthing)(?<!\bbeing)/iu,
  /* Polish has no progressive form; its changing verbs are already read by CHANGING */
  pl: /(?!)/u,
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
  pl: plTolerant(
    /^(?:kiedy\s+(?:\p{L}+\s+)?(?:by[łl]\p{L}*|wst[ąa]pi\p{L}*|uzyska\p{L}*)|kto\s+(?:by[łl]\p{L}*|za[łl]o[żz]y[łl]\p{L}*)|co\s+spowodowa[łl]\p{L}*|dlaczego\s+dosz[łl]o)|(?:histori\p{L}*|niepodleg[łl]o[śs]\p{L}*|kolonial\p{L}*|staro[żz]ytn\p{L}*)/iu,
  ),
};
export const TRAVEL_FRAME: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:visit(?:ing)?|travel(?:l?ing)?\s+(?:to|in|around)|trip\s+to|holiday\s+in|vacation\s+in|safari|itinerary|pack\s+for|before\s+(?:going|travelling|traveling|my\s+trip)|tourist(?:s)?\s+(?:attractions|sites)|things\s+to\s+(?:do|see)|on\s+(?:a|my|our)\s+(?:[\w-]+\s+){0,2}(?:trip|holiday|vacation|honeymoon))\b/i,
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

/** A request for background / context: the stable half of a MIXED question. */
const BACKGROUND_REQUEST: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /^(?:(?:please\s+)?(?:give|tell|show)\s+me|provide|share)\s+(?:some\s+|the\s+|a\s+|an\s+)?(?:brief\s+|short\s+|quick\s+)?(?:background|context|overview|history|primer|explanation)\b|^(?:background|context)\s+(?:on|of|to)\b/i,
  pl: plTolerant(
    /^(?:przedstaw|podaj|daj|opowiedz)\s+(?:mi\s+)?(?:kr[óo]tko\s+)?(?:t[łl]o|kontekst|zarys|histori\p{L}*)|^(?:t[łl]o|kontekst)\b/iu,
  ),
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
  const historicalIdentity = HISTORICAL_IDENTITY[lang].test(text);
  const place =
    namedPlace ||
    resolvePrimaryCountry({ title: text, summary: '' }) !== undefined ||
    resolveCountriesByDemonym(text).length > 0;
  /* CTO R4 CLOSEOUT — a state noun is freshness only for a particular instance (STATE_NOUN) */
  const fresh =
    assertsFreshness(freshText) ||
    FRESHNESS[lang].test(freshText) ||
    CHANGING[lang].test(freshText) ||
    SINCE_PRESENT[lang].test(freshText) ||
    anchoredState(freshText, lang, place, requestYear) ||
    temporallyCurrent(freshText, lang, requestYear) ||
    NEWS_REQUEST[lang].test(freshText) ||
    refersToCurrentYear(freshText, lang, requestYear);
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
    CONVERSATIONAL INTELLIGENCE JOURNEY R3 §5 (blind evaluation) — a STABLE EXPLANATORY question
    about a named place ("Why is Chile's economy so dependent on copper?", "Explain how remittances
    shape the Philippine economy", "Dlaczego Norwegia ma tak duży fundusz?") asks how the place
    works, not what happened: place background. Never when it asserts freshness, names a public
    event (war, protests, an election, a crisis…), or asks about something in progress ("Why are
    prices rising in Kenya?") — those stay current reporting.
  */
  if (
    place &&
    !fresh &&
    explanatory &&
    !(lang === 'pl' ? PL_PUBLIC_EVENT : EN_PUBLIC_EVENT).test(text) &&
    !IN_PROGRESS[lang].test(text) &&
    readAdvisory(text, lang, requestYear) === null
  ) {
    return {
      requirement: 'PLACE_REFERENCE',
      reason: 'a stable explanation of a named place',
      frame: 'EXPLANATION',
    };
  }
  /* R3 §12 — a non-political choice weighed against an objective. Read before the general
     advisory cue (it is the more specific form) and before the news-oriented freshness rules. */
  /* CTO R4 fifth pass — evaluating COMPONENTS of earlier work ("which argument is strongest") is
     not a choice between options: it never asks "best for what?" */
  const decision =
    readEvaluationKind(text, lang) === 'ARTIFACT_COMPONENT_EVALUATION'
      ? null
      : readDecisionSupport(text, lang);
  if (decision !== null) {
    return {
      requirement: 'DECISION_SUPPORT',
      reason:
        decision.objective === null
          ? 'a decision with no stated objective'
          : "a decision weighed against the reader's objective",
      objective: decision.objective,
      currentClauses: decision.currentClauses,
    };
  }
  /*
    CTO P0 — advice / decision support. Read BEFORE the news-oriented freshness rules below: their
    topic nouns ("news", "situation", "status") are not time, and an advisory question about a
    "news intelligence product" is not a request for news. Genuine freshness (an explicit time
    marker) still outranks advice: it makes the question MIXED, and the timed part is named.
  */
  const advisory = readAdvisory(text, lang, requestYear);
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
  /*
    R3 §6 / CTO R4 CLOSEOUT §7 — MIXED is read per CLAUSE: a stable request ("What is a debt
    ceiling", "Explain why currency pegs can be fragile", "Give me the background on…") joined to
    a current one ("…and what happened to X this week?") keeps BOTH halves, so a failed current
    retrieval never erases the stable answer. The current clauses are named on a partial answer.
  */
  const clauseFresh = (c: string): boolean =>
    assertsFreshness(c) ||
    FRESHNESS[lang].test(c) ||
    CHANGING[lang].test(c) ||
    CHANGED[lang].test(c) ||
    anchoredState(c, lang, false, requestYear) ||
    temporallyCurrent(c, lang, requestYear) ||
    NEWS_REQUEST[lang].test(c) ||
    refersToCurrentYear(c, lang, requestYear);
  /* CTO R4 fifth pass — CLAUSE INTENT (clause-intent.ts): each clause is read on its own and
     MIXED emerges from the set; a statement of conceptual context counts as a stable clause */
  const intents = readClauseIntents(text, lang, {
    current: clauseFresh,
    historical: (c) => temporallyPastOnly(c, lang, requestYear),
    stableShape: (c) =>
      STABLE_SHAPES[lang].some((shape) => shape.test(c)) || BACKGROUND_REQUEST[lang].test(c),
  });
  const timed = intents.filter((c) => c.intent === 'CURRENT').map((c) => c.text);
  const historicalAndCurrent =
    readTemporalSemantics(text, lang, requestYear).currentness === 'HISTORICAL_AND_CURRENT';
  if ((explanatory && fresh) || mixedFromIntents(intents) || historicalAndCurrent) {
    return {
      requirement: 'MIXED_REFERENCE_CURRENT',
      reason: 'a stable part plus a current part',
      currentClauses: timed.length > 0 ? timed : [text],
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

/**
 * CTO R4 — GENUINE freshness: an explicit time marker, a changing quantity asked in the progressive,
 * or the governed freshness reading. Topic nouns ("crisis", "news", "situation") are SUBJECT, not
 * time — the job classifier keeps job and freshness on separate axes.
 */
export function genuineFreshness(text: string, language: string, requestYear?: number): boolean {
  const lang: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';
  const travel = TRAVEL_FRAME[lang].test(text);
  const freshText = travel ? withoutFuturePeriods(text, lang, requestYear) : text;
  /* CTO R4 fifth pass — a COMPLETED historical anchor outranks the specific-event reading: "the
     result" of the 2000 election is history, not "the latest result" */
  const pastOnly = temporallyPastOnly(freshText, lang, requestYear);
  return (
    hasExplicitTime(freshText, lang, requestYear) ||
    temporallyCurrent(freshText, lang, requestYear) ||
    NEWS_REQUEST[lang].test(freshText) ||
    CHANGING[lang].test(freshText) ||
    assertsFreshness(freshText) ||
    (!pastOnly && SPECIFIC_EVENT[lang].test(freshText)) ||
    CHANGED[lang].test(freshText)
  );
}

/*
  R4 — "What has changed in Kenya's economy?" asks what changed recently: a change question is
  current evidence even with no time marker, so it never falls to the reasoning fallback.
*/
const CHANGED: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\b(?:has|have|had)\s+(?:[\p{L}'’-]+\s+){0,4}?changed\b|\bwhat(?:'s|’s|\s+is)\s+new\b/iu,
  pl: plTolerant(/(?:zmienił\p{L}*|zmieniło)\s+si[ęe]|co\s+(?:si[ęe]\s+)?zmieniło|co\s+nowego/iu),
};

/*
  A DEFINITE reference to a specific recent thing ("the new AI model", "the Fed decision", "the outcome of
  the election", "co nowego") asks about a particular event, not a concept: genuine freshness.
*/
const SPECIFIC_EVENT: Readonly<Record<'en' | 'pl', RegExp>> = {
  en: /\bthe\s+(?:new|newest|latest|recent|upcoming)\s+[\p{L}-]+|\bthe\s+(?:[\p{L}-]+\s+){0,2}(?:decision|outcome|result|results|verdict|announcement|deal|vote|ruling|statement|speech|summit|talks|figures)\b|\b(?:outcome|result|results)\s+of\s+the\b/iu,
  pl: /(?:^|\s)(?:co\s+nowego|nowości|najnowsz\p{L}*|now\p{L}*\s+(?:model|ustaw|decyzj|przepis)\p{L}*)/iu,
};
