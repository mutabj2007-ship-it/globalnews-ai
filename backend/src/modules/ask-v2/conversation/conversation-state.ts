import { plTolerant } from '../../ask-router/pl-tolerant';
import type { PriorArtifact } from './conversation-artifact';
import {
  findCountryByIso3,
  getLocalizedCountryName,
  resolveCountryByAnyIdentifier,
} from '@globalnews-ai/shared';
import { resolvePolishCountry } from '../../analysis/query/polish-country-forms.util';
import { readContinuationEllipsis } from '../../analysis/anchor/continuation-ellipsis.util';
import {
  deriveKnowledgeRequirement,
  TRAVEL_FRAME,
  type KnowledgeRequirement,
} from '../../ask-router/knowledge-requirement';
import { readDecisionSupport } from '../../ask-router/decision-support';
import {
  readRequestAct,
  readTemporalRoles,
  readTransformation,
  referencesOwnPriorStatement,
} from '../../ask-router/user-job';
import {
  readCausalSelfAttribution,
  readClaimValidity,
} from '../../ask-router/semantic-ir/prior-claim';
import {
  conversationObjectiveState,
  readChoiceSet,
  type ObjectiveState,
} from '../../ask-router/semantic-ir/objective-state';
import {
  readBilateralRelationship,
  relationKindsIn,
  type BilateralRelationship,
} from '../../ask-router/bilateral-relationship';
import { normalizeAskQuestion } from '../../ask-router/normalization/qualified-reading';
import {
  attach,
  composeCrossCountryContinuation,
  plCases,
  retarget,
  splitTime,
  withNewPeriod,
} from './cross-country-continuation';
import { typedCountriesOf } from './conversation-place';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — THE GOVERNED CONVERSATION STATE (§2–§4, §23)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "Which places can I visit in Rwanda?" → "I have five days and prefer nature." → "What about
 * Nyungwe instead?" → "Which is cheaper?" was answered turn by turn as Rwanda NEWS: each short
 * turn named no place and no job, so the router read it as a current-events question about the
 * inherited country. The reader's JOB (travel planning), constraints (five days, nature) and the
 * options under discussion (Nyungwe, Volcanoes) existed only in the reader's head.
 *
 * This module makes that state EXPLICIT, derived deterministically from the reader's OWN earlier
 * questions in this owner-verified thread — never from an AI answer, never from another thread,
 * no model call, no I/O. It is folded turn by turn, oldest first, with the R3 §3 precedence:
 *
 *   1 current explicit instruction        (a preference / constraint stated now replaces the old)
 *   2 current explicit place / time       (a new country replaces the old one; options drop)
 *   3 current explicit job                (a self-contained new job resets job-scoped context)
 *   4 portable prior subject              (job, place, objective, comparison set)
 *   5 portable prior preferences          (duration, interests, priorities, official-only)
 *   6 story / Map / briefing context      (a surface context turn is never composed here)
 *   7 defaults
 *
 * PORTABLE, NOT COPIED (§4): only semantic context travels — the job, a place, a duration, an
 * interest, an objective, an official-sources constraint. Never a story id, an article anchor, a
 * source claim, or an answer. Options (Nyungwe, Volcanoes) are scoped to their place and are
 * dropped when the place changes. A self-contained question with a different job ("Who was
 * Napoleon?") resets the job-scoped context; thread-level constraints (official sources only)
 * survive until the reader changes them (§23).
 *
 * The state is USED in exactly one way: when the current turn continues a TRAVEL_PLANNING or a
 * DECISION_SUPPORT job that the router cannot read from the turn alone, the turn is composed into
 * the question the one engine answers (the same seam as the cross-country continuation), and the
 * composition is DISCLOSED on the answer ("Answered as …"). Every other turn is untouched. The
 * state itself is recorded for diagnostics (§42) on the answer payload.
 */

export type UserJob =
  | 'TRAVEL_PLANNING'
  | 'PLACE_BACKGROUND'
  | 'ADVISORY'
  | 'DECISION_SUPPORT'
  | 'STABLE_REFERENCE'
  | 'CURRENT_REPORTING'
  | 'COMPARISON'
  | 'RELATIONSHIP'
  | 'COMPUTATION'
  | 'UNKNOWN';

export interface ConversationState {
  readonly job: UserJob;
  readonly language: 'en' | 'pl';
  /** The conversation's place(s), ISO3, in the order the reader named them. */
  readonly geography: readonly string[];
  /** Places compared within the job (Rwanda → "And in Kenya?" keeps both for "compare"). */
  readonly comparisonSet: readonly string[];
  /** Options under discussion inside the place (Nyungwe, Volcanoes) — scoped to the place. */
  readonly options: readonly string[];
  readonly duration: string | null;
  readonly interests: readonly string[];
  readonly decisionObjective: string | null;
  /** A stated weighting ("growth over market size"). */
  readonly priorities: string | null;
  /** §23 — a thread-level evidence constraint, until the reader changes it. */
  readonly officialSourcesOnly: boolean;
  /** §14 — the relationship a RELATIONSHIP job is about (both sides, relation, corridor). */
  readonly relationship: BilateralRelationship | null;
  /** The latest short placeless follow-up that carried a subject ("And the economy?"). */
  readonly topicFollowUp: string | null;
  /** The latest period the reader stated in a follow-up ("What about yesterday?"). */
  readonly period: string | null;
  /** The reader's own earlier question that established the job. */
  readonly anchorQuestion: string | null;
  /** L-2 — the question this conversation currently means, built only from the reader's words. */
  readonly portableSubject: string | null;
}

export type StateField =
  | 'job'
  | 'geography'
  | 'comparisonSet'
  | 'options'
  | 'duration'
  | 'interests'
  | 'decisionObjective'
  | 'priorities'
  | 'officialSourcesOnly'
  | 'relationship'
  | 'topic'
  | 'period';

/** §42 — what this turn inherited, what it overrode, and whether it started a new job. */
export interface TurnStateTrace {
  readonly job: UserJob;
  readonly ownJob: UserJob;
  readonly carried: readonly StateField[];
  readonly overridden: readonly StateField[];
  readonly reset: boolean;
  readonly composed: 'CROSS_COUNTRY' | 'JOB_CONTEXT' | null;
  /** L-2 — the portable subject after this turn (diagnostics). */
  readonly subject?: string | null;
}

export interface ConversationalComposition {
  readonly effectiveQuestion: string;
  readonly fromQuestion: string;
  readonly kind: 'CROSS_COUNTRY' | 'JOB_CONTEXT';
}

export interface ConversationalTurn {
  readonly composition: ConversationalComposition | null;
  /** The state AFTER this turn — what the next turn will inherit. */
  readonly state: ConversationState;
  /** The turn only stated a preference / constraint and composed nothing (no job to serve). */
  readonly constraintOnly: boolean;
  readonly trace: TurnStateTrace;
  /**
   * CTO R4 semantic IR §9 — the newest objective the READER stated in this thread (incl. this
   * turn), as a structured slot (criterion, preference, constraints, source turn, inherited).
   * `text` is the criterion (compat). Never built from model prose.
   */
  readonly objective?: (ObjectiveState & { readonly text: string }) | null;
  /** CTO R4 semantic IR §17 — the newest set of options the reader named (bounded, their words) */
  readonly choiceSet?: readonly string[];
  /** the 0-based ordinal of this reader turn in the (bounded) thread */
  readonly turnIndex?: number;
}

export interface EarlierTurnText {
  readonly question: string;
  readonly language: string;
}

/** A follow-up is short; a long question is self-contained (matches conversation-place). */
export const MAX_FOLLOW_UP_WORDS = 16;
/** How far back the state is folded (the anchor lookback). */
export const STATE_LOOKBACK = 10;

const EMPTY = (language: 'en' | 'pl'): ConversationState => ({
  job: 'UNKNOWN',
  language,
  geography: [],
  comparisonSet: [],
  options: [],
  duration: null,
  interests: [],
  decisionObjective: null,
  priorities: null,
  officialSourcesOnly: false,
  relationship: null,
  topicFollowUp: null,
  period: null,
  anchorQuestion: null,
  portableSubject: null,
});

/* ── the reader's own explicit constraints (§23) ─────────────────────────────────────────── */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
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
  fourteen: 14,
  jeden: 1,
  dwa: 2,
  dwóch: 2,
  trzy: 3,
  cztery: 4,
  pięć: 5,
  sześć: 6,
  siedem: 7,
  osiem: 8,
  dziewięć: 9,
  dziesięć: 10,
};
const EN_DURATION =
  /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|fourteen)[\s-]+(day|days|night|nights|week|weeks)\b|\b(a|one)\s+(week|weekend|fortnight)\b/i;
const PL_DURATION = plTolerant(
  /(?:^|\s)(\d{1,2}|dwa|dwóch|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć)\s+(dni|dzień|tygodni\p{L}*|tydzień)(?=$|[\s,.?!])|(?:^|\s)(weekend|tydzień)(?=$|[\s,.?!])/iu,
);

export function readDuration(text: string, lang: 'en' | 'pl'): string | null {
  if (lang === 'pl') {
    const m = PL_DURATION.exec(text);
    if (!m) return null;
    if (m[3]) return m[3].toLowerCase() === 'weekend' ? 'weekend' : '7 dni';
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : (NUMBER_WORDS[m[1].toLowerCase()] ?? null);
    if (n === null) return null;
    return /^tydz|^tygodn/i.test(m[2]) ? `${n * 7} dni` : `${n} dni`;
  }
  const m = EN_DURATION.exec(text);
  if (!m) return null;
  if (m[4]) {
    const unit = m[4].toLowerCase();
    return unit === 'weekend' ? 'a weekend' : unit === 'fortnight' ? '14 days' : '7 days';
  }
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : (NUMBER_WORDS[m[1].toLowerCase()] ?? null);
  if (n === null) return null;
  const unit = m[2].toLowerCase();
  if (unit.startsWith('week')) return `${n * 7} days`;
  if (unit.startsWith('night')) return `${n} nights`;
  return `${n} days`;
}

/* interests: a closed vocabulary, EN → PL display */
const INTERESTS: ReadonlyArray<readonly [RegExp, string, string]> = [
  [
    /\b(?:nature|natural\s+scenery|landscapes?)\b|(?:przyrod\p{L}*|natur\p{L}*|krajobraz\p{L}*)/iu,
    'nature',
    'przyroda',
  ],
  [
    /\b(?:wildlife|animals|safaris?|game\s+drives?)\b|(?:zwierz\p{L}*|dzik\p{L}*\s+przyrod\p{L}*)/iu,
    'wildlife',
    'dzika przyroda',
  ],
  [
    /\b(?:hiking|trekking|walks?|walking)\b|(?:wędrów\p{L}*|trekking\p{L}*|piesz\p{L}*)/iu,
    'hiking',
    'wędrówki',
  ],
  [
    /\b(?:primates?|gorillas?|chimpanzees?|chimps)\b|(?:goryl\p{L}*|szympans\p{L}*|naczeln\p{L}*)/iu,
    'primates',
    'naczelne',
  ],
  [
    /\b(?:birds?|birding|birdwatching)\b|(?:ptak\p{L}*|ptasi\p{L}*)/iu,
    'birdwatching',
    'obserwacja ptaków',
  ],
  [/\b(?:beach|beaches|coast|seaside)\b|(?:plaż\p{L}*|wybrzeż\p{L}*)/iu, 'beaches', 'plaże'],
  [
    /\b(?:culture|cultural|museums?|heritage)\b|(?:kultur\p{L}*|muze\p{L}*|dziedzictw\p{L}*)/iu,
    'culture',
    'kultura',
  ],
  [/\b(?:food|cuisine)\b|(?:jedzeni\p{L}*|kuchni\p{L}*)/iu, 'food', 'kuchnia'],
  [/\b(?:adventure|adventurous)\b|(?:przygod\p{L}*)/iu, 'adventure', 'przygoda'],
  [
    /\b(?:relax(?:ing|ation)?|rest|quiet)\b|(?:odpoczyn\p{L}*|relaks\p{L}*)/iu,
    'relaxation',
    'odpoczynek',
  ],
  [
    /\b(?:budget|cheap|affordable|low[-\s]cost)\b|(?:budżet\p{L}*|tani\p{L}*)/iu,
    'budget',
    'budżet',
  ],
];
const EN_PREFERENCE_VERB =
  /\b(?:prefer|preferring|like|love|enjoy|into|interested\s+in|focus\s+on|care\s+(?:most\s+)?about|want\s+(?:to\s+see|to\s+do|some)|mostly|mainly|especially)\b/i;
const PL_PREFERENCE_VERB = plTolerant(
  /(?:wol\p{L}*|lubi\p{L}*|kocham|interesuj\p{L}*|zależy\s+mi\s+na|chc\p{L}*\s+zobaczy\p{L}*|głównie|szczególnie)/iu,
);

export function readInterests(text: string, lang: 'en' | 'pl'): string[] {
  const verb = (lang === 'pl' ? PL_PREFERENCE_VERB : EN_PREFERENCE_VERB).test(text);
  if (!verb) return [];
  return INTERESTS.filter(([re]) => re.test(text)).map(([, en, pl]) => (lang === 'pl' ? pl : en));
}

const EN_OFFICIAL_ONLY =
  /\b(?:only|just|solely|exclusively)\s+(?:use\s+|from\s+|with\s+)?official\s+sources?\b|\bofficial\s+sources?\s+only\b|\bnothing\s+but\s+official\s+sources?\b/i;
const PL_OFFICIAL_ONLY = plTolerant(
  /(?:tylko|wyłącznie|jedynie)\s+(?:z\s+)?oficjaln\p{L}*\s+źród\p{L}*|oficjaln\p{L}*\s+źród\p{L}*\s+(?:tylko|wyłącznie)/iu,
);
const EN_ANY_SOURCES = /\b(?:any\s+sources?|all\s+sources|not\s+only\s+official)\b/i;
const PL_ANY_SOURCES = plTolerant(/(?:dowoln\p{L}*\s+źród\p{L}*|wszystki\p{L}*\s+źród\p{L}*)/iu);

export function readOfficialOnly(text: string, lang: 'en' | 'pl'): boolean | null {
  if ((lang === 'pl' ? PL_OFFICIAL_ONLY : EN_OFFICIAL_ONLY).test(text)) return true;
  if ((lang === 'pl' ? PL_ANY_SOURCES : EN_ANY_SOURCES).test(text)) return false;
  return null;
}

const EN_PRIORITIES =
  /\b(?:i|we)\s+care\s+more\s+about\s+(.{2,60}?)\s+than\s+(?:about\s+)?(.{2,60}?)[.?!]*$|\bweight\s+(.{2,40}?)\s+more(?:\s+heavily)?\b|\bprioriti[sz]e\s+(.{2,40}?)(?:\s+over\s+(.{2,40}?))?[.?!]*$/i;
const PL_PRIORITIES = plTolerant(
  /(?:bardziej\s+zależy\s+mi\s+na\s+(.{2,60}?)\s+niż\s+(?:na\s+)?(.{2,60}?)[.?!]*$|daj\s+większ\p{L}*\s+wag\p{L}*\s+(.{2,40}?)[.?!]*$)/iu,
);

export function readPriorities(text: string, lang: 'en' | 'pl'): string | null {
  const m = (lang === 'pl' ? PL_PRIORITIES : EN_PRIORITIES).exec(text.trim());
  if (!m) return null;
  /* "current market size" is a weighting of a criterion, not a request for today's figure */
  const clean = (s: string | undefined) =>
    (s ?? '')
      .trim()
      .replace(/[.?!]+$/, '')
      .replace(/\b(?:current|present|today's)\s+/giu, '')
      .replace(/(?:^|\s)(?:obecn\p{L}*|aktualn\p{L}*)\s+/giu, ' ')
      .trim();
  if (lang === 'pl') {
    if (m[1]) return `${clean(m[1])} ponad ${clean(m[2])}`;
    return `większa waga: ${clean(m[3])}`;
  }
  if (m[1]) return `${clean(m[1])} over ${clean(m[2])}`;
  if (m[3]) return `more weight on ${clean(m[3])}`;
  return m[5] ? `${clean(m[4])} over ${clean(m[5])}` : `priority on ${clean(m[4])}`;
}

/* ── options under discussion inside a place (proper names that are not countries) ───────── */
const EN_OPTION_FRAMES: readonly RegExp[] = [
  /\bwhat\s+about\s+(.+?)\s+instead\b/i,
  /\bhow\s+about\s+(.+?)\s+instead\b/i,
  /\b(?:instead|rather)\s+(?:of\s+)?(?:go\s+to\s+|visit\s+)?(.+?)[?.!]*$/i,
  /\bcompare\s+(.+?)\s+(?:and|with|vs\.?|versus)\s+(.+?)[?.!]*$/i,
  /\b(?:between|either)\s+(.+?)\s+(?:and|or)\s+(.+?)[?.!]*$/i,
  /\b(?:what\s+about|how\s+about|and)\s+(.+?)[?.!]*$/i,
  /\b(?:visit|see|go\s+to)\s+(.+?)\s+or\s+(.+?)[?.!]*$/i,
];
const PL_OPTION_FRAMES: readonly RegExp[] = [
  /(?:a\s+co\s+z|a\s+może|co\s+z)\s+(.+?)\s+zamiast\b/iu,
  /(?:porównaj|porównanie)\s+(.+?)\s+(?:i|z|oraz|vs\.?)\s+(.+?)[?.!]*$/iu,
  /(?:między|pomiędzy)\s+(.+?)\s+(?:a|i)\s+(.+?)[?.!]*$/iu,
  /(?:a\s+co\s+z|a\s+może)\s+(.+?)[?.!]*$/iu,
];
const OPTION_STOP =
  /^(?:it|them|this|that|these|those|both|the\s+two|either|one|ones|there|here|instead|the\s+same|same|trip|itinerary|plan|option|options|tego|tym|nich|obu|obydwu)$/i;

/** A proper-name option: capitalised words ("Nyungwe", "Volcanoes National Park"). */
function optionName(raw: string): string | null {
  const text = raw
    .trim()
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/[?.!,;:]+$/, '')
    .trim();
  if (text.length < 3 || text.split(/\s+/).length > 4 || OPTION_STOP.test(text)) return null;
  if (!/^\p{Lu}/u.test(text)) return null;
  return text;
}

export function readOptions(
  text: string,
  lang: 'en' | 'pl',
  isCountry: (s: string) => boolean,
): string[] {
  for (const re of lang === 'pl' ? PL_OPTION_FRAMES : EN_OPTION_FRAMES) {
    const m = re.exec(text.trim());
    if (!m) continue;
    const names = m
      .slice(1)
      .filter((g): g is string => g !== undefined)
      .map(optionName)
      .filter((n): n is string => n !== null && !isCountry(n));
    if (names.length > 0) return [...new Set(names)];
  }
  return [];
}

/* ── the reader's job (the axis the router already reads, named as a job) ─────────────────── */
function jobOf(
  question: string,
  lang: 'en' | 'pl',
  countries: readonly string[],
): { job: UserJob; requirement: KnowledgeRequirement | null } {
  if (readBilateralRelationship(question, lang) !== null)
    return { job: 'RELATIONSHIP', requirement: null };
  const reading = deriveKnowledgeRequirement(question, lang, countries.length > 0);
  const decision = readDecisionSupport(question, lang);
  if (decision !== null) return { job: 'DECISION_SUPPORT', requirement: reading.requirement };
  switch (reading.requirement) {
    case 'PLACE_REFERENCE':
      return {
        job: reading.frame === 'TRAVEL' ? 'TRAVEL_PLANNING' : 'PLACE_BACKGROUND',
        requirement: reading.requirement,
      };
    case 'ADVISORY':
    case 'MIXED_ADVISORY_CURRENT':
      return { job: 'ADVISORY', requirement: reading.requirement };
    case 'STABLE_REFERENCE':
      return { job: 'STABLE_REFERENCE', requirement: reading.requirement };
    case 'COMPUTATION':
      return { job: 'COMPUTATION', requirement: reading.requirement };
    case 'CURRENT_REPORTING':
    case 'EVENT_DISCOVERY':
    case 'OFFICIAL_REFERENCE':
    case 'MIXED_REFERENCE_CURRENT':
      /* a named place alone is not a job: "Which places in Rwanda…" reads as a place */
      if (reading.reason === 'a named place' && TRAVEL_FRAME[lang].test(question))
        return { job: 'TRAVEL_PLANNING', requirement: reading.requirement };
      if (countries.length >= 2 && /\bcompar|porówn/iu.test(question))
        return { job: 'COMPARISON', requirement: reading.requirement };
      return { job: 'CURRENT_REPORTING', requirement: reading.requirement };
    default:
      return { job: 'UNKNOWN', requirement: null };
  }
}

const wordCount = (q: string) => q.trim().split(/\s+/u).filter(Boolean).length;
const asLang = (l: string): 'en' | 'pl' | null => (l === 'en' || l === 'pl' ? l : null);

interface TurnFeatures {
  readonly lang: 'en' | 'pl';
  readonly countries: readonly string[];
  readonly ellipsisTo: string | null;
  readonly job: UserJob;
  readonly requirement: KnowledgeRequirement | null;
  readonly relationship: BilateralRelationship | null;
  readonly duration: string | null;
  readonly interests: readonly string[];
  readonly options: readonly string[];
  readonly objective: string | null;
  readonly priorities: string | null;
  readonly officialOnly: boolean | null;
  /** The period the reader stated in this turn ("yesterday"), as written. */
  readonly statedPeriod: string | null;
  /** The turn is ONLY a time shift ("What about yesterday?"). */
  readonly timeOnly: boolean;
  /** Read as current reporting ONLY because it names a place (no freshness, no other job). */
  readonly placeOnly: boolean;
  readonly words: number;
}

const EN_TIME_ONLY = /^\s*(?:and\s+)?(?:what|how)\s+about\s+|^\s*and\s+|^\s*(?:same\s+for)\s+/i;
const PL_TIME_ONLY = plTolerant(/^\s*(?:a\s+)?(?:co\s+z|jak\s+z)?\s*/iu);

function statedPeriodOf(question: string, lang: 'en' | 'pl'): string | null {
  const outcome = normalizeAskQuestion({
    originalQuestion: question,
    sourceLanguage: lang,
    normalizationLanguage: lang,
    displayLanguage: lang,
    origin: 'ASK',
  });
  return outcome.status === 'NOT_READ' ? null : (outcome.reading.statedTime?.statedPeriod ?? null);
}

function readTurn(question: string, lang: 'en' | 'pl'): TurnFeatures {
  const typed = (typedCountriesOf(question, lang) ?? []).filter((c) => c !== 'CONTESTED');
  const ellipsis = readContinuationEllipsis(splitTime(question.trim(), lang).rest);
  const ellipsisTo =
    ellipsis !== null && ellipsis.candidates.length === 1 ? ellipsis.candidates[0] : null;
  const { job, requirement } = jobOf(question, lang, typed);
  const isCountry = (s: string) => (typedCountriesOf(s, lang) ?? []).length > 0;
  const statedPeriod = statedPeriodOf(question, lang);
  const rest =
    statedPeriod === null
      ? question
      : question
          .replace(statedPeriod, ' ')
          .replace(lang === 'pl' ? PL_TIME_ONLY : EN_TIME_ONLY, '');
  return {
    lang,
    countries: typed,
    ellipsisTo,
    job,
    requirement,
    relationship: readBilateralRelationship(question, lang),
    /* CTO R4 — a plan's horizon ("90-day plan") is not a trip length or a conversation constraint */
    duration:
      readTemporalRoles(question, lang).some((t) => t.role === 'PLAN_HORIZON') ||
      /* CTO R4 third pass — a duration that MODIFIES a noun ("a four-day work week", "a 30-year
         mortgage", "czterodniowy tydzień pracy") is the subject, not the reader's time budget */
      attributiveDuration(question, lang)
        ? null
        : readDuration(question, lang),
    interests: readInterests(question, lang),
    options: readOptions(question, lang, isCountry),
    objective: readDecisionSupport(question, lang)?.objective ?? null,
    priorities: readPriorities(question, lang),
    officialOnly: readOfficialOnly(question, lang),
    statedPeriod,
    timeOnly: statedPeriod !== null && rest.replace(/[?!.…\s]+/gu, '').length === 0,
    placeOnly:
      job === 'CURRENT_REPORTING' &&
      deriveKnowledgeRequirement(question, lang, typed.length > 0).reason === 'a named place',
    words: wordCount(question),
  };
}

/** A turn that states only constraints/preferences ("I have five days and prefer nature."). */
/*
  A QUESTION is never "only a constraint": "What are the main sights of Rome if I only have three
  days?" states a duration AND asks — it is answered, never merely noted (blind eval B-054).
*/
const EN_QUESTION =
  /\?|^\s*(?:what|which|how|why|where|when|who|whom|whose|is|are|can|could|should|do|does|did|will|would|tell|give|list|show|suggest|recommend|explain|describe|compare)\b/i;
const PL_QUESTION = plTolerant(
  /\?|^\s*(?:jak\p{L}*|co|gdzie|kiedy|dlaczego|czemu|czy|któr\p{L}*|ile|kto|podaj|wymień|pokaż|poleć|doradź|wyjaśnij|opisz|porównaj)(?=\s|$)/iu,
);

export function isQuestion(text: string, lang: 'en' | 'pl'): boolean {
  return (lang === 'pl' ? PL_QUESTION : EN_QUESTION).test(text.trim());
}

/*
  CTO R4 THIRD PASS — ACTION OUTRANKS DURATION. A turn is "only a constraint" when it has the FORM
  of one: the reader speaking about themselves or their preferences ("I only have two days.",
  "We prefer nature.", "Only official sources.", "Mam tylko dwa dni.") or a short verbless
  fragment ("Five days, nature."). An imperative request ("Outline the arguments for a four-day
  work week.") is a request whose object happens to contain a duration — it is answered, never
  "noted". The request itself is read by the job reader's act families (user-job.ts).
*/
const EN_CONSTRAINT_FORM =
  /^\s*(?:(?:ok(?:ay)?|right|fine|also|and|but|so|actually|oh)[,.!]?\s+)*(?:i|i'm|i’m|i've|i’ve|i'd|i’d|we|we're|we’re|we've|we’ve|my|our|me|us|only|just|preferably|ideally|no\s+more\s+than|at\s+most|max(?:imum)?|under|within|budget|any|no|without|not)\b/i;
const PL_CONSTRAINT_FORM = plTolerant(
  /^\s*(?:(?:ok|dobrze|dobra|a|i|ale|właściwie)[,.!]?\s+)*(?:mam|mamy|chcę|chcemy|wolę|wolimy|preferuj\p{L}*|tylko|jedynie|budżet\p{L}*|nasz\p{L}*|mój|moja|moje|moim|ja|my|interesuj\p{L}*|lubię|lubimy|maksymalnie|najwyżej|bez|dowoln\p{L}*|każde|nie)(?=\s|$|[,.!])/iu,
);
const SHORT_FRAGMENT_WORDS = 4;

function hasConstraintForm(text: string, lang: 'en' | 'pl'): boolean {
  return (
    (lang === 'pl' ? PL_CONSTRAINT_FORM : EN_CONSTRAINT_FORM).test(text.trim()) ||
    wordCount(text) <= SHORT_FRAGMENT_WORDS
  );
}

/* a duration in attributive position: "four-day work week", "30-year mortgage", "3-month
   sabbatical"; a trip / stay noun after it keeps it a travel duration ("a 5-day trip") */
const EN_ATTRIBUTIVE_DURATION =
  /\b(?:\d{1,3}|[a-z]+)[-\s](?:day|week|month|year|hour|night|minute|decade|century)[-\s](?!(?:[a-z-]+\s+){0,2}(?:trip|trips|holiday|holidays|stay|visit|itinerary|vacation|safari|tour|break|getaway|journey|plan|roadmap|programme|program|schedule|sprint)\b)(?!(?:and|or|in|of|for|to|at|on|with|from|by)\b)[a-z]/i;
const EN_POSSESSIVE_DURATION = /\b(?:years|days|weeks|months)['’]\s+[a-z]/i;
const PL_ATTRIBUTIVE_DURATION = plTolerant(
  /(?:^|\s)\p{L}*(?:dniow|tygodniow|miesięczn|letni|roczn|godzinn)\p{L}*\s+(?!(?:\p{L}+\s+){0,2}(?:wycieczk|podróż|wyjazd|pobyt|urlop|wakacj|plan|harmonogram|program)\p{L}*)\p{L}/iu,
);

export function attributiveDuration(text: string, lang: 'en' | 'pl'): boolean {
  return lang === 'pl'
    ? PL_ATTRIBUTIVE_DURATION.test(text)
    : EN_ATTRIBUTIVE_DURATION.test(text) || EN_POSSESSIVE_DURATION.test(text);
}

function isConstraintStatement(f: TurnFeatures): boolean {
  return (
    f.job === 'UNKNOWN' &&
    (f.duration !== null ||
      f.interests.length > 0 ||
      f.priorities !== null ||
      f.officialOnly !== null)
  );
}

/*
  §4 — A JOB-LESS TURN CONTINUES A TRIP / DECISION / RELATIONSHIP ONLY IF IT POINTS BACK INTO IT.
  "What caused the First World War and how did it end?" is short and names no place, yet it is a
  new subject: carrying "Planning a trip to Rwanda" onto it would be inappropriate context carry.
  A job-less turn continues such a job only when it states a constraint, names an option, refers
  back to what is under discussion (instead, the same, both, which one, cheaper…), or uses the
  job's own vocabulary (a trip's cost, season, permits; a decision's criteria; a relation's goods).
  A bare "it" is not a reference back: a self-contained question uses it for its own subject.
*/
const EN_REFERS_BACK =
  /\b(?:instead|the\s+same|same\s+(?:trip|plan|one|for)|either|both|which\s+(?:one|is|are|of\s+them)|the\s+(?:other|former|latter)|the\s+(?:first|second)\s+(?:one|option|place|park|choice|plan)|those|these|them|compare|cheaper|more\s+expensive|better|closer|easier|re-?evaluate|what\s+else|anything\s+else)\b/i;
const PL_REFERS_BACK = plTolerant(
  /(?:zamiast|to\s+samo|tak\s+samo|oba|obie|obydwa|któr\p{L}*\s+(?:z\s+nich|jest|są)|porówn\p{L}*|tańsz\p{L}*|lepsz\p{L}*|bliżej|łatwiej|oceń\s+ponownie|co\s+jeszcze)/iu,
);
const EN_TRIP_VOCAB =
  /\b(?:cost|costs|price|prices|budget|cheap|expensive|afford\w*|days?|nights?|itinerary|route|hotels?|lodges?|stay|accommodation|camp(?:ing|s)?|visas?|weather|season|rainy|dry|best\s+time|when\s+to\s+go|get(?:ting)?\s+there|fly|flights?|drive|transport|permits?|safe|safety|pack|parks?|trek(?:king)?|hik(?:e|ing)|tours?|guides?|book(?:ing)?|travel\s+notices?)\b/i;
const PL_TRIP_VOCAB = plTolerant(
  /(?:koszt\p{L}*|cen\p{L}*|budżet\p{L}*|tani\p{L}*|drog\p{L}*|dni|noc\p{L}*|plan\s+podróży|tras\p{L}*|hotel\p{L}*|nocleg\p{L}*|wiz\p{L}*|pogod\p{L}*|sezon\p{L}*|kiedy\s+jechać|lot\p{L}*|transport\p{L}*|pozwoleni\p{L}*|bezpiecz\p{L}*|spakować|park\p{L}*|wędrów\p{L}*|wycieczk\p{L}*|przewodnik\p{L}*|rezerwac\p{L}*)/iu,
);
const EN_DECISION_VOCAB =
  /\b(?:criteria|criterion|trade-?offs?|weigh\w*|priorit\w*|objective|goal|risks?|growth|market\s+size|demand|costs?|returns?|conclusion|recommend\w*|evidence\s+(?:is\s+)?missing|what\s+would\s+change)\b/i;
const PL_DECISION_VOCAB = plTolerant(
  /(?:kryteri\p{L}*|kompromis\p{L}*|priorytet\p{L}*|cel\p{L}*|ryzyk\p{L}*|wzrost\p{L}*|wielkość\s+rynku|popyt\p{L}*|koszt\p{L}*|wniosek|wniosk\p{L}*|rekomend\p{L}*)/iu,
);

function pointsBackInto(job: UserJob, question: string, f: TurnFeatures): boolean {
  const lang = f.lang;
  if (isConstraintStatement(f) || f.options.length > 0 || f.ellipsisTo !== null || f.timeOnly)
    return true;
  if ((lang === 'pl' ? PL_REFERS_BACK : EN_REFERS_BACK).test(question)) return true;
  if ((lang === 'pl' ? PL_GENERIC_CURRENT : EN_GENERIC_CURRENT).test(question)) return true;
  switch (job) {
    case 'TRAVEL_PLANNING':
      return (lang === 'pl' ? PL_TRIP_VOCAB : EN_TRIP_VOCAB).test(question);
    case 'DECISION_SUPPORT':
    case 'COMPARISON':
      return (lang === 'pl' ? PL_DECISION_VOCAB : EN_DECISION_VOCAB).test(question);
    case 'RELATIONSHIP':
      return relationKindsIn(question).length > 0;
    default:
      /* current reporting / background / advice: the existing short-follow-up reading */
      return true;
  }
}

/** Jobs that a short, job-less turn may continue. */
const CONTINUABLE: ReadonlySet<UserJob> = new Set([
  'TRAVEL_PLANNING',
  'DECISION_SUPPORT',
  'COMPARISON',
  'ADVISORY',
  'PLACE_BACKGROUND',
  'CURRENT_REPORTING',
  'RELATIONSHIP',
]);

/**
 * Fold one turn into the state (§3 precedence). Returns the new state and its trace. The
 * composition decision is made by the caller from the PREVIOUS state and the turn's features.
 */
function applyTurn(
  prev: ConversationState,
  question: string,
  f: TurnFeatures,
): { state: ConversationState; trace: Omit<TurnStateTrace, 'composed'> } {
  const carried: StateField[] = [];
  const overridden: StateField[] = [];
  const isFollowUp =
    f.words <= MAX_FOLLOW_UP_WORDS &&
    CONTINUABLE.has(prev.job) &&
    ((f.job === 'UNKNOWN' && pointsBackInto(prev.job, question, f)) ||
      f.job === prev.job ||
      /* a short decision question inside a comparison / travel job continues it */
      (f.job === 'DECISION_SUPPORT' &&
        (prev.job === 'COMPARISON' || prev.job === 'TRAVEL_PLANNING')) ||
      /* "And in Kenya?" — an ellipsis is a continuation of whatever job is open */
      f.ellipsisTo !== null ||
      /* "What about yesterday?" — a time shift continues the open job */
      f.timeOnly ||
      /* a trip follow-up read as "news" only because it names a place ("Which is cheaper to stay
         in, Hanoi or Ho Chi Minh City?", "A może zamiast tego Słowenia?") continues the trip
         when it points back into it */
      (prev.job === 'TRAVEL_PLANNING' &&
        f.placeOnly &&
        f.countries.length === 1 &&
        pointsBackInto(prev.job, question, f)) ||
      /* a short place-free current reading inside a trip / relationship ("anything current?") */
      ((prev.job === 'TRAVEL_PLANNING' || prev.job === 'RELATIONSHIP') &&
        f.job === 'CURRENT_REPORTING' &&
        f.countries.length === 0));

  /* thread-level evidence constraint (§23): survives a new job, changed only explicitly */
  const officialSourcesOnly = f.officialOnly ?? prev.officialSourcesOnly;
  if (f.officialOnly !== null && f.officialOnly !== prev.officialSourcesOnly)
    overridden.push('officialSourcesOnly');
  else if (prev.officialSourcesOnly) carried.push('officialSourcesOnly');

  if (!isFollowUp) {
    /* a new, self-contained job: job-scoped context resets (§4) */
    const reset = prev.job !== 'UNKNOWN';
    return {
      state: {
        ...EMPTY(f.lang),
        job: f.job,
        geography: f.countries,
        comparisonSet: f.countries.length >= 2 ? f.countries : [],
        options: f.options,
        duration: f.duration,
        interests: f.interests,
        decisionObjective: f.objective,
        priorities: f.priorities,
        officialSourcesOnly,
        relationship: f.relationship,
        period: f.statedPeriod,
        anchorQuestion: question,
      },
      trace: { job: f.job, ownJob: f.job, carried, overridden, reset },
    };
  }

  /* 1–2 · explicit place: a new single country replaces the place; options were scoped to it */
  const newPlace =
    f.ellipsisTo ??
    (f.countries.length === 1 && !prev.geography.includes(f.countries[0]) ? f.countries[0] : null);
  let geography = prev.geography;
  let comparisonSet = prev.comparisonSet;
  let options = prev.options;
  let relationship = prev.relationship;
  if (f.relationship !== null) {
    relationship = f.relationship;
    geography = [...f.relationship.countries];
    if (prev.relationship !== null) overridden.push('relationship');
  } else if (f.countries.length >= 2) {
    geography = f.countries;
    comparisonSet = f.countries;
    overridden.push('geography', 'comparisonSet');
  } else if (newPlace !== null) {
    geography = [newPlace];
    comparisonSet = [...new Set([...prev.comparisonSet, ...prev.geography, newPlace])];
    options = [];
    /* a new place leaves the two-sided relationship: it no longer describes this question */
    relationship = null;
    overridden.push('geography');
    if (prev.options.length > 0) overridden.push('options');
  } else if (prev.geography.length > 0) carried.push('geography');
  if (relationship !== null && f.relationship === null && newPlace === null)
    carried.push('relationship');
  if (f.options.length > 0) {
    /* "What about Nyungwe instead?" replaces; "Compare Nyungwe and Volcanoes" sets both */
    options = f.options.length >= 2 ? f.options : [...new Set([...f.options, ...options])];
    if (prev.options.length > 0) overridden.push('options');
  } else if (options.length > 0 && newPlace === null) carried.push('options');

  const pick = <T>(own: T | null, old: T, field: StateField): T => {
    if (own !== null && own !== old) {
      if (old !== null) overridden.push(field);
      return own;
    }
    if (old !== null) carried.push(field);
    return old;
  };
  const duration = pick(f.duration, prev.duration, 'duration');
  const decisionObjective = pick(f.objective, prev.decisionObjective, 'decisionObjective');
  const priorities = pick(f.priorities, prev.priorities, 'priorities');
  const period = pick(f.statedPeriod, prev.period, 'period');
  let interests = prev.interests;
  if (f.interests.length > 0) {
    interests = f.interests;
    if (prev.interests.length > 0) overridden.push('interests');
  } else if (prev.interests.length > 0) carried.push('interests');
  /* the subject of a short placeless follow-up ("And the economy?") — a time shift keeps it */
  const ownTopic =
    f.job === 'UNKNOWN' &&
    !f.timeOnly &&
    f.ellipsisTo === null &&
    f.countries.length === 0 &&
    !isConstraintStatement(f)
      ? question
      : null;
  const topicFollowUp = pick(ownTopic, prev.topicFollowUp, 'topic');

  const job: UserJob =
    f.job === 'DECISION_SUPPORT' && prev.job === 'COMPARISON' ? 'DECISION_SUPPORT' : prev.job;
  carried.unshift('job');
  if (comparisonSet.length > 0 && !overridden.includes('comparisonSet'))
    carried.push('comparisonSet');
  return {
    state: {
      job,
      language: f.lang,
      geography,
      comparisonSet,
      options,
      duration,
      interests,
      decisionObjective,
      priorities,
      officialSourcesOnly,
      relationship,
      topicFollowUp,
      period,
      anchorQuestion: prev.anchorQuestion,
      portableSubject: prev.portableSubject,
    },
    trace: { job, ownJob: f.job, carried, overridden, reset: false },
  };
}

/* ── composition: the question the one engine answers ─────────────────────────────────────── */
const EN_GENERIC_CURRENT =
  /^\s*(?:is\s+there\s+)?(?:anything|what(?:'s|\s+is)?)\s+(?:current|new|recent|happening|going\s+on)\b|\b(?:anything|what)\b.*\bshould\s+i\s+know\b.*\b(?:now|currently|current|right\s+now|today)\b|\bshould\s+i\s+know\b.*\b(?:now|current(?:ly)?)\b|^\s*(?:is\s+there\s+)?anything\s+current\b/i;
const PL_GENERIC_CURRENT = plTolerant(
  /(?:czy\s+jest\s+coś|coś)\s+(?:aktualn\p{L}*|nowego|bieżąc\p{L}*)|co\s+(?:aktualnie|teraz|obecnie)\s+powinienem\s+wiedzieć/iu,
);
const COMPARE = /\bcompar|porówn/iu;
const RE_EVALUATE = /^\s*re-?evaluate\b|^\s*oceń\s+ponownie\b/iu;

function placeName(
  iso3: string,
  lang: 'en' | 'pl',
  grammaticalCase: 'nom' | 'gen' | 'loc',
): string | null {
  const country = findCountryByIso3(iso3);
  if (country === undefined) return null;
  if (lang === 'en') return country.name;
  const nom = getLocalizedCountryName(country.iso2, 'pl');
  if (!nom) return null;
  if (grammaticalCase === 'nom') return nom;
  const cases = plCases(nom);
  return cases ? cases[grammaticalCase] : null;
}

function listJoin(items: readonly string[], lang: 'en' | 'pl', conj: 'and' | 'or'): string {
  if (items.length <= 1) return items.join('');
  const word = lang === 'pl' ? (conj === 'and' ? 'i' : 'czy') : conj;
  return `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
}

function constraintsText(state: ConversationState, lang: 'en' | 'pl'): string {
  const parts: string[] = [];
  if (state.duration !== null) parts.push(state.duration);
  if (state.interests.length > 0)
    parts.push(`${lang === 'pl' ? 'zainteresowania' : 'interests'}: ${state.interests.join(', ')}`);
  return parts.length === 0 ? '' : ` (${parts.join('; ')})`;
}

const stripEnd = (s: string) => s.replace(/[?.!…\s]+$/u, '');

/** The travel composition: "Planning a trip to Rwanda (5 days; interests: nature): …". */
function composeTravel(
  question: string,
  state: ConversationState,
  f: TurnFeatures,
  prevOptions: readonly string[],
): string | null {
  const lang = f.lang;
  const places = state.geography;
  if (places.length === 0) return null;
  /* "Compare the same five-day nature trip" after a place change compares the places */
  const comparing =
    COMPARE.test(question) && f.options.length === 0 && state.comparisonSet.length >= 2;
  const members = comparing ? state.comparisonSet : places;
  const names = members.map((iso3) => placeName(iso3, lang, lang === 'pl' ? 'gen' : 'nom'));
  if (names.some((n) => n === null)) return null;
  const where = listJoin(names as string[], lang, 'and');
  let body = question.trim();
  if ((lang === 'pl' ? PL_GENERIC_CURRENT : EN_GENERIC_CURRENT).test(body)) {
    /* a generic "anything current?" in a trip is a request for TRAVEL notices (§8), never a
       country news digest; the rewrite is disclosed on the answer */
    body =
      lang === 'pl'
        ? 'jakie aktualne komunikaty dla podróżnych powinienem znać?'
        : 'what current travel notices should I know about?';
  } else if (f.ellipsisTo !== null) {
    /* "And in Kenya?" inside a trip: the same trip, the new place */
    body =
      lang === 'pl'
        ? 'jakie miejsca warto odwiedzić i jak zaplanować pobyt?'
        : 'which places should I visit, and how would I plan it?';
  } else if (isConstraintStatement(f) && !COMPARE.test(body)) {
    body =
      lang === 'pl'
        ? `${stripEnd(body)} — jak najlepiej to zaplanować?`
        : `${stripEnd(body)} — how should I plan it?`;
  } else if (
    f.options.length === 0 &&
    prevOptions.length >= 2 &&
    /\b(?:which|what)\b.*\b(?:cheaper|better|closer|easier|best|more|less|quicker|nicer)\b|(?:któr\p{L}*|co)\s.*(?:tańsz|lepsz|bliżej|łatwiej|najlepsz)/iu.test(
      body,
    )
  ) {
    /* "Which is cheaper?" — the options under discussion are its members */
    body = `${stripEnd(body)} — ${listJoin(prevOptions, lang, 'or')}?`;
  }
  const frame =
    lang === 'pl'
      ? `Planuję podróż do ${where}${constraintsText(state, lang)}`
      : `Planning a trip to ${where}${constraintsText(state, lang)}`;
  return `${frame}: ${body}`;
}

/** Decision support over a carried comparison set: "Comparing Kenya and Rwanda: … for X?". */
function composeDecision(
  question: string,
  state: ConversationState,
  f: TurnFeatures,
): string | null {
  const lang = f.lang;
  const set = state.comparisonSet.length >= 2 ? state.comparisonSet : [];
  if (set.length < 2 || f.countries.length > 0) return null;
  const names = set.map((iso3) => placeName(iso3, lang, 'nom'));
  if (names.some((n) => n === null)) return null;
  const members = listJoin(names as string[], lang, 'and');
  const objective = state.decisionObjective;
  const weighting =
    state.priorities === null
      ? ''
      : lang === 'pl'
        ? ` (priorytety: ${state.priorities})`
        : ` (priorities: ${state.priorities})`;
  const frame =
    lang === 'pl' ? `Porównanie: ${members}${weighting}` : `Comparing ${members}${weighting}`;
  let body = question.trim();
  if ((f.priorities !== null && f.job === 'UNKNOWN') || RE_EVALUATE.test(body)) {
    /* a stated weighting, or "Re-evaluate.": the same decision, re-weighed (§13) */
    body =
      lang === 'pl'
        ? `która opcja jest najlepsza${objective === null ? '' : ` dla: ${objective}`} przy tych priorytetach?`
        : `which is the strongest choice${objective === null ? '' : ` for ${objective}`}, given these priorities?`;
  } else if (f.objective === null && objective !== null) {
    /* the objective the reader already stated carries to a new decision question */
    body =
      lang === 'pl'
        ? `${stripEnd(body)} — dla: ${objective}?`
        : `${stripEnd(body)} — for ${objective}?`;
  }
  return `${frame}: ${body}`;
}

/** The relationship composition: "Between Rwanda and Tanzania (border, trade): …" (EN only). */
function composeRelationship(
  question: string,
  state: ConversationState,
  f: TurnFeatures,
): string | null {
  const rel = state.relationship;
  /* Polish needs the instrumental ("między Rwandą a Tanzanią"), not generated here: fail closed */
  if (rel === null || f.lang !== 'en' || f.countries.length > 0 || f.relationship !== null)
    return null;
  const a = placeName(rel.countries[0], 'en', 'nom');
  const b = placeName(rel.countries[1], 'en', 'nom');
  if (a === null || b === null) return null;
  const relations = rel.relations.filter((r) => r !== 'GENERAL').map((r) => r.toLowerCase());
  const detail = [rel.corridor, ...relations].filter((x): x is string => x !== null);
  return `Between ${a} and ${b}${detail.length > 0 ? ` (${detail.join(', ')})` : ''}: ${question.trim()}`;
}

/** "And in Kenya?" after "And the economy?" / "What about yesterday?" — the carried subject. */
function composeCarriedTopic(
  question: string,
  prev: ConversationState,
  f: TurnFeatures,
): string | null {
  if (f.ellipsisTo === null || prev.topicFollowUp === null) return null;
  const to = findCountryByIso3(f.ellipsisTo);
  if (to === undefined || prev.geography.includes(to.iso3)) return null;
  const based = attach(prev.topicFollowUp, to, f.lang);
  if (based === null) return null;
  const own = splitTime(question.trim(), f.lang).period;
  return withNewPeriod(based, f.lang, own ?? prev.period);
}

/*
  CTO R3 LIVE DEFECT L-2 — ONE REDUCER FOR REPLAY AND THE LIVE TURN.

  Live Alpha 8f44abd: "What is happening with Madagascar's economy?" → "And in Kenya?" was composed
  as "What is happening with Kenya's economy?", but the NEXT turn rebuilt state from the reader's
  raw questions: "And in Kenya?" carries no topic of its own, so "What about yesterday?" kept Kenya +
  yesterday and lost the economy (general Kenya reporting).

  `step` is now the ONE reducer. Every earlier turn is replayed through it exactly as it was
  interpreted when it was asked (composition included), and it maintains the PORTABLE SUBJECT: the
  deterministic question the turn meant, built only from the reader's own words (an earlier
  subject + a new explicit place / time) — never from an AI answer.

    a time-only turn ("What about yesterday?")  → the portable subject with the new period
    a new single place ("And in Tanzania?")     → the portable subject retargeted to it; its stated
                                                  period carries (the existing time rule)
    a self-contained new question               → a new subject (no stale carry)
    a constraint-only turn                       → the subject is unchanged
*/
/*
  A turn that names its OWN subject — a proper name that is not a country ("Who was Napoleon?") —
  is self-contained: it never inherits the conversation's subject or place as part of its meaning.
*/
function namesOwnSubject(question: string): boolean {
  const words = question.trim().split(/\s+/u).slice(1);
  return words.some((w) => {
    const token = w.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
    if (!/^\p{Lu}\p{Ll}/u.test(token)) return false;
    /* exact country identifiers only (a gazetteer town such as Napoleon, Ohio is not a country) */
    return (
      resolveCountryByAnyIdentifier(token) === undefined &&
      resolvePolishCountry(token) === undefined
    );
  });
}

function placelessSubject(question: string, prev: ConversationState, f: TurnFeatures): string {
  /* "And the economy?" in a Madagascar conversation means the economy in Madagascar */
  if (
    f.countries.length > 0 ||
    prev.geography.length !== 1 ||
    f.words > MAX_FOLLOW_UP_WORDS ||
    namesOwnSubject(question)
  )
    return question;
  const place = findCountryByIso3(prev.geography[0]);
  return (place === undefined ? null : attach(question, place, f.lang)) ?? question;
}

function step(
  prev: ConversationState,
  question: string,
  lang: 'en' | 'pl',
  earlierNewestFirst: readonly EarlierTurnText[],
  hasOwnContext: boolean,
): ConversationalTurn {
  const f = readTurn(question, lang);
  const applied = applyTurn(prev, question, f);
  /*
    R4 ALPHA R-5 — a turn about the ASSISTANT'S earlier answer ("Is it still true now?", "Why did you
    say that?") is resolved by the router against that answer (prior work, R-3), never by wrapping it
    in the reader's earlier subject: "Between India and China (trade): Is it still true now?" no
    longer has the claim-validity form, so the earlier claim was never re-examined.
  */
  const aboutEarlierAnswer =
    readClaimValidity(question, lang) ||
    referencesOwnPriorStatement(question, lang) ||
    readCausalSelfAttribution(question, lang);
  const continues =
    !applied.trace.reset && applied.trace.carried.includes('job') && !aboutEarlierAnswer;
  const constraintOnly =
    isConstraintStatement(f) &&
    f.countries.length === 0 &&
    !isQuestion(question, lang) &&
    /* CTO R4 — an imperative work request ("Turn that into a 90-day plan.") is never merely noted */
    readTransformation(question, lang) === null &&
    /* CTO R4 third pass — an imperative request is never merely noted, and a constraint has the
       form of one (the reader about themselves / a short fragment) */
    readRequestAct(question, lang) === null &&
    hasConstraintForm(question, lang);
  const from = prev.anchorQuestion ?? earlierNewestFirst[0]?.question ?? question;

  const decide = (): {
    composition: ConversationalComposition | null;
    job: UserJob;
  } => {
    if (hasOwnContext) return { composition: null, job: applied.state.job };
    const jobContext = (composed: string | null, job: UserJob = applied.state.job) =>
      composed === null
        ? null
        : {
            composition: {
              effectiveQuestion: composed,
              fromQuestion: from,
              kind: 'JOB_CONTEXT' as const,
            },
            job,
          };
    if (continues) {
      /* TRAVEL_PLANNING — short follow-ups the router cannot read alone */
      if (applied.state.job === 'TRAVEL_PLANNING') {
        const t = jobContext(composeTravel(question, applied.state, f, prev.options));
        if (t !== null) return t;
      }
      /* DECISION_SUPPORT over a comparison the reader already made (§12–§13) */
      if (
        (applied.state.job === 'DECISION_SUPPORT' || applied.state.job === 'COMPARISON') &&
        (f.job === 'DECISION_SUPPORT' || f.priorities !== null || RE_EVALUATE.test(question))
      ) {
        const t = jobContext(composeDecision(question, applied.state, f), 'DECISION_SUPPORT');
        if (t !== null) return t;
      }
      /* RELATIONSHIP — the bilateral scope carries ("What goods are affected?") (§14) */
      if (applied.state.job === 'RELATIONSHIP') {
        const t = jobContext(composeRelationship(question, applied.state, f));
        if (t !== null) return t;
      }
      /* L-2 — a time shift keeps the portable subject and applies the new period */
      if (f.timeOnly && prev.portableSubject !== null && f.statedPeriod !== null) {
        return {
          composition: {
            effectiveQuestion: withNewPeriod(prev.portableSubject, lang, f.statedPeriod),
            fromQuestion: from,
            kind: 'JOB_CONTEXT',
          },
          job: applied.state.job,
        };
      }
      /* L-2 — a new single place takes the portable subject with it (its period carries) */
      if (
        f.ellipsisTo !== null &&
        prev.portableSubject !== null &&
        prev.geography.length === 1 &&
        prev.geography[0] !== f.ellipsisTo
      ) {
        const fromPlace = findCountryByIso3(prev.geography[0]);
        const toPlace = findCountryByIso3(f.ellipsisTo);
        const moved =
          fromPlace === undefined || toPlace === undefined
            ? null
            : retarget(prev.portableSubject, fromPlace, toPlace, lang);
        if (moved !== null) {
          const own = splitTime(question.trim(), lang).period;
          return {
            composition: {
              effectiveQuestion: own === null ? moved : withNewPeriod(moved, lang, own),
              fromQuestion: from,
              kind: 'CROSS_COUNTRY',
            },
            job: applied.state.job,
          };
        }
      }
    }
    /* CTO checkpoint 5 §5 — the existing cross-country continuation */
    const cross = composeCrossCountryContinuation(question, lang, earlierNewestFirst);
    if (cross !== null)
      return {
        composition: {
          effectiveQuestion: cross.effectiveQuestion,
          fromQuestion: cross.fromQuestion,
          kind: 'CROSS_COUNTRY',
        },
        job: applied.state.job,
      };
    /* R3 §3 / PO-06 — a carried subject from a placeless follow-up chain, to the new place */
    if (continues && applied.state.job === 'CURRENT_REPORTING') {
      const carried = composeCarriedTopic(question, prev, f);
      if (carried !== null)
        return {
          composition: { effectiveQuestion: carried, fromQuestion: from, kind: 'CROSS_COUNTRY' },
          job: applied.state.job,
        };
    }
    return { composition: null, job: applied.state.job };
  };

  const { composition, job } = decide();
  const portableSubject = constraintOnly
    ? prev.portableSubject
    : composition !== null
      ? composition.effectiveQuestion
      : !continues
        ? question
        : f.timeOnly
          ? prev.portableSubject
          : applied.state.job === 'CURRENT_REPORTING'
            ? placelessSubject(question, prev, f)
            : question;
  const state: ConversationState = { ...applied.state, job, portableSubject };
  return {
    composition,
    state,
    constraintOnly: composition === null && constraintOnly,
    trace: {
      ...applied.trace,
      job,
      composed: composition?.kind ?? null,
      subject: portableSubject,
    },
  };
}

/**
 * Fold the reader's earlier questions (newest first, EXCLUDING this turn) through the same reducer
 * that interprets this turn, then decide this turn. `hasOwnContext`: the turn carries a story /
 * module / selection context — never composed.
 */
/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLAUDE F · R4 — THE BOUNDED CONTAINER FOR THE INTERPRETER-FIRST DISPLAY LANGUAGES
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `readConversationalTurn` returns `null` for `fr / de / es / pt / ar` (`asLang` admits en and pl
 * only), and that is CORRECT: its field readers are EN/PL grammar and running them on French would
 * be the defect the seven-language ruling forbids. But the consequence measured at 782b175 went
 * further than it needed to. With no conversation state at all, `semantic-first.ts` computes
 * `boundedStateHasWork === false`, so `PRIOR_WORK_REFERENCE` never enters `unresolvedFields` — the
 * one bounded interpreter call is never asked to resolve a reference — and the composition then
 * forces `discourseReference` back to `'NONE'` even if a verdict had named one. Five of the seven
 * display languages could not reference their own earlier work at all, and no interpreter, however
 * good, could have changed that.
 *
 * The missing piece is not a reader. It is the CONTAINER: which artifact this conversation holds,
 * which turn produced it, what options the reader named, and how many turns in we are. None of that
 * is grammar — the artifact's own `kind`, `label` and `components` were produced by the answer, not
 * parsed out of the reader's words.
 *
 * So this builds the container and NOTHING ELSE. No `composition` (no effective-question
 * rewriting), no geography, no comparison set, no duration, no interests, no priorities, no
 * relationship, no portable subject inference — every field that would require reading the
 * reader's language stays empty, and `EMPTY_FOR_DISPLAY_LANGUAGE` is what it is called so that
 * nobody later "completes" it. The EN/PL readers are not applied, and this function cannot apply
 * them: it never calls `step`.
 */
export const INTERPRETER_FIRST_DISPLAY_LANGUAGES: readonly string[] = Object.freeze([
  'fr',
  'de',
  'es',
  'pt',
  'ar',
]);

/** The container handed to routing. Structurally the `BoundedConversationState` the composition
 *  already reads, plus the source turn an artifact reference must be traceable to. */
export interface BoundedConversationContainer {
  readonly artifact?: { readonly kind: string; readonly label: string };
  /** CLAUDE F · R4 — WHICH TURN produced that artifact. Required for a traceable reference. */
  readonly artifactSourceOperationId?: string;
  readonly artifacts: readonly PriorArtifact[];
  readonly choiceSet?: readonly string[];
  readonly turnIndex: number;
  /** the reader's own earlier question, when there is one (never rewritten, never translated) */
  readonly priorQuestion?: string;
}

/**
 * The bounded container for a display language whose meaning is read by the interpreter.
 *
 * Returns `null` for `en` / `pl` — not because they have no container, but because they already
 * have `readConversationalTurn`, and two code paths producing a state for one language is how the
 * two of them come to disagree.
 */
export function readInterpreterFirstContainer(
  language: string,
  earlierNewestFirst: readonly EarlierTurnText[],
  artifactsNewestFirst: readonly PriorArtifact[] = [],
): BoundedConversationContainer | null {
  if (!INTERPRETER_FIRST_DISPLAY_LANGUAGES.includes(language)) return null;
  /* same-language turns only — a switch of language is a new reading, exactly as for EN/PL */
  const window = earlierNewestFirst.slice(0, STATE_LOOKBACK).filter((t) => t.language === language);
  const newest = artifactsNewestFirst[0];
  return Object.freeze({
    ...(newest === undefined
      ? {}
      : {
          artifact: { kind: newest.kind, label: newest.label },
          artifactSourceOperationId: newest.sourceOperationId,
        }),
    artifacts: Object.freeze([...artifactsNewestFirst]),
    turnIndex: window.length,
    ...(window.length === 0 ? {} : { priorQuestion: window[0].question }),
  });
}

export function readConversationalTurn(
  question: string,
  language: string,
  earlierNewestFirst: readonly EarlierTurnText[],
  options: { readonly hasOwnContext?: boolean } = {},
): ConversationalTurn | null {
  const lang = asLang(language);
  if (lang === null) return null;
  /* same-language turns only (a switch of language is a new reading), newest first */
  const window = earlierNewestFirst.slice(0, STATE_LOOKBACK).filter((t) => t.language === lang);
  let state = EMPTY(lang);
  for (let i = window.length - 1; i >= 0; i--)
    state = step(state, window[i].question, lang, window.slice(i + 1), false).state;
  const turn = step(state, question, lang, window, options.hasOwnContext === true);
  /* bounded objective memory: the reader's own words, oldest → newest, the newest objective wins */
  const readerTurns = [...window.map((t) => t.question).reverse(), question];
  const objective = conversationObjectiveState(readerTurns, lang);
  /* the newest set of options the reader named (their words, bounded) */
  let choiceSet: string[] = [];
  for (let i = readerTurns.length - 1; i >= 0 && choiceSet.length === 0; i--)
    choiceSet = readChoiceSet(readerTurns[i], lang);
  return {
    ...turn,
    ...(objective === null ? {} : { objective: { ...objective, text: objective.criterion } }),
    ...(choiceSet.length === 0 ? {} : { choiceSet }),
    turnIndex: readerTurns.length - 1,
  };
}
