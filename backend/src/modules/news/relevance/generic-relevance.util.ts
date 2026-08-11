import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * Milestone #36 — Generic Retrieval Relevance Gate.
 *
 * This is an EVIDENCE-ADMISSION safeguard for AnalysisService's generic
 * (non-country) retrieval path only — see news.service.ts's optional
 * applyGenericRelevanceGate parameter on search(). It does NOT claim to
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
