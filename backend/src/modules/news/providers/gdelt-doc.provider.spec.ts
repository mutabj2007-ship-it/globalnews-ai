import { readFileSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { GdeltDocProvider, GdeltDocProviderError } from './gdelt-doc.provider';

/**
 * R4 GDELT — the DOC 2.0 provider, tested against the SHAPE THE CTO
 * ACTUALLY CAPTURED from the live endpoint.
 *
 * The fixture below is not invented. Its field names, its full-name
 * `language` and `sourcecountry` values, its compact `seendate` spelling
 * and its empty-string `url_mobile` all come from the live ArticleList
 * response captured during the acceptance run. That matters more than
 * usual here: the previous GDELT adapter in this repository had to
 * disclose in its own header that it was written without ever seeing a
 * live response.
 */

/** The captured live payload, trimmed to three records. */
const CAPTURED_PAYLOAD = {
  articles: [
    {
      url: 'https://www.haberler.example/haber/ekonomi-12345',
      url_mobile: '',
      title: 'Merkez bankası faiz kararını açıkladı',
      seendate: '20260826T074500Z',
      socialimage: 'https://cdn.haberler.example/ekonomi-12345.jpg',
      domain: 'haberler.example',
      language: 'Turkish',
      sourcecountry: 'Turkey',
    },
    {
      url: 'https://www.folha.example/mundo/artigo-99',
      url_mobile: 'https://m.folha.example/mundo/artigo-99',
      title: 'Negociadores retomam conversas comerciais',
      seendate: '20260826T081500Z',
      socialimage: '',
      domain: 'folha.example',
      language: 'Portuguese',
      sourcecountry: 'Brazil',
    },
    {
      url: 'https://www.chosun.example/world/7788',
      url_mobile: '',
      title: '정상회담 일정 발표',
      seendate: '20260826T090000Z',
      socialimage: 'https://cdn.chosun.example/7788.jpg',
      domain: 'chosun.example',
      language: 'Korean',
      sourcecountry: 'South Korea',
    },
  ],
};

function configFor(enabled: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'GDELT_DOC_ENABLED' ? enabled : undefined),
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

/**
 * Every test builds a FRESH provider, because the throttle, the cooldown
 * and the in-flight map are per-instance process-lifetime state. Sharing
 * one instance would let one test's cooldown silently decide another's
 * outcome.
 */
function buildProvider(...args: [] | [string | undefined]): GdeltDocProvider {
  /*
   * NOT a default parameter. `buildProvider(undefined)` would trigger a
   * default and silently hand back an ENABLED provider — which is exactly
   * the state the "switched off" test is trying to exercise. A rest
   * parameter distinguishes "no argument" from "the argument undefined".
   */
  const enabled = args.length === 0 ? 'true' : args[0];
  const provider = new GdeltDocProvider(configFor(enabled));
  // Spacing is proven in its own tests below; every other test would
  // otherwise pay 5.5 seconds for its first request.
  (provider as unknown as { lastRequestStartedAt: number }).lastRequestStartedAt = -1_000_000;
  return provider;
}

describe('GdeltDocProvider — A: a normal article search succeeds and maps truthfully', () => {
  it('maps the captured payload field by field', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD));
    global.fetch = fetchMock as unknown as typeof fetch;

    const articles = await buildProvider().search('central bank rate decision');

    expect(articles).toHaveLength(3);

    const [turkish] = articles;
    expect(turkish.title).toBe('Merkez bankası faiz kararını açıkladı');
    expect(turkish.url).toBe('https://www.haberler.example/haber/ekonomi-12345');
    expect(turkish.sourceName).toBe('haberler.example');
    expect(turkish.sourceId).toBe('haberler-example');
    expect(turkish.imageUrl).toBe('https://cdn.haberler.example/ekonomi-12345.jpg');
    expect(turkish.providerId).toBe('gdelt-doc');
    expect(turkish.sourcesCount).toBe(1);
  });

  it('sends a bounded, explicit request — timespan is never left to GDELT’s 3-month default', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD));
    global.fetch = fetchMock as unknown as typeof fetch;

    await buildProvider().search('central bank rate decision', { limit: 500 });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://api.gdeltproject.org/api/v2/doc/doc');
    expect(url.searchParams.get('mode')).toBe('ArtList');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('timespan')).toBe('24h');
    expect(url.searchParams.get('sort')).toBe('DateDesc');
    // Clamped: a caller asking for 500 must not become a 500-record ask
    // against a free public endpoint.
    expect(Number(url.searchParams.get('maxrecords'))).toBeLessThanOrEqual(50);
  });

  it('never concatenates raw user punctuation into GDELT query syntax', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD));
    global.fetch = fetchMock as unknown as typeof fetch;

    await buildProvider().search('what about "OPEC" AND (oil OR gas)? domain:evil.example');

    const query = new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('query') ?? '';

    expect(query).not.toContain('"');
    expect(query).not.toContain('(');
    expect(query).not.toContain(')');
    expect(query).not.toContain('?');
    // The colon of an injected operator cannot survive, so `domain:` can
    // never reach GDELT as an operator.
    expect(query).not.toContain('domain:');
  });

  it('makes NO request at all when nothing safe survives the query', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(buildProvider().search('?!  ***  ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GdeltDocProvider — S: an observed timestamp never claims publisher basis', () => {
  it('parses seendate and stamps every article observed', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD)) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    for (const article of articles) {
      expect(article.publishedAtBasis).toBe('observed');
      expect(article.publishedAtBasis).not.toBe('publisher');
    }

    // The captured value, converted rather than reinterpreted.
    expect(articles[0].publishedAt).toBe('2026-08-26T07:45:00.000Z');
  });

  it('drops a record whose seendate does not match the proven shape, rather than guessing', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        articles: [
          { ...CAPTURED_PAYLOAD.articles[0], seendate: '2026-08-26 07:45' },
          { ...CAPTURED_PAYLOAD.articles[1], seendate: undefined },
          // Syntactically well-formed but impossible: month 13.
          { ...CAPTURED_PAYLOAD.articles[2], seendate: '20261326T090000Z' },
        ],
      }),
    ) as unknown as typeof fetch;

    await expect(buildProvider().search('rate decision')).resolves.toEqual([]);
  });
});

describe('GdeltDocProvider — P and Q: the language mapping', () => {
  it('P — full English language names map to codes', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD)) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    expect(articles.map((a) => a.sourceLanguage)).toEqual(['tr', 'pt', 'ko']);
  });

  it('Q — an unmapped language name stays undefined and is never guessed', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        articles: [
          { ...CAPTURED_PAYLOAD.articles[0], language: 'Kinyarwanda' },
          { ...CAPTURED_PAYLOAD.articles[1], language: '' },
          { ...CAPTURED_PAYLOAD.articles[2], language: undefined },
        ],
      }),
    ) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    expect(articles).toHaveLength(3);
    for (const article of articles) {
      expect(article.sourceLanguage).toBeUndefined();
    }
  });
});

describe('GdeltDocProvider — I and K: what must never become geography', () => {
  it('I — sourcecountry reaches NO field of the article', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD)) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    for (const article of articles) {
      expect(article.countryCode).toBeUndefined();
      expect(article.countryName).toBeUndefined();
    }

    // Belt and braces: no country NAME from the payload appears anywhere
    // in the serialized articles, under any key.
    const serialized = JSON.stringify(articles);
    for (const country of ['Turkey', 'Brazil', 'Germany', 'South Korea']) {
      expect(serialized).not.toContain(country);
    }
  });

  it('K — socialimage becomes an ordinary image candidate and nothing more', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD)) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    expect(articles[0].imageUrl).toBe('https://cdn.haberler.example/ekonomi-12345.jpg');
    // An empty socialimage is an ABSENT image, not an empty src.
    expect(articles[1].imageUrl).toBeUndefined();

    // The article contract has no geographic precision field for an image
    // to set, and nothing here invents one.
    for (const article of articles) {
      expect((article as unknown as Record<string, unknown>).geographicPrecision).toBeUndefined();
    }
  });
});

describe('GdeltDocProvider — R: url_mobile is handled safely', () => {
  it('an empty url_mobile is harmless, and a present one never creates a second identity', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD)) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    expect(articles).toHaveLength(3);

    const serialized = JSON.stringify(articles);
    // The Brazilian record carried a real url_mobile; it must appear
    // nowhere, or one article could become two.
    expect(serialized).not.toContain('m.folha.example');

    // Identities are one-per-record and distinct.
    expect(new Set(articles.map((a) => a.id)).size).toBe(3);
  });
});

describe('GdeltDocProvider — G: malformed responses', () => {
  it.each([
    ['a non-JSON body', undefined],
    ['a null payload', null],
    ['a string payload', 'not an object'],
  ])('%s is a malformed failure, never a partial article', async (_name, body) => {
    const provider = buildProvider();

    global.fetch = jest.fn().mockResolvedValue(
      body === undefined
        ? ({
            status: 200,
            ok: true,
            json: async () => {
              throw new Error('Unexpected token P in JSON');
            },
          } as unknown as Response)
        : jsonResponse(body),
    ) as unknown as typeof fetch;

    await expect(provider.search('rate decision')).rejects.toBeInstanceOf(GdeltDocProviderError);
  });

  it('an ABSENT articles key is an empty result, not a failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({})) as unknown as typeof fetch;

    await expect(buildProvider().search('rate decision')).resolves.toEqual([]);
  });

  it('a non-array articles field IS a failure', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ articles: 'nope' })) as unknown as typeof fetch;

    await expect(buildProvider().search('rate decision')).rejects.toBeInstanceOf(
      GdeltDocProviderError,
    );
  });

  it('a record missing a required field is dropped whole, and the rest survive', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        articles: [
          { ...CAPTURED_PAYLOAD.articles[0], url: '' },
          { ...CAPTURED_PAYLOAD.articles[1], title: '   ' },
          CAPTURED_PAYLOAD.articles[2],
          null,
        ],
      }),
    ) as unknown as typeof fetch;

    const articles = await buildProvider().search('rate decision');

    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://www.chosun.example/world/7788');
  });
});

describe('GdeltDocProvider — E, F, W: throttling, timeout and cooldown', () => {
  it('E — a 429 is rate-limited, opens cooldown, and issues NO retry', async () => {
    const provider = buildProvider();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(provider.search('rate decision')).rejects.toMatchObject({
      kind: 'rate-limited',
    });

    // Exactly one network call: no retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const health = await provider.health();
    expect(health.rateLimitState).toBe('throttled');
    expect(health.status).toBe('degraded');
  });

  it('W — while cooling down, no request is made at all', async () => {
    const provider = buildProvider();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(provider.search('first query')).rejects.toBeInstanceOf(GdeltDocProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A DIFFERENT query, so in-flight collapsing cannot be what suppresses it.
    await expect(provider.search('a completely different question')).rejects.toMatchObject({
      kind: 'rate-limited',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('W — a connection reset also opens cooldown, because that is how GDELT objected on the live host', async () => {
    const provider = buildProvider();
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(provider.search('first query')).rejects.toMatchObject({ kind: 'unreachable' });
    await expect(provider.search('second query')).rejects.toMatchObject({ kind: 'rate-limited' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('W — a plain-text throttle sentence returned with HTTP 200 opens cooldown too', async () => {
    /*
     * The live host received "Please limit requests to one every 5
     * seconds" as a BODY, not as a 429. A provider that treated that as
     * ordinary corruption and tried again shortly would walk straight
     * back into the same wall.
     */
    const provider = buildProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error('Unexpected token P in JSON at position 0');
      },
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(provider.search('first query')).rejects.toMatchObject({ kind: 'malformed' });
    await expect(provider.search('second query')).rejects.toMatchObject({ kind: 'rate-limited' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('F — a timeout is reported as a timeout and the request is aborted', async () => {
    const provider = buildProvider();
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    global.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    await expect(provider.search('rate decision')).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('GdeltDocProvider — U and V: request spacing and concurrency collapse', () => {
  it('V — concurrent identical searches collapse into ONE request', async () => {
    const provider = buildProvider();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD));
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await Promise.all([
      provider.search('rate decision'),
      provider.search('rate decision'),
      provider.search('rate decision'),
      provider.search('rate decision'),
      provider.search('rate decision'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result).toHaveLength(3);
    }
  });

  it('V — the collapse releases, so a later identical search is a fresh request', async () => {
    const provider = buildProvider();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(CAPTURED_PAYLOAD));
    global.fetch = fetchMock as unknown as typeof fetch;

    await provider.search('rate decision');
    (provider as unknown as { lastRequestStartedAt: number }).lastRequestStartedAt = -1_000_000;
    await provider.search('rate decision');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('U — two different queries are spaced at least 5 seconds apart', async () => {
    jest.useFakeTimers();

    try {
      const provider = new GdeltDocProvider(configFor('true'));
      const dispatchedAt: number[] = [];

      global.fetch = jest.fn().mockImplementation(async () => {
        dispatchedAt.push(Date.now());
        return jsonResponse(CAPTURED_PAYLOAD);
      }) as unknown as typeof fetch;

      const first = provider.search('alpha query');
      const second = provider.search('beta query');

      // Drain the spacing timers.
      await jest.advanceTimersByTimeAsync(30_000);
      await Promise.all([first, second]);

      expect(dispatchedAt).toHaveLength(2);
      expect(dispatchedAt[1] - dispatchedAt[0]).toBeGreaterThanOrEqual(5_000);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('GdeltDocProvider — the refusals are real refusals', () => {
  it('declares search only', () => {
    expect(buildProvider().capabilities).toEqual(['search']);
  });

  it('topHeadlines throws rather than passing recency off as prominence', async () => {
    await expect(buildProvider().topHeadlines()).rejects.toBeInstanceOf(GdeltDocProviderError);
  });

  it('category throws rather than inventing a taxonomy GDELT does not publish', async () => {
    await expect(buildProvider().category()).rejects.toBeInstanceOf(GdeltDocProviderError);
  });

  it('the source text contains no DateDesc-as-top-headlines shortcut', () => {
    const source = readFileSync(`${__dirname}/gdelt-doc.provider.ts`, 'utf8');
    const code = source
      .split('\n')
      .filter((line: string) => !/^\s*(\*|\/\*|\/\/)/.test(line))
      .join('\n');

    // topHeadlines() must not build a request. If it ever does, this fails.
    const body = code.slice(code.indexOf('async topHeadlines('), code.indexOf('async category('));
    expect(body).not.toContain('fetch(');
    expect(body).not.toContain('GDELT_DOC_URL');
  });
});

describe('GdeltDocProvider — M: health is truthful and costs no request', () => {
  it('reports down and makes no call when the provider is switched off', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const health = await buildProvider(undefined).health();

    expect(health.status).toBe('down');
    expect(health.providerId).toBe('gdelt-doc');
    expect(health.displayName).toBe('GDELT DOC');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never issues a live probe, so an admin refresh cannot cause the throttling it observes', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await buildProvider().health();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves an unmeasured latency ABSENT rather than reporting zero', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const health = await buildProvider().health();

    expect(health).not.toHaveProperty('lastLatencyMs');
    expect(health).not.toHaveProperty('lastSuccessAt');
    // Counters that ARE measured from zero are honest zeros, not guesses.
    expect(health.requestCount).toBe(0);
  });
});
