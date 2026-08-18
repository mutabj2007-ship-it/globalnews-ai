import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeoSignal, GeoSignalQueryOptions, ProviderHealthStatus } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';
import type { SignalProvider } from '../interfaces';
import { isGdeltEnabled } from './provider.tokens';
import { logWithRequestId } from '../../../observability/log-with-request-id';

const DEFAULT_BASE_URL = 'https://api.gdeltproject.org/api/v2/geo/geo';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 250;

/**
 * M64.2 — fixed request window, sent explicitly on every request
 * (rather than relying on GDELT's own undocumented-to-us default) so
 * observationWindowStart/observationWindowEnd (computed from this
 * same constant) match what was actually requested.
 *
 * CTO CORRECTION — these two fields are this adapter's own CLIENT-SIDE
 * representation of the aggregation window it asked GDELT for. They
 * are computed from the request timestamp and this constant, not read
 * from anything GDELT returns. GDELT does not supply a per-feature
 * event or observation timestamp on GEO 2.0 point-mode output (see
 * the class-level doc comment's field-verification limitation) — do
 * not read these two fields as if GDELT confirmed the window, and do
 * not describe this mapping as "guaranteed accurate" against
 * anything the provider actually returned.
 */
const REQUEST_TIMESPAN = '24h';
const REQUEST_TIMESPAN_MS = 24 * 60 * 60 * 1000;

interface GdeltGeoJsonFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: {
    name?: string;
    count?: number;
    html?: string;
    [key: string]: unknown;
  };
}

interface GdeltGeoJsonResponse {
  type?: string;
  features?: GdeltGeoJsonFeature[];
}

/** Raised for any GDELT-specific failure (disabled, unsupported option, unmappable country, timeout, rate limit, malformed payload). */
export class GdeltProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    /** CTO correction (rate-limit health semantics) — set true only when this error was raised because GDELT responded 429, so health() can distinguish a throttled failure from any other failure. */
    public readonly isRateLimit = false,
  ) {
    super(message);
    this.name = 'GdeltProviderError';
  }
}

/**
 * M64.2 — real signal provider backed by the GDELT GEO 2.0 API
 * (https://api.gdeltproject.org/api/v2/geo/geo), point-data mode.
 *
 * FIELD-VERIFICATION LIMITATION, stated plainly: this implementation's
 * response-shape assumptions (geometry.coordinates as [lon, lat],
 * properties.name, properties.count) are grounded in multiple
 * independent secondary sources found during the M64.2 audit — outbound
 * network access was unavailable in the implementation environment
 * (confirmed: the sandbox's network egress allowlist rejected
 * api.gdeltproject.org with HTTP 403), so no live response was directly
 * inspected before this code was written. A live smoke test against the
 * real endpoint before production deployment is strongly recommended
 * and has NOT been performed.
 *
 * DELIBERATELY NOT A NewsProvider: discoverSignals() returns
 * GeoSignal[], never NewsArticle[]. See GeoSignal's own doc comment
 * (shared/src/signals.ts) for the full, honest statement of what this
 * separation does and doesn't structurally prevent.
 *
 * UNSUPPORTED OPTIONS FAIL EXPLICITLY, NOT SILENTLY: GDELT GEO 2.0
 * point-mode output has no event classification, so a caller supplying
 * `eventType` gets a clear GdeltProviderError — and no network request
 * is made — rather than having the option silently ignored.
 *
 * COUNTRY CODE CONVERSION (CTO correction): GeoSignalQueryOptions.
 * countryCode is GlobalNews AI's own ISO2 contract. GDELT's official
 * `locationcc:` syntax takes a lowercase country name with spaces
 * removed (e.g. `locationcc:unitedarabemirates`) — never quoted,
 * never with spaces preserved, and not an arbitrary ISO2/FIPS code.
 * Rather than introduce a second, independent country list, this
 * adapter reuses the EXISTING canonical COUNTRIES metadata
 * (shared/src/countries.ts) to resolve the requested ISO2 code to
 * that country's real, existing `name` field, then canonicalizes it
 * (trim, lowercase, remove all spaces) into GDELT's exact expected
 * form. A code with no match in COUNTRIES fails explicitly, before
 * any network request — never silently sent through unresolved.
 *
 * A REAL, UNRESOLVED CONTRACT GAP, surfaced here rather than papered
 * over: GeoSignalQueryOptions has no free-text query field, but GDELT
 * GEO 2.0 requires *some* query to return anything at all. This
 * adapter's only usable query source is `options.countryCode` — a
 * request with neither `countryCode` nor a (currently nonexistent)
 * free-text query has nothing valid to send GDELT, and is rejected
 * with a clear GdeltProviderError.
 */
@Injectable()
export class GdeltProvider implements SignalProvider {
  readonly id = 'gdelt';
  readonly displayName = 'GDELT';
  readonly isMock = false;

  private readonly logger = new Logger(GdeltProvider.name);

  // M64.2 — process-lifetime counters, per the M64.1 ProviderHealthStatus
  // contract's own documented semantics. Reset only on process restart.
  private requestCount = 0;
  private failureCount = 0;
  private recordsRetrieved = 0;
  private recordsAccepted = 0;
  private lastLatencyMs: number | undefined;
  private lastSuccessAt: string | undefined;
  // CTO correction (rate-limit health semantics) — tracks the most
  // recent request's rate-limit outcome so health() can report it
  // without needing a fresh request of its own to rediscover it.
  private lastRateLimitState: 'ok' | 'throttled' | 'unknown' = 'unknown';

  constructor(private readonly config: ConfigService) {}

  async discoverSignals(options?: GeoSignalQueryOptions): Promise<GeoSignal[]> {
    if (options?.eventType) {
      throw new GdeltProviderError(
        'Event-type filtering is unsupported by this adapter version. ' +
          'GDELT GEO 2.0 point-mode output has no event classification to filter by.',
      );
    }

    if (!options?.countryCode) {
      throw new GdeltProviderError(
        'GDELT GEO 2.0 requires a query. This adapter version only supports ' +
          'country-scoped queries via GeoSignalQueryOptions.countryCode — no ' +
          'free-text query field exists on GeoSignalQueryOptions yet.',
      );
    }

    if (!this.isEnabled()) {
      throw new GdeltProviderError('GDELT is disabled via configuration.');
    }

    const locationQuery = this.resolveGdeltLocationQuery(options.countryCode);
    if (!locationQuery) {
      throw new GdeltProviderError(
        `No canonical country metadata found for ISO2 code "${options.countryCode}" — cannot safely construct a GDELT query for it.`,
      );
    }

    const query = `locationcc:${locationQuery}`;
    const url = this.buildUrl({
      query,
      mode: 'pointdata',
      format: 'geojson',
      timespan: REQUEST_TIMESPAN,
      maxpoints: String(this.clampLimit(options.limit)),
    });

    // CTO correction (time semantics) — requestedAt is the WINDOW
    // reference time (what "the last 24h" means for this request),
    // captured before the call. retrievedAt is captured separately,
    // after a successful response is obtained — see below.
    const requestedAt = new Date();
    const payload = await this.request(url);
    const retrievedAt = new Date();

    const signals = this.normalize(payload, requestedAt, retrievedAt, query);

    this.recordsRetrieved += payload.features?.length ?? 0;
    this.recordsAccepted += signals.length;

    return signals;
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!this.isEnabled()) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'down',
        message: 'GDELT is disabled via configuration.',
        checkedAt: new Date().toISOString(),
        enabled: false,
        requestCount: this.requestCount,
        failureCount: this.failureCount,
        recordsRetrieved: this.recordsRetrieved,
        recordsAccepted: this.recordsAccepted,
        rateLimitState: this.lastRateLimitState,
      };
    }

    try {
      // Cheapest live check available: a narrow, single-point query
      // against a country guaranteed to resolve via COUNTRIES. Uses
      // the SAME resolveGdeltLocationQuery() helper discoverSignals()
      // uses, per explicit CTO instruction, so health's query
      // construction can never drift from production query
      // construction.
      const healthCheckQuery = this.resolveGdeltLocationQuery('US');
      const url = this.buildUrl({
        query: healthCheckQuery ? `locationcc:${healthCheckQuery}` : 'locationcc:unitedstates',
        mode: 'pointdata',
        format: 'geojson',
        timespan: REQUEST_TIMESPAN,
        maxpoints: '1',
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
        message: 'GDELT responded successfully.',
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
      logWithRequestId(this.logger, 'warn', 'GDELT health check failed', error as Error);
      // CTO correction (rate-limit health semantics) — a 429 during
      // this very health check also updates lastRateLimitState, so a
      // throttled provider is reported as such even on its very first
      // observed failure, not only after a prior discoverSignals() call.
      if (error instanceof GdeltProviderError && error.isRateLimit) {
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
    return isGdeltEnabled(this.config.get<string>('GDELT_ENABLED'));
  }

  /**
   * CTO correction — resolves GlobalNews AI's own ISO2 country code
   * to the canonical country name already present in COUNTRIES
   * (shared/src/countries.ts), reusing existing metadata rather than
   * introducing a second, independent country/FIPS list. Returns
   * undefined when no match exists — the caller must fail closed on
   * that, never send an unresolved code to GDELT.
   */
  /**
   * CTO correction — GDELT's official `locationcc:` syntax takes a
   * lowercase country name with ALL spaces removed (e.g.
   * "unitedarabemirates", "saudiarabia") — never quoted, never with
   * spaces preserved. This returns the fully GDELT-ready canonical
   * string, so every call site (discoverSignals() and health()) uses
   * this exact same helper rather than reimplementing the
   * canonicalization or the quoting decision separately.
   */
  private resolveGdeltLocationQuery(iso2: string): string | undefined {
    const normalized = iso2.trim().toUpperCase();
    const match = COUNTRIES.find((country) => country.iso2 === normalized);
    if (!match) return undefined;
    return match.name.trim().toLowerCase().replace(/\s+/g, '');
  }

  private buildUrl(params: Record<string, string | undefined>): string {
    const baseUrl = this.config.get<string>('GDELT_GEO_API_BASE_URL') || DEFAULT_BASE_URL;
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private async request(url: string): Promise<GdeltGeoJsonResponse> {
    this.requestCount += 1;
    const timeoutMs = this.config.get<number>('GDELT_REQUEST_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      this.failureCount += 1;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GdeltProviderError('GDELT request timed out.', error);
      }
      throw new GdeltProviderError('Failed to reach GDELT.', error);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      this.failureCount += 1;
      this.lastRateLimitState = 'throttled';
      throw new GdeltProviderError('GDELT rate limit exceeded. Try again shortly.', undefined, true);
    }
    if (!response.ok) {
      this.failureCount += 1;
      throw new GdeltProviderError(`GDELT responded with status ${response.status}.`);
    }

    // GDELT is documented (via independent third-party tooling found
    // during the M64.2 audit) to sometimes return an HTML error page
    // with HTTP 200 — a content-type check is a real defense here,
    // not defensive paranoia.
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      this.failureCount += 1;
      throw new GdeltProviderError('GDELT returned an HTML response instead of JSON.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      this.failureCount += 1;
      throw new GdeltProviderError('GDELT returned a malformed (non-JSON) response.', error);
    }

    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as GdeltGeoJsonResponse).features)) {
      this.failureCount += 1;
      throw new GdeltProviderError('GDELT response did not match the expected GeoJSON shape.');
    }

    // A successful response clears any prior throttled state.
    this.lastRateLimitState = 'ok';

    return payload as GdeltGeoJsonResponse;
  }

  /**
   * Converts GDELT's GeoJSON response into GeoSignal[]. A malformed
   * individual feature is skipped, never batch-fatal — the rest of
   * the response is still returned.
   */
  private normalize(
    payload: GdeltGeoJsonResponse,
    requestedAt: Date,
    retrievedAt: Date,
    query: string,
  ): GeoSignal[] {
    const windowEnd = requestedAt.toISOString();
    const windowStart = new Date(requestedAt.getTime() - REQUEST_TIMESPAN_MS).toISOString();

    const results: GeoSignal[] = [];

    for (const feature of payload.features ?? []) {
      const signal = this.toGeoSignal(feature, windowStart, windowEnd, retrievedAt, query);
      if (signal) results.push(signal);
    }

    return results;
  }

  private toGeoSignal(
    feature: GdeltGeoJsonFeature,
    windowStart: string,
    windowEnd: string,
    retrievedAt: Date,
    query: string,
  ): GeoSignal | null {
    const name = feature.properties?.name;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return null;
    }

    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    // GeoJSON coordinate order is [longitude, latitude] — index 0 is
    // longitude, index 1 is latitude. Getting this backwards is a
    // real, easy mistake; a dedicated test asserts this explicitly.
    const longitude = coordinates[0];
    const latitude = coordinates[1];

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    const mentionCount =
      typeof feature.properties?.count === 'number' && Number.isFinite(feature.properties.count)
        ? feature.properties.count
        : undefined;

    return {
      id: this.buildStableSignalId(name, latitude, longitude),
      providerId: this.id,
      countryCode: undefined,
      latitude,
      longitude,
      toneScore: undefined,
      // M64.2 — never extracted from properties.html via parsing.
      // properties.html is popup markup, not a clean structured URL —
      // per explicit CTO instruction, no regex/HTML parsing is
      // performed. Always undefined in this adapter version.
      sourceUrl: undefined,
      observedAt: windowEnd,
      observationWindowStart: windowStart,
      observationWindowEnd: windowEnd,
      // CTO correction (time semantics) — captured after a successful
      // response was obtained, not the pre-request timestamp used for
      // the window fields above. This is when THIS backend actually
      // finished retrieving the data, not when it started asking.
      retrievedAt: retrievedAt.toISOString(),
      mentionCount,
      // Never set from GDELT data — per explicit instruction, never
      // inferred merely because GDELT references a domain.
      sourceAuthorityClass: undefined,
      raw: {
        feature,
        // CTO correction (query provenance) — GlobalNews AI's own
        // retrieval context, preserved for audit/debugging. Never
        // read by buildStableSignalId() — see its own doc comment.
        requestQuery: query,
      },
    };
  }

  /**
   * Stable PROVIDER/GEOGRAPHIC identity — deliberately excludes
   * mentionCount (a measurement) and request/query text (GlobalNews
   * AI's own retrieval context, stored in raw.requestQuery instead).
   * Coordinates are rounded to 4 decimal places (~11m precision)
   * before hashing so floating-point jitter across repeated fetches
   * of the same named location doesn't create spurious distinct
   * identities.
   */
  private buildStableSignalId(name: string, latitude: number, longitude: number): string {
    const normalizedName = name.trim().toLowerCase();
    const roundedLat = latitude.toFixed(4);
    const roundedLon = longitude.toFixed(4);
    const key = `${this.id}|${normalizedName}|${roundedLat}|${roundedLon}`;

    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return `gdelt-${Math.abs(hash)}`;
  }

  private describeError(error: unknown): string {
    if (error instanceof GdeltProviderError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Unknown error contacting GDELT.';
  }

  /**
   * CTO correction — now honors GDELT_DEFAULT_LIMIT from configuration
   * instead of only ever using the hardcoded DEFAULT_LIMIT constant.
   * Safely parses whatever ConfigService returns (env vars are always
   * strings, but a caller-supplied number is also accepted): blank,
   * zero, negative, non-numeric, or otherwise invalid configuration
   * falls back to DEFAULT_LIMIT, never throws, never silently returns
   * an unbounded/zero limit. The application-level MAX_LIMIT cap is
   * unconditionally enforced regardless of what the configured
   * default is.
   */
  private resolveConfiguredDefaultLimit(): number {
    const raw = this.config.get<string | number>('GDELT_DEFAULT_LIMIT');
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
