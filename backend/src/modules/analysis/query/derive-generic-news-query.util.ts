/**
 * Milestone #35 — News Query Normalization & Generic Retrieval.
 *
 * AnalysisService#detectLocation() (see ../service/analysis.service.ts)
 * already fully owns country/city routing. This module is called ONLY
 * from that service's existing generic-search branch, strictly AFTER
 * detectLocation() has returned undefined — it has no visibility into,
 * and no effect on, country or city resolution.
 *
 * Purpose: when a user's query is a natural-language question rather
 * than a concise topic ("What's happening with NATO?" vs "NATO"),
 * sending the whole sentence to the news provider's free-text search
 * degrades retrieval quality. This derives a shorter provider search
 * phrase using a small, closed set of deterministic pattern rules —
 * never an AI call, never general stopword removal, never destructive
 * rewriting of an already-concise query.
 *
 * Safety invariant: the result is NEVER empty, and is never "worse"
 * than the input — see deriveGenericNewsQuery's fallback rule.
 */

/**
 * Ordered, first-match-wins. Each pattern must capture the intended
 * search subject in group 1. Deliberately does NOT reuse or extend
 * AnalysisService's COUNTRY_CONTEXT_PATTERN (which lacks "with" and is
 * load-bearing for country routing) — this is an entirely separate
 * pattern set with no shared state.
 */
const SUBJECT_EXTRACTION_PATTERNS: RegExp[] = [
  // "What's happening in/with/on/about/for/regarding X"
  // "What is happening ... X" / "What's going on with X" / "What's new with X" / "What's the latest on X"
  // ASK/SEARCH R1 — the Home suggestion "What's happening in the Middle East
  // right now?" captured "Middle East right now", which the whole-phrase
  // relevance gate then required verbatim in headlines, so almost every live
  // article was rejected. Same optional trailing time-phrase group, and the
  // same non-greedy capture, that the Milestone #46 patterns below use.
  /^(?:what'?s|what\s+is)\s+(?:happening|going\s+on|new|the\s+latest)\s+(?:in|with|on|about|for|regarding)\s+(.+?)(?:\s+right\s+now|\s+today|\s+currently)?$/i,
  // "latest/recent news on/about/regarding X"
  /^(?:latest|recent)\s+news\s+(?:on|about|regarding)\s+(.+)$/i,
  // "latest/recent X news" (non-greedy so it captures the shortest middle phrase)
  /^(?:latest|recent)\s+(.+?)\s+news$/i,
  // "news on/about/regarding X"
  /^news\s+(?:on|about|regarding)\s+(.+)$/i,
  // Milestone #46 — "What are/is the [most important/latest/key/...]
  // developments/updates/news/happenings in/with/on/about/for/regarding
  // X [right now/today/currently]?" — the exact real-runtime failure
  // shape ("What are the most important developments in NATO right
  // now?") did not match any pattern above, so the entire sentence was
  // sent to the provider verbatim. Non-greedy capture + an optional
  // trailing time-phrase group correctly strips "right now"/"today"/
  // "currently" from the end without needing them to be present.
  /^what\s+(?:are|is)\s+the\s+(?:most\s+important\s+|latest\s+|key\s+|major\s+|biggest\s+|current\s+|top\s+|recent\s+)*(?:developments|updates|news|happenings)\s+(?:in|with|on|about|for|regarding)\s+(.+?)(?:\s+right\s+now|\s+today|\s+currently)?$/i,
  // Milestone #46 — "Tell me about X"
  /^tell\s+me\s+about\s+(.+)$/i,
  /*
   * G-ALPHA-1 — THE BACKGROUND/"WHAT DO YOU KNOW" FAMILY.
   *
   * The reported live failure was "What do you know about President Donald
   * Trump?", and no pattern above covers it. The fallback rule then returns the
   * whole sentence, which becomes BOTH the provider query AND the phrase the
   * multi-word relevance gate demands verbatim in a headline — so every article
   * the provider returned was rejected and the question could only ever answer
   * zero. Measured on the shipped code before this change:
   *
   *   derived query -> "What do you know about President Donald Trump"
   *   [REJECT] Trump says tariffs will return in January
   *   [REJECT] Donald Trump addresses rally in Ohio
   *   [REJECT] President Donald Trump comments on the budget
   *
   * These three patterns are the same shape as every rule above them: closed,
   * ordered, first-match-wins, capturing the subject in group 1, and subject to
   * the same "must be strictly shorter than the input" safety rule. They add no
   * stemming, no stopword removal and no AI. NOTHING ABOUT RELEVANCE SCORING
   * CHANGES — a two-word subject still has to appear as a whole phrase.
   *
   * "Tell me about X" is deliberately NOT re-added: Milestone #46 already
   * covers it on the line directly above, and a duplicate pattern would be a
   * second place for the same rule to drift.
   */
  /*
   * G-SEARCH-POLISH-PARITY-1 — THE POLISH CONVERSATIONAL FRAMES.
   *
   * MEASURED: every Polish conversational question derived THE WHOLE SENTENCE,
   * which the multi-word relevance gate then requires verbatim in a headline.
   * No headline is an interrogative sentence, so these queries could only ever
   * return zero. English had the frames; Polish did not.
   *
   * HOW FAR THIS CAN GO IS DECIDED BY POLISH GRAMMAR, NOT BY THIS LIST.
   * The preposition "o" governs the LOCATIVE case, so the captured span is
   * inflected. Measured against real nominative headlines:
   *
   *   "NATO"              -> appears verbatim        -> FULLY FIXED
   *   "Kigali"            -> appears verbatim        -> FULLY FIXED
   *   "Donaldzie Trumpie" -> does NOT appear         -> retrieval improves,
   *   "Emmanuelu Macronie"-> does NOT appear            the gate still rejects
   *
   * So indeclinable subjects — acronyms, and the many foreign place names
   * Polish does not decline — are fixed outright. INFLECTED PERSONAL NAMES ARE
   * NOT, and cannot be by any pattern here: closing that needs morphology this
   * repository deliberately does not carry. IT IS STILL NOT A REGRESSION — the
   * whole sentence matched nothing either, and the provider query becomes a
   * real name instead of a question.
   *
   * DECLINED COUNTRIES ARE ALREADY COVERED ELSEWHERE and must not be confused
   * with this limit: "w Rwandzie" resolves through the curated Polish country
   * forms (G-ALPHA-2.1), not through subject extraction.
   *
   * Same shape as every rule here: closed, ordered, first-match-wins, subject
   * in group 1, and subject to the same "strictly shorter than the input"
   * safety rule. The /u flag makes ą ć ę ł ń ó ś ź ż letters, and each frame
   * accepts the bare-ASCII spelling because Polish is commonly typed without
   * diacritics.
   */
  // "Co wiesz o X" — what do you know about X
  /^co\s+wiesz\s+o\s+(.+)$/iu,
  // "Co możesz (mi) powiedzieć o X" — what can you tell me about X
  /^co\s+mo[żz]esz\s+(?:mi\s+)?powiedzie[ćc]\s+o\s+(.+)$/iu,
  // "Czy wiesz coś o X" — do you know anything about X
  /^czy\s+wiesz\s+co[śs]\s+o\s+(.+)$/iu,
  // "Opowiedz / Powiedz mi o X" — tell me about X
  /^(?:opowiedz|powiedz)\s+(?:mi\s+)?o\s+(.+)$/iu,

  // "What do you know about/of/on/regarding X"
  /^what\s+do\s+you\s+know\s+(?:about|of|on|regarding)\s+(.+)$/i,
  // "What can you tell me about X" / "What can you say about X"
  /^what\s+can\s+you\s+(?:tell\s+me|say)\s+(?:about|of|on|regarding)\s+(.+)$/i,
  // "Do you know anything/much/something about X"
  /^do\s+you\s+know\s+(?:anything|much|something)\s+(?:about|of|on|regarding)\s+(.+)$/i,
  // Milestone #46 — "Give me the latest on/about/regarding X"
  /^give\s+me\s+the\s+latest\s+(?:on|about|regarding)\s+(.+)$/i,
  // Milestone #46 (CI correction) — the SHORT form of the pattern
  // above, WITHOUT a leading "What are/is the": "[Most important/
  // Latest/Key/...] developments/updates/news/happenings in/with/on/
  // about/for/regarding X [right now/today/currently]?" — e.g. "Latest
  // developments in semiconductor exports", "Latest developments in
  // NATO", "Most important developments in oil prices". Confirmed via
  // real-machine CI failure that this shorter, equally natural
  // phrasing (no "What are the" prefix) was not covered by the longer
  // pattern above, which requires that prefix. Deliberately reuses the
  // exact same adjective/noun/preposition/trailing-time-phrase
  // vocabulary as the longer pattern for consistency — this is not a
  // new, separately-tuned pattern, just the same shape without the
  // leading question-word clause.
  /^(?:most\s+important\s+|latest\s+|key\s+|major\s+|biggest\s+|current\s+|top\s+|recent\s+)+(?:developments|updates|news|happenings)\s+(?:in|with|on|about|for|regarding)\s+(.+?)(?:\s+right\s+now|\s+today|\s+currently)?$/i,
];

/** Strips exactly one leading "the " from an extracted subject (mirrors the same idiom already used in AnalysisService#detectLocation's word-shrinking scan — a separate local instance, not a shared call). */
function stripLeadingThe(value: string): string {
  return value.replace(/^(?:the)\s+/i, '').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * Derives a concise provider search phrase from a query that has
 * already failed country/city detection.
 *
 * Input is expected to already be the output of normalizeQuery()
 * (smart quotes/whitespace/contraction-punctuation already handled
 * upstream) — this function only strips trailing terminal punctuation
 * itself and applies the subject-extraction patterns above.
 *
 * Fallback rule (never destructive, never empty): a candidate from the
 * pattern list is used ONLY if it is non-empty AND has fewer words
 * than the punctuation-stripped input. Otherwise the punctuation-
 * stripped input itself is returned unchanged — this is what keeps
 * already-concise queries ("NATO", "East Africa") as no-ops, and what
 * keeps an unmatched sentence ("What is quantum?") from being emptied
 * or mangled rather than confidently shortened.
 */
export function deriveGenericNewsQuery(normalizedQuery: string): string {
  const base = stripTrailingPunctuation(normalizedQuery);

  if (base.length === 0) {
    // Defensive only — AnalysisService never calls this with an empty
    // query (analyzeNews already short-circuits on that earlier), but
    // the safety invariant (never return empty) must hold regardless
    // of caller behavior.
    return normalizedQuery.trim();
  }

  const baseWordCount = wordCount(base);

  for (const pattern of SUBJECT_EXTRACTION_PATTERNS) {
    const match = base.match(pattern);
    const captured = match?.[1] ? stripLeadingThe(match[1].trim()) : undefined;

    if (captured && captured.length > 0 && wordCount(captured) < baseWordCount) {
      return captured;
    }
  }

  return base;
}

/**
 * Milestone #46 — small, closed stopword list used ONLY by
 * deriveFallbackNewsQuery() below, never by the primary subject-
 * extraction patterns above and never applied to the raw user
 * sentence. Deliberately narrow: common function/question words and
 * the generic "news framing" vocabulary itself (developments, updates,
 * news, latest, etc.) that carry no topical meaning of their own once
 * a query has already failed to match a more specific pattern above.
 */
const FALLBACK_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'about',
  'regarding',
  'right',
  'now',
  'today',
  'currently',
  'this',
  'that',
  'these',
  'those',
  'and',
  'or',
  'but',
  'most',
  'important',
  'latest',
  'recent',
  'current',
  'key',
  'major',
  'top',
  'new',
  'happening',
  'happenings',
  'developments',
  'development',
  'updates',
  'update',
  'news',
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'going',
  'tell',
  'me',
  'give',
  'us',
]);

/**
 * Milestone #46 — Bounded Fallback Retrieval.
 *
 * Used ONLY by AnalysisService's generic branch, and ONLY as a single,
 * capped second attempt when the PRIMARY deriveGenericNewsQuery()
 * result yields zero relevant articles from the provider (post
 * relevance-gate) — never called speculatively, never chained into a
 * second fallback of its own, never a multi-query fan-out. See
 * AnalysisService's generic branch for the exact trigger condition.
 *
 * Deterministic, zero AI calls: strips the small closed stopword set
 * above from the ALREADY-derived primary query (never the raw user
 * sentence — this is a second, narrower pass over what
 * deriveGenericNewsQuery() already produced), leaving only the
 * remaining significant terms as the fallback provider search phrase.
 *
 * Returns undefined — never an empty string, and never the identical
 * query again — when stripping would remove every word, or would strip
 * nothing at all (which would just re-run an identical, already-failed
 * search). AnalysisService is expected to skip the fallback attempt
 * entirely when this returns undefined.
 */
export function deriveFallbackNewsQuery(primaryDerivedQuery: string): string | undefined {
  const words = primaryDerivedQuery.trim().split(/\s+/).filter(Boolean);
  const significant = words.filter((word) => !FALLBACK_STOPWORDS.has(word.toLowerCase()));

  if (significant.length === 0) return undefined;
  if (significant.length === words.length) return undefined;

  return significant.join(' ');
}

/**
 * Query-limit correction — the intended provider-safe length target
 * for a GNews `q` search phrase. Kept below GNews's own documented
 * 200-code-point hard maximum (see GNewsProvider.search()'s own
 * unconditional backstop) so this reduction step has a genuine chance
 * of avoiding that backstop for realistic long questions, rather than
 * aiming exactly at the boundary.
 */
const PROVIDER_TARGET_MAX_LENGTH = 180;

/**
 * Query-limit correction (wiring revision) — a pure, narrow
 * provider-safety step. Deliberately does NOT call
 * deriveGenericNewsQuery() itself — it accepts an ALREADY-DERIVED
 * retrieval query (the caller's job, e.g. AnalysisService, is to
 * derive first, then pass that specific string here) and applies
 * length-safety only.
 *
 * This shape exists specifically so it can be applied independently
 * to BOTH of AnalysisService's existing generic-retrieval call sites
 * — the primary derived query AND the M46 zero-result fallback query
 * — without re-deriving from the raw user question each time, which
 * would otherwise let the M46 retry silently become identical to the
 * primary attempt whenever the primary needed length-reduction (see
 * this function's own call sites in analysis.service.ts for the
 * redundancy guard that also depends on this narrow contract).
 *
 * If the input already fits PROVIDER_TARGET_MAX_LENGTH, it is
 * returned completely unchanged. Otherwise this reuses the EXISTING
 * deriveFallbackNewsQuery() — its stopword-stripping structurally
 * tends to leave proper nouns and topical terms (geography,
 * organizations, named entities) behind, since those were never in
 * the stopword set to begin with. This is a genuine SEMANTIC
 * reduction, not a blind truncation.
 *
 * If that reduction still isn't short enough (or
 * deriveFallbackNewsQuery() returns undefined because stripping
 * wouldn't help), the longer input is still returned here —
 * GNewsProvider.search()'s own unconditional, Unicode-safe ≤200
 * backstop remains the final, independent guarantee regardless of
 * what this function produces. This function's job is to make that
 * backstop rarely necessary, not to replace it.
 */
/**
 * PROVIDER PUNCTUATION SAFETY — the measured HTTP 400.
 *
 * GNews rejects unquoted special characters in `q`. Its own documentation
 * says so plainly ("It is not possible to use special characters without
 * putting quotes around them") and lists "malformed query syntax" among the
 * causes of HTTP 400. The real Windows host proved it against the live
 * credential with a one-variable-at-a-time ladder:
 *
 *     q=What are the latest political, economic, security and regional
 *       developments affecting Rwanda            -> 400   (two commas)
 *     the identical sentence with the commas removed
 *                                                -> 200
 *     q=political, economic       19 characters  -> 400   (ONE comma is enough)
 *     q=Rwanda?                                  -> 400   (documented example)
 *     q=Rwanda                                   -> 200
 *
 * The 19-character probe is what makes this conclusive: a single comma fails
 * a query far shorter than any length limit, so length and term count are
 * excluded as causes. `max` was independently disproved by the same host —
 * max=10 and max=20 both return 200.
 *
 * WHY NOT QUOTE THE WHOLE QUERY. Quoting is the remedy GNews documents, and
 * the host confirmed a quoted sentence returns 200. It is still wrong here:
 * quotes make GNews match the string as an EXACT PHRASE, so a thirteen-word
 * question would retrieve nothing. A 200 with zero articles is not an
 * improvement on a 400. Removing the punctuation keeps every word as an
 * independent AND term, which is what a retrieval query should be.
 *
 * WHY NOT AN ASCII-ONLY FILTER. `[^A-Za-z0-9 ]` would delete every Polish
 * letter — "bezpieczeństwo" would become "bezpiecze stwo" and "Łódź" would
 * vanish entirely — silently destroying Polish retrieval to fix an English
 * one. The class below is Unicode-aware: \p{L} keeps every letter in every
 * script and \p{N} keeps every numeral, so Polish, and any language added
 * later, survives unchanged. (The `u` flag is required for \p{...}; the
 * backend targets ES2021, where it is available.)
 *
 * REMOVED PUNCTUATION BECOMES A SPACE, never nothing. Deleting the comma in
 * "Rwanda,security" would fuse two terms into the single nonsense token
 * "Rwandasecurity"; replacing it with a space yields two correct AND terms.
 * Runs of whitespace are then collapsed so the result never contains a double
 * space or leading/trailing space.
 *
 * SCOPE. This changes ONLY the string sent to the provider. normalizedQuery —
 * which feeds the AI prompt, the cache key, response.query and everything the
 * user sees — is untouched, exactly as this function's existing contract
 * already promised. This function was already the single provider-safety
 * chokepoint applied to BOTH the primary and the bounded-fallback generic
 * retrieval call sites, so the correction lands in one place and needs no new
 * wiring anywhere.
 */
const PROVIDER_UNSAFE_CHARACTERS = /[^\p{L}\p{N}\s]/gu;

export function toProviderSafePunctuation(query: string): string {
  return query.replace(PROVIDER_UNSAFE_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * PROVIDER-SAFETY EDGE CLOSURE (CTO amendment to the approved punctuation
 * correction).
 *
 * The approved version ended its defensive branch like this:
 *
 *     const base = safe.length > 0 ? safe : derivedQuery;
 *
 * — that is, when sanitization left NO Unicode letter or numeral at all, it
 * restored the ORIGINAL punctuation-only string and sent it. That is the one
 * input for which the whole correction was written: a `q` made of nothing but
 * symbols is precisely the malformed-query-syntax shape GNews answers with
 * HTTP 400, and the two-line comment defending it ("the caller's relevance
 * gate will discard whatever such a query returns") assumed a response that
 * never arrives. The request is refused before there is anything to gate.
 *
 * THE HONEST RESULT IS `undefined`, NOT A GUESS. There are exactly three
 * things this function could do with a query that contains no lexical content:
 *
 *   1. send the punctuation anyway            -> a guaranteed, avoidable 400
 *   2. invent a substitute ("news", "world")  -> retrieval the user never asked
 *                                                for, presented as if they had
 *   3. say there is no retrievable query      -> this
 *
 * Only (3) is truthful. `undefined` is not an error and is never thrown: it is
 * a normal, expected return that callers must handle by NOT calling the
 * provider. AnalysisService's existing zero-evidence surface — the same one
 * that already governs a genuine empty result — then produces the honest
 * "nothing to analyze" response, and OpenAI is still never reached. No new
 * user-facing state was invented for this.
 *
 * Returning `string | undefined` rather than adding a second function is
 * deliberate: an optional sibling would leave the unsafe overload in place for
 * a future call site to reach for by accident. There is one provider-safety
 * chokepoint, and after this change it cannot emit an unusable query at all.
 */
export function makeProviderSafeNewsQuery(derivedQuery: string): string | undefined {
  /*
   * Punctuation safety FIRST. It is the correctness step — a query that keeps
   * a comma is refused outright — and it can only shorten the string, so the
   * length rule below still sees a value it can judge.
   */
  const base = toProviderSafePunctuation(derivedQuery);

  /*
   * No Unicode letter or numeral survived, so there is no lexical query to
   * send. See the block comment above: the caller must skip retrieval rather
   * than substitute anything.
   */
  if (base.length === 0) {
    return undefined;
  }

  if (base.length <= PROVIDER_TARGET_MAX_LENGTH) {
    return base;
  }

  const reduced = deriveFallbackNewsQuery(base);
  if (reduced && reduced.length < base.length) {
    return reduced;
  }

  return base;
}
