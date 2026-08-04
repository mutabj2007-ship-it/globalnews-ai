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
            { title: 'Has both', url: 'https://example.com/a' },
            { title: 'Missing url' },
            { url: 'https://example.com/missing-title' },
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
  });
});
