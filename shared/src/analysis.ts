import type {
  NewsArticle,
  NewsDataMode,
  NewsFallbackReason,
} from './news';

/**
 * Whether an analysis was produced by a real AI provider or by
 * MockAnalysisProvider. Mirrors NewsDataMode's live/mock distinction —
 * mock analysis must never be presented as real AI output.
 */
export type AnalysisMode = 'live-ai' | 'mock-ai';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface SourcedClaim {
  claim: string;
  sourceArticleIds: string[];
}

export interface AgreementPoint {
  point: string;
  sourceArticleIds: string[];
}

export interface DifferencePosition {
  description: string;
  sourceArticleIds: string[];
}

export interface DifferenceItem {
  topic: string;
  positions: DifferencePosition[];
}

export interface TimelineEvent {
  /** ISO-8601 timestamp. */
  timestamp: string;
  event: string;
  sourceArticleIds: string[];
}

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  /** 0-100. */
  score: number;
  explanation: string;
}

export interface AnalysisEntities {
  countries: string[];
  locations: string[];
  people: string[];
  organizations: string[];
  topics: string[];
}

export interface AnalysisSourceRef {
  articleId: string;
  publisher: string;
  title: string;
  url: string;
  /** ISO-8601 timestamp. */
  publishedAt: string;
}

/**
 * The validated, structured result of analyzing a set of news articles.
 * Every keyFact/agreement/difference-position/timeline entry must cite
 * at least one sourceArticleId from `sources` — ungrounded entries are
 * filtered out by the backend before this ever reaches the frontend.
 */
export interface NewsAnalysisResult {
  query: string;
  headline: string;
  summary: string;
  keyFacts: SourcedClaim[];
  agreements: AgreementPoint[];
  differences: DifferenceItem[];
  unknowns: string[];
  timeline: TimelineEvent[];
  confidence: ConfidenceInfo;
  entities: AnalysisEntities;
  sources: AnalysisSourceRef[];
  /** ISO-8601 timestamp. */
  generatedAt: string;
  analysisMode: AnalysisMode;
}

/**
 * Provenance of the article retrieval that fed an analysis, independent
 * of NewsAnalysisResult.generatedAt. Always present once retrieval has
 * been attempted — including when zero articles were found or the AI
 * provider failed afterward — so the frontend can explain where the
 * evidence came from even when `analysis` is null.
 *
 * generatedAt on the analysis reflects when the AI ran, not when the
 * underlying articles were published. This type carries the article
 * freshness/provenance signal instead, so the two are never conflated.
 */
export interface AnalysisRetrievalContext {
  /** Whether the underlying articles were live, cached, or mock. */
  dataMode: NewsDataMode;

  /** IDs of providers that contributed articles (empty for cached retrieval). */
  providers: string[];

  /** Present only when dataMode === 'cached'. */
  fallbackReason?: NewsFallbackReason;

  /**
   * ISO-8601 publication timestamp of the newest retrieved article.
   * Only reliably available on the country-aware retrieval path today.
   * Describes evidence freshness — never a substitute for
   * NewsAnalysisResult.generatedAt.
   */
  newestArticlePublishedAt?: string;

  /** Present only when country-aware retrieval (CountryNewsService) was used. */
  countryCode?: string;
  countryName?: string;

  /** Present only when country-aware retrieval was used. */
  providerDisplayName?: string;

  /** Number of articles this retrieval produced (0 is valid and meaningful). */
  articlesRetrieved: number;
}

/**
 * Envelope returned by POST /analysis/news. `analysis` is null when
 * analysis could not be produced (no articles found, AI provider
 * failure, invalid model response, etc.) — in that case `articles` may
 * still be populated so the frontend can show raw results with an
 * explanation instead of crashing.
 */
export interface AnalysisApiResponse {
  query: string;
  analysis: NewsAnalysisResult | null;
  articles: NewsArticle[];
  analysisError?: string;
  retrievalContext: AnalysisRetrievalContext;
}
