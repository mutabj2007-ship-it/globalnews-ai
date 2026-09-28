import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  OFFICIAL_IS_NOT_REFERENCE,
  REFERENCE_IS_NOT_OFFICIAL,
  ReferenceUserAgentUnfilled,
  referenceUserAgent,
  type OfficialSourceEntry,
  type ReferenceProviderEntry,
} from '@globalnews-ai/shared';
import { OFFICIAL_SOURCES } from '../official-sources/official-source-registry';
import {
  REFERENCE_PROVIDERS,
  WIKIPEDIA_REFERENCE_PROVIDER,
  anyReferenceProviderActive,
  referenceHostResolver,
} from './reference-provider-registry';
import {
  REFERENCE_EXTRACT_MAX_CHARS,
  createWikipediaSummaryClient,
  parseSummaryResponse,
  retryAfterMs,
  summaryUrl,
  type ReferenceLookupOutcome,
} from './wikipedia/wikipedia-summary';
import { OfficialDataTransportFailure } from '@globalnews-ai/shared';
import type { WireFetch, WireResponse } from '../official-data/official-data-transport.node';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — contract §6 and Main R1.1 SQ-22 / QQ-9 /
 * PB-8. A's own 16 tests are not on disk (input register: MISSING, non-blocking); these
 * are written from §6 point by point and reported as the equivalent, not as A's.
 */

const W = WIKIPEDIA_REFERENCE_PROVIDER;
const enc = (o: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(o));
const without = (o: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

const PAGE_EN = {
  type: 'standard',
  title: 'Inflation',
  pageid: 14791,
  lang: 'en',
  revision: '1243907012',
  tid: 'f1f0e8a0-5c2b-11ef-a4a1-0b5c3b8e9d11',
  timestamp: '2026-09-20T11:22:33Z',
  extract:
    'In economics, inflation is an increase in the general price level of goods and services.',
};
const PAGE_PL = {
  type: 'standard',
  title: 'Inflacja',
  pageid: 3421,
  lang: 'pl',
  revision: '74612345',
  tid: '0a1b2c3d-5c2b-11ef-a4a1-0b5c3b8e9d11',
  timestamp: '2026-08-02T08:00:00Z',
  extract: 'Inflacja – proces wzrostu przeciętnego poziomu cen w gospodarce.',
};
const ok = (host: string, body: unknown, status = 200): WireResponse => ({
  status,
  finalUrl: `https://${host}/api/rest_v1/page/summary/x`,
  headers: { 'content-type': 'application/json' },
  wireBytes: enc(body),
  redirectChain: [],
});

describe('SQ-22 — REFERENCE is structurally disjoint from OFFICIAL', () => {
  it('neither entry type is assignable to the other (compile-time literals hold false)', () => {
    expect(REFERENCE_IS_NOT_OFFICIAL).toBe(false);
    expect(OFFICIAL_IS_NOT_REFERENCE).toBe(false);
  });

  it('a reference entry cannot be placed in OFFICIAL_SOURCES, nor given an authority class', () => {
    const official: OfficialSourceEntry[] = [];
    // @ts-expect-error — a ReferenceProviderEntry is not an OfficialSourceEntry
    official.push(W);
    const withClass: ReferenceProviderEntry = {
      ...W,
      // @ts-expect-error — `authorityClass` is `never` on a reference entry
      authorityClass: 'GOVERNMENT',
    };
    expect(withClass.role).toBe('REFERENCE');
  });

  it('Wikipedia is not a member of OFFICIAL_SOURCES, by id or by host', () => {
    expect(OFFICIAL_SOURCES.map((s) => s.id)).not.toContain('wikipedia');
    expect(OFFICIAL_SOURCES.some((s) => /wikipedia\.org/i.test(s.baseUrl))).toBe(false);
  });

  it('the role is fixed, and a reference page may never verify or satisfy OFFICIAL', () => {
    for (const p of REFERENCE_PROVIDERS) {
      expect(p.role).toBe('REFERENCE');
      expect(p.volatility).toEqual({
        eligible: 'STABLE_BACKGROUND_ONLY',
        mayVerifyCurrentStatus: false,
        maySatisfyOfficial: false,
      });
    }
  });
});

describe('§6 — registered, default disabled, every activation gate named', () => {
  it('Wikipedia EN/PL is registered with exactly two separate editions', () => {
    expect(W.editions).toEqual([
      { language: 'en', host: 'en.wikipedia.org' },
      { language: 'pl', host: 'pl.wikipedia.org' },
    ]);
  });

  it('no reference provider is active; readiness is NOT_QUALIFIED', () => {
    expect(anyReferenceProviderActive()).toBe(false);
    expect(W.activation.enabled).toBe(false);
    expect(W.readiness).toBe('NOT_QUALIFIED');
    expect(W.activation.blockedBy).toEqual(['QQ-9', 'PB-8', 'PC-11', 'PB-6']);
  });

  it('D-1 narrower scope: one reference entry and no executor wired anywhere', () => {
    expect(REFERENCE_PROVIDERS).toHaveLength(1);
  });

  it('metadata the contract lists is present on the entry', () => {
    expect(W.sourceKey).toBe('wikipedia');
    expect(W.identity).toEqual({
      canonicalPage: 'EDITION_AND_PAGE_ID',
      version: 'REVISION_ID',
      sourceTimestamp: 'PROVIDER_RESPONSE',
    });
    expect(W.attribution).toEqual({
      displayName: 'Wikipedia',
      licenseId: 'CC-BY-SA-4.0',
      licenseConfirmation: 'CONFIRM_AT_ACTIVATION',
      attributionRequired: true,
    });
    expect(W.limits.honourRetryAfter).toBe(true);
  });

  it('the host resolver answers only the two registered editions', () => {
    const r = referenceHostResolver();
    expect(r('wikipedia-en')).toBe('en.wikipedia.org');
    expect(r('wikipedia-pl')).toBe('pl.wikipedia.org');
    expect(r('wikipedia-de')).toBeUndefined();
    expect(r('rw-nisr')).toBeUndefined();
  });
});

describe('PB-8 — the identifying User-Agent refuses while its placeholders are unfilled', () => {
  it('refuses the bare template, naming both placeholders', () => {
    expect(() => referenceUserAgent(W)).toThrow(ReferenceUserAgentUnfilled);
    try {
      referenceUserAgent(W);
    } catch (e) {
      expect((e as ReferenceUserAgentUnfilled).missing).toEqual([
        '{PRODUCT_DOMAIN}',
        '{OPERATIONS_CONTACT}',
      ]);
    }
  });

  it('builds once both are supplied, and refuses a header-injection attempt', () => {
    expect(
      referenceUserAgent(W, {
        '{PRODUCT_DOMAIN}': 'example.test',
        '{OPERATIONS_CONTACT}': 'ops@example.test',
      }),
    ).toBe('GlobalNewsAI-Reference/1.0 (+https://example.test; ops@example.test)');
    expect(() =>
      referenceUserAgent(W, {
        '{PRODUCT_DOMAIN}': 'x\r\nX-Evil: 1',
        '{OPERATIONS_CONTACT}': 'ops',
      }),
    ).toThrow(ReferenceUserAgentUnfilled);
  });
});

describe('§6 — the Page Summary contract (parser)', () => {
  it('EN and PL are read from their OWN editions, with page id as canonical identity', () => {
    const en = parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', PAGE_EN));
    const pl = parseSummaryResponse(W, 'pl', 'Inflacja', ok('pl.wikipedia.org', PAGE_PL));
    expect(
      en.kind === 'PAGE' && [en.evidence.edition, en.evidence.pageId, en.evidence.providerId],
    ).toEqual(['en', 14791, 'wikipedia-en']);
    expect(
      pl.kind === 'PAGE' && [pl.evidence.edition, pl.evidence.pageId, pl.evidence.providerId],
    ).toEqual(['pl', 3421, 'wikipedia-pl']);
  });

  it('no fuzzy merge: a PL body arriving for an EN lookup is refused', () => {
    expect(parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', PAGE_PL))).toEqual({
      kind: 'REFUSED',
      reason: 'EDITION_LANGUAGE_MISMATCH',
    });
    expect(parseSummaryResponse(W, 'en', 'Inflation', ok('pl.wikipedia.org', PAGE_EN))).toEqual({
      kind: 'REFUSED',
      reason: 'EDITION_HOST_MISMATCH',
    });
  });

  it('version identity is the REVISION, never the transport tid', () => {
    const r = parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', PAGE_EN));
    expect(r.kind === 'PAGE' && r.evidence.versionId).toBe('1243907012');
    expect(JSON.stringify(r)).not.toContain(PAGE_EN.tid);
  });

  it('a body with a tid and NO revision is refused — the tid is never promoted to a version', () => {
    const noRevision = without(PAGE_EN, 'revision');
    expect(parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', noRevision))).toEqual({
      kind: 'REFUSED',
      reason: 'NO_REVISION',
    });
  });

  it('the source timestamp is the provider’s, and a response without one is refused', () => {
    const r = parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', PAGE_EN));
    expect(r.kind === 'PAGE' && r.evidence.sourceTimestamp).toBe('2026-09-20T11:22:33Z');
    const noTs = without(PAGE_EN, 'timestamp');
    expect(parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', noTs))).toEqual({
      kind: 'REFUSED',
      reason: 'NO_SOURCE_TIMESTAMP',
    });
  });

  it('a missing page and a disambiguation page are explicit outcomes', () => {
    expect(
      parseSummaryResponse(W, 'en', 'Qqqzzz', ok('en.wikipedia.org', { type: 'not_found' }, 404)),
    ).toEqual({
      kind: 'MISSING_PAGE',
      edition: 'en',
      requestedTitle: 'Qqqzzz',
    });
    expect(
      parseSummaryResponse(
        W,
        'en',
        'Mercury',
        ok('en.wikipedia.org', { ...PAGE_EN, type: 'disambiguation', title: 'Mercury' }),
      ),
    ).toEqual({
      kind: 'DISAMBIGUATION',
      edition: 'en',
      requestedTitle: 'Mercury',
      canonicalTitle: 'Mercury',
    });
  });

  it('the page URL is built from the governed host, never taken from the body', () => {
    const hostile = { ...PAGE_EN, content_urls: { desktop: { page: 'javascript:alert(1)' } } };
    const r = parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', hostile));
    expect(r.kind === 'PAGE' && r.evidence.pageUrl).toBe('https://en.wikipedia.org/wiki/Inflation');
  });

  it('the extract is bounded, and malformed bodies refuse', () => {
    const long = { ...PAGE_EN, extract: 'x'.repeat(REFERENCE_EXTRACT_MAX_CHARS * 3) };
    const r = parseSummaryResponse(W, 'en', 'Inflation', ok('en.wikipedia.org', long));
    expect(r.kind === 'PAGE' && r.evidence.extract.length).toBe(REFERENCE_EXTRACT_MAX_CHARS);
    const bad: WireResponse = {
      ...ok('en.wikipedia.org', {}),
      wireBytes: new Uint8Array([0xff, 0xfe, 0x00]),
    };
    expect(parseSummaryResponse(W, 'en', 'Inflation', bad)).toEqual({
      kind: 'REFUSED',
      reason: 'BODY_NOT_JSON',
    });
  });

  it('a reader’s words become one encoded path segment on the governed host — never a URL', () => {
    expect(summaryUrl('en.wikipedia.org', 'https://evil.test/x?y=1')).toBe(
      'https://en.wikipedia.org/api/rest_v1/page/summary/https%3A%2F%2Fevil.test%2Fx%3Fy%3D1',
    );
    expect(new URL(summaryUrl('pl.wikipedia.org', 'Bank Centralny')).hostname).toBe(
      'pl.wikipedia.org',
    );
  });
});

describe('§6 — the client: default off, rate, concurrency, backoff, Retry-After', () => {
  function clientWith(
    responses: (WireResponse | Error)[],
    mode: 'ACTIVE' | 'QUALIFICATION_PROBE' = 'QUALIFICATION_PROBE',
  ) {
    let now = 1_000_000;
    const sleeps: number[] = [];
    const requests: { url: string; providerId: string }[] = [];
    let i = 0;
    const wireFetch: WireFetch = async (req) => {
      requests.push({ url: req.url, providerId: req.providerId });
      const r = responses[Math.min(i, responses.length - 1)]!;
      i += 1;
      if (r instanceof Error) throw r;
      return r;
    };
    const client = createWikipediaSummaryClient({
      entry: W,
      wireFetch,
      nowMs: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
      mode,
    });
    return { client, sleeps, requests };
  }
  const signal = new AbortController().signal;

  it('ACTIVE mode is DISABLED while the entry is not enabled — and nothing is fetched', async () => {
    const { client, requests } = clientWith([ok('en.wikipedia.org', PAGE_EN)], 'ACTIVE');
    const r: ReferenceLookupOutcome = await client.lookup('en', 'Inflation', signal);
    expect(r).toEqual({ kind: 'DISABLED', blockedBy: ['QQ-9', 'PB-8', 'PC-11', 'PB-6'] });
    expect(requests).toEqual([]);
  });

  it('requests go to the governed transport id and fixed endpoint', async () => {
    const { client, requests } = clientWith([ok('pl.wikipedia.org', PAGE_PL)]);
    expect((await client.lookup('pl', 'Inflacja', signal)).kind).toBe('PAGE');
    expect(requests).toEqual([
      {
        providerId: 'wikipedia-pl',
        url: 'https://pl.wikipedia.org/api/rest_v1/page/summary/Inflacja',
      },
    ]);
  });

  it('consecutive requests are spaced by the configured rate', async () => {
    const { client, sleeps } = clientWith([ok('en.wikipedia.org', PAGE_EN)]);
    await client.lookup('en', 'Inflation', signal);
    /* a different title, so the TTL cache cannot answer it */
    await client.lookup('en', 'Deflation', signal);
    expect(sleeps).toEqual([Math.ceil(1000 / W.limits.maxRequestsPerSecond)]);
  });

  it('Retry-After (seconds) is honoured, then the retry succeeds', async () => {
    const limited: WireResponse = {
      ...ok('en.wikipedia.org', {}, 429),
      headers: { 'retry-after': '2' },
    };
    const { client, sleeps } = clientWith([limited, ok('en.wikipedia.org', PAGE_EN)]);
    expect((await client.lookup('en', 'Inflation', signal)).kind).toBe('PAGE');
    expect(sleeps).toContain(2000);
  });

  it('a Retry-After beyond the backoff bound is reported, never waited out', async () => {
    const limited: WireResponse = {
      ...ok('en.wikipedia.org', {}, 429),
      headers: { 'retry-after': '3600' },
    };
    const { client, requests } = clientWith([limited]);
    expect(await client.lookup('en', 'Inflation', signal)).toEqual({
      kind: 'RATE_LIMITED',
      retryAfterMs: 3_600_000,
    });
    expect(requests).toHaveLength(1);
  });

  it('503 without Retry-After backs off exponentially and stops at maxAttempts', async () => {
    const down: WireResponse = ok('en.wikipedia.org', {}, 503);
    const { client, requests, sleeps } = clientWith([down]);
    expect((await client.lookup('en', 'Inflation', signal)).kind).toBe('RATE_LIMITED');
    expect(requests).toHaveLength(W.limits.maxAttempts);
    expect(sleeps.filter((s) => s >= W.limits.backoffBaseMs)).toEqual([500, 1000]);
  });

  it('Retry-After as an HTTP-date is converted relative to the clock', () => {
    expect(
      retryAfterMs('Wed, 21 Oct 2015 07:28:05 GMT', Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')),
    ).toBe(5000);
    expect(retryAfterMs('soon', 0)).toBeNull();
  });

  it('a transport refusal is UNAVAILABLE with its kind, never a thrown crash', async () => {
    const { client } = clientWith([
      new OfficialDataTransportFailure('ADDRESS_REFUSED', 'wikipedia-en', 'x'),
    ]);
    expect(await client.lookup('en', 'Inflation', signal)).toEqual({
      kind: 'UNAVAILABLE',
      reason: 'ADDRESS_REFUSED',
    });
  });

  it('concurrency over the bound is refused, not queued', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const client = createWikipediaSummaryClient({
      entry: W,
      wireFetch: async () => {
        await gate;
        return ok('en.wikipedia.org', PAGE_EN);
      },
      nowMs: () => 0,
      sleep: async () => undefined,
      mode: 'QUALIFICATION_PROBE',
    });
    const held = Array.from({ length: W.limits.maxConcurrency }, () =>
      client.lookup('en', 'Inflation', signal),
    );
    expect(await client.lookup('en', 'Inflation', signal)).toEqual({
      kind: 'RATE_LIMITED',
      retryAfterMs: null,
    });
    release();
    await Promise.all(held);
  });

  it('TTL: a re-read within cacheTtlSeconds reuses the same revision with no provider call', async () => {
    const { client, requests, sleeps } = clientWith([ok('en.wikipedia.org', PAGE_EN)]);
    const first = await client.lookup('en', 'Inflation', signal);
    const again = await client.lookup('en', 'Inflation', signal);
    expect(again).toEqual(first);
    expect(requests).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('TTL: after cacheTtlSeconds the page is read again; misses and refusals are never cached', async () => {
    let now = 0;
    const requests: string[] = [];
    const responses = [
      ok('en.wikipedia.org', { type: 'not_found' }, 404),
      ok('en.wikipedia.org', PAGE_EN),
      ok('en.wikipedia.org', PAGE_EN),
    ];
    const client = createWikipediaSummaryClient({
      entry: W,
      wireFetch: async (req) => {
        requests.push(req.url);
        return responses[requests.length - 1]!;
      },
      nowMs: () => now,
      sleep: async (ms) => {
        now += ms;
      },
      mode: 'QUALIFICATION_PROBE',
    });
    expect((await client.lookup('en', 'Inflation', signal)).kind).toBe('MISSING_PAGE');
    expect((await client.lookup('en', 'Inflation', signal)).kind).toBe('PAGE');
    now += W.limits.cacheTtlSeconds * 1000;
    expect((await client.lookup('en', 'Inflation', signal)).kind).toBe('PAGE');
    expect(requests).toHaveLength(3);
  });

  it('inadmissible titles are refused before any request', async () => {
    const { client, requests } = clientWith([ok('en.wikipedia.org', PAGE_EN)]);
    for (const t of ['', '   ', 'a\u0000b', 'x'.repeat(257)]) {
      expect(await client.lookup('en', t, signal)).toEqual({
        kind: 'REFUSED',
        reason: 'TITLE_NOT_ADMISSIBLE',
      });
    }
    expect(requests).toEqual([]);
  });
});

describe('dormancy — no product path can reach Wikipedia today', () => {
  const SRC = join(__dirname, '..', '..');
  const files: string[] = [];
  (function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) files.push(p);
    }
  })(SRC);

  it('QUALIFICATION_PROBE is named in no production source except its own definition', () => {
    const named = files
      .filter((f) => readFileSync(f, 'utf8').includes("'QUALIFICATION_PROBE'"))
      .map((f) => relative(SRC, f).replace(/\\/g, '/'));
    expect(named).toEqual(['modules/reference-providers/wikipedia/wikipedia-summary.ts']);
  });

  it('the Wikipedia client is constructed by no production source', () => {
    const constructing = files
      .filter((f) => /createWikipediaSummaryClient\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replace(/\\/g, '/'));
    expect(constructing).toEqual(['modules/reference-providers/wikipedia/wikipedia-summary.ts']);
  });
});
