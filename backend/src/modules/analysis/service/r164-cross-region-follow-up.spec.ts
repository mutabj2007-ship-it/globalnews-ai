import {
  ANALYSIS_TOTAL_BUDGET_MS,
  type CountryNewsResponse,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import {
  assertsImpact,
  readFollowUpGeography,
  withoutRejectedPlaces,
} from '../query/follow-up-impact.util';

/*
  CTO R164 P-1 — a cross-region follow-up searches the earlier event AND the place it names; a missing
  side is BILATERAL_EVIDENCE_GAP and no cause-and-effect claim is shown. Offline: mocked retrieval
  (each search returns the reporting for the place it names), MockAnalysisProvider, no network or DB.
*/
const fresh = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const art = (id: string, title: string, summary: string, cc?: string): NewsArticle => ({
  id,
  title,
  summary,
  url: `https://www.${id}.example/${id}`,
  sourceId: `src-${id}`,
  sourceName: `Outlet ${id}`,
  category: 'world',
  sourcesCount: 1,
  publishedAt: fresh(3),
  publishedAtBasis: 'publisher',
  sourceLanguage: 'en',
  ...(cc ? { countryCode: cc } : {}),
});

const BY_PLACE: Record<string, NewsArticle[]> = {
  gaza: [
    art(
      'g1',
      'Gaza ceasefire holds for third day as aid trucks enter',
      'The Gaza truce largely holds, mediators said.',
    ),
    art(
      'g2',
      'Strike in Gaza strains the ceasefire',
      'The Gaza ceasefire faces strain after a strike in Khan Younis.',
    ),
  ],
  kenya: [
    art(
      'k1',
      'Kenya fuel prices rise in October review',
      'Kenya energy regulator raised pump prices citing global oil costs.',
      'KEN',
    ),
    art(
      'k2',
      'Kenyan shilling steady against the dollar',
      'Kenya central bank said reserves remain adequate.',
      'KEN',
    ),
  ],
  kyiv: [
    art(
      'u1',
      'Drone strikes hit Kyiv overnight',
      'Kyiv officials reported damage to energy sites in Ukraine.',
    ),
  ],
  poland: [
    art(
      'p1',
      'Poland raises air defence readiness',
      'Poland said its air defences were placed on alert.',
      'POL',
    ),
  ],
};

function harness(places: Record<string, NewsArticle[]>) {
  const searched: string[] = [];
  const res = (articles: NewsArticle[]): NewsResponse => ({
    articles,
    totalResults: articles.length,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  });
  const search = jest.fn(async (q: string) => {
    searched.push(q);
    const key = Object.keys(places).find((k) => q.toLowerCase().includes(k));
    return res(key === undefined ? [] : places[key]!);
  });
  const country = (iso3: string): CountryNewsResponse => ({
    countryCode: iso3,
    countryName: iso3,
    articles: [],
    totalResults: 0,
    providers: ['gnews'],
    dataMode: 'live',
    feedTier: 'delayed',
    providerDisplayName: 'GNews',
    generatedAt: new Date().toISOString(),
  });
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
  const provider = new MockAnalysisProvider();
  const real = provider.analyzeNews.bind(provider);
  const spy = jest.spyOn(provider, 'analyzeNews');
  const service = new AnalysisService(
    {
      search,
      topHeadlines: jest.fn().mockResolvedValue(res([])),
      findArticleById: jest.fn().mockResolvedValue(null),
    } as never,
    { getCountryNews: jest.fn(async (iso: string) => country(iso)) } as never,
    provider,
    config,
  );
  return { service, searched, spy, real };
}

describe('CTO R164 P-1 · follow-up geography (pure)', () => {
  it.each([
    ['How does that affect Kenya?', 'What happened in Gaza?', ['PSE'], ['KEN'], [], false],
    [
      'What does that mean for Poland?',
      'What happened in Kyiv overnight?',
      ['UKR'],
      ['POL'],
      [],
      false,
    ],
    [
      'How does that affect South Sudan?',
      'What is happening in Sudan?',
      ['SDN'],
      ['SSD'],
      [],
      false,
    ],
    [
      'No, not Rwanda, Kenya.',
      "What's happening in Rwanda this week?",
      ['RWA'],
      ['KEN'],
      ['RWA'],
      true,
    ],
    ['And yesterday?', 'What happened in Gaza?', ['PSE'], [], [], false],
  ])('%s (after %s)', (followUp, prior, origin, added, rejected, correction) => {
    const g = readFollowUpGeography(followUp, prior);
    expect(g.origin.map((c) => c.iso3)).toEqual(origin);
    expect(g.added.map((c) => c.iso3)).toEqual(added);
    expect(g.rejected.map((c) => c.iso3)).toEqual(rejected);
    expect(g.correction).toBe(correction);
  });

  it('a rejected place is removed from the words that are searched', () => {
    expect(withoutRejectedPlaces('No, not Rwanda, Kenya.')).not.toMatch(/Rwanda/);
    expect(withoutRejectedPlaces('No, not Rwanda, Kenya.')).toMatch(/Kenya/);
  });

  it('impact language is recognised; a plain report is not', () => {
    expect(assertsImpact('The Gaza war is driving fuel prices up in Kenya.')).toBe(true);
    expect(assertsImpact('Kenya raised pump prices in its October review.')).toBe(false);
  });
});

describe('CTO R164 P-1 · cross-region follow-up (service)', () => {
  it('Gaza → Kenya: both the earlier event and Kenya are searched; both evidenced, guard on', async () => {
    const { service, searched, spy } = harness(BY_PLACE);
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(searched.some((q) => /gaza/i.test(q))).toBe(true);
    expect(searched.some((q) => /kenya/i.test(q))).toBe(true);
    expect(result.articles.map((a) => a.id)).toEqual(expect.arrayContaining(['g1', 'k1']));
    expect(result.retrievalContext.impactEvidenceGap).toEqual({
      state: 'BOTH_SIDES_EVIDENCED',
      origin: ['PSE'],
      destination: ['KEN'],
      missing: [],
    });
    const input = spy.mock.calls.at(-1)?.[0] as { evidenceLinkageGuard?: boolean };
    expect(input.evidenceLinkageGuard).toBe(true);
  });

  it('Gaza → Kenya with no Kenya reporting: BILATERAL_EVIDENCE_GAP, coverage incomplete, never Gaza-only as complete', async () => {
    const { service } = harness({ gaza: BY_PLACE.gaza! });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.retrievalContext.impactEvidenceGap?.state).toBe('BILATERAL_EVIDENCE_GAP');
    expect(result.retrievalContext.impactEvidenceGap?.missing).toEqual(['KEN']);
    expect(result.retrievalContext.verificationNotice).toBe('COVERAGE_INCOMPLETE');
  });

  it('with a side missing, a brief asserting an effect is withheld (deterministic, not the prompt)', async () => {
    const { service, spy, real } = harness({ gaza: BY_PLACE.gaza! });
    spy.mockImplementation(async (input) => {
      const out = (await real(input)) as { summary: string };
      return { ...out, summary: `${out.summary} The Gaza war is hurting Kenyan trade.` } as never;
    });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.analysis?.summary).toBe('');
    expect(result.analysis?.briefState?.reason).toMatch(/^BILATERAL_EVIDENCE_GAP/);
  });

  it('Kyiv → Poland: Poland is searched alongside the earlier event', async () => {
    const { service, searched, spy } = harness(BY_PLACE);
    const result = await service.analyzeNews(
      'What does that mean for Poland?',
      'en',
      undefined,
      'What happened in Kyiv overnight?',
    );
    expect(searched.some((q) => /poland/i.test(q))).toBe(true);
    expect(result.retrievalContext.impactEvidenceGap?.destination).toEqual(['POL']);
    expect(
      (spy.mock.calls.at(-1)?.[0] as { evidenceLinkageGuard?: boolean }).evidenceLinkageGuard,
    ).toBe(true);
  });

  it('a correction never searches the rejected place: "No, not Rwanda, Kenya."', async () => {
    const { service, searched } = harness(BY_PLACE);
    const result = await service.analyzeNews(
      'No, not Rwanda, Kenya.',
      'en',
      undefined,
      "What's happening in Rwanda this week?",
    );
    expect(searched.some((q) => /rwanda/i.test(q))).toBe(false);
    expect(result.retrievalContext.impactEvidenceGap).toBeUndefined();
  });

  it('a purely anaphoric follow-up ("And yesterday?") adds no place and no gap record', async () => {
    const { service, searched } = harness(BY_PLACE);
    const result = await service.analyzeNews(
      'And yesterday?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(searched.some((q) => /kenya|poland/i.test(q))).toBe(false);
    expect(result.retrievalContext.impactEvidenceGap).toBeUndefined();
  });
});
