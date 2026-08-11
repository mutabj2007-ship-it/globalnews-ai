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
 * KNOWN LIMITATION (deliberately NOT addressed in M38 — see the
 * approved M38 design/scope): this remains exact deterministic
 * whole-phrase matching with NO synonym expansion, no stemming, and no
 * singular/plural normalization. "house price" does NOT match a
 * derived Y of "house prices"; "jobs" does NOT match "employment";
 * "maize production" does NOT match "agriculture". These are accepted,
 * disclosed lexical gaps — concept-equivalence handling is explicitly
 * deferred to a separate, future milestone, not fixed here.
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

  // Stage 1 — base presence, unchanged from M37, not weakened.
  const xPresentAnywhere =
    containsWholePhrase(title, normalizedX) || containsWholePhrase(summary, normalizedX);
  if (!xPresentAnywhere) {
    return { isRelevant: false, reasons: ['X absent'] };
  }

  const yPresentAnywhere =
    containsWholePhrase(title, normalizedY) || containsWholePhrase(summary, normalizedY);
  if (!yPresentAnywhere) {
    return { isRelevant: false, reasons: ['Y absent'] };
  }

  const baseReasons = ['X present in title or summary', 'Y present in title or summary'];

  // Stage 2 — relational context (Milestone #38). Both concepts
  // together in the title is the strongest, simplest case.
  const bothInTitle =
    containsWholePhrase(title, normalizedX) && containsWholePhrase(title, normalizedY);

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
  // somewhere in the article per Stage 1.
  const connectingSentence = splitIntoSentences(summary).find(
    (sentence) =>
      containsWholePhrase(sentence, normalizedX) && containsWholePhrase(sentence, normalizedY),
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
