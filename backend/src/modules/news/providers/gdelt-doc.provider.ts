import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NewsArticle,
  NewsCategory,
  ProviderFailureKind,
  ProviderHealthStatus,
} from '@globalnews-ai/shared';
import type { NewsProvider, NewsProviderCapability, NewsSearchOptions } from '../interfaces';
import { classifyCategory } from '../classification/classify-category.util';
import { logWithRequestId } from '../../../observability/log-with-request-id';

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * ALWAYS SENT, NEVER DEFAULTED.
 *
 * GDELT's own documented default timespan is THE LAST THREE MONTHS. A
 * request that forgets this parameter returns quarter-old articles into a
 * live news feed, which is a data-integrity failure rather than a tuning
 * mistake. So it is a constant and it is on every request.
 */
const REQUEST_TIMESPAN = '24h';

/**
 * The host's own instruction, taken literally.
 *
 * The live acceptance run received this from GDELT:
 *
 *     "Please limit requests to one every 5 seconds"
 *
 * followed later by a connection reset. Five seconds is therefore not a
 * guess at politeness — it is the published rate, stated by the endpoint
 * to this deployment. The extra 500 ms is margin for clock granularity and
 * for the fact that our timer starts when we DISPATCH while theirs starts
 * when they RECEIVE.
 */
const MIN_REQUEST_SPACING_MS = 5_500;

/**
 * How long the provider stops asking after GDELT signals distress.
 *
 * Entered on a 429 or a connection reset. Sixty seconds is long enough
 * that a burst of traffic cannot walk straight back into the same wall,
 * and short enough that a transient blip does not cost the whole session.
 * During cooldown the provider fails fast WITHOUT a network request.
 */
const COOLDOWN_MS = 60_000;

/**
 * GDELT DOC 2.0 language values are FULL ENGLISH NAMES, not codes.
 *
 * This is not an assumption. The captured live payload carried
 * "Turkish", "Portuguese" and "Korean" — and the sourcecountry field
 * carried "Turkey", "Brazil", "Germany", "South Korea" in the same
 * records.
 *
 * THIS MAP IS DELIBERATELY SMALL AND DELIBERATELY INCOMPLETE. It covers
 * the languages this product actually reasons about plus the ones the
 * capture proved GDELT emits. A name that is not here maps to UNDEFINED
 * — never to a guessed code, and never to a truncation of the name. That
 * is the same rule GNewsProvider.mapSourceLanguage already follows, for
 * the same reason: `NewsArticle.sourceLanguage` is consumed as a real
 * language identifier, and a wrong one is worse than an absent one.
 *
 * Growing this map is a deliberate act with evidence attached, not
 * something to do speculatively.
 */
const GDELT_LANGUAGE_NAME_TO_CODE: Readonly<Record<string, string>> = Object.freeze({
  arabic: 'ar',
  chinese: 'zh',
  dutch: 'nl',
  english: 'en',
  french: 'fr',
  german: 'de',
  hindi: 'hi',
  indonesian: 'id',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  polish: 'pl',
  portuguese: 'pt',
  russian: 'ru',
  spanish: 'es',
  swahili: 'sw',
  turkish: 'tr',
  ukrainian: 'uk',
  vietnamese: 'vi',
});

/** One article object as GDELT DOC 2.0 ArtList actually returns it. */
interface GdeltDocArticle {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltDocResponse {
  articles?: GdeltDocArticle[];
}

/** Raised for any GDELT-DOC-specific failure. Carries a machine-readable kind. */
export class GdeltDocProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly kind: ProviderFailureKind = 'unknown',
  ) {
    super(message);
    this.name = 'GdeltDocProviderError';
  }
}

/**
 * R4 — GDELT DOC 2.0 as GlobalNews AI's SECOND REAL NEWS PROVIDER.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────
 *
 * GNews's Free plan reached 100/100 requests and live Analysis stopped
 * while cached headlines kept displaying. One real provider is a single
 * point of failure for the only thing this product does. This is the
 * second one.
 *
 * It is a FALLBACK, not a peer. `news.module.ts` registers it with
 * `tier: 'fallback'`, so NewsService calls it only when the primary
 * produced no articles at all. It is not consulted to corroborate a
 * healthy GNews response, because that would spend a request and 8
 * seconds of worst-case latency on a second opinion nobody asked for.
 *
 * ── SEARCH ONLY, AND THE REFUSALS ARE REAL ────────────────────────────
 *
 * `capabilities = ['search']`. GDELT DOC 2.0 has ONE endpoint: document
 * search. It has no editorial top-headlines concept and no category
 * concept.
 *
 * `sort=DateDesc` over a short window would LOOK like top headlines and
 * would be recency, not prominence. Presenting one as the other is a
 * fabrication, so `topHeadlines()` and `category()` throw instead — and
 * because the capability declaration means NewsService never calls them,
 * those throws are unreachable in production rather than a failure mode.
 * They exist so a future caller that bypasses the capability check gets a
 * loud error rather than a plausible lie.
 *
 * ── THE TIMESTAMP, WHICH IS THE DELICATE PART ─────────────────────────
 *
 * GDELT returns `seendate`: the time GDELT SAW the article. The CTO's
 * live capture measured the difference rather than assuming it:
 *
 *     Haberler record   seendate  20260826T074500Z          07:45 UTC
 *     publisher page              26.08.2026 09:50 (TR)   ≈ 06:50 UTC
 *
 * GDELT observed it about 55 minutes after publication. Close enough to
 * pass for clock skew; far enough to be a lie. So every article this
 * provider emits carries `publishedAtBasis: 'observed'`, and downstream:
 *
 *   - identity rung 3 refuses to compare it against a publisher-basis
 *     timestamp (article-identity.util.ts);
 *   - persistence refuses to store it, because the Article table has no
 *     column to record what kind of time it is
 *     (article-persistence.service.ts);
 *   - the UI renders it as "Seen 3h ago", never "Published 3h ago".
 *
 * ── WHAT IS DELIBERATELY NOT MAPPED ───────────────────────────────────
 *
 *   sourcecountry  The country of the PUBLISHING OUTLET. It is not the
 *                  event country, not the subject country, and not
 *                  evidence geography. A Reuters piece about Kenya filed
 *                  from London is "United Kingdom" here. It is carried
 *                  NOWHERE — not to countryCode, not to countryName.
 *
 *   url_mobile     A second address for the SAME article. Mapping it
 *                  anywhere that contributes to identity would let one
 *                  article become two. It is read and discarded. The
 *                  capture also proved it is often an empty string, which
 *                  is another reason not to build anything on it.
 *
 *   summary        ArtList returns no summary or snippet. The field is
 *                  required by NewsArticle, so it is an empty string. It
 *                  is NOT back-filled from the title — that would
 *                  fabricate a distinct field out of one we already have
 *                  — and the page is not fetched to synthesise one.
 *
 *   providerRecordId  GDELT supplies no identifier distinct from `url`,
 *                  and `url` already derives `id`. Inventing a second id
 *                  from the same field would be fabricated provenance.
 */
@Injectable()
export class GdeltDocProvider implements NewsProvider {
  readonly id = 'gdelt-doc';
  readonly displayName = 'GDELT DOC';
  readonly isMock = false;

  /**
   * SEARCH ONLY. See the class comment. This declaration is what stops
   * NewsService from ever asking for headlines or categories, which is
   * what makes the refusals below unreachable rather than load-bearing.
   */
  readonly capabilities: readonly NewsProviderCapability[] = ['search'];

  private readonly logger = new Logger(GdeltDocProvider.name);

  /** Dispatch time of the last request. Drives MIN_REQUEST_SPACING_MS. */
  private lastRequestStartedAt = 0;

  /** Serialises the spacing wait, so N concurrent callers queue rather than race. */
  private spacingChain: Promise<void> = Promise.resolve();

  /**
   * Serialises COMPLETE requests, not only their start times.
   *
   * Live Alpha exposed a hole in the old spacing-only queue: six different
   * regional queries all passed the cooldown check before the first request
   * timed out. They were spaced 5.5 seconds apart, but each still opened a
   * socket, so one outage became a train of slow timeouts. A provider that has
   * asked us for one request every five seconds is safer with at most one
   * request in flight; once that request times out and opens cooldown, queued
   * callers fail fast without touching the network.
   */
  private executionChain: Promise<void> = Promise.resolve();

  /** Epoch ms until which the circuit is open. 0 means closed. */
  private cooldownUntil = 0;

  /**
   * REV A — WHY THE CIRCUIT IS OPEN.
   *
   * The circuit used to remember only WHEN it closes, so every message it
   * produced had to guess at a cause and guessed the same one every time:
   * "GDELT asked for slower requests", "after a throttle or reset". After R1-A
   * a timeout opens the circuit too, and GDELT asked for nothing — the request
   * simply did not come back inside our own 8 s deadline. Reporting that as
   * upstream rate limiting invents an accusation against the endpoint and
   * sends an operator looking for a quota problem that does not exist.
   *
   * This is the SMALLEST state that fixes it: one private field, three values,
   * never exported, never serialised. The shared `ProviderFailureKind`
   * taxonomy is untouched — this only decides WHICH existing kind and which
   * wording a cooling refusal carries.
   *
   * `undefined` means a circuit whose cause was not recorded. That is not
   * reachable through this class's own API — every `openCooldown()` call site
   * passes a cause — but a test that sets `cooldownUntil` directly produces it,
   * and the honest answer there is the pre-R1 behaviour rather than a claim
   * this object cannot support.
   */
  private cooldownCause: 'rate-limit' | 'timeout' | 'transport' | undefined;

  /**
   * The single in-flight request per query key.
   *
   * CONCURRENCY COLLAPSE. Twenty readers asking the same question during a
   * GNews outage must produce ONE GDELT request, not twenty. Callers that
   * arrive while a request for the same key is in flight await that
   * request instead of issuing their own.
   */
  private readonly inFlight = new Map<string, Promise<NewsArticle[]>>();

  private requestCount = 0;
  private failureCount = 0;
  private lastLatencyMs: number | undefined;
  private lastSuccessAt: string | undefined;
  private rateLimitState: 'ok' | 'throttled' | 'unknown' = 'unknown';

  constructor(private readonly config: ConfigService) {}

  async search(query: string, options?: NewsSearchOptions): Promise<NewsArticle[]> {
    const safeQuery = this.buildQueryExpression(query, options?.lang);

    /*
     * FAIL BEFORE THE WIRE. A query that reduces to nothing safe cannot
     * be asked, so no request is made at all — the same discipline the
     * signals GDELT adapter uses for an unresolvable country. Returning
     * [] rather than throwing is correct: there is no evidence, and that
     * is not a provider failure.
     */
    if (safeQuery === null) {
      return [];
    }

    const limit = this.clampLimit(options?.limit);
    const key = `${safeQuery}::${limit}`;

    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const request = this.fetchArticles(safeQuery, limit).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, request);

    return request;
  }

  /**
   * NOT SUPPORTED, AND SAYING SO IS THE POINT.
   *
   * Unreachable in production: `capabilities` excludes 'top-headlines',
   * so NewsService never calls this. It throws rather than returning []
   * because a silent empty array from a method that should never have
   * been called is a bug that hides itself.
   */
  async topHeadlines(): Promise<NewsArticle[]> {
    throw new GdeltDocProviderError(
      'GDELT DOC 2.0 has no top-headlines endpoint. Sorting a search by date is recency, ' +
        'not editorial prominence, and this provider will not present one as the other.',
      undefined,
      'unknown',
    );
  }

  /** NOT SUPPORTED. GDELT DOC 2.0 has no category concept. See topHeadlines(). */
  async category(): Promise<NewsArticle[]> {
    throw new GdeltDocProviderError(
      'GDELT DOC 2.0 has no category endpoint, and classifying a whole feed to satisfy the ' +
        'interface would invent an editorial taxonomy GDELT does not publish.',
      undefined,
      'unknown',
    );
  }

  /**
   * Health WITHOUT a live probe, deliberately.
   *
   * GNewsProvider.health() spends a real request on a 1-result call. This
   * provider must not: it is rate-limited to one request every five
   * seconds, and an admin page refresh would then compete with the actual
   * fallback traffic for that budget — the health check would cause the
   * throttling it is meant to observe.
   *
   * So health reports what this process has genuinely MEASURED while
   * serving. Counters that have never been measured stay ABSENT, and
   * AdminNewsService renders absent as UNKNOWN rather than 0.
   */
  async health(): Promise<ProviderHealthStatus> {
    const checkedAt = new Date().toISOString();

    if (!this.isEnabled()) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'down',
        message: 'GDELT_DOC_ENABLED is not set to "true". This provider is switched off.',
        checkedAt,
        /*
         * G-ALPHA-1 D3 — DELIBERATELY OFF IS NOT THE SAME CONDITION AS BROKEN.
         *
         * ProviderHealthState has three members — ok, degraded, down — and a
         * switched-off provider and an unreachable one both land on 'down'.
         * Read from the live Alpha, that is exactly how this provider appeared:
         * indistinguishable from a failure, which is how a configuration
         * omission was able to look like an outage.
         *
         * ProviderHealthStatus ALREADY declares `enabled?: boolean`, documented
         * as "distinct from health/reachability" — the vocabulary existed and
         * was simply never populated. Populating it is a strictly additive,
         * backward-compatible change: no shared contract is altered, `status`
         * keeps its exact previous value so no existing consumer changes
         * behaviour, and a reader that wants the difference can now find it.
         */
        enabled: false,
      };
    }

    const cooling = Date.now() < this.cooldownUntil;

    /*
     * R1-B — "NEVER WORKED" IS A HEALTH STATE, AND IT WAS REPORTING AS 'ok'.
     *
     * `status` used to derive from `cooldownUntil` ALONE. Because a timeout
     * armed no circuit (see R1-A), a provider that had been asked N times,
     * failed N times and never once succeeded reported:
     *
     *     status 'ok' · enabled true · failureCount N · lastSuccessAt ABSENT
     *
     * Every fact needed to contradict that was already on the object. Nothing
     * was reading them.
     *
     * `lastSuccessAt` IS THE ANCHOR, DELIBERATELY, AND NOT THE COUNTERS. It is
     * set at exactly one place — after a response parses — so its absence is an
     * unambiguous "nothing has ever worked". Counter arithmetic cannot say that
     * cleanly: `requestCount` increments BEFORE the wire and `failureCount`
     * only after a failure resolves, so a request in flight makes
     * `failureCount === requestCount` briefly false and an equality test would
     * flicker back to 'ok' mid-request. `failureCount > 0` then adds the other
     * half — that we have evidence of failure and are not merely mid-first-call.
     *
     * THIS INVENTS NO TELEMETRY. `degraded` is an existing ProviderHealthState
     * member, already used for cooldown; `enabled` already distinguishes
     * switched-off from broken (G-ALPHA-1 D3). No counter, no field and no probe
     * is added — this reads what the provider was already recording. In
     * particular it still spends NO request: the no-live-probe rule that exists
     * because this provider is rate-limited is untouched.
     *
     * WHY IT OUTLIVES THE COOLDOWN. Cooldown clears after COOLDOWN_MS; "has
     * never succeeded" clears only when something actually succeeds. That gap is
     * the whole point — an operator looking 60 s after the last timeout must
     * still see a provider that has never served an article.
     */
    const neverSucceeded =
      this.requestCount > 0 && this.failureCount > 0 && this.lastSuccessAt === undefined;

    return {
      providerId: this.id,
      displayName: this.displayName,
      status: cooling || neverSucceeded ? 'degraded' : 'ok',
      message: cooling
        ? this.coolingMessage()
        : neverSucceeded
          ? `GDELT DOC is enabled and reachable in configuration, but no request has ever succeeded (${this.failureCount} of ${this.requestCount} attempted failed, no recorded success).`
          : 'GDELT DOC is enabled. Status reflects observed request outcomes, not a live probe.',
      checkedAt,
      /*
       * G-ALPHA-1 D3 — the other half of the same fact. A provider in cooldown
       * is ENABLED and temporarily degraded, which is a third condition again,
       * and reporting it as enabled keeps 'degraded' meaning what it says.
       */
      enabled: true,
      requestCount: this.requestCount,
      failureCount: this.failureCount,
      ...(this.lastLatencyMs === undefined ? {} : { lastLatencyMs: this.lastLatencyMs }),
      ...(this.lastSuccessAt === undefined ? {} : { lastSuccessAt: this.lastSuccessAt }),
      /*
       * REV A — 'throttled' is a statement that GDELT rate-limited us, so it is
       * asserted ONLY when GDELT actually said so. A timeout- or
       * transport-opened circuit reports whatever the last OBSERVED rate-limit
       * state was, which is honest ignorance rather than a false accusation.
       * An unrecorded cause keeps the pre-R1 answer.
       */
      rateLimitState:
        cooling && (this.cooldownCause === 'rate-limit' || this.cooldownCause === undefined)
          ? 'throttled'
          : this.rateLimitState,
    };
  }

  /** Cooling wording that matches the recorded cause. Never invents a throttle. */
  private coolingMessage(): string {
    switch (this.cooldownCause) {
      case 'timeout':
        return 'A GDELT request timed out; this provider is in cooldown and is not being called. GDELT did not report a rate limit.';
      case 'transport':
        return 'A GDELT request failed to reach the endpoint; this provider is in cooldown and is not being called. GDELT did not report a rate limit.';
      case 'rate-limit':
        return 'GDELT asked for slower requests; this provider is in cooldown and is not being called.';
      default:
        return 'This provider is in cooldown and is not being called.';
    }
  }

  private isEnabled(): boolean {
    const raw = this.config.get<string>('GDELT_DOC_ENABLED');
    return typeof raw === 'string' && raw.trim().toLowerCase() === 'true';
  }

  /**
   * BUILD THE QUERY FROM SEMANTIC TERMS, NEVER FROM RAW USER TEXT.
   *
   * GDELT has its own operator syntax — quoted phrases, `sourcelang:`,
   * `domain:`, boolean forms. Concatenating a reader's punctuation into
   * that grammar is how a question mark or a stray quote becomes either a
   * syntax error or, worse, an operator nobody intended.
   *
   * So the query is reduced to alphanumeric-and-space TERMS, capped in
   * count and length, and reassembled. Every character GDELT could read
   * as syntax is removed rather than escaped: escaping needs a model of
   * the remote grammar, and we do not have a proven one.
   *
   * Returns null when nothing safe survives, so the caller can decline to
   * make a request at all.
   */
  private buildQueryExpression(query: string, lang?: string): string | null {
    const terms = (query ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/u)
      .filter((term) => term.length > 1)
      .slice(0, 12);

    if (terms.length === 0) {
      return null;
    }

    const expression = terms.join(' ');

    /*
     * `sourcelang:` is appended ONLY for a language this provider can map
     * back again. Sending a filter we could not interpret in the response
     * would mean constraining retrieval on a term we do not understand.
     */
    const languageName = this.gdeltLanguageNameFor(lang);

    return languageName === undefined ? expression : `${expression} sourcelang:${languageName}`;
  }

  /** The GDELT-side spelling for one of our 2-letter codes, or undefined. */
  private gdeltLanguageNameFor(lang: string | undefined): string | undefined {
    const code = lang?.trim().toLowerCase();
    if (!code) return undefined;

    for (const [name, mapped] of Object.entries(GDELT_LANGUAGE_NAME_TO_CODE)) {
      if (mapped === code) return name;
    }

    return undefined;
  }

  private async fetchArticles(expression: string, limit: number): Promise<NewsArticle[]> {
    if (!this.isEnabled()) {
      throw new GdeltDocProviderError('GDELT DOC is not enabled.', undefined, 'unknown');
    }

    return this.runSerialized(async () => {
      /*
       * COOLDOWN IS CHECKED TWICE: once after acquiring the complete-request
       * lease and again after the spacing wait. The second check is load-bearing:
       * another request can open the circuit while this caller is queued.
       */
      if (Date.now() < this.cooldownUntil) {
        throw this.cooldownRefusal();
      }

      await this.awaitRequestSlot();

      if (Date.now() < this.cooldownUntil) {
        throw this.cooldownRefusal();
      }

      const url = new URL(GDELT_DOC_URL);
    url.searchParams.set('query', expression);
    url.searchParams.set('mode', 'ArtList');
    url.searchParams.set('format', 'json');
    url.searchParams.set('timespan', REQUEST_TIMESPAN);
    url.searchParams.set('maxrecords', String(limit));
    url.searchParams.set('sort', 'DateDesc');

    const startedAt = Date.now();
    this.requestCount += 1;

    const controller = new AbortController();

    /*
     * R1-A — WHOSE ABORT WAS IT.
     *
     * `AbortError` says a request was aborted; it does not say BY WHOM. Today
     * this controller has exactly one trigger — the deadline below — so every
     * AbortError on this path is our own timeout. That is true by construction
     * and not worth relying on: the moment a caller-supplied signal is threaded
     * in, an abort would mean "the reader navigated away", which is not GDELT
     * signalling distress and must not arm a circuit against it.
     *
     * So the deadline records that IT fired. Cooldown is opened on this flag,
     * never on the error name alone.
     */
    let deadlineFired = false;
    const timeout = setTimeout(() => {
      deadlineFired = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), { signal: controller.signal });
    } catch (error) {
      this.failureCount += 1;

      if (error instanceof Error && error.name === 'AbortError') {
        /*
         * R1-A — A TIMEOUT IS DISTRESS, AND THE OLD CODE READ IT AS IMPATIENCE.
         *
         * This branch used to return here, BEFORE openCooldown(). The reasoning
         * was defensible: a timeout can be our own 8 s deadline being hasty
         * against a healthy endpoint, and punishing GDELT for that would be
         * wrong. What it missed is that the provider never counted them, so it
         * could not tell one hasty deadline from a host that accepts the socket
         * and never answers. Live Alpha showed the consequence: the next
         * analysis walked straight back into the same wall, now additionally
         * paying MIN_REQUEST_SPACING_MS for the privilege.
         *
         * Timing out IS the endpoint failing to serve us inside the budget we
         * published, which is the same operational fact a reset expresses more
         * rudely. It opens the circuit for the same COOLDOWN_MS as every other
         * distress signal, and for the same reason: so the next caller fails
         * fast and free rather than spending another 8 s discovering it.
         *
         * WHAT DOES NOT CHANGE. There is no retry — not here, not anywhere in
         * this provider. The failure kind stays 'timeout', because 'timeout' is
         * what happened and NewsService's taxonomy, the public fallback reason
         * and the Analysis diagnostic channel all continue to read it as such.
         * Only the circuit moves.
         */
        if (deadlineFired) {
          this.openCooldown('timeout', 'request timeout');
        }

        throw new GdeltDocProviderError('GDELT DOC request timed out.', error, 'timeout');
      }

      /*
       * A connection reset is how GDELT expressed displeasure to the live
       * host after repeated requests, so an unreachable outcome opens the
       * circuit too. Treating it as an ordinary network blip and trying
       * again shortly is precisely the behaviour that earned the reset.
       */
      this.openCooldown('transport', 'connection failure');
      throw new GdeltDocProviderError('Failed to reach GDELT DOC.', error, 'unreachable');
    } finally {
      clearTimeout(timeout);
    }

    this.lastLatencyMs = Date.now() - startedAt;

    if (response.status === 429) {
      this.failureCount += 1;
      this.openCooldown('rate-limit', 'HTTP 429');
      throw new GdeltDocProviderError('GDELT DOC rate limit exceeded.', undefined, 'rate-limited');
    }

    if (!response.ok) {
      this.failureCount += 1;
      throw new GdeltDocProviderError(
        `GDELT DOC responded with status ${response.status}.`,
        undefined,
        'unknown',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      this.failureCount += 1;
      /*
       * GDELT answers a throttled caller with a PLAIN-TEXT sentence
       * ("Please limit requests to one every 5 seconds") and HTTP 200,
       * not a 429. So a non-JSON body from this endpoint is a throttle
       * signal as often as it is corruption, and the safe reading is to
       * back off rather than to retry into the same wall.
       */
      this.openCooldown('rate-limit', 'non-JSON response body');
      throw new GdeltDocProviderError(
        'GDELT DOC returned a malformed (non-JSON) response.',
        error,
        'malformed',
      );
    }

    const articles = this.normalize(payload);

      this.lastSuccessAt = new Date().toISOString();
      this.rateLimitState = 'ok';

      return articles;
    });
  }

  /**
   * Runs one COMPLETE GDELT request at a time. The queue itself never throws:
   * each holder releases in finally, so one failing request cannot wedge every
   * future caller behind it.
   */
  private async runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    let release: (() => void) | undefined;
    const previous = this.executionChain;

    this.executionChain = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await operation();
    } finally {
      release?.();
    }
  }

  /**
   * ONE REQUEST EVERY MIN_REQUEST_SPACING_MS, PROCESS-WIDE.
   *
   * Chained rather than checked: each caller appends its wait to the
   * previous one's, so ten simultaneous callers are spaced from each
   * other rather than all observing the same stale `lastRequestStartedAt`
   * and departing together. That check-then-act race is exactly how a
   * "rate limiter" ends up issuing a burst.
   */
  private async awaitRequestSlot(): Promise<void> {
    const wait = this.spacingChain.then(async () => {
      const since = Date.now() - this.lastRequestStartedAt;
      const remaining = MIN_REQUEST_SPACING_MS - since;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      this.lastRequestStartedAt = Date.now();
    });

    // Keep the chain alive even if a link rejects, so one failure cannot
    // wedge every future caller.
    this.spacingChain = wait.catch(() => undefined);

    await wait;
  }

  /**
   * REV A — the cause is recorded, and only a PROVEN throttle moves
   * `rateLimitState`.
   *
   * `rateLimitState` is a claim about what the REMOTE SIDE said. A 429 and a
   * plain-text "limit requests to one every 5 seconds" body are GDELT saying
   * it; a socket that never answered and a transport failure are not. Setting
   * 'throttled' for those was the provider asserting something it had not
   * observed. COOLDOWN_MS is unchanged at 60 s.
   */
  private openCooldown(cause: 'rate-limit' | 'timeout' | 'transport', reason: string): void {
    this.cooldownUntil = Date.now() + COOLDOWN_MS;
    this.cooldownCause = cause;

    if (cause === 'rate-limit') {
      this.rateLimitState = 'throttled';
    }

    logWithRequestId(
      this.logger,
      'warn',
      `GDELT DOC entering ${COOLDOWN_MS}ms cooldown after ${reason}. No retry will be issued.`,
    );
  }

  /** The truthful refusal for an open circuit, by recorded cause. */
  private cooldownRefusal(): GdeltDocProviderError {
    switch (this.cooldownCause) {
      case 'timeout':
        return new GdeltDocProviderError(
          'GDELT DOC is in cooldown after a request timeout. The endpoint did not respond ' +
            'within the request deadline; it did not report a rate limit.',
          undefined,
          'timeout',
        );
      case 'transport':
        return new GdeltDocProviderError(
          'GDELT DOC is in cooldown after a connection failure. The endpoint was unreachable; ' +
            'no rate limit was reported.',
          undefined,
          'unreachable',
        );
      case 'rate-limit':
        return new GdeltDocProviderError(
          'GDELT DOC is in cooldown after GDELT reported a rate limit.',
          undefined,
          'rate-limited',
        );
      default:
        return new GdeltDocProviderError(
          'GDELT DOC is in cooldown and is not being called.',
          undefined,
          'rate-limited',
        );
    }
  }

  /**
   * WHAT SURVIVES NORMALIZATION.
   *
   * A record is dropped whole unless it has a usable url, a usable title
   * and a PARSEABLE seendate. Partial articles are never emitted: the
   * fields are required by the contract, and filling one in from another
   * is the fabrication this whole file is arranged to avoid.
   */
  private normalize(payload: unknown): NewsArticle[] {
    if (payload === null || typeof payload !== 'object') {
      throw new GdeltDocProviderError(
        'GDELT DOC returned a payload that is not an object.',
        undefined,
        'malformed',
      );
    }

    const raw = (payload as GdeltDocResponse).articles;

    /*
     * AN ABSENT `articles` KEY IS AN EMPTY RESULT SET, NOT AN ERROR.
     * "No documents matched" is an ordinary, truthful answer from a
     * search endpoint, and treating it as a provider failure would put a
     * healthy provider into failedProviderIds and skew fallbackReason
     * toward 'provider-error' when nothing was wrong.
     */
    if (raw === undefined || raw === null) {
      return [];
    }

    if (!Array.isArray(raw)) {
      throw new GdeltDocProviderError(
        'GDELT DOC returned a non-array "articles" field.',
        undefined,
        'malformed',
      );
    }

    const articles: NewsArticle[] = [];

    for (const entry of raw) {
      const article = this.toArticle(entry);
      if (article !== null) {
        articles.push(article);
      }
    }

    return articles;
  }

  private toArticle(raw: GdeltDocArticle | null | undefined): NewsArticle | null {
    if (raw === null || typeof raw !== 'object') return null;

    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';

    if (url.length === 0 || title.length === 0) return null;

    const publishedAt = this.parseSeenDate(raw.seendate);
    if (publishedAt === null) return null;

    const domain = typeof raw.domain === 'string' ? raw.domain.trim() : '';

    /*
     * `socialimage` is an ARTICLE IMAGE CANDIDATE and nothing more. It is
     * whatever the page offered for social sharing. It is not verified
     * imagery of a place, it establishes no location, and it must never
     * reach a geographic surface or set a precision claim. An empty
     * string becomes undefined — honest absence rather than a broken src.
     */
    const socialImage = typeof raw.socialimage === 'string' ? raw.socialimage.trim() : '';

    /*
     * `url_mobile` is READ AND DISCARDED, on purpose. It addresses the
     * same article as `url`, so letting it reach `url`, `id` or anything
     * identity-bearing would let one article become two. The capture also
     * showed it is frequently "".
     */

    return {
      id: this.buildStableId(url),
      title,
      // ArtList carries no summary. Empty, never synthesised from the
      // title and never fetched from the page.
      summary: '',
      url,
      imageUrl: socialImage.length > 0 ? socialImage : undefined,
      sourceId: this.slugify(domain),
      sourceName: domain.length > 0 ? domain : 'Unknown source',
      // The same classifier GNews uses, over the only truthful text we
      // have. Never defaulted to 'world'.
      category: classifyCategory({ title, summary: '' }) as NewsCategory,
      sourcesCount: 1,
      publishedAt,
      // THE LOAD-BEARING FIELD. See the class comment.
      publishedAtBasis: 'observed' as const,
      providerId: this.id,
      // providerRecordId deliberately absent: GDELT supplies no id
      // distinct from `url`, which already derives `id`.
      sourceLanguage: this.mapSourceLanguage(raw.language),
      // sourcecountry is NOT mapped. It is the outlet's country, not the
      // story's, and nothing here may turn it into geography.
    };
  }

  /**
   * `seendate` arrives as GDELT's compact UTC form, proven by the live
   * capture: "20260826T074500Z".
   *
   * Parsed EXPLICITLY rather than handed to `new Date(...)`, because
   * Date's behaviour on non-ISO strings is implementation-defined and a
   * silent misparse here would produce a confidently wrong timestamp. A
   * string that does not match the proven shape yields null and the whole
   * record is dropped — the same fail-closed rule GNews applies.
   */
  private parseSeenDate(seendate: string | undefined): string | null {
    const value = typeof seendate === 'string' ? seendate.trim() : '';

    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
    if (match === null) return null;

    const [, year, month, day, hour, minute, second] = match;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;

    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return null;

    // Round-trip guard: rejects a syntactically valid but impossible date
    // such as month 13 or day 32, which Date.parse would silently roll over.
    const normalized = new Date(parsed).toISOString();
    return normalized === iso ? iso : null;
  }

  /** Full English language name -> 2-letter code, or undefined. Never guessed. */
  private mapSourceLanguage(language: string | undefined): string | undefined {
    const name = language?.trim().toLowerCase();
    if (!name) return undefined;

    return GDELT_LANGUAGE_NAME_TO_CODE[name];
  }

  /** Deterministic id derived from the article URL, mirroring GNewsProvider. */
  private buildStableId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i += 1) {
      hash = (hash * 31 + url.charCodeAt(i)) | 0;
    }
    return `gdelt-doc-${Math.abs(hash)}`;
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'gdelt-doc'
    );
  }

  private clampLimit(requested: number | undefined): number {
    if (!requested || requested < 1) return DEFAULT_LIMIT;
    return Math.min(requested, MAX_LIMIT);
  }
}
