/**
 * PUBLIC BETA HARDENING R1B — BROAD GLOBAL NEWS / HEADLINES.
 *
 * "Any global news can you share?" is a request for the current headlines, not a topic search
 * whose subject is "global news". Sent to free-text search it can only match the literal words,
 * and the retained rescue (a term net over those words) finds nothing for the same reason —
 * Production 2026-10-01, GNews rate-limited → INSUFFICIENT.
 *
 * THE DECISION IS A CLOSED VOCABULARY, NOT A CLASSIFIER. Every word of the question must belong
 * to a small, fixed list of function words, news nouns and breadth / recency markers, AND the
 * question must contain at least one news noun and at least one breadth / recency marker. The
 * list contains no place, organisation, person, topic, source, publisher, comparison or period
 * word, so any question naming one ("What's happening with NATO?", "Latest news about Kenya",
 * "Latest ECB interest-rate news", "… in eastern DRC", "… the Dubai–Israel flight") cannot
 * qualify — nothing has to be detected for it to be excluded. Conversation context, deep /
 * report intent and stated periods are excluded by the caller (ask-r2-route.ts).
 */

/** Lower-case, strip diacritics and apostrophes ("what's" → "whats", "świecie" → "swiecie"). */
function wordsOf(question: string): string[] {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ł/g, 'l')
    .replace(/['’`]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

interface Vocabulary {
  /** The news nouns — at least one is required. */
  readonly news: ReadonlySet<string>;
  /** Breadth (world / global) or ranking / recency (top, latest, today) — at least one. */
  readonly markers: ReadonlySet<string>;
  /** Function words that carry no subject. */
  readonly function: ReadonlySet<string>;
}

const EN: Vocabulary = {
  news: new Set([
    'news',
    'headline',
    'headlines',
    'story',
    'stories',
    'events',
    'developments',
    'updates',
    'happening',
    'happened',
    'going',
  ]),
  markers: new Set([
    'global',
    'world',
    'worlds',
    'worldwide',
    'international',
    'top',
    'main',
    'biggest',
    'major',
    'key',
    'important',
    'breaking',
    'latest',
    'today',
    'todays',
    'tonight',
    'current',
  ]),
  function: new Set([
    'any',
    'some',
    'the',
    'a',
    'an',
    'me',
    'us',
    'give',
    'show',
    'tell',
    'share',
    'can',
    'could',
    'would',
    'you',
    'please',
    'what',
    'whats',
    'which',
    'is',
    'are',
    'was',
    'were',
    'there',
    'on',
    'in',
    'of',
    'from',
    'around',
    'across',
    'to',
    'for',
    'i',
    'want',
    'need',
    'know',
    'hear',
    'right',
    'now',
    'so',
    'far',
    'has',
    'have',
    'been',
    'this',
    'morning',
    'currently',
    'recent',
    'newest',
    'big',
  ]),
};

const PL: Vocabulary = {
  news: new Set([
    'wiadomosci',
    'wiadomosc',
    'informacje',
    'informacji',
    'newsy',
    'naglowki',
    'naglowkow',
    'wydarzenia',
    'wydarzen',
    'aktualnosci',
    'dzieje',
    'tematy',
  ]),
  markers: new Set([
    'swiecie',
    'swiata',
    'swiatowe',
    'swiatowych',
    'globalne',
    'globalnych',
    'miedzynarodowe',
    'miedzynarodowych',
    'najwazniejsze',
    'najwazniejszych',
    'glowne',
    'glownych',
    'najnowsze',
    'najnowszych',
    'najswiezsze',
    'dzis',
    'dzisiaj',
    'dzisiejsze',
    'dzisiejszych',
    'aktualne',
  ]),
  function: new Set([
    'co',
    'sie',
    'na',
    'w',
    'we',
    'z',
    'ze',
    'jakie',
    'jaki',
    'sa',
    'czy',
    'masz',
    'mozesz',
    'podaj',
    'podac',
    'pokaz',
    'pokazac',
    'powiedz',
    'mi',
    'prosze',
    'jakies',
    'jakis',
    'teraz',
    'obecnie',
    'sa',
  ]),
};

/** A longer sentence is not an open-ended headlines request; it is left to the normal path. */
const MAX_WORDS = 14;

export function isBroadGlobalHeadlinesQuestion(question: string, language: string): boolean {
  const vocabulary = language === 'en' ? EN : language === 'pl' ? PL : undefined;
  if (vocabulary === undefined) return false;
  const words = wordsOf(question);
  if (words.length === 0 || words.length > MAX_WORDS) return false;
  let news = false;
  let marker = false;
  for (const word of words) {
    if (vocabulary.news.has(word)) news = true;
    else if (vocabulary.markers.has(word)) marker = true;
    else if (!vocabulary.function.has(word)) return false;
  }
  return news && marker;
}
