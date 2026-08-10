import { Injectable } from '@nestjs/common';
import type { NewsArticle } from '@globalnews-ai/shared';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { buildEvidenceReferences } from '../prompt/build-analysis-prompt.util';

/**
 * Produces a clearly-labeled demonstration analysis without calling any
 * external AI service. It's grounded in the real articles it's given
 * (real titles, real source names) so it exercises the same validation
 * and rendering path as the live provider — it just never claims to be
 * real AI output.
 *
 * Milestone #31: like the live OpenAI provider, this must cite sources
 * using request-local evidenceIds (S1/S2/...) rather than real article
 * IDs — AnalysisService's validator only trusts evidenceIds that
 * resolve against the evidence map it builds itself from the same
 * input array (see build-analysis-prompt.util.ts /
 * validate-analysis-result.ts). Computing the same
 * buildEvidenceReferences() over the same `articles` array the caller
 * passed in guarantees this provider's S-labels agree with the
 * validator's, without either side needing to share any other state.
 */
@Injectable()
export class MockAnalysisProvider implements AnalysisProvider {
  readonly id = 'mock-analysis';
  readonly displayName = 'GlobalNews Mock Analysis';
  readonly isMock = true;

  async analyzeNews({ query, articles }: AnalysisProviderInput): Promise<unknown> {
    const evidenceByArticleId = new Map(
      buildEvidenceReferences(articles).map((ref) => [ref.articleId, ref.evidenceId]),
    );
    const evidenceIdFor = (article: NewsArticle): string => evidenceByArticleId.get(article.id) as string;

    const top = articles.slice(0, 3);
    const evidenceIds = (list: NewsArticle[]) => list.map(evidenceIdFor);

    return {
      query,
      headline: top[0]?.title ?? `Coverage of "${query}"`,
      summary:
        'This is a demonstration analysis generated without a live AI provider. ' +
        `It summarizes ${articles.length} article(s) currently available for this question. ` +
        'Configure OPENAI_API_KEY to enable real analysis.',
      // Milestone #32: excerpted verbatim from the article's own
      // title so it deterministically exists within the truncated
      // evidence text the validator checks against — this provider's
      // evidenceBasis is demo/test data only; it carries no special
      // trust and is validated exactly like a live provider's would
      // be (see validate-analysis-result.ts resolveEvidenceBasis()).
      keyFacts: top.map((article) => ({
        claim: article.title,
        evidenceIds: [evidenceIdFor(article)],
        evidenceBasis: {
          evidenceId: evidenceIdFor(article),
          excerpt: article.title,
        },
      })),
      agreements:
        top.length > 1
          ? [
              {
                point: `Multiple outlets are covering "${top[0].title}".`,
                evidenceIds: evidenceIds(top),
              },
            ]
          : [],
      differences: [],
      unknowns: [
        'This is mock analysis \u2014 no live AI reasoning has been performed on these articles.',
      ],
      uncertainties: [
        {
          description:
            'This is mock analysis \u2014 no live evidence assessment has been performed.',
          evidenceIds: [],
        },
      ],
      timeline: top.map((article) => ({
        timestamp: article.publishedAt,
        event: article.title,
        evidenceIds: [evidenceIdFor(article)],
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
