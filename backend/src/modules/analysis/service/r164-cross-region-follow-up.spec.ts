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
  bodyAssertsEffectOf,
  impactSummaryCited,
  readFollowUpGeography,
  withoutImpactClaims,
  withoutRejectedPlaces,
} from '../query/follow-up-impact.util';
import { buildEvidenceReferences } from '../prompt/build-analysis-prompt.util';

describe('Politics RV-12a/b/c · effect lexicon and same-sentence linking (pure)', () => {
  it.each([
    'Kenyan importers face higher freight costs linked to the Gaza war.',
    'The Gaza war is raising fuel costs in Kenya.',
    'The conflict is driving fuel prices up in Kenya.',
    'Shipping delays tied to the war hit Mombasa.',
  ])('asserts an effect: %p', (sentence) => {
    expect(assertsImpact(sentence)).toBe(true);
  });

  it('a past-tense price decision stays a plain fact', () => {
    expect(assertsImpact('Kenya raised pump prices in its October review.')).toBe(false);
  });

  it('a link needs ONE body sentence naming the origin AND an effect (RV-12b)', () => {
    expect(
      bodyAssertsEffectOf(
        'Kenya energy regulator raised prices due to global oil costs and a weaker shilling.',
        ['gaza'],
      ),
    ).toBe(false);
    expect(
      bodyAssertsEffectOf('Kenya urged a Gaza truce. Fuel prices rose due to oil costs.', ['gaza']),
    ).toBe(false);
    expect(
      bodyAssertsEffectOf(
        'Kenya traders said the Gaza conflict has disrupted shipping and raised freight costs.',
        ['gaza'],
      ),
    ).toBe(true);
  });
});

describe('CTO R164 R-1 · cited effects (pure)', () => {
  it('"means cheaper" / "makes … more expensive" assert an effect', () => {
    expect(assertsImpact('The truce means cheaper fuel for Kenya.')).toBe(true);
    expect(assertsImpact('The war makes Kenyan imports more expensive.')).toBe(true);
  });

  it('affectedParties, differences and significance are filtered by citation too', () => {
    const analysis = {
      affectedParties: [
        {
          party: 'Kenyan exporters',
          effect: 'Shipping costs are rising due to the war',
          sourceArticleIds: ['x'],
        },
        { party: 'Tea farmers', effect: 'Shipping is disrupted', sourceArticleIds: ['link'] },
      ],
      differences: [
        {
          topic: 't',
          positions: [{ description: 'The war hurts Kenya', sourceArticleIds: ['x'] }],
        },
      ],
      significance: {
        level: 'high',
        rationale: [{ claim: 'It affects Kenya trade', sourceArticleIds: ['x'] }],
      },
    };
    const { analysis: out, removed } = withoutImpactClaims(analysis, new Set(['link']));
    expect(removed).toBe(3);
    expect(out.affectedParties.map((p) => p.party)).toEqual(['Tea farmers']);
    expect(out.differences).toEqual([]);
    expect(out.significance.rationale).toEqual([]);
  });

  it('a summary effect is cited only when every effect sentence is a statement citing a link', () => {
    const effect = 'The war disrupts Kenya tea shipments.';
    const citable = new Set(['link']);
    expect(impactSummaryCited(`Talks continue. ${effect}`, undefined, citable)).toBe(false);
    expect(
      impactSummaryCited(
        `Talks continue. ${effect}`,
        [{ text: effect, sourceArticleIds: ['link'] }],
        citable,
      ),
    ).toBe(true);
    expect(
      impactSummaryCited(
        `${effect} Fuel prices rise due to the war.`,
        [{ text: effect, sourceArticleIds: ['link'] }],
        citable,
      ),
    ).toBe(false);
    expect(impactSummaryCited('Talks continue.', undefined, citable)).toBe(true);
  });
});

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
  /* a Kenya report that names the earlier event: the only kind that may support an effect */
  linked: [
    art(
      'kl1',
      'Kenya tea exporters reroute shipments as Gaza war disrupts Red Sea route',
      'Kenya traders said the Gaza conflict has disrupted shipping and raised freight costs.',
      'KEN',
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

  it.each([
    'The Gaza war is driving fuel prices up in Kenya.',
    'The consequences for Kenya include higher shipping costs.',
    'This means higher prices for Kenyan importers.',
    'Kenya is exposed to the disruption of Red Sea shipping.',
    'The conflict raises prices across East Africa.',
  ])('impact language is recognised (Politics V-4): %s', (t) => {
    expect(assertsImpact(t)).toBe(true);
  });

  it('a plain report is not an impact claim', () => {
    expect(assertsImpact('Kenya raised pump prices in its October review.')).toBe(false);
  });

  it('"not only Kenya but also Uganda" rejects nothing (Politics V-5)', () => {
    const g = readFollowUpGeography(
      'What about not only Kenya but also Uganda?',
      'What happened in Gaza?',
    );
    expect(g.rejected).toEqual([]);
    expect(g.added.map((c) => c.iso3)).toEqual(expect.arrayContaining(['KEN', 'UGA']));
  });

  it('the correction searches the corrected place, not "No Kenya"', () => {
    expect(withoutRejectedPlaces('No, not Rwanda, Kenya.')).toBe('Kenya.');
  });
});

describe('CTO R164 P-1 · cross-region follow-up (service)', () => {
  it('Gaza → Kenya: both are searched; separate reporting on each side is NOT a linking report', async () => {
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
      state: 'NO_LINKING_REPORT',
      origin: ['PSE'],
      destination: ['KEN'],
      missing: [],
      linkingReports: 0,
      linkingReportIds: [],
    });
    expect(result.retrievalContext.verificationNotice).toBe('NOT_VERIFIED');
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

  it('a Kenya report naming the Gaza war AND asserting an effect is a LINKING report; an UNCITED effect is still withheld (R-1)', async () => {
    const { service, spy, real } = harness({ gaza: BY_PLACE.gaza!, kenya: BY_PLACE.linked! });
    spy.mockImplementation(async (input) => {
      const out = (await real(input)) as { summary: string };
      return {
        ...out,
        summary: `${out.summary} The Gaza war has disrupted freight for Kenya.`,
      } as never;
    });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.retrievalContext.impactEvidenceGap?.state).toBe('LINKING_REPORT_FOUND');
    expect(result.retrievalContext.impactEvidenceGap?.linkingReports).toBe(1);
    expect(result.retrievalContext.impactEvidenceGap?.linkingReportIds).toEqual(['kl1']);
    expect(result.analysis?.summary).toBe('');
    expect(result.analysis?.briefState?.reason).toMatch(/^UNCITED_IMPACT_CLAIM/);
  });

  it('R-1 · an effect sentence that CITES the linking report is shown', async () => {
    const { service, spy, real } = harness({ gaza: BY_PLACE.gaza!, kenya: BY_PLACE.linked! });
    spy.mockImplementation(async (input) => {
      const out = (await real(input)) as { summary: string };
      const ref = buildEvidenceReferences(input.articles).find((r) => r.articleId === 'kl1')!;
      const effect = 'Kenya tea exporters say the Gaza war has disrupted their Red Sea route.';
      return {
        ...out,
        summary: `${out.summary} ${effect}`,
        summaryStatements: [
          { text: effect, kind: 'REPORTED_CONSEQUENCE', evidenceIds: [ref.evidenceId] },
        ],
      } as never;
    });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.retrievalContext.impactEvidenceGap?.state).toBe('LINKING_REPORT_FOUND');
    expect(result.analysis?.summary).toMatch(/disrupted their Red Sea route/);
  });

  it('R-1 · list effects survive only when they cite the linking report', async () => {
    const { service, spy, real } = harness({ gaza: BY_PLACE.gaza!, kenya: BY_PLACE.linked! });
    spy.mockImplementation(async (input) => {
      const out = (await real(input)) as { keyFacts: Record<string, unknown>[] };
      const idOf = (id: string) =>
        buildEvidenceReferences(input.articles).find((r) => r.articleId === id)!.evidenceId;
      const base = out.keyFacts[0] ?? {};
      return {
        ...out,
        keyFacts: [
          ...out.keyFacts,
          {
            ...base,
            claim: 'The Gaza war disrupts Kenya tea shipments.',
            evidenceIds: [idOf('kl1')],
          },
          {
            ...base,
            claim: 'The Gaza war is driving fuel prices up in Kenya.',
            evidenceIds: [idOf('g1')],
          },
        ],
      } as never;
    });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    const facts = JSON.stringify(result.analysis?.keyFacts ?? []);
    expect(facts).toMatch(/disrupts Kenya tea shipments/);
    expect(facts).not.toMatch(/driving fuel prices up in Kenya/);
  });

  it('R-1 · an effect only in a HEADLINE (empty body) does not make a linking report', async () => {
    const headlineOnly = [art('kh1', 'Gaza war raises Kenya fuel costs', '', 'KEN')];
    const { service } = harness({
      gaza: BY_PLACE.gaza!,
      kenya: [...BY_PLACE.kenya!, ...headlineOnly],
    });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.retrievalContext.impactEvidenceGap?.linkingReportIds ?? []).not.toContain('kh1');
    expect(result.retrievalContext.impactEvidenceGap?.state).not.toBe('LINKING_REPORT_FOUND');
  });

  it('R-1 (Politics RV-8) · a report that merely CO-MENTIONS both places is not a link', async () => {
    const coMention = [
      art(
        'kc1',
        'Kenya calls for lasting Gaza ceasefire at UN',
        "Kenya's envoy urged a lasting ceasefire in Gaza at the UN General Assembly.",
        'KEN',
      ),
    ];
    const { service } = harness({ gaza: BY_PLACE.gaza!, kenya: coMention });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.retrievalContext.impactEvidenceGap?.state).toBe('NO_LINKING_REPORT');
    expect(result.retrievalContext.impactEvidenceGap?.linkingReports).toBe(0);
  });

  it('no linking report: the effect is removed from every list, not only the brief (Politics V-2/V-3)', async () => {
    const { service, spy, real } = harness(BY_PLACE);
    spy.mockImplementation(async (input) => {
      const out = (await real(input)) as { summary: string; keyFacts: { claim: string }[] };
      return {
        ...out,
        summary: `${out.summary} The Gaza war is driving fuel prices up in Kenya.`,
        keyFacts: [
          ...out.keyFacts,
          {
            ...(out.keyFacts[0] ?? {}),
            claim: 'Kenya is exposed to the Gaza war through fuel prices.',
          },
        ],
      } as never;
    });
    const result = await service.analyzeNews(
      'How does that affect Kenya?',
      'en',
      undefined,
      'What happened in Gaza?',
    );
    expect(result.analysis?.summary).toBe('');
    expect(result.analysis?.briefState?.reason).toMatch(/^NO_LINKING_REPORT/);
    expect(JSON.stringify(result.analysis?.keyFacts ?? [])).not.toMatch(/exposed to the Gaza war/);
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
