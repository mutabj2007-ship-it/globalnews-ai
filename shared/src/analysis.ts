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

/**
 * Milestone #31 — a case where the supplied evidence does not establish
 * a conclusion (e.g. "reports conflict", "this remains unconfirmed").
 * `sourceArticleIds` names the articles the uncertainty concerns, if
 * any — it may be empty when the gap is general rather than tied to a
 * specific supplied article. Additive alongside `unknowns` (free-text,
 * unchanged) rather than a replacement for it — see
 * NewsAnalysisResult.unknowns.
 */
export interface UncertaintyItem {
  description: string;
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

  /**
   * Milestone #31 — grounded insufficient-evidence / disagreement-adjacent
   * items, each optionally tied to specific supplied articles via
   * sourceArticleIds. Additive: `unknowns` (free-text, ungrounded) is
   * preserved unchanged for backward compatibility. Always present as an
   * array (possibly empty) on a validated result; optional only so older
   * callers/tests that don't set it still satisfy the type.
   */
  uncertainties?: UncertaintyItem[];
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

  /** IDs of providers that contributed articles (empty for cached/unavailable retrieval). */
  providers: string[];

  /** Present only when dataMode is 'cached' or 'unavailable'. */
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

  /**
   * Present only when country-aware retrieval (CountryNewsService) was
   * used AND the query resolved via a curated city (see
   * LocationContext in countries.ts) rather than the country name
   * itself. Lowercase canonical form, e.g. "kigali" — pair with
   * countryName for display (e.g. "Kigali, Rwanda").
   */
  city?: string;

  /**
   * Present only when country/city resolution for this query came from
   * fuzzy geographic typo resolution (see geo-fuzzy-resolver.ts) rather
   * than an exact match. matchedFrom is the raw lowercase word the user
   * actually typed (e.g. "kigalli"); canonicalLocation is the curated
   * entity it was resolved to (e.g. "kigali"), which is also what
   * countryName/city above already reflect for retrieval purposes.
   * matchConfidence is a 0-100 provenance score, not a second decision
   * tier — a fuzzy match is only ever surfaced here once it has already
   * cleared the resolver's single confidence/ambiguity gate.
   *
   * These exist so the frontend can disclose the correction (e.g.
   * `Interpreted "Kigalli" as Kigali`) instead of silently presenting
   * results as if the user had typed the canonical spelling — the
   * user's own `query` (see AnalysisApiResponse) is never altered.
   */
  matchedFrom?: string;
  canonicalLocation?: string;
  matchConfidence?: number;
}

/**
 * Milestone #29 — one canonical organization identity, deterministically
 * resolved from the retrieved articles' own text (see
 * organization-alias-resolver.util.ts and build-source-entities.util.ts
 * on the backend). Never touched by the AI provider and never merged
 * with NewsAnalysisResult.entities (AnalysisEntities), which is
 * AI-generated and ungrounded — this type and that one are deliberately
 * kept structurally separate so source-derived and AI-generated
 * entities can never be confused for one another.
 */
export interface ResolvedOrganizationMention {
  /** Canonical organization name, e.g. "United Nations". */
  canonical: string;
  /**
   * Every distinct surface form actually found across the source
   * articles that resolved to this canonical entity (e.g. ["United
   * Nations", "UN"]). Always has at least one entry — this is what
   * keeps the original wording recoverable; `canonical` is a display
   * convenience, never a replacement of what a source actually said.
   */
  matchedFrom: string[];
  /**
   * IDs of articles — always a subset of this same response's
   * `articles` — that mentioned this organization in any surface form.
   * An organization can never cite an article that isn't present in
   * `articles` (e.g. one removed by de-duplication or the analyzed-
   * article cap).
   */
  articleIds: string[];
}

/**
 * Milestone #29 — entities extracted and resolved deterministically
 * from the retrieved articles themselves, independent of whether AI
 * analysis succeeded. Always present on AnalysisApiResponse, the same
 * way retrievalContext always is, so that source-derived evidence
 * survives an AI-provider failure. Distinct from and never merged with
 * NewsAnalysisResult.entities (AnalysisEntities).
 */
export interface SourceEntities {
  organizations: ResolvedOrganizationMention[];
}

/**
 * Milestone #30 — deploy-mode flag. Whether the backend was started
 * with production AI expected (AI_EXECUTION_MODE=production, see
 * AnalysisStartupValidator) or in development mode, where mock
 * analysis is permitted when no provider key is configured.
 */
export type AnalysisExecutionMode = 'production' | 'development';

/**
 * Milestone #30 — the outcome of this specific request's attempt (or
 * non-attempt) to produce an analysis. Always reflects what actually
 * happened on THIS request, independent of `analysisMode` (which
 * reflects which provider the deployment is running, not whether it
 * was called this time).
 *
 * - "success": a validated NewsAnalysisResult was produced.
 * - "failed": the provider was called but failed (auth, timeout,
 *   network, rate limit, malformed output) — see failureReason.
 * - "validation-rejected": the provider returned a candidate, but it
 *   was fundamentally invalid and validateAnalysisResult() rejected
 *   it outright (not the same as individual ungrounded entries being
 *   silently dropped, which is not a rejection).
 * - "not-attempted": no AI call was made at all, because retrieval
 *   produced zero articles to analyze.
 */
export type AnalysisProvenanceStatus =
  | 'success'
  | 'failed'
  | 'validation-rejected'
  | 'not-attempted';

/**
 * Milestone #30 — machine-readable reason for a "failed" (or, for
 * "validation-rejected", the matching) provenance status. Deliberately
 * coarse-grained and provider-agnostic (no raw provider error text, no
 * HTTP status codes) so this can be surfaced to the frontend/logs
 * without ever risking a leaked secret or a raw upstream error message.
 */
export type AnalysisFailureReason =
  | 'provider-not-configured'
  | 'provider-auth'
  | 'provider-timeout'
  | 'provider-unavailable'
  | 'provider-rate-limited'
  | 'malformed-output'
  | 'validation-rejected';

/** Milestone #30 — OpenAI (or a future provider's) reported token usage, when available. */
export interface AnalysisTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Milestone #30 — truthful, always-present provenance for an analysis
 * attempt. Unlike `NewsAnalysisResult.analysisMode` (only present when
 * `analysis` is non-null), this exists on every AnalysisApiResponse —
 * success, failure, validation rejection, or not-attempted — so the
 * frontend never has to infer what happened from the mere presence or
 * absence of `analysis`. Never includes a secret value or a raw
 * upstream provider error string.
 */
export interface AnalysisProvenance {
  /** The active AnalysisProvider's stable id, e.g. "openai", "mock-analysis". */
  provider: string;

  /** Model identifier actually used, when known. Absent for mock analysis. */
  model?: string;

  /** Deploy-mode flag this backend process was started with. */
  executionMode: AnalysisExecutionMode;

  /**
   * Which provider family produced (or would have produced) this
   * result: live-ai vs mock-ai. Reflects the boot-time-selected
   * provider, independent of whether a call was attempted this
   * request (see `status` for that).
   */
  analysisMode: AnalysisMode;

  /** What happened on this specific request. */
  status: AnalysisProvenanceStatus;

  /** Present only when status is "failed" or "validation-rejected". */
  failureReason?: AnalysisFailureReason;

  /** Wall-clock duration of the provider call attempt, in milliseconds. Absent when status is "not-attempted". */
  latencyMs?: number;

  /** True when this response (or the analysis/error it carries) was served from AnalysisService's in-memory cache rather than freshly computed. */
  cached: boolean;

  /** Present only for a successful live-AI call when the provider reported usage. */
  tokenUsage?: AnalysisTokenUsage;
}

/**
 * Envelope returned by POST /analysis/news. `analysis` is null when
 * analysis could not be produced (no articles found, AI provider
 * failure, invalid model response, etc.) — in that case `articles` may
 * still be populated so the frontend can show raw results with an
 * explanation instead of crashing.
 */
export interface AnalysisApiResponse {
  /** The user's original, verbatim question — never rewritten. */
  query: string;

  /**
   * The deterministically-normalized form of `query` used internally
   * for retrieval and caching (see normalizeQuery in
   * query-normalization.ts). Equal to `query` when no normalization
   * was applied. Never used to silently replace what's shown to the
   * user — display should always prefer `query`.
   */
  normalizedQuery: string;

  analysis: NewsAnalysisResult | null;
  articles: NewsArticle[];
  analysisError?: string;
  retrievalContext: AnalysisRetrievalContext;
  sourceEntities: SourceEntities;

  /**
   * Milestone #30 — always present, on every response shape (success,
   * failure, validation rejection, not-attempted, cached or fresh).
   * See AnalysisProvenance.
   */
  provenance: AnalysisProvenance;
}
