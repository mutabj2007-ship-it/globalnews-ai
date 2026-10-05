import {
  DEMONYM_SOURCE,
  normalizeAskQuestion,
  type LanguageCode,
} from '../../ask-router/normalization/qualified-reading';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — THE CONVERSATION'S PLACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Reproduced on the Production router (Tranche 0): after "What is going on in Madagascar?",
 * "And the economy?" and "What about yesterday?" lost Madagascar — neither is recognised by the
 * anaphor detectors, so no prior question reached the turn and its geography axis was empty
 * ("What about yesterday?" was then refused as CAPABILITY_UNAVAILABLE).
 *
 * The conversation's place is explicit state, derived from the reader's OWN earlier questions in
 * this owner-verified thread (never an AI answer, never another thread):
 *
 *   - a turn that types a place of its own always wins (Iran → "What about Madagascar?" switches);
 *   - a turn that types none continues the nearest earlier turn that typed exactly one country;
 *   - an earlier turn that typed several countries (a comparison) is not one place: nothing is
 *     inherited, rather than silently picking a side;
 *   - a long, self-contained question is a new topic, not a continuation.
 *
 * The result travels as the existing GEOGRAPHY context (the weakest inherited rung, exactly like
 * a Map country), so frozen C's eligibility rules still decide whether it applies: a stable
 * named-subject question ("How does photosynthesis work?") suppresses it. Pure: no I/O.
 */

/** A continuation is short; a long question that names no place is its own topic. */
export const MAX_CONTINUATION_WORDS = 12;
/** How far back the conversation's place is looked for (matches the anchor lookback). */
export const PLACE_LOOKBACK = 10;

export interface EarlierTurn {
  readonly question: string;
  readonly language: string;
}

const READABLE: readonly LanguageCode[] = ['en', 'pl'];

function asLanguage(language: string): LanguageCode | null {
  return (READABLE as readonly string[]).includes(language) ? (language as LanguageCode) : null;
}

const fold = (value: string): string =>
  ` ${value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

/**
 * The countries (ISO3) the reader TYPED in this question — the router's own reading, with the
 * same named-place test (its words appear in the question). Demonyms ("Rwandan") are entity
 * geography, not a typed place, and do not count. Null when the question cannot be read.
 */
export function typedCountriesOf(question: string, language: string): readonly string[] | null {
  const lang = asLanguage(language);
  if (lang === null) return null;
  const outcome = normalizeAskQuestion({
    originalQuestion: question,
    sourceLanguage: lang,
    normalizationLanguage: lang,
    displayLanguage: lang,
    origin: 'ASK',
  });
  if (outcome.status === 'NOT_READ') return null;
  const folded = fold(question);
  const codes = outcome.reading.geography
    .filter(
      (g) =>
        g.provenance !== 'SUPPLIED_BY_SURFACE' &&
        g.source !== DEMONYM_SOURCE &&
        (g.matchedText === undefined || folded.includes(fold(g.matchedText))),
    )
    .map((g) => g.value);
  return [...new Set(codes)];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * The ISO3 country this turn continues, or null. `earlierNewestFirst` are the reader's previous
 * questions in this thread, newest first, EXCLUDING this turn.
 */
export function inheritedConversationCountry(
  question: string,
  language: string,
  earlierNewestFirst: readonly EarlierTurn[],
): string | null {
  if (earlierNewestFirst.length === 0) return null;
  const own = typedCountriesOf(question, language);
  /* Unreadable, or the reader named a place (or a contested one) of their own: never inherit. */
  if (own === null || own.length > 0) return null;
  if (wordCount(question) > MAX_CONTINUATION_WORDS) return null;

  for (const turn of earlierNewestFirst.slice(0, PLACE_LOOKBACK)) {
    const typed = typedCountriesOf(turn.question, turn.language);
    if (typed === null || typed.length === 0) continue;
    if (typed.length > 1 || typed[0] === 'CONTESTED') return null;
    return typed[0] ?? null;
  }
  return null;
}

/**
 * R4 ALPHA SMOKE R2 (CTO) — the conversation's place follows the SAME authority as "that / it"
 * (R1-B): when the latest valid answer record exists, the place is that record's own scope.
 *
 *   - the record carries one country      → that country continues;
 *   - it carries several (a relationship) → no single place: the two-sided scope already travels
 *     with the record itself (execution-contract.ts, scopedRelationship), never as one country;
 *   - it carries none                     → no place. The reader's older questions are NOT walked
 *     for geography: live Alpha op a812ea97 ("Show me the official evidence." after a central-bank
 *     chain) walked past three turns to an older Chile question.
 *
 * Without a record (the thread has none, or the latest turn answered nothing) the reader's own
 * questions are read exactly as before. The same gates apply first: a typed place of its own wins,
 * a long question is its own topic.
 */
export function conversationPlaceOf(
  question: string,
  language: string,
  earlierNewestFirst: readonly EarlierTurn[],
  record?: { readonly scope?: { readonly countries: readonly string[] } },
): string | null {
  const scope = record?.scope;
  if (scope === undefined)
    return inheritedConversationCountry(question, language, earlierNewestFirst);
  if (earlierNewestFirst.length === 0) return null;
  const own = typedCountriesOf(question, language);
  if (own === null || own.length > 0) return null;
  if (wordCount(question) > MAX_CONTINUATION_WORDS) return null;
  const [only, ...more] = scope.countries;
  return only === undefined || more.length > 0 || only === 'CONTESTED' ? null : only;
}
