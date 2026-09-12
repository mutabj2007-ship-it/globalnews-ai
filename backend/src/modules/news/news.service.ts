import { Inject, Injectable, Logger } from '@nestjs/common';
import { logWithRequestId } from '../../observability/log-with-request-id';
import type {
  LanguageCode,
  NewsArticle,
  NewsCategory,
  NewsFallbackReason,
  NewsResponse,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import { providerSupports } from './interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import type { NewsProviderTier } from './providers/news-provider-registry';
import {
  ArticlePersistenceService,
  type FirstSeenByUrl,
} from './persistence/article-persistence.service';
import { resolvePrimaryCountry } from './country/country-relevance.util';
import {
  scoreGenericRelevance,
  scoreRelationalRelevance,
} from './relevance/generic-relevance.util';
import { collapseCrossProviderDuplicates } from './cross-provider-dedup.util';
import { collapseDuplicateStories } from './identity/article-identity.util';
import { resolveProviderFailureKind, type ProviderFailureKind } from './providers/gnews.provider';
/*
 * R4 P3 — a pure, dependency-free utility import. resolve-retrieval-language
 * declares which GNews endpoint supports which language and has no Nest
 * wiring, no provider handle and no state, so importing it here creates no
 * module cycle. Worth naming the direction anyway: this points from `news`
 * into `analysis`, which is the reverse of how the two normally depend on each
 * other. It is the smaller wrong than duplicating the endpoint/language table
 * into `news`, which is exactly the divergence that produced this defect.
 */
import { resolveSearchEndpointLanguage } from '../analysis/language/resolve-retrieval-language.util';

const DATABASE_FALLBACK_MAX_AGE_MINUTES = 1440;

/**
 * Milestone #36/#37 — discriminated union, so a search() caller can
 * never request both generic and relational relevance filtering at
 * once. This is a TYPE-LEVEL guarantee, not a documented convention: it
 * is structurally impossible to construct a RelevanceMode value that is
 * simultaneously 'generic' and 'relational', and every branch below
 * exhaustively switches on `mode.type`, so there is no runtime path
 * where two filtering strategies could apply to the same call.
 *
 * - 'none' (the default when the parameter is omitted): no filtering —
 *   CountryNewsService's country/city retrieval and the public
 *   GET /news/search endpoint both call search() this way, so their
 *   behavior is completely unaffected by M36 or M37.
 * - 'generic': Milestone #36's evidence-admission gate
 *   (scoreGenericRelevance), used by AnalysisService's ordinary
 *   (non-relational) generic-search branch.
 * - 'relational': Milestone #37's joint-topical-relevance gate
 *   (scoreRelationalRelevance), used by AnalysisService's relational
 *   branch. Establishes ONLY "the article discusses X and Y" — never
 *   causality. See scoreRelationalRelevance's own doc comment.
 */
export type RelevanceMode =
  { type: 'none' } | { type: 'generic' } | { type: 'relational'; x: string; y: string };

/**
 * The subset of RelevanceMode that actually triggers filtering —
 * excludes 'none'. Both scoreByMode() and applyRelevanceMode() are
 * typed to accept only this narrower type, not the full RelevanceMode
 * union: this makes it a compile-time guarantee (not just a runtime
 * convention) that neither is ever reachable with mode.type === 'none'
 * — the type checker itself would reject such a call. Both actual call
 * sites in search() already only invoke these methods from inside a
 * `relevanceMode.type === 'none' ? ... : ...` ternary's else-branch,
 * where TypeScript's own discriminated-union narrowing already proves
 * `relevanceMode` excludes 'none' at that point, so this type is always
 * satisfiable by the real call sites without any cast.
 */
type ActiveRelevanceMode = Exclude<RelevanceMode, { type: 'none' }>;

const NO_RELEVANCE_FILTERING: RelevanceMode = { type: 'none' };

interface ProviderCallResult {
  results: Array<{
    providerId: string;
    articles: NewsArticle[];
  }>;
  failedProviderIds: string[];
  /**
   * The SAME failures as failedProviderIds, with the reason kept rather than
   * discarded. failedProviderIds is left untouched so every existing consumer
   * — buildResponse and resolveFallbackReason — is byte-for-byte unaffected.
   */
  failures: ProviderFailure[];
  /**
   * G-ALPHA-1 — WAS THE FALLBACK TIER ALREADY ASKED ON THIS CALL?
   *
   * search() may consult the fallback tier a SECOND time, after relevance
   * filtering has emptied a result that the providers themselves filled (see
   * its own comment). That rescue must never re-ask a provider this call has
   * already asked, so the answer has to travel back from the only code that
   * knows it. `false` from callProviderSet is correct by construction: a bare
   * provider-set call knows nothing about tiers and consults nothing beyond the
   * set it was handed.
   */
  fallbackConsulted: boolean;
}

/** Backend-internal. Never serialised and never part of a shared contract. */
export interface ProviderFailure {
  providerId: string;
  kind: ProviderFailureKind;
}

/**
 * WHY A SYMBOL, AND NOT A NEW METHOD OR A NEW FIELD.
 *
 * AnalysisService needs to tell "the provider answered and had nothing" from
 * "the provider REFUSED the request", and it needs the reason, because a
 * deterministic HTTP 400 must not spend the bounded fallback while a genuine
 * empty result still may.
 *
 * Three shapes were considered and two were rejected:
 *
 *   add a field to NewsResponse    REJECTED. NewsResponse is a SHARED contract.
 *                                  Adding to it changes the public API shape,
 *                                  the frontend types and every consumer, for
 *                                  a value only the backend will ever read.
 *   add searchWithDiagnostics()    REJECTED. It changes the collaborator
 *                                  contract AnalysisService depends on, which
 *                                  invalidates 125 existing mock sites and 61
 *                                  existing assertions in analysis.service.spec
 *                                  — a very large, high-risk edit for a
 *                                  diagnostic value.
 *   a backend-only symbol channel  CHOSEN. Invisible to JSON.stringify, so no
 *                                  API response changes. Invisible to the type
 *                                  system's structural checks, so no shared
 *                                  interface changes. Absent on a plain mock,
 *                                  so readProviderFailures() returns [] and
 *                                  every existing test keeps its exact
 *                                  behaviour.
 *
 * The trade is explicit: a symbol side-channel is less discoverable than a
 * field. It is documented here, read through ONE accessor, and used in exactly
 * one decision.
 */
const PROVIDER_FAILURES = Symbol('globalnews.providerFailures');

/**
 * R4 P2 — now exported. It was module-private, which meant a test could only
 * FAKE a provider refusal by guessing at a non-enumerable Symbol it cannot
 * see. A faked refusal proves nothing about the real channel. Exporting the
 * same function the service itself calls lets the Polish regression build a
 * genuine one, so the test and production agree by construction rather than by
 * my having copied the shape correctly.
 *
 * This adds no field, changes no JSON, and changes no behavior for any caller.
 */
export function attachProviderFailures(
  response: NewsResponse,
  failures: ProviderFailure[],
): NewsResponse {
  if (failures.length === 0) return response;
  Object.defineProperty(response, PROVIDER_FAILURES, {
    value: failures,
    enumerable: false,
    configurable: true,
  });
  return response;
}

/**
 * Returns [] for any response that never carried failures — including every
 * hand-built test double. A caller can therefore treat "no failures recorded"
 * and "the provider succeeded" identically, which is what makes this safe to
 * add without touching a single existing test.
 */
export function readProviderFailures(response: NewsResponse): ProviderFailure[] {
  const carried = (response as unknown as Record<symbol, unknown>)[PROVIDER_FAILURES];
  return Array.isArray(carried) ? (carried as ProviderFailure[]) : [];
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  private readonly providers: NewsProvider[];
  private readonly allProviders: NewsProvider[];
  private readonly fallbackProviders: NewsProvider[];
  private readonly articlePersistence: ArticlePersistenceService;

  constructor(
    @Inject(NEWS_PROVIDERS)
    providers: NewsProvider[],

    @Inject(ALL_NEWS_PROVIDERS)
    allProviders: NewsProvider[],

    /**
     * R4 GDELT — the fallback-tier subset of `providers`. Empty in every
     * deployment that has not enabled a fallback provider, which makes
     * the tiered path below collapse to exactly the pre-R4 behaviour.
     *
     * MAIN + E convergence compatibility: Main added one direct constructor
     * regression test while still based on the three-argument R3 signature.
     * Production Nest wiring always supplies the fallback array plus the fourth
     * persistence argument. A three-argument direct test is interpreted as the
     * legacy `(providers, allProviders, persistence)` form and therefore gets
     * an empty fallback tier. No production call path changes.
     */
    @Inject(FALLBACK_NEWS_PROVIDERS)
    fallbackProvidersOrPersistence: NewsProvider[] | ArticlePersistenceService,

    articlePersistence?: ArticlePersistenceService,
  ) {
    this.providers = providers;
    this.allProviders = allProviders;

    if (Array.isArray(fallbackProvidersOrPersistence)) {
      this.fallbackProviders = fallbackProvidersOrPersistence;
      if (!articlePersistence) {
        throw new Error(
          'ArticlePersistenceService is required when fallback providers are supplied.',
        );
      }
      this.articlePersistence = articlePersistence;
      return;
    }

    this.fallbackProviders = [];
    this.articlePersistence = fallbackProvidersOrPersistence;
  }

  /**
   * Milestone #49 (World Map EN/PL integration, CTO scope correction) —
   * `options` is new and STRICTLY additive: every existing caller
   * (AnalysisService's generic/relational Q&A branches, the public
   * GET /news/search endpoint) continues to call this with 3 or fewer
   * arguments, so `options` is `undefined` for them and behavior is
   * byte-for-byte unchanged — `provider.search(query, {limit})` runs
   * exactly as before, and GNewsProvider.search()'s own existing
   * `options?.lang ?? 'en'` default applies exactly as it always has.
   *
   * Only a caller that explicitly passes `{ lang }` (currently:
   * CountryNewsService, for the World Map) changes behavior — the
   * requested language reaches the live provider call, giving GNews
   * the best chance of returning correct-language results.
   *
   * Deliberately does NOT add any post-response language filtering
   * here (unlike topHeadlines()'s Milestone #48 Phase C correction) —
   * per explicit instruction, this phase stops at the narrowest safe
   * handoff. Strict per-article containment for this path remains a
   * known, disclosed gap pending a future round once the live
   * unfiltered behavior has been observed against the real endpoint.
   */
  /**
   * Milestone #51 Phase B — thin pass-through to
   * ArticlePersistenceService.findById(), exposed here (rather than
   * exporting ArticlePersistenceService from NewsModule directly) so
   * AnalysisService — which already has NewsService injected — can
   * resolve a story-context-supplied articleId as a trusted
   * server-side evidence anchor without any new module wiring.
   * Never throws; returns null when the id doesn't resolve (including
   * on any database failure), exactly mirroring
   * ArticlePersistenceService's own convention.
   */
  async findArticleById(articleId: string): Promise<NewsArticle | null> {
    return this.articlePersistence.findById(articleId);
  }

  async search(
    query: string,
    limit?: number,
    relevanceMode: RelevanceMode = NO_RELEVANCE_FILTERING,
    options?: { lang?: string },
  ): Promise<NewsResponse> {
    // Milestone #36/#37: opt-in only, via the discriminated
    // RelevanceMode union above. CountryNewsService's country/city
    // retrieval and the public GET /news/search endpoint both call this
    // same method with the default 'none' mode, so their behavior is
    // completely unchanged by either milestone.
    /**
     * R4 MAIN + E convergence — the Search endpoint language guard is
     * GNews-specific, while the service is now multi-provider.
     *
     * `resolveSearchEndpointLanguage()` owns the proven GNews endpoint rule:
     * Search does not support Polish, so GNews receives the strategy's declared
     * fallback rather than an unsupported `lang=pl`. Other providers retain the
     * caller's requested language and apply their own capability/language rules;
     * E's fallback architecture must not inherit a GNews-only restriction.
     */
    const gnewsSearchLang = resolveSearchEndpointLanguage(options?.lang);

    if (
      options?.lang !== undefined &&
      gnewsSearchLang !== options.lang &&
      this.providers.some((provider) => provider.id === 'gnews')
    ) {
      this.logger.debug(
        `GNews Search does not support lang="${options.lang}"; sending ` +
          `lang="${gnewsSearchLang ?? 'none'}" per the declared retrieval strategy.`,
      );
    }

    const searchOperation = (provider: NewsProvider) =>
      provider.search(query, {
        limit,
        lang: provider.id === 'gnews' ? gnewsSearchLang : options?.lang,
      });

    const providerCall = await this.callAllProviders(searchOperation, 'search');

    /*
     * WHY the providers failed, kept for the one caller that must not treat a
     * refusal as an empty world. Attached to whichever response is returned
     * below - see attachProviderFailures()'s own comment for why it is a symbol
     * and not a field. Every return path in this method is wrapped, so there is
     * no path on which a failure is silently lost.
     */
    let failures = providerCall.failures;

    // G-ALPHA-1 — the accumulated provider evidence for THIS request. Mutable
    // only because the bounded rescue below may add exactly one provider set's
    // worth of results to it; every downstream consumer reads these, never
    // `providerCall`, so a rescue can never be invisible to the response.
    let results = providerCall.results;
    let failedProviderIds = providerCall.failedProviderIds;

    // Milestone #36/#37: filtering happens here — before the
    // persistence check just below — so a relevance-rejected article is
    // never persisted as accepted generic OR relational evidence (per
    // the approved design's "provider candidates -> relevance filtering
    // -> accepted result handling/persistence" ordering, which applies
    // identically to both modes).
    const buildFilteredResponse = (): NewsResponse => {
      const raw = this.buildResponse(
        results,
        failedProviderIds,
        limit,
        { query },
        {
          sortByRecency: true,
        },
      );

      return relevanceMode.type === 'none'
        ? raw
        : this.applyRelevanceMode(raw, query, relevanceMode);
    };

    let response = buildFilteredResponse();

    /**
     * G-ALPHA-1 D1 — THE BOUNDED POST-RELEVANCE RESCUE.
     *
     * THE DEFECT THIS CLOSES. callAllProviders decides whether to consult the
     * fallback tier by counting RAW articles, before this method's relevance
     * gate has run. That is right for an empty provider answer and wrong for
     * the case that actually empties these responses: a primary that returns
     * ten articles which the gate then rejects looks, to the tier logic,
     * exactly like success — so the fallback provider is never asked, and the
     * reader is told there is no reporting.
     *
     * Observed evidence: "What do you know about President Donald Trump?"
     * reaches the provider as that whole sentence, the multi-word gate requires
     * the whole phrase verbatim in a headline, every article is rejected, and
     * the rescue that exists for exactly this outcome never fires.
     *
     * WHAT THIS IS NOT. It is not a relaxation of the relevance gate — the
     * rescued articles go through the SAME unmodified gate, via the same
     * buildFilteredResponse() closure, and a fallback provider that returns
     * nothing relevant changes nothing. Evidence failure stays honest.
     *
     * BOUNDS, ALL THREE ENFORCED HERE:
     *   1. ONCE PER REQUEST. `fallbackConsulted` is false only when
     *      callAllProviders stopped at the primaries, so a tier already spent
     *      on the zero-raw path is never spent again.
     *   2. ONLY WHEN THERE IS SOMETHING TO ASK. An empty eligible fallback set
     *      — which is every deployment with GDELT_DOC_ENABLED unset — skips
     *      this entirely and behaves byte-for-byte as before.
     *   3. NO FAN-OUT. One call to one already-selected provider set. The
     *      primaries are not re-asked.
     */
    if (response.articles.length === 0 && !providerCall.fallbackConsulted) {
      const fallbacks = this.eligibleProvidersForTier('search', 'fallback');

      if (fallbacks.length > 0) {
        logWithRequestId(
          this.logger,
          'log',
          'Relevance filtering accepted no articles from the primary providers; ' +
            `consulting ${fallbacks.length} fallback provider(s) once`,
        );

        const rescueCall = await this.callProviderSet(fallbacks, searchOperation);

        // Provenance and failure reasons both accumulate. A rescue must not
        // erase who already answered, and must not hide its own failure.
        results = [...results, ...rescueCall.results];
        failedProviderIds = [...failedProviderIds, ...rescueCall.failedProviderIds];
        failures = [...failures, ...rescueCall.failures];

        response = buildFilteredResponse();
      }
    }

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        // R0.5 — same call, same position, same await as before; only its
        // return value stopped being discarded. See attachFirstSeen().
        const firstSeenByUrl = await this.articlePersistence.persistMany(response.articles);

        return attachProviderFailures(this.attachFirstSeen(response, firstSeenByUrl), failures);
      }

      return attachProviderFailures(response, failures);
    }

    if (!this.hasRealProviderConfigured()) {
      return attachProviderFailures(response, failures);
    }

    const cachedArticles = await this.articlePersistence.findRecent({
      query,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    // Milestone #36/#37: the SAME gate (whichever mode is active)
    // applies to stored/persisted fallback results — live and stored
    // generic/relational results must not have inconsistent trust
    // rules.
    const relevantCachedArticles =
      relevanceMode.type === 'none'
        ? cachedArticles
        : cachedArticles.filter(
            (article) => this.scoreByMode(article, query, relevanceMode).isRelevant,
          );

    if (relevantCachedArticles.length === 0) {
      return attachProviderFailures(response, failures);
    }

    return attachProviderFailures(
      this.buildCachedResponse(
        relevantCachedArticles,
        limit,
        {
          query,
        },
        // G-ALPHA-1 — the ACCUMULATED ids, so a rescue attempt that also
        // failed is reflected in the public fallback reason.
        this.resolveFallbackReason(failedProviderIds),
      ),
      failures,
    );
  }

  /**
   * Milestone #47 — `options` is new (previously topHeadlines() took
   * only `limit`). Backward compatible: every existing caller that
   * passes no second argument, or omits `lang`/`q`, gets exactly the
   * same provider call as before. Does NOT itself apply relevance
   * filtering (unlike search()) — AnalysisService's Milestone #47
   * Polish branch applies scoreGenericRelevance() directly to this
   * method's results, reusing the same unmodified relevance function
   * search() uses internally, without retrofitting this method's own
   * DB-fallback/persistence logic (below, unchanged) with the
   * relevanceMode plumbing search() has.
   *
   * Milestone #47 (runtime correction): this method itself still just
   * passes `options?.lang` straight through, unchanged — the English
   * default for the generic homepage path now lives at
   * GNewsProvider.topHeadlines() instead, mirroring exactly how
   * GNewsProvider.search()/category() already default their own `lang`
   * (this method doesn't default anything for THOSE either). Keeping
   * the default at the single provider boundary, not duplicated here
   * too, avoids two places disagreeing about what "no language
   * specified" should mean.
   *
   * Milestone #48 (homepage news-content language containment
   * correction) — when `options?.lang` is set, the database-cache
   * fallback below (`articlePersistence.findRecent()`) is now SKIPPED
   * entirely. Root cause, verified directly from
   * article-persistence.service.ts: `persistMany()`'s Prisma
   * create/update payload does not write a source-language field at
   * all, and `findRecent()`'s query has no language filter — the
   * stored article pool is accumulated across every past call in every
   * language ever requested, with no way to partition it by language.
   * Returning from that pool for a language-CONSTRAINED request would
   * silently mix languages regardless of what was asked for — exactly
   * the browser-reported defect (BOTH lang=en and lang=pl showing a
   * heavy, varied multilingual mixture is the signature of a
   * language-agnostic shared cache, not of GNews's own live filtering
   * being merely imperfect).
   *
   * This is a deliberately conservative, deterministic policy: when a
   * specific language was requested and live retrieval returns
   * nothing, this method now returns the SAME "unavailable" response
   * it already returns for the no-real-provider-configured case,
   * rather than silently backfilling with untrusted-language cached
   * content. A caller that does NOT request a specific language (lang
   * omitted — no current caller does this, but the method itself
   * doesn't forbid it) keeps the original DB-fallback behavior
   * unchanged, since there is no language constraint to violate.
   */
  async topHeadlines(
    limit?: number,
    options?: { lang?: string; q?: string },
  ): Promise<NewsResponse> {
    const providerCall = await this.callAllProviders(
      (provider) =>
        provider.topHeadlines({
          limit,
          lang: options?.lang,
          q: options?.q,
        }),
      'top-headlines',
    );

    /*
     * R4 POLISH LIVE 400 — P2. WHY the providers failed, carried out of this
     * method the same way search() already carries it.
     *
     * search() has attached this since the approved provider-failure
     * correction; topHeadlines() never did, so AnalysisService's Polish stage
     * could not tell a deterministic HTTP 400 refusal from an empty world even
     * if it had asked — readProviderFailures() on a topHeadlines response
     * returned [] by construction. The live consequence was measured: a 400 on
     * stage 1, then a second request one second later that earned a 429.
     *
     * This is the SAME attachProviderFailures() helper and the SAME
     * non-enumerable Symbol, not a parallel mechanism. It changes no field, no
     * JSON shape and no existing caller: readProviderFailures() returns [] for
     * any response that carries nothing, exactly as before. Every return path
     * below is wrapped, so a failure can never be silently lost on one of
     * them.
     */
    const failures = providerCall.failures;

    const response = this.buildResponse(
      providerCall.results,
      providerCall.failedProviderIds,
      limit,
      {},
      {
        sortByRecency: false,
      },
      options?.lang,
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        // R0.5 — same call, same position, same await as before; only its
        // return value stopped being discarded. See attachFirstSeen().
        const firstSeenByUrl = await this.articlePersistence.persistMany(response.articles);

        return attachProviderFailures(this.attachFirstSeen(response, firstSeenByUrl), failures);
      }

      return attachProviderFailures(response, failures);
    }

    if (!this.hasRealProviderConfigured()) {
      return attachProviderFailures(response, failures);
    }

    // Milestone #48: a language-constrained request never falls back
    // to the language-agnostic stored-article pool — see this method's
    // own doc comment above for the verified root cause.
    if (options?.lang) {
      return attachProviderFailures(response, failures);
    }

    const cachedArticles = await this.articlePersistence.findRecent({
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    if (cachedArticles.length === 0) {
      return attachProviderFailures(response, failures);
    }

    return attachProviderFailures(
      this.buildCachedResponse(
        cachedArticles,
        limit,
        {},
        this.resolveFallbackReason(providerCall.failedProviderIds),
        options?.lang,
      ),
      failures,
    );
  }

  async byCategory(category: NewsCategory, limit?: number): Promise<NewsResponse> {
    const providerCall = await this.callAllProviders(
      (provider) =>
        provider.category(category, {
          limit,
        }),
      'category',
    );

    const response = this.buildResponse(
      providerCall.results,
      providerCall.failedProviderIds,
      limit,
      {
        category,
      },
      {
        sortByRecency: true,
      },
    );

    if (response.articles.length > 0) {
      if (response.dataMode === 'live') {
        // R0.5 — same call, same position, same await as before; only its
        // return value stopped being discarded. See attachFirstSeen().
        const firstSeenByUrl = await this.articlePersistence.persistMany(response.articles);

        return this.attachFirstSeen(response, firstSeenByUrl);
      }

      return response;
    }

    if (!this.hasRealProviderConfigured()) {
      return response;
    }

    const cachedArticles = await this.articlePersistence.findRecent({
      category,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
    });

    if (cachedArticles.length === 0) {
      return response;
    }

    return this.buildCachedResponse(
      cachedArticles,
      limit,
      {
        category,
      },
      this.resolveFallbackReason(providerCall.failedProviderIds),
    );
  }

  async providersHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(
      this.allProviders.map(async (provider) => {
        try {
          return await provider.health();
        } catch (error) {
          logWithRequestId(
            this.logger,
            'warn',
            `Health check failed for provider "${provider.id}"`,
            error instanceof Error ? error : undefined,
          );

          return {
            providerId: provider.id,
            displayName: provider.displayName,
            status: 'down' as const,
            message: error instanceof Error ? error.message : 'Unknown error',
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );
  }

  /**
   * R4 GDELT — TIER-AWARE RETRIEVAL.
   *
   * Before R4 this method called EVERY active provider on EVERY request,
   * in parallel, unconditionally. With one provider that was the same
   * thing as "call the provider". With two it would have meant issuing a
   * GDELT request alongside every GNews request — cost and latency spent
   * on a second opinion nobody asked for, against a free public endpoint
   * that asks for one request every five seconds.
   *
   * So the order is now:
   *
   *   1. call every PRIMARY provider that supports this operation;
   *   2. if that produced AT LEAST ONE ARTICLE, stop. The fallback
   *      providers are not called at all;
   *   3. otherwise call the FALLBACK providers and merge what they return.
   *
   * WHY THE CONDITION IS "ZERO ARTICLES" AND NOT "THE PRIMARY THREW".
   * A quota-exhausted 403, a timeout, an unreachable host and a perfectly
   * healthy empty result set all reach the reader as the same thing: no
   * reporting. One condition covers all of them, cannot drift out of sync
   * with the failure taxonomy, and does not need to enumerate the ways a
   * provider can disappoint. It also means a primary that returns SOMETHING
   * always wins, which is the preference the tier expresses.
   *
   * FAILURES STILL PROPAGATE. A primary that threw is reported in
   * `failedProviderIds` whether or not the fallback then succeeded, and its
   * machine-readable reason remains in `failures`, so both the public fallback
   * reason and Analysis's backend-only diagnostic channel keep telling the
   * truth about what broke.
   *
   * A SKIPPED PROVIDER IS NOT A FAILED PROVIDER. A provider that does not
   * declare this capability is never called and never appears in
   * `failedProviderIds` — it did not fail, it was not asked. Conflating
   * the two would make a healthy search-only provider look broken on every
   * homepage request.
   */
  private async callAllProviders(
    operation: (provider: NewsProvider) => Promise<NewsArticle[]>,
    capability: NewsProviderCapability,
  ): Promise<ProviderCallResult> {
    const primaries = this.eligibleProvidersForTier(capability, 'primary');
    const fallbacks = this.eligibleProvidersForTier(capability, 'fallback');

    const primaryCall = await this.callProviderSet(primaries, operation);

    const primaryArticleCount = primaryCall.results.reduce(
      (total, result) => total + result.articles.length,
      0,
    );

    if (primaryArticleCount > 0 || fallbacks.length === 0) {
      return primaryCall;
    }

    logWithRequestId(
      this.logger,
      'log',
      `Primary providers returned no articles; consulting ${fallbacks.length} fallback provider(s)`,
    );

    const fallbackCall = await this.callProviderSet(fallbacks, operation);

    return {
      results: [...primaryCall.results, ...fallbackCall.results],
      failedProviderIds: [...primaryCall.failedProviderIds, ...fallbackCall.failedProviderIds],
      // MAIN + E convergence — a fallback rescue must not erase WHY a
      // primary failed. The non-enumerable Analysis side-channel consumes
      // this list; failedProviderIds continues to drive the public fallback
      // reason exactly as before.
      failures: [...primaryCall.failures, ...fallbackCall.failures],
      // G-ALPHA-1 — the tier has now been spent for this request.
      fallbackConsulted: true,
    };
  }

  /**
   * G-ALPHA-1 — the ACTIVE providers of one tier that can serve one capability.
   *
   * Extracted from callAllProviders unchanged, because search()'s
   * post-relevance rescue must select the fallback set by EXACTLY the same rule
   * the ordinary tier logic uses. Two copies of this filter would be two places
   * for the two paths to disagree about which providers exist.
   *
   * A provider that does not declare the capability is not in either tier here:
   * it is never called and never counted as failed, which is the pre-existing
   * "a skipped provider is not a failed provider" rule, unchanged.
   */
  private eligibleProvidersForTier(
    capability: NewsProviderCapability,
    tier: NewsProviderTier,
  ): NewsProvider[] {
    const fallbackIds = new Set(this.fallbackProviders.map((provider) => provider.id));
    const eligible = this.providers.filter((provider) => providerSupports(provider, capability));

    return tier === 'fallback'
      ? eligible.filter((provider) => fallbackIds.has(provider.id))
      : eligible.filter((provider) => !fallbackIds.has(provider.id));
  }

  /**
   * R4 GDELT — the original unconditional fan-out, now scoped to one set.
   *
   * The body below is the pre-R4 `callAllProviders` verbatim except that
   * it iterates the set it is handed instead of `this.providers`. Failure
   * isolation via Promise.allSettled, the warn log and the
   * `failedProviderIds` contract are unchanged.
   */
  private async callProviderSet(
    providers: readonly NewsProvider[],
    operation: (provider: NewsProvider) => Promise<NewsArticle[]>,
  ): Promise<ProviderCallResult> {
    const settled = await Promise.allSettled(
      providers.map(async (provider) => ({
        providerId: provider.id,
        articles: await operation(provider),
      })),
    );

    const results: ProviderCallResult['results'] = [];

    const failedProviderIds: string[] = [];
    const failures: ProviderFailure[] = [];

    settled.forEach((result, index) => {
      const provider = providers[index];

      if (result.status === 'fulfilled') {
        results.push(result.value);
        return;
      }

      failedProviderIds.push(provider.id);

      /* The reason was already in hand here and was being thrown away. */
      const kind = resolveProviderFailureKind(result.reason);
      failures.push({ providerId: provider.id, kind });

      logWithRequestId(
        this.logger,
        'warn',
        `Provider "${provider.id}" failed to respond [${kind}]`,
        result.reason instanceof Error ? result.reason : undefined,
      );
    });

    return {
      results,
      failedProviderIds,
      failures,
      // This call asked exactly the providers it was given and nothing else.
      fallbackConsulted: false,
    };
  }

  /**
   * M66.14B — annotate each article with its canonical country.
   *
   * ANNOTATION ONLY. This is a 1:1 map: it never filters, never reorders, never
   * drops and never adds. Article count and order are byte-identical before and
   * after, on every path — live, cached and mock alike — so the GNews feed the
   * homepage renders is exactly the feed it rendered before. That property is
   * asserted, not assumed.
   *
   * An article with no resolvable country keeps NO countryCode at all rather
   * than a placeholder, and still renders normally. Absence means "we do not
   * know", which is the contract documented on NewsArticle itself.
   *
   * The try/catch is deliberate and is the reason this can sit on the live
   * path: country resolution is a presentation nicety, and no failure inside it
   * may ever cost a reader their news. A throw degrades that one article to
   * unannotated and the response continues.
   *
   * `language` is the REQUEST language, forwarded to scoreCountryRelevance where
   * it only ever ADDS the localized country name as an extra positive signal.
   * A Polish interface therefore still resolves an English article by its
   * canonical English name — asserted in country-relevance.util.spec.ts.
   */
  private resolveArticleCountries(articles: NewsArticle[], language?: string): NewsArticle[] {
    return articles.map((article) => {
      try {
        const primary = resolvePrimaryCountry(article, language as LanguageCode | undefined);

        if (!primary) {
          return article;
        }

        return {
          ...article,
          countryCode: primary.countryCode,
          countryName: primary.countryName,
        };
      } catch {
        return article;
      }
    });
  }

  private buildResponse(
    results: Array<{
      providerId: string;
      articles: NewsArticle[];
    }>,
    failedProviderIds: string[],
    limit: number | undefined,
    extra: Partial<Pick<NewsResponse, 'query' | 'category'>> = {},
    {
      sortByRecency,
    }: {
      sortByRecency: boolean;
    } = {
      sortByRecency: true,
    },
    language?: string,
  ): NewsResponse {
    const seen = new Set<string>();

    const merged: NewsArticle[] = [];

    for (const { articles } of results) {
      // R4 — the SAME-PROVIDER seam, collapsed here, per provider, BEFORE
      // the merge.
      //
      // THE DEFECT THIS CLOSES. The cross-provider pass further down runs
      // only when more than one provider contributed to this call, and
      // `news.module.ts` declares exactly ONE real news provider candidate
      // — so in the shipped configuration it never ran at all, and the only
      // deduplication a homepage response ever received was the exact-`id`
      // check below. `GNewsProvider.buildStableId()` hashes the RAW url, so
      // one article offered with a tracking parameter, a fragment, a
      // trailing slash or a differently-cased host arrived as several
      // different ids. Every one of them survived, through
      // `allocateHomeFeed` (which also partitioned on `id` alone) and into
      // two adjacent Global Developments cards carrying the same headline
      // and the same image.
      //
      // WHY PER PROVIDER, AND WHY BEFORE THE MERGE. These are two different
      // seams with two different owners, and collapsing them into one pass
      // would have broken the other. This asks "did ONE provider hand us
      // this record twice?" and keeps the first occurrence, which preserves
      // that provider's editorial order. The cross-provider pass asks "are
      // TWO providers carrying one story?" and answers with a deterministic
      // WINNER rule — better-corroborated record first, then registration
      // order. Running a keep-first pass over the merged set would have
      // silently pre-empted that winner rule and made the survivor depend
      // on provider order, which is exactly the behaviour E1 established
      // must not happen. Scoped here, each pass owns its own seam and the
      // cross-provider rule is reached with its input unchanged.
      for (const article of collapseDuplicateStories(articles)) {
        if (seen.has(article.id)) {
          continue;
        }

        seen.add(article.id);
        merged.push(article);
      }
    }

    // E1 — the exact-id pass above is necessary but not sufficient
    // once more than one provider can be active at a time: every
    // provider namespaces its own ids ('gnews-...', 'mock-...'), so
    // two providers carrying the identical story arrive as two
    // different ids and survive id-based dedup intact.
    //
    // The cross-provider pass runs ONLY when more than one provider
    // actually contributed results to THIS call. With a single
    // contributing provider — today's shipped configuration, and every
    // pre-E1 request — `merged` is returned untouched, so the live
    // feed is byte-for-byte what it was before E1. This is a
    // deliberate scope line: E1 is about the multi-provider seam, not
    // about retroactively applying title-similarity dedup to one
    // provider's own results.
    //
    // The similarity decision itself is the repository's existing
    // deduplicateArticles utility, reused unchanged — see
    // cross-provider-dedup.util.ts for the deterministic winner rule.
    const deduplicated =
      results.length > 1
        ? collapseCrossProviderDuplicates(
            merged,
            this.providers.map((provider) => provider.id),
          )
        : merged;

    if (sortByRecency) {
      deduplicated.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
    }

    const capped = limit ? deduplicated.slice(0, limit) : deduplicated;

    const successfulProviderIds = results.map((result) => result.providerId);

    const dataMode = this.resolveDataMode(successfulProviderIds);

    return {
      articles: this.resolveArticleCountries(capped, language),
      totalResults: capped.length,
      providers: successfulProviderIds,
      dataMode,
      fallbackReason:
        dataMode === 'unavailable' ? this.resolveFallbackReason(failedProviderIds) : undefined,
      generatedAt: new Date().toISOString(),
      ...extra,
    };
  }

  /**
   * Milestone #36/#37 — dispatches to the correct scorer based on the
   * active RelevanceMode. Never called with mode.type === 'none' (both
   * call sites above check that first) — kept as a private helper
   * rather than inlined so the two filtering points (live response,
   * cached-articles array) can never drift apart in which scorer they
   * use for a given mode.
   */
  private scoreByMode(
    article: NewsArticle,
    query: string,
    relevanceMode: ActiveRelevanceMode,
  ): { isRelevant: boolean } {
    if (relevanceMode.type === 'generic') {
      return scoreGenericRelevance(article, query);
    }

    return scoreRelationalRelevance(article, relevanceMode.x, relevanceMode.y);
  }

  /**
   * Milestone #36/#37 — filters a NewsResponse's articles via
   * scoreByMode(), recomputing totalResults to match. Only ever called
   * from search() when relevanceMode.type !== 'none'. Every other field
   * (dataMode, providers, fallbackReason, generatedAt, query/category)
   * is preserved unchanged — dataMode continues to describe what the
   * RETRIEVAL did (e.g. "live" because a real provider responded),
   * independent of how many of its results survive relevance filtering.
   */
  private applyRelevanceMode(
    response: NewsResponse,
    query: string,
    relevanceMode: ActiveRelevanceMode,
  ): NewsResponse {
    const filtered = response.articles.filter(
      (article) => this.scoreByMode(article, query, relevanceMode).isRelevant,
    );

    return {
      ...response,
      articles: filtered,
      totalResults: filtered.length,
    };
  }

  /**
   * R0.5 — attaches the database's own first-observation timestamp to a LIVE
   * response.
   *
   * ANNOTATION ONLY, on exactly the terms resolveArticleCountries() already
   * established: a 1:1 map that never filters, never reorders, never drops
   * and never adds. Article count and order are identical before and after,
   * and every other field on the response — dataMode, totalResults,
   * providers, fallbackReason, generatedAt, query/category — is passed
   * through untouched. `dataMode` continues to describe what the RETRIEVAL
   * did: the news is live, and firstSeenAt is a statement about OUR
   * observation of it, not about where it came from.
   *
   * MERGED BY `url`, never by array index and never by `id`. Index-keying
   * happens to work today and would fail silently the first time anything
   * reorders or batches; `id` is worse still, because two providers carrying
   * one story produce two ids for a single stored row (see FirstSeenByUrl).
   * `url` is the key the database itself upserts on.
   *
   * An article whose URL is not in the map keeps NO firstSeenAt. Absence is
   * the honest answer and is never filled in with publishedAt, with the
   * current time, or with a provider timestamp — see NewsArticle.firstSeenAt
   * for the full contract.
   *
   * An empty map short-circuits, so a response that recorded nothing is
   * returned as the very same object, unmodified.
   */
  private attachFirstSeen(response: NewsResponse, firstSeenByUrl: FirstSeenByUrl): NewsResponse {
    if (!firstSeenByUrl || firstSeenByUrl.size === 0) {
      return response;
    }

    return {
      ...response,
      articles: response.articles.map((article) => {
        const firstSeenAt = firstSeenByUrl.get(article.url);

        return firstSeenAt ? { ...article, firstSeenAt } : article;
      }),
    };
  }

  private buildCachedResponse(
    articles: NewsArticle[],
    limit: number | undefined,
    extra: Partial<Pick<NewsResponse, 'query' | 'category'>> = {},
    fallbackReason?: NewsFallbackReason,
    language?: string,
  ): NewsResponse {
    const capped = limit ? articles.slice(0, limit) : articles;

    return {
      articles: this.resolveArticleCountries(capped, language),
      totalResults: capped.length,
      providers: [],
      dataMode: 'cached',
      fallbackReason,
      generatedAt: new Date().toISOString(),
      ...extra,
    };
  }

  private resolveFallbackReason(failedProviderIds: string[]): NewsFallbackReason {
    const failedRealProvider = this.providers.some(
      (provider) => !provider.isMock && failedProviderIds.includes(provider.id),
    );

    return failedRealProvider ? 'provider-error' : 'no-live-results';
  }

  private hasRealProviderConfigured(): boolean {
    return this.providers.some((provider) => !provider.isMock);
  }

  /**
   * Determines dataMode from what actually happened on this call, not
   * from which providers are merely configured.
   *
   * A provider that resolved (even with zero articles) counts as
   * "successful" here — callAllProviders only excludes providers whose
   * promise rejected. That's what lets a real provider's legitimate
   * zero-result answer ("live", 0 articles) stay distinguishable from
   * every real provider failing outright ("unavailable", 0 articles):
   * the former has a non-empty `providers` list, the latter doesn't.
   */
  private resolveDataMode(successfulProviderIds: string[]): NewsResponse['dataMode'] {
    const successfulProviders = this.providers.filter((provider) =>
      successfulProviderIds.includes(provider.id),
    );

    if (successfulProviders.length > 0) {
      return successfulProviders.some((provider) => !provider.isMock) ? 'live' : 'mock';
    }

    if (this.providers.length > 0 && this.providers.every((provider) => provider.isMock)) {
      return 'mock';
    }

    // Nobody succeeded, and a real provider was in play (or none is
    // configured at all). Never claim "live" when nothing actually
    // came back — see resolveFallbackReason for why.
    return 'unavailable';
  }
}
