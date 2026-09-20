import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  normalizeQuery,
  resolveServerBudgetMs,
  resolveLocationContext,
  resolveCountryByAnyIdentifier,
  resolveCountryByCity,
  resolveGeoTypo,
  type AnalysisApiResponse,
  type AnalysisFailureReason,
  type AnalysisProvenance,
  type AnalysisProvenanceStatus,
  type AnalysisRetrievalContext,
  type CountryMeta,
  type CountryNewsResponse,
  type GeoFuzzyMatch,
  type LanguageCode,
  type LocationContext,
  type NewsArticle,
  type NewsResponse,
  type RequestedRegionScope,
  type RetrievalOutcome,
  type StoryContext,
} from '@globalnews-ai/shared';
import { NewsService, readProviderFailures } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { AnalysisProvider } from '../interfaces';
import { ANALYSIS_PROVIDER } from '../providers/provider.tokens';
import { AnalysisConfigService, type AnalysisConfig } from '../config/analysis-config.service';
import { clusterDuplicateArticles } from '../duplicates/cluster-articles.util';
import {
  assessBriefCompliance,
  detectDevelopmentBreadth,
} from '../validation/brief-compliance.util';
import {
  acceptExecutiveBrief,
  withholdExecutiveBrief,
} from '../validation/brief-fail-closed.util';
import { applyBriefRelationIntegrity } from '../validation/entity-role-geography.util';
import {
  buildRegionScope,
  memberIso3WithEvidence,
  retrievalOutcome,
} from '../region/region-coverage';
import {
  MAX_CONCURRENT_REGION_REQUESTS,
  detectDeclaredRegion,
  prioritizeRegionMembers,
  type DeclaredRegion,
} from '../region/declared-regions';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C907 §8 — THE RETRIEVAL OUTCOME, AND THE TWO CONSTANTS THE LADDER NEEDS
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * How many retained articles to take per member country.
 *
 * Small on purpose. A retained-only answer is a DEGRADED answer and it says so;
 * padding it to the size of a live pool would make it look like a healthy one.
 * Six per member across up to six members is the same order of evidence the
 * live path produces, without pretending to be it.
 */
const RETAINED_PER_MEMBER_LIMIT = 6;

/**
 * How old retained reporting may be before it is not worth serving.
 *
 * 48 hours. `findRecentByCountry` defaults to 1 440 minutes (24 h); a
 * provider outage that a retained answer exists to survive can easily outlast
 * a day, and the alternative at hour 25 is no answer at all. It is not longer
 * than that because "previously retrieved reporting" stops being reporting
 * about now, and the disclosure says RETAINED, not RECENT.
 */
const RETAINED_MAX_AGE_MINUTES = 48 * 60;

/**
 * Only the first two region members may spend the slow live fallback tier.
 *
 * They are the explicitly named countries when the reader supplied them,
 * because prioritizeRegionMembers() moves those first. Every other region member
 * still gets a primary-provider attempt and remains eligible for retained
 * reporting, but cannot multiply GDELT's serial/slow fallback eleven times.
 */
const REGION_LIVE_FALLBACK_MEMBER_LIMIT = 2;

import { computeSourceDiversity } from '../duplicates/compute-source-diversity.util';
import {
  detectRequestedDomains,
  isBroadMultiDomainQuestion,
  detectRepresentedDomains,
  selectMissingDomains,
  buildSupplementalSearchTerm,
  type AnalyticalDomain,
} from '../query/detect-analytical-domains.util';
import {
  scoreCountryRelevance,
  resolveCountriesByDemonym,
} from '../../news/country/country-relevance.util';
import { admitsToAnalysisCorpus } from '../../news/country/country-development-eligibility.util';
import {
  deduplicateArticles,
  areLikelyDuplicateArticles,
} from '../../news/country/deduplicate-articles.util';
import { buildSourceEntities } from './build-source-entities.util';
import {
  deriveGenericNewsQuery,
  deriveFallbackNewsQuery,
  makeProviderSafeNewsQuery,
  toProviderSafePunctuation,
} from '../query/derive-generic-news-query.util';
import { deriveRelationalSearchQueries } from '../query/derive-relational-search-queries.util';
import { blocksGeographicRouting } from '../query/routing-function-words.util';
import { classifyQueryIntent } from '../query/query-intent.util';
import { detectSourceAttributedIntent } from '../query/derive-source-attributed-query.util';
import {
  resolveRequestedSource,
  type RequestedSource,
} from '../../news/identity/requested-source.util';
import { polishCountryName } from '../query/polish-country-forms.util';
import { derivePolishRetrievalQuery } from '../language/derive-polish-retrieval-query.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import {
  extractAnchorTerms,
  buildAnchorRetrievalQuery,
  buildAnchorFallbackQuery,
  isMateriallyRelatedToAnchor,
  isSameArticleAsAnchor,
  type AnchorTerms,
} from '../relevance/anchor-relevance.util';
import {
  validateAnalysisResult,
  AnalysisValidationError,
} from '../validation/validate-analysis-result';

/**
 * PROVIDER-SAFETY EDGE CLOSURE — the retrieval context for a question that has
 * no lexical query at all.
 *
 * `dataMode: 'unavailable'` with `fallbackReason: 'no-live-results'` is the
 * existing vocabulary for "nothing could be returned, and not because a
 * provider broke". No provider was contacted, so `providers` is empty and
 * `articlesRetrieved` is 0. Deliberately NOT 'provider-error': blaming the
 * provider for a request that was never sent would be a false report.
 */
const NON_RETRIEVABLE_QUERY_CONTEXT: AnalysisRetrievalContext = {
  dataMode: 'unavailable',
  providers: [],
  fallbackReason: 'no-live-results',
  articlesRetrieved: 0,
  /*
    C907 §8 — NO PROVIDER WAS ASKED, so nothing about a provider is claimed.

    This context is reached when there is no lexical query to send or the
    question asks for a comparison with no determinable members. The providers
    are not rate-limited and not unavailable; they were never called.
    NO_RELEVANT_EVIDENCE is the honest value — the product looked and has
    nothing — and it is the only one of the five that does not assert a
    provider state we did not observe.
  */
  outcome: 'NO_RELEVANT_EVIDENCE',
};

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
 * G3 — words that make the phrase before them a subdivision rather than a
 * country. Deliberately a short, closed list of administrative nouns; it is not
 * a gazetteer and names no place. See resolveExactLocationInSegment(), the only
 * caller, for why a discarded one must abandon the match instead of shortening
 * it.
 */
const SUBDIVISION_QUALIFIERS = new Set([
  'state',
  'province',
  'prefecture',
  'oblast',
  'region',
  'territory',
  'district',
  'county',
  'governorate',
  'canton',
  'emirate',
]);

function isSubdivisionQualifier(word: string | undefined): boolean {
  if (word === undefined) return false;

  return SUBDIVISION_QUALIFIERS.has(word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''));
}

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

/**
 * The total synchronous budget was exhausted before a response existed.
 *
 * A DISTINCT TYPE, not a generic failure: "the analysis failed" and "the
 * analysis did not finish inside the budget we promised the client" are
 * different facts, and the second one is usually followed by a cache hit.
 *
 * ── REV B — IT IS AN HttpException, AND THAT IS THE WHOLE FIX ──────────────
 *
 * In Rev A this extended `Error`. `GlobalExceptionFilter` catches everything and
 * branches on type: an `HttpException` keeps its own status and body, and
 * ANYTHING ELSE becomes a sanitized 500 with "An unexpected error occurred." So
 * a deadline — a known, deliberate, correctly-handled outcome — reached the
 * reader as an unexplained server fault, and `analysisApi.ts`'s `codeForStatus`
 * mapped `>= 500` to `'server'`. The client was told the backend had broken
 * when in fact the backend had kept exactly the promise it made.
 *
 * 504 GATEWAY TIMEOUT IS THE TRUTHFUL STATUS, not merely an available one. This
 * service is a gateway in front of a model provider, and the upstream did not
 * answer inside the time this gateway was willing to wait. That is precisely
 * what 504 means. 408 would be wrong — it blames the CLIENT's request for being
 * slow; 503 would be wrong — it claims unavailability, when the service is up,
 * healthy, and still working on this very request.
 *
 * NOTHING IN THE FILTER CHANGES. By being an HttpException this takes the
 * filter's FIRST branch, which re-emits status and body exactly as Nest would
 * unfiltered, and logs at warn rather than error — correct, because a deadline
 * is an expected operating condition and not an unhandled fault.
 *
 * THE BODY DISCLOSES NOTHING SENSITIVE. `budgetMs` is a published constant and
 * `cacheKey` stays server-side: it is carried as a field for logging and is
 * deliberately absent from the response shape below.
 */
export class AnalysisDeadlineExceededError extends HttpException {
  constructor(
    public readonly budgetMs: number,
    public readonly cacheKey: string,
  ) {
    super(
      {
        status: 'error',
        code: 'analysis-deadline-exceeded',
        message: `Analysis did not complete within the total synchronous budget of ${budgetMs} ms.`,
        budgetMs,
      },
      HttpStatus.GATEWAY_TIMEOUT,
    );
    this.name = 'AnalysisDeadlineExceededError';
  }
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
    /**
     * Milestone #51 Phase B — optional, bounded story context (e.g.
     * from a World Map country-feed article's "Ask GlobalNews AI
     * about this" action). When storyContext.countryCode is present
     * and resolves to a real known country, it takes priority over
     * this method's own free-text detectLocation() heuristic for
     * choosing retrieval — see the `location` computation below. When
     * absent (every pre-#51 caller, and ordinary homepage/search
     * Q&A), behavior is completely unchanged.
     */
    storyContext?: StoryContext,
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
    //
    // Milestone #51 Phase B: also folds in a stable story identity
    // when present, so two DIFFERENT stories in the SAME country with
    // the SAME query text (e.g. "Rwanda" news re-asked from two
    // different selected articles) can never collide on one cache
    // entry or one in-flight operation — the CTO's own Story A/Story B
    // acceptance requirement. Prefers storyContext.articleId (the
    // most stable, server-resolvable identity) when present; falls
    // back to countryCode alone only when articleId is absent, which
    // preserves this session's earlier (accepted) country-only
    // anchoring behavior for requests that never carry an articleId.
    // A request with no storyContext keeps the exact pre-#51 key shape
    // (empty suffix), so every existing cache entry and every
    // generic-Q&A caller is completely unaffected.
    const storyAnchorKeySegment = storyContext?.articleId
      ? `:story:${storyContext.articleId}`
      : storyContext?.countryCode
        ? `:story:${storyContext.countryCode.toLowerCase()}`
        : '';
    const cacheKey = `${requestedLanguage}:${normalizedQuery.toLowerCase()}${storyAnchorKeySegment}`;

    const cached = this.getCached(cacheKey);

    if (cached) {
      this.logger.debug('Serving cached analysis.');

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
      this.logger.debug('Joining in-flight analysis.');

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
      /*
        ══════════════════════════════════════════════════════════════════════
        REV B — A JOINER IS A CALLER, AND EVERY CALLER IS BOUNDED
        ══════════════════════════════════════════════════════════════════════

        THE HOLE THIS CLOSES. Rev A raced the FRESH operation against the total
        budget at the bottom of this method, and stopped there. This branch
        awaited the shared promise directly, so a request that joined work
        already in progress had no deadline of its own at all — and it is the
        WORSE case, not the better one: a joiner arrives partway through, so the
        remaining wait it inherits is unknown to it and can be the entire
        remainder of a run that is already struggling. The one caller with the
        least information about how long it had left was the one caller with no
        limit on it.

        MEASURED FROM THIS CALLER'S OWN ARRIVAL, DELIBERATELY. The deadline is
        armed here, now, not inherited from whenever the shared operation began.
        That is what makes it match the promise actually made to THIS request:
        its browser started its own compiled `ANALYSIS_CLIENT_TIMEOUT_MS` timer
        when it sent its own fetch, and the server's response deadline is
        defined against the same instant. A joiner is therefore bounded on its
        own clock, exactly like an originator.

        ONE SHARED OPERATION IS PRESERVED — no provider work is duplicated.
        `existingInFlightAnalysis` is the single underlying promise and is
        neither replaced nor re-created here; only what THIS caller AWAITS is
        raced. The originator keeps awaiting its own race over the same promise,
        `inFlightAnalyses` still holds it, and a third caller arriving a moment
        later still joins that same one. If this caller's deadline fires, the
        shared operation continues, completes, and populates the cache — so the
        very next identical request is served from it.
      */
      const sharedResult = await this.withResponseDeadline(
        existingInFlightAnalysis,
        config.totalBudgetMs,
        cacheKey,
      );

      return {
        ...sharedResult,
        query: originalQuery,
        normalizedQuery,
      };
    }

    const inFlightOperation: Promise<AnalysisApiResponse> =
      (async (): Promise<AnalysisApiResponse> => {
        /**
         * Milestone #51 Phase B — root-cause fix. Previously, retrieval
         * for a story-originated query relied ENTIRELY on
         * detectLocation() re-parsing free text (an article title) —
         * a real-browser-verified failure mode: a Rwanda migration-
         * story title didn't trip the free-text detector, so retrieval
         * silently fell through to unrelated generic search results
         * (e.g. an Italian swimming article).
         *
         * When the frontend already KNOWS the story's country (because
         * it came from a World Map country-feed selection), that known
         * country now takes priority over re-derived free-text
         * detection — reusing the exact same resolveCountryByAnyIdentifier()
         * + countryNewsService.getCountryNews() path detectLocation()
         * itself already uses, so every downstream branch (retrieval
         * context construction, article set, prompt building, citation
         * validation) is completely unchanged in shape — this only
         * changes which `location` value seeds it, and only when
         * storyContext really provides one. If storyContext is absent,
         * or its countryCode doesn't resolve to a real country, this
         * falls through to the exact pre-#51 detectLocation() call —
         * ordinary homepage/search Q&A is byte-for-byte unaffected.
         */
        const storyAnchoredLocation: LocationContext | undefined = storyContext?.countryCode
          ? this.resolveStoryContextLocation(storyContext.countryCode)
          : undefined;
        /*
         * G-ALPHA-2 STAGE 2 — DEMONYM GEOGRAPHY, LAST IN PRECEDENCE.
         *
         * "Kenyan election" and "Rwandan politics" named a country as plainly
         * as "in Kenya" does, and resolved to nothing at all: measured on the
         * baseline, country NAMES resolved 12/12 while their demonyms resolved
         * 0/12. This adds the missing reading, and adds it LAST — an explicit
         * story anchor still outranks everything, and every query
         * detectLocation() already answers takes precisely the path it took
         * before, because this is only consulted once that returned undefined.
         *
         * Exactly ONE country, deliberately. Two demonyms ("the Ukrainian and
         * Russian conflicts") is not a country question at all; it is the
         * multi-entity shape, and sending it into a single country's feed
         * would answer half the question while looking like a whole answer.
         * Those fall through to the classifier below.
         */
        /*
         * G-ALPHA-2 STAGE 2 — classified ONCE, here, because the multi-entity
         * reading has to be known BEFORE the geographic route is chosen.
         *
         * classifyQueryIntent() is total and never throws. Its default,
         * CURRENT_EVENT, carries no sides and no subject, so every shape it
         * does not recognise leaves every decision below exactly as it was.
         */
        const classification = classifyQueryIntent(normalizedQuery);

        /*
         * A COMPARISON IS NOT ANSWERED BY ONE OF ITS SIDES.
         *
         * "Compare the current situations in Rwanda and Kenya." matches
         * COUNTRY_CONTEXT_PATTERN on "in Rwanda and Kenya", and the segment
         * scan returns the first country it can resolve. Measured on the
         * baseline, the whole question was therefore answered with the Rwanda
         * country feed — half the comparison, presented as the answer, with
         * nothing anywhere saying Kenya had been dropped. Which half you get
         * is an accident of word order.
         *
         * So when the classifier finds two or more determinable countries, the
         * single-country route is declined and the question goes to per-side
         * retrieval below. This can only ever fire for a question naming at
         * least two countries — a question naming one is untouched, and takes
         * precisely the path it took before.
         *
         * storyContext STILL WINS. An explicit caller-supplied countryCode is
         * a stated context, not an inference from the sentence, so it keeps
         * its existing precedence ahead of everything here.
         */
        /*
         * NATURAL SOURCE-ATTRIBUTED QUESTION R1 — RESOLVED BEFORE ROUTING,
         * BECAUSE IT DECIDES ROUTING.
         *
         * Two steps, deliberately separate. The frame only reports that a
         * sentence has a source half and a topic half; the curated registry
         * decides whether that half names a publisher this product carries.
         * BOTH must succeed. A frame that matched around an unknown name
         * yields `undefined` here and the question keeps exactly the routing
         * it had before this block existed — it does NOT quietly become an
         * unrestricted search for its topic.
         *
         * WHY IT IS RESOLVED HERE, AHEAD OF EVERY ROUTING DECISION. Two
         * branches would otherwise answer a source-attributed question with
         * someone else's reporting, and both name a PLACE that really is in
         * the sentence:
         *
         *   "What does KT Press report about East Africa?"      -> the
         *   declared-region branch fans out across eleven member countries
         *   and the KT Press constraint is simply gone.
         *
         *   "What does Statistics Poland report about X in Poland?" -> the
         *   country branch answers with any Polish reporting at all.
         *
         * In both, the reader named a PUBLISHER. That is the stronger,
         * explicitly-stated constraint, and neither place-name is the thing
         * being asked about. So this intent stands both of them down.
         *
         * EACH STAND-DOWN IS EXPRESSED WHERE IT COSTS NO ACCEPTED AUTHORITY.
         * `detectDeclaredRegion` is simply not consulted, so `declaredRegion`
         * is `undefined` and `if (declaredRegion) {` below is reached exactly
         * as written. The `location` expression is likewise computed exactly
         * as before — declared-regions.spec.ts asserts BOTH of those texts
         * verbatim, because they are what prove a typed region outranks the
         * map camera — and the country branch's own guard stands down
         * instead.
         *
         * THE ARTICLE ANCHOR STILL OUTRANKS THIS INTENT, and that falls out
         * of the structure rather than being asserted separately: with
         * `declaredRegion` undefined the chain reaches `else if
         * (anchorArticle)` next, so a reader who selected a specific story
         * still gets that story's routing.
         *
         * No question the product already routes can reach the new branch,
         * because none of them place a closed reporting verb between a
         * bounded name and a topic preposition.
         */
        const sourceAttributedIntent = detectSourceAttributedIntent(normalizedQuery);
        const sourceAttributedFrame = sourceAttributedIntent?.query;
        const requestedSource: RequestedSource | undefined = sourceAttributedFrame
          ? resolveRequestedSource(sourceAttributedFrame.sourcePhrase)
          : undefined;
        const sourceAttributed =
          sourceAttributedFrame && requestedSource
            ? { topic: sourceAttributedFrame.topic, requestedSource }
            : undefined;

        /*
         * REV C — THE PARSED FRAME IS ITSELF THE CONSTRAINT. RESOLUTION ONLY
         * DECIDES WHETHER IT CAN BE SATISFIED.
         *
         * WHAT R1 GOT WRONG HERE, AND I DID NOT SEE UNTIL IT WAS POINTED OUT.
         * R1 treated an unresolved publisher as "no source intent" and let
         * ordinary routing resume. I defended that as a strict no-op, and it
         * is a no-op only against ONE risk — an unrestricted topic search.
         * It is not a no-op against the branches that route on a PLACE:
         *
         *   "What does Reuters report about Poland?"       -> country routing,
         *                                                     answered with any
         *                                                     Polish reporting
         *   "What does Reuters report about East Africa?"  -> eleven-member
         *                                                     regional fan-out
         *
         * Both hand the reader another publisher's reporting in answer to a
         * question about Reuters. That is precisely the substitution this
         * whole correction exists to prevent, arrived at by a different road.
         *
         * SO THE SIGNAL IS THE FRAME, NOT THE RESOLUTION. `sourceIntent` is
         * true whenever the sentence parsed as a source-attributed question at
         * all. It stands down region, country and relational routing. Whether
         * the named publisher is in the curated registry then decides only
         * ONE thing: whether the question can be answered, or must fail
         * closed.
         *
         * FAIL CLOSED MEANS ZERO, NOT "NEXT BEST". An unknown publisher is not
         * an invitation to search the topic, nor to answer about the place:
         * the honest reply to "what does an outlet we do not carry say about
         * X" is that we cannot know. Nothing is substituted and OpenAI is
         * never reached.
         *
         * THE ARTICLE ANCHOR IS DELIBERATELY EXEMPT and keeps the precedence
         * it already had — see the branch chain below, which the anchor
         * reaches before any of this.
         */
        /*
         * REV C REV A — THE SIGNAL IS THE MATCHED FRAME, NOT THE USABLE PARSE.
         *
         * Rev C read this from `deriveSourceAttributedQuery()`, which returns
         * `undefined` BOTH when no source-attributed syntax matched AND when it
         * matched but a half was unusable — an over-long source span, or an
         * empty topic. The second case therefore lost its intent and ordinary
         * place routing became eligible again:
         *
         *   "What does The International Center for Investigative Reporting
         *    Network report about Poland?"
         *
         * matched the frame, had its seven-word source rejected by the parser's
         * admissibility bound, and was answered as an ordinary Poland question.
         * That is the substitution Rev C exists to prevent, reached through the
         * bound instead of through resolution.
         *
         * `detectSourceAttributedIntent()` reports the two facts separately, so
         * this line now means what Rev C always intended it to mean: the reader
         * named a source. Whether that source is USABLE and whether it RESOLVES
         * are two further questions, and both of them only decide whether the
         * question can be answered — never whether the constraint applies.
         *
         * THE SIX-WORD BOUND IS UNCHANGED AND STILL USEFUL. It still decides
         * what may be treated as a publisher name; it simply no longer decides
         * whether the reader imposed a constraint.
         */
        const sourceIntent = sourceAttributedIntent;

        if (sourceIntent && !requestedSource) {
          this.logger.debug(
            `Question names a source ("${sourceIntent.rawSourcePhrase}")` +
              (sourceIntent.rejection
                ? ` that this parser cannot use (${sourceIntent.rejection})`
                : ' that resolves to no curated publisher') +
              '. The constraint still stands: no country route, no regional route and no ' +
              'unrestricted topic search are attempted.',
          );
        }

        /*
         * ══════════════════════════════════════════════════════════════════
         * C907 §8 — A DECLARED REGION IS A REQUEST SCOPE, AND IT OUTRANKS THE
         * CAMERA
         * ══════════════════════════════════════════════════════════════════
         *
         * THE RULING: *"The typed question remains authoritative over current
         * camera context."*
         *
         * `storyContext` is the camera: it is how the map tells this service
         * which country the reader was looking at when they opened Ask AI. It
         * has outranked everything since Milestone #51, and for a question
         * that names no place that is right — a selected story IS the subject.
         *
         * It is wrong when the reader has typed a place. Someone looking at
         * Rwanda who asks "what's happening in East Africa" has said, in
         * words, what they want, and answering with Rwanda's feed would
         * silently narrow eleven countries to one while appearing to answer.
         * So a declared region detected in the TYPED TEXT is resolved first
         * and wins.
         *
         * IT IS DELIBERATELY NARROW. `detectDeclaredRegion` matches a short
         * closed list of the region's actual names on word boundaries. A
         * question that does not name a declared region reaches exactly the
         * routing it reached before this block existed, including the
         * storyContext precedence — which is why no other shape changes.
         */
        /*
         * REV B · B — EXPLICIT SOURCE INTENT IS NOT LOST TO REGION ROUTING.
         *
         * Standing the region down by NOT CONSULTING the detector — rather
         * than by rewriting `if (declaredRegion) {` or the `location`
         * expression — is deliberate: both of those texts are asserted
         * verbatim by declared-regions.spec.ts, and neither was written to
         * express this. `detectDeclaredRegion` itself is untouched, region
         * membership is untouched, and regional retrieval is untouched.
         *
         * An ordinary "What's happening in East Africa?" carries no reporting
         * verb between a bounded publisher name and a topic preposition, so
         * `sourceAttributed` is undefined for it and this line is exactly the
         * call it always was.
         */
        const declaredRegion = sourceIntent
          ? undefined
          : detectDeclaredRegion(normalizedQuery);

        if (declaredRegion) {
          this.logger.debug(
            `Typed question names the declared region "${declaredRegion.id}" ` +
              `(${declaredRegion.members.length} declared members); ` +
              'retrieving per member rather than as one generic search.',
          );
        }

        const location =
          declaredRegion !== undefined
            ? undefined
            : (storyAnchoredLocation ??
              (classification.sides.length >= 2
                ? undefined
                : (this.detectLocation(normalizedQuery) ??
                  this.detectLocationByDemonym(normalizedQuery))));

        /**
         * R4 C1 — THE ANCHOR LOOKUP MOVES AHEAD OF RETRIEVAL.
         *
         * This is the same NewsService.findArticleById() call Milestone #51
         * Phase B already made; only its position changes. It used to run
         * AFTER retrieval had finished, because its only job was to prepend a
         * story that retrieval might have dropped. That ordering is exactly
         * what made the defect possible: the article could not influence a
         * query that had already been sent.
         *
         * Hoisting it costs nothing — one lookup, same method, same
         * never-throws contract (findArticleById returns null on absence and
         * on any database failure) — and it is what lets the query be built
         * from the story instead of from the country. The M51 prepend below is
         * left exactly where it was and now simply reuses this value, so
         * anchor preservation is unchanged in behavior and in location.
         *
         * When articleId is absent or does not resolve, `anchorArticle` is
         * null and every branch below takes the pre-R4 path unchanged.
         */
        const anchorArticle = storyContext?.articleId
          ? await this.newsService.findArticleById(storyContext.articleId)
          : null;

        let articles: NewsArticle[];
        let retrievalContext: AnalysisRetrievalContext;
        // Milestone #40 (authoritative-context correction): set ONLY when
        // the M37 relational branch below matches — undefined for country/
        // city retrieval and for ordinary M35/M36 generic queries. This is
        // the exact same relationalQuery.x/y AnalysisService already
        // computes for retrieval — no second parser, no reinterpretation.
        let relationalContext: { x: string; y: string } | undefined;

        if (declaredRegion) {
          /*
            ══════════════════════════════════════════════════════════════════
            THE DECLARED-REGION BRANCH — ALL MEMBERS, BOUNDED CONCURRENCY
            ══════════════════════════════════════════════════════════════════

            *"the declared region is the requested coverage scope … ALL 11
            members must be eligible for retrieval. The bound applies to
            CONCURRENCY / batching, not permanent membership."*

            Per-member retrieval is the SAME work the comparison branch does —
            one provider call per country, the unmodified `scoreCountryRelevance`
            firewall on every response, provider-failure responses excluded from
            evidence — extracted into `retrieveMemberEvidence` so the two
            branches cannot drift. What differs is only the schedule: batches of
            `MAX_CONCURRENT_REGION_REQUESTS`, continuing until the declared
            membership is exhausted or the provider stops us.

            PER-REPORT EVIDENCE GEOGRAPHY IS PRESERVED, which is why the fan-out
            is per member rather than one blended query: an article enters the
            pool only because it passed the gate for a SPECIFIC country, and it
            keeps whatever country the resolver found in its own text.
            AGGREGATION HAPPENS ONLY AFTER RETRIEVAL, and no article is ever
            relabelled as "East Africa".
          */
          const regional = await this.retrieveDeclaredRegionEvidence(
            declaredRegion,
            requestedLanguage,
            classification.countries,
          );

          articles = regional.articles;
          retrievalContext = regional.retrievalContext;

          /*
            ── THE PROVIDER-RESILIENCE LADDER ────────────────────────────────

            LIVE succeeded                      -> normal evidence analysis.
            LIVE throttled/unavailable AND
              relevant retained evidence exists -> RETAINED_ONLY, disclosed.
            LIVE unavailable AND nothing
              retained for this scope           -> no AI call at all.

            Retained reporting is fetched PER MEMBER COUNTRY of the region that
            was asked about — including the members a throttled second batch
            never reached, which is the case the ruling names: *"If provider
            throttling interrupts the second batch: preserve completed
            evidence … use relevant retained reporting where available."*
            `findRetainedByCountry` cannot answer a question about a country it
            was not given, so *"do not substitute unrelated cached reporting"*
            is enforced by the shape of the call.
          */
          const liveIncomplete =
            regional.unreached.length > 0 || regional.unavailable.size > 0 || articles.length === 0;

          if (liveIncomplete) {
            /*
              WHICH MEMBERS THE RETAINED PASS COVERS.

              The ones live retrieval did not answer for: never attempted
              (a batch cut short by throttling) or attempted and failed. When
              live produced nothing at all, every member is eligible — the
              whole question went unanswered, not part of it.
            */
            const gaps =
              articles.length === 0
                ? [...regional.attempted, ...regional.unreached]
                : [
                    ...regional.unreached,
                    ...regional.attempted.filter((m) => regional.unavailable.has(m.iso3)),
                  ];

            const retained = await this.retrieveRetainedForRegion(gaps);
            const held = new Set(articles.map((article) => article.url));
            const additions = retained.filter((candidate) => !held.has(candidate.url));

            if (additions.length > 0) {
              const retainedMembers = memberIso3WithEvidence(additions, gaps);
              articles = deduplicateArticles([...articles, ...additions]);

              retrievalContext = {
                ...retrievalContext,
                dataMode: 'cached',
                fallbackReason: 'provider-error',
                articlesRetrieved: articles.length,
                outcome: 'RETAINED_ONLY',
                requestedScope: buildRegionScope(declaredRegion, {
                  attempted: regional.attempted,
                  unreached: regional.unreached,
                  live: regional.live,
                  unavailable: regional.unavailable,
                  retainedOnly: retainedMembers,
                }),
              };

              this.logger.warn(
                `Region "${declaredRegion.id}": ${regional.attempted.length} of ` +
                  `${declaredRegion.members.length} members attempted, ` +
                  `${regional.unreached.length} not reached; served ${additions.length} RETAINED ` +
                  "articles from this region's own members, disclosed as RETAINED_ONLY.",
              );
            }
          }
        } else if (anchorArticle) {
          /**
           * R4 C1/C2/C3 — ARTICLE-SPECIFIC EVIDENCE.
           *
           * WHAT THIS REPLACES. Before this branch existed, a request carrying
           * storyContext.countryCode fell into the country branch below, whose
           * provider query is CountryNewsService's buildSearchTerm() — the
           * bare country name. The measured consequence: the selected story
           * "Hotel worker charged with sexually assaulting Australian
           * three-year-old in Penang" produced the GNews query `Australia`,
           * and the Sources Dock filled with seven unrelated Australian
           * stories that each correctly answered the only question asked of
           * them. The Airport Chaplain story did the same thing with Tuvalu.
           *
           * countryCode is NOT ignored here. It is demoted to what it always
           * was — geographic context — and is used below to keep Evidence
           * Geography resolving, never to choose the retrieval query.
           *
           * Precedence is deliberate: a resolved anchor outranks a country
           * hint, because the anchor is the more specific statement of what
           * the user asked about. When there is no anchor the country branch
           * below runs byte-for-byte as before.
           */
          const anchorTerms = extractAnchorTerms(anchorArticle.title ?? '');
          const anchored = await this.retrieveAnchorEvidence(anchorArticle, anchorTerms);

          articles = anchored.supporting;
          retrievalContext = this.toAnchoredRetrievalContext(
            anchored.response,
            anchorArticle,
            anchored.supporting,
            storyContext?.countryCode,
          );
        } else if (location && sourceIntent === undefined) {
          const { country, city, geoMatch } = location;

          if (geoMatch) {
            this.logger.debug(
              `Resolved geographic typo -> "${geoMatch.canonicalLocation}" ` +
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

          // Milestone #63 — bounded domain-aware supplemental retrieval.
          // Fires ONLY for genuinely broad questions (>=3 distinct
          // requested analytical domains) AND only when the primary
          // candidate pool is missing coverage for at least one of
          // them. Ordinary and already-well-covered broad questions
          // take exactly the same single-provider-call path as before
          // this milestone — confirmed by this block never running for
          // fewer than 3 requested domains or zero missing domains.
          const requestedDomains = detectRequestedDomains(normalizedQuery);

          if (isBroadMultiDomainQuestion(requestedDomains)) {
            const representedDomains = detectRepresentedDomains(articles);
            const missingDomains = selectMissingDomains(requestedDomains, representedDomains);

            // Hard cap: at most 2 supplemental provider calls, giving a
            // maximum of 3 total for this branch (1 primary + up to 2
            // supplemental) — selectMissingDomains() itself already
            // slices to 2, this loop cannot iterate more than that.
            if (missingDomains.length > 0) {
              // Kept GROUPED BY DOMAIN (not flattened) — final-evidence
              // selection below reserves at most ONE representative per
              // successful domain, so it needs each domain's own
              // relevance-filtered result set, not one merged list.
              const relevantSupplementalByDomain = new Map<AnalyticalDomain, NewsArticle[]>();

              for (const domain of missingDomains) {
                const supplementalTerm = makeProviderSafeNewsQuery(
                  buildSupplementalSearchTerm(country.name, domain),
                );

                /*
                 * PROVIDER-SAFETY EDGE CLOSURE. makeProviderSafeNewsQuery()
                 * now reports "there is no lexical query here" as undefined
                 * instead of restoring an unsendable punctuation-only string.
                 * A supplemental term is built from a real country name and a
                 * domain keyword, so this is defensive rather than expected —
                 * but the correct response to it is to skip this domain, never
                 * to send something the provider will refuse.
                 */
                if (supplementalTerm === undefined) continue;

                try {
                  const supplementalResponse = await this.newsService.search(
                    supplementalTerm,
                    SEARCH_POOL_SIZE,
                  );

                  // M63 live-acceptance correction — NewsResponse.dataMode
                  // / fallbackReason already distinguish a provider
                  // failure/rate-limit degradation (dataMode
                  // 'unavailable' or 'cached', fallbackReason
                  // 'provider-error') from a genuine live zero-result
                  // search (dataMode 'live', no fallbackReason). This is
                  // read-only — it changes only which log message is
                  // emitted, never the actual relevance filtering,
                  // reservation, or evidence flow below: a genuine
                  // provider-error response already carries no usable
                  // live articles by its own contract, so
                  // relevantSupplemental naturally ends up empty and no
                  // slot gets reserved for this domain either way — the
                  // existing "no usable supplemental evidence, continue
                  // safely" behavior is completely unchanged. No
                  // retries, no additional provider calls, no change to
                  // domain selection.
                  //
                  // CTO correction (narrowed condition): the gate below
                  // targets ONLY the two states that genuinely represent
                  // a provider failure/rate-limit degradation —
                  // 'unavailable' (nothing could be returned at all) and
                  // 'cached' specifically WHEN fallbackReason is
                  // 'provider-error' (stored reporting was substituted
                  // because the live provider failed). It deliberately
                  // does NOT reject:
                  //   - dataMode 'mock' — a valid, intentional
                  //     development/demo operating mode, not a failure
                  //     (confirmed via GNewsProvider.health()'s own
                  //     "running in mock mode" wording for an
                  //     unconfigured API key — this is a real,
                  //     documented, non-error state);
                  //   - dataMode 'cached' with fallbackReason
                  //     'no-live-results' — the provider genuinely
                  //     responded; it simply had nothing new to report,
                  //     which is not the same as failing. Existing
                  //     downstream relevance/dedup/reservation logic
                  //     still decides whether such articles ultimately
                  //     survive — this gate only prevents a genuine
                  //     provider-failure response from masquerading as
                  //     successful evidence.
                  const isProviderFailure =
                    supplementalResponse.dataMode === 'unavailable' ||
                    (supplementalResponse.dataMode === 'cached' &&
                      supplementalResponse.fallbackReason === 'provider-error');

                  if (isProviderFailure) {
                    this.logger.warn(
                      `M63 supplemental domain "${domain}": provider unavailable ` +
                        `(dataMode=${supplementalResponse.dataMode}, ` +
                        `fallbackReason=${supplementalResponse.fallbackReason ?? 'none'}); ` +
                        'treating as no usable supplemental evidence for this domain',
                    );
                    // CTO correction: a genuine provider-failure
                    // response (e.g. an 'unavailable' result, or a
                    // 'cached' fallback returned specifically because
                    // the live provider failed) must never populate
                    // relevantSupplementalByDomain, even if it happens
                    // to carry stored/stale articles — those were not
                    // genuinely retrieved for THIS supplemental request
                    // and must not be treated as fresh evidence for
                    // this domain. Skip straight to the next domain —
                    // no retry, no additional provider call, no change
                    // to domain selection.
                    continue;
                  }

                  // Same country-relevance discipline the primary
                  // country retrieval already applies (isRelevant, per
                  // scoreCountryRelevance) — reused directly, not a
                  // second relevance system. An irrelevant supplemental
                  // result never enters evidence, and a domain with no
                  // relevant results simply gets no entry in the map
                  // below (never a reserved slot).
                  /*
                    K — COUNTRY RELEVANCE IS NECESSARY, NOT SUFFICIENT.

                    `isRelevant` answers "is this article about Poland". It
                    admitted a Mumbai property comparison that mentioned a house
                    in Poland — genuinely about Poland, and not a Polish
                    development. `admitsToAnalysisCorpus` adds the second
                    question, reading the partition that already existed and had
                    no caller on this path.

                    No threshold moved and no publisher is blocked.
                  */
                  const relevantSupplemental = supplementalResponse.articles.filter(
                    (article) =>
                      scoreCountryRelevance(article, country).isRelevant &&
                      admitsToAnalysisCorpus(article, country),
                  );

                  if (relevantSupplemental.length > 0) {
                    relevantSupplementalByDomain.set(domain, relevantSupplemental);
                  }
                } catch (error) {
                  // A failed supplemental search never fails the whole
                  // analysis — the primary country evidence still
                  // proceeds exactly as it would have before this
                  // milestone. No evidence for this domain is simply
                  // no evidence — never fabricated.
                  this.logger.warn(
                    `M63 supplemental domain search failed for "${domain}"; continuing without it`,
                    error instanceof Error ? error : undefined,
                  );
                }
              }

              if (relevantSupplementalByDomain.size > 0) {
                // Truthful retrieval metadata (CTO-approved semantics):
                // articlesRetrieved reflects the UNIQUE MERGED CANDIDATE
                // POOL — primary + all relevant supplemental results,
                // deduplicated — BEFORE final maxArticles selection.
                // This is a retrieval-pool count, matching how this
                // field already behaved pre-M63 (it was never a
                // final-evidence count), not primary count + reserved-
                // representative count.
                const allRelevantSupplemental = [...relevantSupplementalByDomain.values()].flat();
                const uniqueMergedCandidatePool = deduplicateArticles([
                  ...articles,
                  ...allRelevantSupplemental,
                ]);
                retrievalContext = {
                  ...retrievalContext,
                  articlesRetrieved: uniqueMergedCandidatePool.length,
                };

                // Existing clustering, applied to primary evidence only
                // — unchanged function, unchanged input for this step.
                const clusteredPrimary = clusterDuplicateArticles(articles);

                // For each successful supplemental domain (at most 2),
                // walk its relevant results in their EXISTING provider/
                // service order and reserve the FIRST one that is not a
                // likely duplicate of the clustered primary evidence or
                // of a supplemental representative already reserved for
                // an earlier domain. No new ranking/scoring — reuses
                // the existing areLikelyDuplicateArticles() pairwise
                // check. If every relevant article for a domain
                // duplicates existing evidence, that domain simply
                // reserves no slot.
                const reservedRepresentatives: NewsArticle[] = [];

                for (const domainArticles of relevantSupplementalByDomain.values()) {
                  const representative = domainArticles.find(
                    (candidate) =>
                      !clusteredPrimary.some((existing) =>
                        areLikelyDuplicateArticles(existing, candidate),
                      ) &&
                      !reservedRepresentatives.some((reserved) =>
                        areLikelyDuplicateArticles(reserved, candidate),
                      ),
                  );

                  if (representative) {
                    reservedRepresentatives.push(representative);
                  }
                }

                // reservedRepresentatives.length <= 2 always holds here
                // (at most 2 domains ever reach this loop). Remaining
                // slots are filled with the EXISTING primary ordering —
                // primary evidence remains dominant by construction,
                // since at most 2 of config.maxArticles slots are ever
                // reserved for supplemental representatives.
                const remainingSlots = Math.max(
                  0,
                  config.maxArticles - reservedRepresentatives.length,
                );

                articles = [
                  ...clusteredPrimary.slice(0, remainingSlots),
                  ...reservedRepresentatives,
                ];
              }
            }
          }
        } else {
          // Milestone #37: attempt deterministic relational decomposition
          // FIRST — only ever reached after detectLocation() has already
          // returned undefined, so country/city routing above is
          // completely unaffected. An unmatched (non-relational) query
          // falls through unchanged to M35's deriveGenericNewsQuery() below
          // — this branch never runs for "What's happening with NATO?",
          // "What's happening in the Middle East?", "cybersecurity", etc.,
          // since none of those match the closed relational pattern set.
          const relationalQuery = sourceIntent
            ? undefined
            : deriveRelationalSearchQueries(normalizedQuery);

          if (sourceAttributed) {
            /*
             * R1 REV A — THE CONSTRAINT IS HANDED TO RETRIEVAL, NOT APPLIED
             * TO ITS RESULT.
             *
             * R1 filtered here, after `newsService.search()` had returned.
             * That was wrong for a reason no amount of filtering could fix:
             * the tier ladder stops at the primaries as soon as they return
             * one RAW article, so a healthy GNews carrying one topically
             * relevant article from the WRONG publisher ended retrieval before
             * Publisher Feeds was ever asked — and this branch then removed
             * the only article there was. R1 worked only while GNews was
             * failing.
             *
             * The constraint now travels WITH the request. NewsService applies
             * it inside the same closure as the relevance gate, so its existing
             * bounded post-relevance rescue sees "zero qualifying
             * requested-source articles" and consults the fallback tier once,
             * exactly as it already does when the gate rejects everything. No
             * second ladder, no tier promotion, and no RSS call from here.
             *
             * The topic half still goes through the SAME provider-safety
             * chokepoint and the SAME 'generic' relevance gate every other
             * generic query uses.
             *
             * WHEN NOTHING QUALIFIES, THE ANSWER IS NOTHING. The retrieval
             * context still records what retrieval actually did, `articles`
             * is empty, and the existing zero-evidence surface below produces
             * the honest not-attempted response with no OpenAI call.
             * Substituting another publisher's reporting is never an option.
             */
            const topicSent = makeProviderSafeNewsQuery(sourceAttributed.topic);

            if (topicSent === undefined) {
              this.logger.warn(
                'Source-attributed retrieval has no lexical topic after provider-safe ' +
                  'normalization — no provider request was made.',
              );
              articles = [];
              retrievalContext = NON_RETRIEVABLE_QUERY_CONTEXT;
            } else {
              this.logger.debug(
                `Source-attributed question: topic "${topicSent}" constrained to ` +
                  `${sourceAttributed.requestedSource.displayName} ` +
                  `(${sourceAttributed.requestedSource.sourceId}).`,
              );

              const sourceResponse = await this.newsService.search(
                topicSent,
                SEARCH_POOL_SIZE,
                { type: 'generic' },
                { requestedSource: sourceAttributed.requestedSource },
              );

              if (sourceResponse.articles.length === 0) {
                this.logger.debug(
                  'Retrieval found no article attributable to ' +
                    `${sourceAttributed.requestedSource.displayName} — returning zero evidence ` +
                    'rather than another publisher.',
                );
              }

              articles = sourceResponse.articles;
              retrievalContext = this.toRetrievalContext(sourceResponse);
            }
          } else if (sourceIntent) {
            /*
             * REV C — FAIL CLOSED. THE READER NAMED A PUBLISHER THIS PRODUCT
             * DOES NOT CARRY.
             *
             * Reached only when the sentence parsed as a source-attributed
             * question AND the named publisher resolved to nothing in the
             * curated registry AND no article anchor claimed the request
             * first. Every other route has already been stood down above, so
             * there is exactly one thing left to decide: what to do instead.
             *
             * NOTHING. No provider is asked, because there is no publisher to
             * ask about. The topic is NOT searched on its own — that would
             * answer a question about Reuters with whoever else happened to
             * publish. The place named inside the topic is NOT routed to —
             * that is the same substitution wearing a country's name.
             *
             * THE SURFACE IS THE EXISTING ONE, NOT A NEW STATE.
             * NON_RETRIEVABLE_QUERY_CONTEXT already means "no provider was
             * asked, and nothing about a provider is claimed"; its own
             * comment covers the neighbouring case of a question with no
             * determinable members. An unresolvable publisher is the same
             * family: the question names a constraint the product cannot
             * satisfy. `articles` stays empty, so the zero-evidence guard
             * below returns the honest not-attempted response and OpenAI is
             * never reached.
             *
             * THIS IS NOT A REFUSAL TO ADD PUBLISHERS. Widening the registry
             * is a separate, curated decision with its own verification; it
             * is not something a question should be able to do by naming a
             * masthead.
             */
            this.logger.log(
              `Source-attributed question names "${sourceIntent.rawSourcePhrase}", which is not ` +
                'a curated publisher this product carries. Returning zero evidence rather than ' +
                'answering from some other source, or about the place its topic mentions.',
            );

            articles = [];
            retrievalContext = NON_RETRIEVABLE_QUERY_CONTEXT;
          } else if (relationalQuery) {
            this.logger.debug('Detected relational query.');

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
          } else if (classification.intent === 'CLARIFICATION_REQUIRED') {
            /*
             * G-ALPHA-2 — AN IMPLICIT COMPARISON IS NOT ANSWERED BY GUESSING
             * WHO IS BEING COMPARED.
             *
             * "Which country is more powerful in East Africa?" asks for a
             * comparison and names no members. Retrieval has exactly two
             * options: invent the members — decide for the user which East
             * African countries they meant, which is evidence SELECTION
             * fabricated to make an answer possible — or decline. The CTO
             * required the second, and this is it.
             *
             * NOTHING NEW IS SHOWN TO THE READER. This is the existing
             * non-retrievable surface, the same one the provider-safety edge
             * closure already uses: empty articles, an honest context saying
             * nothing was retrieved and that no provider is to blame for it,
             * and the untouched downstream guard that refuses to call OpenAI
             * without evidence. Presentation copy belongs to the frontend
             * owner and is deliberately not invented here.
             *
             * Measured against the baseline this is also strictly cheaper:
             * the same zero-evidence outcome, reached without spending a
             * provider call on a sentence no provider could match.
             */
            this.logger.debug(
              `Query asks for a comparison with no determinable members (${classification.reason}); ` +
                'no provider request was made.',
            );
            articles = [];
            retrievalContext = NON_RETRIEVABLE_QUERY_CONTEXT;
          } else if (classification.sides.length >= 2) {
            /*
             * G-ALPHA-2 — MULTI-ENTITY AND COMPARISON RETRIEVAL, ONE SIDE AT A
             * TIME.
             *
             * WHY NOT THE RELATIONAL BRANCH. Routing these into M37's
             * relational retrieval was the obvious reuse and it is wrong, so
             * it is recorded here rather than quietly avoided. M38's
             * scoreRelationalRelevance requires X and Y to co-occur in the
             * SAME title or the SAME summary sentence — correct for "how is X
             * affecting Y", and fatal here. Checked against the reported
             * corpus: "Ukraine reports overnight strikes on energy
             * infrastructure" names Ukraine and not Russia, "Russia says talks
             * on grain corridor stalled" names Russia and not Ukraine, so a
             * relational gate rejects BOTH and the flagship question returns
             * zero for a second reason after the first was fixed. A genuine
             * update on the Ukrainian conflict is genuine evidence for a
             * question about the Ukrainian conflict.
             *
             * SO EACH SIDE IS RETRIEVED AND GATED ON ITS OWN, and the results
             * are merged. This is the Milestone #63 supplemental-retrieval
             * discipline applied to a second question shape, not a new system:
             * a hard cap on provider calls, the existing unmodified relevance
             * gate on every call, provider-failure responses excluded from
             * evidence rather than counted as empty, deduplication before
             * anything is reported, and truthful retrieval metadata.
             *
             * THE GATE IS NOT WEAKENED. `{ type: 'generic' }` is the same
             * opt-in relevance mode the ordinary generic branch uses, so
             * NewsService applies the same unmodified scoreGenericRelevance to
             * each side's results before they are ever seen here. An article
             * that does not match the side it was retrieved for is discarded
             * exactly as it is today. Zero across every side is zero, and ends
             * at the existing zero-evidence surface with OpenAI never called.
             */
            this.logger.debug(
              `Detected ${classification.intent} query over sides ` +
                `[${classification.sides.map((side) => side.name).join(', ')}] ` +
                `(${classification.reason}).`,
            );

            const perSide = await this.retrievePerSideEvidence(
              classification.sides,
              requestedLanguage,
            );

            articles = perSide.articles;
            retrievalContext = perSide.retrievalContext;
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
            const derivedPolishTopic = derivePolishRetrievalQuery(normalizedQuery);

            /*
             * G-ALPHA-2.1 (A) — THE SAME GAP-FILLING RULE THE ENGLISH BRANCH USES.
             *
             * derivePolishRetrievalQuery() returns the punctuation-stripped
             * sentence UNCHANGED when none of its three closed patterns matched
             * — its documented, deliberately non-destructive fallback. That is
             * the identical failure shape G-ALPHA-1 D2 measured in English: the
             * whole sentence becomes both the provider phrase and the phrase
             * the relevance gate demands verbatim inside a headline.
             * "Wyjaśnij czym jest kwant i opowiedz o tym więcej" is that shape.
             *
             * So the classifier's subject is used ONLY when the Polish
             * derivation did nothing at all. Every shape Milestone #47 already
             * handles keeps its own topic and the classifier is ignored
             * entirely — a strict addition to the unmatched case, exactly as in
             * the English branch.
             */
            const polishDerivationLeftSentenceIntact =
              derivedPolishTopic.trim() === normalizedQuery.trim().replace(/[?!.,;:]+$/gu, '');

            const polishTopic =
              polishDerivationLeftSentenceIntact && classification.subject
                ? classification.subject
                : derivedPolishTopic;

            /**
             * R4 POLISH LIVE 400 — P1. THE PROVIDER-SAFETY CHOKEPOINT REACHES
             * THIS BRANCH AT LAST.
             *
             * The measured failure: the live request "Polska, bezpieczeństwo"
             * matches none of the three POLISH_SUBJECT_PATTERNS, so
             * derivePolishRetrievalQuery() correctly returns the
             * punctuation-stripped ORIGINAL — and stripTrailingPunctuation()
             * strips only TRAILING punctuation, so an interior comma survives.
             * That string was then handed to the provider verbatim, and GNews
             * refused it:
             *
             *     WARN Provider "gnews" failed to respond [bad-request]
             *          (GNews responded with status 400.)
             *
             * The approved punctuation correction already solved exactly this,
             * but it was wired into the English generic branch only. Nothing
             * new is invented here: this is the SAME
             * makeProviderSafeNewsQuery() the English branch calls, applied at
             * the boundary it was always meant to guard.
             *
             * THE HOST PROVED THE FIX BEFORE IT WAS WRITTEN. Two probes, one
             * variable each:
             *     /top-headlines lang=pl q=Polska bezpieczeństwo  -> 200
             *     /search        lang=en q=Polska bezpieczeństwo  -> 200
             * The comma was the cause; the diacritics are accepted. No
             * transliteration, no ASCII filter — the sanitizer is Unicode-aware
             * (\p{L}\p{N}) so Ł, ó, ź, ń and ę pass through untouched.
             *
             * SCOPE. This changes ONLY what is sent to the provider.
             * normalizedQuery, response.query, responseLanguage and everything
             * the reader sees keep the user's own comma.
             */
            /*
             * CAUGHT BY THE REGRESSION, NOT BY THE COMPILER. My first version
             * of this line read `makeProviderSafeNewsQuery(polishTopic)` and
             * then tested the result for `undefined`. That contract belongs to
             * the pending article-evidence closure; on THIS base the function
             * still returns `string`, so the guard was dead code and a
             * punctuation-only Polish question walked straight into a provider
             * call with an undefined mock. `strictNullChecks` did not object.
             * The PL edge test did.
             *
             * The emptiness question is therefore asked of
             * toProviderSafePunctuation() directly — the same function
             * makeProviderSafeNewsQuery() calls first internally, exported
             * alongside it, and idempotent on an already-safe string. Written
             * as a ternary so the value is genuinely `string | undefined` here
             * and stays correct if the closure later lands and changes the
             * other function's return type.
             */
            const polishSafeBase = toProviderSafePunctuation(polishTopic);
            const polishSent =
              polishSafeBase.length === 0 ? undefined : makeProviderSafeNewsQuery(polishSafeBase);

            if (polishSent === undefined) {
              /*
               * The Polish question contained no Unicode letter or numeral at
               * all. There is nothing to search for, so nothing is asked. This
               * is the existing honest zero-evidence surface — the same one a
               * genuine empty result already uses — and OpenAI is still never
               * reached. Deliberately NOT a substituted term and NOT a
               * punctuation-only request the provider would refuse.
               */
              this.logger.warn(
                'Polish retrieval has no lexical query after provider-safe normalization — ' +
                  'no provider request was made.',
              );
              articles = [];
              retrievalContext = {
                dataMode: 'unavailable',
                providers: [],
                fallbackReason: 'no-live-results',
                articlesRetrieved: 0,
              };
            } else {
              const primaryResponse = await this.newsService.topHeadlines(SEARCH_POOL_SIZE, {
                lang: 'pl',
                q: polishSent,
              });

              /*
               * Scored against the SAME string that was sent. scoreGenericRelevance
               * normalizes with /[^\p{L}\p{N}]+/gu before matching, so a comma is
               * already invisible to it — measured on both a positive and a
               * negative fixture, not assumed, and pinned by a test. Using the sent
               * form keeps "what we asked for" and "what we admit" the same string
               * rather than leaving two near-identical topics in flight.
               */
              const relevantPrimaryArticles = primaryResponse.articles.filter(
                (article) => scoreGenericRelevance(article, polishSent).isRelevant,
              );

              if (relevantPrimaryArticles.length > 0) {
                articles = relevantPrimaryArticles;
                retrievalContext = this.toRetrievalContext(primaryResponse);
              } else {
                /**
                 * R4 POLISH LIVE 400 — P2. A PROVIDER REFUSAL IS NOT ZERO RESULTS.
                 *
                 * What the host actually recorded, one second apart:
                 *
                 *   12:41:55  [bad-request]  GNews responded with status 400.
                 *   12:41:55  Polish primary retrieval returned zero relevant
                 *             articles — attempting one bounded English Search
                 *             fallback.
                 *   12:41:56  [rate-limited] GNews rate limit exceeded.
                 *
                 * One malformed request cost two. The free plan allows one
                 * request per second, so the retry — which re-sent the identical
                 * refused string — also burned the slot for whoever asked next.
                 *
                 * The approved correction already taught the English generic
                 * branch this exact lesson; its own comment describes this exact
                 * sequence. This branch simply never received it. The mechanism
                 * is reused unchanged: readProviderFailures() over the response,
                 * and the same rule — any recorded failure suppresses the
                 * bounded second attempt, for the same reasons the English
                 * branch documents:
                 *
                 *   bad-request   re-sending the same shape earns the same refusal
                 *   auth          a credential does not become valid in 40ms
                 *   rate-limited  a second call is certain to fail
                 *   unavailable   the provider is down
                 *
                 * NO PARALLEL POLISH-ONLY FAILURE MODEL. This is the same
                 * Symbol-carried channel NewsService.search() already uses;
                 * P2's only other change is attaching it to topHeadlines()
                 * responses too, so it is readable here at all.
                 *
                 * A GENUINE HTTP-200 WITH NOTHING USEFUL IS UNCHANGED: no
                 * failure is recorded, so the one bounded English Search
                 * fallback still runs, exactly as Milestone #47 specified.
                 */
                const primaryFailures = readProviderFailures(primaryResponse);

                if (primaryFailures.length > 0) {
                  this.logger.warn(
                    'Polish primary retrieval was REFUSED by the provider — the bounded ' +
                      'English Search fallback is deliberately not attempted: ' +
                      primaryFailures
                        .map((failure) => `${failure.providerId}=${failure.kind}`)
                        .join(', '),
                  );

                  articles = [];
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
                  //
                  // R4 P1: the provider-safe form is sent here too. The English
                  // Search endpoint refuses the same punctuation the Polish
                  // Top-Headlines endpoint refused — the ladder measured
                  // lang=en q="Polska bezpieczeństwo" -> 200, and the earlier
                  // ladder measured an interior comma -> 400.
                  this.logger.debug(
                    'Polish primary retrieval returned zero relevant articles — ' +
                      'attempting one bounded English Search fallback.',
                  );

                  const fallbackResponse = await this.newsService.search(
                    polishSent,
                    SEARCH_POOL_SIZE,
                    {
                      type: 'generic',
                    },
                  );

                  articles = fallbackResponse.articles;
                  retrievalContext = this.toRetrievalContext(fallbackResponse);
                }
              }
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
            const derivedSearchQuery = deriveGenericNewsQuery(normalizedQuery);

            /*
             * G-ALPHA-2 — THE CLASSIFIER'S SUBJECT FILLS A GAP; IT NEVER
             * OVERRIDES A DERIVATION THAT WORKED.
             *
             * deriveGenericNewsQuery() returns the sentence UNCHANGED when no
             * pattern in its closed list matched — that is its documented
             * safety fallback, and it is also precisely the failure mode
             * G-ALPHA-1 D2 measured: the whole sentence becomes both the
             * provider phrase AND the phrase the multi-word gate demands
             * verbatim inside a headline, which no headline ever contains.
             * "What is quantum?" and "Explain quantum computing." are that
             * shape.
             *
             * The substitution is therefore conditioned on the derivation
             * having done nothing at all. If ANY existing pattern matched —
             * every M35, M46 and G-ALPHA-1 D2 shape — the derived subject is
             * used and the classifier is ignored entirely, so no shape the
             * repository already handles can move. This is a strict addition
             * to the unmatched case only.
             */
            const derivationLeftSentenceIntact =
              derivedSearchQuery.trim() === normalizedQuery.trim().replace(/[?!.,;:]+$/g, '');

            const genericSearchQuery =
              derivationLeftSentenceIntact && classification.subject
                ? classification.subject
                : derivedSearchQuery;

            // Query-limit correction (wiring revision) — a long or complex
            // analytical question can produce a genericSearchQuery that
            // still exceeds what's safe to send to GNews (its own regex
            // capture groups are not length-bounded). makeProviderSafeNewsQuery()
            // is a pure, narrow length-safety step — it does NOT re-derive
            // from normalizedQuery, only reduces the ALREADY-derived
            // genericSearchQuery further when needed, reusing the existing
            // deriveFallbackNewsQuery() reduction rather than a new,
            // duplicate system. genericSearchQuery itself (used below for
            // the M46 fallback derivation) is left completely untouched —
            // only what's actually SENT to the provider changes.
            const primarySent = makeProviderSafeNewsQuery(genericSearchQuery);

            /**
             * PROVIDER-SAFETY EDGE CLOSURE — the honest non-retrievable state.
             *
             * `undefined` here means the user's question contained no Unicode
             * letter or numeral once provider-unsafe characters were removed:
             * there is nothing to search for. The approved correction used to
             * restore the original punctuation for this case and send it,
             * which is a guaranteed HTTP 400.
             *
             * The response is the EXISTING zero-evidence surface, not a new
             * one: empty articles, an honest retrieval context recording that
             * nothing was retrieved, and — critically — the same downstream
             * guard that has always refused to call OpenAI without evidence.
             * Nothing is invented and nothing is substituted.
             */
            if (primarySent === undefined) {
              this.logger.warn(
                'Generic retrieval has no lexical query after provider-safe normalization — ' +
                  'no provider request was made.',
              );
              articles = [];
              retrievalContext = NON_RETRIEVABLE_QUERY_CONTEXT;
            } else {
              let searchResponse = await this.newsService.search(
                primarySent,
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
              //
              // Query-limit correction (wiring revision) — fallbackQuery is
              // still derived from the ORIGINAL genericSearchQuery, exactly
              // as before this correction (M46's own semantics are
              // unchanged). makeProviderSafeNewsQuery() is then applied to
              // THAT result independently — never by re-running length
              // reduction on an already-reduced primarySent, which would
              // risk producing the identical string twice. The explicit
              // `fallbackSent !== primarySent` guard is what actually
              // prevents that: if the provider-safe fallback would be
              // identical to what attempt 1 already sent, the second
              // request is skipped entirely rather than wastefully repeating
              // an identical search.
              /**
               * A PROVIDER REFUSAL IS NOT ZERO RESULTS.
               *
               * The trigger used to be `articles.length === 0` alone, which
               * cannot tell "the provider answered and had nothing" from "the
               * provider refused the request". On the real host that difference
               * mattered exactly as badly as it sounds: a deterministic HTTP 400
               * was read as an empty world, the fallback re-sent an equally
               * malformed query, and the second call came back 429 — so one
               * request defect also consumed the rate-limit slot.
               *
               * The bounded fallback now runs ONLY when the provider genuinely
               * answered and had nothing to give. Any recorded failure
               * suppresses it, and each for its own reason:
               *
               *   bad-request   re-sending the same shape earns the same refusal
               *   auth          a credential does not become valid in 40ms
               *   rate-limited  a second call is certain to fail and steals the
               *                 slot from whoever asks next
               *   unavailable   the provider is down; retrying inside this HTTP
               *                 request only delays an honest answer
               *
               * THIS DOES NOT WEAKEN THE ZERO-EVIDENCE SURFACE. When retrieval
               * yields nothing the user sees exactly what they saw before, and
               * OpenAI is still never reached — that guard is untouched and lives
               * further down. What changes is that the system now knows WHY, says
               * so in the log, and stops paying a second provider call to learn
               * nothing.
               *
               * readProviderFailures() returns [] for any response that never
               * carried failures, so a genuine empty result behaves exactly as
               * before.
               */
              const primaryFailures = readProviderFailures(searchResponse);

              if (searchResponse.articles.length === 0 && primaryFailures.length > 0) {
                this.logger.warn(
                  'Generic retrieval was REFUSED by the provider — the bounded fallback is ' +
                    'deliberately not attempted: ' +
                    primaryFailures
                      .map((failure) => `${failure.providerId}=${failure.kind}`)
                      .join(', '),
                );
              } else if (searchResponse.articles.length === 0) {
                const fallbackQuery = deriveFallbackNewsQuery(genericSearchQuery);
                if (fallbackQuery) {
                  const fallbackSent = makeProviderSafeNewsQuery(fallbackQuery);
                  /*
                   * PROVIDER-SAFETY EDGE CLOSURE — an undefined fallback means
                   * the reduced query has no lexical content, so the bounded
                   * second attempt is skipped rather than sent.
                   */
                  if (fallbackSent !== undefined && fallbackSent !== primarySent) {
                    this.logger.debug(
                      'Primary generic retrieval returned zero relevant articles — ' +
                        'attempting one bounded fallback search.',
                    );
                    searchResponse = await this.newsService.search(fallbackSent, SEARCH_POOL_SIZE, {
                      type: 'generic',
                    });
                  }
                }
              }

              articles = searchResponse.articles;
              retrievalContext = this.toRetrievalContext(searchResponse);
            }
          }
        }

        /**
         * Milestone #51 Phase B (CTO final correction) — the selected
         * article itself is now a genuine evidence ANCHOR, not merely
         * a country hint. When storyContext.articleId resolves to a
         * real, persisted article (via NewsService.findArticleById ->
         * ArticlePersistenceService.findById, the same Prisma
         * `article` table persistMany() already writes/reads — no new
         * persistence layer), that article is guaranteed to be present
         * AND prioritized (moved to the front) in the evidence set
         * BEFORE clusterDuplicateArticles()/maxArticles trimming below,
         * so it survives that cap and is weighted first for prompt
         * building exactly like every other article already is —
         * reusing the existing pipeline unchanged, not a competing
         * relevance engine. Corroborating evidence is still the
         * country/generic retrieval already computed above; this only
         * ensures the SPECIFIC selected story is never silently
         * dropped in favor of other same-country articles (the exact
         * defect the Rwanda migration/football/economy example
         * describes). If articleId is absent or does not resolve
         * (including on any database failure), this is a no-op and
         * behavior is byte-for-byte the pre-#51-correction retrieval —
         * never fabricated, never thrown.
         */
        if (anchorArticle) {
          /*
           * R4 — unchanged in behavior. The lookup itself moved above (see the
           * hoist comment); this block still performs the identical prepend at
           * the identical point in the pipeline, before
           * clusterDuplicateArticles()/maxArticles. It is the single site that
           * guarantees "the selected anchor is preserved and first" for EVERY
           * branch — the new anchored branch included, which is why that
           * branch deliberately returns supporting articles only and does not
           * prepend the anchor itself.
           */
          const withoutAnchor = articles.filter(
            (article) => article.id !== anchorArticle.id && article.url !== anchorArticle.url,
          );
          articles = [anchorArticle, ...withoutAnchor];
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

        /*
          ══ PO RULING D (C906) — HOW BROAD IS THIS EVIDENCE SET? ═══════════

          Measured from the SAME `deduped` array the provider is about to be
          given, so the brief is judged against exactly the evidence the model
          saw. Computed before the call because it is an input to the verdict,
          not a reaction to the answer.
        */
        const developmentBreadth = detectDevelopmentBreadth(deduped);

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
            /*
              EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 — THE SAME
              `developmentBreadth` COMPUTED ABOVE, AND THE SAME ONE HANDED TO
              `assessBriefCompliance()` BELOW.

              It is the one variable, referenced twice. It cannot disagree with
              the verdict because there is only one of it, and it cannot cost
              anything because it was already computed from this exact
              `deduped` array before the call.

              This is the whole of the correction at this call site: no second
              provider call, no second measurement, no change to retrieval, and
              no change to what happens to a non-compliant answer.
            */
            developmentBreadth,
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

          /*
            ══════════════════════════════════════════════════════════════════
            C907 CORRECTION 3 — ONE REPAIR, THEN FAIL CLOSED
            ══════════════════════════════════════════════════════════════════

            C906 RULING D, UNCHANGED: "validate the returned summary shape
            against the detected multi-development evidence set; when that ONE
            requirement fails, permit AT MOST ONE targeted repair request to
            the provider; no unlimited retry loop." This is still a single
            `if`, never a loop, and the repaired answer is never re-assessed in
            order to ask again.

            WHAT C907 CHANGES, AND WHY. C906 kept the ORIGINAL blended summary
            when the repair also failed, reasoning that this "can only ever
            improve the response or leave it alone". The CTO review rejected
            that reasoning by name:

                "KNOWN NON-COMPLIANT EXECUTIVE BRIEF != ACCEPTED EXECUTIVE
                 BRIEF."

            So the third outcome is no longer "keep the original". It is
            withhold the brief, keep everything else, and say so in a field the
            surfaces can read. See brief-fail-closed.util.ts for why the
            summary is EMPTIED rather than merely flagged.

            NO THIRD CALL. At most two provider calls are made on this path,
            exactly as before: the analysis and the one repair.
          */
          let analysisResult = analysis;
          /*
            C911-R11 -- TWO COMPLIANCE QUESTIONS, ONE VERDICT, ONE VOCABULARY.

            STRUCTURE, unchanged: does the paragraph shape match the measured
            evidence breadth. This is the accepted C906/C910 check and neither
            its threshold nor its inputs move here.

            RELATION INTEGRITY, new: does the brief positively CONTRADICT the
            evidence it was generated from on an entity + role + geography
            relationship. The reported Production defect --
            "South Africa's Prime Minister Narendra Modi" -- was a brief that
            passed structure and contradicted its own sources.

            `deduped` is the exact array the provider was given above and
            the exact array `validateAnalysisResult` grounds against, so the brief
            is judged against precisely the evidence the model saw. It is the
            one variable, referenced again -- no second measurement.

            NO NEW STATE. A brief that fails either question is
            `withheld-non-compliant`, which is what a known non-compliant brief
            has always been. NO SECOND PROVIDER CALL, no repair request, no
            retrieval, and no rewriting of generated prose: this returns a
            verdict and `withholdExecutiveBrief()` below does exactly what it
            already does. Fail closed rather than fabricate.
          */
          const structuralVerdict = assessBriefCompliance(analysis.summary, developmentBreadth);
          const briefVerdict = applyBriefRelationIntegrity(
            structuralVerdict,
            analysis.summary,
            deduped,
          );
          /*
            ══════════════════════════════════════════════════════════════════
            THE REPAIR IS NO LONGER ON THE SYNCHRONOUS PATH — ALPHA BUDGET R1
            ══════════════════════════════════════════════════════════════════

            WHAT WAS HERE. C906 ruling D permitted "AT MOST ONE targeted repair
            request to the provider", and C907 correction 3 made a
            still-non-compliant repair fail closed. Both rulings are preserved
            in outcome. What is removed is the SECOND SYNCHRONOUS CALL.

            WHY, MEASURED. The "targeted repair" was not targeted. It called
            `provider.analyzeNews()` again with the ENTIRE article set and the
            same prompt plus an appended directive — the directive's own words
            are "Produce the analysis again" — so every field was regenerated
            and fully re-validated. Railway run 579a0134 settles the cost:

                generation #1   6,367 tokens   16,535 ms
                generation #2   6,689 tokens   13,887 ms   <- LARGER
                POST completed               30,914 ms
                client deadline              30,000 ms

            A bounded repair of one field cannot cost more than the analysis
            that produced it. The reader was told the analysis had failed, 914 ms
            before a correct 201 was written to a socket nobody was reading.

            WHAT IS PRESERVED — ALL OF IT. `assessBriefCompliance` is unchanged,
            its threshold is unchanged, `withholdExecutiveBrief` is unchanged,
            and the reason travels with the withheld state exactly as before. A
            non-compliant brief is still refused. NOTHING about the validation
            moved; only the second expensive attempt to satisfy it did.

            WHY WITHHOLDING IMMEDIATELY IS THE RIGHT ALPHA ANSWER. A withheld
            brief is already a fully specified, rendered state carrying its own
            reason — the product does not need the repair in order to ANSWER,
            only in order to IMPROVE an answer it can already serve. Making the
            reader wait a second full generation for an improvement that failed
            twice on the observed run is the worst of both.

            NO BACKGROUND QUEUE. Deliberately. No governed durable job or result
            mechanism exists in this architecture, and inventing one for Alpha
            would be new infrastructure on the critical path of a release
            correction. If the repair is to return, it returns as governed
            asynchronous work, not as a second synchronous call.
          */
          if (!briefVerdict.compliant) {
            this.logger.warn(
              `Executive brief failed structural compliance: ${briefVerdict.reason ?? ''} ` +
                'Withholding the brief and returning the validated analysis record without it. ' +
                'No synchronous repair is attempted — see shared/src/analysis-budget.ts.',
            );
          }

          /*
            `repairRequested` is now always false, and ExecutiveBriefState's own
            doc comment has been corrected to say what false means on this path:
            no repair was requested, because none is requested synchronously any
            more. It never meant "a repair was skipped silently", and it must
            not start meaning that without the field saying so.
          */
          const repairRequested = false;

          /*
            ONE PLACE STAMPS THE RECORD, so an accepted brief and a withheld
            one cannot be produced by two different code paths that drift.
            `briefVerdict` is compliant here in exactly two cases: the first
            answer complied, or the repair did and replaced it.
          */
          analysisResult = briefVerdict.compliant
            ? acceptExecutiveBrief(analysisResult, briefVerdict, repairRequested)
            : withholdExecutiveBrief(analysisResult, briefVerdict, repairRequested);

          response = {
            query: originalQuery,
            normalizedQuery,
            requestedLanguage,
            // Milestone #47: this IS the language actually used for
            // this specific successful analysis — the same value passed
            // to the provider above, echoed back truthfully, never
            // independently re-derived.
            responseLanguage: requestedLanguage,
            analysis: analysisResult,
            articles: deduped,
            retrievalContext,
            sourceEntities,
            sourceDiversity,
            provenance: this.buildProvenance(config, 'success', { latencyMs }),
          };
        } catch (error) {
          const latencyMs = Date.now() - providerCallStartedAt;

          this.logger.warn(
            `Analysis provider "${this.provider.id}" failed.`,
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

    /*
      ══════════════════════════════════════════════════════════════════════════
      THE TOTAL SYNCHRONOUS RESPONSE DEADLINE — ENFORCED, NOT DECLARED
      ══════════════════════════════════════════════════════════════════════════

      WHY A CONSTANT WAS NOT ENOUGH. R1 defined ANALYSIS_TOTAL_BUDGET_MS and
      derived the client deadline from it. The CTO rejected that as enforcement,
      correctly: `20s x 1` is not a valid worst-case provider term. A PROVIDER
      TIMEOUT is non-retryable, but a 429, a 5xx or a network failure IS
      retryable, and one of those can arrive at 19.9 s — after which a further
      attempt begins with its own full 20 s budget. Nothing bounded the sum.

      This bounds it, for every reachable path at once, because it measures WALL
      CLOCK around the COMPLETE operation — retrieval, every provider attempt,
      every retry and backoff, validation, brief assessment and assembly. It does
      not need to know how many retries happened or where the time went.

      COALESCING IS NOT DISTURBED. `inFlightAnalyses` still holds the real
      operation, so a concurrent identical request still joins it rather than
      starting a second analysis. Only what THIS caller awaits is raced.

      THE WORK IS NOT CANCELLED, AND THIS COMMENT WILL NOT PRETEND OTHERWISE.
      On deadline the operation continues, completes and populates the cache —
      which is a genuine benefit, because the next identical request is then
      served in about a millisecond. What is bounded here is the RESPONSE, not
      the spend. See the honest split in the report:

          synchronous RESPONSE deadline .......... BOUNDED (this code)
          abandoned provider work cancellation ... OPEN (unwired; next correction)
    */
    return this.withResponseDeadline(settledInFlightOperation, config.totalBudgetMs, cacheKey);
  }

  /**
   * Races an operation against the total synchronous budget.
   *
   * The timer is cleared on settlement either way, so a fast response leaves no
   * pending handle behind. The underlying operation keeps a no-op rejection
   * handler attached when the deadline fires, because after this method has
   * rejected nobody is awaiting it any more and an unhandled rejection would be
   * a second, unrelated failure mode.
   */
  private withResponseDeadline<T>(
    operation: Promise<T>,
    budgetMs: number | undefined,
    cacheKey: string,
  ): Promise<T> {
    /*
      REV B — RESOLVE BEFORE ARMING, ALWAYS.

      `setTimeout(fn, undefined)` is not "no deadline"; it is a deadline of
      approximately zero. Every AnalysisConfigService test double in this
      repository predates `totalBudgetMs` and supplies none, so arming the raw
      value would have made each of them fail instantly on a deadline that was
      never intended — a new zero-millisecond behaviour introduced into existing
      tests by an omission rather than by a decision.

      `resolveServerBudgetMs` is the shared authority's own resolver: an absent
      or nonsensical value becomes ANALYSIS_TOTAL_BUDGET_MS, and an excessive one
      is clamped to the ceiling the compiled client can tolerate. Both directions
      end at a REAL enforced deadline, so this is a hardening of the boundary and
      not a relaxation of it — there is no input for which this method now
      declines to arm a deadline.

      Production is unaffected: AnalysisConfigService already clamps through this
      same function, so the value arriving here is a positive number at or below
      the ceiling and passes through unchanged.
    */
    const resolvedBudgetMs = resolveServerBudgetMs(budgetMs);

    let timer: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        this.logger.warn(
          `Analysis exceeded the total synchronous budget of ${resolvedBudgetMs} ms. ` +
            'Responding with a deadline error; the operation continues and will populate the ' +
            'cache, so an identical retry is served from it. Provider work is NOT cancelled — ' +
            'see ANALYSIS CANCELLATION, OPEN.',
        );

        /* After this rejection nobody awaits the operation. Keep its eventual
           outcome handled so a late failure cannot surface as an unhandled
           rejection in an unrelated request's tick. */
        void operation.catch(() => undefined);

        reject(new AnalysisDeadlineExceededError(resolvedBudgetMs, cacheKey));
      }, resolvedBudgetMs);
    });

    return Promise.race([operation, deadline]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }) as Promise<T>;
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
  /**
   * R4 C1 + C2 + C3 — retrieval for an article-specific ANALYSE.
   *
   * ONE provider call, or at most two. The primary query is the anchor's own
   * distinctive-plus-supporting terms (see buildAnchorRetrievalQuery). If it
   * returns no MATERIALLY RELATED supporting article — and only if the
   * provider genuinely answered rather than refused — exactly one narrower
   * retry runs on the anchor's proper nouns alone. That bound mirrors
   * Milestone #46's existing one-bounded-fallback rule on the generic branch:
   * same shape, same identical-query guard, same refusal suppression, so this
   * path cannot cost more provider calls than the branch it replaces.
   *
   * C3 IS THE RETURN VALUE ITSELF. This returns only what survived the topical
   * gate. There is no top-up from the country feed, and no code path here can
   * add an article that failed the gate in order to reach a count. When the
   * honest answer is zero supporting reports, zero is what comes back, and the
   * anchor alone becomes the evidence set once the M51 prepend runs.
   *
   * The zero-evidence guard is untouched: nothing here calls the AI provider,
   * and an empty result flows into the same existing articles.length === 0
   * surface that already refuses to invoke OpenAI.
   */
  private async retrieveAnchorEvidence(
    anchorArticle: NewsArticle,
    anchorTerms: AnchorTerms,
  ): Promise<{ supporting: NewsArticle[]; response: NewsResponse | undefined }> {
    const primaryQuery = buildAnchorRetrievalQuery(anchorTerms);

    /*
     * No usable lexical term in the headline at all. Honest outcome: the
     * anchor stands alone. Deliberately NOT a country-feed retrieval — that is
     * precisely the substitution this correction removes.
     */
    if (primaryQuery === undefined) {
      this.logger.debug(
        'Anchor headline yielded no usable retrieval term — returning the anchor alone.',
      );
      return { supporting: [], response: undefined };
    }

    const primarySent = makeProviderSafeNewsQuery(primaryQuery);
    if (primarySent === undefined) {
      return { supporting: [], response: undefined };
    }

    let response = await this.newsService.search(primarySent, SEARCH_POOL_SIZE, {
      type: 'generic',
    });
    let supporting = this.selectAnchorSupportingArticles(
      response.articles,
      anchorArticle,
      anchorTerms,
    );

    if (supporting.length === 0) {
      const failures = readProviderFailures(response);

      if (failures.length > 0) {
        this.logger.warn(
          'Anchored retrieval was REFUSED by the provider — the bounded retry is ' +
            'deliberately not attempted: ' +
            failures.map((failure) => `${failure.providerId}=${failure.kind}`).join(', '),
        );
      } else {
        const fallbackQuery = buildAnchorFallbackQuery(anchorTerms);
        const fallbackSent =
          fallbackQuery === undefined ? undefined : makeProviderSafeNewsQuery(fallbackQuery);

        if (fallbackSent !== undefined && fallbackSent !== primarySent) {
          this.logger.debug(
            'Anchored retrieval found no materially related reporting — attempting one ' +
              "bounded narrower search on the story's distinctive terms.",
          );
          const fallbackResponse = await this.newsService.search(fallbackSent, SEARCH_POOL_SIZE, {
            type: 'generic',
          });
          const fallbackSupporting = this.selectAnchorSupportingArticles(
            fallbackResponse.articles,
            anchorArticle,
            anchorTerms,
          );

          /*
           * The retry only replaces the primary result when it actually found
           * something. A retry that also found nothing must not overwrite the
           * primary response, because that response is what carries the
           * truthful dataMode/providers the retrieval context reports.
           */
          if (fallbackSupporting.length > 0) {
            response = fallbackResponse;
            supporting = fallbackSupporting;
          }
        }
      }
    }

    this.logger.debug(
      `Anchored retrieval kept ${supporting.length} of ${response.articles.length} candidate ` +
        'articles as materially related to the selected story.',
    );

    return { supporting, response };
  }

  /**
   * R4 C2 — the admission gate, applied to the anchored candidate pool.
   *
   * The anchor itself is removed here rather than gated: it is the subject, not
   * a corroborating report, and the M51 prepend puts it back at the front.
   * Everything else must be materially related to the anchor's story. Sharing
   * a country is not a relation — see isMateriallyRelatedToAnchor, which
   * cannot count a country term at all.
   */
  private selectAnchorSupportingArticles(
    candidates: NewsArticle[],
    anchorArticle: NewsArticle,
    anchorTerms: AnchorTerms,
  ): NewsArticle[] {
    return candidates.filter((candidate) => {
      if (isSameArticleAsAnchor(candidate, anchorArticle)) return false;
      return isMateriallyRelatedToAnchor(candidate, anchorTerms).isRelated;
    });
  }

  /**
   * R4 — EVIDENCE GEOGRAPHY MUST SURVIVE THE BRANCH CHANGE.
   *
   * This is the part of the correction most able to cause a regression, and
   * the CTO named it as a preservation rule rather than a nice-to-have. In the
   * observed good result the Australia outline rendered because retrieval went
   * through CountryNewsService, whose response carries countryCode/countryName,
   * and toRetrievalContext() copied them across. The anchored branch does not
   * use that service, so those two fields would be undefined and the frontend's
   * buildGeographicEvidenceState() would report `unresolved` — losing a result
   * that was correct.
   *
   * WHERE THE GEOGRAPHY COMES FROM NOW, IN PRIORITY ORDER:
   *
   *   1. The anchor article's own countryCode. The anchor is retained evidence
   *      by construction — it is the first article in the set — and its
   *      countryCode was resolved from its own text by the news pipeline.
   *   2. The country supported by the RETAINED supporting reports, when they
   *      agree on one and the anchor carries none.
   *   3. storyContext.countryCode, only as a last resort and only because the
   *      frontend read it off this same anchor record before sending it.
   *
   * WHAT IS DELIBERATELY NOT DONE. `city` is never set on this path. The
   * frontend decides evidence precision solely from countryCode, and treats a
   * present `city` as a QUERY TARGET that the evidence did not reach — setting
   * it here would manufacture a "target exceeds evidence" disclosure out of
   * nothing. Precision therefore stays at `country`, which is exactly what the
   * retained reporting supports and no more: no geography is promoted beyond
   * the evidence, per the standing rule.
   *
   * providerDisplayName and newestArticlePublishedAt stay undefined because
   * they are CountryNewsResponse fields and this retrieval is not one. Claiming
   * them would be inventing provenance.
   */
  private toAnchoredRetrievalContext(
    response: NewsResponse | undefined,
    anchorArticle: NewsArticle,
    supporting: NewsArticle[],
    storyContextCountryCode: string | undefined,
  ): AnalysisRetrievalContext {
    const evidenceCountry = this.resolveAnchoredEvidenceCountry(
      anchorArticle,
      supporting,
      storyContextCountryCode,
    );

    return {
      dataMode: response?.dataMode ?? 'unavailable',
      providers: response?.providers ?? [],
      fallbackReason: response === undefined ? 'no-live-results' : response.fallbackReason,
      newestArticlePublishedAt: undefined,
      countryCode: evidenceCountry?.iso2,
      countryName: evidenceCountry?.name,
      providerDisplayName: undefined,
      // The anchor is always part of the evidence set (M51 prepends it), so the
      // count the reader sees includes it. Reporting only the supporting
      // articles here would under-report the evidence actually presented.
      articlesRetrieved: supporting.length + 1,
      city: undefined,
      matchedFrom: undefined,
      canonicalLocation: undefined,
      matchConfidence: undefined,
    };
  }

  /** See toAnchoredRetrievalContext for the priority order and why it is that order. */
  private resolveAnchoredEvidenceCountry(
    anchorArticle: NewsArticle,
    supporting: NewsArticle[],
    storyContextCountryCode: string | undefined,
  ): { iso2: string; name: string } | undefined {
    const fromAnchor = anchorArticle.countryCode
      ? resolveCountryByAnyIdentifier(anchorArticle.countryCode)
      : undefined;
    if (fromAnchor) return { iso2: fromAnchor.iso2, name: fromAnchor.name };

    const counts = new Map<string, number>();
    for (const article of supporting) {
      if (!article.countryCode) continue;
      const resolved = resolveCountryByAnyIdentifier(article.countryCode);
      if (!resolved) continue;
      counts.set(resolved.iso3, (counts.get(resolved.iso3) ?? 0) + 1);
    }

    if (counts.size === 1) {
      const [onlyIso3] = [...counts.keys()];
      const resolved = resolveCountryByAnyIdentifier(onlyIso3);
      if (resolved) return { iso2: resolved.iso2, name: resolved.name };
    }

    const fromStoryContext = storyContextCountryCode
      ? resolveCountryByAnyIdentifier(storyContextCountryCode)
      : undefined;
    if (fromStoryContext) return { iso2: fromStoryContext.iso2, name: fromStoryContext.name };

    return undefined;
  }

  /**
   * G-ALPHA-2 — bounded per-side retrieval for MULTI_ENTITY and
   * COMPARISON_RESEARCH.
   *
   * ONE provider call per side, and the caller supplies at most MAX_SIDES (3)
   * of them, so a multi-entity question can never become an unbounded burst.
   * Every call goes through NewsService.search() in the SAME `{ type:
   * "generic" }` relevance mode the ordinary generic branch uses, so each
   * side's results are filtered by the same unmodified scoreGenericRelevance
   * before this method ever sees them. Nothing here re-scores, re-admits, or
   * relaxes anything.
   *
   * FAILURE IS NOT EMPTINESS — the Milestone #63 rule, reused verbatim. A
   * response that is `unavailable`, or `cached` specifically because the live
   * provider failed, may carry stored articles that were never retrieved for
   * THIS request; those must not be reported as fresh evidence for this side.
   * Such a side contributes nothing and is recorded as a failure, and a thrown
   * error is treated identically rather than failing the whole analysis.
   *
   * TRUTHFUL METADATA. `providers` is the union of the providers that actually
   * answered. `articlesRetrieved` is the size of the deduplicated merged pool,
   * matching the retrieval-pool semantics M63 already established for this
   * field. `dataMode` reports the best mode any side genuinely achieved, and
   * `fallbackReason` distinguishes "the providers answered and had nothing"
   * from "every side failed" — never blaming a provider for a request that
   * succeeded, and never hiding one that did not.
   */
  private async retrievePerSideEvidence(
    sides: readonly CountryMeta[],
    requestedLanguage: LanguageCode,
  ): Promise<{
    articles: NewsArticle[];
    retrievalContext: AnalysisRetrievalContext;
  }> {
    const collected: NewsArticle[] = [];
    const providers = new Set<string>();

    let sawLive = false;
    let sawCached = false;
    let sidesAttempted = 0;
    let sidesFailed = 0;
    /*
      C907 §8 — WHICH KIND OF FAILURE, NOT MERELY THAT THERE WAS ONE.

      `dataMode`/`fallbackReason` collapse a refusal and an empty answer into
      the same two values, which is exactly the conflation the ruling rejects:
      RATE_LIMITED IS NOT "NO NEWS EXISTS". `readProviderFailures` is the
      typed channel NewsService already carries — the same one the English and
      Polish branches use to suppress a bounded retry — so the kinds are read
      from it rather than inferred.
    */
    const failureKinds = new Set<string>();

    /*
     * G-ALPHA-2.1 (A) — A POLISH QUESTION IS RETRIEVED IN POLISH.
     *
     * G-ALPHA-2 sent the English country name through NewsService.search() for
     * every language, so extending Stage 2 to Polish as written would have
     * answered a Polish question with English-language reporting — weakening
     * exactly the Polish retrieval contract Milestone #47 established and the
     * closure instruction protects.
     *
     * NOTHING NEW IS INVENTED. The Polish path reuses the two mechanisms that
     * already exist for this: the /top-headlines lang=pl call the Polish branch
     * already makes, and scoreCountryRelevance()'s own `language` parameter,
     * which already resolves a localized country name via Intl.DisplayNames and
     * already matches it in Polish article text. The gate is the same function
     * in both languages; only the name it is told to look for changes.
     */
    /*
      C907 §0.1(3) — THE PER-COUNTRY WORK IS NOW `retrieveMemberEvidence`.

      It is the same body this loop used to carry inline: the Polish/English
      term choice, the provider-safety chokepoint, the provider-failure
      exclusion and the unmodified `scoreCountryRelevance` firewall. It moved
      so the declared-region branch could do IDENTICAL work rather than a
      second implementation of it — two fan-outs that gate a country
      differently is precisely the drift this repository keeps finding.

      This branch stays SERIAL. Its callers are comparison questions naming two
      or three sides, where concurrency buys almost nothing and the rate-limit
      slot is better spent elsewhere; the batched, bounded-concurrency schedule
      belongs to the declared-region branch, which may face eleven members.
    */
    for (const side of sides) {
      const result = await this.retrieveMemberEvidence(side, requestedLanguage);

      sidesAttempted += 1;

      for (const kind of result.failureKinds) failureKinds.add(kind);
      for (const provider of result.providers) providers.add(provider);

      if (result.failed) {
        sidesFailed += 1;
        continue;
      }

      if (result.dataMode === 'live') sawLive = true;
      if (result.dataMode === 'cached') sawCached = true;

      collected.push(...result.articles);
    }

    const articles = deduplicateArticles(collected);

    const everySideFailed = sidesAttempted > 0 && sidesFailed === sidesAttempted;

    const dataMode: AnalysisRetrievalContext['dataMode'] = sawLive
      ? 'live'
      : sawCached
        ? 'cached'
        : 'unavailable';

    return {
      articles,
      retrievalContext: {
        dataMode,
        providers: [...providers],
        fallbackReason:
          articles.length > 0 ? undefined : everySideFailed ? 'provider-error' : 'no-live-results',
        articlesRetrieved: articles.length,
        /*
          C907 §8 — the outcome, decided once, from what actually happened.

          ORDER MATTERS AND IS NOT ARBITRARY. A rate limit is reported ahead of
          a general unavailability because it is the more specific and more
          actionable fact, and both are reported ahead of
          NO_RELEVANT_EVIDENCE — which is the ONLY outcome that asserts
          anything about the world, and must never be reached while a provider
          is known to have refused us.
        */
        outcome: retrievalOutcome(articles.length, failureKinds),
      },
    };
  }

  /**
   * C907 §8 — RETAINED REPORTING FOR A DECLARED REGION'S OWN MEMBERS.
   *
   * The middle rung of the provider-resilience ladder. It is reached only when
   * live retrieval produced nothing AND the provider was not live, and it can
   * only ever return reporting about the countries it is handed — the ruling's
   * *"Do not substitute unrelated cached reporting"* is enforced by the shape
   * of the call, not by a check after it.
   *
   * DISCLOSURE IS THE CALLER'S JOB and it is unconditional there: this returns
   * articles, and the caller stamps `RETAINED_ONLY` on the retrieval context
   * in the same expression that adopts them, so there is no arrangement of
   * this code in which retained reporting is served without being declared.
   *
   * Never throws; a database failure yields [] and the ladder falls through to
   * its bottom rung, where no AI call is made at all.
   */
  /**
   * ════════════════════════════════════════════════════════════════════════
   * ONE MEMBER COUNTRY, RETRIEVED AND GATED — C907 §0.1(3)
   * ════════════════════════════════════════════════════════════════════════
   *
   * Extracted from `retrievePerSideEvidence` so the comparison branch and the
   * declared-region branch do the identical work on a country and cannot drift
   * apart. Nothing in it is new; it is the per-side body, given a name.
   *
   * The relevance gate is `scoreCountryRelevance` — the COUNTRY firewall, not
   * the generic one, for the reason `retrievePerSideEvidence` records at
   * length: a country name is a single-word phrase and the generic gate demands
   * two independent corroboration signals for one word, which rejects a genuine
   * "Ukraine reports overnight strikes" headline. The country gate is the one
   * built for this question and it is unmodified here.
   */
  private async retrieveMemberEvidence(
    member: CountryMeta,
    requestedLanguage: LanguageCode,
    allowFallback = true,
  ): Promise<{
    articles: NewsArticle[];
    providers: string[];
    dataMode: NewsResponse['dataMode'] | null;
    failed: boolean;
    failureKinds: string[];
  }> {
    const isPolish = requestedLanguage === 'pl';
    const term = isPolish ? (polishCountryName(member) ?? member.name) : member.name;
    const sent = makeProviderSafeNewsQuery(term);

    const empty = { articles: [], providers: [], dataMode: null, failed: false, failureKinds: [] };

    /*
      A member is built from a curated country name, so this is defensive
      rather than expected — but the correct response to "there is no lexical
      query here" is to skip the member, never to send something the provider
      will refuse.
    */
    if (sent === undefined) return empty;

    try {
      const response = isPolish
        ? await this.newsService.topHeadlines(SEARCH_POOL_SIZE, {
            lang: 'pl',
            q: sent,
            allowFallback,
          })
        : await this.newsService.search(sent, SEARCH_POOL_SIZE, undefined, { allowFallback });

      const failureKinds = readProviderFailures(response).map((failure) => failure.kind);

      const failed =
        response.dataMode === 'unavailable' ||
        (response.dataMode === 'cached' && response.fallbackReason === 'provider-error');

      if (failed) {
        this.logger.warn(
          `Member retrieval for "${term}": provider unavailable ` +
            `(dataMode=${response.dataMode}, fallbackReason=${response.fallbackReason ?? 'none'}); ` +
            'treating as no usable evidence for this member',
        );

        return { ...empty, dataMode: response.dataMode, failed: true, failureKinds };
      }

      return {
        articles: response.articles.filter(
          /* K — the same two questions as the supplemental path; see admitsToAnalysisCorpus. */
          (article) =>
            scoreCountryRelevance(article, member, requestedLanguage).isRelevant &&
            admitsToAnalysisCorpus(article, member, requestedLanguage),
        ),
        providers: [...(response.providers ?? [])],
        dataMode: response.dataMode,
        failed: false,
        failureKinds,
      };
    } catch (error) {
      this.logger.warn(
        `Member retrieval failed for "${term}"; continuing without it`,
        error instanceof Error ? error : undefined,
      );

      return { ...empty, failed: true, failureKinds: ['unavailable'] };
    }
  }

  /**
   * ════════════════════════════════════════════════════════════════════════
   * A DECLARED REGION, RETRIEVED IN FULL — C907 §0.1(3) FINAL RULING
   * ════════════════════════════════════════════════════════════════════════
   *
   * *"ALL 11 members must be eligible for retrieval. The bound applies to
   * CONCURRENCY / batching, not permanent membership. BATCH 1: up to 6
   * concurrent member-country retrievals. BATCH 2: remaining members … Do not
   * silently stop after the first six merely because the first batch returned
   * evidence."*
   *
   * ── WHY A BATCH MAY BE ABANDONED, AND ONLY FOR ONE REASON ─────────────────
   *
   * The loop runs until the declared membership is exhausted. The single thing
   * that stops it early is the provider saying it will refuse the next
   * request — a recorded `rate-limited` failure. That is not an optimisation:
   * the R4 incident is on record for what sending into an exhausted quota
   * costs, and it costs the slot of whoever asks next, not just this request.
   *
   * Evidence is NEVER a reason to stop. A batch that returned plenty tells us
   * nothing about the members it did not cover, and stopping there is exactly
   * the permanent exclusion the ruling rejects.
   *
   * ── WHAT IS REPORTED WHEN IT IS CUT SHORT ─────────────────────────────────
   *
   * Completed evidence is preserved, the attempted members are listed, the
   * unreached members are listed, and `coverageComplete` is false. The caller
   * then offers retained reporting for the gaps. At no point does a partial
   * pass present itself as a whole one.
   */
  private async retrieveDeclaredRegionEvidence(
    region: DeclaredRegion,
    requestedLanguage: LanguageCode,
    explicitlyNamedCountries: readonly CountryMeta[] = [],
  ): Promise<{
    articles: NewsArticle[];
    retrievalContext: AnalysisRetrievalContext;
    attempted: CountryMeta[];
    unreached: CountryMeta[];
    live: Set<string>;
    unavailable: Set<string>;
  }> {
    /*
     * Explicit countries inside a regional question are retrieval priorities,
     * never extra region members. This is what makes "East Africa ... Rwanda
     * and DR Congo" attempt Rwanda + DRC before a provider throttle can cut the
     * second batch off.
     */
    const members = prioritizeRegionMembers(region, explicitlyNamedCountries);
    const fallbackEligible = new Set(
      members.slice(0, REGION_LIVE_FALLBACK_MEMBER_LIMIT).map((member) => member.iso3),
    );

    const collected: NewsArticle[] = [];
    const providers = new Set<string>();
    const failureKinds = new Set<string>();
    const attempted: CountryMeta[] = [];
    const live = new Set<string>();
    const unavailable = new Set<string>();

    let sawLive = false;
    let sawCached = false;
    let cursor = 0;
    let throttled = false;

    while (cursor < members.length && !throttled) {
      const batch = members.slice(cursor, cursor + MAX_CONCURRENT_REGION_REQUESTS);
      cursor += batch.length;

      /*
        THE BOUND IS THE BATCH WIDTH. `Promise.all` over at most
        MAX_CONCURRENT_REGION_REQUESTS members means that is the maximum number
        of provider requests in flight at any instant, which is what the ruling
        bounds. `retrieveMemberEvidence` never throws, so one member's failure
        cannot reject the batch and lose the others' evidence.
      */
      const results = await Promise.all(
        batch.map((member) =>
          this.retrieveMemberEvidence(
            member,
            requestedLanguage,
            fallbackEligible.has(member.iso3),
          ),
        ),
      );

      results.forEach((result, index) => {
        const member = batch[index];
        attempted.push(member);

        for (const kind of result.failureKinds) failureKinds.add(kind);
        for (const provider of result.providers) providers.add(provider);

        if (result.failed) {
          unavailable.add(member.iso3);
          return;
        }

        if (result.dataMode === 'live') sawLive = true;
        if (result.dataMode === 'cached') sawCached = true;

        if (result.articles.length > 0) live.add(member.iso3);
        collected.push(...result.articles);
      });

      /*
        THE ONE EARLY EXIT. A recorded rate limit means the next request is
        certain to be refused and will consume the slot anyway.
      */
      if (failureKinds.has('rate-limited')) {
        throttled = true;

        this.logger.warn(
          `Region "${region.id}": provider rate limit reached after ${attempted.length} of ` +
            `${members.length} members; the remaining batch is deliberately not sent.`,
        );
      }
    }

    const unreached = members.slice(attempted.length);
    const articles = deduplicateArticles(collected);

    const dataMode: AnalysisRetrievalContext['dataMode'] = sawLive
      ? 'live'
      : sawCached
        ? 'cached'
        : 'unavailable';

    return {
      articles,
      attempted,
      unreached,
      live,
      unavailable,
      retrievalContext: {
        dataMode,
        providers: [...providers],
        fallbackReason:
          articles.length > 0
            ? undefined
            : unavailable.size === attempted.length && attempted.length > 0
              ? 'provider-error'
              : 'no-live-results',
        articlesRetrieved: articles.length,
        outcome: retrievalOutcome(articles.length, failureKinds),
        requestedScope: buildRegionScope(region, { attempted, unreached, live, unavailable }),
      },
    };
  }

  private async retrieveRetainedForRegion(members: readonly CountryMeta[]): Promise<NewsArticle[]> {
    /*
     * Retained reads are local database work, not provider work. Running them
     * serially made a throttled eleven-country region pay N round trips after
     * live retrieval had already degraded. Fan them out together; each member
     * still fails independently and no failure can erase another member's
     * retained evidence.
     */
    const perMember = await Promise.all(
      members.map(async (member): Promise<NewsArticle[]> => {
        try {
          return await this.newsService.findRetainedByCountry(
            member.iso2,
            RETAINED_PER_MEMBER_LIMIT,
            RETAINED_MAX_AGE_MINUTES,
          );
        } catch (error) {
          this.logger.warn(
            `Retained lookup failed for ${member.iso3}; continuing without it`,
            error instanceof Error ? error : undefined,
          );
          return [];
        }
      }),
    );

    return deduplicateArticles(perMember.flat());
  }

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
  /**
   * Milestone #51 Phase B — resolves a story-context-supplied country
   * identifier (any format resolveCountryByAnyIdentifier() already
   * accepts: ISO2, ISO3, or name) into the same LocationContext shape
   * detectLocation() produces for a direct country match, so the rest
   * of analyzeNews() treats it identically. Returns undefined (never
   * throws) when the identifier doesn't resolve to a real country —
   * callers fall back to ordinary detectLocation() in that case,
   * exactly like an unresolvable free-text query already does.
   */
  private resolveStoryContextLocation(countryCode: string): LocationContext | undefined {
    const country = resolveCountryByAnyIdentifier(countryCode.trim());

    return country ? { country } : undefined;
  }

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
    const direct = blocksGeographicRouting(normalized)
      ? undefined
      : resolveCountryByAnyIdentifier(normalized);

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

    /**
     * GEO-PRECISION-1 (A) — COMMA SEGMENTS, NOT A SINGLE PREFIX CHAIN.
     *
     * THE DEFECT THIS REPLACES. The scan below used to build candidates with
     * `words.slice(0, length)` — PREFIXES ONLY — over the whole captured
     * phrase. For "in Musanze, Rwanda" the only candidates ever tried were
     * "Musanze, Rwanda" and "Musanze,". The word "Rwanda", sitting in plain
     * sight, unambiguous, curated, and an exact country match, was NEVER
     * PASSED TO THE RESOLVER AT ALL. The query resolved to nothing, fell
     * through to generic keyword retrieval, and returned zero articles —
     * while the strictly less informative "in Rwanda?" returned a full
     * country-level answer. Supplying MORE correct geography returned LESS.
     *
     * That was not limited to uncurated places. "Rome, Italy", "Kyiv,
     * Ukraine", "New Delhi, India" and "Addis Ababa, Ethiopia" all resolved
     * to nothing for the same reason, because the typo corrector that was
     * silently carrying "Kigali," cannot reach a target under
     * MIN_TARGET_LENGTH or one containing a space.
     *
     * THE RULE NOW, IN PRECEDENCE ORDER:
     *   1. An EXACT city in any segment wins outright — it is the most
     *      specific thing the evidence-independent resolver can know.
     *   2. Otherwise an EXACT country from any segment is held.
     *   3. Only then is fuzzy correction consulted, and when a country is
     *      already held the correction must belong to THAT country before it
     *      is accepted — so "Kigalli, Rwanda" recovers both, while a typo
     *      that would drag the answer to some other country is refused.
     *   4. With nothing exact anywhere, the pre-existing single-word fuzzy
     *      fallback runs unchanged.
     *
     * A phrase with no comma is exactly one segment, so every existing
     * single-segment query — "in the United States today", "in DR Congo",
     * "in Kigali" — takes precisely the path it took before.
     */
    const segments = candidateText
      .split(',')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    let exactCountryOnly: LocationContext | undefined;

    for (const segment of segments) {
      const resolved = this.resolveExactLocationInSegment(segment);

      if (resolved?.city) {
        return resolved;
      }

      if (resolved && !exactCountryOnly) {
        exactCountryOnly = resolved;
      }
    }

    if (exactCountryOnly) {
      /**
       * An explicit country resolved exactly. Before settling for country
       * precision, give the OTHER segments one fuzzy attempt at a city —
       * but accept it only if it belongs to the country already resolved.
       * "Kigalli, Rwanda" therefore recovers Rwanda AND the corrected city,
       * with the correction disclosed through geoMatch as it always was,
       * while "Musanze, Rwanda" recovers Rwanda and NO city, because
       * Musanze is not a curated city and nothing here may invent one.
       */
      for (const segment of segments) {
        const segmentFirstWord = segment.split(/\s+/)[0];
        const fuzzy = segmentFirstWord ? this.detectLocationFuzzy(segmentFirstWord) : undefined;

        if (fuzzy?.city && fuzzy.country.iso3 === exactCountryOnly.country.iso3) {
          return fuzzy;
        }
      }

      return exactCountryOnly;
    }

    /**
     * Milestone #28: every exact candidate in every segment has now failed.
     * As a last resort, try fuzzy resolution against only the single-word
     * candidate (the first word of the geographic-context phrase, e.g.
     * "kigalli" from "in Kigalli") — this is deliberately narrower than the
     * exact scan above (which tries up to MAX_COUNTRY_CANDIDATE_WORDS words)
     * since fuzzy matching against curated multi-word entities is out of
     * scope for that milestone (see geo-fuzzy-resolver.ts).
     */
    const firstWord = segments[0]?.split(/\s+/)[0];

    if (firstWord) {
      const fuzzy = this.detectLocationFuzzy(firstWord);

      if (fuzzy) {
        return fuzzy;
      }
    }

    return undefined;
  }

  /**
   * GEO-PRECISION-1 (A) — the pre-existing word-shrinking scan, unchanged in
   * behaviour and merely lifted into its own method so it can be run once per
   * comma segment rather than once over the whole phrase.
   *
   * Try the longest candidate first.
   *
   * Example:
   * "the United States today"
   *
   * progressively checks:
   * "the United States today"
   * "the United States"
   * ...
   *
   * and similarly handles aliases such as "DR Congo", and curated cities
   * such as "Kigali" (see resolveLocationContext).
   */
  private resolveExactLocationInSegment(segment: string): LocationContext | undefined {
    const words = segment.split(/\s+/);

    const maxWords = Math.min(words.length, MAX_COUNTRY_CANDIDATE_WORDS);

    for (let length = maxWords; length >= 1; length -= 1) {
      const candidate = words
        .slice(0, length)
        .join(' ')
        .replace(/^(?:the)\s+/i, '')
        .trim();

      /**
       * G-ALPHA-2 STAGE 1 — a lone prose function word is not a place.
       *
       * "Explain what quantum is and elaborate more about it" reached here
       * with the segment "it", resolved Italy from ISO2 "IT", and routed the
       * whole question into the Italian country feed. `candidate` still
       * carries the writer's own capitalisation at this point, which is what
       * lets an explicit "US"/"IT" code through while refusing prose "us"/
       * "it". Only single bare tokens are ever refused, so every real
       * geographic phrase is untouched — see routing-function-words.util.ts.
       *
       * CONTINUE, do not abandon the segment. Unlike the subdivision rule
       * below, a rejected function word says nothing about the shorter
       * prefixes still to be tried; it is simply not this word.
       */
      if (blocksGeographicRouting(candidate)) {
        continue;
      }

      const location = resolveLocationContext(candidate);

      if (location) {
        /**
         * G3 — A DISCARDED SUBDIVISION QUALIFIER IS NOT PERMISSION TO CLAIM
         * THE SOVEREIGN COUNTRY.
         *
         * The shrinking scan tries the longest prefix first and gives up a
         * word at a time. Measured on the article that exposed this:
         *
         *     resolveCountryByAnyIdentifier('Niger State') -> no match
         *     resolveCountryByAnyIdentifier('Niger')       -> Niger (NER)
         *
         * So "in Niger State" failed at two words, dropped "State", matched
         * the bare head word, and routed retrieval into the sovereign Niger
         * country feed. The one token that proved the place was a subdivision
         * was discarded precisely because nothing could resolve it.
         *
         * Matching a shorter prefix is normally right — "the United States
         * today" SHOULD give up "today". It is wrong only when the word being
         * given up is what made the phrase subnational, because then the
         * shorter prefix means something else entirely.
         *
         * FAIL CLOSED. This returns undefined for the whole segment rather
         * than continuing to shrink: every shorter prefix of "Niger State" is
         * a prefix of the same misreading. The query then falls through to
         * ordinary generic retrieval, which is the honest outcome — no
         * geography is invented, and none is claimed.
         *
         * Narrow by construction: it fires only when a qualifier is the very
         * next word AFTER a prefix that resolved. "in Niger" has no next word
         * and is completely unaffected, which is what keeps a genuine
         * sovereign-Niger question working.
         */
        if (isSubdivisionQualifier(words[length])) {
          return undefined;
        }

        return location;
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
  /**
   * G-ALPHA-2 STAGE 2 — resolves a country from an unambiguous adjectival form
   * ("Kenyan", "Rwandan", "Polish"), and only when the question names exactly
   * one.
   *
   * No new gazetteer and no new matching rule: this delegates entirely to the
   * curated COUNTRY_DEMONYMS table that already backs country relevance
   * scoring, including its deliberate omissions ('american', 'korean',
   * 'congolese', 'guinean', 'dominican', 'georgian', 'english') and its
   * non-locative compound guard, which is what keeps "french fries" from
   * naming France.
   *
   * Returns undefined for zero countries and for two or more — see the
   * precedence comment at the call site for why more than one must NOT become
   * a single-country route.
   */
  private detectLocationByDemonym(query: string): LocationContext | undefined {
    const countries = resolveCountriesByDemonym(query);

    return countries.length === 1 ? { country: countries[0] } : undefined;
  }

  private detectLocationFuzzy(word: string): LocationContext | undefined {
    // G-ALPHA-2 STAGE 1 — the same guard the exact paths apply. Typo
    // correction must not become a second doorway to the misreading the
    // exact resolver just refused.
    if (blocksGeographicRouting(word)) {
      return undefined;
    }

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
