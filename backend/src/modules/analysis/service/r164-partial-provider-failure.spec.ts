import {
  ANALYSIS_TOTAL_BUDGET_MS,
  resolveEvidenceState,
  type AnalysisRetrievalContext,
  type CountryNewsResponse,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { attachProviderFailures, type ProviderFailure } from '../../news/news.service';
import { observedRetrievalOf, retrievalIncomplete } from '../../ask-v2/retrieval-outcome';

/*
  CTO R164 P-2 — "✓ Sources searched · 0 matching reports" only after a COMPLETE, in-scope search found
  nothing. A provider failure travels from the retrieval to the reader state; the reader label
  (frontend askR2View) reads the same shared resolveEvidenceState asserted here.
*/
const ctx = (over: Partial<AnalysisRetrievalContext>) =>
  ({ dataMode: 'live', providers: ['gnews'], ...over }) as AnalysisRetrievalContext;
const outcome = (c: AnalysisRetrievalContext, articles = 0) =>
  observedRetrievalOf({ articles: Array(articles).fill({}), retrievalContext: c } as never)
    .retrievalOutcome;

describe('CTO R164 P-2 · outcome and reader state agree (fixtures)', () => {
  it('GNews 429 + GDELT 503 + one search answered empty → PARTIAL_NO_MATCH, limited (never "0 matching")', () => {
    const c = ctx({
      providers: ['publisher-feeds'],
      providerFailures: [
        { providerId: 'gnews', kind: 'rate-limited' },
        { providerId: 'gdelt-doc', kind: 'unreachable' },
      ],
      retrievalTrace: { candidatesSeen: 0 } as never,
    });
    expect(outcome(c)).toBe('PARTIAL_NO_MATCH');
    expect(resolveEvidenceState(c, 0)).toBe('degraded-fallback');
  });

  it('every lane refused on rights before the network → NOT_PERMITTED, not an outage', () => {
    const c = ctx({
      providers: [],
      providerFailures: [{ providerId: 'gnews', kind: 'rights-not-cleared' }],
    });
    expect(outcome(c)).toBe('NOT_PERMITTED');
    expect(resolveEvidenceState(c, 0)).not.toBe('degraded-fallback');
  });

  it('total outage → PROVIDER_FAILED, limited', () => {
    const c = ctx({ providers: [], providerFailures: [{ providerId: 'gnews', kind: 'timeout' }] });
    expect(outcome(c)).toBe('PROVIDER_FAILED');
    expect(resolveEvidenceState(c, 0)).toBe('degraded-fallback');
  });

  it('a complete search with nothing relevant → COMPLETED_NO_MATCH, the only "0 matching" state', () => {
    const c = ctx({ retrievalTrace: { candidatesSeen: 0 } as never });
    expect(outcome(c)).toBe('COMPLETED_NO_MATCH');
    expect(resolveEvidenceState(c, 0)).toBe('no-relevant-evidence');
  });

  it('one success with 3 items plus one failure → PARTIAL, disclosed as limited', () => {
    const c = ctx({
      providers: ['gdelt-doc'],
      providerFailures: [{ providerId: 'gnews', kind: 'quota' }],
    });
    expect(outcome(c, 3)).toBe('PARTIAL');
    expect(resolveEvidenceState(c, 3)).toBe('degraded-fallback');
  });

  it('no provider started → no outcome code (not "nothing found")', () => {
    expect(outcome(ctx({ retrievalAttempted: false } as never))).toBeNull();
  });

  it('NO_RELEVANT_EVIDENCE stamped over a provider error is still limited (P-2 relationship path)', () => {
    expect(
      resolveEvidenceState(
        ctx({ outcome: 'NO_RELEVANT_EVIDENCE', fallbackReason: 'provider-error' }),
        0,
      ),
    ).toBe('degraded-fallback');
  });
});

describe('CTO R164 P-2 · the country branch carries its provider failures', () => {
  const FAILURE = { providerId: 'gdelt-doc', kind: 'rate-limited' } as ProviderFailure;
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 300,
      openAiApiKey: undefined,
      rightsAudience: 'TEST_FIXTURE' as const,
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const empty: NewsResponse = {
    articles: [],
    totalResults: 0,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  };
  const country = (failures: ProviderFailure[]): CountryNewsResponse =>
    attachProviderFailures<CountryNewsResponse>(
      {
        countryCode: 'LBN',
        countryName: 'Lebanon',
        articles: [],
        totalResults: 0,
        providers: ['gnews'],
        dataMode: 'live',
        feedTier: 'delayed',
        providerDisplayName: 'GNews',
        generatedAt: new Date().toISOString(),
      },
      failures,
    );
  const service = (failures: ProviderFailure[]) =>
    new AnalysisService(
      {
        search: jest.fn().mockResolvedValue(empty),
        topHeadlines: jest.fn().mockResolvedValue(empty),
        findArticleById: jest.fn().mockResolvedValue(null),
      } as never,
      { getCountryNews: jest.fn().mockResolvedValue(country(failures)) } as never,
      new MockAnalysisProvider(),
      config,
    );

  it('GNews answered 0 while GDELT was rate-limited → incomplete, limited, never COMPLETED_NO_MATCH', async () => {
    const result = await service([FAILURE]).analyzeNews('What is happening in Lebanon?');
    expect(result.articles).toHaveLength(0);
    expect(result.retrievalContext.providerFailures).toEqual([
      { providerId: 'gdelt-doc', kind: 'rate-limited' },
    ]);
    expect(retrievalIncomplete(result as never)).toBe(true);
    expect(observedRetrievalOf(result as never).retrievalOutcome).not.toBe('COMPLETED_NO_MATCH');
    expect(result.retrievalContext.evidenceState).toBe('degraded-fallback');
  });

  it('control: the same country search with no failure stays a complete, empty search', async () => {
    const result = await service([]).analyzeNews('What is happening in Lebanon?');
    expect(result.retrievalContext.providerFailures).toBeUndefined();
    expect(result.retrievalContext.evidenceState).toBe('no-relevant-evidence');
  });
});
