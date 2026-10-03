import { yearRoles } from './advisory-requirement';
import { readEvaluationKind } from './decision-objective';
import { plTolerant, PlTolerantRegExp } from './pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 — THE GOVERNED USER-JOB CLASSIFIER (deterministic layer)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha c7e8c03, frozen corpus (ops 01dff63f, b7ade95f, 8abfdd63, 81c69b30): "indicate how a
 * prime moment of someone can lead him to losing whatever he had in life" → CURRENT_REPORTING →
 * a news search → INSUFFICIENT; "Apply that idea to GlobalNewsAI", "Which part is weakest?" → the
 * same; "Turn that into a 90-day plan." → "noted" as a 90-day constraint. The engine assumed
 * `unrecognised form → news`. That default is gone.
 *
 * Two questions, never collapsed:
 *   JOB        what intellectual work does the reader want done?
 *   FRESHNESS  does that work need current evidence?
 *
 * This deterministic layer answers when a FORM is unambiguous (a request for depth, a causal
 * concept question, an imperative work request, a reference to work already done in this
 * conversation, a plan horizon). Everything it cannot establish is UNRESOLVED — resolved later by
 * the bounded semantic classifier (job-classifier.ts) at execution, behind every control. UNRESOLVED
 * never means news. Output is language-independent: English and Polish forms map to one schema.
 * Pure: no I/O, no model, no provider. It classifies; it never answers and never claims a fact.
 */

export const USER_JOBS = [
  'EXPLANATION',
  'DEEP_CONCEPTUAL_ANALYSIS',
  'ADVISORY',
  'DECISION_SUPPORT',
  'PLANNING',
  'TRANSFORMATION',
  'COMPARISON',
  'PLACE_BACKGROUND',
  'CURRENT_REPORTING',
  'OFFICIAL_CURRENT_REFERENCE',
  'CHANGE_ANALYSIS',
  'RELATIONSHIP_ANALYSIS',
  'COMPUTATION',
  'WRITING',
  'MIXED',
] as const;
export type UserJob = (typeof USER_JOBS)[number];

export type Freshness = 'NONE' | 'CURRENT' | 'PARTIAL';
export type EvidenceRequirement = 'NONE' | 'CURRENT_REPORTING' | 'OFFICIAL' | 'DETERMINISTIC';
export type Depth = 'STANDARD' | 'DEEP';
export const TRANSFORMATIONS = [
  'PLAN',
  'TABLE',
  'CHECKLIST',
  'SUMMARY',
  'SCENARIOS',
  'COMPARISON',
  'EXPLAIN_MORE',
  'FIRST_STEP',
  /* CTO R4 closeout — a briefing / memo, and concrete action steps */
  'BRIEFING',
  'ACTION_STEPS',
] as const;
export type TransformationKind = (typeof TRANSFORMATIONS)[number];
export type DiscourseReference = 'NONE' | 'PRIOR_WORK';
export type TemporalRole =
  | 'REPORTING_WINDOW'
  | 'HISTORICAL_PERIOD'
  | 'TRIP_DURATION'
  | 'PLAN_HORIZON'
  | 'DEADLINE'
  | 'FUTURE_HORIZON';

export interface TemporalReading {
  readonly role: TemporalRole;
  /** The reader's own words for the period ("90-day", "last week"). */
  readonly text: string;
  /** A day count when the words state one (90-day → 90; six-month → 180). */
  readonly days?: number;
}

export interface JobReading {
  readonly job: UserJob | null;
  readonly freshness: Freshness;
  readonly evidence: EvidenceRequirement;
  readonly depth: Depth;
  readonly transformation: TransformationKind | null;
  readonly discourseReference: DiscourseReference;
  readonly temporal: readonly TemporalReading[];
  /** DETERMINISTIC (a governed form), SEMANTIC (the bounded classifier), FALLBACK (classifier
   *  unavailable → stable reasoning), UNRESOLVED (no governed form; decided at execution). */
  readonly source: 'DETERMINISTIC' | 'SEMANTIC' | 'FALLBACK' | 'UNRESOLVED';
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly reason: string;
  /** FORM: an R4 governed form decided it (depth, causal concept, work request, prior work).
   *  KNOWLEDGE: the router's existing knowledge requirement, mapped. NONE: nothing governed. */
  readonly basis: 'FORM' | 'KNOWLEDGE' | 'NONE';
  /** CTO R4 closeout — a causal / mechanism question (cause → mechanism → amplification →
   *  boundary conditions → counterexample → implications). Absent otherwise. */
  readonly analysis?: 'CAUSAL';
  /**
   * CTO R4 third pass §13 — the POSITIVE currentness evidence the route found (codes:
   * EXPLICIT_TIME_OR_CHANGE, STATED_CURRENT_PERIOD, REPORTING_WINDOW, PARTICULAR_EVENT,
   * GOVERNED_CURRENT_FORM, RELATIONSHIP_PRESENT_STATE, INHERITED_SURFACE_SCOPE,
   * PRIOR_CURRENT_SUBJECT, ARTICLE_ANCHOR, HEADLINES_REQUEST). Empty → the turn may not enter
   * current reporting deterministically: the bounded classifier decides.
   */
  readonly currentnessEvidence?: readonly string[];
}

/** Jobs answered by reasoning (the background provider) when no current evidence is needed. */
export const REASONING_JOBS: ReadonlySet<UserJob> = new Set([
  'EXPLANATION',
  'DEEP_CONCEPTUAL_ANALYSIS',
  'ADVISORY',
  'DECISION_SUPPORT',
  'PLANNING',
  'TRANSFORMATION',
  'WRITING',
  'COMPARISON',
]);

/* ── numbers the reader writes in words ─────────────────────────────────────────────────── */
const WORD_NUMBERS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  sixty: 60,
  ninety: 90,
  hundred: 100,
  jeden: 1,
  dwa: 2,
  trzy: 3,
  cztery: 4,
  pięć: 5,
  sześć: 6,
  siedem: 7,
  osiem: 8,
  dziewięć: 9,
  dziesięć: 10,
  dwanaście: 12,
  trzydzieści: 30,
  sześćdziesiąt: 60,
  dziewięćdziesiąt: 90,
};
const UNIT_DAYS: Readonly<Record<string, number>> = {
  day: 1,
  days: 1,
  week: 7,
  weeks: 7,
  month: 30,
  months: 30,
  year: 365,
  years: 365,
  dzień: 1,
  dni: 1,
  dniowy: 1,
  dniowego: 1,
  dniowym: 1,
  tydzień: 7,
  tygodni: 7,
  tygodniowy: 7,
  miesiąc: 30,
  miesięcy: 30,
  miesięczny: 30,
  miesiące: 30,
  rok: 365,
  lat: 365,
  lata: 365,
  roczny: 365,
};
const num = (raw: string): number | undefined =>
  /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw.toLowerCase()];

/* ── TEMPORAL ROLES: time is not one thing ──────────────────────────────────────────────── */
const PLAN_NOUN_EN =
  '(?:plan|plans|roadmap|programme|program|sprint|strategy|timeline|schedule|action\\s+plan|implementation\\s+programme|implementation\\s+program|rollout)';
const EN_PLAN_HORIZON: readonly RegExp[] = [
  new RegExp(
    `\\b(\\d{1,3}|[a-z]+)[-\\s](day|week|month|year)s?\\s+(?:[a-z-]+\\s+){0,2}?${PLAN_NOUN_EN}\\b`,
    'i',
  ),
  new RegExp(
    `\\b${PLAN_NOUN_EN}\\s+(?:for|over|covering)\\s+(?:the\\s+)?(?:next\\s+|first\\s+)?(\\d{1,3}|[a-z]+)\\s+(days|weeks|months|years)\\b`,
    'i',
  ),
];
const PL_PLAN_HORIZON: readonly RegExp[] = [
  /(?:plan\p{L}*|harmonogram\p{L}*|program\p{L}*|map\p{L}*\s+drogow\p{L}*)\s+na\s+(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy|miesiące|lat|lata|rok)/iu,
  /(\d{1,3}|\p{L}+)[-\s]?(dniowy|dniowego|dniowym|tygodniowy|miesięczny)\s+(?:plan\p{L}*|harmonogram\p{L}*|program\p{L}*)/iu,
];
const EN_TRIP = /\b(?:trip|holiday|vacation|visit|itinerary|safari|stay|travel(?:ling|ing)?)\b/i;
const PL_TRIP = plTolerant(
  /(?:podróż\p{L}*|wycieczk\p{L}*|wakacj\p{L}*|pobyt\p{L}*|zwiedz\p{L}*|safari)/iu,
);
const EN_DURATION = /\b(\d{1,3}|[a-z]+)[-\s](day|days|night|nights|week|weeks)\b/i;
const PL_DURATION = plTolerant(
  /(?:^|\s)(\d{1,3}|\p{L}+)\s+(dni|dzień|tygodni|tydzień)(?=$|[\s,.?!])/iu,
);
const EN_REPORTING =
  /\b(?:last|past|previous|recent)\s+(\d{1,3}|[a-z]+)\s+(days|weeks|months)\b|\b(\d{1,3}|[a-z]+)\s+(days|weeks|months)\s+ago\b|\b(?:yesterday|today|this\s+(?:week|month|quarter|year)|last\s+(?:week|month|quarter|year))\b|\b(?:the\s+)?(?:past|last|previous)\s+(?:few\s+|couple\s+(?:of\s+)?)?(?:days|weeks|months|week|month|fortnight)\b/i;
const PL_REPORTING = plTolerant(
  /(?:ostatni\p{L}*|minion\p{L}*)\s+(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy)|(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy)\s+temu|(?:^|\s)(?:wczoraj|dziś|dzisiaj|w\s+tym\s+(?:tygodniu|miesiącu|roku))(?=$|[\s,.?!])|w\s+(?:ostatni\p{L}*|zeszł\p{L}*|minion\p{L}*)\s+(?:tygodni\p{L}*|miesiąc\p{L}*|miesiącu|dniach)|(?:ostatni|zeszły|miniony)\s+(?:tydzień|miesiąc)/iu,
);
const EN_DEADLINE =
  /\b(?:by|before|within)\s+(?:the\s+end\s+of\s+)?(\d{1,3}\s+(?:days|weeks|months)|(?:next\s+)?(?:week|month|quarter|year)|q[1-4]|\d{4})\b/i;
const EN_FUTURE =
  /\b(?:next|coming|upcoming)\s+(?:week|month|quarter|year|summer|winter|spring|autumn|fall)\b|\bin\s+(\d{1,3}|[a-z]+)\s+(days|weeks|months|years)(?:'?\s*time)?\b/i;
const PL_FUTURE = plTolerant(
  /(?:przyszł\p{L}*|następn\p{L}*|nadchodząc\p{L}*)\s+(?:rok\p{L}*|roku|miesiąc\p{L}*|tydzień|tygodni\p{L}*|lat\p{L}*)|za\s+(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy|lat)/iu,
);
const EN_HISTORICAL = /\b(?:in|during|since)\s+(?:the\s+)?(1[5-9]\d{2}|20[0-2]\d)s?\b/i;

export function readTemporalRoles(
  question: string,
  lang: 'en' | 'pl',
  requestYear?: number,
): TemporalReading[] {
  const out: TemporalReading[] = [];
  const text = question.trim();
  for (const re of lang === 'pl' ? PL_PLAN_HORIZON : EN_PLAN_HORIZON) {
    const m = re.exec(text);
    if (m) {
      const n = num(m[1]);
      const unit = UNIT_DAYS[(m[2] ?? '').toLowerCase()];
      out.push({
        role: 'PLAN_HORIZON',
        text: m[0],
        ...(n !== undefined && unit !== undefined ? { days: n * unit } : {}),
      });
      return out; /* a plan's horizon is the time this request is about */
    }
  }
  const reporting = (lang === 'pl' ? PL_REPORTING : EN_REPORTING).exec(text);
  if (reporting) out.push({ role: 'REPORTING_WINDOW', text: reporting[0] });
  const trip = (lang === 'pl' ? PL_TRIP : EN_TRIP).test(text);
  const duration = (lang === 'pl' ? PL_DURATION : EN_DURATION).exec(text);
  if (duration && trip && reporting === null) {
    const n = num(duration[1]);
    const unit = UNIT_DAYS[duration[2].toLowerCase().replace(/^nights?$/, 'days')] ?? 1;
    out.push({
      role: 'TRIP_DURATION',
      text: duration[0],
      ...(n !== undefined ? { days: n * unit } : {}),
    });
  }
  if (lang === 'en') {
    const deadline = EN_DEADLINE.exec(text);
    if (deadline) out.push({ role: 'DEADLINE', text: deadline[0] });
  }
  /* CTO R4 THIRD PASS — a stated year is a TIME ROLE (advisory-requirement.ts yearRoles): a
     completed past year is HISTORICAL (evidence AGAINST current reporting); "since 2008" and the
     request year reach the present (a reporting window); a later year is a future horizon. With
     no request instant the route reads no clock, so only the legacy English form is read. */
  if (requestYear !== undefined) {
    const years = yearRoles(text, lang, requestYear);
    if (years.historical.length > 0)
      out.push({ role: 'HISTORICAL_PERIOD', text: years.historical.join(', ') });
    if (years.current && !out.some((t) => t.role === 'REPORTING_WINDOW'))
      out.push({ role: 'REPORTING_WINDOW', text: 'a stated period reaching the present' });
    if (years.future.length > 0)
      out.push({ role: 'FUTURE_HORIZON', text: years.future.join(', ') });
  } else if (lang === 'en') {
    const historical = EN_HISTORICAL.exec(text);
    if (historical) out.push({ role: 'HISTORICAL_PERIOD', text: historical[0] });
  }
  const future = (lang === 'pl' ? PL_FUTURE : EN_FUTURE).exec(text);
  if (future && !out.some((t) => t.role === 'DEADLINE'))
    out.push({ role: 'FUTURE_HORIZON', text: future[0] });
  return out;
}

/* ── WORK REQUESTS: commands are requests without a question mark ─────────────────────────── */
/*
  CTO R4 CLOSEOUT — a work request is read as two FAMILIES, never as a list of sentences:
    an IMPERATIVE OPENER (make / turn / put / lay out / convert / draft / break … — PL zrób /
    ujmij / przerób / przekształć / rozpisz …, including "can you …" / "czy możesz …"), and
    a TARGET FORM (table, checklist, plan, summary, briefing, comparison, scenarios, action
    steps). The first target family found decides the kind (the more specific forms first).
  A few verbs imply their own kind (summarise → SUMMARY; compare / rank those → COMPARISON).
*/
const EN_WORK_OPENER =
  /^\s*(?:(?:ok(?:ay)?|now|great|good|fine|thanks|right|perfect)[,.!]?\s+)*(?:please\s+|now\s+|then\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|i\s+(?:want|need|['’]d\s+like)\s+(?:you\s+to\s+)?|let['’]?s\s+)*(?:turn|convert|make|put|lay(?:\s+out)?|set\s+out|spell\s+out|write(?:\s+up)?|give\s+me|draft|create|build|format|present|rewrite|reformat|recast|re-?frame|organi[sz]e|structure|break|list|outline|sketch|map\s+out|draw\s+up|produce|prepare|show(?:\s+me)?|summari[sz]e|sum\s+up|condense|shorten|recap|boil|distil+|compare|rank|translate|reduce|transform|package|capture)\b/i;
const PL_WORK_OPENER = plTolerant(
  /^\s*(?:(?:ok|dobrze|dobra|świetnie|super|dzięki|dziękuję|teraz)[,.!]?\s+)*(?:proszę\s+|teraz\s+|to\s+|czy\s+(?:możesz|mógłbyś|mogłabyś|mógłbyś\s+mi|możesz\s+mi)\s+|chcę\s+|chciał\p{L}*\s+(?:bym|abym)\s+)*(?:zrób|zróbmy|zrobić|przekształć|przekształcić|zamień|zamienić|ujmij|ująć|przerób|przerobić|przedstaw|przedstawić|pokaż|pokazać|rozpisz|rozpisać|przygotuj|przygotować|stwórz|stworzyć|ułóż|ułożyć|napisz|napisać|zaplanuj|zaplanować|podsumuj|podsumować|streść|streścić|skróć|skrócić|wypisz|wypisać|wymień|zestaw|zestawić|porównaj|porównać|nakreśl|sformułuj|zbierz|rozbij|rozbić|uporządkuj|opracuj|opracować|podaj|daj|przetłumacz|uszereguj|zamknij)(?![\p{L}\d])/iu,
);
/* target families, most specific first */
const EN_TARGETS: ReadonlyArray<readonly [TransformationKind, RegExp]> = [
  ['TABLE', /\b(?:table|matrix|grid|spreadsheet)\b/i],
  ['CHECKLIST', /\b(?:check-?\s?lists?|to-?do\s+lists?|tick-?lists?)\b/i],
  ['SCENARIOS', /\b(?:scenarios?|best[-\s]case|worst[-\s]case|base[-\s]case)\b/i],
  [
    'BRIEFING',
    /\b(?:briefing|brief|memo|one-?pager|executive\s+summary|board\s+note|note\s+for)\b/i,
  ],
  ['PLAN', /\b(?:plan|plans|roadmap|programme|program|timeline|schedule|sprint)\b/i],
  ['ACTION_STEPS', /\b(?:steps|action\s+items|actions|to-?dos|next\s+moves)\b/i],
  [
    'SUMMARY',
    /\b(?:summary|recap|tl;?dr|bullets?|bullet[-\s]points|key\s+points|nutshell|short\s+version|sentences?|paragraph)\b/i,
  ],
  ['COMPARISON', /\b(?:comparison|side[-\s]by[-\s]side|versus|vs\.?)\b/i],
];
const PL_TARGETS: ReadonlyArray<readonly [TransformationKind, RegExp]> = [
  ['TABLE', plTolerant(/(?:tabel\p{L}*|zestawieni\p{L}*|macierz\p{L}*|arkusz\p{L}*)/iu)],
  [
    'CHECKLIST',
    /(?:list\p{L}*\s+kontroln\p{L}*|checklist\p{L}*|list\p{L}*\s+(?:zadań|rzeczy\s+do\s+zrobienia))/iu,
  ],
  ['SCENARIOS', plTolerant(/(?:scenariusz\p{L}*|najlepsz\p{L}*\s+(?:i|oraz)\s+najgorsz\p{L}*)/iu)],
  [
    'BRIEFING',
    /(?:briefing\p{L}*|notatk\p{L}*|memo|brief(?![\p{L}])|informacj\p{L}*\s+dla\s+zarządu)/iu,
  ],
  [
    'PLAN',
    plTolerant(
      /(?:(?<![\p{L}])plan\p{L}*|harmonogram\p{L}*|map\p{L}*\s+drogow\p{L}*|program\p{L}*)/iu,
    ),
  ],
  [
    'ACTION_STEPS',
    plTolerant(/(?:krok\p{L}*|działa\p{L}*\s+do\s+podjęcia|zadani\p{L}*\s+do\s+wykonania)/iu),
  ],
  [
    'SUMMARY',
    /(?:podsumowani\p{L}*|streszczeni\p{L}*|punkt\p{L}*|skrót\p{L}*|(?:kilku|paru|jednym|dwóch|trzech)\s+zdani\p{L}*)/iu,
  ],
  ['COMPARISON', plTolerant(/(?:porównani\p{L}*)/iu)],
];
/* verbs that carry their own kind when no target family is named */
const EN_SELF_KIND: ReadonlyArray<readonly [TransformationKind, RegExp]> = [
  [
    'SUMMARY',
    /^\s*(?:(?:ok(?:ay)?|now|great|thanks)[,.!]?\s+)*(?:please\s+|can\s+you\s+|could\s+you\s+)*(?:summari[sz]e|sum\s+up|condense|shorten|recap|boil\s+(?:it|that|this)\s+down|distil+|give\s+me\s+(?:a\s+)?(?:summary|recap|tl;?dr))\b/i,
  ],
  [
    'COMPARISON',
    /^\s*(?:please\s+)?(?:compare|rank)\s+(?:those|these|them|the\s+two|both|that|this|the\s+options)\b/i,
  ],
  [
    'EXPLAIN_MORE',
    /^\s*(?:please\s+)?(?:explain|elaborate|expand|go\s+deeper|dig\s+deeper|unpack)\b.{0,30}?\b(?:that|this|it|more|further|deeper|on\s+that)\b/i,
  ],
  [
    'FIRST_STEP',
    /^\s*what\s+(?:should|do|must)\s+(?:i|we)\s+do\s+first\b|^\s*where\s+(?:should|do)\s+(?:i|we)\s+start\b/i,
  ],
];
const PL_SELF_KIND: ReadonlyArray<readonly [TransformationKind, RegExp]> = [
  [
    'SUMMARY',
    /^\s*(?:proszę\s+|czy\s+możesz\s+)?(?:podsumuj|podsumować|streść|streścić|skróć|skrócić)(?![\p{L}\d])/iu,
  ],
  [
    'COMPARISON',
    /^\s*(?:proszę\s+)?(?:porównaj|uszereguj)\s+(?:te|je|oba|obie|to|tamte|opcje)(?![\p{L}\d])/iu,
  ],
  [
    'EXPLAIN_MORE',
    /^\s*(?:proszę\s+)?(?:wyjaśnij|rozwiń|pogłęb)(?![\p{L}\d]).{0,30}?(?:to|bardziej|głębiej|szerzej)(?![\p{L}\d])/iu,
  ],
  ['PLAN', plTolerant(/^\s*(?:proszę\s+)?zaplanuj(?![\p{L}\d])/iu)],
  [
    'FIRST_STEP',
    /^\s*(?:co|od\s+czego)\s+(?:powinniśmy|powinienem|powinnam|mamy)\s+(?:zrobić|zacząć)\s+(?:najpierw|na\s+początku)/iu,
  ],
];

/* ── REFERENCES TO WORK ALREADY DONE IN THIS CONVERSATION ───────────────────────────────────── */
const EN_REFERENCE =
  /\b(?:that|this|these|those|the\s+same)\s+(?:idea|ideas|framework|frameworks|concept|model|analysis|diagnosis|plan|conclusion|conclusions|recommendation|recommendations|advice|answer|point|points|list|comparison|approach|argument|arguments|definition|reason|reasons|assumption|assumptions|criticism|criticisms|critique|criteria|criterion|steps|step|options|option|factors|factor|risks|risk|claims|claim|scenarios|scenario|signals|levers|principles|pillars|dimensions|lessons|trade-?offs|pros|cons|asymmetry|dynamic|mechanism|logic|reasoning|explanation|summary|checklist|table|strategy|model)\b|\b(?:which|what)\s+of\s+(?:those|these|them|the\s+(?:above|ones|options|arguments|reasons|factors|steps|points))\b|\bthe\s+(?:weakest|strongest|biggest|riskiest|most\s+(?:important|fragile|critical|questionable|robust)|least\s+(?:robust|convincing|important)|best|worst|first|last|main|key)\s+(?:part|assumption|argument|point|factor|risk|reason|step|option|element|dimension|one|link|lever|pillar|claim|criterion)\b|\b(?:which|what)\s+(?:part|component|dimension|element|factor|pillar|piece|one|assumption|argument|reason|risk|step|option|claim|criterion|lever|link|point)s?\b|\b(?:apply|use|test)\s+(?:that|this|it)\b|^\s*(?:why|how\s+so|in\s+what\s+way)\s*\??\s*$|\b(?:about|on|with|into|of)\s+(?:it|that|this|them)\s*[?.!]?\s*$|^\s*(?:turn|convert|make|put|summari[sz]e|compare|explain|expand|elaborate)\s+(?:that|this|it|them|those|these)\b/i;
const PL_REFERENCE = plTolerant(
  /(?:t[ęa]|to|ten|tę|tego|tej|tym|te|tych|tymi)\s+(?:ide\p{L}*|ram\p{L}*|koncepcj\p{L}*|model\p{L}*|analiz\p{L}*|diagnoz\p{L}*|plan\p{L}*|wnios\p{L}*|rekomendacj\p{L}*|rad\p{L}*|odpowied\p{L}*|list\p{L}*|porównani\p{L}*|argument\p{L}*|powod\p{L}*|powód|założeni\p{L}*|krytyk\p{L}*|kryteri\p{L}*|krok\p{L}*|opcj\p{L}*|czynnik\p{L}*|ryzyk\p{L}*|scenariusz\p{L}*|sygnał\p{L}*|zasad\p{L}*|lekcj\p{L}*|mechanizm\p{L}*|strategi\p{L}*|źród\p{L}*|rzecz\p{L}*|punkt\p{L}*)|(?:któr\p{L}*|co)\s+z\s+(?:nich|tych|tego|tej|powyższ\p{L}*)|najsłabsz\p{L}*\s+(?:część|element|ogniwo|punkt|założeni\p{L}*|argument\p{L}*|stron\p{L}*)|(?:któr\p{L}*|jak\p{L}*)\s+(?:część|element|składnik|wymiar|czynnik|filar|założeni\p{L}*|argument\p{L}*|ryzyk\p{L}*|krok\p{L}*|punkt\p{L}*|opcj\p{L}*)|(?:zastosuj|użyj|sprawdź)\s+(?:to|tę|ten|je)|^\s*(?:dlaczego|czemu)\s*\??\s*$|(?:z\s+tym|o\s+tym|w\s+tym|do\s+tego)\s*[?.!]?\s*$|(?:z\s+tym|z\s+tego|o\s+tym)\s+(?:zrobić|zrobimy|robić|począć)\s*[?.!]?\s*$|^\s*(?:przekształć|zamień|podsumuj|porównaj|wyjaśnij|rozwiń)\s+(?:to|tę|ten|je|te)(?![\p{L}\d])/iu,
);
/* a short follow-up that points back with a pronoun or at "your" earlier answer (read only when the
   conversation holds earlier work, and never over a named place, a public event or a fresh ask) */
const EN_ANAPHORA =
  /\b(?:it|that|those|them|these|this)\b(?!\s+(?:country|countries|year|week|month|morning|time|city|government)\b)|\byour\s+(?:comparison|reasoning|framework|analysis|answer|list|criteria|plan|advice|points?|model|argument)\b|\byou\s+(?:gave|laid\s+out|said|suggested|proposed|listed|mentioned|described)\b/i;
const PL_ANAPHORA = plTolerant(
  /(?:^|[\s,])(?:to|tego|tym|te|tych|tej|ten|tę|je|nich|niego)(?=$|[\s,.?!])|co\s+(?:napisał\p{L}*|zaproponował\p{L}*|powiedział\p{L}*|wymienił\p{L}*)|(?:twoj\p{L}*|twoich|twoim)\s+(?:porównani|rozumowani|ram|analiz|odpowied|list|kryteri|plan|rad|model)\p{L}*/iu,
);
const EN_APPLY =
  /\b(?:apply|applying|use|using|test|testing)\s+(?:that|this|the|it|those|these)\b[^?.!]{0,40}?\b(?:to|on|against|for)\s+([\p{L}][\p{L}\d .&'-]{1,60}?)(?=[?.!,]|$|\s+(?:are|is|and|—|-)\s)/iu;
const PL_APPLY = plTolerant(
  /(?:zastosuj|użyj|sprawdź|odnieś)\s+(?:to|tę|ten|je|t\p{L}+)(?![\p{L}\d])[^?.!]{0,40}?(?<![\p{L}\d])(?:do|na|wobec|dla)\s+([\p{L}][\p{L}\d .&'-]{1,60}?)(?=[?.!,]|$)/iu,
);
const EN_DIAGNOSE =
  /\b(?:which|what)\s+(?:(?:part|component|dimension|element|factor|pillar|piece|one|assumption|argument|reason|risk|step|link|lever)s?|of\s+(?:those|these|them|the\s+\w+))\b.{0,40}\b(?:weakest|strongest|most\s+important|matters?\s+most|least|biggest|riskiest|most\s+fragile|missing|hardest|most\s+durable|lasting|most\s+likely)\b|\bthe\s+(?:weakest|riskiest|most\s+fragile|biggest|most\s+questionable)\s+(?:part|assumption|argument|point|link|risk|reason|element)\b|\bwhat\s+(?:would|could)\s+break\s+(?:it|that|this)\b/i;
const PL_DIAGNOSE = plTolerant(
  /(?:któr\p{L}*|co)\s+(?:(?:część|element|składnik|wymiar|czynnik|filar|założeni\p{L}*|argument\p{L}*|ryzyk\p{L}*|krok\p{L}*)(?![\p{L}\d])|z\s+(?:nich|tych|tego))(?![\p{L}\d]).{0,40}(?:najsłabsz\p{L}*|najsilniejsz\p{L}*|najważniejsz\p{L}*|najbardziej|brakuj\p{L}*|najtrwalsz\p{L}*|najtrudniejsz\p{L}*)|najsłabsz\p{L}*\s+(?:część|element|ogniwo|punkt|założeni\p{L}*|argument\p{L}*)/iu,
);

/* ── DEPTH and CONCEPT forms (never a list of concepts) ───────────────────────────────────── */
const EN_DEPTH =
  /\b(?:deeply|in\s+depth|in-depth|deeper|deep\s+(?:analysis|dive|explanation)|at\s+a\s+deeper\s+level|really\s+mean|actually\s+mean|beyond\s+the\s+(?:textbook|obvious|dictionary)|conceptually|fundamentally|thoroughly|rigorously)\b/i;
const PL_DEPTH = plTolerant(
  /(?:głęboko|głębiej|głębsz\p{L}*|dogłębn\p{L}*|naprawdę\s+(?:oznacza|znaczy|jest)|w\s+istocie|koncepcyjn\p{L}*|fundamentaln\p{L}*|wnikliw\p{L}*|szczegółow\p{L}*\s+analiz\p{L}*)/iu,
);
const EN_CONCEPT =
  /^\s*(?:please\s+)?(?:define|explain|describe|analy[sz]e|unpack|clarify|interpret)\b|\bwhat\s+(?:does|do)\s+.{2,80}?\s+(?:really\s+|actually\s+)?mean\b|\bwhat\s+(?:is|are)\s+.{2,80}?\s+(?:really|actually)\b|\b(?:meaning|nature|essence|definition|anatomy)\s+of\b|\bwhat\s+(?:is|are)\s+the\s+(?:difference|relationship)\s+between\b/i;
const PL_CONCEPT = plTolerant(
  /^\s*(?:proszę\s+)?(?:zdefiniuj|wyjaśnij|opisz|przeanalizuj|wytłumacz|zinterpretuj)(?![\p{L}\d])|co\s+(?:naprawdę\s+|właściwie\s+)?(?:oznacza|znaczy)(?![\p{L}\d])|czym\s+(?:naprawdę\s+|właściwie\s+)?(?:jest|są)(?![\p{L}\d])|(?:znaczenie|natura|istota|definicja)\s+\p{L}+/iu,
);
/*
  CTO R4 CLOSEOUT — A CAUSAL / MECHANISM QUESTION ("how can success create the conditions for
  failure", "why can efficiency make a system fragile", "how does leverage magnify losses",
  "jak nadmierna X może prowadzić do Y"). A how / why opener (not about the reader's own action:
  "how can I / we …" is advice) followed by a verb from a CAUSAL FAMILY: cause / produce,
  transform / become, amplify / reinforce, weaken / erode / collapse, strengthen / protect. The
  families are verbs of causation — the subject (crisis, peg, war, success) is never read.
*/
const EN_CAUSAL =
  /^\s*(?:(?:so|and|but|ok(?:ay)?)[,]?\s+)?(?:how|why|in\s+what\s+ways?|what\s+mechanisms?|by\s+what\s+mechanisms?)\s+(?!(?:was|were|did|had|has|have|is|are|am)\b)(?:(?:can|could|does|do|might|would|may|will|should|must)\s+)?(?!(?:i|we|you|my|our|me|us)\b).{2,160}?\b(?:lead(?:s|ing)?\s+to|led\s+to|contribut\w*|caus\w*|result(?:s|ing|ed)?\s+in|produc\w*|creat\w*|generat\w*|trigger\w*|driv\w*|breed\w*|give\s+rise|turn\w*\s+(?:[\p{L}'’-]+\s+){0,6}?into|turn\w*|becom\w*|end\s+up|mak\w*\s+(?:[\p{L}'’-]+\s+){0,4}?(?:more|less|fragile|vulnerable|weak|weaker|strong|stronger|unstable|brittle|rigid|resilient|complacent)|render\w*|transform\w*|reshap\w*|shap\w*|amplif\w*|magnif\w*|multipl\w*|compound\w*|reinforc\w*|accelerat\w*|escalat\w*|spiral\w*|snowball\w*|cascad\w*|spread\w*|weaken\w*|undermin\w*|erod\w*|destroy\w*|damag\w*|hollow\w*|destabili[sz]\w*|collaps\w*|fail\w*|backfir\w*|los(?:e|es|ing)|declin\w*|fragili[sz]\w*|sabotag\w*|unravel\w*|crumbl\w*|break\s+down|strengthen\w*|protect\w*|stabili[sz]\w*|sustain\w*|insulat\w*)\b|^\s*what\s+makes\s+.{2,80}?\s+(?:fragile|vulnerable|resilient|stable|unstable|brittle|robust|durable|collapse|fail|succeed|last|backfire)\b|^\s*(?:indicate|show|explain|describe|analy[sz]e)\s+(?:how|why)\b/iu;
const PL_CAUSAL = plTolerant(
  /^\s*(?:(?:a|i|więc|ok)[,]?\s+)?(?:jak|dlaczego|czemu|w\s+jaki\s+sposób|co\s+sprawia|jakim\s+mechanizmem)(?![\p{L}\d])(?!\s+(?:mogę|możemy|powinienem|powinnam|powinniśmy|mam|mamy)(?![\p{L}\d])).{2,160}?(?:prowadz\p{L}*|prowadzi\p{L}*|doprowadz\p{L}*|przyczyni\p{L}*|powod\p{L}*|wywoł\p{L}*|tworz\p{L}*|stwarza\p{L}*|rodz\p{L}*|skutkuj\p{L}*|staj\p{L}*\s+się|zamieni\p{L}*|przekształc\p{L}*|wzmacnia\p{L}*|wzmocni\p{L}*|potęguj\p{L}*|pogłębia\p{L}*|nasila\p{L}*|napędza\p{L}*|przyspiesza\p{L}*|zwielokrotni\p{L}*|osłabia\p{L}*|osłabi\p{L}*|podkopuj\p{L}*|niszcz\p{L}*|zniszcz\p{L}*|destabilizuj\p{L}*|eroduj\p{L}*|podważa\p{L}*|utrat\p{L}*|traci\p{L}*|straci\p{L}*|upad\p{L}*|załam\p{L}*|chroni\p{L}*|stabilizuj\p{L}*|kształtuj\p{L}*)(?<!(?:ł|ła|ło|li|ły|łem|łam))(?![\p{L}])|^\s*(?:wyjaśnij|pokaż|opisz|przeanalizuj)\s+(?:jak|dlaczego|w\s+jaki\s+sposób)(?![\p{L}\d])/iu,
);

/*
  CTO R4 THIRD PASS — AN IMPERATIVE IS A REQUEST. "Outline…", "Explain…", "Compare…", "Give me…",
  "Opisz…", "Porównaj…", "Czy możesz wyjaśnić…" ask for work even without a question mark. The
  request is read as an ACT FAMILY (explain / produce / advise / compare), so a duration or a
  topic inside it ("a four-day work week", "a 30-year mortgage") is the SUBJECT of the request,
  never the whole turn. Transformation targets (table, plan, checklist…) are read before this.
*/
type RequestAct = 'EXPLAIN' | 'PRODUCE' | 'ADVISE' | 'COMPARE';
const EN_LEAD = String.raw`^\s*(?:(?:ok(?:ay)?|right|so|and|now|great|good|fine|thanks|alright|also|then)[,.!]?\s+)*(?:please\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|i\s+(?:want|need|would\s+like|'d\s+like)\s+(?:you\s+)?to\s+|let\s+us\s+|let's\s+)*`;
const EN_ACTS: ReadonlyArray<readonly [RequestAct, string]> = [
  ['COMPARE', String.raw`(?:compare|contrast|rank|weigh\s+up|differentiate|distinguish\s+between)`],
  [
    'ADVISE',
    String.raw`(?:suggest|recommend|advise|guide\s+me|coach\s+me|help\s+(?:me|us)\s+(?:decide|choose|think|figure|plan|understand|prepare|work\s+out|weigh|prioriti[sz]e))`,
  ],
  [
    'PRODUCE',
    String.raw`(?:write|draft|compose|create|design|build|develop|devise|formulate|prepare|produce|generate|come\s+up\s+with|brainstorm|propose)`,
  ],
  [
    'EXPLAIN',
    String.raw`(?:explain|outline|describe|discuss|analy[sz]e|evaluate|assess|examine|explore|unpack|clarify|define|list|identify|name|summari[sz]e|review|critique|argue|justify|illustrate|interpret|characteri[sz]e|walk\s+(?:me|us)\s+through|talk\s+(?:me|us)\s+through|tell\s+(?:me|us)\s+(?:about|how|why|what|whether)|give\s+(?:me|us)\s+(?:an?\s+|the\s+|some\s+)?(?:overview|explanation|breakdown|rundown|primer|sense|framework|model|account|analysis|history|background)|break\s+down|make\s+the\s+case|set\s+out|spell\s+out|lay\s+out|map\s+out|sketch|think\s+through|reason\s+through|consider|weigh)`,
  ],
];
const PL_LEAD = String.raw`^\s*(?:(?:ok|dobrze|dobra|świetnie|super|dzięki|a|i|teraz|więc|to)[,.!]?\s+)*(?:proszę\s+|czy\s+(?:możesz|mógłbyś|mogłabyś|możecie|mógłby\s+pan|mogłaby\s+pani)\s+(?:mi\s+|nam\s+)?|chcę,?\s+(?:żebyś|abyś)\s+)*`;
const PL_ACTS: ReadonlyArray<readonly [RequestAct, string]> = [
  [
    'COMPARE',
    String.raw`(?:porównaj|porównać|zestaw|zestawić|uszereguj|uszeregować|odróżnij|rozróżnij)`,
  ],
  [
    'ADVISE',
    String.raw`(?:doradź|doradzić|poradź|poradzić|poleć|polecić|zasugeruj|zasugerować|pomóż\s+(?:mi\s+|nam\s+)?(?:wybrać|zdecydować|zrozumieć|zaplanować|przemyśleć|przygotować))`,
  ],
  [
    'PRODUCE',
    String.raw`(?:napisz|napisać|przygotuj|przygotować|stwórz|stworzyć|zaprojektuj|zaprojektować|opracuj|opracować|zaproponuj|zaproponować|wymyśl|wymyślić|sformułuj|sformułować|zredaguj|zredagować)`,
  ],
  [
    'EXPLAIN',
    String.raw`(?:wyjaśnij|wyjaśnić|wytłumacz|wytłumaczyć|opisz|opisać|omów|omówić|przeanalizuj|przeanalizować|oceń|ocenić|rozważ|rozważyć|przedstaw|przedstawić|scharakteryzuj|wymień|wymienić|wypisz|podaj|podać|zdefiniuj|streść|podsumuj|nakreśl|zarysuj|przybliż|przybliżyć|uzasadnij|zinterpretuj|rozłóż\s+na\s+czynniki)`,
  ],
];
const ACT_RES: Readonly<Record<'en' | 'pl', ReadonlyArray<readonly [RequestAct, RegExp]>>> = {
  en: EN_ACTS.map(([act, verbs]) => [act, new RegExp(`${EN_LEAD}${verbs}\\b`, 'i')] as const),
  pl: PL_ACTS.map(
    ([act, verbs]) => [act, new RegExp(`${PL_LEAD}${verbs}(?![\\p{L}\\d])`, 'iu')] as const,
  ),
};

/** The request act an imperative turn performs, or null when it is not an imperative request. */
export function readRequestAct(question: string, lang: 'en' | 'pl'): RequestAct | null {
  const text = question.trim();
  for (const [act, re] of ACT_RES[lang]) if (re.test(text)) return act;
  return null;
}

export interface JobContext {
  /** The router's knowledge-requirement reading (null = no governed shape). */
  readonly requirement: string | null;
  readonly requirementReason?: string;
  readonly namedPlace: boolean;
  readonly statedPeriod: boolean;
  /** An explicit time marker or a changing quantity: current evidence is requested. */
  readonly fresh: boolean;
  /** The conversation holds work this assistant already produced (an artifact). */
  readonly hasPriorWork: boolean;
  /** A public event named (war, election…): current affairs, not concept. */
  readonly publicEvent: boolean;
  /** CTO R4 third pass — the request year, so a stated year is read as a time ROLE. */
  readonly requestYear?: number;
  /** CTO R4 third pass — the reader asks for reporting / coverage itself (an archive request). */
  readonly reportRequest?: boolean;
  /** CTO R4 third pass — an inherited Map / story place scopes this turn ("in this country"). */
  readonly inheritedScope?: boolean;
}

const KNOWN: Readonly<Record<string, UserJob>> = {
  STABLE_REFERENCE: 'EXPLANATION',
  PLACE_REFERENCE: 'PLACE_BACKGROUND',
  ADVISORY: 'ADVISORY',
  MIXED_ADVISORY_CURRENT: 'MIXED',
  DECISION_SUPPORT: 'DECISION_SUPPORT',
  COMPUTATION: 'COMPUTATION',
  CURRENT_REPORTING: 'CURRENT_REPORTING',
  EVENT_DISCOVERY: 'CURRENT_REPORTING',
  OFFICIAL_REFERENCE: 'OFFICIAL_CURRENT_REFERENCE',
  MIXED_REFERENCE_CURRENT: 'MIXED',
};

export function readTransformation(question: string, lang: 'en' | 'pl'): TransformationKind | null {
  const text = question.trim();
  for (const [kind, re] of lang === 'pl' ? PL_SELF_KIND : EN_SELF_KIND)
    if (re.test(text)) {
      /* a self-kind verb that ALSO names a target family ("summarise that in a table") → the target */
      if (kind === 'SUMMARY' || kind === 'COMPARISON') {
        const target = (lang === 'pl' ? PL_TARGETS : EN_TARGETS).find(([, t]) => t.test(text));
        if (target !== undefined && target[0] !== 'SUMMARY' && target[0] !== 'COMPARISON')
          return target[0];
      }
      return kind;
    }
  if (!(lang === 'pl' ? PL_WORK_OPENER : EN_WORK_OPENER).test(text)) return null;
  for (const [kind, re] of lang === 'pl' ? PL_TARGETS : EN_TARGETS) if (re.test(text)) return kind;
  return null;
}
export function referencesPriorWork(question: string, lang: 'en' | 'pl'): boolean {
  return (lang === 'pl' ? PL_REFERENCE : EN_REFERENCE).test(question.trim());
}
export function readApplicationTarget(question: string, lang: 'en' | 'pl'): string | null {
  const m = (lang === 'pl' ? PL_APPLY : EN_APPLY).exec(question);
  return m?.[1]?.trim() ?? null;
}

const reading = (
  job: UserJob | null,
  rest: Partial<JobReading> & Pick<JobReading, 'reason'>,
): JobReading => ({
  job,
  freshness: 'NONE',
  evidence: 'NONE',
  depth: 'STANDARD',
  transformation: null,
  discourseReference: 'NONE',
  temporal: [],
  source: job === null ? 'UNRESOLVED' : 'DETERMINISTIC',
  confidence: job === null ? 'LOW' : 'HIGH',
  basis: job === null ? 'NONE' : 'FORM',
  ...rest,
});

/**
 * The deterministic job reading. Order matters: an explicit reference to prior work and an
 * imperative work request outrank everything (they are operations on this conversation); then a
 * request for conceptual depth or a causal concept question (when nothing asks for current
 * evidence); then the router's existing knowledge requirement; otherwise UNRESOLVED.
 */
export function readUserJob(question: string, language: string, ctx: JobContext): JobReading {
  const lang: 'en' | 'pl' = language === 'pl' ? 'pl' : 'en';
  const text = question.trim();
  const temporal = readTemporalRoles(text, lang, ctx.requestYear);
  const planHorizon = temporal.some((t) => t.role === 'PLAN_HORIZON');
  /* a plan's horizon / a trip's length / a deadline is not a request for current evidence */
  /* CTO R4 third pass — only a window reaching the present is currentness; a completed
     historical period is evidence AGAINST current reporting */
  const reportingWindow = temporal.some((t) => t.role === 'REPORTING_WINDOW');
  const historicalPeriod = temporal.some((t) => t.role === 'HISTORICAL_PERIOD') && !reportingWindow;
  const fresh = (ctx.fresh && !planHorizon) || reportingWindow;
  const deep = (lang === 'pl' ? PL_DEPTH : EN_DEPTH).test(text);
  const depth: Depth = deep ? 'DEEP' : 'STANDARD';
  const transformation = readTransformation(text, lang);
  const reference =
    referencesPriorWork(text, lang) ||
    readEvaluationKind(text, lang) === 'ARTIFACT_COMPONENT_EVALUATION';
  const anaphora =
    text.length <= 200 &&
    !ctx.namedPlace &&
    !ctx.publicEvent &&
    (lang === 'pl' ? PL_ANAPHORA : EN_ANAPHORA).test(text);
  const discourseReference: DiscourseReference =
    (reference || anaphora) && ctx.hasPriorWork ? 'PRIOR_WORK' : 'NONE';

  /* 1 · an operation on work already done in this conversation */
  if (discourseReference === 'PRIOR_WORK' && !fresh) {
    if (transformation !== null)
      return reading(transformation === 'PLAN' ? 'PLANNING' : 'TRANSFORMATION', {
        reason: 'a work request on this conversation’s earlier work',
        transformation,
        discourseReference,
        temporal,
        depth,
      });
    if (readApplicationTarget(text, lang) !== null)
      return reading('DECISION_SUPPORT', {
        reason: 'applies an earlier framework to a new target',
        discourseReference,
        temporal,
        depth: 'DEEP',
      });
    if ((lang === 'pl' ? PL_DIAGNOSE : EN_DIAGNOSE).test(text))
      return reading('DEEP_CONCEPTUAL_ANALYSIS', {
        reason: 'diagnoses a component of the earlier framework',
        discourseReference,
        temporal,
        depth: 'DEEP',
      });
    if (ctx.requirement === 'ADVISORY' || ctx.requirement === 'DECISION_SUPPORT')
      return reading(ctx.requirement === 'ADVISORY' ? 'ADVISORY' : 'DECISION_SUPPORT', {
        reason: 'advice on the earlier work',
        discourseReference,
        temporal,
        depth,
      });
    return reading('EXPLANATION', {
      reason: 'a follow-up on the earlier work',
      discourseReference,
      temporal,
      depth,
    });
  }

  /* 2 · an imperative work request is a request, even without prior work (a plan, a table…). A
     summary / briefing / comparison of a TOPIC with nothing earlier to work on is left to the
     semantic classifier (it may be a request for current reporting on that topic). */
  if (
    transformation !== null &&
    !fresh &&
    !ctx.namedPlace &&
    !reference &&
    !(['SUMMARY', 'BRIEFING', 'COMPARISON', 'EXPLAIN_MORE'] as const).includes(
      transformation as 'SUMMARY' | 'BRIEFING' | 'COMPARISON' | 'EXPLAIN_MORE',
    )
  )
    return reading(transformation === 'PLAN' ? 'PLANNING' : 'TRANSFORMATION', {
      reason: 'an imperative work request',
      transformation,
      temporal,
      depth,
    });

  /* 3 · conceptual depth / a causal concept question, when nothing asks for current evidence */
  const concept = (lang === 'pl' ? PL_CONCEPT : EN_CONCEPT).test(text);
  const causal = (lang === 'pl' ? PL_CAUSAL : EN_CAUSAL).test(text);
  const placeOnlyCurrent =
    ctx.requirement === 'CURRENT_REPORTING' && ctx.requirementReason === 'a named place';
  const conceptualCandidate =
    !fresh &&
    !ctx.statedPeriod &&
    !ctx.publicEvent &&
    (ctx.requirement === null || placeOnlyCurrent || ctx.requirement === 'STABLE_REFERENCE');
  if (conceptualCandidate && !ctx.namedPlace && (deep || causal) && (concept || causal))
    return reading('DEEP_CONCEPTUAL_ANALYSIS', {
      reason: deep ? 'asks for conceptual depth' : 'a causal concept question',
      temporal,
      depth: 'DEEP',
      ...(causal ? { analysis: 'CAUSAL' as const } : {}),
    });
  if (conceptualCandidate && !ctx.namedPlace && deep)
    return reading('DEEP_CONCEPTUAL_ANALYSIS', {
      reason: 'asks for depth',
      temporal,
      depth: 'DEEP',
    });

  /* 3b · CTO R4 third pass — a completed historical period (no window reaching the present, no
     request for the reporting itself) is historical / reference analysis, never current news */
  if (
    historicalPeriod &&
    !fresh &&
    ctx.reportRequest !== true &&
    (ctx.requirement === null ||
      placeOnlyCurrent ||
      ctx.requirement === 'STABLE_REFERENCE' ||
      (ctx.requirement === 'CURRENT_REPORTING' && ctx.requirementReason !== 'a freshness marker'))
  )
    return reading(causal || deep ? 'DEEP_CONCEPTUAL_ANALYSIS' : 'EXPLANATION', {
      reason: 'a completed historical period',
      temporal,
      depth: causal || deep ? 'DEEP' : 'STANDARD',
      ...(causal ? { analysis: 'CAUSAL' as const } : {}),
    });

  /* 3c · CTO R4 third pass — an imperative request is a request (EN / PL act families) */
  const act = readRequestAct(text, lang);
  if (
    act !== null &&
    !fresh &&
    !ctx.namedPlace &&
    !ctx.publicEvent &&
    ctx.inheritedScope !== true &&
    !reference &&
    (ctx.requirement === null || placeOnlyCurrent)
  )
    return reading(
      act === 'ADVISE'
        ? 'ADVISORY'
        : act === 'COMPARE'
          ? 'COMPARISON'
          : act === 'PRODUCE'
            ? 'WRITING'
            : 'EXPLANATION',
      { reason: `an imperative request (${act.toLowerCase()})`, temporal, depth },
    );

  /* 4 · the router's existing governed reading */
  if (ctx.requirement !== null) {
    const job = KNOWN[ctx.requirement] ?? null;
    if (job !== null) {
      const freshness: Freshness =
        job === 'MIXED'
          ? 'PARTIAL'
          : job === 'CURRENT_REPORTING' || job === 'OFFICIAL_CURRENT_REFERENCE'
            ? 'CURRENT'
            : 'NONE';
      return reading(job === 'EXPLANATION' && deep ? 'DEEP_CONCEPTUAL_ANALYSIS' : job, {
        reason: `governed knowledge requirement ${ctx.requirement}`,
        basis: 'KNOWLEDGE',
        freshness,
        evidence:
          job === 'CURRENT_REPORTING' || job === 'MIXED'
            ? 'CURRENT_REPORTING'
            : job === 'OFFICIAL_CURRENT_REFERENCE'
              ? 'OFFICIAL'
              : job === 'COMPUTATION'
                ? 'DETERMINISTIC'
                : 'NONE',
        temporal,
        depth,
        transformation,
      });
    }
  }

  /* 5 · no governed form. A place is SCOPE and a topic is SUBJECT; neither is a request for news. */
  if (fresh)
    return reading('CURRENT_REPORTING', {
      reason: 'an explicit time marker',
      freshness: 'CURRENT',
      evidence: 'CURRENT_REPORTING',
      temporal,
      depth,
    });
  return reading(null, {
    reason: 'no governed form — resolved at execution',
    temporal,
    depth,
    transformation,
  });
}
