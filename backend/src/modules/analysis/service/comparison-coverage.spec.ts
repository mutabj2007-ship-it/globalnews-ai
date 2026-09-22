import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { AnalysisService } from './analysis.service';
import { attachProviderFailures } from '../../news/news.service';
import { classifyQueryIntent } from '../query/query-intent.util';
import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';
import { hasUnsupportedLocalReportingClaim } from '../validation/comparison-coverage.util';
import {
  comparisonCoverageLines,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';

const query =
  'Compare how current local reporting in Israel, Iran and Saudi Arabia is framing the same regional security developments. Tell me which countries and local sources GlobalNews AI actually checked, distinguish what the evidence supports from what it cannot establish, and explicitly identify any coverage gaps instead of treating a few retrieved articles as complete regional coverage.';
const story = { title: 'Pakistan security talks', countryCode: 'PAK', articleId: 'pakistan' };
function article(id: string, country: string): NewsArticle {
  return {
    id,
    title:
      country === 'Iran'
        ? 'Iran parliament debates nuclear inspection rules'
        : country + ' announces security talks',
    summary:
      country === 'Iran'
        ? 'Iran lawmakers proposed new limits on uranium monitoring by international inspectors.'
        : country +
          ' officials discussed regional security developments and diplomatic negotiations.',
    url: 'https://example.org/' + id,
    sourceId: 'wire',
    sourceName: 'International Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    publishedAtBasis: 'publisher',
  } as NewsArticle;
}
function response(articles: NewsArticle[], unavailable = false): NewsResponse {
  const value = {
    articles,
    totalResults: articles.length,
    providers: unavailable ? [] : ['gnews'],
    dataMode: unavailable ? 'unavailable' : 'live',
    fallbackReason: unavailable ? 'provider-error' : undefined,
    generatedAt: new Date().toISOString(),
  } as NewsResponse;
  return unavailable
    ? attachProviderFailures(value, [
        { providerId: 'gnews', kind: 'rate-limited' },
        { providerId: 'gdelt-doc', kind: 'timeout' },
      ])
    : value;
}
function harness(retained: NewsArticle[] = [], empty = false, maxArticles = 8) {
  const live = empty ? [] : [article('il', 'Israel')];
  const search = jest.fn(async (term: string) =>
    response(term === 'Israel' ? live : [], term === 'Saudi Arabia'),
  );
  const news = {
    search,
    topHeadlines: jest.fn(async () => response([])),
    findArticleById: jest.fn(async () => article('pakistan', 'Pakistan')),
    findRetainedByCountry: jest.fn(async (iso: string) => (iso === 'IR' ? retained : [])),
  };
  const analyzeNews = jest.fn(async (_input: AnalysisProviderInput) => {
    return new MockAnalysisProvider().analyzeNews(_input);
  });
  const country = { getCountryNews: jest.fn() };
  const config = {
    get: () => ({
      maxArticles,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: 60000,
      cacheTtlSeconds: 0,
      openAiModel: 'test',
      executionMode: 'development',
      retryAttempts: 0,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    news as never,
    country as never,
    { id: 'test', displayName: 'Test', isMock: true, analyzeNews },
    config,
  );
  return { service, news, country, analyzeNews };
}
describe('Ask comparison coverage truth', () => {
  it('accounts for Israel, Iran and unavailable Saudi Arabia despite stale Pakistan context', async () => {
    expect(classifyQueryIntent(query).intent).toBe('COMPARISON_RESEARCH');
    const h = harness();
    const result = await h.service.analyzeNews(query, 'en', story);
    const coverage = result.retrievalContext.comparisonCoverage!;
    expect(coverage.map((m) => m.countryName)).toEqual(['Israel', 'Iran', 'Saudi Arabia']);
    expect(coverage.map((m) => m.retrievalState)).toEqual([
      'LIVE_EVIDENCE',
      'NO_MATCHING_EVIDENCE',
      'PROVIDER_UNAVAILABLE',
    ]);
    expect(coverage.map((m) => m.finalQualifyingEvidenceCount)).toEqual([1, 0, 0]);
    expect(coverage[2].providers).toEqual(['gnews', 'gdelt-doc']);
    expect(coverage[2].providerFailureKinds).toEqual(['rate-limited', 'timeout']);
    expect(
      coverage.every(
        (m) =>
          m.requested &&
          m.liveRetrievalAttempted &&
          m.coverageGap &&
          m.localSourceProvenance === 'NOT_ESTABLISHED',
      ),
    ).toBe(true);
    expect(result.retrievalContext.storyContextUsed).toBe(false);
    expect(h.news.findArticleById).not.toHaveBeenCalled();
    expect(h.country.getCountryNews).not.toHaveBeenCalled();
    expect(h.news.search.mock.calls.map(([term]) => term)).toEqual([
      'Israel',
      'Iran',
      'Saudi Arabia',
    ]);
    expect(h.news.topHeadlines).not.toHaveBeenCalled();
    expect(h.news.findRetainedByCountry.mock.calls).toEqual([
      ['IR', 6, 2880],
      ['SA', 6, 2880],
    ]);
    expect(h.analyzeNews).toHaveBeenCalledTimes(1);
    expect(result.analysis).not.toBeNull();
    expect(h.analyzeNews.mock.calls[0][0].comparisonCoverage).toEqual(coverage);
    const input = h.analyzeNews.mock.calls[0][0];
    const prompt = buildAnalysisMessages(
      input.query,
      input.articles,
      1200,
      undefined,
      'en',
      undefined,
      undefined,
      coverage,
    );
    expect(prompt.system).toContain('Account for EVERY requested country');
    expect(prompt.system).toContain('Country relevance does not establish publisher locality');
    expect(prompt.system).toContain('Saudi Arabia');
    const lines = comparisonCoverageLines(coverage).join('\n');
    expect(lines).toContain('Iran: coverage gap');
    expect(lines).toContain('rate-limited');
    expect(lines).toContain('timed out');
    expect(
      hasUnsupportedLocalReportingClaim('Local reporting describes security fears.', coverage),
    ).toBe(true);
    expect(
      hasUnsupportedLocalReportingClaim('Local reporting cannot be established.', coverage),
    ).toBe(false);
    expect(hasUnsupportedLocalReportingClaim('Lokalne media opisują sytuację.', coverage)).toBe(
      true,
    );
    expect(comparisonCoverageLines(coverage, 'pl').join('\n')).toContain('Arabia Saudyjska');
  });
  it('uses bounded retained evidence for a missing member without another live request', async () => {
    const h = harness([article('ir', 'Iran'), article('unrelated', 'Canada')]);
    const result = await h.service.analyzeNews(query, 'en', story);
    const member = result.retrievalContext.comparisonCoverage![1];
    expect(member.retrievalState).toBe('RETAINED_ONLY');
    expect(member.usableRetainedEvidenceCount).toBe(1);
    expect(member.finalQualifyingEvidenceCount).toBe(1);
    expect(h.news.search).toHaveBeenCalledTimes(3);
    expect(h.analyzeNews).toHaveBeenCalledTimes(1);
    expect(comparisonCoverageLines([member])[0]).toContain('retained/stored');
  });
  it('does not label a mixed live/retained member total as all live', async () => {
    const h = harness();
    h.news.search.mockImplementationOnce(async () =>
      attachProviderFailures(response([article('il', 'Israel')]), [
        { providerId: 'gdelt-doc', kind: 'timeout' },
      ]),
    );
    h.news.findRetainedByCountry.mockImplementation(async (iso) =>
      iso === 'IL'
        ? [
            {
              ...article('il-stored', 'Israel'),
              title: 'Israel parliament approves emergency budget',
              summary: 'Israel lawmakers voted on public spending allocations in Jerusalem.',
            },
          ]
        : [],
    );
    const result = await h.service.analyzeNews(query, 'en', story);
    const member = result.retrievalContext.comparisonCoverage![0];
    expect(member.finalQualifyingEvidenceCount).toBe(2);
    expect(member.finalLiveEvidenceCount).toBe(1);
    expect(member.finalRetainedEvidenceCount).toBe(1);
    expect(comparisonCoverageLines([member])[0]).toContain('(live: 1, retained: 1)');
    expect(h.news.search).toHaveBeenCalledTimes(3);
    expect(h.analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('labels an entirely retained comparison as retained at both contract levels', async () => {
    const h = harness([article('ir', 'Iran')], true);
    const result = await h.service.analyzeNews(query, 'en', story);
    expect(result.retrievalContext.outcome).toBe('RETAINED_ONLY');
    expect(result.retrievalContext.dataMode).toBe('cached');
    expect(result.retrievalContext.comparisonCoverage![1].retrievalState).toBe('RETAINED_ONLY');
    expect(h.news.search).toHaveBeenCalledTimes(3);
    expect(h.news.findRetainedByCountry).toHaveBeenCalledTimes(3);
    expect(h.analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('counts final evidence after the cap and retains the missing-country record', async () => {
    const h = harness([article('ir', 'Iran')], false, 1);
    const result = await h.service.analyzeNews(query);
    const iran = result.retrievalContext.comparisonCoverage![1];
    expect(iran.usableRetainedEvidenceCount).toBe(1);
    expect(iran.finalQualifyingEvidenceCount).toBe(0);
    expect(iran.retrievalState).toBe('NO_MATCHING_EVIDENCE');
  });
  it.each(['en', 'pl'] as const)(
    'skips synthesis when all members have no evidence (%s)',
    async (language) => {
      const h = harness([], true);
      const result = await h.service.analyzeNews(query, language, story);
      expect(result.retrievalContext.comparisonCoverage).toHaveLength(3);
      expect(
        result.retrievalContext.comparisonCoverage!.every(
          (m) => m.finalQualifyingEvidenceCount === 0,
        ),
      ).toBe(true);
      expect(result.analysis).toBeNull();
      expect(result.provenance.status).toBe('not-attempted');
      expect(h.analyzeNews).not.toHaveBeenCalled();
      expect(h.news.findRetainedByCountry).toHaveBeenCalledTimes(3);
    },
  );
  it('accounts for all incident members in natural Polish without live retry', async () => {
    const h = harness([], true);
    const polishQuery = 'Porównaj relacje lokalnych mediów w Izraelu, Iranie i Arabii Saudyjskiej.';
    expect(classifyQueryIntent(polishQuery).countries.map((country) => country.iso3)).toEqual([
      'ISR',
      'IRN',
      'SAU',
    ]);
    const result = await h.service.analyzeNews(polishQuery, 'pl', story);
    expect(result.retrievalContext.comparisonCoverage?.map((member) => member.iso3)).toEqual([
      'ISR',
      'IRN',
      'SAU',
    ]);
    expect(h.news.topHeadlines).toHaveBeenCalledTimes(3);
    expect(h.news.search).not.toHaveBeenCalled();
    expect(h.news.findRetainedByCountry).toHaveBeenCalledTimes(3);
    expect(h.analyzeNews).not.toHaveBeenCalled();
  });

  it('withholds unsupported locality prose after one successful synthesis', async () => {
    const h = harness();
    h.analyzeNews.mockImplementationOnce(async (input) => ({
      ...((await new MockAnalysisProvider().analyzeNews(input)) as Record<string, unknown>),
      summary: 'Local reporting in Israel establishes a national consensus on regional security.',
    }));
    const result = await h.service.analyzeNews(query, 'en', story);
    expect(h.analyzeNews).toHaveBeenCalledTimes(1);
    expect(result.analysis?.summary).toBe('');
    expect(result.analysis?.briefState?.availability).toBe('withheld-non-compliant');
    expect(result.retrievalContext.comparisonCoverage).toHaveLength(3);
  });

  it('keeps more than three countries fail-closed', async () => {
    const h = harness();
    await h.service.analyzeNews('Compare Israel, Iran, Saudi Arabia and Turkey', 'en', story);
    expect(h.news.search).not.toHaveBeenCalled();
    expect(h.news.findRetainedByCountry).not.toHaveBeenCalled();
    expect(h.analyzeNews).not.toHaveBeenCalled();
  });
});
