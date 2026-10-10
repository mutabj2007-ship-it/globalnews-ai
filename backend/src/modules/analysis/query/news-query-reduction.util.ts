/**
 * ═══════════════════════════════════════════════════════════════════════════
 * P0 NEWS QUERY — A1 R3: RECOGNIZED SAFE-REDUCTION PATTERNS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS FILE IS ALLOWED TO DO, AND WHAT IT IS NOT.
 *
 * A1's measured defect is narrow: a long reader question reaches GNews as a
 * conjunction of its REQUEST and OUTPUT-FORMAT words, so the subject the reader
 * actually asked about is only one AND-term among twenty-seven and the search
 * cannot match an article. The fix for that must be equally narrow.
 *
 * R1 reduced "the first four terms that are not on a stopword list". R2 replaced
 * the length trigger with a framing trigger and ranked the survivors by evidence.
 * Both were GENERAL REWRITERS: they ran on every generic query, so they also
 * changed queries that had never been broken. R2's own intake measured the
 * price — SEVEN tests that pass on the accepted Alpha baseline `9aab213` failed,
 * because short, working queries were altered:
 *
 *     "the us released a report today"       -> "released"
 *     "markets today"                        -> "markets"
 *     "technology and markets today"         -> "technology markets"
 *     "Tell me everything about the situation" -> "everything situation"
 *     "Poland s economy this week"           -> "Poland s economy"
 *     "Poland s energy sources"              -> "sources" stripped
 *     plus the M46 bounded fallback, which stopped firing for its own shape.
 *
 * The lesson is not "extend the lexicon". It is that a general rewriter has no
 * business on this path at all. R3 therefore inverts the default:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ OUTSIDE A RECOGNIZED SAFE-REDUCTION PATTERN THIS MODULE RETURNS      │
 *   │ EXACTLY WHAT THE BASELINE `makeProviderSafeNewsQuery()` WOULD HAVE    │
 *   │ SENT — byte for byte. Reduction happens only where a structural       │
 *   │ pattern is POSITIVELY matched.                                        │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * That property is testable rather than asserted: for any input on which no
 * pattern matches, `makeGenericProviderQuery(q).sent === makeProviderSafeNewsQuery(q)`.
 * See `ask-p0-news-query-a1-a4.spec.ts` ("baseline parity").
 *
 * THERE IS NO UNIVERSALLY DISPOSABLE WORD HERE. `report`, `sources`, `released`
 * and `today` are not on any drop list. `sources` in "Poland's energy sources"
 * is a topic noun; `sources` in "give the original sources" is a format
 * directive; the two are told apart by WHERE they sit in a matched structure,
 * never by the word itself. Explicit years and period designators are never
 * touched because nothing outside a matched subject span is touched at all, and
 * the existing handling of "this week" is likewise left exactly as it was.
 *
 * WHY A SPAN AND NOT A SCORE. A score has to be comparable across unrelated
 * terms, which is what forced R1 and R2 to keep growing a lexicon. A span needs
 * only two boundaries, and both are found from closed, structural evidence: a
 * REQUEST LEAD on the left and a recognized TERMINATOR on the right. A word the
 * lexicon has never seen cannot displace the subject, because the subject is
 * not chosen word by word.
 */

import { deriveFallbackNewsQuery, makeProviderSafeNewsQuery } from './derive-generic-news-query.util';

/**
 * GNews's own documented hard maximum for `q`, in CODE POINTS, and the reason
 * this module has an honesty rule at all.
 *
 * `GNewsProvider.search()` clamps `q` to this length unconditionally. The clamp
 * is not a safety net for a long query — it is a silent mid-word cut. The R2
 * intake measured it on the 50-word supply-chain question: 302 code points went
 * out and GNews was asked for
 *
 *     "… long-term geopolitical stability c"
 *
 * which is not the reader's question, not a query anyone wrote, and is reported
 * to the reader as a search that happened.
 *
 * WHY THIS MODULE REPORTS THAT CONDITION RATHER THAN ACTING ON IT — a MEASURED
 * finding, not a preference.
 *
 * The obvious implementation is to return `undefined` and let the caller's
 * existing "no lexical query" branch refuse the search. Measured on the
 * integrated tree, that breaks ELEVEN tests in two suites
 * (`ask-public-beta-retrieval-r1`, `ask-truthful-retrieval-r2a`) and sends ZERO
 * provider requests for a compound DRC question that previously ran four:
 *
 *     expected  [ {q:'eastern Congo'}, {q:'Congo',lang:'fr'},
 *                 {q:'eastern Congo fighting'}, {q:'eastern Congo displaced'} ]
 *     received  []
 *
 * The cause is in the CALLER, and it predates A1: `analysis.service.ts` evaluates
 * `primarySent === undefined` BEFORE it decides whether a compound plan exists,
 * and a compound plan never sends `primarySent` at all — it runs its own short
 * per-lane queries. So a verdict about one string cancels retrieval that would
 * never have used that string. On `9aab213` the same branch is reachable (a
 * punctuation-only question suppresses a plan the same way); A1 R3 would simply
 * make it reachable for long unmatched questions too.
 *
 * Fixing a shared-runtime ordering defect is not inside this assignment, and
 * guessing at it silently would be worse than naming it. So:
 *
 *   - `sent` stays EXACTLY what the baseline would send. Nothing regresses.
 *   - `outcome` states `NOT_SAFELY_REDUCIBLE`, so the condition is visible and
 *     the caller CAN act on it.
 *   - the three-line caller correction is delivered as a reviewable patch for the
 *     integrator, with its own before/after evidence, and is not applied here.
 */
export const GNEWS_QUERY_CODE_POINT_MAX = 200;

/**
 * SECOND, INDEPENDENT GUARD on the short end.
 *
 * The pattern match below cannot fire on any of the seven regressed cases — none
 * of them has a request lead with a reporting head. This gate exists anyway, so
 * that a future widening of the lead vocabulary still cannot reach a short query.
 *
 * MEASURED, not tuned: across the frozen corpus the longest query that must stay
 * byte-identical is "The demand for labour in Quarter 2 2026" at EIGHT terms, and
 * the shortest that must reduce is 18 terms. Ten sits inside that empty band.
 */
export const MIN_TERMS_FOR_PATTERN = 10;

/**
 * A matched subject span wider than this is not a bounded subject, and sending
 * it would be the R1/R2 failure again in a narrower costume. Across the frozen
 * corpus the widest correct span is SIX terms ("European Central Bank interest
 * rate decisions"); twelve is twice that.
 */
export const MAX_SUBJECT_SPAN_TERMS = 12;

/* ───────────────────────────────────────────────────────────────────────────
 * LEFT BOUNDARY — THE REQUEST LEAD
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Two pieces of positive evidence are required, and BOTH are structural:
 *
 *   1. the query OPENS with a request word, and
 *   2. a REPORTING HEAD appears in the lead region.
 *
 * "the us released a report today" contains a reporting noun but does not open
 * with a request word. "Tell me everything about the situation" opens with one
 * but has no reporting head. Neither matches, so neither is touched — and that
 * is the whole of their protection: not a lexicon exception, an unmet precondition.
 */

/** Opening request words. The FIRST term must fold to one of these. */
const REQUEST_OPENERS: ReadonlySet<string> = new Set([
  'what', 'which', 'who', 'whose', 'when', 'where', 'how', 'why',
  'give', 'tell', 'show', 'share', 'please', 'provide', 'send',
  'explain', 'summarize', 'summarise', 'describe', 'list', 'outline', 'brief',
  'can', 'could', 'would', 'will', 'may',
  'i', 'id', 'we', 'using', 'based',
  'any', 'are', 'is', 'do', 'does', 'has', 'have', 'was', 'were',
]);

/**
 * REPORTING HEADS — the nouns a reader uses for the THING THEY WANT BACK, which
 * is therefore never the subject and always sits to the left of it.
 *
 * `sources` IS DELIBERATELY ABSENT. It is the word R2 got wrong: as a head it
 * would move the subject boundary past "energy sources" and destroy the topic.
 * `story`, `article` and `situation` are absent for the same reason — each is a
 * plausible subject noun, and a head that can be a subject is not evidence.
 */
const REPORTING_HEADS: ReadonlySet<string> = new Set([
  'report', 'reports', 'reporting',
  'news', 'headlines',
  'summary', 'summaries', 'briefing', 'briefings',
  'overview', 'overviews', 'recap', 'roundup', 'rundown',
  'developments', 'development',
  'update', 'updates',
  'coverage', 'analysis',
]);

/**
 * PIVOT TERMS — what may legitimately sit BETWEEN a reporting head and the
 * subject, and nothing else. Prepositions, grammatical scaffolding, verbs of
 * occurrence, time adverbs, and the closed set of "aboutness" participles a
 * reader uses to attach a head to a topic ("developments AFFECTING x",
 * "developments currently RESHAPING x").
 *
 * The set contains NO content noun, so the subject boundary is the first term
 * this set does not contain. That is why no cap on the pivot run is needed: the
 * run cannot swallow a subject.
 */
const PIVOT_TERMS: ReadonlySet<string> = new Set([
  /* prepositions and complementizers */
  'in', 'on', 'about', 'of', 'with', 'for', 'from', 'to', 'at', 'into',
  'regarding', 'concerning', 'around', 'over', 'across', 'within', 'by',
  /* grammatical scaffolding */
  'the', 'a', 'an', 'that', 'what', 'which', 'who', 'whom', 'this', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'do', 'does', 'did',
  'there', 'it', 'its', 's',
  /* verbs of occurrence and change */
  'happened', 'happening', 'happens', 'happen', 'changed', 'changing', 'changes',
  'occurred', 'occurring', 'unfolded', 'unfolding', 'emerged', 'emerging', 'going',
  'taken', 'taking', 'place', 'new', 'latest', 'recent',
  /* time adverbs */
  'recently', 'currently', 'lately', 'now', 'today', 'just', 'so', 'far', 'already',
  /* aboutness participles */
  'affecting', 'reshaping', 'shaping', 'driving', 'surrounding', 'involving',
  'relating', 'related', 'impacting', 'influencing', 'touching', 'shaking',
]);

/* ───────────────────────────────────────────────────────────────────────────
 * RIGHT BOUNDARY — RECOGNIZED TERMINATORS
 * ───────────────────────────────────────────────────────────────────────────
 *
 * A terminator is a PHRASE, matched over the folded term array, never a single
 * ambient word. Three families, all of them things a reader appends AFTER the
 * subject rather than inside it:
 *
 *   a trailing reporting window   "… over the last seven days"
 *   a new clause                  "… and explain what remains uncertain"
 *   a new output directive        "… Give the original sources"
 *
 * Only the EARLIEST terminator counts, and only one at index >= 1, so a
 * sentence-initial request verb is never mistaken for a restart.
 */

/** Trailing reporting windows. The window itself travels as a parameter, never as a term. */
const TRAILING_WINDOW_PHRASES: readonly (readonly string[])[] = [
  ['over', 'the', 'last'], ['over', 'the', 'past'],
  ['in', 'the', 'last'], ['in', 'the', 'past'],
  ['during', 'the', 'last'], ['during', 'the', 'past'],
  ['for', 'the', 'last'], ['for', 'the', 'past'],
  ['within', 'the', 'last'], ['within', 'the', 'past'],
  ['since', 'the', 'start'], ['as', 'of'],
];

/**
 * Words that, immediately after "and", mean a NEW CLAUSE rather than a
 * conjoined subject. "Ethiopia and Eritrea" is safe because "Eritrea" is not in
 * this set; "controls and explain" terminates because "explain" is.
 */
const CLAUSE_RESTART_AFTER_AND: ReadonlySet<string> = new Set([
  'explain', 'how', 'what', 'why', 'whether', 'when', 'where', 'who',
  'distinguish', 'give', 'tell', 'cite', 'list', 'include', 'state',
  'provide', 'show', 'summarize', 'summarise', 'compare', 'assess', 'say',
  'separate', 'identify', 'note', 'mention', 'rank', 'describe',
]);

/** Imperative output directives that begin a fresh instruction sentence. */
const DIRECTIVE_RESTART: ReadonlySet<string> = new Set([
  'give', 'tell', 'cite', 'list', 'include', 'state', 'provide', 'show',
  'summarize', 'summarise', 'distinguish', 'separate', 'identify', 'mention',
  'please', 'thanks',
]);

/* ───────────────────────────────────────────────────────────────────────────
 * INSIDE THE SPAN — THE ONLY TERMS THIS MODULE EVER DROPS
 * ─────────────────────────────────────────────────────────────────────────── */

/** Function words. Dropped only inside a matched span, and only if terms survive. */
const SPAN_FUNCTION_TERMS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'with',
  'from', 'by', 's', 'its', 'their',
]);

/**
 * Structural geography words. GNews ANDs every unquoted term, so "village" in
 * "flooding in Kibirizi village" is a conjunct that most real reporting about
 * that flood will not contain.
 *
 * CAPITALISATION IS EVIDENCE: only a LOWERCASE occurrence is structural. "City"
 * in "Mexico City" is part of a name and is kept.
 */
const SPAN_GENERIC_LOCALITY_TERMS: ReadonlySet<string> = new Set([
  'village', 'villages', 'town', 'towns', 'city', 'cities',
  'region', 'regions', 'province', 'provinces', 'district', 'districts',
  'area', 'areas', 'county', 'counties', 'territory', 'territories',
  'countryside', 'locality', 'localities',
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════ */

export const QUERY_REDUCTION_OUTCOMES = [
  /**
   * NO RECOGNIZED PATTERN MATCHED, so nothing was removed and the baseline's own
   * provider query is what goes out — stopwords, articles, format words and all.
   * This is the DEFAULT and it is what protects every previously working query.
   */
  'NO_PATTERN_UNCHANGED',
  /** A pattern matched and a bounded subject span was sent. */
  'REDUCED',
  /**
   * No pattern matched AND the baseline query would cross GNews's 200-code-point
   * clamp, so what the provider would actually receive is a mid-word fragment.
   *
   * `sent` is still the baseline string — see GNEWS_QUERY_CODE_POINT_MAX for the
   * measured reason this module reports the condition instead of refusing the
   * search itself. A caller that can tell an ordinary generic search from a
   * compound plan should refuse on THIS outcome.
   */
  'NOT_SAFELY_REDUCIBLE',
] as const;
export type QueryReductionOutcome = (typeof QUERY_REDUCTION_OUTCOMES)[number];

export interface QueryReduction {
  /** The string to take forward. Equals the input unless `outcome` is 'REDUCED'. */
  readonly query: string;
  readonly outcome: QueryReductionOutcome;
  /** Terms dropped, for the diagnostic record only. Never sent anywhere. */
  readonly dropped: readonly string[];
  /** Which pattern matched, for the record. `null` when none did. */
  readonly pattern: 'REQUEST_LEAD_SUBJECT_SPAN' | null;
}

const fold = (term: string): string => term.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const phraseAt = (folded: readonly string[], index: number, phrase: readonly string[]): boolean =>
  phrase.every((word, offset) => folded[index + offset] === word);

/** Capitalised and not sentence-initial — the one casing signal this module reads. */
const isMidSentenceCapitalised = (term: string, index: number): boolean =>
  index > 0 && /^[\p{Lu}]/u.test(term);

/**
 * The earliest recognized terminator at index >= 1, or the end of the array.
 */
function findTerminator(terms: readonly string[], folded: readonly string[]): number {
  for (let i = 1; i < folded.length; i += 1) {
    for (const phrase of TRAILING_WINDOW_PHRASES) {
      if (phraseAt(folded, i, phrase)) return i;
    }
    if (folded[i] === 'and' && folded[i + 1] !== undefined && CLAUSE_RESTART_AFTER_AND.has(folded[i + 1])) {
      return i;
    }
    /*
      A directive restart counts only where a new sentence plausibly begins: the
      term is capitalised in the original, or it follows a term the derivation
      already stripped punctuation from. Capitalisation is the available signal
      and it is read conservatively — a lowercase "give" mid-phrase is left alone.
    */
    if (DIRECTIVE_RESTART.has(folded[i]) && isMidSentenceCapitalised(terms[i], i)) return i;
  }
  return folded.length;
}

/**
 * THE ONE RECOGNIZED SAFE-REDUCTION PATTERN.
 *
 * Returns the subject span's [start, end) within `terms`, or `null` when any
 * piece of required evidence is missing. Every `null` path means "leave the
 * query exactly as the baseline would have sent it".
 */
function matchRequestLeadSubjectSpan(
  terms: readonly string[],
  folded: readonly string[],
): { start: number; end: number } | null {
  if (terms.length < MIN_TERMS_FOR_PATTERN) return null;
  if (!REQUEST_OPENERS.has(folded[0])) return null;

  const end = findTerminator(terms, folded);

  /* The reporting head must sit inside the lead region, never in the trailing
     directives: a head after the terminator says nothing about the subject. */
  let head = -1;
  for (let i = 0; i < end; i += 1) if (REPORTING_HEADS.has(folded[i])) head = i;
  if (head === -1) return null;

  /* The subject begins at the first term after the head that the pivot set does
     not contain. A pivot-only tail means there is no subject to find. */
  let start = head + 1;
  while (start < end && PIVOT_TERMS.has(folded[start])) start += 1;
  if (start >= end) return null;

  return { start, end };
}

/**
 * Reduce a derived generic query to a bounded subject, but ONLY where a
 * recognized pattern matches. Pure; no I/O; deterministic.
 */
export function reduceNewsQueryForProvider(derivedQuery: string): QueryReduction {
  const unchanged = (outcome: QueryReductionOutcome = 'NO_PATTERN_UNCHANGED'): QueryReduction => ({
    query: derivedQuery,
    outcome,
    dropped: [],
    pattern: null,
  });

  const terms = derivedQuery.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return unchanged();
  const folded = terms.map(fold);

  const span = matchRequestLeadSubjectSpan(terms, folded);
  if (span === null) return unchanged();

  const spanTerms = terms.slice(span.start, span.end);
  const spanFolded = folded.slice(span.start, span.end);

  const kept: string[] = [];
  const dropped: string[] = [];
  spanTerms.forEach((term, i) => {
    const f = spanFolded[i];
    const absolute = span.start + i;
    const structuralLocality =
      SPAN_GENERIC_LOCALITY_TERMS.has(f) && !isMidSentenceCapitalised(term, absolute);
    /*
      PIVOT TERMS ARE DROPPED INSIDE THE SPAN TOO, on the same evidence that lets
      them be skipped in front of it: the set is grammatical scaffolding by
      construction and contains no content noun. Measured on the frozen corpus
      this changes nothing ("global supply chains", "eastern DR Congo",
      "European Central Bank interest rate decisions" contain none of it); what
      it removes is a span made of pronouns and adverbs, which then fails the
      subject-evidence check below instead of being sent.
    */
    if (f === '' || SPAN_FUNCTION_TERMS.has(f) || PIVOT_TERMS.has(f) || structuralLocality) {
      dropped.push(term);
    } else kept.push(term);
  });

  if (kept.length === 0) return unchanged();
  if (kept.length > MAX_SUBJECT_SPAN_TERMS) return unchanged();

  /*
    SUBJECT EVIDENCE. Either something in the span is named or numeric, or at
    least two content terms survived.

    A STATED LIMIT, NOT A HIDDEN ONE. This bounds the span; it does not judge
    whether the reader's subject is SPECIFIC. "What are the latest reports about
    the situation there right now for us all" still reduces, to its own vague
    content terms. Both R1 and R2 failed by trying to legislate specificity with
    a growing word list, and a vagueness lexicon would be that failure again: the
    honest handling of a vague question is a search that returns nothing and the
    existing no-evidence answer, not a module that decides which nouns are real.
    Named/numeric evidence cannot be REQUIRED here either — "global supply
    chains" is the correct subject of the 50-word case and has neither.
  */
  const named = kept.some((term, i) => isMidSentenceCapitalised(term, span.start + i) || /\d/.test(term));
  if (!named && kept.length < 2) return unchanged();

  return { query: kept.join(' '), outcome: 'REDUCED', dropped, pattern: 'REQUEST_LEAD_SUBJECT_SPAN' };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE TWO GENERIC-PATH COMPOSITES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A1's measured failure is the generic search path only — `primarySent` and the
 * one bounded `fallbackSent`. The reduction is offered as two named composites so
 * integrating it stays a two-line substitution on that path, and so that the
 * baseline-parity property is expressed HERE rather than trusted at the call site.
 */

export interface GenericProviderQuery {
  /** Exactly what should be sent, or `undefined` when nothing should be sent. */
  readonly sent: string | undefined;
  readonly outcome: QueryReductionOutcome;
  /** What the baseline would have sent, for the before/after record. */
  readonly unreduced: string | undefined;
}

/**
 * The honesty rule, applied identically to both composites.
 *
 * `baseline` is what `9aab213` would have sent for this exact input. It is
 * returned unchanged unless the provider would silently clamp it mid-word, in
 * which case nothing is sent at all.
 */
function resolveSend(baseline: string | undefined, reduction: QueryReduction): GenericProviderQuery {
  if (reduction.outcome === 'REDUCED') {
    return { sent: makeProviderSafeNewsQuery(reduction.query), outcome: 'REDUCED', unreduced: baseline };
  }
  if (baseline !== undefined && Array.from(baseline).length > GNEWS_QUERY_CODE_POINT_MAX) {
    /* Reported, not acted on. See GNEWS_QUERY_CODE_POINT_MAX. */
    return { sent: baseline, outcome: 'NOT_SAFELY_REDUCIBLE', unreduced: baseline };
  }
  return { sent: baseline, outcome: 'NO_PATTERN_UNCHANGED', unreduced: baseline };
}

/**
 * The primary generic provider query.
 *
 * Reduction runs on WORDS, before punctuation safety, deliberately: the
 * punctuation step can only remove characters, so matching first means the span
 * is found in what the reader actually wrote rather than in a mangled string.
 */
export function makeGenericProviderQuery(genericSearchQuery: string): GenericProviderQuery {
  return resolveSend(makeProviderSafeNewsQuery(genericSearchQuery), reduceNewsQueryForProvider(genericSearchQuery));
}

/**
 * The bounded fallback generic provider query.
 *
 * THE PATTERN IS DELIBERATELY NOT APPLIED HERE, and the reason is evidential
 * rather than cautious. `deriveFallbackNewsQuery()` removes the function words —
 * "and", "in", "the", "of", "please" — which are precisely the terminator and
 * pivot evidence the pattern reads. Matching a span in a string whose structure
 * has already been deleted is matching on an artefact: measured on D1, the
 * pattern found a nine-term "span" that still carried "explain remains uncertain",
 * because the "and explain" terminator no longer existed to stop it.
 *
 * So this lane stays EXACTLY as `9aab213` has it: the existing
 * `deriveFallbackNewsQuery()` contract, unchanged, including its `undefined`
 * (which the caller already treats as "no second attempt"). The M46 two-call
 * behaviour is therefore baseline behaviour, not a reconstruction of it.
 *
 * The one addition is the honesty rule: a fallback that GNews would clamp
 * mid-word is not sent at all. A genuinely better second attempt — the reduced
 * subject with a widened window, say — would be a NEW retrieval behaviour and
 * needs an explicit ruling, not a quiet change inside a correction pass.
 */
export function makeGenericProviderFallbackQuery(genericSearchQuery: string): GenericProviderQuery {
  const fallback = deriveFallbackNewsQuery(genericSearchQuery);
  if (fallback === undefined) {
    return { sent: undefined, outcome: 'NO_PATTERN_UNCHANGED', unreduced: undefined };
  }
  const baseline = makeProviderSafeNewsQuery(fallback);
  if (baseline !== undefined && Array.from(baseline).length > GNEWS_QUERY_CODE_POINT_MAX) {
    /*
      THE FALLBACK IS THE ONE PLACE THE REFUSAL IS SAFE TODAY, and the asymmetry
      is deliberate rather than tidy. This value is read only inside the
      non-compound branch, after `decideFallback()`; a compound plan has already
      spent its bounded searches and never reaches here. `undefined` is also the
      EXISTING contract for "no second attempt", so refusing an over-long
      fallback adds no state and cancels nothing that would otherwise have run.
    */
    return { sent: undefined, outcome: 'NOT_SAFELY_REDUCIBLE', unreduced: baseline };
  }
  return { sent: baseline, outcome: 'NO_PATTERN_UNCHANGED', unreduced: baseline };
}
