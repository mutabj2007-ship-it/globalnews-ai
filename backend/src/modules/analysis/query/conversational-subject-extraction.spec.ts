import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import type { AnalysisProvider } from '../interfaces';
import {
  deriveGenericNewsQuery,
  makeProviderSafeNewsQuery,
} from './derive-generic-news-query.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { resolvePrimaryCountry } from '../../news/country/country-relevance.util';
import { AnalysisService } from '../service/analysis.service';
import type { AnalysisConfigService } from '../config/analysis-config.service';

/**
 * G-ALPHA-1 D2 — CONVERSATIONAL SUBJECT EXTRACTION.
 *
 * THE REPORTED DEFECT. "What do you know about President Donald Trump?" matched
 * no subject-extraction pattern, so the safety fallback returned the whole
 * sentence — and that sentence became BOTH the phrase sent to the provider AND
 * the phrase the multi-word relevance gate requires verbatim inside a headline.
 * No article contains it, so every article the provider returned was rejected
 * and the question could only ever answer zero. Measured on the shipped code
 * before this change:
 *
 *   derived -> "What do you know about President Donald Trump"
 *   [REJECT] Trump says tariffs will return in January
 *   [REJECT] Donald Trump addresses rally in Ohio
 *   [REJECT] President Donald Trump comments on the budget
 *
 * WHAT IS AND IS NOT BEING FIXED. Three patterns were added. NO relevance
 * threshold moved, no stemming or stopword removal was introduced, and the
 * strictness of scoreGenericRelevance is asserted below to be exactly what it
 * was — an article that names only "Trump" is still rejected for the subject
 * "President Donald Trump", and that is the intended, honest behaviour.
 */

const TRUMP_QUESTION = 'What do you know about President Donald Trump?';

function headline(
  title: string,
  summary = 'Summary text.',
): Pick<NewsArticle, 'title' | 'summary' | 'category'> {
  return { title, summary, category: 'politics' };
}

describe('D2 — the reported question now yields a SUBJECT, not the whole sentence', () => {
  it('"What do you know about X?" extracts X', () => {
    expect(deriveGenericNewsQuery(TRUMP_QUESTION)).toBe('President Donald Trump');
  });

  it('the phrase actually SENT to the provider is the subject too', () => {
    const derived = deriveGenericNewsQuery(TRUMP_QUESTION);

    expect(makeProviderSafeNewsQuery(derived)).toBe('President Donald Trump');
  });

  it('the whole interrogative sentence is no longer the search phrase', () => {
    const derived = deriveGenericNewsQuery(TRUMP_QUESTION);

    expect(derived).not.toContain('What do you know');
    expect(derived.split(/\s+/)).toHaveLength(3);
  });

  it('covers the rest of the same family', () => {
    expect(deriveGenericNewsQuery('What do you know of the NATO summit?')).toBe('NATO summit');
    expect(deriveGenericNewsQuery('What can you tell me about semiconductor exports?')).toBe(
      'semiconductor exports',
    );
    expect(deriveGenericNewsQuery('What can you say about the oil price cap?')).toBe(
      'oil price cap',
    );
    expect(deriveGenericNewsQuery('Do you know anything about the Rwanda election?')).toBe(
      'Rwanda election',
    );
    expect(deriveGenericNewsQuery('Do you know much about Kenyan monetary policy?')).toBe(
      'Kenyan monetary policy',
    );
  });

  it('"Tell me about X" was ALREADY covered by Milestone #46 and still is — no duplicate rule', () => {
    // Recorded deliberately: the approval named this shape, the repository
    // already handled it, and adding a second pattern for it would have been a
    // second place for one rule to drift.
    expect(deriveGenericNewsQuery('Tell me about the Rwanda election')).toBe('Rwanda election');
  });
});

describe('D2 — the extracted subject makes real reporting reachable again', () => {
  const subject = deriveGenericNewsQuery(TRUMP_QUESTION);

  it('an article that names the subject is now ACCEPTED, where nothing could be before', () => {
    const result = scoreGenericRelevance(
      headline('President Donald Trump comments on the budget'),
      subject,
    );

    expect(result.isRelevant).toBe(true);
  });

  it('accepts a summary match as well as a title match', () => {
    const result = scoreGenericRelevance(
      headline('Budget talks stall', 'President Donald Trump said the proposal was unacceptable.'),
      subject,
    );

    expect(result.isRelevant).toBe(true);
  });

  it('THE GATE IS NOT WEAKENED — a partial name is still rejected', () => {
    // This is the honest residual and it is asserted, not glossed over: the
    // multi-word rule still demands the whole phrase, so an article that says
    // only "Trump" does not qualify as evidence for "President Donald Trump".
    expect(
      scoreGenericRelevance(headline('Trump says tariffs will return in January'), subject)
        .isRelevant,
    ).toBe(false);

    expect(
      scoreGenericRelevance(headline('Donald Trump addresses rally in Ohio'), subject).isRelevant,
    ).toBe(false);
  });

  it('an unrelated article is still rejected', () => {
    expect(
      scoreGenericRelevance(headline('Rainfall was above average in the region'), subject)
        .isRelevant,
    ).toBe(false);
  });
});

describe('D2 — the safety invariants of the pattern list are untouched', () => {
  it('an already-concise query is a no-op', () => {
    expect(deriveGenericNewsQuery('NATO')).toBe('NATO');
    expect(deriveGenericNewsQuery('East Africa')).toBe('East Africa');
    expect(deriveGenericNewsQuery('President Donald Trump')).toBe('President Donald Trump');
  });

  it('an unmatched sentence is returned intact, never emptied or mangled', () => {
    expect(deriveGenericNewsQuery('What is quantum?')).toBe('What is quantum');
    expect(deriveGenericNewsQuery('Which country is more powerful in East Africa?')).toBe(
      'Which country is more powerful in East Africa',
    );
  });

  it('the result is never empty and never longer than the input', () => {
    for (const question of [
      TRUMP_QUESTION,
      'Tell me about the Rwanda election',
      'What do you know about X',
      'NATO',
      '',
    ]) {
      const derived = deriveGenericNewsQuery(question);
      expect(derived.length).toBeLessThanOrEqual(question.length);
      if (question.trim().length > 0) expect(derived.length).toBeGreaterThan(0);
    }
  });

  it('a bare pattern prefix with no subject does not match, and is left alone', () => {
    expect(deriveGenericNewsQuery('What do you know')).toBe('What do you know');
  });
});

describe('D2 — ZERO RETAINED EVIDENCE STILL MEANS NO OPENAI CALL', () => {
  it('the conversational question with no evidence never reaches the analysis provider', async () => {
    const newsService = {
      search: jest.fn().mockResolvedValue({
        articles: [] as NewsArticle[],
        totalResults: 0,
        providers: ['mock-wire'],
        dataMode: 'mock',
        generatedAt: new Date().toISOString(),
      } as NewsResponse),
    };

    const countryNewsService = {
      getCountryNews: jest.fn().mockResolvedValue({
        countryCode: 'ESP',
        countryName: 'Spain',
        articles: [],
        totalResults: 0,
        providers: ['mock-wire'],
        dataMode: 'mock',
        generatedAt: new Date().toISOString(),
      } as unknown as CountryNewsResponse),
    };

    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn(),
    };

    const config = {
      get: () => ({
        maxArticles: 8,
        maxArticleChars: 1200,
        timeoutMs: 20000,
        /*
          REV B — STATED, NOT INHERITED. AnalysisService arms its total response
          deadline from this field. Every double in this repository predates it, so
          each one silently supplied `undefined`; `withResponseDeadline` now resolves
          that to the shared authority rather than to an accidental zero, but a test
          that exercises the real service should say which budget it is running
          under rather than rely on a fallback. This is the shipped value, so no
          existing timing expectation changes.
        */
        totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
        cacheTtlSeconds: 300,
        openAiApiKey: undefined,
        openAiModel: 'gpt-4o-mini',
        executionMode: 'development' as const,
        retryAttempts: 2,
        retryBaseDelayMs: 300,
        maxCompletionTokens: 2000,
      }),
    } as unknown as AnalysisConfigService;

    const service = new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      config,
    );

    const response = await service.analyzeNews(TRUMP_QUESTION);

    expect(provider.analyzeNews).not.toHaveBeenCalled();
    expect(response.analysis).toBeNull();
    expect(response.articles).toEqual([]);
    expect(response.provenance.status).toBe('not-attempted');
  });
});

describe('D2 — BAGO / NIGER STATE REGRESSION GUARD', () => {
  /*
   * The subnational-collision rules and the query-derivation rules are separate
   * systems, and this change touches only the second. These assertions exist so
   * that stays true: if a future edit to subject extraction ever reached into
   * country resolution, the confirmed Bago article would move and this would
   * fail. The full 28-assertion contract lives in
   * news/country/subnational-collision.spec.ts and is unchanged.
   */
  const BAGO_TITLE = 'Bago Mourns Village Head Killed By Bandits In Niger';
  const BAGO_SUMMARY =
    'The incident happened in Niger State, Nigeria, according to local officials.';

  it('the confirmed article still resolves to Nigeria, never to sovereign Niger', () => {
    const resolved = resolvePrimaryCountry({ title: BAGO_TITLE, summary: BAGO_SUMMARY });

    expect(resolved?.countryName).toBe('Nigeria');
    expect(resolved?.countryName).not.toBe('Niger');
  });

  it('genuine sovereign Niger is still reachable', () => {
    const resolved = resolvePrimaryCountry({
      title: 'Niger holds talks in Niamey',
      summary: 'The government of Niger met regional envoys in Niamey.',
    });

    expect(resolved?.countryName).toBe('Niger');
  });

  it('subject extraction does not rewrite country names out of a question', () => {
    expect(deriveGenericNewsQuery('What do you know about Niger State?')).toBe('Niger State');
    expect(deriveGenericNewsQuery('Tell me about Nigeria')).toBe('Nigeria');
  });
});
