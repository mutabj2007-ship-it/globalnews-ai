import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * Milestone #36 — Generic Retrieval Relevance Gate.
 *
 * This is an EVIDENCE-ADMISSION safeguard for AnalysisService's generic
 * (non-country) retrieval path only — see news.service.ts's RelevanceMode
 * union on search() (relevanceMode: { type: 'generic' }). It does NOT claim to
 * solve semantic word-sense ambiguity: a single-word query like "energy"
 * may still admit an article genuinely and repeatedly discussing "dark
 * energy" (cosmology) rather than the energy sector, because both senses
 * produce identical, honest lexical corroboration. That limitation is
 * accepted and intentionally not solved here — see the CTO-approved M36
 * design discussion. Fixing it would require query-context refinement or
 * semantic disambiguation, explicitly out of scope for this milestone.
 *
 * This module is entirely self-contained — it does NOT import from or
 * modify country-relevance.util.ts, and is never applied to country/city
 * retrieval (CountryNewsService), topHeadlines, or byCategory.
 */

export interface GenericRelevanceResult {
  isRelevant: boolean;
  reasons: string[];
  /** Populated only for single-word search phrases, where corroboration counting applies. */
  corroborationCount?: number;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Counts non-overlapping whole-word/whole-phrase occurrences of `phrase`
 * within `text`, case-insensitive and punctuation-tolerant. Mirrors the
 * same word-boundary matching idiom already established by
 * containsWholePhrase() in country-relevance.util.ts, but is a fully
 * independent implementation — this module has no dependency on that
 * file, per Milestone #36's isolation requirement.
 */
function countWholePhraseOccurrences(text: string, phrase: string): number {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return 0;

  const normalizedText = normalize(text);
  if (!normalizedText) return 0;

  const pattern = new RegExp(`\\b${escapeRegExp(normalizedPhrase)}\\b`, 'g');
  const matches = normalizedText.match(pattern);
  return matches ? matches.length : 0;
}

function containsWholePhrase(text: string, phrase: string): boolean {
  return countWholePhraseOccurrences(text, phrase) > 0;
}

/**
 * Milestone #39 — Bounded Relational Inflection Equivalence.
 *
 * RELATIONAL-ONLY: called exclusively from scoreRelationalRelevance()
 * below. scoreGenericRelevance() (Milestone #36) does not call this and
 * its exact-match semantics are completely unchanged — verified by
 * regression tests.
 *
 * WHY THIS CANNOT BECOME GENERAL STEMMING: this function never reduces
 * a word to a "canonical stem" that gets stored, compared elsewhere, or
 * treated as authoritative. It generates a small, bounded SET of
 * candidate phrase variants (at most 2: the original phrase, plus one
 * approved structural variant on the LAST word only) and checks each
 * one with the exact same containsWholePhrase() used everywhere else
 * in this file — completely unmodified. The original exact phrase is
 * always included and always checked first; this is "exact match OR
 * one approved variant match," never a replacement for exact matching.
 *
 * SCOPE — deliberately narrowed to a single, structurally safe surface
 * shape: "...e" <-> "...es" (price/prices, rate/rates, change/changes
 * — your primary required examples), NOT a general "add/remove
 * trailing s" rule. This narrowing is load-bearing, not cosmetic — see
 * the safety property below. No -y/-ies rule, no irregular-plural
 * dictionary (person/people, child/children, man/men, mouse/mice) —
 * these remain unsupported, intentionally and permanently for this
 * milestone.
 *
 * SAFETY PROPERTY (corrected — an earlier, broader "-s"/"+s" rule was
 * found to be unsafe in real review and is NOT what this is):
 * A general "strip any trailing s" rule is unsafe because the result
 * can be a real, different English word with a different meaning —
 * concretely, "news" stripped of its trailing "s" produces "new", a
 * common, unrelated word; an article containing "new" but never "news"
 * would then have been wrongly treated as matching the concept "news".
 * The same failure mode applies to "means" -> "mean". A malformed
 * NON-word candidate (e.g. a hypothetical "busines") is genuinely safe
 * because it essentially never appears in real text — but a candidate
 * that IS a real word is not automatically safe just because it came
 * from a stripped form, and that distinction is exactly what the
 * earlier, broader rule missed.
 *
 * The "...e" <-> "...es" restriction structurally prevents this class
 * of failure, not just in the specific news/means cases but for the
 * whole failure class: the backward (plural -> singular) direction
 * only fires when the word ends in "es" specifically — "news" ends in
 * "ws", not "es" (fails the check, no variant generated at all);
 * "means" ends in "ns", not "es" (same). The forward (singular ->
 * plural) direction only fires when the word already ends in "e" —
 * "new" and "mean" don't, so neither ever generates a "+s" variant
 * either. Words this narrowing correctly leaves unsupported as a
 * result (job/jobs, worker/workers, business/businesses,
 * analysis/analyses, gas/gases, economy/economies) are ACCEPTED false
 * negatives — false negatives are preferable to false positives.
 *
 * Multiword phrases: only the LAST word is varied (per your required
 * examples — "house prices"/"house price", "interest rates"/"interest
 * rate", "climate changes"/"climate change" all differ in exactly one
 * trailing token, and all fit the "...e"/"...es" shape). Every other
 * word in the phrase must still match exactly. This deliberately does
 * NOT attempt "job losses" ~ "jobs were lost" — that requires
 * reordering and a part-of-speech change (noun "losses" -> verb
 * "lost"), not a same-position suffix variant, and is correctly out of
 * scope (see doc comment on scoreRelationalRelevance).
 */
function generatePhraseVariants(phrase: string): string[] {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lastWord = words[words.length - 1];
  const precedingWords = words.slice(0, -1);
  const MIN_BASE_LENGTH = 3;

  const variants = new Set<string>([phrase]);

  // "...e" -> "...es": price -> prices, rate -> rates, change -> changes.
  // Only fires when the word ALREADY ends in "e" — "new" and "mean" do
  // not, so this never generates "news"/"means" from them.
  if (/e$/i.test(lastWord)) {
    variants.add([...precedingWords, `${lastWord}s`].join(' '));
  }

  // "...es" -> "...e": prices -> price, rates -> rate, changes -> change.
  // Only fires when the word ends in "es" SPECIFICALLY (the character
  // immediately before the final "s" must be "e") — this is what
  // structurally excludes "news" (ends in "ws") and "means" (ends in
  // "ns") from ever generating a stripped candidate at all, not merely
  // relying on the candidate being unlikely to match real text.
  if (/es$/i.test(lastWord) && lastWord.length - 1 >= MIN_BASE_LENGTH) {
    variants.add([...precedingWords, lastWord.slice(0, -1)].join(' '));
  }

  return Array.from(variants);
}

/**
 * Milestone #39 — checks the original exact phrase first, then each
 * approved bounded variant from generatePhraseVariants(). Whole-phrase/
 * whole-word boundary protection is entirely inherited from
 * containsWholePhrase() — this function adds no new matching logic of
 * its own, only additional candidate strings to check with it.
 */
function containsWholePhraseWithInflection(text: string, phrase: string): boolean {
  return generatePhraseVariants(phrase).some((variant) => containsWholePhrase(text, variant));
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Milestone #38 — splits text into sentences on '.', '!', or '?'
 * followed by whitespace (or end of string). Deliberately simple:
 * no NLP/sentence-tokenizer library, consistent with this module's
 * no-NLP discipline. Good enough for the local-context check below —
 * it doesn't need to be a linguistically perfect sentence boundary,
 * only a conservative proxy for "these two mentions are part of the
 * same statement" vs. "these are unrelated statements stapled
 * together in one article."
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Milestone #38 — non-causal relational connector words/phrases. This
 * is your own approved enumeration, used ONLY as informational
 * evidence in the returned `reasons` — see scoreRelationalRelevance's
 * causal-safety doc comment below. Presence is never required for
 * KEEP and never gates the isRelevant decision.
 */
const RELATIONAL_CONNECTORS = [
  'affect', 'affects', 'affecting',
  'impact', 'impacts', 'impacting',
  'drive', 'drives', 'driving',
  'lift', 'lifts', 'lifting',
  'lower', 'lowers', 'lowering',
  'raise', 'raises', 'raising',
  'reduce', 'reduces', 'reducing',
  'increase', 'increases', 'increasing',
  'decrease', 'decreases', 'decreasing',
  'hit', 'hits', 'hitting',
  'hurt', 'hurts', 'hurting',
  'boost', 'boosts', 'boosting',
  'pressure', 'pressures', 'pressuring',
  'lead to', 'leads to', 'leading to',
  'because',
  'due to',
  'amid',
  'as',
  'after',
  'linked to',
  'associated with',
];

/**
 * Milestone #38 — informational only. Returns a single reasons-array
 * entry naming which connector(s) were found in the given local
 * context (a title or a single qualifying summary sentence), or an
 * empty array if none were found. This NEVER affects isRelevant.
 */
function detectConnectors(localContext: string): string[] {
  const found = RELATIONAL_CONNECTORS.filter((connector) =>
    containsWholePhrase(localContext, connector),
  );
  return found.length > 0
    ? [`non-causal relational connector(s) present: ${found.join(', ')}`]
    : [];
}

/**
 * Milestone #37/#38 — Relational Query Decomposition & Evidence
 * Qualification.
 *
 * CAUSAL-SAFETY BOUNDARY (read this first): this function establishes
 * ONLY "this article contains evidence relevant to the relationship
 * between X and Y." It NEVER establishes, encodes, or implies "X
 * causes Y", "X caused Y", or "Y resulted from Y". The connector words
 * checked below (affect, impact, amid, linked to, etc.) exist solely
 * to make the returned `reasons` more informative for debugging/
 * future evidence-layer use — their presence is never required for
 * admission and never appears anywhere in the isRelevant decision
 * itself. Causal interpretation belongs to a later, separate,
 * not-yet-built evidence/AI reasoning layer — this function does not
 * approach that boundary at all.
 *
 * TWO-STAGE ADMISSION (Milestone #38 strengthens what was, under
 * Milestone #37, a single flat check):
 *
 * Stage 1 — BASE PRESENCE (unchanged from M37): X must be present as a
 * whole phrase somewhere in the article (title or summary), and
 * separately so must Y. If either is absent, REJECT immediately — this
 * requirement is not weakened by anything below.
 *
 * Stage 2 — RELATIONAL CONTEXT (new in M38): passing Stage 1 is no
 * longer sufficient by itself. Both concepts must ALSO appear together
 * in the SAME local context — either both within the title, or both
 * within one single summary sentence (see splitIntoSentences above).
 * An article where X appears in one sentence and Y appears in a
 * different, unrelated sentence — the scattered/disconnected-mentions
 * case real-browser M37 testing exposed as too permissive — now fails
 * Stage 2 and is REJECTED, even though it would have passed M37's
 * original article-wide co-occurrence check.
 *
 * Deliberately does NOT apply scoreGenericRelevance's single-word
 * corroboration-count model to X or Y independently — unchanged
 * reasoning from M37 (see prior design discussion): the presence of
 * TWO distinct, independently-required concepts, now additionally
 * required to co-occur in one local context, is itself the
 * corroboration for relational retrieval.
 *
 * KNOWN LIMITATION (Milestone #38, narrowed by Milestone #39 — see
 * that function's own doc comment above for exactly what's covered):
 * matching remains deterministic with NO synonym expansion and NO
 * general stemming. Milestone #39 added a small, bounded regular "+s"
 * inflection variant (price/prices, rate/rates, change/changes), so
 * "house price" NOW matches a derived Y of "house prices" — but
 * "jobs" still does NOT match "employment", "maize production" still
 * does NOT match "agriculture", "Middle East conflict" still does NOT
 * match "Iran conflict", and irregular plurals (person/people,
 * child/children, man/men, mouse/mice) remain unsupported. These
 * remain accepted, disclosed lexical/semantic gaps — concept-synonym
 * and semantic equivalence handling is explicitly deferred to a
 * separate, future milestone, not addressed here.
 */
export function scoreRelationalRelevance(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  x: string,
  y: string,
): { isRelevant: boolean; reasons: string[] } {
  const title = article.title ?? '';
  const summary = article.summary ?? '';

  const normalizedX = normalize(x);
  const normalizedY = normalize(y);

  // Never admit an empty/invalid concept accidentally.
  if (!normalizedX || !normalizedY) {
    return { isRelevant: false, reasons: ['empty or invalid X/Y concept'] };
  }

  // Stage 1 — base presence. M37's exact-match requirement is not
  // weakened; Milestone #39 only widens WHAT counts as "present" to
  // also include one approved bounded inflectional variant (see
  // containsWholePhraseWithInflection's doc comment) — it never makes
  // presence easier to satisfy in any other way.
  const xPresentAnywhere =
    containsWholePhraseWithInflection(title, normalizedX) ||
    containsWholePhraseWithInflection(summary, normalizedX);
  if (!xPresentAnywhere) {
    return { isRelevant: false, reasons: ['X absent'] };
  }

  const yPresentAnywhere =
    containsWholePhraseWithInflection(title, normalizedY) ||
    containsWholePhraseWithInflection(summary, normalizedY);
  if (!yPresentAnywhere) {
    return { isRelevant: false, reasons: ['Y absent'] };
  }

  const baseReasons = ['X present in title or summary', 'Y present in title or summary'];

  // Stage 2 — relational context (Milestone #38, WHERE requirement
  // unchanged by Milestone #39 — only WHAT counts as a match at each
  // location is widened, exactly as in Stage 1 above). Both concepts
  // together in the title is the strongest, simplest case.
  const bothInTitle =
    containsWholePhraseWithInflection(title, normalizedX) &&
    containsWholePhraseWithInflection(title, normalizedY);

  if (bothInTitle) {
    return {
      isRelevant: true,
      reasons: [
        ...baseReasons,
        'both concepts present together in the title',
        ...detectConnectors(title),
      ],
    };
  }

  // Otherwise, both concepts must co-occur within the SAME summary
  // sentence — scattered mentions across different sentences (e.g.
  // "Climate change continues. Separately, agricultural exports
  // rise.") do not qualify, even though both concepts are present
  // somewhere in the article per Stage 1. This WHERE requirement is
  // completely unchanged by Milestone #39: an inflectional match in
  // one sentence and the other concept's match in a different sentence
  // still does not satisfy this condition.
  const connectingSentence = splitIntoSentences(summary).find(
    (sentence) =>
      containsWholePhraseWithInflection(sentence, normalizedX) &&
      containsWholePhraseWithInflection(sentence, normalizedY),
  );

  if (connectingSentence) {
    return {
      isRelevant: true,
      reasons: [
        ...baseReasons,
        'both concepts present together in the same summary sentence',
        ...detectConnectors(connectingSentence),
      ],
    };
  }

  return {
    isRelevant: false,
    reasons: [
      ...baseReasons,
      'both concepts present in the article, but never co-located in the title or a single summary sentence (scattered/disconnected mentions)',
    ],
  };
}

/**
 * Milestone #36 — evidence-admission gate for one generic-search article
 * against the M35-derived search phrase.
 *
 * One-word phrases (e.g. "energy", "climate", "cybersecurity", "OpenAI"):
 * corroboration-count model. No single signal — however strong — may
 * admit the article alone (approved M36 correction: a lone title match
 * is NOT sufficient). Requires at least 2 of: title match, summary
 * match, summary repeated (2+ occurrences), category alignment (the
 * search word exactly equals the article's own already-computed
 * NewsCategory — never an invented word-to-category mapping).
 *
 * Two-or-more-word phrases (e.g. "Middle East", "quantum computing", or
 * an M35 fallback near-verbatim sentence): requires the ENTIRE phrase to
 * appear as a single whole-phrase match in the title or summary — never
 * reduced to individual-token matching. This single rule correctly
 * covers both the 2-3 word "concise phrase" case and the 4+ word
 * "M35 fallback sentence" case identically, since both require the
 * complete phrase, not a partial token overlap.
 */
export function scoreGenericRelevance(
  article: Pick<NewsArticle, 'title' | 'summary' | 'category'>,
  searchPhrase: string,
): GenericRelevanceResult {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  const normalizedPhrase = normalize(searchPhrase);

  // Never admit an empty/invalid search phrase accidentally.
  if (!normalizedPhrase) {
    return { isRelevant: false, reasons: ['empty or invalid search phrase'] };
  }

  const phraseWordCount = wordCount(normalizedPhrase);

  if (phraseWordCount === 1) {
    const reasons: string[] = [];
    let corroborationCount = 0;

    const titleMatch = containsWholePhrase(title, normalizedPhrase);
    if (titleMatch) {
      corroborationCount += 1;
      reasons.push('title match');
    }

    const summaryOccurrences = countWholePhraseOccurrences(summary, normalizedPhrase);
    if (summaryOccurrences >= 1) {
      corroborationCount += 1;
      reasons.push('summary match');
    }
    if (summaryOccurrences >= 2) {
      corroborationCount += 1;
      reasons.push('summary repeated');
    }

    const categoryAlignment = normalizedPhrase === article.category;
    if (categoryAlignment) {
      corroborationCount += 1;
      reasons.push('category alignment');
    }

    if (corroborationCount < 2) {
      reasons.push('insufficient corroboration for a single-word query (requires >= 2 independent signals)');
    }

    return {
      isRelevant: corroborationCount >= 2,
      reasons,
      corroborationCount,
    };
  }

  // Two or more words: require the complete phrase, not a partial
  // token overlap, as a whole-phrase match in title or summary.
  const wholePhraseMatched =
    containsWholePhrase(title, normalizedPhrase) || containsWholePhrase(summary, normalizedPhrase);

  return {
    isRelevant: wholePhraseMatched,
    reasons: wholePhraseMatched
      ? ['whole-phrase match']
      : ['no whole-phrase match for a multiword query'],
  };
}
