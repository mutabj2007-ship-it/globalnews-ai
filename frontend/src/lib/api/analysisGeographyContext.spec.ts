import type { AskGeographyContext } from '@globalnews-ai/shared';
import { analyzeNews, transportableGeographyContext } from './analysisApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP ASK GEOGRAPHY CONTEXT R1 — THE BROWSER TRANSPORT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `geographyContext: { countryCode, displayName }` travels beside (never
 * inside) storyContext. Staging a country is 0 requests; only an explicit
 * analyzeNews() call (Send / Run) reaches POST /analysis/news, once. The
 * display label is presentation only: it never distinguishes two requests.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function captureFetch(): {
  fetchMock: jest.Mock;
  body: (index?: number) => Record<string, unknown>;
} {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ analysis: null }),
  } as unknown as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return {
    fetchMock,
    body: (index = 0) => JSON.parse(fetchMock.mock.calls[index][1].body as string),
  };
}

const ALGERIA_EN: AskGeographyContext = { countryCode: 'DZA', displayName: 'Algeria' };
const ALGERIA_PL: AskGeographyContext = { countryCode: 'DZA', displayName: 'Algieria' };

describe('analyzeNews geographyContext transport', () => {
  it('geographyContext absent → the request body is exactly the pre-R1 shape', async () => {
    const { body } = captureFetch();
    await analyzeNews('Geography absent question', 'en');
    expect(body()).toEqual({ query: 'Geography absent question', requestedLanguage: 'en' });
  });

  it('staging a country (opening Ask, narrowing the context) issues no analysis request', () => {
    const { fetchMock } = captureFetch();
    const staged = transportableGeographyContext(ALGERIA_EN);
    expect(staged).toEqual({ countryCode: 'DZA', displayName: 'Algeria' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an explicit Send issues exactly one request, carrying geographyContext beside the question', async () => {
    const { fetchMock, body } = captureFetch();
    await analyzeNews('What is happening now?', 'en', undefined, undefined, undefined, ALGERIA_EN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body()).toEqual({
      query: 'What is happening now?',
      requestedLanguage: 'en',
      geographyContext: { countryCode: 'DZA', displayName: 'Algeria' },
    });
    expect(body()).not.toHaveProperty('storyContext');
  });

  it('never carries article/source/evidence/report/cluster identity or a prior answer', async () => {
    const { body } = captureFetch();
    const polluted = {
      ...ALGERIA_EN,
      articleId: 'a-1',
      sourceId: 'src-1',
      evidenceId: 'S1',
      reportId: 'r-1',
      clusterId: 'c-1',
      previousAnswer: 'PRIOR AI ANSWER',
      evidence: [{ id: 'S1' }],
    } as unknown as AskGeographyContext;
    await analyzeNews(
      'Polluted geography question',
      'en',
      undefined,
      undefined,
      undefined,
      polluted,
    );
    expect(body().geographyContext).toEqual({ countryCode: 'DZA', displayName: 'Algeria' });
  });

  it('a story context and a geography context are sent side by side, never merged', async () => {
    const { body } = captureFetch();
    await analyzeNews(
      'Side by side question',
      'en',
      { title: 'Rwanda story', countryCode: 'RWA' },
      undefined,
      undefined,
      ALGERIA_EN,
    );
    expect(body().storyContext).toEqual({ title: 'Rwanda story', countryCode: 'RWA' });
    expect(body().geographyContext).toEqual({ countryCode: 'DZA', displayName: 'Algeria' });
  });

  it('a double Send for the same country dedupes to one request even when only the label differs', async () => {
    const { fetchMock } = captureFetch();
    await Promise.all([
      analyzeNews('Label dedup question', 'en', undefined, undefined, undefined, ALGERIA_EN),
      analyzeNews('Label dedup question', 'en', undefined, undefined, undefined, {
        countryCode: 'DZA',
        displayName: 'Some other label',
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('different countries are different in-flight requests', async () => {
    const { fetchMock } = captureFetch();
    await Promise.all([
      analyzeNews('Country split question', 'en', undefined, undefined, undefined, ALGERIA_EN),
      analyzeNews('Country split question', 'en', undefined, undefined, undefined, {
        countryCode: 'MAR',
        displayName: 'Morocco',
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('EN/PL labels are presentation-only: the retrieval identifier sent is the same countryCode', async () => {
    const { body } = captureFetch();
    await analyzeNews('Latest developments', 'en', undefined, undefined, undefined, ALGERIA_EN);
    await analyzeNews('Najnowsze wydarzenia', 'pl', undefined, undefined, undefined, ALGERIA_PL);
    expect((body(0).geographyContext as AskGeographyContext).countryCode).toBe('DZA');
    expect((body(1).geographyContext as AskGeographyContext).countryCode).toBe('DZA');
    expect(body(1).requestedLanguage).toBe('pl');
  });

  it('an incomplete geography context is not sent at all', async () => {
    const { body } = captureFetch();
    await analyzeNews('Incomplete geography question', 'en', undefined, undefined, undefined, {
      countryCode: 'DZA',
      displayName: '  ',
    });
    expect(body()).not.toHaveProperty('geographyContext');
  });
});
