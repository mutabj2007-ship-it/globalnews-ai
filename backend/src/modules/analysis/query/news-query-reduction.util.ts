/**
 * ════════════════════════════════════════════════════════════════════════════
 * A1 · BOUNDED REDUCTION OF A LONG QUESTION TO A PROVIDER QUERY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED AT ALPHA `9aab213`, OFFLINE, THROUGH THE REAL QUERY AUTHORITY.
 * The Product Owner asked (verbatim, recovered from live operation
 * `3a3eb693-a669-4609-b912-e17483fd6124`, 2026-10-10T08:09:42Z):
 *
 *   "What are the latest verified developments in eastern DR Congo over the
 *    last seven days? Give the original sources, publication dates, and
 *    distinguish confirmed facts from allegations."
 *
 * and the string SENT to the provider was the whole 27-word sentence:
 *
 *   "What are the latest verified developments in eastern DR Congo over the
 *    last seven days Give the original sources publication dates and
 *    distinguish confirmed facts from allegations"      (179 characters)
 *
 * with the bounded fallback sending 17 request and format words:
 *
 *   "verified eastern DR Congo over last seven days original sources
 *    publication dates distinguish confirmed facts from allegations"
 *
 * GNEWS ANDs UNQUOTED TERMS across title and description, so a 27-term
 * conjunction cannot match any real article. The live record is unambiguous
 * about where the failure is NOT: `geography: ["COD"]` and a `REPORTING_WINDOW`
 * chip of "last seven days" were both applied, one provider call was made, and
 * `seen: 0`. The country was right, the window was right, and the QUERY was
 * unanswerable. That is why this file exists and why it changes nothing else.
 *
 * `candidatesSeen: 0` IS NOT EVIDENCE THAT NO REPORTING EXISTS. It is evidence
 * that this query could not match reporting.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 *
 * NOT A TRUNCATION. "first N words" would have sent "What are the latest
 * verified developments in" — every request word kept and the subject thrown
 * away, which is the failure made worse.
 *
 * NOT A 200-CHARACTER TARGET. GNews's limit is a ceiling, not a goal: the
 * failing query was already inside it at 179 characters. Fitting the limit is
 * not the same as being answerable.
 *
 * NOT A RELAXATION OF ANYTHING DOWNSTREAM. Relevance scoring, article
 * geography, deduplication, rights filtration and provenance are untouched. A
 * shorter query returns more candidates; every one of them still has to pass
 * the same admission it had to pass before. No threshold was moved to make a
 * test green.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * 1. SHORT QUERIES ARE RETURNED BYTE-IDENTICAL. Below the threshold nothing is
 *    inspected, so "Erik Prince", "NATO" and "Kenya's economy" cannot change —
 *    a structural guarantee rather than a test that happens to pass. The Kenya
 *    question is the one short query the record shows DID retrieve; it must not
 *    be "improved".
 * 2. Above the threshold, drop grammatical stopwords and the closed
 *    request/format/verification/temporal lexicon below, keeping the surviving
 *    terms IN THEIR ORIGINAL ORDER.
 * 3. Drop a generic locality noun only when a capitalised place token survives
 *    beside it — "flooding Kibirizi villages" becomes "flooding Kibirizi"
 *    because "Kibirizi" is the discriminating token and "villages" is not.
 *    Capitalisation in the reader's own text is the evidence, not a gazetteer.
 * 4. Cap the surviving terms, because an AND of eight true terms still matches
 *    nothing.
 * 5. IF NOTHING SURVIVES, RETURN THE INPUT UNCHANGED and say so. A question
 *    whose subject cannot be isolated keeps the behaviour it had; it is never
 *    widened into unrelated headlines.
 *
 * ── WHAT IS DELIBERATELY NOT DROPPED ────────────────────────────────────────
 *
 * TEMPORAL WORDS LEAVE THE QUERY BUT NOT THE REQUEST. "last seven days" is
 * dropped from the provider string because it is a publication-window
 * constraint, and `ask-router/reporting-window.ts` already enforces it as a
 * 168-hour interval. Sending it as keywords asks the provider to find articles
 * containing the words "seven days".
 *
 * A REPORTING NOUN THAT IS THE SUBJECT SURVIVES. "report"/"reports" is dropped
 * only when another content term survives, so "UN report on Gaza aid" keeps
 * its noun. `withoutReaderRequestFrame()` is not touched at all.
 *
 * PLACES, PEOPLE AND ORGANISATIONS ARE NEVER IN THE LEXICON. Nothing here can
 * remove "Congo", "DR", "eastern", "Kivu", "Erik", "Prince", "Rwanda" or
 * "Tanzania", so COD/COG discrimination and controlled aliases are decided
 * exactly where they were decided before.
 */

/** Above this many terms a query is treated as a long question. */
export const LONG_QUERY_TERM_THRESHOLD = 6;

/**
 * The most content terms a provider query may carry.
 *
 * FOUR, BECAUSE THE PROVIDER ANDs THEM. Three is the measured shape of the
 * answerable queries in the record ("eastern DR Congo"); four leaves room for
 * a place plus a topic, or two named parties plus a relation, without letting
 * a conjunction grow back to the length that failed.
 */
export const MAX_PROVIDER_QUERY_TERMS = 4;

/**
 * Request, format, verification and temporal words — a CLOSED list, and every
 * member is a word about THE ASKING rather than about the world.
 *
 * Each entry below appears in the measured failing queries or is the direct
 * inflection of one. This list is sanctioned by the A1 ruling, which names the
 * words to drop: "latest", "verified", "developments", "give the original
 * sources", "publication dates", "distinguish … allegations".
 */
export const REQUEST_FRAME_TERMS: ReadonlySet<string> = new Set([
  /* asking */
  'give', 'show', 'tell', 'provide', 'list', 'explain', 'please', 'want', 'need',
  'any', 'some', 'all', 'more', 'also', 'including', 'include',
  /* recency as a request, not as a subject */
  'latest', 'recent', 'recently', 'new', 'newest', 'current', 'currently',
  'update', 'updates', 'updated', 'happening', 'happened', 'happens',
  'developments', 'development', 'news',
  /* format of the answer */
  'summary', 'summarise', 'summarize', 'overview', 'details', 'detail',
  'briefing', 'brief', 'background', 'context',
  /* verification vocabulary */
  'verified', 'verify', 'unverified', 'confirmed', 'unconfirmed', 'confirm',
  'alleged', 'allegations', 'allegation', 'claims', 'claimed',
  'facts', 'fact', 'distinguish', 'distinguishing', 'separate',
  /* citation vocabulary */
  'original', 'sources', 'source', 'citation', 'citations', 'cite', 'cited',
  'publication', 'publications', 'published', 'dates', 'date', 'dated',
  'links', 'link', 'url', 'urls',
  /* temporal window — enforced by reporting-window.ts, never as keywords */
  'last', 'past', 'previous', 'seven', 'week', 'weeks', 'day', 'days',
  'month', 'months', 'year', 'years', 'today', 'yesterday', 'now',
  'hours', 'hour', 'since', 'during', 'between',
]);

/** Grammatical words that carry no retrieval signal. */
const GRAMMATICAL_TERMS: ReadonlySet<string> = new Set([
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'has', 'have', 'had', 'can', 'could', 'will', 'would',
  'should', 'may', 'might', 'must',
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'there', 'here', 'it', 'its',
  'in', 'on', 'at', 'to', 'of', 'for', 'from', 'with', 'about', 'over',
  'under', 'into', 'by', 'as', 'out', 'up', 'down', 'off',
  'we', 'you', 'they', 'he', 'she', 'i', 'me', 'us', 'them', 'his', 'her',
  'their', 'our', 'my', 'your',
  'abt', 'pls',
]);

/**
 * Generic locality nouns, dropped ONLY beside a surviving capitalised place.
 *
 * Deliberately tiny and deliberately conditional. "villages" next to
 * "Kibirizi" adds nothing a provider can use; "villages" on its own might be
 * the whole subject, so it is kept when no named place survives.
 */
const GENERIC_LOCALITY_TERMS: ReadonlySet<string> = new Set([
  'village', 'villages', 'town', 'towns', 'city', 'cities', 'area', 'areas',
  'region', 'regions', 'district', 'districts', 'province', 'provinces',
  'country', 'countries', 'territory', 'territories',
]);

/** Reporting nouns, dropped only when another content term survives. */
const REPORTING_NOUNS: ReadonlySet<string> = new Set([
  'report', 'reports', 'reporting', 'reported', 'article', 'articles',
  'story', 'stories', 'coverage',
]);

export const QUERY_REDUCTION_OUTCOMES = [
  /** Below the threshold: returned byte-identical, nothing inspected. */
  'SHORT_UNCHANGED',
  /** Reduced to a bounded set of content terms. */
  'REDUCED',
  /**
   * Long, but no content term survived. The input is returned UNCHANGED and
   * the caller keeps its previous behaviour — §2G's conservative failure.
   */
  'NOT_SAFELY_REDUCIBLE',
] as const;
export type QueryReductionOutcome = (typeof QUERY_REDUCTION_OUTCOMES)[number];

export interface QueryReduction {
  readonly query: string;
  readonly outcome: QueryReductionOutcome;
  /** Terms dropped, for the diagnostic record. Never sent anywhere. */
  readonly dropped: readonly string[];
}

const fold = (term: string): string => term.toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu, '');
const startsCapitalised = (term: string): boolean => /^\p{Lu}/u.test(term);

/**
 * Reduce a long derived query to a bounded provider query.
 *
 * PURE AND DETERMINISTIC: same input, same output, no clock, no locale, no
 * network, no model. The same question always produces the same provider
 * string, which is what makes a live failure attributable.
 */
export function reduceNewsQueryForProvider(
  derivedQuery: string,
  options: { readonly ignoreLengthThreshold?: boolean } = {},
): QueryReduction {
  const terms = derivedQuery.split(/\s+/).filter((t) => t.length > 0);

  /*
   * THE THRESHOLD PROTECTS A READER'S SHORT QUERY, NOT A DERIVED ONE.
   *
   * `ignoreLengthThreshold` is set only by the FALLBACK composite, and the
   * distinction is measured rather than stylistic. The fallback for the
   * Kibirizi question is "verified reports flooding Kibirizi villages" — five
   * terms, under the threshold, so without this it was returned untouched and
   * the SECOND attempt went out still carrying "verified", "reports" and
   * "villages" while the primary had been reduced to "flooding Kibirizi". A
   * fallback weaker than the primary it backs up is not a fallback.
   *
   * It is safe here and nowhere else: `deriveFallbackNewsQuery()` has already
   * stripped grammar, so its output is a content set rather than a sentence,
   * and no reader string reaches this branch.
   */
  if (!options.ignoreLengthThreshold && terms.length <= LONG_QUERY_TERM_THRESHOLD) {
    return { query: derivedQuery, outcome: 'SHORT_UNCHANGED', dropped: [] };
  }

  const dropped: string[] = [];
  const kept: string[] = [];

  for (const term of terms) {
    const folded = fold(term);

    if (folded.length === 0 || GRAMMATICAL_TERMS.has(folded) || REQUEST_FRAME_TERMS.has(folded)) {
      dropped.push(term);
      continue;
    }

    kept.push(term);
  }

  /* A reporting noun goes only if something else is left to search on. */
  const withoutReportingNoun = kept.filter((t) => !REPORTING_NOUNS.has(fold(t)));
  const afterReporting = withoutReportingNoun.length > 0 ? withoutReportingNoun : kept;

  for (const t of kept) if (!afterReporting.includes(t)) dropped.push(t);

  /* A generic locality noun goes only beside a surviving NAMED place. */
  const hasNamedPlace = afterReporting.some(
    (t) => startsCapitalised(t) && !GENERIC_LOCALITY_TERMS.has(fold(t)),
  );
  const afterLocality = hasNamedPlace
    ? afterReporting.filter((t) => !GENERIC_LOCALITY_TERMS.has(fold(t)))
    : afterReporting;

  for (const t of afterReporting) if (!afterLocality.includes(t)) dropped.push(t);

  if (afterLocality.length === 0) {
    /*
     * NOTHING SURVIVED. Returning the original is the conservative outcome:
     * the caller behaves exactly as it did before this file existed, and the
     * named outcome tells the diagnostic why.
     */
    return { query: derivedQuery, outcome: 'NOT_SAFELY_REDUCIBLE', dropped: [] };
  }

  const capped = afterLocality.slice(0, MAX_PROVIDER_QUERY_TERMS);

  for (const t of afterLocality.slice(MAX_PROVIDER_QUERY_TERMS)) dropped.push(t);

  return { query: capped.join(' '), outcome: 'REDUCED', dropped };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE GENERIC-PATH COMPOSITES — THE ONLY TWO SEAMS THIS CORRECTION NEEDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `makeProviderSafeNewsQuery()` HAS 23 CALL SITES and is deliberately NOT
 * changed. Several of them already pass short, correct strings — an entity
 * canonical, a two-term relation, a Polish topic — and widening the behaviour
 * of a function with that reach for a defect that lives on ONE path would put
 * every other path at risk for no gain.
 *
 * A1's measured failure is the GENERIC search path only: `primarySent` and the
 * bounded `fallbackSent`. So the reduction is offered as two named composites,
 * and integrating A1 is a two-line substitution on that path. Everything else
 * keeps the function it has.
 */
import { makeProviderSafeNewsQuery, deriveFallbackNewsQuery } from './derive-generic-news-query.util';

export interface GenericProviderQuery {
  /** Exactly what should be sent, or undefined when nothing lexical survives. */
  readonly sent: string | undefined;
  readonly outcome: QueryReductionOutcome;
  /** The pre-reduction provider-safe string, for the before/after record. */
  readonly unreduced: string | undefined;
}

/**
 * The primary generic provider query.
 *
 * REDUCTION RUNS BEFORE PUNCTUATION SAFETY, deliberately: reduction works on
 * words and the punctuation step can only remove characters, so reducing first
 * means the terms that survive are chosen from what the reader actually wrote
 * rather than from an already-mangled string.
 */
export function makeGenericProviderQuery(genericSearchQuery: string): GenericProviderQuery {
  const reduction = reduceNewsQueryForProvider(genericSearchQuery);

  return {
    sent: makeProviderSafeNewsQuery(reduction.query),
    outcome: reduction.outcome,
    unreduced: makeProviderSafeNewsQuery(genericSearchQuery),
  };
}

/**
 * The bounded fallback generic provider query.
 *
 * The existing `deriveFallbackNewsQuery()` runs FIRST and keeps its contract —
 * including returning `undefined`, which the caller already treats as "no
 * second attempt". Reduction is then applied to its output, because the
 * measured fallback was itself 17 request and format words and failed for the
 * same reason the primary did.
 */
export function makeGenericProviderFallbackQuery(
  genericSearchQuery: string,
): GenericProviderQuery {
  const fallback = deriveFallbackNewsQuery(genericSearchQuery);

  if (fallback === undefined) {
    return { sent: undefined, outcome: 'NOT_SAFELY_REDUCIBLE', unreduced: undefined };
  }

  const reduction = reduceNewsQueryForProvider(fallback, { ignoreLengthThreshold: true });

  /*
   * A FALLBACK THAT REDUCES TO NOTHING IS NO SECOND ATTEMPT AT ALL, and saying
   * so is better than sending the request words that survived. The caller
   * already treats `undefined` as "do not attempt", so this reuses the
   * contract rather than inventing a state.
   */
  if (reduction.outcome === 'NOT_SAFELY_REDUCIBLE') {
    return { sent: undefined, outcome: 'NOT_SAFELY_REDUCIBLE', unreduced: makeProviderSafeNewsQuery(fallback) };
  }

  return {
    sent: makeProviderSafeNewsQuery(reduction.query),
    outcome: reduction.outcome,
    unreduced: makeProviderSafeNewsQuery(fallback),
  };
}
