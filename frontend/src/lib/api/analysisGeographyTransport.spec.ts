import { analyzeNews, transportableGeography } from './analysisApi';

/**
 * MAP MOBILE R1 CONVERGENCE — the geography context on the existing
 * analyzeNews() transport (POST /analysis/news, canonical since PR #46).
 *
 * - exactly { countryCode, displayName } crosses the wire;
 * - countryCode is normalized through the canonical governed-country check,
 *   so a governed ISO2 or ISO3 in either case is one identity;
 * - displayName never splits the in-flight identity;
 * - a story context or a selection strips it: never a combined scope.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

/* Requests that never settle, so concurrent callers stay in flight together. */
function pendingFetch(): { fetchMock: jest.Mock } {
  const fetchMock = jest.fn(() => new Promise<Response>(() => undefined));
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock };
}

function resolvedFetch(): { fetchMock: jest.Mock; body: (index?: number) => Record<string, unknown> } {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ analysis: null }),
  } as unknown as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, body: (index = 0) => JSON.parse(fetchMock.mock.calls[index][1].body as string) };
}

describe('the geography context is sent as exactly two fields', () => {
  it('a map country is sent as { countryCode, displayName } alongside the question', async () => {
    const { body, fetchMock } = resolvedFetch();
    await analyzeNews('What changed this week?', 'en', undefined, undefined, undefined, {
      countryCode: 'DZ',
      displayName: 'Algeria',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body()).toEqual({
      query: 'What changed this week?',
      requestedLanguage: 'en',
      geographyContext: { countryCode: 'DZA', displayName: 'Algeria' },
    });
    expect(Object.keys(body().geographyContext as object).sort()).toEqual(['countryCode', 'displayName']);
  });

  it('anything else a caller passes is stripped: no article, source, evidence, report, cluster or prior-answer field', async () => {
    const { body } = resolvedFetch();
    const widened = {
      countryCode: 'POL',
      displayName: 'Poland',
      articleId: 'a-1',
      sourceId: 's-1',
      evidenceId: 'e-1',
      reportId: 'r-1',
      clusterId: 'c-1',
      priorAnswer: 'MODEL OUTPUT',
      title: 'A headline',
    };
    await analyzeNews('Strip test', 'en', undefined, undefined, undefined, widened as never);
    expect(body().geographyContext).toEqual({ countryCode: 'POL', displayName: 'Poland' });
    expect(JSON.stringify(body())).not.toMatch(/a-1|s-1|e-1|r-1|c-1|MODEL OUTPUT|headline/);
  });

  it.each([
    ['PL', 'POL'],
    ['pl', 'POL'],
    ['POL', 'POL'],
    ['pol', 'POL'],
    ['DZ', 'DZA'],
  ])('a governed code %s is normalized to %s through the canonical shared check', (code, iso3) => {
    expect(transportableGeography({ countryCode: code, displayName: 'x' }).countryCode).toBe(iso3);
  });

  it('an ungoverned code is NOT silently dropped: it is sent upper-cased for the backend to refuse', async () => {
    const { body } = resolvedFetch();
    await analyzeNews('Ungoverned', 'en', undefined, undefined, undefined, { countryCode: 'zzz', displayName: 'Nowhere' });
    expect(body().geographyContext).toEqual({ countryCode: 'ZZZ', displayName: 'Nowhere' });
  });

  it('every existing caller that passes no geography sends exactly what it sent before', async () => {
    const { body } = resolvedFetch();
    await analyzeNews('Ordinary question', 'en');
    expect(body()).toEqual({ query: 'Ordinary question', requestedLanguage: 'en' });
  });
});

describe('the in-flight identity: normalized countryCode only', () => {
  it('the same country with EN and PL display labels shares ONE in-flight request', async () => {
    const { fetchMock } = pendingFetch();
    const en = analyzeNews('Latest developments', 'en', undefined, undefined, undefined, {
      countryCode: 'PL',
      displayName: 'Poland',
    });
    const pl = analyzeNews('Latest developments', 'en', undefined, undefined, undefined, {
      countryCode: 'PL',
      displayName: 'Polska',
    });
    expect(pl).toBe(en);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ISO2 and ISO3 spellings of one governed country share one in-flight request', () => {
    const { fetchMock } = pendingFetch();
    const a = analyzeNews('Spelling test', 'en', undefined, undefined, undefined, { countryCode: 'pl', displayName: 'Poland' });
    const b = analyzeNews('Spelling test', 'en', undefined, undefined, undefined, { countryCode: 'POL', displayName: 'Poland' });
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('two different countries, or a country and no country, are different requests', () => {
    const { fetchMock } = pendingFetch();
    analyzeNews('Scope test', 'en', undefined, undefined, undefined, { countryCode: 'PL', displayName: 'Poland' });
    analyzeNews('Scope test', 'en', undefined, undefined, undefined, { countryCode: 'DE', displayName: 'Germany' });
    analyzeNews('Scope test', 'en');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('existing story, prior-question and selection key behavior is preserved', () => {
    const { fetchMock } = pendingFetch();
    const story = { title: 'A headline', articleId: 'art-1', countryCode: 'PL' };
    const s1 = analyzeNews('Keyed', 'en', story);
    const s2 = analyzeNews('Keyed', 'en', { ...story });
    const p1 = analyzeNews('Keyed', 'en', undefined, 'Earlier question');
    const p2 = analyzeNews('Keyed', 'en', undefined, 'Other earlier question');
    expect(s2).toBe(s1);
    expect(p2).not.toBe(p1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('precedence: never a combined scope', () => {
  it('a story context wins: the geography is not sent and does not enter the key', async () => {
    const { body, fetchMock } = resolvedFetch();
    const story = { title: 'Kenya election commission sets date', countryCode: 'KE' };
    await analyzeNews('What next?', 'en', story, undefined, undefined, { countryCode: 'PL', displayName: 'Poland' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body().storyContext).toEqual(story);
    expect(body()).not.toHaveProperty('geographyContext');
  });

  it('a selection is the whole scope: the geography is not sent', async () => {
    const { body } = resolvedFetch();
    await analyzeNews(
      'Summarize',
      'en',
      undefined,
      undefined,
      { action: 'SUMMARIZE', stories: [{ articleRef: 'a'.repeat(64), url: 'https://wire.example/a' }] },
      { countryCode: 'PL', displayName: 'Poland' },
    );
    expect(body()).toHaveProperty('selection');
    expect(body()).not.toHaveProperty('geographyContext');
  });
});
