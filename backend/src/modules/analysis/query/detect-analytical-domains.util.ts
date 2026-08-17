/**
 * Milestone #63 — analytical-domain detection for bounded multi-domain
 * retrieval.
 *
 * Deliberately SEPARATE from NewsCategory / classifyCategory() (see
 * shared/src/news.ts, classify-category.util.ts). NewsCategory is a
 * generic news-site taxonomy (world/politics/business/technology/
 * science/health/sports/entertainment) built for a different purpose
 * (labeling one article for site navigation/filtering). The live M63
 * Phase 2 diagnostic run demonstrated this directly: NPR's
 * healthcare-drone story was classified 'politics' by the existing
 * classifier — a real, observed case of it not reliably indicating an
 * article's genuine analytical-domain content. This module never
 * imports classifyCategory() or NewsCategory, and never mutates the
 * existing site taxonomy — it is a new, independent, purpose-built
 * keyword layer used ONLY for this feature: detecting which of the
 * eight analytical domains a broad question requests, which of those
 * domains the retrieved evidence already represents, and which are
 * genuinely missing.
 *
 * Pure, deterministic, zero AI calls, zero network calls — matching
 * every other query-derivation/classification module in this
 * repository.
 */

/**
 * The eight first-class analytical domains this feature supports.
 * All eight are treated identically — none is derived from or
 * dependent on any existing classifier.
 */
export type AnalyticalDomain =
  | 'political'
  | 'economic'
  | 'security'
  | 'diplomatic'
  | 'social'
  | 'infrastructure'
  | 'technology'
  | 'regional';

export const ANALYTICAL_DOMAINS: readonly AnalyticalDomain[] = [
  'political',
  'economic',
  'security',
  'diplomatic',
  'social',
  'infrastructure',
  'technology',
  'regional',
];

/**
 * Small, curated keyword lists — not an attempt at exhaustive NLP
 * classification. Substring matching against lowercased text, the
 * same practical tradeoff already accepted elsewhere in this
 * repository (e.g. FALLBACK_STOPWORDS, CATEGORY_RULES).
 */
const DOMAIN_KEYWORDS: Record<AnalyticalDomain, string[]> = {
  political: ['political', 'politics', 'government', 'president', 'parliament', 'minister', 'election'],
  economic: ['economic', 'economy', 'trade', 'investment', 'financial', 'finance', 'gdp', 'business'],
  security: ['security', 'military', 'armed forces', 'conflict', 'violence', 'threat', 'defense', 'defence'],
  diplomatic: ['diplomatic', 'diplomacy', 'bilateral', 'embassy', 'ambassador', 'foreign relations', 'summit'],
  social: ['social', 'society', 'community', 'education', 'healthcare', 'health care', 'welfare', 'humanitarian'],
  infrastructure: ['infrastructure', 'roads', 'transport', 'construction', 'energy', 'utilities', 'railway', 'airport'],
  technology: ['technology', 'technological', 'digital', 'innovation', 'internet', 'software', 'telecom'],
  regional: ['regional', 'neighboring', 'neighbouring', 'cross-border', 'cross border', 'region'],
};

/**
 * One canonical, short supplemental provider search term per domain —
 * used only to build "<country.name> <term>" for a bounded
 * supplemental search. Deliberately generic (not Rwanda-specific).
 */
const DOMAIN_SEARCH_TERMS: Record<AnalyticalDomain, string> = {
  political: 'politics',
  economic: 'economy',
  security: 'security',
  diplomatic: 'diplomacy',
  social: 'social affairs',
  infrastructure: 'infrastructure',
  technology: 'technology',
  regional: 'regional affairs',
};

export interface DetectedDomainOccurrence {
  domain: AnalyticalDomain;
  /** Index of the domain's earliest matching keyword in the lowercased question text. */
  firstIndex: number;
}

/**
 * Scans the raw question text for each of the eight analytical
 * domains and returns every domain that matches at least one keyword,
 * ordered by the EARLIEST position any of that domain's keywords
 * appears in the text — this ordering is what
 * selectMissingDomains() uses for deterministic first-mentioned
 * priority.
 */
export function detectRequestedDomains(questionText: string): DetectedDomainOccurrence[] {
  const normalized = questionText.toLowerCase();
  const occurrences: DetectedDomainOccurrence[] = [];

  for (const domain of ANALYTICAL_DOMAINS) {
    let earliestIndex = -1;

    for (const keyword of DOMAIN_KEYWORDS[domain]) {
      const index = normalized.indexOf(keyword);

      if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
        earliestIndex = index;
      }
    }

    if (earliestIndex !== -1) {
      occurrences.push({ domain, firstIndex: earliestIndex });
    }
  }

  return occurrences.sort((a, b) => a.firstIndex - b.firstIndex);
}

/**
 * Three or more distinct explicitly detected analytical domains in
 * the question marks it as broad/multi-domain — the sole trigger for
 * considering supplemental retrieval at all. Fewer than three
 * preserves today's single-country-retrieval behavior unconditionally.
 */
export function isBroadMultiDomainQuestion(requestedDomains: DetectedDomainOccurrence[]): boolean {
  return requestedDomains.length >= 3;
}

/**
 * Determines which analytical domains the CANDIDATE EVIDENCE already
 * represents — scans each article's title+summary against the same
 * keyword lists used for question detection. Union across the whole
 * pool. Never imports or reads classifyCategory()/article.category.
 */
export function detectRepresentedDomains(
  articles: ReadonlyArray<{ title: string; summary?: string }>,
): Set<AnalyticalDomain> {
  const represented = new Set<AnalyticalDomain>();

  for (const article of articles) {
    const text = `${article.title} ${article.summary ?? ''}`.toLowerCase();

    for (const domain of ANALYTICAL_DOMAINS) {
      if (represented.has(domain)) continue;

      for (const keyword of DOMAIN_KEYWORDS[domain]) {
        if (text.includes(keyword)) {
          represented.add(domain);
          break;
        }
      }
    }
  }

  return represented;
}

/**
 * requestedDomains - representedDomains, capped at 2, ordered by each
 * domain's first-occurrence position in the raw question (already
 * sorted by detectRequestedDomains()). Returns an empty array when
 * every requested domain is already represented — the caller (
 * AnalysisService) is expected to treat an empty return as "issue no
 * supplemental calls", which is what keeps ordinary and
 * already-well-covered broad questions at exactly 1 provider call.
 */
export function selectMissingDomains(
  requestedDomains: DetectedDomainOccurrence[],
  representedDomains: ReadonlySet<AnalyticalDomain>,
): AnalyticalDomain[] {
  return requestedDomains
    .filter((occurrence) => !representedDomains.has(occurrence.domain))
    .map((occurrence) => occurrence.domain)
    .slice(0, 2);
}

/**
 * Builds the bounded supplemental provider search term:
 * "<country.name> <canonical-domain-search-term>" — the exact form
 * approved. The caller is expected to pass this through
 * makeProviderSafeNewsQuery() before sending it to NewsService.search(),
 * matching the same provider-safety discipline every other retrieval
 * query already goes through.
 */
export function buildSupplementalSearchTerm(countryName: string, domain: AnalyticalDomain): string {
  return `${countryName} ${DOMAIN_SEARCH_TERMS[domain]}`;
}
