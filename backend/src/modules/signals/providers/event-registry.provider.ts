import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeoSignal, GeoSignalQueryOptions, ProviderHealthStatus } from '@globalnews-ai/shared';
import type { SignalProvider } from '../interfaces';
import { logWithRequestId } from '../../../observability/log-with-request-id';

const DEFAULT_BASE_URL = 'https://eventregistry.org/api/v1/event/getEvents';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT = 25;
/** M64.4 — Event Registry's own documented maximum for eventsCount, confirmed from the official OpenAPI spec (distinct from the /article endpoint's separate 100 cap). */
const MAX_LIMIT = 50;
/**
 * M64.4 — a fixed, internal, non-caller-facing keyword used only by
 * health()'s own cheap live check. Never exposed as a default for
 * discoverSignals() — every real caller must still supply their own
 * non-blank query, or the request rejects before any network call.
 */
const HEALTH_CHECK_KEYWORD = 'news';

interface EventRegistryEvent {
  uri?: string;
  eventDate?: string;
  totalArticleCount?: number;
  sentiment?: number | null;
  [key: string]: unknown;
}

interface EventRegistryEventsEnvelope {
  events?: {
    totalResults?: number;
    page?: number;
    count?: number;
    pages?: number;
    results?: EventRegistryEvent[];
  };
}

/** Raised for any Event Registry-specific failure (disabled, missing key, unsupported option, missing query, timeout, rate limit, auth failure, malformed payload). */
export class EventRegistryProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    /** M64.4 — set true only when this error was raised because Event Registry responded 429, so health() can distinguish a throttled failure from any other failure — mirrors GdeltProviderError's own isRateLimit flag exactly. */
    public readonly isRateLimit = false,
  ) {
    super(message);
    this.name = 'EventRegistryProviderError';
  }
}

/**
 * M64.4 — enabled/disabled gate for Event Registry specifically.
 * Whitespace-safe: only the exact string "true" (trimmed,
 * case-insensitive) counts as enabled — mirrors isGdeltEnabled's own
 * documented reasoning (provider.tokens.ts) exactly. Defined here
 * rather than in provider.tokens.ts because this round's authorized
 * scope does not include modifying that file.
 */
export function isEventRegistryEnabled(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase() === 'true';
}

/**
 * M64.4 — whitespace-safe API-key usability check, mirroring
 * isUsableGNewsApiKey's exact reasoning (a whitespace-only value is
 * truthy in JavaScript but is not a usable key).
 */
export function isUsableEventRegistryApiKey(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * M64.4 — real signal provider backed by the Event Registry API
 * (https://eventregistry.org/api/v1/event/getEvents), events
 * resultType.
 *
 * QUERY CONTRACT — verified against the official, current OpenAPI
 * spec (eventregistry.org/static/api.yaml) before implementation:
 * `keyword` is the real, documented free-text parameter (confirmed
 * `type: array of string`, documented example "Barack Obama") — NOT
 * the structured `query` object parameter, which takes resolved URIs
 * (conceptUri/sourceUri/locationUri), not free text, and explicitly
 * overrides `keyword` if both are set. GeoSignalQueryOptions.query
 * maps to a single-element `keyword` array.
 *
 * HONEST REJECTION, NOT SILENT DROPPING — every one of these fails
 * with a clear EventRegistryProviderError, before any network call:
 *   - options.query missing or blank: Event Registry requires some
 *     query to return anything; this provider never performs an
 *     unrestricted global event request.
 *   - options.countryCode supplied: Event Registry's location filters
 *     take a resolved Wikipedia-style location URI, not an ISO2 code.
 *     This version does not perform that resolution and will not
 *     fabricate a URI from a country code.
 *   - options.eventType supplied: no deterministic mapping exists
 *     from an arbitrary eventType string to an Event Registry
 *     concept/category (verified: the official docs' own Event
 *     schema and its example JSON disagree on categories' shape,
 *     and concepts are an unordered list, not a single canonical type).
 *
 * GEOGRAPHY LEFT UNDEFINED — the official Event data-model
 * documentation and the official OpenAPI schema disagree on
 * `location`'s exact shape (a rich country/place object with
 * lat/long in the wiki's example JSON vs. a minimal {type, label}
 * object in the formal schema). Rather than guess which is
 * authoritative, countryCode/latitude/longitude are never populated
 * by this adapter version — never downgraded to a fabricated country
 * centroid.
 *
 * FIELD-VERIFICATION LIMITATION, same as GdeltProvider: outbound
 * network access is unavailable in the implementation environment
 * (confirmed repeatedly: the sandbox's network egress allowlist
 * rejects external hosts), so no live Event Registry response was
 * directly inspected before this code was written. A live smoke test
 * before production deployment is strongly recommended.
 */
@Injectable()
export class EventRegistryProvider implements SignalProvider {
  readonly id = 'event-registry';
  readonly displayName = 'Event Registry';
  readonly isMock = false;

  private readonly logger = new Logger(EventRegistryProvider.name);

  // M64.4 — process-lifetime counters, per the M64.1 ProviderHealthStatus contract's own documented semantics.
  private requestCount = 0;
  private failureCount = 0;
  private recordsRetrieved = 0;
  private recordsAccepted = 0;
  private lastLatencyMs: number | undefined;
  private lastSuccessAt: string | undefined;
  private lastRateLimitState: 'ok' | 'throttled' | 'unknown' = 'unknown';

  constructor(private readonly config: ConfigService) {}

  async discoverSignals(options?: GeoSignalQueryOptions): Promise<GeoSignal[]> {
    if (options?.countryCode) {
      throw new EventRegistryProviderError(
        'Country-code filtering is unsupported by this adapter version. Event Registry requires a resolved location URI, not an ISO2 code, and this version does not perform that resolution or fabricate one.',
      );
    }

    if (options?.eventType) {
      throw new EventRegistryProviderError(
        'Event-type filtering is unsupported by this adapter version. No deterministic mapping from an arbitrary eventType string to an Event Registry concept/category exists.',
      );
    }

    const query = options?.query?.trim();
    if (!query) {
      throw new EventRegistryProviderError(
        'Event Registry requires a non-blank query. This adapter never performs an unrestricted global event request.',
      );
    }

    if (!this.isEnabled()) {
      throw new EventRegistryProviderError('Event Registry is disabled via configuration.');
    }

    const apiKey = this.requireApiKey();

    const url = this.buildUrl(apiKey, {
      resultType: 'events',
      keyword: query,
      eventsCount: String(this.clampLimit(options?.limit)),
      includeEventDate: 'true',
      includeEventArticleCounts: 'true',
      includeEventSentiment: 'true',
    });

    const payload = await this.request(url);
    const retrievedAt = new Date();

    const signals = this.normalize(payload, retrievedAt, query);

    this.recordsRetrieved += payload.events?.results?.length ?? 0;
    this.recordsAccepted += signals.length;

    return signals;
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!this.isEnabled()) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'down',
        message: 'Event Registry is disabled via configuration.',
        checkedAt: new Date().toISOString(),
        enabled: false,
        requestCount: this.requestCount,
        failureCount: this.failureCount,
        recordsRetrieved: this.recordsRetrieved,
        recordsAccepted: this.recordsAccepted,
        rateLimitState: this.lastRateLimitState,
      };
    }

    const apiKeyRaw = this.config.get<string>('EVENT_REGISTRY_API_KEY');
    if (!isUsableEventRegistryApiKey(apiKeyRaw)) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'down',
        message: 'EVENT_REGISTRY_API_KEY is not configured.',
        checkedAt: new Date().toISOString(),
        enabled: true,
        requestCount: this.requestCount,
        failureCount: this.failureCount,
        recordsRetrieved: this.recordsRetrieved,
        recordsAccepted: this.recordsAccepted,
        rateLimitState: this.lastRateLimitState,
      };
    }

    try {
      const url = this.buildUrl(apiKeyRaw as string, {
        resultType: 'events',
        keyword: HEALTH_CHECK_KEYWORD,
        eventsCount: '1',
        includeEventDate: 'true',
      });
      const start = Date.now();
      await this.request(url);
      const latencyMs = Date.now() - start;
      this.lastLatencyMs = latencyMs;
      this.lastSuccessAt = new Date().toISOString();
      this.lastRateLimitState = 'ok';

      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'ok',
        message: 'Event Registry responded successfully.',
        checkedAt: new Date().toISOString(),
        enabled: true,
        requestCount: this.requestCount,
        failureCount: this.failureCount,
        lastLatencyMs: this.lastLatencyMs,
        lastSuccessAt: this.lastSuccessAt,
        recordsRetrieved: this.recordsRetrieved,
        recordsAccepted: this.recordsAccepted,
        rateLimitState: this.lastRateLimitState,
      };
    } catch (error) {
      logWithRequestId(this.logger, 'warn', 'Event Registry health check failed', error as Error);

      if (error instanceof EventRegistryProviderError && error.isRateLimit) {
        this.lastRateLimitState = 'throttled';
      }

      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'degraded',
        message: this.describeError(error),
        checkedAt: new Date().toISOString(),
        enabled: true,
        requestCount: this.requestCount,
        failureCount: this.failureCount,
        lastSuccessAt: this.lastSuccessAt,
        recordsRetrieved: this.recordsRetrieved,
        recordsAccepted: this.recordsAccepted,
        rateLimitState: this.lastRateLimitState,
      };
    }
  }

  private isEnabled(): boolean {
    return isEventRegistryEnabled(this.config.get<string>('EVENT_REGISTRY_ENABLED'));
  }

  private requireApiKey(): string {
    const apiKey = this.config.get<string>('EVENT_REGISTRY_API_KEY');
    if (!isUsableEventRegistryApiKey(apiKey)) {
      throw new EventRegistryProviderError('EVENT_REGISTRY_API_KEY is not configured.');
    }
    return apiKey as string;
  }

  private buildUrl(apiKey: string, params: Record<string, string | undefined>): string {
    const baseUrl = this.config.get<string>('EVENT_REGISTRY_BASE_URL') || DEFAULT_BASE_URL;
    const url = new URL(baseUrl);
    url.searchParams.set('apiKey', apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private async request(url: string): Promise<EventRegistryEventsEnvelope> {
    this.requestCount += 1;
    const timeoutMs = this.config.get<number>('EVENT_REGISTRY_REQUEST_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      this.failureCount += 1;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EventRegistryProviderError('Event Registry request timed out.', error);
      }
      throw new EventRegistryProviderError('Failed to reach Event Registry.', error);
    } finally {
      clearTimeout(timeout);
    }

    // 401/403 distinguished explicitly from a generic failure — never
    // echoes the key or Event Registry's raw body back, matching
    // GNewsProvider's own established convention.
    if (response.status === 401 || response.status === 403) {
      this.failureCount += 1;
      throw new EventRegistryProviderError('Event Registry rejected the configured API key.');
    }
    if (response.status === 429) {
      this.failureCount += 1;
      this.lastRateLimitState = 'throttled';
      throw new EventRegistryProviderError('Event Registry rate limit exceeded. Try again shortly.', undefined, true);
    }
    if (!response.ok) {
      this.failureCount += 1;
      throw new EventRegistryProviderError(`Event Registry responded with status ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      this.failureCount += 1;
      throw new EventRegistryProviderError('Event Registry returned a malformed (non-JSON) response.', error);
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as EventRegistryEventsEnvelope).events !== 'object' ||
      (payload as EventRegistryEventsEnvelope).events === null
    ) {
      this.failureCount += 1;
      throw new EventRegistryProviderError('Event Registry response did not match the expected shape.');
    }

    this.lastRateLimitState = 'ok';

    return payload as EventRegistryEventsEnvelope;
  }

  /**
   * Converts Event Registry's events envelope into GeoSignal[]. A
   * malformed individual event is skipped, never batch-fatal — the
   * rest of the response is still returned.
   */
  private normalize(
    payload: EventRegistryEventsEnvelope,
    retrievedAt: Date,
    requestQuery: string,
  ): GeoSignal[] {
    const results: GeoSignal[] = [];

    for (const event of payload.events?.results ?? []) {
      const signal = this.toGeoSignal(event, retrievedAt, requestQuery);
      if (signal) results.push(signal);
    }

    return results;
  }

  private toGeoSignal(event: EventRegistryEvent, retrievedAt: Date, requestQuery: string): GeoSignal | null {
    const uri = event.uri;
    if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
      return null;
    }

    // M64.4 — event.eventDate is date-only ("2016-04-24"), confirmed
    // from the official docs. observedAt requires a full ISO-8601
    // timestamp, so "T00:00:00.000Z" is appended as a NORMALIZATION
    // CONVENTION ONLY — this midnight time is never a provider-
    // supplied event time, and the original raw provider date is
    // preserved unchanged in raw.event.eventDate for any consumer
    // that needs the real, un-normalized value.
    const rawEventDate = event.eventDate;
    if (!rawEventDate || typeof rawEventDate !== 'string' || rawEventDate.trim().length === 0) {
      // No honest way to populate the required observedAt field —
      // skip this individual event rather than fabricate a timestamp.
      return null;
    }
    const observedAt = `${rawEventDate.trim()}T00:00:00.000Z`;
    if (Number.isNaN(new Date(observedAt).getTime())) {
      return null;
    }

    const mentionCount =
      typeof event.totalArticleCount === 'number' && Number.isFinite(event.totalArticleCount)
        ? event.totalArticleCount
        : undefined;

    // M64.4 — Event Registry's own current documentation states
    // sentiment analysis is limited to English-language documents.
    // This value must never later be treated as language-neutral by
    // any consumer of this field.
    const toneScore =
      typeof event.sentiment === 'number' && Number.isFinite(event.sentiment) ? event.sentiment : undefined;

    return {
      id: uri,
      providerId: this.id,
      countryCode: undefined,
      latitude: undefined,
      longitude: undefined,
      toneScore,
      sourceUrl: undefined,
      observedAt,
      retrievedAt: retrievedAt.toISOString(),
      mentionCount,
      sourceAuthorityClass: undefined,
      raw: {
        event,
        requestQuery,
      },
    };
  }

  private describeError(error: unknown): string {
    if (error instanceof EventRegistryProviderError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Unknown error contacting Event Registry.';
  }

  /**
   * M64.4 fix — now honors EVENT_REGISTRY_DEFAULT_LIMIT from
   * configuration instead of only ever using the hardcoded
   * DEFAULT_LIMIT constant, mirroring GdeltProvider's own
   * resolveConfiguredDefaultLimit() fix exactly. Safely parses
   * whatever ConfigService returns (env vars are always strings, but
   * a caller-supplied number is also accepted): blank, zero,
   * negative, non-numeric, or otherwise invalid configuration falls
   * back to DEFAULT_LIMIT, never throws, never silently returns an
   * unbounded/zero limit. The application-level MAX_LIMIT cap (50,
   * Event Registry's own documented maximum for eventsCount) is
   * unconditionally enforced regardless of what the configured
   * default is.
   */
  private resolveConfiguredDefaultLimit(): number {
    const raw = this.config.get<string | number>('EVENT_REGISTRY_DEFAULT_LIMIT');
    if (raw === undefined || raw === null) return DEFAULT_LIMIT;

    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
  }

  private clampLimit(requested: number | undefined): number {
    const configuredDefault = this.resolveConfiguredDefaultLimit();
    if (!requested || requested < 1) return configuredDefault;
    return Math.min(requested, MAX_LIMIT);
  }
}
