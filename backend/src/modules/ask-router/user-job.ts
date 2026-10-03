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
const PL_TRIP = /(?:podróż\p{L}*|wycieczk\p{L}*|wakacj\p{L}*|pobyt\p{L}*|zwiedz\p{L}*|safari)/iu;
const EN_DURATION = /\b(\d{1,3}|[a-z]+)[-\s](day|days|night|nights|week|weeks)\b/i;
const PL_DURATION = /(?:^|\s)(\d{1,3}|\p{L}+)\s+(dni|dzień|tygodni|tydzień)(?=$|[\s,.?!])/iu;
const EN_REPORTING =
  /\b(?:last|past|previous|recent)\s+(\d{1,3}|[a-z]+)\s+(days|weeks|months)\b|\b(\d{1,3}|[a-z]+)\s+(days|weeks|months)\s+ago\b|\b(?:yesterday|today|this\s+(?:week|month|quarter|year)|last\s+(?:week|month|quarter|year))\b|\b(?:the\s+)?(?:past|last|previous)\s+(?:few\s+|couple\s+(?:of\s+)?)?(?:days|weeks|months|week|month|fortnight)\b/i;
const PL_REPORTING =
  /(?:ostatni\p{L}*|minion\p{L}*)\s+(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy)|(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy)\s+temu|(?:^|\s)(?:wczoraj|dziś|dzisiaj|w\s+tym\s+(?:tygodniu|miesiącu|roku))(?=$|[\s,.?!])|w\s+(?:ostatni\p{L}*|zeszł\p{L}*|minion\p{L}*)\s+(?:tygodni\p{L}*|miesiąc\p{L}*|miesiącu|dniach)|(?:ostatni|zeszły|miniony)\s+(?:tydzień|miesiąc)/iu;
const EN_DEADLINE =
  /\b(?:by|before|within)\s+(?:the\s+end\s+of\s+)?(\d{1,3}\s+(?:days|weeks|months)|(?:next\s+)?(?:week|month|quarter|year)|q[1-4]|\d{4})\b/i;
const EN_FUTURE =
  /\b(?:next|coming|upcoming)\s+(?:week|month|quarter|year|summer|winter|spring|autumn|fall)\b|\bin\s+(\d{1,3}|[a-z]+)\s+(days|weeks|months|years)(?:'?\s*time)?\b/i;
const PL_FUTURE =
  /(?:przyszł\p{L}*|następn\p{L}*|nadchodząc\p{L}*)\s+(?:rok\p{L}*|roku|miesiąc\p{L}*|tydzień|tygodni\p{L}*|lat\p{L}*)|za\s+(\d{1,3}|\p{L}+)\s+(dni|tygodni|miesięcy|lat)/iu;
const EN_HISTORICAL = /\b(?:in|during|since)\s+(?:the\s+)?(1[5-9]\d{2}|20[0-2]\d)s?\b/i;

export function readTemporalRoles(question: string, lang: 'en' | 'pl'): TemporalReading[] {
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
    const historical = EN_HISTORICAL.exec(text);
    if (historical) out.push({ role: 'HISTORICAL_PERIOD', text: historical[0] });
  }
  const future = (lang === 'pl' ? PL_FUTURE : EN_FUTURE).exec(text);
  if (future && !out.some((t) => t.role === 'DEADLINE'))
    out.push({ role: 'FUTURE_HORIZON', text: future[0] });
  return out;
}

/* ── WORK REQUESTS: commands are requests without a question mark ─────────────────────────── */
const EN_TRANSFORM: ReadonlyArray<readonly [TransformationKind, RegExp]> = [
  [
    'PLAN',
    /^\s*(?:please\s+|now\s+|can\s+you\s+|could\s+you\s+)?(?:turn|convert|make|translate|break|build|draft|write|create|put|give\s+me|outline|sketch|lay\s+out|map\s+out)\b.{0,60}?\b(?:(?:action|implementation)\s+)?(?:plan|roadmap|programme|program|timeline|schedule|sprint)\b/i,
  ],
  [
    'TABLE',
    /^\s*(?:please\s+)?(?:put|turn|convert|make|show|lay|give\s+me)\b.{0,40}?\b(?:table|matrix|grid)\b/i,
  ],
  [
    'CHECKLIST',
    /^\s*(?:please\s+)?(?:turn|convert|make|build|create|give\s+me|put)\b.{0,40}?\bchecklist\b/i,
  ],
  [
    'SUMMARY',
    /^\s*(?:please\s+)?(?:summari[sz]e|sum\s+up|condense|shorten|recap|give\s+me\s+(?:a\s+)?(?:summary|recap|tl;?dr))\b/i,
  ],
  [
    'SCENARIOS',
    /^\s*(?:please\s+)?(?:give|show|outline|sketch|describe|build|draft)\b.{0,30}?\bscenarios?\b/i,
  ],
  ['COMPARISON', /^\s*(?:please\s+)?compare\s+(?:those|these|them|the\s+two|both|that|this)\b/i],
  [
    'EXPLAIN_MORE',
    /^\s*(?:please\s+)?(?:explain|elaborate|expand|go\s+deeper|dig\s+deeper|unpack)\b.{0,30}?\b(?:that|this|it|more|further|deeper|on\s+that)\b/i,
  ],
  [
    'FIRST_STEP',
    /^\s*what\s+(?:should|do|must)\s+(?:i|we)\s+do\s+first\b|^\s*where\s+(?:should|do)\s+(?:i|we)\s+start\b/i,
  ],
];
const PL_TRANSFORM: ReadonlyArray<readonly [TransformationKind, RegExp]> = [
  [
    'PLAN',
    /^\s*(?:proszę\s+)?(?:przekształć|zamień|zrób|rozpisz|przygotuj|stwórz|ułóż|napisz|zaplanuj)(?![\p{L}\d]).{0,60}?(?:plan\p{L}*|harmonogram\p{L}*|program\p{L}*|map\p{L}*\s+drogow\p{L}*)/iu,
  ],
  [
    'TABLE',
    /^\s*(?:proszę\s+)?(?:przekształć|zamień|zrób|ułóż|przedstaw|pokaż)(?![\p{L}\d]).{0,40}?(?:tabel\p{L}*|zestawieni\p{L}*)/iu,
  ],
  [
    'CHECKLIST',
    /^\s*(?:proszę\s+)?(?:przekształć|zamień|zrób|stwórz|przygotuj)(?![\p{L}\d]).{0,40}?(?:list\p{L}*\s+kontroln\p{L}*|checklist\p{L}*)/iu,
  ],
  ['SUMMARY', /^\s*(?:proszę\s+)?(?:podsumuj|streść|skróć)(?![\p{L}\d])/iu],
  [
    'SCENARIOS',
    /^\s*(?:proszę\s+)?(?:podaj|przedstaw|opisz|nakreśl)(?![\p{L}\d]).{0,30}?scenariusz\p{L}*/iu,
  ],
  ['COMPARISON', /^\s*(?:proszę\s+)?porównaj\s+(?:te|je|oba|obie|to|tamte)(?![\p{L}\d])/iu],
  [
    'EXPLAIN_MORE',
    /^\s*(?:proszę\s+)?(?:wyjaśnij|rozwiń|pogłęb)(?![\p{L}\d]).{0,30}?(?:to|bardziej|głębiej|szerzej)(?![\p{L}\d])/iu,
  ],
  [
    'FIRST_STEP',
    /^\s*(?:co|od\s+czego)\s+(?:powinniśmy|powinienem|powinnam|mamy)\s+(?:zrobić|zacząć)\s+(?:najpierw|na\s+początku)/iu,
  ],
];

/* ── REFERENCES TO WORK ALREADY DONE IN THIS CONVERSATION ───────────────────────────────────── */
const EN_REFERENCE =
  /\b(?:that|this|these|those)\s+(?:idea|framework|concept|model|analysis|diagnosis|plan|conclusion|conclusions|recommendation|recommendations|advice|answer|point|points|list|comparison|approach|argument|definition)\b|\b(?:which|what)\s+(?:part|component|dimension|element|factor|pillar|piece|one)s?\b|\b(?:apply|use|test)\s+(?:that|this|it)\b|^\s*(?:why|how\s+so|in\s+what\s+way)\s*\??\s*$|\b(?:about|on|with|into|of)\s+(?:it|that|this|them)\s*[?.!]?\s*$|^\s*(?:turn|convert|make|put|summari[sz]e|compare|explain|expand|elaborate)\s+(?:that|this|it|them|those|these)\b/i;
const PL_REFERENCE =
  /(?:t[ęa]|to|ten|tę|tego|tej|tym|te|tych)\s+(?:ide\p{L}*|ram\p{L}*|koncepcj\p{L}*|model\p{L}*|analiz\p{L}*|diagnoz\p{L}*|plan\p{L}*|wnios\p{L}*|rekomendacj\p{L}*|rad\p{L}*|odpowied\p{L}*|list\p{L}*|porównani\p{L}*)|(?:któr\p{L}*|jak\p{L}*)\s+(?:część|element|składnik|wymiar|czynnik|filar)|(?:zastosuj|użyj|sprawdź)\s+(?:to|tę|ten|je)|^\s*(?:dlaczego|czemu)\s*\??\s*$|(?:z\s+tym|o\s+tym|w\s+tym|do\s+tego)\s*[?.!]?\s*$|(?:z\s+tym|z\s+tego|o\s+tym)\s+(?:zrobić|zrobimy|robić|począć)\s*[?.!]?\s*$|^\s*(?:przekształć|zamień|podsumuj|porównaj|wyjaśnij|rozwiń)\s+(?:to|tę|ten|je|te)(?![\p{L}\d])/iu;
/* a short follow-up that points back with a pronoun or at "your" earlier answer (read only when the
   conversation holds earlier work, and never over a named place, a public event or a fresh ask) */
const EN_ANAPHORA =
  /\b(?:it|that|those|them|these|this)\b(?!\s+(?:country|countries|year|week|month|morning|time|city|government)\b)|\byour\s+(?:comparison|reasoning|framework|analysis|answer|list|criteria|plan|advice|points?|model|argument)\b|\byou\s+(?:gave|laid\s+out|said|suggested|proposed|listed|mentioned|described)\b/i;
const PL_ANAPHORA =
  /(?:^|[\s,])(?:to|tego|tym|te|tych|tej|ten|tę|je|nich|niego)(?=$|[\s,.?!])|co\s+(?:napisał\p{L}*|zaproponował\p{L}*|powiedział\p{L}*|wymienił\p{L}*)|(?:twoj\p{L}*|twoich|twoim)\s+(?:porównani|rozumowani|ram|analiz|odpowied|list|kryteri|plan|rad|model)\p{L}*/iu;
const EN_APPLY =
  /\b(?:apply|applying|use|using|test|testing)\s+(?:that|this|the|it|those|these)\b[^?.!]{0,40}?\b(?:to|on|against|for)\s+([\p{L}][\p{L}\d .&'-]{1,60}?)(?=[?.!,]|$|\s+(?:are|is|and|—|-)\s)/iu;
const PL_APPLY =
  /(?:zastosuj|użyj|sprawdź|odnieś)\s+(?:to|tę|ten|je|t\p{L}+)(?![\p{L}\d])[^?.!]{0,40}?(?<![\p{L}\d])(?:do|na|wobec|dla)\s+([\p{L}][\p{L}\d .&'-]{1,60}?)(?=[?.!,]|$)/iu;
const EN_DIAGNOSE =
  /\b(?:which|what)\s+(?:part|component|dimension|element|factor|pillar|piece|one)s?\b.{0,30}\b(?:weakest|strongest|most\s+important|matters?\s+most|least|biggest|riskiest|most\s+fragile|missing)\b/i;
const PL_DIAGNOSE =
  /(?:któr\p{L}*)\s+(?:część|element|składnik|wymiar|czynnik|filar)(?![\p{L}\d]).{0,30}(?:najsłabsz\p{L}*|najsilniejsz\p{L}*|najważniejsz\p{L}*|najbardziej|brakuj\p{L}*)/iu;

/* ── DEPTH and CONCEPT forms (never a list of concepts) ───────────────────────────────────── */
const EN_DEPTH =
  /\b(?:deeply|in\s+depth|in-depth|deeper|deep\s+(?:analysis|dive|explanation)|at\s+a\s+deeper\s+level|really\s+mean|actually\s+mean|beyond\s+the\s+(?:textbook|obvious|dictionary)|conceptually|fundamentally|thoroughly|rigorously)\b/i;
const PL_DEPTH =
  /(?:głęboko|głębiej|głębsz\p{L}*|dogłębn\p{L}*|naprawdę\s+(?:oznacza|znaczy|jest)|w\s+istocie|koncepcyjn\p{L}*|fundamentaln\p{L}*|wnikliw\p{L}*|szczegółow\p{L}*\s+analiz\p{L}*)/iu;
const EN_CONCEPT =
  /^\s*(?:please\s+)?(?:define|explain|describe|analy[sz]e|unpack|clarify|interpret)\b|\bwhat\s+(?:does|do)\s+.{2,80}?\s+(?:really\s+|actually\s+)?mean\b|\bwhat\s+(?:is|are)\s+.{2,80}?\s+(?:really|actually)\b|\b(?:meaning|nature|essence|definition|anatomy)\s+of\b|\bwhat\s+(?:is|are)\s+the\s+(?:difference|relationship)\s+between\b/i;
const PL_CONCEPT =
  /^\s*(?:proszę\s+)?(?:zdefiniuj|wyjaśnij|opisz|przeanalizuj|wytłumacz|zinterpretuj)(?![\p{L}\d])|co\s+(?:naprawdę\s+|właściwie\s+)?(?:oznacza|znaczy)(?![\p{L}\d])|czym\s+(?:naprawdę\s+|właściwie\s+)?(?:jest|są)(?![\p{L}\d])|(?:znaczenie|natura|istota|definicja)\s+\p{L}+/iu;
/* a causal question about how one condition produces another ("how can success lead to failure") */
const EN_CAUSAL =
  /\b(?:how|why|in\s+what\s+ways?)\s+(?:can|could|does|do|did|might|would|may|is|are)\b.{2,120}?\b(?:lead|leads|leading|contribute|contributes|cause|causes|result|results|turn|turns|become|becomes|end\s+up|backfire|undermine|destroy|losing|lose|collapse|decline|fail)\b|^\s*(?:indicate|show|explain|describe)\s+(?:how|why)\b/i;
const PL_CAUSAL =
  /(?:jak|dlaczego|w\s+jaki\s+sposób)\s+.{2,120}?(?:prowadzi\p{L}*|doprowadz\p{L}*|przyczyni\p{L}*|powod\p{L}*|skutkuj\p{L}*|staj\p{L}*\s+się|zamieni\p{L}*|utrat\p{L}*|straci\p{L}*|upad\p{L}*)/iu;

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
  for (const [kind, re] of lang === 'pl' ? PL_TRANSFORM : EN_TRANSFORM)
    if (re.test(question)) return kind;
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
  const temporal = readTemporalRoles(text, lang);
  const planHorizon = temporal.some((t) => t.role === 'PLAN_HORIZON');
  /* a plan's horizon / a trip's length / a deadline is not a request for current evidence */
  const reportingWindow = temporal.some(
    (t) => t.role === 'REPORTING_WINDOW' || t.role === 'HISTORICAL_PERIOD',
  );
  const fresh = (ctx.fresh && !planHorizon) || reportingWindow;
  const deep = (lang === 'pl' ? PL_DEPTH : EN_DEPTH).test(text);
  const depth: Depth = deep ? 'DEEP' : 'STANDARD';
  const transformation = readTransformation(text, lang);
  const reference = referencesPriorWork(text, lang);
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

  /* 2 · an imperative work request is a request, even without prior work (a plan, a table…) */
  if (transformation !== null && !fresh && !ctx.namedPlace && !reference)
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
    });
  if (conceptualCandidate && !ctx.namedPlace && deep)
    return reading('DEEP_CONCEPTUAL_ANALYSIS', {
      reason: 'asks for depth',
      temporal,
      depth: 'DEEP',
    });

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
