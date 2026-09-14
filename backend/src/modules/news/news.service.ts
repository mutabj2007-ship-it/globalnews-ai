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
import { withDerivedEvidenceFields } from './identity/geographic-precision.util';
import {
  filterToRequestedSource,
  isAttributableToRequestedSource,
  type RequestedSource,
} from './identity/requested-source.util';
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
import {
  extractRetainedQueryTerms,
  matchesRetainedQuery,
  retainedCandidateTerms,
} from './relevance/retained-query-match.util';
import {
  resolveRetainedQueryCountry,
  retainedCountryVerdict,
} from './relevance/retained-country-gate.util';

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

/**
 * FALLBACK-PEER-TAIL-LATENCY-1 R1 — THE ONLY TUNABLE THIS CORRECTION ADDS.
 *
 * THE MEASURED DEFECT. `callProviderSet()` awaits `Promise.allSettled`, so a
 * tier is exactly as slow as its slowest member. In the live Alpha the
 * Publisher Feeds connector produced usable evidence in ~140 ms and the
 * request still took 13.331 s, because GDELT DOC was in the same fallback
 * fan-out. GDELT's worst-case contribution to one request is not its 8 s
 * deadline alone: `MIN_REQUEST_SPACING_MS` (5 500) is awaited BEFORE that
 * deadline is armed, so the true bound is 13 500 ms.
 *
 * THIS IS NOT A PROVIDER TIMEOUT AND MUST NEVER BECOME ONE. It does not
 * cancel anything. GDELT's 8 s deadline, its 5.5 s spacing rule, its 60 s
 * cooldown and its no-retry behaviour are untouched — a peer we stop awaiting
 * runs to its own completion and keeps its own semantics entirely. All this
 * constant decides is how long a request that ALREADY HAS ADMISSIBLE EVIDENCE
 * keeps waiting for a straggler that might add more.
 *
 * PROVISIONAL ALPHA VALUE, approved as such and deliberately isolated here so
 * it can be tuned from one line after Railway GDELT TTFB measurement.
 */
const PEER_TAIL_GRACE_MS = 1500;

/**
 * R1 — WHAT "USABLE" MEANS IS THE REQUEST'S OWN BUSINESS, NOT THIS MODULE'S.
 *
 * THE CORRECTION THIS ENCODES. The first proposal started the grace on
 * `articles.length > 0` — raw articles from a settled peer. That is wrong, and
 * wrong in the one way that matters: in the Search path, relevance admission
 * and the requested-source constraint both run AFTER the fan-out, so raw
 * articles routinely include records the request is about to discard. Starting
 * a cutoff on them would abandon a slow peer carrying the only genuinely
 * admissible evidence — trading a latency defect for an evidence defect.
 *
 * So the caller supplies `admits`, built from the SAME authorities that will
 * judge these articles a few lines later: `scoreByMode()` for the active
 * relevance mode, and `isAttributableToRequestedSource()` for the source
 * constraint. No second scoring system exists, and none may be introduced
 * here — this interface deliberately cannot express a rule of its own.
 */
interface PeerTailPolicy {
  /** True only for an article the request's existing admission rules accept. */
  readonly admits: (article: NewsArticle) => boolean;
  readonly graceMs: number;
}

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
   * R1 — PEERS WE CHOSE NOT TO AWAIT. DELIBERATELY NOT A FAILURE.
   *
   * WHY THIS IS ITS OWN CHANNEL AND NOT A ProviderFailure. The failures list is
   * consumed OPERATIONALLY by AnalysisService: a recorded failure suppresses
   * the bounded secondary generic fallback, on the sound reasoning that
   * re-asking a provider that just refused earns the same refusal. A peer we
   * stopped waiting for did not refuse anything — it is still running, and it
   * may well succeed. Filing it as a failure would teach the rest of the
   * product something untrue and would suppress a retry that is still worth
   * making.
   *
   * It is equally NOT in `failedProviderIds`, so the public `fallbackReason`
   * cannot move, and it is never passed to `attachProviderFailures()`, so it
   * never reaches the Analysis side-channel at all. Backend-internal,
   * request-scoped, and for logging and assertions only.
   */
  notAwaitedProviderIds: string[];
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
  /**
   * REV B — THE DERIVATION APPLIES HERE TOO, BECAUSE ANALYSIS CONSUMES THIS.
   *
   * `resolveArticleCountries` covers the retrieval paths, and this one is not
   * a retrieval path — it is the story ANCHOR. An article reaching Analysis
   * through `articleId` therefore bypassed the producer entirely and arrived
   * with `geographicPrecision` undefined, so `evidenceDisplayCeiling` fell back
   * to UNRESOLVED for the single most important article on the page: the one
   * the reader actually clicked.
   *
   * WHAT IS READ, AND WHY IT IS ARTICLE-LEVEL EVIDENCE. `withDerivedEvidenceFields`
   * reads `article.countryCode` and nothing else. On a persisted article that
   * column was written by `resolveArticleCountries` from the article's OWN title
   * and summary at the time it was stored. It is the same fact, durably kept —
   * not the query's country, and not the retrieval context's. There is no
   * parameter on the producer through which `retrievalContext.countryCode`
   * could reach it even if some future caller tried.
   *
   * MISSING-ONLY, LIKE EVERYWHERE ELSE. A stored article that already carries a
   * precision keeps it untouched.
   */
  async findArticleById(articleId: string): Promise<NewsArticle | null> {
    const article = await this.articlePersistence.findById(articleId);

    return article === null ? null : withDerivedEvidenceFields(article);
  }

  /**
   * C907 §8 — PREVIOUSLY RETRIEVED REPORTING FOR ONE COUNTRY.
   *
   * A thin delegate, and deliberately nothing more. The persistence layer
   * already owns the query, the age window and the relevance flag; this exists
   * so AnalysisService can reach retained reporting for a DECLARED REGION'S
   * MEMBERS without being handed the repository itself.
   *
   * WHY IT IS SCOPED BY COUNTRY AND CANNOT BE OTHERWISE. The ruling is
   * explicit: *"Do not substitute unrelated cached reporting."* A method that
   * returned "recent articles" would make that substitution possible in one
   * line; this one cannot answer a question it was not asked about a specific
   * country, so a regional fallback can only ever serve reporting from that
   * region's own members.
   *
   * Never throws — `findRecentByCountry` returns [] on any database failure,
   * which is the same convention `findArticleById` follows above. A retained
   * fallback that threw would turn a degraded answer into no answer.
   */
  async findRetainedByCountry(
    countryCode: string,
    limit: number,
    maxAgeMinutes: number,
  ): Promise<NewsArticle[]> {
    const retained = await this.articlePersistence.findRecentByCountry({
      countryCode,
      limit,
      maxAgeMinutes,
    });

    /*
      REV B — the second Analysis-consumed path that bypassed the producer.
      Same missing-only derivation, same single input, for the same reason as
      findArticleById above.

      A NOTE ON THE ONE THING THAT LOOKS LIKE BORROWING AND IS NOT. This method
      takes a `countryCode` ARGUMENT — the region being asked about — and that
      argument is never passed to the derivation. What is read is each returned
      article's OWN stored `countryCode` column. The two happen to agree here,
      because the query selected on that column, but they agree by consequence
      and not by substitution: the value credited to the article is the one the
      article itself established, exactly as it would be on any other path.
    */
    return retained.map((article) => withDerivedEvidenceFields(article));
  }

  /**
   * R1 REV A — THE SOURCE CONSTRAINT LIVES HERE, NOT ABOVE THIS METHOD.
   *
   * WHAT R1 GOT WRONG, STATED PLAINLY. R1 applied the requested-publisher
   * constraint in AnalysisService, to whatever this method had already
   * returned. `callAllProviders()` stops at the primary tier the moment the
   * primaries return at least one RAW article, so a healthy GNews carrying one
   * topically relevant article from the WRONG publisher ended the ladder: the
   * Publisher Feeds tier was never consulted, and the constraint then removed
   * the only article there was. The reader was told there is no reporting while
   * `feed:gus-pl` held exactly the report they asked for. R1 therefore only
   * worked while GNews was failing — it depended on the outage it was measured
   * during, which is not a correction at all.
   *
   * WHY THIS PLACEMENT FIXES IT WITHOUT A SECOND LADDER. `search()` already
   * owns a bounded post-relevance rescue (see G-ALPHA-1 D1 below) that exists
   * for precisely the neighbouring case: the primaries answered, the gate
   * rejected everything, and the tier logic could not tell that apart from
   * success. A requested-source constraint is the same shape of problem — an
   * admission rule the tier logic cannot see — so it is applied INSIDE the same
   * `buildFilteredResponse()` closure the gate uses. The rescue's own
   * condition, `response.articles.length === 0`, then reads "zero qualifying
   * REQUESTED-SOURCE articles" without the rescue itself being modified at all.
   *
   * ADDITIVE, AND ORTHOGONAL TO RelevanceMode. It rides on the existing
   * `options` bag rather than widening the RelevanceMode union, so every
   * existing call site compiles untouched, `ActiveRelevanceMode` narrowing is
   * unchanged, and `applyRelevanceMode()` stays byte-for-byte as it was. A
   * caller that passes no `requestedSource` — every caller in the product
   * except AnalysisService's source-attributed branch — reaches exactly the
   * code it reached before.
   *
   * NO TIER WAS MOVED. GNews is still primary, Publisher Feeds and GDELT DOC
   * are still fallback, provider ordering is unchanged, and nothing calls RSS
   * directly.
   */
  async search(
    query: string,
    limit?: number,
    relevanceMode: RelevanceMode = NO_RELEVANCE_FILTERING,
    options?: { lang?: string; requestedSource?: RequestedSource },
  ): Promise<NewsResponse> {
    const requestedSource = options?.requestedSource;
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

    /*
     * R1 — THE ADMISSION RULE, BUILT FROM THE AUTHORITIES THAT WILL JUDGE
     * THESE ARTICLES ANYWAY.
     *
     * Every clause below is the SAME call the gate a few lines down makes.
     * `scoreByMode()` is the relevance authority; `isAttributableToRequestedSource()`
     * is the source authority. Nothing here scores, ranks or decides anything
     * of its own, and a reader checking whether the grace can admit something
     * the request would reject only has to see that both calls are the
     * existing ones.
     *
     * ORDER MIRRORS buildFilteredResponse(): relevance first, attribution
     * second.
     *
     * A REQUEST WITH NO ADMISSION RULE IS NOT RACED AT ALL — see
     * `peerTailPolicy` below. That case is the un-gated public
     * GET /news/search, and the first implementation of this correction got it
     * wrong: with no relevance mode and no source constraint every clause here
     * passes, so a raw article started the grace and the public endpoint
     * quietly began returning fewer articles than before. Measured, not
     * reasoned about — the scope test caught it.
     */
    const admitsForPeerTail = (article: NewsArticle): boolean => {
      if (relevanceMode.type !== 'none' && !this.scoreByMode(article, query, relevanceMode).isRelevant) {
        return false;
      }

      if (requestedSource && !isAttributableToRequestedSource(article, requestedSource)) {
        return false;
      }

      return true;
    };

    /*
     * THE POLICY EXISTS ONLY WHEN THE REQUEST HAS SOMETHING TO ADMIT AGAINST.
     *
     * "Survives the existing admission rules" is meaningless where there are
     * none. The public search path has neither a relevance mode nor a source
     * constraint: every article it retrieves is served, so there is no such
     * thing as an inadmissible one, and a grace there would only ever mean
     * "return fewer results than before" on an endpoint that has no latency
     * defect. `undefined` restores the pre-R1 `Promise.allSettled` exactly.
     */
    const peerTailPolicy: PeerTailPolicy | undefined =
      relevanceMode.type !== 'none' || requestedSource !== undefined
        ? { admits: admitsForPeerTail, graceMs: PEER_TAIL_GRACE_MS }
        : undefined;

    const providerCall = await this.callAllProviders(searchOperation, 'search', peerTailPolicy);

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
      /*
       * REV B · A — THE CONSTRAINT MUST REACH THE CANDIDATES, NOT ONLY THE
       * SURVIVORS.
       *
       * THE EDGE THIS CLOSES. `buildResponse()` collapses cross-provider
       * duplicates BEFORE anything below it runs, and that collapse picks a
       * deterministic WINNER — better-corroborated record first, then provider
       * registration order. So when GDELT DOC carries a near-identical
       * headline to the Publisher Feed's Statistics Poland record, at equal
       * `sourcesCount`, GDELT's earlier registration rank wins and the feed
       * record is GONE before attribution is ever consulted. The constraint
       * then filtered a set the right article had already been deleted from,
       * and the reader got zero.
       *
       * WHAT THIS IS, PRECISELY. A narrowing of the CANDIDATE POOL for a
       * source-constrained request, per provider, before the merge. It is not
       * a relevance rule and it ADMITS NOTHING: `filterToRequestedSource` can
       * only remove, and every article it keeps still has to pass the same
       * unmodified relevance gate and the same unmodified admission check
       * below. Its entire effect is that a publisher the reader explicitly
       * disallowed can no longer eliminate one they explicitly asked for.
       *
       * THE GLOBAL WINNER RULE IS UNTOUCHED. This maps over the provider
       * results and never reorders them, never drops a provider entry (an
       * emptied one stays, so `results.length > 1` and `successfulProviderIds`
       * are exactly what they were, and provenance keeps telling the truth
       * about who answered), and does nothing at all when no `requestedSource`
       * was supplied — which is every ordinary request in the product.
       */
      const candidates = requestedSource
        ? results.map(({ providerId, articles }) => ({
            providerId,
            articles: filterToRequestedSource(articles, requestedSource),
          }))
        : results;

      const raw = this.buildResponse(
        candidates,
        failedProviderIds,
        limit,
        { query },
        {
          sortByRecency: true,
        },
      );

      const gated =
        relevanceMode.type === 'none'
          ? raw
          : this.applyRelevanceMode(raw, query, relevanceMode);

      /*
       * THE ADMISSION AUTHORITY, APPLIED AFTER THE GATE, AND ONLY NARROWING.
       *
       * Order is load-bearing. Relevance decides topicality; the constraint
       * then decides attribution. Reversed, the rescue's zero-count would mean
       * "the requested publisher had nothing TOPICAL or nothing AT ALL", which
       * are different facts. Both must pass, and neither can admit what the
       * other rejected.
       *
       * REV B — THIS IS NOW STRUCTURALLY REDUNDANT, AND IS KEPT ON PURPOSE.
       * The candidate narrowing above already removes every non-attributable
       * record, so this pass has nothing left to find. It stays because it,
       * not the narrowing, is the ADMISSION rule: the narrowing exists to
       * protect deduplication, and if it were ever relaxed or re-scoped, this
       * line is what still guarantees no other publisher reaches the reader.
       * One rule, still one predicate, still one authority.
       */
      return requestedSource
        ? this.applyRequestedSourceConstraint(gated, requestedSource)
        : gated;
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

        const rescueCall = await this.callProviderSet(
          fallbacks,
          searchOperation,
          /*
           * R1 — THE RESCUE OBEYS THE SAME CORRECTED RULE. It is the second
           * path that consults the fallback tier, and a peer tail there costs
           * a reader exactly what it costs here. Same scope gate, same
           * admission predicate, same constant.
           */
          this.peerTailFor('search', fallbacks, peerTailPolicy),
        );

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

    /*
     * R1-C — RETAINED-REPORTING MATCH PARITY.
     *
     * THE DEFECT. This stage asked the database for rows whose title or summary
     * CONTAINS THE WHOLE QUERY STRING contiguously, then applied the relevance
     * gate to whatever came back. For the natural-language fragments
     * AnalysisService derives, the first step could not succeed: the live Alpha
     * query "eastern Democratic Republic of Congo" is a 36-character run that no
     * headline carries. The stage ran, spent a round trip, and was structurally
     * incapable of returning anything — which is not the same as the database
     * being empty, and is why a GDELT timeout degraded to nothing at all rather
     * than to retained reporting.
     *
     * THE CORRECTION, IN TWO HALVES THAT MUST NOT BE CONFLATED.
     *
     *   SELECTION widens. `queryTerms` turns the row predicate into "any
     *   meaningful term", bounded and over-fetched so the gate has candidates
     *   to judge. This is a candidate net, not a verdict.
     *
     *   ADMISSION stays a gate, and is still made of accepted parts.
     *   `matchesRetainedQuery()` decides every term with an UNMODIFIED
     *   `scoreGenericRelevance()` and applies the counting rule lifted verbatim
     *   from `isMateriallyRelatedToAnchor()`. No new scoring exists anywhere.
     *
     * SCOPE, DELIBERATELY NARROW. Only the GENERIC mode, and only a multi-word
     * query — the shape that was impossible. A single-word query already had a
     * working whole-phrase predicate and keeps `scoreByMode()` untouched; the
     * RELATIONAL mode keeps `scoreByMode()` untouched, because X/Y decomposition
     * is a different question this term counting would answer wrongly; and
     * `relevanceMode.type === 'none'` is untouched. LIVE retrieval is not
     * affected at all — `applyRelevanceMode()` above is byte-for-byte unchanged.
     *
     * Retention window, ordering, dedup and identity, provider provenance and
     * the country/precision derivation are all downstream of this and all
     * untouched. If nothing matches, the result is still zero retained
     * articles, and the zero-evidence surface still refuses to call OpenAI.
     */
    const retainedTerms =
      relevanceMode.type === 'generic' ? extractRetainedQueryTerms(query) : undefined;

    const useTermParity =
      retainedTerms !== undefined &&
      retainedTerms.distinctive.length + retainedTerms.supporting.length >= 2;

    const cachedArticles = await this.articlePersistence.findRecent({
      query,
      limit,
      maxAgeMinutes: DATABASE_FALLBACK_MAX_AGE_MINUTES,
      ...(useTermParity ? { queryTerms: retainedCandidateTerms(retainedTerms) } : {}),
    });

    // Milestone #36/#37: the SAME gate (whichever mode is active)
    // applies to stored/persisted fallback results — live and stored
    // generic/relational results must not have inconsistent trust
    // rules. R1-C narrows that to the shape where "the same gate" was
    // unsatisfiable by construction; every other mode is unchanged.
    /*
     * REV A · 1 — THE COUNTRY GATE, APPLIED AFTER THE LEXICAL ONE.
     *
     * R1 shipped the lexical parity with a pinned, disclosed limitation: a
     * Republic of the Congo story could satisfy a Democratic Republic of Congo
     * query, because the lexical gate counts terms and has no notion of place.
     * The pin is removed and this is what replaces it.
     *
     * ORDER MATTERS AND IS DELIBERATE. The lexical gate runs first and decides
     * topicality; the country gate then removes anything whose own geography
     * contradicts the query, or whose geography cannot be established at all.
     * Both must pass. Narrowing only ever removes articles here — it can never
     * admit one the lexical gate rejected.
     *
     * SCOPE IS THE SAME AS THE PARITY IT GUARDS: the generic multi-word retained
     * path only. `type: 'none'` is untouched; the relational and single-word
     * paths keep `scoreByMode()` and are not country-gated, because R1 did not
     * widen them and this correction must not widen them either.
     *
     * Nothing is written back. `retainedCountryVerdict()` reads; it returns no
     * article and mutates none, so no query geography can reach an article's
     * precision.
     */
    const retainedQueryCountry = useTermParity
      ? resolveRetainedQueryCountry(query)
      : undefined;

    const relevantCachedArticles =
      relevanceMode.type === 'none'
        ? cachedArticles
        : useTermParity
          ? cachedArticles.filter(
              (article) =>
                matchesRetainedQuery(article, retainedTerms).isMatch &&
                retainedCountryVerdict(article, retainedQueryCountry).decision === 'admit',
            )
          : cachedArticles.filter(
              (article) => this.scoreByMode(article, query, relevanceMode).isRelevant,
            );

    /*
     * R1 REV A — THE STORED PATH IS CONSTRAINED BY THE SAME RULE.
     *
     * Milestone #36/#37 established that live and stored results must not have
     * inconsistent trust rules. A requested-publisher constraint is a trust
     * rule, so retained reporting is narrowed by exactly the same predicate
     * from exactly the same authority. Without this, a question about one
     * publisher could still be answered out of the database with another
     * publisher's stored reporting — the very substitution this correction
     * exists to make impossible.
     */
    const attributedCachedArticles = requestedSource
      ? filterToRequestedSource(relevantCachedArticles, requestedSource)
      : relevantCachedArticles;

    if (attributedCachedArticles.length === 0) {
      return attachProviderFailures(response, failures);
    }

    return attachProviderFailures(
      this.buildCachedResponse(
        attributedCachedArticles,
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
    /**
     * R1 — supplied ONLY by search(). topHeadlines() and category() pass
     * nothing and are therefore byte-for-byte unchanged.
     */
    peerTail?: PeerTailPolicy,
  ): Promise<ProviderCallResult> {
    const primaries = this.eligibleProvidersForTier(capability, 'primary');
    const fallbacks = this.eligibleProvidersForTier(capability, 'fallback');

    /*
     * R1 — THE PRIMARY FAN-OUT IS NOT IN SCOPE AND IS NOT PASSED A POLICY.
     * The defect is a FALLBACK-tier peer tail. Widening this to the primaries
     * would change the behaviour of every ordinary request in the product to
     * fix a problem none of them has.
     */
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

    const fallbackCall = await this.callProviderSet(
      fallbacks,
      operation,
      this.peerTailFor(capability, fallbacks, peerTail),
    );

    return {
      results: [...primaryCall.results, ...fallbackCall.results],
      failedProviderIds: [...primaryCall.failedProviderIds, ...fallbackCall.failedProviderIds],
      /* Accumulated like every other channel, and like every other channel it
         is the fallback set that can contribute one — a primary set is never
         given a policy, so its list is always empty. */
      notAwaitedProviderIds: [
        ...primaryCall.notAwaitedProviderIds,
        ...fallbackCall.notAwaitedProviderIds,
      ],
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
   * R1 — THE SCOPE GATE, IN ONE PLACE SO IT CANNOT DRIFT.
   *
   * A peer-tail grace is permitted only where the defect exists and only where
   * it is safe:
   *
   *   SEARCH capability   — top-headlines and category are untouched;
   *   FALLBACK tier       — the primaries are never raced (see callAllProviders);
   *   MORE THAN ONE PEER  — with a single provider there is no peer tail, so a
   *                         grace could only ever abandon the sole source of
   *                         evidence. It is refused outright rather than
   *                         relying on the admission trigger never firing.
   *
   * Returning `undefined` restores the pre-R1 `Promise.allSettled` exactly.
   */
  private peerTailFor(
    capability: NewsProviderCapability,
    peers: readonly NewsProvider[],
    policy: PeerTailPolicy | undefined,
  ): PeerTailPolicy | undefined {
    if (policy === undefined) return undefined;
    if (capability !== 'search') return undefined;
    if (peers.length < 2) return undefined;

    return policy;
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
    /**
     * R1 — ABSENT MEANS "BEHAVE EXACTLY AS BEFORE". Every existing call site
     * omits it: the primary fan-out, topHeadlines and category all reach the
     * identical `Promise.allSettled` they always did. Only the SEARCH fallback
     * tier with more than one eligible peer ever supplies a policy.
     */
    peerTail?: PeerTailPolicy,
  ): Promise<ProviderCallResult> {
    const startedAt = Date.now();

    /*
     * ── R1 · THE SEALED SNAPSHOT ──────────────────────────────────────────
     *
     * WHAT THIS STRUCTURE EXISTS TO PREVENT. A peer we stop awaiting keeps
     * running. If its continuation could still push into the arrays this
     * function has already returned, the caller's aggregation would mutate
     * underneath it — after relevance has been applied, after dedup, possibly
     * after the response was serialised. That is a data race in all but name,
     * and no test that inspects the return value would reliably catch it.
     *
     * So outcomes are recorded per peer in a Map, never appended to a shared
     * array, and `sealed` is set BEFORE the snapshot is built. JavaScript runs
     * this seal-then-build synchronously, so no continuation can interleave:
     * a peer settling after the seal takes the early return and writes
     * nothing, anywhere, ever.
     */
    const outcomes = new Map<string, { articles: NewsArticle[] } | { error: unknown }>();
    let sealed = false;

    let firstAdmittedProviderId: string | undefined;
    let graceStartedAt: number | undefined;
    let resolveGrace: (() => void) | undefined;

    const graceElapsed =
      peerTail === undefined
        ? undefined
        : new Promise<void>((resolve) => {
            resolveGrace = resolve;
          });

    /*
     * Started at most once, and ONLY by an article the request's own admission
     * rules accept — see PeerTailPolicy. A peer that returns raw records the
     * relevance gate or the source constraint will discard does not start it.
     */
    const startGraceIfAdmissible = (providerId: string, articles: NewsArticle[]): void => {
      if (peerTail === undefined || graceStartedAt !== undefined) return;
      if (!articles.some((article) => peerTail.admits(article))) return;

      firstAdmittedProviderId = providerId;
      graceStartedAt = Date.now();

      setTimeout(() => resolveGrace?.(), peerTail.graceMs).unref?.();
    };

    const settleOne = async (provider: NewsProvider): Promise<void> => {
      try {
        const articles = await operation(provider);

        if (sealed) return;

        outcomes.set(provider.id, { articles });
        startGraceIfAdmissible(provider.id, articles);
      } catch (error) {
        if (sealed) return;

        outcomes.set(provider.id, { error });
      }
    };

    const everyPeer = providers.map((provider) => {
      const settle = settleOne(provider);

      /*
       * ORPHAN SAFETY, ATTACHED AT CREATION RATHER THAN AT ABANDONMENT.
       * `settleOne` already catches the operation's own rejection, so this is
       * belt-and-braces against anything thrown by the recording itself. A
       * detached promise must never become an unhandled rejection.
       */
      settle.catch(() => {});

      return settle;
    });

    const allSettled = Promise.all(everyPeer);
    allSettled.catch(() => {});

    if (graceElapsed === undefined) {
      await allSettled;
    } else {
      await Promise.race([allSettled, graceElapsed]);
    }

    /* SEAL FIRST. Everything below reads a frozen world. */
    sealed = true;

    const results: ProviderCallResult['results'] = [];
    const failedProviderIds: string[] = [];
    const failures: ProviderFailure[] = [];
    const notAwaitedProviderIds: string[] = [];

    /*
     * Iterated in PROVIDER ORDER, exactly as the previous `settled.forEach`
     * was, because cross-provider dedup's winner rule reads registration order
     * and `results.length > 1` gates that pass. Settle order must not leak in.
     */
    for (const provider of providers) {
      const outcome = outcomes.get(provider.id);

      if (outcome === undefined) {
        notAwaitedProviderIds.push(provider.id);
        continue;
      }

      if ('articles' in outcome) {
        results.push({ providerId: provider.id, articles: outcome.articles });
        continue;
      }

      failedProviderIds.push(provider.id);

      /* The reason was already in hand here and was being thrown away. */
      const kind = resolveProviderFailureKind(outcome.error);
      failures.push({ providerId: provider.id, kind });

      logWithRequestId(
        this.logger,
        'warn',
        `Provider "${provider.id}" failed to respond [${kind}]`,
        outcome.error instanceof Error ? outcome.error : undefined,
      );
    }

    if (notAwaitedProviderIds.length > 0) {
      logWithRequestId(
        this.logger,
        'log',
        `Peer-tail grace: "${firstAdmittedProviderId}" produced admissible evidence, ` +
          `waited ${peerTail?.graceMs}ms for the tail, and did not await ` +
          `${notAwaitedProviderIds.map((id) => `"${id}"`).join(', ')}. ` +
          `Fan-out returned in ${Date.now() - startedAt}ms. ` +
          'The un-awaited peer(s) keep running under their own timeout, cooldown ' +
          'and retry rules, which this decision does not touch.',
      );
    }

    return {
      results,
      failedProviderIds,
      failures,
      notAwaitedProviderIds,
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
  /*
    ALPHA PRECISION R1 REV A — THE M1.0A PRODUCER IS WIRED BACK IN HERE, AND
    HERE ONLY.

    This is the one function BOTH article paths run through — `buildResponse`
    (live) and `buildCachedResponse` (cached) each call it — so restoring the
    derivation at this single point makes `NewsArticle.geographicPrecision` real
    on both, with no second code path to drift.

    Order is the contract: the country is resolved FIRST, from the article's own
    text, and precision is derived from the RESULT. So precision follows
    article-level evidence and can never be reached from the query, which is not
    in scope in this function at all.
  */
  private resolveArticleCountries(articles: NewsArticle[], language?: string): NewsArticle[] {
    return articles.map((article) => {
      try {
        const primary = resolvePrimaryCountry(article, language as LanguageCode | undefined);

        if (!primary) {
          /* No article-level country. UNKNOWN is the honest answer, and it is
             still an ASSESSED answer — the difference between "we looked and
             found none" and "nobody looked" is exactly what was missing. */
          return withDerivedEvidenceFields(article);
        }

        return withDerivedEvidenceFields({
          ...article,
          countryCode: primary.countryCode,
          countryName: primary.countryName,
        });
      } catch {
        return withDerivedEvidenceFields(article);
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
   * R1 REV A — narrows a response to the requested publisher, recomputing
   * totalResults to match.
   *
   * DELIBERATELY THE SAME SHAPE AS applyRelevanceMode() ABOVE, for the same
   * reason: every other field — dataMode, providers, fallbackReason,
   * generatedAt, query/category — is preserved unchanged, because `dataMode`
   * describes what the RETRIEVAL did and stays true however few of its results
   * survive an admission rule.
   *
   * ORDER IS PRESERVED, NOT RE-RANKED. This is a constraint; a constraint that
   * also reordered evidence would be making a relevance judgement the gates
   * already own. `Array.filter` can only remove.
   *
   * THE PREDICATE IS NOT DEFINED HERE. It is `isAttributableToRequestedSource`
   * in ./identity/requested-source.util.ts — curated `sourceId` or the
   * publisher's own registrable domain, never `sourceName` alone and never
   * `providerId`. One rule, one place.
   */
  private applyRequestedSourceConstraint(
    response: NewsResponse,
    requestedSource: RequestedSource,
  ): NewsResponse {
    const attributed = filterToRequestedSource(response.articles, requestedSource);

    return {
      ...response,
      articles: attributed,
      totalResults: attributed.length,
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
