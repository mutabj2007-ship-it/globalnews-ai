import { readFileSync } from 'fs';
import { join } from 'path';
import { GNewsProvider, isUsablePublicationTimestamp } from './gnews.provider';

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

const VALID = '2026-08-20T09:15:00Z';

function article(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'A real headline',
    url: 'https://example.com/a-real-headline',
    description: 'A real description.',
    source: { name: 'Example Outlet' },
    publishedAt: VALID,
    ...overrides,
  };
}

/**
 * RC-1 — RC-H1 FINDING H-2: NO FABRICATED PUBLICATION TIME.
 *
 * The defect: `publishedAt: raw.publishedAt ?? new Date().toISOString()`. An
 * article the provider dated not at all entered the product stamped with the
 * moment we fetched it, and every downstream consumer treated that
 * fabrication as fact — newest-first ordering put it at the top of the page,
 * article-confidence gave it a full freshness bonus, and persistence wrote it
 * into Article.publishedAt as though an outlet had asserted it.
 *
 * The approved repair drops the record instead. These tests bind BOTH halves:
 * the rule (isUsablePublicationTimestamp) and its effect (what survives
 * normalize()), plus a source-level guard that the fallback cannot return.
 */
describe('RC-H1 H-2 — provider publication timestamps are never fabricated', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  async function searchWith(articles: unknown[]): Promise<Array<{ publishedAt: string }>> {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ articles })) as never;
    const provider = new GNewsProvider(makeConfig('a-test-key') as never);
    return (await provider.search('anything')) as Array<{ publishedAt: string }>;
  }

  describe('the rule', () => {
    it('accepts a real ISO instant', () => {
      expect(isUsablePublicationTimestamp(VALID)).toBe(true);
      expect(isUsablePublicationTimestamp('2026-01-31T23:59:59.999Z')).toBe(true);
    });

    it('rejects an ABSENT timestamp', () => {
      expect(isUsablePublicationTimestamp(undefined)).toBe(false);
      expect(isUsablePublicationTimestamp(null)).toBe(false);
    });

    it('rejects an EMPTY or whitespace-only timestamp — present but asserting nothing', () => {
      expect(isUsablePublicationTimestamp('')).toBe(false);
      expect(isUsablePublicationTimestamp('   ')).toBe(false);
    });

    it('rejects an UNPARSEABLE timestamp', () => {
      expect(isUsablePublicationTimestamp('not a date')).toBe(false);
      expect(isUsablePublicationTimestamp('yesterday')).toBe(false);
      expect(isUsablePublicationTimestamp('2026-13-45T99:99:99Z')).toBe(false);
    });

    it('rejects a non-string, however date-like', () => {
      expect(isUsablePublicationTimestamp(Date.now())).toBe(false);
      expect(isUsablePublicationTimestamp(new Date())).toBe(false);
    });

    it('never REPAIRS a value — the predicate only ever answers yes or no', () => {
      expect(typeof isUsablePublicationTimestamp(VALID)).toBe('boolean');
      expect(typeof isUsablePublicationTimestamp('nonsense')).toBe('boolean');
    });
  });

  describe('the effect', () => {
    it('a MISSING publication timestamp is rejected — the article never enters the pipeline', async () => {
      const results = await searchWith([article({ publishedAt: undefined })]);
      expect(results).toHaveLength(0);
    });

    it('an INVALID publication timestamp is rejected', async () => {
      const results = await searchWith([
        article({ publishedAt: 'not a date', url: 'https://example.com/1' }),
        article({ publishedAt: '', url: 'https://example.com/2' }),
        article({ publishedAt: '   ', url: 'https://example.com/3' }),
      ]);
      expect(results).toHaveLength(0);
    });

    it('a VALID publication timestamp survives UNCHANGED — verbatim, not normalised', async () => {
      const results = await searchWith([article()]);
      expect(results).toHaveLength(1);
      expect(results[0].publishedAt).toBe(VALID);
    });

    it('a non-ISO but genuinely parseable outlet format also survives verbatim', async () => {
      const rfc = 'Tue, 18 Aug 2026 07:30:00 GMT';
      const results = await searchWith([article({ publishedAt: rfc })]);
      expect(results).toHaveLength(1);
      expect(results[0].publishedAt).toBe(rfc);
    });

    it('drops ONLY the undated records — a mixed batch keeps every dated one', async () => {
      const results = await searchWith([
        article({ url: 'https://example.com/keep-1', publishedAt: VALID }),
        article({ url: 'https://example.com/drop-1', publishedAt: undefined }),
        article({ url: 'https://example.com/keep-2', publishedAt: '2026-08-19T00:00:00Z' }),
        article({ url: 'https://example.com/drop-2', publishedAt: 'soon' }),
      ]);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.publishedAt)).toEqual([VALID, '2026-08-19T00:00:00Z']);
    });

    it('NO SURVIVING ARTICLE IS STAMPED WITH THE CURRENT TIME', async () => {
      const before = Date.now();
      const results = await searchWith([article()]);
      const after = Date.now();

      expect(results).toHaveLength(1);
      const stamped = Date.parse(results[0].publishedAt);
      // The one surviving article carries the outlet's instant, which is not
      // inside the window this test just executed in.
      expect(stamped).toBeLessThan(before);
      expect(stamped).toBeLessThan(after);
    });
  });

  describe('the fallback cannot come back', () => {
    const source = readFileSync(join(__dirname, 'gnews.provider.ts'), 'utf-8');
    const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    it('no publishedAt fallback to the current time exists anywhere in the provider', () => {
      expect(executable).not.toMatch(/publishedAt[^\n]*\?\?[^\n]*new Date\(\)/);
      expect(executable).not.toMatch(/publishedAt[^\n]*new Date\(\)\.toISOString\(\)/);
    });

    it('publishedAt is assigned from the provider value and nothing else', () => {
      expect(executable).toMatch(/publishedAt:\s*raw\.publishedAt,/);
    });

    it('the shared contract was NOT widened — publishedAt stays a required string', () => {
      const contract = readFileSync(join(__dirname, '../../../../../shared/src/news.ts'), 'utf-8');
      expect(contract).toMatch(/^\s*publishedAt:\s*string;\s*$/m);
      expect(contract).not.toMatch(/^\s*publishedAt\?:/m);
    });
  });
});
