import { Injectable } from '@nestjs/common';
import type { NewsArticle } from '@globalnews-ai/shared';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';

/**
 * Produces a clearly-labeled demonstration analysis without calling any
 * external AI service. It's grounded in the real articles it's given
 * (real titles, real IDs, real source names) so it exercises the same
 * validation and rendering path as the live provider — it just never
 * claims to be real AI output. AnalysisService/the frontend are
 * responsible for surfacing analysisMode so this is never presented as
 * live analysis.
 */
@Injectable()
export class MockAnalysisProvider implements AnalysisProvider {
  readonly id = 'mock-analysis';
  readonly displayName = 'GlobalNews Mock Analysis';
  readonly isMock = true;

  async analyzeNews({ query, articles }: AnalysisProviderInput): Promise<unknown> {
    const top = articles.slice(0, 3);
    const ids = (list: NewsArticle[]) => list.map((a) => a.id);

    return {
      query,
      headline: top[0]?.title ?? `Coverage of "${query}"`,
      summary:
        'This is a demonstration analysis generated without a live AI provider. ' +
        `It summarizes ${articles.length} article(s) currently available for this question. ` +
        'Configure OPENAI_API_KEY to enable real analysis.',
      keyFacts: top.map((article) => ({
        claim: article.title,
        sourceArticleIds: [article.id],
      })),
      agreements:
        top.length > 1
          ? [
              {
                point: `Multiple outlets are covering "${top[0].title}".`,
                sourceArticleIds: ids(top),
              },
            ]
          : [],
      differences: [],
      unknowns: [
        'This is mock analysis \u2014 no live AI reasoning has been performed on these articles.',
      ],
      timeline: top.map((article) => ({
        timestamp: article.publishedAt,
        event: article.title,
        sourceArticleIds: [article.id],
      })),
      confidence: {
        level: 'low' as const,
        score: 20,
        explanation: 'Mock analysis mode does not perform real evidence assessment.',
      },
      entities: {
        countries: [],
        locations: [],
        people: [],
        organizations: Array.from(new Set(articles.map((a) => a.sourceName))).slice(0, 5),
        topics: Array.from(new Set(articles.map((a) => a.category))),
      },
    };
  }
}
