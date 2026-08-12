import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  normalizeQuery,
  resolveLocationContext,
  resolveCountryByAnyIdentifier,
  resolveCountryByCity,
  resolveGeoTypo,
  type AnalysisApiResponse,
  type AnalysisFailureReason,
  type AnalysisProvenance,
  type AnalysisProvenanceStatus,
  type AnalysisRetrievalContext,
  type CountryNewsResponse,
  type GeoFuzzyMatch,
  type LanguageCode,
  type LocationContext,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { AnalysisProvider } from '../interfaces';
import { ANALYSIS_PROVIDER } from '../providers/provider.tokens';
import { AnalysisConfigService, type AnalysisConfig } from '../config/analysis-config.service';
import { clusterDuplicateArticles } from '../duplicates/cluster-articles.util';
import { computeSourceDiversity } from '../duplicates/compute-source-diversity.util';
import { buildSourceEntities } from './build-source-entities.util';
import {
  deriveGenericNewsQuery,
  deriveFallbackNewsQuery,
} from '../query/derive-generic-news-query.util';
import { deriveRelationalSearchQueries } from '../query/derive-relational-search-queries.util';
import { derivePolishRetrievalQuery } from '../language/derive-polish-retrieval-query.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import {
  validateAnalysisResult,
  AnalysisValidationError,
} from '../validation/validate-analysis-result';

/**
 * Milestone #30 — duck-typed check for a provider error that already
 * carries a machine-readable failureReason (e.g. OpenAiAnalysisError).
 * Deliberately NOT an `instanceof OpenAiAnalysisProvider`-specific check:
 * AnalysisService must stay provider-agnostic (see provider.tokens.ts),
 * so any current or future AnalysisProvider can opt into precise
 * failure classification just by throwing an error shaped this way,
 * without AnalysisService importing a concrete provider class. Providers
 * that don't (e.g. an unexpected throw from MockAnalysisProvider) fall
 * back to the generic 'provider-unavailable' reason below.
 */
interface ClassifiedProviderError {
  failureReason: AnalysisFailureReason;
}

function isClassifiedProviderError(error: unknown): error is ClassifiedProviderError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { failureReason?: unknown }).failureReason === 'string'
  );
}

interface CacheEntry {
  value: AnalysisApiResponse;
  expiresAt: number;
}

/** Number of articles requested before deduping/bounding. */
const SEARCH_POOL_SIZE = 20;

/**
 * Maximum number of words considered after a country-context phrase.
 *
 * This is long enough for names/aliases such as:
 * - United States of America
 * - Democratic Republic of the Congo
 * - United Arab Emirates
 *
 * while remaining deliberately conservative.
 */
const MAX_COUNTRY_CANDIDATE_WORDS = 6;

/**
 * Words that commonly introduce an explicit geographic subject.
 *
 * We intentionally avoid scanning every word in arbitrary questions
 * for country names because names such as Georgia, Jordan, Chad, and
 * Turkey can also appear in non-country contexts.
 */
const COUNTRY_CONTEXT_PATTERN = /\b(?:in|from|about|across|inside|within)\s+(.+)$/i;

/**
 * Matches standalone ALL-CAPS 2-3 letter tokens (e.g. "USA", "UK",
 * "UAE") anywhere in a query, with no preceding preposition required.
 *
 * This is deliberately restricted to ISO-style codes, not country
 * *names*. Ordinary English prose essentially never spells a common
 * word in full caps mid-sentence, so an exact, case-sensitive match
 * against a real ISO alpha-2/alpha-3 code is a strong, low-ambiguity
 * signal on its own. Country names get no equivalent ungated
 * treatment: several real country names (Georgia, Turkey, Chad,
 * Jordan) are also common nouns/proper nouns in unrelated contexts,
 * so those stay behind the preposition-gated scan below.
 */
const ALL_CAPS_CODE_TOKEN_PATTERN = /\b[A-Z]{2,3}\b/g;

/**
 * Milestone #30 §F.8 — how long a non-success response (failed,
 * validation-rejected, or not-attempted) may be cached, capped well
 * below the normal success TTL so a transient provider blip or a
 * momentarily-empty retrieval isn't replayed as "the answer" for as
 * long as a genuine success would be. Always the smaller of this and
 * the configured success TTL, so a deployment with an even shorter
 * ANALYSIS_CACHE_TTL_SECONDS never gets a failure TTL longer than its
 * own success TTL.
 */
const FAILURE_CACHE_TTL_SECONDS = 15;

/**
 * Milestone #47 (backend no-evidence response-language correction) —
 * the zero-evidence `analysisError` sentence is GlobalNews AI's own
 * presentation prose (not a raw exception message, not source-derived
 * content), so it must honor `requestedLanguage` exactly like the
 * OpenAI response-language instruction does. Reuses the SAME
 * `Record<LanguageCode, string>` lookup pattern already established by
 * RESPONSE_LANGUAGE_NAMES in build-analysis-prompt.util.ts — the same
 * architecture, not a second one — scoped locally here since this
 * exact sentence is only ever produced by this one branch of this one
 * service. Only en/pl have real translations; every other LanguageCode
 * falls back to the English sentence (defensive default, matching the
 * frontend dictionary's own "unimplemented language falls back to en"
 * discipline — never a claim that e.g. Swahili has a real translation
 * here).
 */
const NO_EVIDENCE_MESSAGE: Partial<Record<LanguageCode, string>> = {
  en: 'No related articles were found for this question.',
  pl: 'Nie znaleziono powiązanych artykułów dla tego pytania.',
};

function resolveNoEvidenceMessage(language: LanguageCode): string {
  return NO_EVIDENCE_MESSAGE[language] ?? NO_EVIDENCE_MESSAGE.en!;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  /**
   * Simple in-memory cache (query -> response), per Sprint 5.1's cost
   * controls: don't re-analyze the same query on every render. No
   * database — this is intentionally process-local and lost on
   * restart, which is fine for a development-stage cache.
   */
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Milestone #45 — process-local, in-memory in-flight-request
   * collapse: two concurrent callers for the same normalized,
   * currently-uncached question share ONE provider execution instead
   * of each independently triggering a real OpenAI call. Keyed by the
   * EXACT SAME `cacheKey` (normalizedQuery.toLowerCase()) already used
   * for the completed-result cache below — no competing normalization.
   * An entry exists only while its operation is genuinely pending and
   * is removed immediately on settlement (success OR failure, via
   * `.finally()`) — this is deliberately NOT a second cache; a later,
   * non-overlapping request for the same question always starts a
   * fresh operation. Mirrors the identical pattern already proven on
   * the frontend (see analysisApi.ts's inFlightAnalysisRequests).
   */
  private readonly inFlightAnalyses = new Map<string, Promise<AnalysisApiResponse>>();

  constructor(
    private readonly newsService: NewsService,
    private readonly countryNewsService: CountryNewsService,

    @Inject(ANALYSIS_PROVIDER)
    private readonly provider: AnalysisProvider,

    private readonly analysisConfig: AnalysisConfigService,
  ) {}

  /**
   * Milestone #47 — `requestedLanguage` defaults to 'en', so every
   * existing caller that never passes it (including any caller that
   * still only supplies `rawQuery`) is completely unaffected and
   * behaves byte-for-byte as before this milestone. This is the SAME
   * language value threaded through to the AI provider's response-
   * language prompt instruction and echoed back verbatim as
   * responseLanguage — see this method's return construction.
   */
  async analyzeNews(
    rawQuery: string,
    requestedLanguage: LanguageCode = 'en',
  ): Promise<AnalysisApiResponse> {
    const config = this.analysisConfig.get();

    /**
     * originalQuery is preserved verbatim for display (AnalysisApiResponse.query)
     * — never silently rewritten. normalizedQuery drives caching,
     * country/city detection, the non-country retrieval fallback, and
     * the text handed to the AI provider. See query-normalization.ts
     * for exactly what normalization does (and deliberately does not
     * do — no fuzzy/spelling correction, ever).
     */
    const { originalQuery, normalizedQuery } = normalizeQuery(rawQuery);

    // Milestone #47: the cache key now includes requestedLanguage — a
    // Polish and an English request for the same underlying text (rare,
    // but possible for a bare entity name like "NATO") must never share
    // a cached response, since the two produce genuinely different
    // AnalysisApiResponse.responseLanguage/analysis prose. The in-flight
    // dedup map below reuses this SAME cacheKey, so it automatically
    // respects language too, with no separate change needed there.
    const cacheKey = `${requestedLanguage}:${normalizedQuery.toLowerCase()}`;

    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug(`Serving cached analysis for "${originalQuery}"`);

      /**
       * The cached response's `query`/`normalizedQuery` reflect
       * whichever request first populated this cache entry.
       * Retrieval/AI results are safely shared across
       * normalized-equivalent requests (that's the point of keying
       * the cache on normalizedQuery), but the response envelope must
       * always reflect *this* request's own raw and normalized query
       * — never a previous caller's. Overriding these two fields here
       * is a plain object spread; it does not touch `analysis`,
       * `articles`, or `retrievalContext`, so no retrieval or AI work
       * is repeated. The nested `analysis.query` (set at generation
       * time from the normalized query used for analysis) is
       * intentionally left as-is.
       *
       * Milestone #30: provenance.cached is likewise overridden to
       * `true` here — the stored entry was truthfully `cached: false`
       * when it was first generated, but THIS response is a cache hit,
       * so that must be reflected for the current caller. Everything
       * else in provenance (provider, status, failureReason, latencyMs,
       * tokenUsage) describes the original generation and is preserved
       * as-is.
       */
      return {
        ...cached,
        query: originalQuery,
        normalizedQuery,
        provenance: { ...cached.provenance, cached: true },
      };
    }

    // Milestone #45 — in-flight collapse: a second concurrent caller
    // for this same normalized, currently-uncached question joins the
    // SAME pending operation rather than starting a new one. This runs
    // strictly AFTER the completed-cache check above (so a cache hit
    // never even reaches here) and BEFORE any retrieval/provider work
    // begins for a genuinely new operation.
    const existingInFlightAnalysis = this.inFlightAnalyses.get(cacheKey);
    if (existingInFlightAnalysis) {
      this.logger.debug(`Joining in-flight analysis for "${originalQuery}"`);

      // Milestone #45 correction — derive THIS caller's own response
      // envelope from the shared result, exactly mirroring the
      // completed-cache path's own override pattern above:
      // query/normalizedQuery must always reflect the CURRENT caller's
      // own request, never a different concurrent caller's, even when
      // both are normalized-equivalent (e.g. differ only in
      // casing/whitespace) and therefore correctly share ONE
      // underlying provider execution. Nothing expensive is repeated —
      // this only awaits the already-shared operation and overrides
      // two display fields on the result.
      //
      // provenance.cached is deliberately left exactly as the shared
      // result already has it (false) — NOT overridden to true, unlike
      // the completed-cache path above. This request was never served
      // from the completed TTL cache; it awaited a genuinely fresh,
      // still-in-progress generation that happened to be shared with
      // another concurrent caller. Labeling it `cached: true` would
      // misrepresent what actually happened — `buildProvenance()`
      // already sets `cached: false` for every freshly-generated
      // result, which remains the truthful value here.
      const sharedResult = await existingInFlightAnalysis;
      return {
        ...sharedResult,
        query: originalQuery,
        normalizedQuery,
      };
    }

    const inFlightOperation: Promise<AnalysisApiResponse> =
      (async (): Promise<AnalysisApiResponse> => {
        const location = this.detectLocation(normalizedQuery);

        let articles: NewsArticle[];
        let retrievalContext: AnalysisRetrievalContext;
        // Milestone #40 (authoritative-context correction): set ONLY when
        // the M37 relational branch below matches — undefined for country/
        // city retrieval and for ordinary M35/M36 generic queries. This is
        // the exact same relationalQuery.x/y AnalysisService already
        // computes for retrieval — no second parser, no reinterpretation.
        let relationalContext: { x: string; y: string } | undefined;

        if (location) {
          const { country, city, geoMatch } = location;

          if (geoMatch) {
            this.logger.debug(
              `Resolved geographic typo "${geoMatch.matchedFrom}" -> "${geoMatch.canonicalLocation}" ` +
                `(${geoMatch.matchKind}, confidence ${geoMatch.matchConfidence}) for ${country.name} (${country.iso3})`,
            );
          }

          this.logger.debug(
            city
              ? `Detected city-aware analysis query for ${city} (${country.name}, ${country.iso3})`
              : `Detected country-aware analysis query for ${country.name} (${country.iso3})`,
          );

          const countryResponse = await this.countryNewsService.getCountryNews(
            country.iso3,
            undefined,
            SEARCH_POOL_SIZE,
            city,
          );

          articles = countryResponse.articles;
          retrievalContext = this.toRetrievalContext(countryResponse, geoMatch);
        } else {
          // Milestone #37: attempt deterministic relational decomposition
          // FIRST — only ever reached after detectLocation() has already
          // returned undefined, so country/city routing above is
          // completely unaffected. An unmatched (non-relational) query
          // falls through unchanged to M35's deriveGenericNewsQuery() below
          // — this branch never runs for "What's happening with NATO?",
          // "What's happening in the Middle East?", "cybersecurity", etc.,
          // since none of those match the closed relational pattern set.
          const relationalQuery = deriveRelationalSearchQueries(normalizedQuery);

          if (relationalQuery) {
            this.logger.debug(
              `Detected relational query: X="${relationalQuery.x}" Y="${relationalQuery.y}" ` +
                `(provider query: "${relationalQuery.providerQuery}")`,
            );

            // Milestone #40 (authoritative-context correction): capture the
            // EXACT M37-derived x/y here — this is what will be forwarded
            // to the AI provider later, so its relational classification
            // uses the same authoritative pair retrieval already used,
            // never an independent re-derivation from the question text.
            relationalContext = { x: relationalQuery.x, y: relationalQuery.y };

            // Milestone #37: exactly ONE provider search — no reversed
            // duplicate query. The relational relevance mode (X and Y kept
            // separate, never the concatenated providerQuery) is what
            // NewsService applies at its existing pre-persistence filtering
            // point, identically for live and DB-fallback results — see
            // news.service.ts's RelevanceMode union. This establishes ONLY
            // joint topical relevance ("the article discusses X and Y"),
            // never causality — see scoreRelationalRelevance's doc comment.
            const searchResponse = await this.newsService.search(
              relationalQuery.providerQuery,
              SEARCH_POOL_SIZE,
              {
                type: 'relational',
                x: relationalQuery.x,
                y: relationalQuery.y,
              },
            );

            articles = searchResponse.articles;
            retrievalContext = this.toRetrievalContext(searchResponse);
          } else if (requestedLanguage === 'pl') {
            // Milestone #47 — staged Polish retrieval architecture.
            // Reached only when detectLocation() AND
            // deriveRelationalSearchQueries() have both already
            // returned nothing — the SAME structural guarantee the
            // English generic branch below relies on. A genuine Polish
            // sentence never matches the English-pattern relational
            // regexes above, so this branch is naturally, structurally
            // reached for Polish generic questions without any extra
            // guard needed.
            //
            // CALL 1: GNews /top-headlines (verified to support both
            // lang=pl and a q keyword filter, per current official
            // GNews documentation — see resolve-retrieval-language.util.ts's
            // own doc comment). Relevance is applied HERE, directly,
            // using the SAME unmodified scoreGenericRelevance() the
            // English generic branch's NewsService.search() call uses
            // internally — this is reuse of the existing relevance
            // firewall, not a new or weaker one.
            const polishTopic = derivePolishRetrievalQuery(normalizedQuery);

            const primaryResponse = await this.newsService.topHeadlines(SEARCH_POOL_SIZE, {
              lang: 'pl',
              q: polishTopic,
            });

            const relevantPrimaryArticles = primaryResponse.articles.filter(
              (article) => scoreGenericRelevance(article, polishTopic).isRelevant,
            );

            if (relevantPrimaryArticles.length > 0) {
              articles = relevantPrimaryArticles;
              retrievalContext = this.toRetrievalContext(primaryResponse);
            } else {
              // CALL 2 (bounded, exactly one): GNews /search, English —
              // reusing the SAME concise topic already extracted from
              // the Polish question (e.g. "NATO"), since translating
              // the rest of the sentence is explicitly out of scope for
              // this milestone (no OpenAI translation call, no
              // dictionary). This is a genuine, disclosed recall
              // limitation, not hidden — see the M47 delivery report.
              //
              // CRITICAL: this call NEVER chains into M46's own
              // deriveFallbackNewsQuery()-based second attempt (that
              // logic lives only in the English branch above/below and
              // is never invoked here) — this structurally guarantees
              // exactly 2 total provider calls for this path, never 3.
              this.logger.debug(
                `Polish primary retrieval for "${polishTopic}" (topHeadlines lang=pl) returned zero relevant articles — ` +
                  `attempting one bounded English Search fallback for "${polishTopic}"`,
              );

              const fallbackResponse = await this.newsService.search(polishTopic, SEARCH_POOL_SIZE, {
                type: 'generic',
              });

              articles = fallbackResponse.articles;
              retrievalContext = this.toRetrievalContext(fallbackResponse);
            }
          } else {
            // Milestone #35: only reached after detectLocation() has already
            // returned undefined — country/city routing above is completely
            // unaffected by this. Derives a concise provider search phrase
            // from the natural-language query (e.g. "What's happening with
            // NATO?" -> "NATO") rather than sending the whole sentence to
            // the news provider's free-text search. normalizedQuery itself
            // (used for the AI prompt, caching key, and response.query)
            // remains completely untouched — only the provider search term
            // changes.
            const genericSearchQuery = deriveGenericNewsQuery(normalizedQuery);

            let searchResponse = await this.newsService.search(
              genericSearchQuery,
              SEARCH_POOL_SIZE,
              // Milestone #36: opt-in relevance gate — only this call site
              // (AnalysisService's ordinary generic-search branch) enables
              // it. CountryNewsService and the public /news/search endpoint
              // call NewsService.search() without this mode, so their
              // behavior is completely unchanged (see news.service.ts).
              { type: 'generic' },
            );

            // Milestone #46 — exactly ONE bounded fallback attempt, and
            // ONLY when the primary derived-query search returned zero
            // relevant articles (post the SAME unmodified 'generic'
            // relevance gate above — this never weakens or bypasses that
            // gate, it only tries a second, narrower deterministic query
            // through it). Never a second AI call, never a multi-query
            // fan-out — at most one additional GNews search per question,
            // capped here explicitly.
            if (searchResponse.articles.length === 0) {
              const fallbackQuery = deriveFallbackNewsQuery(genericSearchQuery);
              if (fallbackQuery) {
                this.logger.debug(
                  `Primary generic retrieval for "${genericSearchQuery}" returned zero relevant articles — ` +
                    `attempting one bounded fallback search for "${fallbackQuery}"`,
                );
                searchResponse = await this.newsService.search(fallbackQuery, SEARCH_POOL_SIZE, {
                  type: 'generic',
                });
              }
            }

            articles = searchResponse.articles;
            retrievalContext = this.toRetrievalContext(searchResponse);
          }
        }

        if (articles.length === 0) {
          const empty: AnalysisApiResponse = {
            query: originalQuery,
            normalizedQuery,
            requestedLanguage,
            // Milestone #47: no AI call was made, so 'responseLanguage'
            // reflects what WOULD have been used, matching the honest
            // "always present, always truthful" contract — no analysis
            // was actually produced in any language here (analysis is
            // null), but this keeps the field's type non-optional
            // without inventing a fake distinct value.
            responseLanguage: requestedLanguage,
            analysis: null,
            articles: [],
            analysisError: resolveNoEvidenceMessage(requestedLanguage),
            retrievalContext,
            sourceEntities: buildSourceEntities([]),
            // Milestone #43: computed over the (empty) original retrieved
            // pool — all-zero fields, never fabricated.
            sourceDiversity: computeSourceDiversity(articles),
            // Milestone #30: no AI call was ever attempted — there was
            // nothing to analyze — so this is 'not-attempted', not 'failed'.
            // Distinguishing the two lets the frontend tell "we found
            // nothing to analyze" apart from "we found articles but AI
            // analysis broke".
            provenance: this.buildProvenance(config, 'not-attempted'),
          };

          // Empty results are still cached, but only briefly (see
          // FAILURE_CACHE_TTL_SECONDS) to avoid hammering the news provider
          // with the exact same fruitless query repeatedly, without
          // replaying a stale "nothing found" for as long as a genuine
          // success would be cached.
          this.setCached(cacheKey, empty, this.cacheTtlFor(empty, config));

          return empty;
        }

        const deduped = clusterDuplicateArticles(articles).slice(0, config.maxArticles);

        /**
         * Milestone #43: computed over `articles` — the ORIGINAL retrieved
         * pool, BEFORE clusterDuplicateArticles()/the maxArticles cap above
         * — never over `deduped`. This is deliberate: `deduped` has already
         * had duplicates collapsed, so computing diversity from it would
         * make duplicate-concentration invisible by construction. Computed
         * once here and reused in both the success and failure response
         * branches below so it never risks disagreeing with itself.
         */
        const sourceDiversity = computeSourceDiversity(articles);

        /**
         * Milestone #29: built once from `deduped` — the exact same final
         * article array used as the AI provider's input, AnalysisApiResponse.articles,
         * and validateAnalysisResult's sourceArticleIds grounding below.
         * This is what guarantees every sourceEntities.organizations[].articleIds
         * value refers to an article actually present in this response's
         * `articles` field: buildSourceEntities never sees, and therefore
         * can never cite, an article removed by de-duplication or the
         * maxArticles cap. Deterministic — computed from article text only,
         * independent of whether the AI provider call below succeeds.
         */
        const sourceEntities = buildSourceEntities(deduped);

        let response: AnalysisApiResponse;

        // Milestone #30: timed around the whole provider call so latencyMs
        // is captured uniformly for every provider — including any internal
        // retries an OpenAiAnalysisProvider performs — without requiring
        // providers to self-report timing (see AnalysisProvider's return
        // type comment in interfaces/).
        const providerCallStartedAt = Date.now();

        try {
          const candidate = await this.provider.analyzeNews({
            query: normalizedQuery,
            articles: deduped,
            // Milestone #40 (authoritative-context correction): undefined
            // for country/city retrieval and ordinary M35/M36 generic
            // queries — only set when the M37 relational branch matched.
            relationalContext,
            // Milestone #47: the single, existing analysis call now also
            // carries the requested response language — zero additional
            // OpenAI calls. 'en' (the default) produces a byte-identical
            // prompt to pre-Milestone-#47 behavior — see
            // buildResponseLanguageInstruction()'s own doc comment.
            responseLanguage: requestedLanguage,
          });

          const latencyMs = Date.now() - providerCallStartedAt;

          const analysis = validateAnalysisResult(candidate, {
            query: normalizedQuery,
            articles: deduped,
            analysisMode: this.provider.isMock ? 'mock-ai' : 'live-ai',
            // Milestone #32: must be the exact same truncation length
            // used to build this provider's prompt (see
            // build-analysis-prompt.util.ts / buildAnalysisMessages),
            // so evidenceBasis excerpts validate against precisely what
            // the model was shown.
            maxArticleChars: config.maxArticleChars,
            // Milestone #40 (authoritative-context correction): fail-closed
            // applicability signal — when undefined, the validator forces
            // relationalEvidenceAssessments to [] and no claim receives
            // relationalSupport, regardless of what the provider emits.
            // This never relies on prompt obedience alone.
            relationalContextPresent: relationalContext !== undefined,
            // Milestone #41 (production wiring): the SAME relationalContext
            // object already produced by the M37 relational branch above
            // and already forwarded to the AI provider for M40 — never a
            // second, independently-derived x/y pair. Both fields above
            // and here originate from this one local `relationalContext`
            // variable, so they cannot disagree at this call site. When
            // `relationalContext` is undefined (non-relational query),
            // this is undefined too, and validateAnalysisResult leaves
            // relationalComposition unset — no placeholder x/y is ever
            // synthesized.
            relationalContext,
          });

          response = {
            query: originalQuery,
            normalizedQuery,
            requestedLanguage,
            // Milestone #47: this IS the language actually used for
            // this specific successful analysis — the same value passed
            // to the provider above, echoed back truthfully, never
            // independently re-derived.
            responseLanguage: requestedLanguage,
            analysis,
            articles: deduped,
            retrievalContext,
            sourceEntities,
            sourceDiversity,
            provenance: this.buildProvenance(config, 'success', { latencyMs }),
          };
        } catch (error) {
          const latencyMs = Date.now() - providerCallStartedAt;

          this.logger.warn(
            `Analysis provider "${this.provider.id}" failed for query "${originalQuery}"`,
            error instanceof Error ? error : undefined,
          );

          const { status, failureReason } = this.classifyFailure(error);

          response = {
            query: originalQuery,
            normalizedQuery,
            requestedLanguage,
            responseLanguage: requestedLanguage,
            analysis: null,
            articles: deduped,
            analysisError: this.describeError(error),
            retrievalContext,
            sourceEntities,
            sourceDiversity,
            provenance: this.buildProvenance(config, status, { failureReason, latencyMs }),
          };
        }

        this.setCached(cacheKey, response, this.cacheTtlFor(response, config));

        return response;
      })();

    // Milestone #45 — registered only once the operation object exists,
    // and removed unconditionally on settlement (try/finally-equivalent
    // via .finally()) regardless of success or failure. The identity
    // check guards the same theoretical race already handled this way
    // elsewhere in this codebase (see analysisApi.ts's frontend dedup):
    // a stale cleanup from an old operation can never delete a newer
    // one that has since been registered for the same key.
    const settledInFlightOperation = inFlightOperation.finally(() => {
      if (this.inFlightAnalyses.get(cacheKey) === settledInFlightOperation) {
        this.inFlightAnalyses.delete(cacheKey);
      }
    });

    this.inFlightAnalyses.set(cacheKey, settledInFlightOperation);
    return settledInFlightOperation;
  }

  /**
   * Milestone #30 — builds the always-present AnalysisProvenance block
   * shared by every response shape (success, failure,
   * validation-rejected, not-attempted). `provider`/`model`/
   * `executionMode`/`analysisMode` reflect the boot-time-selected
   * provider and are the same on every call; `cached` always starts
   * `false` here — the one place that ever flips it to `true` is the
   * cache-hit branch above, which does so explicitly on the stored
   * value rather than by calling this method again.
   */
  private buildProvenance(
    config: AnalysisConfig,
    status: AnalysisProvenanceStatus,
    extra: Partial<Pick<AnalysisProvenance, 'failureReason' | 'latencyMs' | 'tokenUsage'>> = {},
  ): AnalysisProvenance {
    return {
      provider: this.provider.id,
      model: this.provider.isMock ? undefined : config.openAiModel,
      executionMode: config.executionMode,
      analysisMode: this.provider.isMock ? 'mock-ai' : 'live-ai',
      status,
      cached: false,
      ...extra,
    };
  }

  /**
   * Milestone #30 — classifies a caught error from the try block above
   * into a typed provenance status/failureReason pair. A validation
   * rejection (the candidate was fundamentally malformed) is always
   * `validation-rejected`; anything else is a provider failure,
   * classified via the candidate's own failureReason when it provides
   * one (see isClassifiedProviderError) or a generic
   * 'provider-unavailable' otherwise.
   */
  private classifyFailure(error: unknown): {
    status: Extract<AnalysisProvenanceStatus, 'failed' | 'validation-rejected'>;
    failureReason: AnalysisFailureReason;
  } {
    if (error instanceof AnalysisValidationError) {
      return {
        status: 'validation-rejected',
        failureReason: 'validation-rejected',
      };
    }

    if (isClassifiedProviderError(error)) {
      return {
        status: 'failed',
        failureReason: error.failureReason,
      };
    }

    return {
      status: 'failed',
      failureReason: 'provider-unavailable',
    };
  }

  /**
   * Milestone #30 §F.8 — a successful response keeps the normal
   * configured TTL; anything else (failed, validation-rejected,
   * not-attempted) is capped at FAILURE_CACHE_TTL_SECONDS so it can't
   * be replayed as "the answer" for as long as a genuine success would
   * be. Never longer than the configured success TTL either, in case an
   * operator has already set that even lower.
   */
  private cacheTtlFor(response: AnalysisApiResponse, config: AnalysisConfig): number {
    if (response.provenance.status === 'success') {
      return config.cacheTtlSeconds;
    }

    return Math.min(config.cacheTtlSeconds, FAILURE_CACHE_TTL_SECONDS);
  }

  /**
   * Builds the retrieval provenance object from whichever response
   * envelope was used (generic NewsResponse or country-aware
   * CountryNewsResponse). Only fields that actually exist on the
   * source envelope are populated — nothing is inferred or invented
   * for retrieval paths that don't reliably expose it (e.g. generic
   * NewsResponse has no newestArticlePublishedAt).
   *
   * geoMatch is passed separately (rather than read off `source`)
   * because it comes from the LocationContext produced by
   * detectLocation(), not from the NewsResponse/CountryNewsResponse
   * envelope — CountryNewsService has no notion of "was this fuzzy",
   * and doesn't need one; the correction happens one layer up, here.
   */
  private toRetrievalContext(
    source: NewsResponse | CountryNewsResponse,
    geoMatch?: GeoFuzzyMatch,
  ): AnalysisRetrievalContext {
    const isCountryResponse = 'countryCode' in source;

    return {
      dataMode: source.dataMode,
      providers: source.providers,
      fallbackReason: source.fallbackReason,
      newestArticlePublishedAt: isCountryResponse ? source.newestArticlePublishedAt : undefined,
      countryCode: isCountryResponse ? source.countryCode : undefined,
      countryName: isCountryResponse ? source.countryName : undefined,
      providerDisplayName: isCountryResponse ? source.providerDisplayName : undefined,
      articlesRetrieved: source.articles.length,
      city: isCountryResponse ? source.city : undefined,
      matchedFrom: geoMatch?.matchedFrom,
      canonicalLocation: geoMatch?.canonicalLocation,
      matchConfidence: geoMatch?.matchConfidence,
    };
  }

  /**
   * Resolves a country, and — when the match came from a curated city
   * rather than the country name itself — the matched city, from a
   * free-text query.
   *
   * This preserves the exact matching order the previous
   * country-only detectCountry() used: a direct
   * name/code/alias match, then an ungated ISO-style code scan, then
   * a preposition-gated word-shrinking scan. City resolution is only
   * ever attempted at the same single point it always was (the
   * word-shrinking scan, via resolveLocationContext), so no existing
   * country-only match changes.
   */
  private detectLocation(query: string): LocationContext | undefined {
    const normalized = query.trim().replace(/[?!.,;:]+$/g, '');

    if (!normalized) {
      return undefined;
    }

    /**
     * Allow a query that is itself simply a country name/code/alias.
     *
     * Examples:
     * - Spain
     * - ESP
     * - Britain
     * - DR Congo
     */
    const direct = resolveCountryByAnyIdentifier(normalized);

    if (direct) {
      return { country: direct };
    }

    /**
     * Allow a natural-language query that embeds an explicit ISO-style
     * code with no preposition, e.g. "is USA under pressure of war?".
     * See ALL_CAPS_CODE_TOKEN_PATTERN for why this is safe to leave
     * ungated while country names are not.
     */
    const codeMatches = normalized.match(ALL_CAPS_CODE_TOKEN_PATTERN);

    if (codeMatches) {
      for (const code of codeMatches) {
        const country = resolveCountryByAnyIdentifier(code);

        if (country) {
          return { country };
        }
      }
    }

    /**
     * Milestone #28: every exact path above (direct identifier match,
     * ISO-code scan) has now failed for the whole query. Before
     * requiring explicit prepositional context, give the same bare
     * whole-query shape one fuzzy attempt — this mirrors `direct`
     * above exactly, just typo-tolerant, e.g. a bare "Rwnada" gets the
     * same treatment a bare "Rwanda" already would. resolveGeoTypo
     * itself is a no-op for multi-word input, so this is harmless to
     * call unconditionally. This is the ONLY fuzzy attempt for a query
     * with no geographic preposition — no other fallback exists below
     * for that shape.
     */
    const bareFuzzy = this.detectLocationFuzzy(normalized);

    if (bareFuzzy) {
      return bareFuzzy;
    }

    /**
     * For natural-language questions, require explicit geographic
     * context such as "in Spain" or "from Rwanda".
     */
    const contextMatch = normalized.match(COUNTRY_CONTEXT_PATTERN);

    if (!contextMatch) {
      return undefined;
    }

    const candidateText = contextMatch[1].trim();

    if (!candidateText) {
      return undefined;
    }

    const words = candidateText.split(/\s+/);

    const maxWords = Math.min(words.length, MAX_COUNTRY_CANDIDATE_WORDS);

    /**
     * Try the longest candidate first.
     *
     * Example:
     * "in the United States today"
     *
     * progressively checks:
     * "the United States today"
     * "the United States"
     * ...
     *
     * and similarly handles aliases such as "DR Congo", and curated
     * cities such as "Kigali" (see resolveLocationContext).
     */
    for (let length = maxWords; length >= 1; length -= 1) {
      const candidate = words
        .slice(0, length)
        .join(' ')
        .replace(/^(?:the)\s+/i, '')
        .trim();

      const location = resolveLocationContext(candidate);

      if (location) {
        return location;
      }
    }

    /**
     * Milestone #28: every exact candidate length in the word-shrinking
     * scan above has now failed too. As a last resort, try fuzzy
     * resolution against only the single-word candidate (the first
     * word of the geographic-context phrase, e.g. "kigalli" from "in
     * Kigalli") — this is deliberately narrower than the exact scan
     * above (which tries up to MAX_COUNTRY_CANDIDATE_WORDS words) since
     * fuzzy matching against curated multi-word entities is out of
     * scope for this milestone (see geo-fuzzy-resolver.ts).
     */
    const firstWord = words[0];

    if (firstWord) {
      const fuzzy = this.detectLocationFuzzy(firstWord);

      if (fuzzy) {
        return fuzzy;
      }
    }

    return undefined;
  }

  /**
   * Attempts fuzzy geographic typo resolution for a single word, only
   * ever called after every exact matching path available to the
   * caller has already failed (see the two call sites above). Returns
   * undefined whenever resolveGeoTypo itself does — too short, no
   * eligible curated target close enough, or an ambiguous tie between
   * two or more curated targets (see geo-fuzzy-resolver.ts) — in which
   * case callers fall back to ordinary non-geographic retrieval.
   */
  private detectLocationFuzzy(word: string): LocationContext | undefined {
    const match = resolveGeoTypo(word);

    if (!match) {
      return undefined;
    }

    const country =
      match.matchKind === 'city'
        ? resolveCountryByCity(match.canonicalLocation)
        : resolveCountryByAnyIdentifier(match.canonicalLocation);

    // Defensive only: canonicalLocation always comes from the curated
    // COUNTRIES/city list, so this should be unreachable in practice.
    if (!country) {
      return undefined;
    }

    return {
      country,
      city: match.matchKind === 'city' ? match.canonicalLocation : undefined,
      geoMatch: match,
    };
  }

  private describeError(error: unknown): string {
    if (error instanceof AnalysisValidationError) {
      return 'The AI analysis response was invalid and could not be shown. The underlying articles are still available below.';
    }

    if (error instanceof Error) {
      return `AI analysis is temporarily unavailable (${error.message}). The underlying articles are still available below.`;
    }

    return 'AI analysis is temporarily unavailable. The underlying articles are still available below.';
  }

  private getCached(key: string): AnalysisApiResponse | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setCached(key: string, value: AnalysisApiResponse, ttlSeconds: number): void {
    if (ttlSeconds <= 0) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
