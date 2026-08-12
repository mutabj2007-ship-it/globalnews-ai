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

/**
 * Milestone #32 — deterministic fact about citation breadth for one
 * grounded entry, computed entirely by the backend from that entry's
 * own already-M31-resolved `sourceArticleIds` (never provider-emitted —
 * see validate-analysis-result.ts). This is a count, not a claim: it
 * says nothing about whether the cited evidence semantically supports
 * the specific strength of the generated text. Never conflate this
 * with EvidenceBasis, which is about excerpt provenance, or with any
 * notion of confirmation/truth.
 */
export interface EvidenceBreadth {
  /** Number of distinct canonical grounded source article IDs. */
  sourceCount: number;
  /** True iff sourceCount === 1. */
  singleSource: boolean;
}

/**
 * Milestone #32 — a specific excerpt the model identified as its basis
 * for one grounded entry, backend-validated to actually exist within
 * the exact (prompt-truncated) evidence text supplied to the model for
 * the cited evidence reference — see validate-analysis-result.ts and
 * build-analysis-prompt.util.ts. `articleId` is always a real,
 * canonical NewsArticle.id resolved the same way M31 resolves
 * sourceArticleIds — the model-facing request-local evidenceId
 * (S1/S2/...) this excerpt was originally attributed to is never
 * retained here or anywhere downstream of validation.
 *
 * This proves EXCERPT PROVENANCE only: that the text was actually
 * present in what the model was shown for that source. It does NOT
 * prove that the excerpt logically entails the claim's specific
 * wording or strength, and it is never a substitute for independent
 * verification. Present only when validation succeeds; never a
 * synthetic/manufactured fallback value (see EvidenceBreadth for the
 * separate, purely-quantitative signal).
 */
export interface EvidenceBasis {
  articleId: string;
  excerpt: string;
}

/**
 * Milestone #40 — the six base semantic labels a single evidence
 * excerpt can carry with respect to a requested "X affecting/affects
 * Y" relationship. Applies to ONE evidence assessment at a time — a
 * single excerpt is never 'mixed'; see RelationalSupportDirection for
 * the separate, backend-derived aggregate state.
 *
 * Establishes only "this excerpt is evidence relevant to the
 * relationship between X and Y in this sense" — never "X caused Y".
 * The backend cannot verify that a model-chosen direction is
 * semantically correct, only that the excerpt is real, verified text
 * from a real supplied article — see resolve-relational-evidence-
 * assessment.util.ts.
 */
export type RelationalEvidenceDirection =
  | 'requested-direction'
  | 'reverse-direction'
  | 'bidirectional'
  | 'association-only'
  | 'unclear'
  | 'non-substantive';

/**
 * Milestone #40 — a claim's aggregate relational-support state, backend-
 * derived from the set of validated RelationalEvidenceAssessments the
 * claim actually referenced (never from article co-membership alone).
 * 'mixed' is the ONLY value not possible on a single assessment — it
 * exists solely to represent disagreement across multiple assessments
 * supporting one claim (see RelationalSupport).
 */
export type RelationalSupportDirection = RelationalEvidenceDirection | 'mixed';

/**
 * Milestone #40 — one backend-validated evidence excerpt and its
 * semantic direction. `articleId` is always the real, canonical
 * article ID — never a request-local evidenceId. `excerpt` is
 * independently verified (Milestone #32-style substring check) against
 * the exact text supplied to the model for that article. Never implies
 * causal proof — see RelationalEvidenceDirection's doc comment.
 */
export interface RelationalEvidenceAssessment {
  articleId: string;
  excerpt: string;
  direction: RelationalEvidenceDirection;
}

/**
 * Milestone #40 — additive, optional field on a claim/agreement/
 * position/timeline entry. Present only when the entry explicitly
 * referenced one or more backend-validated relational evidence
 * assessments (never inferred from merely sharing an article with an
 * unrelated assessment — see the M40 design's Case 9 regression).
 *
 * `direction` is the aggregate across every assessment in
 * `assessments`: if all agree, that shared direction; if they
 * disagree, 'mixed'. Only 'requested-direction' and 'bidirectional'
 * count as direct support for the user's requested relationship —
 * 'mixed', 'reverse-direction', 'association-only', 'unclear', and
 * 'non-substantive' all mean this entry is NOT treated as supporting
 * evidence for the requested direction, even though the evidence
 * itself remains visible in `assessments` (reverse/contradicting
 * evidence is never discarded).
 *
 * No request-local assessmentId or evidenceId ever appears here or
 * anywhere downstream — both are purely internal validation-time
 * lookup keys, exactly like M31's evidenceId.
 */
export interface RelationalSupport {
  direction: RelationalSupportDirection;
  assessments: RelationalEvidenceAssessment[];
}

export interface SourcedClaim {
  claim: string;
  sourceArticleIds: string[];
  /** Milestone #32 — additive; absent on results generated before this milestone. */
  evidenceBreadth?: EvidenceBreadth;
  /** Milestone #32 — additive; present only when backend-validated. */
  evidenceBasis?: EvidenceBasis;
  /** Milestone #40 — additive; present only when backend-validated. See RelationalSupport doc comment. */
  relationalSupport?: RelationalSupport;
}

export interface AgreementPoint {
  point: string;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
  relationalSupport?: RelationalSupport;
}

export interface DifferencePosition {
  description: string;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
  relationalSupport?: RelationalSupport;
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
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
  relationalSupport?: RelationalSupport;
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

/**
 * Milestone #42 — MODEL SELF-ASSESSMENT METADATA ONLY. This is what the
 * AI provider itself reported about its own confidence — validated only
 * for shape (enum membership, numeric clamp to 0-100), never cross-
 * checked against grounding, corroboration, contradiction, or any other
 * deterministic signal. It is NOT the authoritative trust signal for
 * this analysis — see NewsAnalysisResult.trustState, which is derived
 * entirely independently by the backend and does not read this field at
 * all. Retained unmodified for backward compatibility; a future
 * frontend milestone is required to stop presenting this prominently as
 * if it were the authoritative trust level (see TrustState's own doc
 * comment for the full authority hierarchy).
 */
export interface ConfidenceInfo {
  level: ConfidenceLevel;
  /** 0-100. */
  score: number;
  explanation: string;
}

/**
 * Milestone #42 — the closed, language-neutral set of reasons a
 * TrustState can cite. These are stable structured codes, never English
 * prose — a future frontend localization layer maps each code to
 * human-readable text in the user's language. The backend remains the
 * sole authority on WHICH codes apply; it never generates or trusts
 * free-text explanations for trust derivation.
 */
export type TrustReason =
  | 'no-grounded-evidence'
  | 'single-distinct-article'
  | 'multiple-distinct-articles'
  | 'relational-support-adequate'
  | 'relational-support-limited'
  | 'requested-direction-unsupported'
  | 'reverse-evidence-present'
  | 'mixed-evidence-present'
  | 'uncertainties-reported'
  | 'differences-reported'
  | 'mock-execution';

export type TrustLevel = 'high' | 'moderate' | 'limited' | 'insufficient';

/**
 * Milestone #42 — AUTHORITATIVE BACKEND ANSWER-LEVEL TRUST STATE.
 *
 * AUTHORITY HIERARCHY (highest to lowest):
 * 1. TrustState (this) — authoritative backend answer-level trust.
 * 2. RelationalComposition — authoritative backend relational conclusion
 *    (Milestone #41); TrustState CONSUMES this, never re-derives it.
 * 3. evidenceBasis / evidenceBreadth / validated claims (Milestone #32) —
 *    supporting evidence structures.
 * 4. uncertainties / differences — bounded caveat/information structures.
 * 5. ConfidenceInfo (analysis.confidence) — model self-assessment
 *    metadata only, NEVER an input to this derivation.
 * 6. NewsArticle.confidence — retrieval/ranking signal only, unrelated
 *    to answer trust.
 * 7. AnalysisRetrievalContext.matchConfidence — geographic/query-
 *    resolution signal only, unrelated to answer trust.
 *
 * Derived entirely deterministically, entirely backend-side, from
 * already-validated structures plus the already-authoritative
 * analysisMode supplied to validateAnalysisResult() — see
 * derive-trust-state.util.ts. Never reads or is influenced by
 * `analysis.confidence`, provider prose, or any other model-self-
 * reported value.
 *
 * `reasons` are stable, language-neutral TrustReason codes — never
 * backend-authored English prose — a future frontend localization layer
 * is responsible for turning these into human-readable text.
 *
 * MOCK HARD OVERRIDE: whenever the analysis was produced in mock
 * execution mode, `level` is always 'insufficient' and `reasons` is
 * always exactly `['mock-execution']`, regardless of how many mock
 * articles/claims exist — see derive-trust-state.util.ts.
 *
 * NON-RELATIONAL 'high' IS NOT ACHIEVABLE in this milestone — ordinary
 * (non-relational) analyses have no structural per-conclusion
 * corroboration mechanism analogous to Milestone #41's relational one,
 * so `distinctSourceArticleCount` alone can never justify 'high'. This
 * is an intentional, disclosed limitation, not an oversight — see
 * derive-trust-state.util.ts's own doc comment.
 */
export interface TrustState {
  level: TrustLevel;
  reasons: TrustReason[];
  /**
   * Distinct validated article IDs represented across grounded
   * keyFacts/agreements/differences.positions/timeline. A breadth
   * measure of the analysis as a whole — NOT a claim that all of them
   * corroborate the same specific conclusion, and NOT a claim of
   * editorial/publisher independence.
   */
  distinctSourceArticleCount: number;
  /**
   * Relational-path only. True iff at least one claim's aggregate
   * relationalSupport.direction is 'reverse-direction' or 'mixed' —
   * both are structurally validated disagreement signals (Milestone
   * #40), never inferred from prose. association-only/unclear/
   * non-substantive evidence alone never sets this true.
   */
  relationalContradictionPresent?: boolean;
  /** = differences.length. Informational only — never implies contradiction or downgrades level. */
  differenceTopicCount: number;
  /** = uncertainties.length. Informational only — never implies severity or downgrades level. */
  uncertaintyCount: number;
  /** Present only when relationalComposition exists — mirrors relationalComposition.evidenceSufficiency exactly. */
  relationalEvidenceSufficiency?: EvidenceSufficiency;
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
   * Milestone #42 — the authoritative backend trust signal. Always
   * present on a validated result (required, not optional) — see
   * derive-trust-state.util.ts's own doc comment for why this is safe:
   * validateAnalysisResult() is the sole constructor of
   * NewsAnalysisResult, and no persistent cache/storage of full
   * analysis results exists (only the in-memory, process-local
   * AnalysisService cache, cleared on every restart). See TrustState's
   * own doc comment for the full authority hierarchy — `confidence`
   * above is model self-reported metadata only and is never consulted
   * when deriving this field.
   */
  trustState: TrustState;

  /**
   * Milestone #31 — grounded insufficient-evidence / disagreement-adjacent
   * items, each optionally tied to specific supplied articles via
   * sourceArticleIds. Additive: `unknowns` (free-text, ungrounded) is
   * preserved unchanged for backward compatibility. Always present as an
   * array (possibly empty) on a validated result; optional only so older
   * callers/tests that don't set it still satisfy the type.
   */
  uncertainties?: UncertaintyItem[];

  /**
   * Milestone #40 — every backend-validated relational evidence
   * assessment for this analysis, regardless of whether any claim
   * ended up referencing it. Reverse-direction, association-only,
   * unclear, and non-substantive assessments are always included here
   * — this array is never filtered down to only "supporting" evidence,
   * so contradicting/counter evidence remains visible even when no
   * claim cites it. Empty when the query wasn't relational, the
   * provider emitted nothing valid, or analysisMode is 'mock-ai'
   * (MockAnalysisProvider never fabricates semantic assessments).
   * Optional only so pre-M40 callers/tests still satisfy the type;
   * always an array (possibly empty) on a freshly validated result.
   */
  relationalEvidenceAssessments?: RelationalEvidenceAssessment[];

  /**
   * Milestone #41 — the trusted, deterministically backend-derived
   * relational answer, present ONLY when relationalContextPresent was
   * true for this request (see AnalysisService/validateAnalysisResult).
   * Undefined for every non-relational request (ordinary M35/M36
   * generic queries, country/city retrieval) — see
   * build-relational-composition.util.ts.
   *
   * AUTHORITY: when present, `relationalComposition.summary` is the
   * authoritative answer to the user's relational question — `headline`
   * and `summary` above remain legacy orientation prose only, validated
   * merely for non-emptiness, and must NOT be presented as if they
   * resolve a relational question. Enforcing this at render time is
   * REQUIRED FUTURE WORK for the frontend milestone that consumes this
   * field — it is not automatically enforced by this field's mere
   * existence.
   *
   * Every field here is derived entirely by the backend from already-
   * validated relationalSupport data on keyFacts/agreements/
   * differences.positions/timeline entries — there is no model-facing
   * schema for this structure at all, and no model-written prose
   * anywhere in it (`summary` is selected from a fixed backend template
   * set — see build-relational-composition.util.ts).
   */
  relationalComposition?: RelationalComposition;
}

/**
 * Milestone #41 — does at least one FINAL VALIDATED claim/agreement/
 * position/timeline entry have an aggregate relationalSupport.direction
 * of 'requested-direction' or 'bidirectional'? A 'mixed' aggregate
 * NEVER contributes, even if its underlying assessments include a
 * requested-direction one (M40's own aggregation already collapsed
 * that disagreement into 'mixed' — this field does not reach back
 * into individual assessments to reverse that).
 *
 * This says only "does any legitimate supporting evidence exist" — see
 * EvidenceSufficiency for whether that evidence is adequate to answer
 * the question with reasonable confidence.
 */
export type DirectionalEligibility = 'supported' | 'unsupported';

/**
 * Milestone #41 — corroboration strength, measured by DISTINCT
 * validated article IDs backing 'requested-direction'/'bidirectional'
 * claims (never by claim count — two claims citing the same article are
 * one supporting article, not two). "Distinct articles" proves exactly
 * that: distinct article IDs. It does NOT prove editorial/publisher
 * independence, which this repository has no mechanism to establish.
 *
 * - 'insufficient': zero distinct supporting articles.
 * - 'limited': exactly one distinct supporting article, OR contradicted
 *   by reverse-direction/mixed evidence regardless of article count.
 * - 'adequate': two or more distinct supporting articles, with no
 *   reverse-direction or mixed evidence present.
 */
export type EvidenceSufficiency = 'adequate' | 'limited' | 'insufficient';

/**
 * Milestone #41 — a reference into the FINAL VALIDATED result's own
 * arrays, generated EXCLUSIVELY by the backend while iterating those
 * arrays after validation completes. There is no candidate/model-facing
 * equivalent of this type anywhere — no candidate index is ever read,
 * and no candidate-to-validated translation ever occurs. This makes
 * index-shift and duplicate-reference attacks structurally
 * inapplicable, not merely mitigated.
 */
export interface ClaimReference {
  section: 'keyFacts' | 'agreements' | 'differences' | 'timeline';
  index: number;
}

/**
 * Milestone #41 — the trusted relational composition. See
 * NewsAnalysisResult.relationalComposition's doc comment for the
 * authority statement, and build-relational-composition.util.ts for
 * the full derivation algorithm.
 */
export interface RelationalComposition {
  directionalEligibility: DirectionalEligibility;
  evidenceSufficiency: EvidenceSufficiency;
  /** Selected from a fixed backend template set — never model prose. */
  summary: string;
  /** Aggregate direction requested-direction | bidirectional. */
  supportingClaims: ClaimReference[];
  /** Aggregate direction reverse-direction — never discarded. */
  reverseClaims: ClaimReference[];
  /** Aggregate direction association-only — never discarded. */
  associationOnlyClaims: ClaimReference[];
  /** Aggregate direction mixed — never discarded, never eligible. */
  mixedClaims: ClaimReference[];
  /** Aggregate direction unclear or non-substantive — never discarded. */
  unclearOrNonSubstantiveClaims: ClaimReference[];
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
