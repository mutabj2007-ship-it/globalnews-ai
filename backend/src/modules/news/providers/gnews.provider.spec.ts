import { GNewsProvider } from './gnews.provider';

/** Minimal ConfigService stand-in — only `.get()` is used by GNewsProvider. */
function makeConfig(apiKey: string | undefined): { get: jest.Mock } {
  return { get: jest.fn().mockReturnValue(apiKey) };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('GNewsProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('missing API key', () => {
    it('throws from search() when GNEWS_API_KEY is not configured', async () => {
      const provider = new GNewsProvider(makeConfig(undefined) as never);
      await expect(provider.search('markets')).rejects.toThrow('GNEWS_API_KEY is not configured');
    });

    it('throws from topHeadlines() when GNEWS_API_KEY is not configured', async () => {
      const provider = new GNewsProvider(makeConfig(undefined) as never);
      await expect(provider.topHeadlines()).rejects.toThrow('GNEWS_API_KEY is not configured');
    });

    it('reports a clear "down" status from health() rather than throwing', async () => {
      const provider = new GNewsProvider(makeConfig(undefined) as never);
      const status = await provider.health();

      expect(status.status).toBe('down');
      expect(status.providerId).toBe('gnews');
      expect(status.message).toMatch(/not configured/i);
      // The message must never contain anything resembling a key value.
      expect(status.message).not.toMatch(/[A-Za-z0-9]{20,}/);
    });
  });

  describe('response normalization', () => {
    it('maps GNews articles onto the shared NewsArticle shape', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          totalArticles: 1,
          articles: [
            {
              title: 'Ceuta sees renewed diplomatic talks',
              description: 'A short summary of the story.',
              url: 'https://example.com/ceuta-story',
              image: 'https://example.com/ceuta.jpg',
              publishedAt: '2026-01-01T12:00:00Z',
              source: { name: 'Example Wire', url: 'https://example.com' },
            },
          ],
        }),
      );

      const provider = new GNewsProvider(makeConfig('test-key') as never);
      const articles = await provider.search('Ceuta');

      expect(articles).toHaveLength(1);
      const [article] = articles;
      expect(article).toMatchObject({
        title: 'Ceuta sees renewed diplomatic talks',
        summary: 'A short summary of the story.',
        url: 'https://example.com/ceuta-story',
        imageUrl: 'https://example.com/ceuta.jpg',
        sourceName: 'Example Wire',
        sourcesCount: 1,
        publishedAt: '2026-01-01T12:00:00Z',
      });
      expect(article.id).toMatch(/^gnews-/);
      expect(article.sourceId).toBe('example-wire');
    });

    it('drops malformed entries missing a title or url instead of throwing', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'Has both',
              url: 'https://example.com/a',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            { title: 'Missing url', publishedAt: '2026-01-01T12:00:00Z' },
            { url: 'https://example.com/missing-title', publishedAt: '2026-01-01T12:00:00Z' },
          ],
        }),
      );

      const provider = new GNewsProvider(makeConfig('test-key') as never);
      const articles = await provider.topHeadlines();

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Has both');
    });
  });

  describe('empty results', () => {
    it('returns an empty array when GNews has no matching articles', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ totalArticles: 0, articles: [] }));

      const provider = new GNewsProvider(makeConfig('test-key') as never);
      const articles = await provider.search('an extremely unlikely query string');

      expect(articles).toEqual([]);
    });
  });

  describe('provider error handling', () => {
    it('throws a controlled error on an invalid API key (401)', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 401));
      const provider = new GNewsProvider(makeConfig('bad-key') as never);

      await expect(provider.topHeadlines()).rejects.toThrow('rejected the configured API key');
    });

    it('throws a controlled error on rate limiting (429)', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 429));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await expect(provider.topHeadlines()).rejects.toThrow('rate limit');
    });

    it('one 429 stops concurrently queued different searches from issuing another upstream request', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, 429));
      global.fetch = fetchMock;
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const [first, second] = await Promise.allSettled([
        provider.search('Rwanda'),
        provider.search('DR Congo'),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first.status).toBe('rejected');
      expect(second.status).toBe('rejected');

      if (first.status === 'rejected') {
        expect(first.reason).toMatchObject({ kind: 'rate-limited' });
      }
      if (second.status === 'rejected') {
        expect(second.reason).toMatchObject({ kind: 'rate-limited' });
      }
    });

    /**
     * ── R4 GDELT / TEST Y — 403 IS QUOTA, NOT AN INVALID KEY ───────────
     *
     * 401 and 403 used to raise the SAME sentence. When the Free plan
     * reached 100/100 the live host received 403 and the operator was
     * told the API key had been rejected — sending them to rotate a
     * perfectly valid credential while the real condition, a spent daily
     * allowance that resets on its own, was represented nowhere.
     *
     * These tests assert the wording as well as the kind, because the
     * wording is what a human actually reads in a log line at 2am.
     */
    it('Y — 403 is reported as an exhausted allowance and does NOT blame the API key', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 403));
      const provider = new GNewsProvider(makeConfig('perfectly-valid-key') as never);

      await expect(provider.topHeadlines()).rejects.toMatchObject({ kind: 'quota' });

      const message = await provider
        .topHeadlines()
        .then(() => '')
        .catch((caught: Error) => caught.message);

      expect(message).toContain('allowance is exhausted');
      expect(message).not.toContain('rejected the configured API key');
      // And it never echoes the credential itself.
      expect(message).not.toContain('perfectly-valid-key');
    });

    it('Y — 401 still means auth, so the split did not simply relabel both', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 401));
      const provider = new GNewsProvider(makeConfig('bad-key') as never);

      await expect(provider.topHeadlines()).rejects.toMatchObject({ kind: 'auth' });
    });

    it('Y — 401 and 403 no longer produce the same message', async () => {
      const messageFor = async (status: number): Promise<string> => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, status));
        const provider = new GNewsProvider(makeConfig('test-key') as never);
        return provider
          .topHeadlines()
          .then(() => '')
          .catch((error: Error) => error.message);
      };

      expect(await messageFor(401)).not.toBe(await messageFor(403));
    });

    it('carries a machine-readable kind for every mapped failure', async () => {
      const kindFor = async (status: number): Promise<unknown> => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, status));
        const provider = new GNewsProvider(makeConfig('test-key') as never);
        return provider
          .topHeadlines()
          .then(() => undefined)
          .catch((error: { kind?: unknown }) => error.kind);
      };

      expect(await kindFor(401)).toBe('auth');
      expect(await kindFor(403)).toBe('quota');
      expect(await kindFor(429)).toBe('rate-limited');
      // An UNMAPPED status stays honestly unmapped rather than being
      // absorbed into a kind somebody guessed at.
      expect(await kindFor(500)).toBe('unknown');
    });

    it('a timeout and an unreachable host are distinguishable', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';

      global.fetch = jest.fn().mockRejectedValue(abortError);
      const timeoutProvider = new GNewsProvider(makeConfig('test-key') as never);
      await expect(timeoutProvider.topHeadlines()).rejects.toMatchObject({ kind: 'timeout' });

      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const downProvider = new GNewsProvider(makeConfig('test-key') as never);
      await expect(downProvider.topHeadlines()).rejects.toMatchObject({ kind: 'unreachable' });
    });

    it('throws a controlled error on a malformed (non-JSON) response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token');
        },
      } as unknown as Response);
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await expect(provider.topHeadlines()).rejects.toThrow('malformed');
    });

    it('throws a controlled error when the response shape is unexpected', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ notArticles: [] }));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await expect(provider.topHeadlines()).rejects.toThrow('expected shape');
    });

    it('throws a controlled error when the network request itself fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await expect(provider.topHeadlines()).rejects.toThrow('Failed to reach GNews');
    });
  });

  describe('provider health', () => {
    it('reports "ok" when GNews responds successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const status = await provider.health();
      expect(status.status).toBe('ok');
    });

    it('reports "degraded" (not thrown) when GNews is reachable but errors', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 500));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const status = await provider.health();
      expect(status.status).toBe('degraded');
      expect(status.providerId).toBe('gnews');
    });

    /**
     * R4 GDELT — the throttle reaches Admin through a field that already
     * exists, so no health state, admin contract or frontend changes.
     */
    it('a quota failure marks the provider throttled without inventing a health state', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 403));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const status = await provider.health();

      expect(status.status).toBe('degraded');
      expect(status.rateLimitState).toBe('throttled');
    });

    it('a rate-limit failure marks the provider throttled too', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 429));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      expect((await provider.health()).rateLimitState).toBe('throttled');
    });

    /**
     * A failed health check has not shown the provider to be UN-throttled;
     * it has shown nothing about throttling at all. So the field stays
     * ABSENT rather than reporting 'ok' — a measurement nobody took.
     */
    it('a non-throttle failure leaves rateLimitState ABSENT rather than claiming "ok"', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 500));
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      expect(await provider.health()).not.toHaveProperty('rateLimitState');
    });
  });

  describe('Milestone #47 — language parameterization', () => {
    function capturedUrl(fetchMock: jest.Mock): string {
      return (fetchMock.mock.calls[0] as [string, unknown])[0];
    }

    it('search() defaults to lang=en with no options, preserving pre-Milestone-#47 behavior', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
      global.fetch = fetchMock;
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await provider.search('NATO');

      expect(capturedUrl(fetchMock)).toContain('lang=en');
    });

    it('search() honors an explicit lang option', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
      global.fetch = fetchMock;
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await provider.search('NATO', { lang: 'fr' });

      expect(capturedUrl(fetchMock)).toContain('lang=fr');
    });

    it('topHeadlines() sends both lang and q when provided', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
      global.fetch = fetchMock;
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await provider.topHeadlines({ lang: 'pl', q: 'NATO' });

      const url = capturedUrl(fetchMock);
      expect(url).toContain('lang=pl');
      expect(url).toContain('q=NATO');
    });

    it('topHeadlines() with no options sends no lang param at all — NOT forced to "en" (matches GNews\'s own "Any" default for this endpoint)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
      global.fetch = fetchMock;
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await provider.topHeadlines();

      expect(capturedUrl(fetchMock)).not.toContain('lang=');
    });

    it('REGRESSION: category() still defaults to lang=en unchanged — buildUrl() no longer injecting a blanket default did not silently alter this method', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
      global.fetch = fetchMock;
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      await provider.category('world');

      expect(capturedUrl(fetchMock)).toContain('lang=en');
    });
  });

  describe('Milestone #47 — sourceLanguage mapping', () => {
    it('maps a present upstream lang field: trimmed and lowercased', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'T',
              url: 'https://example.com/x',
              lang: 'PL ',
              publishedAt: '2026-01-01T12:00:00Z',
            },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.search('x');

      expect(articles[0].sourceLanguage).toBe('pl');
    });

    it('sourceLanguage is undefined when the upstream field is absent — never fabricated', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            { title: 'T', url: 'https://example.com/y', publishedAt: '2026-01-01T12:00:00Z' },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.search('x');

      expect(articles[0].sourceLanguage).toBeUndefined();
    });

    it('preserves an arbitrary provider language value (e.g. "de") verbatim — never coerced into a closed LanguageCode', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'T',
              url: 'https://example.com/z',
              lang: 'de',
              publishedAt: '2026-01-01T12:00:00Z',
            },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.search('x');

      expect(articles[0].sourceLanguage).toBe('de');
    });

    it('an empty/whitespace-only upstream lang value maps to undefined, not an empty string', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'T',
              url: 'https://example.com/w',
              lang: '   ',
              publishedAt: '2026-01-01T12:00:00Z',
            },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.search('x');

      expect(articles[0].sourceLanguage).toBeUndefined();
    });
  });

  describe('Milestone #48 (Phase C) — topHeadlines runtime language containment', () => {
    it('reproduces the real browser defect: a mixed-language GNews response for lang=en is filtered down to only the genuinely English article', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'English article',
              url: 'https://x.com/1',
              lang: 'en',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'French article',
              url: 'https://x.com/2',
              lang: 'fr',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Romanian article',
              url: 'https://x.com/3',
              lang: 'ro',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Spanish article',
              url: 'https://x.com/4',
              lang: 'es',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Bengali article',
              url: 'https://x.com/5',
              lang: 'bn',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Polish article',
              url: 'https://x.com/6',
              lang: 'pl',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'No-lang article',
              url: 'https://x.com/7',
              publishedAt: '2026-01-01T12:00:00Z',
            },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.topHeadlines({ lang: 'en' });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('English article');
    });

    it('reproduces the same defect for lang=pl: only the genuinely Polish article survives', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'English article',
              url: 'https://x.com/1',
              lang: 'en',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Portuguese article',
              url: 'https://x.com/2',
              lang: 'pt',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'German article',
              url: 'https://x.com/3',
              lang: 'de',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Romanian article',
              url: 'https://x.com/4',
              lang: 'ro',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Russian article',
              url: 'https://x.com/5',
              lang: 'ru',
              publishedAt: '2026-01-01T12:00:00Z',
            },
            {
              title: 'Polish article',
              url: 'https://x.com/6',
              lang: 'pl',
              publishedAt: '2026-01-01T12:00:00Z',
            },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.topHeadlines({ lang: 'pl' });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Polish article');
    });

    it('no lang requested at all: no filtering is applied, matching this endpoint\'s existing "no language filter" default', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            { title: 'A', url: 'https://x.com/1', lang: 'en', publishedAt: '2026-01-01T12:00:00Z' },
            { title: 'B', url: 'https://x.com/2', lang: 'fr', publishedAt: '2026-01-01T12:00:00Z' },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.topHeadlines();

      expect(articles).toHaveLength(2);
    });

    it('when every returned article genuinely matches the requested language, nothing is discarded', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            { title: 'A', url: 'https://x.com/1', lang: 'en', publishedAt: '2026-01-01T12:00:00Z' },
            { title: 'B', url: 'https://x.com/2', lang: 'en', publishedAt: '2026-01-01T12:00:00Z' },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.topHeadlines({ lang: 'en' });

      expect(articles).toHaveLength(2);
    });

    it('a zero-match response after filtering returns a clean empty array, never a fabricated fallback', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            { title: 'A', url: 'https://x.com/1', lang: 'fr', publishedAt: '2026-01-01T12:00:00Z' },
            { title: 'B', url: 'https://x.com/2', lang: 'de', publishedAt: '2026-01-01T12:00:00Z' },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.topHeadlines({ lang: 'en' });

      expect(articles).toEqual([]);
    });

    it('an article with no reported language at all is discarded under a language-constrained request, never assumed to match', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          articles: [
            {
              title: 'Unlabeled article',
              url: 'https://x.com/1',
              publishedAt: '2026-01-01T12:00:00Z',
            },
          ],
        }),
      );
      const provider = new GNewsProvider(makeConfig('test-key') as never);

      const articles = await provider.topHeadlines({ lang: 'en' });

      expect(articles).toEqual([]);
    });
  });
});

describe('Query-limit correction — GNews search q ≤200-code-point backstop', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function capturedUrl(fetchMock: jest.Mock): string {
    return (fetchMock.mock.calls[0] as [string, unknown])[0];
  }

  it('a short query passes through unchanged', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
    global.fetch = fetchMock;
    const provider = new GNewsProvider(makeConfig('test-key') as never);

    await provider.search('Rwanda');

    const url = new URL(capturedUrl(fetchMock));
    expect(url.searchParams.get('q')).toBe('Rwanda');
  });

  it('a query over 200 code points is bounded to exactly 200, never sent to GNews unbounded', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
    global.fetch = fetchMock;
    const provider = new GNewsProvider(makeConfig('test-key') as never);
    const longQuery = 'a'.repeat(400);

    await provider.search(longQuery);

    const url = new URL(capturedUrl(fetchMock));
    const sentQuery = url.searchParams.get('q');
    expect(sentQuery).not.toBeNull();
    expect(Array.from(sentQuery as string)).toHaveLength(200);
  });

  it('a query of exactly 200 code points is sent unchanged (boundary case)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
    global.fetch = fetchMock;
    const provider = new GNewsProvider(makeConfig('test-key') as never);
    const exactQuery = 'a'.repeat(200);

    await provider.search(exactQuery);

    const url = new URL(capturedUrl(fetchMock));
    expect(url.searchParams.get('q')).toBe(exactQuery);
  });

  it('truncates by Unicode code point, never splitting a surrogate pair (an emoji straddling the 200th position stays intact rather than becoming a malformed lone surrogate)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
    global.fetch = fetchMock;
    const provider = new GNewsProvider(makeConfig('test-key') as never);
    // Code point 200 (0-indexed 199) is a globe emoji, outside the
    // Basic Multilingual Plane — represented as a surrogate PAIR in
    // UTF-16. A naive .slice(0, 200) would split this pair and
    // produce a lone, invalid surrogate.
    const emoji = '\u{1F30D}';
    const longQuery = 'a'.repeat(199) + emoji + 'b'.repeat(50);

    await provider.search(longQuery);

    const url = new URL(capturedUrl(fetchMock));
    const sentQuery = url.searchParams.get('q') as string;
    expect(Array.from(sentQuery)).toHaveLength(200);
    expect(Array.from(sentQuery)).toContain(emoji);
    // No lone (unpaired) surrogate anywhere in the result.
    for (let i = 0; i < sentQuery.length; i += 1) {
      const code = sentQuery.charCodeAt(i);
      const isHighSurrogate = code >= 0xd800 && code <= 0xdbff;
      const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
      if (isHighSurrogate) {
        const next = sentQuery.charCodeAt(i + 1);
        expect(next >= 0xdc00 && next <= 0xdfff).toBe(true);
      } else if (isLowSurrogate) {
        const prev = sentQuery.charCodeAt(i - 1);
        expect(prev >= 0xd800 && prev <= 0xdbff).toBe(true);
      }
    }
  });

  it('ordinary GNews search request behavior (lang, max, article normalization) remains completely unchanged by the length backstop', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        articles: [
          {
            title: 'Test Article',
            url: 'https://example.com/1',
            description: 'A description',
            source: { name: 'Example' },
            publishedAt: '2026-01-01T12:00:00Z',
          },
        ],
      }),
    );
    const provider = new GNewsProvider(makeConfig('test-key') as never);

    const articles = await provider.search('Ceuta', { lang: 'en', limit: 5 });

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Test Article');
  });
});
