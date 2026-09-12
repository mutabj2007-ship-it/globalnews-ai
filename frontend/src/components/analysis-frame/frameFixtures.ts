import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { findCountryByIso3 } from '@globalnews-ai/shared';

/**
 * Fixtures for the PAF acceptance suites.
 *
 * These are TEST INPUTS, never production data: nothing here is imported
 * by a component, and no fixture is ever rendered outside a spec. Each
 * one is shaped exactly like a real `AnalysisApiResponse` so the suites
 * exercise the real adapter rather than a convenient stand-in.
 */

export function article(i: number, over: Partial<NewsArticle> = {}): NewsArticle {
  const base = {
    id: `a${i}`,
    title: `Report ${i} title`,
    summary: `Report ${i} summary text.`,
    url: `https://example${i}.com/story-${i}`,
    sourceId: `src${i}`,
    sourceName: `Outlet ${i}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-23T09:00:00Z',
    sourceLanguage: 'en',
    ...over,
  } as NewsArticle;

  /*
   * SPATIAL M1.0B — FIXTURES MUST CARRY WHAT THE PRODUCER ACTUALLY EMITS.
   *
   * `withDerivedEvidenceFields` writes
   *   geographicPrecision: article.geographicPrecision ?? deriveGeographicPrecision({ countryCode })
   * on EVERY article, and `deriveGeographicPrecision` returns 'country' when a
   * countryCode is present and 'unknown' when it is not. So no article reaches
   * this frontend with the field absent.
   *
   * These fixtures omitted it, which was harmless while nothing read the field
   * and became misleading the moment something did: a fixture with a
   * countryCode but no precision describes a payload the backend does not
   * produce. Mirrored here rather than asserted around, so the suites keep
   * exercising a realistic response. An explicit `geographicPrecision` in
   * `over` still wins, so a test can still describe an unusual record on
   * purpose.
   */
  return base.geographicPrecision === undefined
    ? ({ ...base, geographicPrecision: base.countryCode ? 'country' : 'unknown' } as NewsArticle)
    : base;
}

export interface FixtureOptions {
  articleCount?: number;
  keyFactCount?: number;
  precision?: 'city' | 'country' | 'unresolved';
  city?: string;
  countryName?: string;
  countryCode?: string;
  analysisNull?: boolean;
  relational?: boolean;
  uncertainties?: number;
  matchedFrom?: string;
  canonicalLocation?: string;
  locations?: string[];
}

export function fixture(options: FixtureOptions = {}): AnalysisApiResponse {
  const {
    articleCount = 5, keyFactCount = 3, precision = 'city', city = 'kigali',
    countryName = 'Rwanda', countryCode = 'RWA', analysisNull = false,
    relational = false, uncertainties = 1, matchedFrom, canonicalLocation,
    locations = [],
  } = options;

  /*
   * SPATIAL M1.0B — "COUNTRY-LEVEL EVIDENCE" NOW MEANS THE ARTICLES CARRY IT.
   *
   * These fixtures gave the retrieval context a country and gave the ARTICLES
   * none, then asserted the frame drew that country at country level. That is
   * the borrowed-precision fallback the M1.0A contract forbids: a query's
   * geography attributed to articles that resolved nothing. It passed only
   * because the ceiling used to be `countries.length > 0`, which the
   * retrieval-filter entry alone could satisfy.
   *
   * A realistic country-aware response has both: `analysis.service.ts` sets
   * `retrievalContext.countryCode` behind `isCountryResponse`, and
   * `resolveArticleCountries` sets each article's own `countryCode` from the
   * article's own text. So when a fixture declares a country, its articles now
   * carry it too — which is what the suites that use it already SAY they are
   * describing ("country-only evidence", "Rwanda-only evidence").
   *
   * `precision: 'unresolved'` still produces articles with no country, because
   * that is the state it exists to describe.
   */
  const articleIso2 =
    precision === 'unresolved' ? undefined : findCountryByIso3(countryCode)?.iso2;

  const articles = Array.from({ length: articleCount }, (_, i) =>
    article(i + 1, articleIso2 === undefined ? {} : { countryCode: articleIso2, countryName }),
  );

  const keyFacts = Array.from({ length: keyFactCount }, (_, i) => ({
    claim: `Key fact ${i + 1} stated by the evidence.`,
    sourceArticleIds: [articles[i % Math.max(1, articles.length)]?.id ?? 'a1'],
    evidenceBreadth: 'single-article' as const,
  }));

  const analysis = analysisNull
    ? null
    : ({
        query: 'q',
        headline: 'District health programme expansion announced',
        summary:
          'A paragraph of orientation prose that runs to several sentences. It is the expanded brief. It must never be sliced to make a clause.',
        keyFacts,
        agreements: [],
        differences: [],
        unknowns: [],
        uncertainties: Array.from({ length: uncertainties }, (_, i) => ({
          description: `Open question ${i + 1}.`,
          sourceArticleIds: [],
        })),
        timeline: [],
        confidence: { level: 'medium', score: 60, explanation: 'ok' },
        entities: { countries: [countryName], locations, people: [], organizations: [], topics: [] },
        sources: articles.map((a) => ({
          articleId: a.id, publisher: a.sourceName, title: a.title, url: a.url, publishedAt: a.publishedAt,
        })),
        generatedAt: '2026-08-24T09:00:00Z',
        analysisMode: 'live-ai',
        trustState: {
          level: 'moderate', reasons: ['multiple-distinct-articles'],
          distinctSourceArticleCount: Math.min(keyFactCount, articleCount),
          differenceTopicCount: 0, uncertaintyCount: uncertainties,
        },
        context: [], relevance: [], affectedParties: [], immediateImpacts: [],
        spilloverImplications: [], significance: null, watchNext: [],
        ...(relational
          ? {
              relationalComposition: {
                directionalEligibility: 'supported',
                evidenceSufficiency: 'adequate',
                summary: 'The evidence describes coffee prices affecting export revenue, not the reverse.',
                supportingClaims: [], reverseClaims: [], associationOnlyClaims: [],
                mixedClaims: [], unclearOrNonSubstantiveClaims: [],
              },
            }
          : {}),
      } as unknown);

  return {
    query: 'What is happening in Kigali, Rwanda?',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    normalizedQuery: 'what is happening in kigali, rwanda',
    analysis,
    articles,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews'],
      articlesRetrieved: articles.length,
      ...(precision === 'city' ? { city } : {}),
      ...(precision === 'unresolved' ? {} : { countryName, countryCode }),
      ...(matchedFrom !== undefined ? { matchedFrom } : {}),
      ...(canonicalLocation !== undefined ? { canonicalLocation } : {}),
    },
    sourceEntities: { organizations: [] },
    provenance: { status: analysisNull ? 'failed' : 'success', cached: false },
    sourceDiversity: {
      retrievedArticleCount: articles.length,
      reportingClusterCount: Math.max(1, articles.length - 1),
      duplicateLikeClusterCount: articles.length > 1 ? 1 : 0,
      largestClusterSize: articles.length > 1 ? 2 : 1,
      knownDomainCount: articles.length,
      unknownDomainArticleCount: 0,
      distinctSourceNameCount: articles.length,
    },
  } as unknown as AnalysisApiResponse;
}

/**
 * THE MUSANZE CASE (PAF test 15).
 *
 * The question names Musanze. The retrieval context is exactly what the
 * real resolver produces for it: country precision, NO city key. This is
 * not a contrived shape — I executed `detectLocation("What is happening
 * in Musanze, Rwanda?")` against the real resolver and it returns
 * `{ country: RWA, city: undefined }`, and `CountryNewsResponse` then
 * omits `city` entirely (`...(city ? { city } : {})`).
 */
export function musanzeFixture(): AnalysisApiResponse {
  const base = fixture({ precision: 'country', countryName: 'Rwanda', countryCode: 'RWA' });
  return {
    ...base,
    query: 'What is happening in Musanze, Rwanda?',
    normalizedQuery: 'what is happening in musanze, rwanda',
  } as AnalysisApiResponse;
}
