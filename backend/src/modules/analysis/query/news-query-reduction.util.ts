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

/**
 * The most content terms a provider query may carry.
 *
 * SIX. The failing baseline query was 27 terms; six terms of pure subject is
 * far more discriminating and still leaves room for a multi-word institution
 * plus its topic ("European Central Bank interest rate decisions"). R1 used
 * four, which truncated exactly that case.
 */
export const MAX_PROVIDER_QUERY_TERMS = 6;

/**
 * Above this many surviving content terms, NO SUBJECT DOMINATES and reduction
 * refuses rather than choosing.
 *
 * Twice the cap. Measured against the real corpus: the frozen DRC question
 * leaves 3 survivors, Kibirizi 2, the European Central Bank phrasing 6 — and
 * the 50-word supply-chain question leaves 24, which is an essay rather than a
 * subject. The line is drawn where "select the top N" stops being selection
 * and becomes an arbitrary slice.
 */
export const NO_DOMINANT_SUBJECT_CEILING = MAX_PROVIDER_QUERY_TERMS * 2;

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
  'summarize', 'summarise', 'describe', 'outline', 'compare', 'discuss',
  'using', 'use', 'only', 'just', 'kindly', 'me', 'us',
  /*
   * QUALITY AND MANNER WORDS — every one measured in a failing phrasing at
   * R1, where it survived and pushed the subject out of the term cap:
   * "careful sourced global semiconductor", "like detailed well sourced
   * European", "Using only reliable Ethiopia", "short neutral Boeing 737",
   * "clearly citing Taiwan Strait", "most important Sudan ceasefire".
   */
  'careful', 'carefully', 'reliable', 'reliably', 'trustworthy', 'credible',
  'detailed', 'detailed-sourced', 'sourced', 'well', 'thorough', 'thoroughly',
  'neutral', 'neutrally', 'objective', 'unbiased', 'balanced', 'fair',
  'short', 'shorter', 'concise', 'clearly', 'clear', 'simple', 'simply',
  'plain', 'citing', 'comprehensive', 'accurate', 'accurately',
  'important', 'significant', 'significantly', 'main', 'key', 'major',
  /*
   * QUANTIFIERS AND PREFERENCE VERBS, measured surviving the first correction:
   * "most Sudan ceasefire negotiations", "most cholera outbreaks Malawi" and
   * "like European Central Bank interest rate" (from "I would like").
   */
  'most', 'least', 'many', 'much', 'few', 'several', 'various', 'other',
  'like', 'prefer', 'rather', 'possible', 'available',
  'relevant', 'useful', 'good', 'best', 'top',
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
  /**
   * NO REQUEST FRAME WAS FOUND, so there was nothing to remove and the query
   * is returned VERBATIM — stopwords, articles and all.
   *
   * THIS REPLACES R1's LENGTH THRESHOLD, and the difference is the whole
   * correction. R1 reduced anything over six terms, so
   * "The demand for labour in Quarter 2 2026" — a question with no request
   * framing at all — was cut to "demand labour Quarter 2" and LOST THE YEAR.
   * Length was never the signal. The presence of framing to remove is.
   */
  'NO_FRAME_UNCHANGED',
  /** Framing was removed and a bounded subject was selected. */
  'REDUCED',
  /**
   * Long, framed, but NO SAFE SUBJECT could be identified — either nothing
   * survived, or so much survived that no subject dominates. The input is
   * returned UNCHANGED.
   *
   * The second case is the one R1 got wrong by force. A 50-word multi-clause
   * analytical question leaves two dozen content nouns and no named entity;
   * picking six of them in reading order produced
   * "most significant economic security" for a question about SUPPLY CHAINS.
   * There is no deterministic way to choose among them without a parser or a
   * model rewrite, and both are forbidden — so the honest answer is to send
   * what the reader wrote rather than a confident-looking substitute.
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

/* ═══════════════════════════════════════════════════════════════════════════
 * EVIDENCE CLASSES — WHY SELECTION REPLACED POSITION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * R1 kept "the first four terms not on the request list". That is POSITIONAL,
 * and it failed in the one way a positional rule always fails: a framing word
 * the list did not happen to contain BOTH survived AND occupied a slot, so the
 * subject fell off the end. Measured:
 *
 *   "Using only reliable sources … Ethiopia Eritrea border tensions"
 *        -> "Using only reliable Ethiopia"
 *   "Give me a short, neutral summary … Boeing 737 MAX production problems"
 *        -> "short neutral Boeing 737"
 *
 * Extending the list would have fixed those seven phrasings and failed on the
 * eighth. The structural answer is to stop ranking by position and rank by
 * EVIDENCE OF BEING THE SUBJECT, so that an unlisted framing word loses to a
 * named entity or a year instead of displacing it.
 */
const enum SubjectEvidence {
  /** A year, a period designator, or a token carrying a digit. Never dropped. */
  Anchor = 0,
  /** Proper-noun shaped: capitalised mid-sentence, or an all-caps acronym. */
  Named = 1,
  /** An ordinary content word. Fills the remaining room, in reader order. */
  Content = 2,
}

const YEAR = /^(?:19|20)\d{2}$/;
const PERIOD = /^(?:q[1-4]|h[12])$/i;
const HAS_DIGIT = /\d/;

/**
 * Units that make a preceding bare number a WINDOW rather than a subject.
 *
 * MEASURED: "Tanzania Rwanda bilateral trade in the last 30 days" dropped
 * "days" as a window word and kept "30" as a numeric anchor, sending
 * "Tanzania Rwanda bilateral trade 30". A bare 30 is not an anchor; it is the
 * orphan of a window. The test is STRUCTURAL — the number is immediately
 * followed by a unit — so no list of numbers is needed and "737 MAX" and
 * "Quarter 2 2026" are untouched.
 */
const TEMPORAL_UNITS: ReadonlySet<string> = new Set([
  'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years',
  'hour', 'hours', 'minute', 'minutes',
]);

function isWindowOrphan(terms: readonly string[], index: number): boolean {
  const self = fold(terms[index] ?? '');

  if (!/^\d{1,3}$/.test(self) || YEAR.test(self)) return false;

  return TEMPORAL_UNITS.has(fold(terms[index + 1] ?? ''));
}

/**
 * Classify one term.
 *
 * `isFirst` MATTERS AND IS NOT A DETAIL. The first word of a question is
 * capitalised by orthography, not because it names anything — "Using only
 * reliable…" began with a capital U, and treating that as proper-noun evidence
 * is precisely how "Using" outranked "Ethiopia". So sentence-initial
 * capitalisation is never evidence; an all-caps acronym still is.
 */
function classify(term: string, isFirst: boolean): SubjectEvidence {
  const folded = fold(term);

  if (YEAR.test(folded) || PERIOD.test(folded) || HAS_DIGIT.test(folded)) {
    return SubjectEvidence.Anchor;
  }

  const isAcronym = term.length >= 2 && term === term.toUpperCase() && /\p{L}/u.test(term);

  if (isAcronym) return SubjectEvidence.Named;
  if (!isFirst && /^\p{Lu}/u.test(term)) return SubjectEvidence.Named;

  return SubjectEvidence.Content;
}

/**
 * Is there a request frame here at all?
 *
 * THE TRIGGER, AND THE CORRECTION TO R1. Reduction now happens only when
 * framing is actually present to remove. "The demand for labour in Quarter 2
 * 2026" contains none, so it is returned verbatim and keeps its year — R1 cut
 * it to "demand labour Quarter 2" purely because it was over a length
 * threshold.
 */
function hasRequestFrame(terms: readonly string[]): boolean {
  return terms.some((t) => REQUEST_FRAME_TERMS.has(fold(t)));
}

/**
 * Reduce a framed question to a bounded provider query.
 *
 * PURE AND DETERMINISTIC: same input, same output, no clock, no locale, no
 * network, NO MODEL REWRITING. The same question always produces the same
 * provider string, which is what makes a live failure attributable.
 */
export function reduceNewsQueryForProvider(
  derivedQuery: string,
  options: { readonly treatAsFramed?: boolean } = {},
): QueryReduction {
  const terms = derivedQuery.split(/\s+/).filter((t) => t.length > 0);

  if (terms.length === 0) {
    return { query: derivedQuery, outcome: 'NO_FRAME_UNCHANGED', dropped: [] };
  }

  /*
   * NO FRAME, NO CHANGE. `treatAsFramed` is set only by the FALLBACK
   * composite, whose input is already a stripped content set rather than a
   * sentence, so the framing signal is no longer visible in it.
   */
  if (!options.treatAsFramed && !hasRequestFrame(terms)) {
    return { query: derivedQuery, outcome: 'NO_FRAME_UNCHANGED', dropped: [] };
  }

  const dropped: string[] = [];
  const survivors: { term: string; evidence: SubjectEvidence; index: number }[] = [];

  terms.forEach((term, index) => {
    const folded = fold(term);

    if (
      folded.length === 0 ||
      GRAMMATICAL_TERMS.has(folded) ||
      REQUEST_FRAME_TERMS.has(folded) ||
      isWindowOrphan(terms, index)
    ) {
      dropped.push(term);
      return;
    }

    survivors.push({ term, evidence: classify(term, index === 0), index });
  });

  /* A reporting noun goes only if something else is left to search on. */
  const withoutReporting = survivors.filter((s) => !REPORTING_NOUNS.has(fold(s.term)));
  const afterReporting = withoutReporting.length > 0 ? withoutReporting : survivors;

  for (const s of survivors) if (!afterReporting.includes(s)) dropped.push(s.term);

  /* A generic locality noun goes only beside a surviving NAMED place. */
  const hasNamed = afterReporting.some((s) => s.evidence === SubjectEvidence.Named);
  const afterLocality = hasNamed
    ? afterReporting.filter((s) => !GENERIC_LOCALITY_TERMS.has(fold(s.term)))
    : afterReporting;

  for (const s of afterReporting) if (!afterLocality.includes(s)) dropped.push(s.term);

  if (afterLocality.length === 0) {
    return { query: derivedQuery, outcome: 'NOT_SAFELY_REDUCIBLE', dropped: [] };
  }

  /*
   * TOO MUCH SURVIVED: there is no subject to find, only a long argument.
   * Returning the reader's own words is the conservative outcome the ruling
   * requires, and it is strictly better than a confident-looking slice.
   */
  if (afterLocality.length > NO_DOMINANT_SUBJECT_CEILING) {
    return { query: derivedQuery, outcome: 'NOT_SAFELY_REDUCIBLE', dropped: [] };
  }

  /*
   * SELECT by evidence, then EMIT in the reader's own order. Ranking decides
   * WHICH terms survive the cap; it never reorders the query, because a
   * provider matches phrases and the reader's order is the one that reads.
   */
  const selected = [...afterLocality]
    .sort((a, b) => a.evidence - b.evidence || a.index - b.index)
    .slice(0, MAX_PROVIDER_QUERY_TERMS)
    .sort((a, b) => a.index - b.index);

  for (const s of afterLocality) if (!selected.includes(s)) dropped.push(s.term);

  return { query: selected.map((s) => s.term).join(' '), outcome: 'REDUCED', dropped };
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

  const reduction = reduceNewsQueryForProvider(fallback, { treatAsFramed: true });

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
