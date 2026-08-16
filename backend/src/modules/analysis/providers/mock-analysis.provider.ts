import { Injectable } from '@nestjs/common';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { buildEvidenceReferences } from '../prompt/build-analysis-prompt.util';

/**
 * Milestone #47 — the small, closed set of demonstration-prose strings
 * this provider needs, for exactly the two implemented UI languages.
 * NOT a general translation table and NOT reused for source
 * titles/names/quotations — those always come from the real `articles`
 * input, verbatim, in whatever language they actually are, regardless
 * of `responseLanguage`. Unimplemented languages (sw/fr/es/ar/rw) fall
 * back to English demonstration prose — a defensive default, never a
 * claim that those languages have real mock translations.
 */
const MOCK_STRINGS: Record<
  'en' | 'pl',
  {
    summaryIntro: string;
    summaryMiddle: (count: number) => string;
    summaryOutro: string;
    agreementPoint: (title: string) => string;
    unknown: string;
    uncertainty: string;
    confidenceExplanation: string;
  }
> = {
  en: {
    summaryIntro: 'This is a demonstration analysis generated without a live AI provider.',
    summaryMiddle: (count) =>
      `It summarizes ${count} article(s) currently available for this question.`,
    summaryOutro: 'Configure OPENAI_API_KEY to enable real analysis.',
    agreementPoint: (title) => `Multiple outlets are covering "${title}".`,
    unknown:
      'This is mock analysis \u2014 no live AI reasoning has been performed on these articles.',
    uncertainty: 'This is mock analysis \u2014 no live evidence assessment has been performed.',
    confidenceExplanation: 'Mock analysis mode does not perform real evidence assessment.',
  },
  pl: {
    summaryIntro:
      'To jest analiza demonstracyjna wygenerowana bez użycia rzeczywistego dostawcy AI.',
    summaryMiddle: (count) =>
      `Podsumowuje ${count} artykuł(y/ów) obecnie dostępnych dla tego pytania.`,
    summaryOutro: 'Skonfiguruj OPENAI_API_KEY, aby włączyć rzeczywistą analizę.',
    agreementPoint: (title) => `Wiele redakcji relacjonuje temat: "${title}".`,
    unknown:
      'To jest analiza demonstracyjna \u2014 nie przeprowadzono rzeczywistego wnioskowania AI na tych artykułach.',
    uncertainty:
      'To jest analiza demonstracyjna \u2014 nie przeprowadzono rzeczywistej oceny dowodów.',
    confidenceExplanation:
      'Tryb analizy demonstracyjnej nie przeprowadza rzeczywistej oceny dowodów.',
  },
};

function resolveMockStrings(language: LanguageCode | undefined): (typeof MOCK_STRINGS)['en'] {
  return language === 'pl' ? MOCK_STRINGS.pl : MOCK_STRINGS.en;
}

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
 *
 * Milestone #47 (runtime correction) — demonstration PROSE (summary,
 * agreement point, unknowns, uncertainty text, confidence explanation)
 * now respects `responseLanguage` for 'pl', matching the live
 * provider's own response-language behavior. Deliberately does NOT
 * touch `headline` (always `top[0]?.title`, the real article's own
 * title, verbatim) or `entities.organizations` (real `sourceName`
 * values) — those must never be presented as translated, since they
 * are not; only the mock provider's OWN invented demonstration
 * sentences are ever localized. Remains fully deterministic — no
 * randomness, no external call — and continues to satisfy the
 * unmodified validator exactly as before.
 */
@Injectable()
export class MockAnalysisProvider implements AnalysisProvider {
  readonly id = 'mock-analysis';
  readonly displayName = 'GlobalNews Mock Analysis';
  readonly isMock = true;

  async analyzeNews({
    query,
    articles,
    responseLanguage,
  }: AnalysisProviderInput): Promise<unknown> {
    const strings = resolveMockStrings(responseLanguage);

    const evidenceByArticleId = new Map(
      buildEvidenceReferences(articles).map((ref) => [ref.articleId, ref.evidenceId]),
    );
    const evidenceIdFor = (article: NewsArticle): string =>
      evidenceByArticleId.get(article.id) as string;

    const top = articles.slice(0, 3);
    const evidenceIds = (list: NewsArticle[]) => list.map(evidenceIdFor);

    return {
      query,
      headline: top[0]?.title ?? `Coverage of "${query}"`,
      summary: `${strings.summaryIntro} ${strings.summaryMiddle(articles.length)} ${strings.summaryOutro}`,
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
      // Milestone #62 Phase 1 — the mock provider deliberately does
      // NOT fabricate background reasoning or importance claims, for
      // the same reason it already returns `differences: []` above:
      // genuine synthesis is exactly what mock mode is honestly
      // declining to simulate. This also exercises the real
      // "insufficient evidence -> empty array -> section doesn't
      // render" path in the frontend, which is worth proving even in
      // mock mode.
      context: [],
      relevance: [],
      // Milestone #62 Phase 2 — same honest-empty pattern as Phase 1's
      // context/relevance: the mock never fabricates affected-party
      // analysis, immediate-impact claims, or spillover reasoning.
      affectedParties: [],
      immediateImpacts: [],
      spilloverImplications: [],
      // Milestone #62 Phase 3 — mock mode never fabricates a severity
      // judgment. null, always.
      significance: null,
      // Milestone #62 Phase 4 (final) — mock mode never fabricates
      // forthcoming intelligence. [], always.
      watchNext: [],
      agreements:
        top.length > 1
          ? [
              {
                point: strings.agreementPoint(top[0].title),
                evidenceIds: evidenceIds(top),
              },
            ]
          : [],
      differences: [],
      unknowns: [strings.unknown],
      uncertainties: [
        {
          description: strings.uncertainty,
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
        explanation: strings.confidenceExplanation,
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
