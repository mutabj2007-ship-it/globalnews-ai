import type { ReferenceEditionLanguage, ReferenceProviderEntry } from '@globalnews-ai/shared';
import type { WireFetch, WireResponse } from '../../official-data/official-data-transport.node';
import { OfficialDataTransportFailure } from '@globalnews-ai/shared';
import { referenceTransportId } from '../reference-provider-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — WIKIPEDIA EN/PL PAGE SUMMARY ADAPTER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Contract §6, point by point, and where each is held:
 *
 *   bounded Page Summary contract      one endpoint, one title, byte-capped body, extract
 *                                      capped at REFERENCE_EXTRACT_MAX_CHARS
 *   no fuzzy merge across editions     one lookup = one edition; the edition travels on
 *                                      every outcome and is checked against `lang`
 *   revision-derived version identity  `versionId` = the response's `revision`
 *   never transport tid as revision    `tid` is NEVER READ; a body with a tid and no
 *                                      revision is REFUSED, not versioned by the tid
 *   source timestamp from response     `sourceTimestamp` = the response's `timestamp`;
 *                                      no `new Date()` anywhere in this file
 *   missing page, disambiguation       explicit outcomes MISSING_PAGE / DISAMBIGUATION
 *   identifying User-Agent             the transport's (`makeSafeWireFetch({userAgent})`),
 *                                      built by `referenceUserAgent()`, which refuses
 *                                      while PB-8's placeholders are unfilled
 *   rate / concurrency / backoff       `entry.limits`, enforced by the client below
 *   honour Retry-After                 seconds and HTTP-date, bounded by backoffMaxMs
 *   default disabled                   `mode: 'ACTIVE'` returns DISABLED while the entry's
 *                                      literal-false `enabled` stands; only the
 *                                      qualification probe (tooling/) may pass
 *                                      `QUALIFICATION_PROBE`, and a spec proves no
 *                                      production source does
 *
 * The reader's words become a TITLE, never a URL: host and path are fixed by the
 * registry, the title is percent-encoded into one path segment (contract §18: no
 * arbitrary URL fetching).
 */

export const REFERENCE_EXTRACT_MAX_CHARS = 2000;
export const REFERENCE_TITLE_MAX_CHARS = 256;
/** Bound on the per-client TTL cache, oldest evicted first. */
export const REFERENCE_CACHE_MAX_ENTRIES = 500;

export interface ReferenceEvidence {
  readonly role: 'REFERENCE';
  readonly sourceKey: string;
  readonly providerId: string;
  readonly edition: ReferenceEditionLanguage;
  /** Canonical page identity: edition + provider page id. */
  readonly pageId: number;
  readonly canonicalTitle: string;
  /** Version identity: the page REVISION id, as the provider stated it. */
  readonly versionId: string;
  /** When the provider says the revision was made. Never the local clock. */
  readonly sourceTimestamp: string;
  /** Built from the governed host and the canonical title — never taken from the body. */
  readonly pageUrl: string;
  readonly extract: string;
  readonly attribution: { readonly displayName: string; readonly licenseId: string };
  /** Background only: a reference page never verifies a current status (§7). */
  readonly usableAs: 'REFERENCE_BACKGROUND';
}

export type ReferenceLookupOutcome =
  | { readonly kind: 'PAGE'; readonly evidence: ReferenceEvidence }
  | {
      readonly kind: 'MISSING_PAGE';
      readonly edition: ReferenceEditionLanguage;
      readonly requestedTitle: string;
    }
  | {
      readonly kind: 'DISAMBIGUATION';
      readonly edition: ReferenceEditionLanguage;
      readonly requestedTitle: string;
      readonly canonicalTitle: string;
    }
  | { readonly kind: 'RATE_LIMITED'; readonly retryAfterMs: number | null }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: string }
  | { readonly kind: 'REFUSED'; readonly reason: string }
  | { readonly kind: 'DISABLED'; readonly blockedBy: readonly string[] };

/* ── the pure half ───────────────────────────────────────────────────────── */

function editionOf(entry: ReferenceProviderEntry, language: ReferenceEditionLanguage) {
  return entry.editions.find((e) => e.language === language);
}

/** The governed request URL: fixed host, fixed path, one encoded title segment. */
export function summaryUrl(host: string, title: string): string {
  return `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title.trim().replace(/ /g, '_'))}`;
}

function pageUrl(host: string, title: string): string {
  return `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function decodeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/**
 * Interpret one Page Summary response. Pure: same response, same outcome.
 */
export function parseSummaryResponse(
  entry: ReferenceProviderEntry,
  language: ReferenceEditionLanguage,
  requestedTitle: string,
  response: Pick<WireResponse, 'status' | 'finalUrl' | 'wireBytes'>,
): ReferenceLookupOutcome {
  const edition = editionOf(entry, language);
  if (edition === undefined) return { kind: 'REFUSED', reason: 'EDITION_NOT_REGISTERED' };

  let finalHost: string;
  try {
    finalHost = new URL(response.finalUrl).hostname;
  } catch {
    return { kind: 'REFUSED', reason: 'FINAL_URL_UNPARSEABLE' };
  }
  if (finalHost !== edition.host) return { kind: 'REFUSED', reason: 'EDITION_HOST_MISMATCH' };

  if (response.status === 404) return { kind: 'MISSING_PAGE', edition: language, requestedTitle };
  if (response.status !== 200) return { kind: 'UNAVAILABLE', reason: `HTTP_${response.status}` };

  const body = decodeJson(response.wireBytes);
  if (body === null || typeof body !== 'object')
    return { kind: 'REFUSED', reason: 'BODY_NOT_JSON' };
  const b = body as Record<string, unknown>;

  /* One edition per lookup: a body that says it is another edition is not this one. */
  if (typeof b['lang'] === 'string' && b['lang'] !== language) {
    return { kind: 'REFUSED', reason: 'EDITION_LANGUAGE_MISMATCH' };
  }
  const title = typeof b['title'] === 'string' ? b['title'] : undefined;
  if (title === undefined || title.length === 0) return { kind: 'REFUSED', reason: 'NO_TITLE' };

  if (b['type'] === 'disambiguation') {
    return { kind: 'DISAMBIGUATION', edition: language, requestedTitle, canonicalTitle: title };
  }

  const pageId = b['pageid'];
  if (typeof pageId !== 'number' || !Number.isInteger(pageId) || pageId <= 0) {
    return { kind: 'REFUSED', reason: 'NO_PAGE_ID' };
  }
  /* VERSION IDENTITY IS THE REVISION. `tid` is deliberately never read. */
  const revision = b['revision'];
  if (typeof revision !== 'string' || !/^\d{1,20}$/.test(revision)) {
    return { kind: 'REFUSED', reason: 'NO_REVISION' };
  }
  const timestamp = b['timestamp'];
  if (
    typeof timestamp !== 'string' ||
    !ISO_INSTANT.test(timestamp) ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    return { kind: 'REFUSED', reason: 'NO_SOURCE_TIMESTAMP' };
  }
  const extract = typeof b['extract'] === 'string' ? b['extract'] : '';
  if (extract.trim().length === 0) return { kind: 'REFUSED', reason: 'NO_EXTRACT' };

  return {
    kind: 'PAGE',
    evidence: {
      role: 'REFERENCE',
      sourceKey: entry.sourceKey,
      providerId: referenceTransportId(entry, language),
      edition: language,
      pageId,
      canonicalTitle: title,
      versionId: revision,
      sourceTimestamp: timestamp,
      pageUrl: pageUrl(edition.host, title),
      extract:
        extract.length > REFERENCE_EXTRACT_MAX_CHARS
          ? extract.slice(0, REFERENCE_EXTRACT_MAX_CHARS)
          : extract,
      attribution: {
        displayName: entry.attribution.displayName,
        licenseId: entry.attribution.licenseId,
      },
      usableAs: 'REFERENCE_BACKGROUND',
    },
  };
}

/**
 * Retry-After, as milliseconds from `nowMs`. Accepts delta-seconds and HTTP-date. The
 * clock is used ONLY to turn an HTTP-date into a wait; it never becomes a source fact.
 */
export function retryAfterMs(value: string | undefined, nowMs: number): number | null {
  if (value === undefined) return null;
  const v = value.trim();
  if (/^\d{1,7}$/.test(v)) return Number(v) * 1000;
  const at = Date.parse(v);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - nowMs);
}

/* ── the transport half ──────────────────────────────────────────────────── */

export interface WikipediaSummaryClientDeps {
  readonly entry: ReferenceProviderEntry;
  /** The governed transport: `makeSafeWireFetch` (with `userAgent`) in any real use. */
  readonly wireFetch: WireFetch;
  readonly nowMs: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /**
   * `ACTIVE` is the only mode a product path may use, and it honours the entry's
   * activation (DISABLED today). `QUALIFICATION_PROBE` exists for the live qualification
   * probes in tooling/ and nothing else — a spec asserts no production source names it.
   */
  readonly mode: 'ACTIVE' | 'QUALIFICATION_PROBE';
}

export interface WikipediaSummaryClient {
  lookup(
    language: ReferenceEditionLanguage,
    title: string,
    signal: AbortSignal,
  ): Promise<ReferenceLookupOutcome>;
}

export function createWikipediaSummaryClient(
  deps: WikipediaSummaryClientDeps,
): WikipediaSummaryClient {
  const { entry, wireFetch, nowMs, sleep, mode } = deps;
  const limits = entry.limits;
  const minIntervalMs = Math.ceil(1000 / Math.max(1, limits.maxRequestsPerSecond));
  let inFlight = 0;
  let lastStartMs = Number.NEGATIVE_INFINITY;
  const cache = new Map<
    string,
    { readonly outcome: ReferenceLookupOutcome; readonly storedAtMs: number }
  >();

  async function once(language: ReferenceEditionLanguage, title: string, signal: AbortSignal) {
    const edition = editionOf(entry, language)!;
    const wait = lastStartMs + minIntervalMs - nowMs();
    if (wait > 0) await sleep(wait);
    lastStartMs = nowMs();
    return wireFetch(
      {
        providerId: referenceTransportId(entry, language),
        endpointId: 'page-summary',
        url: summaryUrl(edition.host, title),
        accept: 'application/json',
        query: {},
      },
      signal,
    );
  }

  return {
    async lookup(language, title, signal) {
      if (mode === 'ACTIVE' && !entry.activation.enabled) {
        return { kind: 'DISABLED', blockedBy: entry.activation.blockedBy };
      }
      if (editionOf(entry, language) === undefined)
        return { kind: 'REFUSED', reason: 'EDITION_NOT_REGISTERED' };
      const clean = title.trim();
      if (
        clean.length === 0 ||
        clean.length > REFERENCE_TITLE_MAX_CHARS ||
        /[\u0000-\u001f\u007f]/.test(clean)
      ) {
        return { kind: 'REFUSED', reason: 'TITLE_NOT_ADMISSIBLE' };
      }
      /* TTL reuse: a page read within `cacheTtlSeconds` is served again, provenance and
         version unchanged, with no provider call. Only PAGE outcomes are kept. The local
         clock measures the cache's AGE only — it never becomes a source fact. */
      const key = `${language}:${clean}`;
      const cached = cache.get(key);
      if (cached !== undefined && nowMs() - cached.storedAtMs < limits.cacheTtlSeconds * 1000) {
        return cached.outcome;
      }
      if (cached !== undefined) cache.delete(key);

      /* Concurrency without a queue: over the bound is refused, never parked. */
      if (inFlight >= limits.maxConcurrency) return { kind: 'RATE_LIMITED', retryAfterMs: null };

      inFlight += 1;
      try {
        for (let attempt = 1; ; attempt += 1) {
          let response: WireResponse;
          try {
            response = await once(language, clean, signal);
          } catch (e) {
            if (e instanceof OfficialDataTransportFailure)
              return { kind: 'UNAVAILABLE', reason: e.kind };
            return { kind: 'UNAVAILABLE', reason: 'TRANSPORT_ERROR' };
          }
          if (response.status !== 429 && response.status !== 503) {
            const outcome = parseSummaryResponse(entry, language, clean, response);
            if (outcome.kind === 'PAGE') {
              if (cache.size >= REFERENCE_CACHE_MAX_ENTRIES)
                cache.delete(cache.keys().next().value as string);
              cache.set(key, { outcome, storedAtMs: nowMs() });
            }
            return outcome;
          }
          const hinted = retryAfterMs(response.headers['retry-after'], nowMs());
          if (attempt >= limits.maxAttempts) return { kind: 'RATE_LIMITED', retryAfterMs: hinted };
          const backoff = Math.min(limits.backoffMaxMs, limits.backoffBaseMs * 2 ** (attempt - 1));
          /* Honour Retry-After — but never wait past the configured bound; say so instead. */
          if (hinted !== null && hinted > limits.backoffMaxMs)
            return { kind: 'RATE_LIMITED', retryAfterMs: hinted };
          await sleep(hinted ?? backoff);
        }
      } finally {
        inFlight -= 1;
      }
    },
  };
}
