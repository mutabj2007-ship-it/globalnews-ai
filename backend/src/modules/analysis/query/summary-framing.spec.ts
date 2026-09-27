import {
  deriveFallbackNewsQuery,
  deriveGenericNewsQuery,
  extractSummaryFrameSubject,
  makeProviderSafeNewsQuery,
} from './derive-generic-news-query.util';
import { derivePolishRetrievalQuery } from '../language/derive-polish-retrieval-query.util';

/**
 * LANE E — FIRST-TURN SUMMARY FRAMING. Deterministic, closed, first-match-wins;
 * the subject must be strictly shorter than the question; time framing is only
 * removed at governed edges. Every existing safety property is pinned too.
 */

describe('EN summary frames', () => {
  it.each([
    ['Summarize the ECB decision', 'ECB decision'],
    ['Summarise the ECB decision', 'ECB decision'],
    ['Recap the G7 summit', 'G7 summit'],
    ['Break down the budget vote', 'budget vote'],
    ['Give me a summary of the G7 summit', 'G7 summit'],
    ['Give me a brief summary of the Paris Agreement', 'Paris Agreement'],
    ['Summarize the latest news on ECB interest rates', 'ECB interest rates'],
    ['Recap the latest developments about the NATO summit', 'NATO summit'],
  ])('%s → %s', (question, subject) => {
    expect(deriveGenericNewsQuery(question)).toBe(subject);
  });

  it.each([
    ["Summarize today's central bank announcement", 'central bank announcement'],
    ["Break down this week's tech earnings", 'tech earnings'],
    ['Break down this week’s tech earnings', 'tech earnings'],
    ["Recap yesterday's match", 'match'],
    ['Summarize the latest IPCC climate report', 'IPCC climate report'],
    ['Break down tech earnings this week', 'tech earnings'],
  ])('governed time framing: %s → %s', (question, subject) => {
    expect(deriveGenericNewsQuery(question)).toBe(subject);
  });
});

describe('PL summary frames (both Polish and generic authorities)', () => {
  it.each([
    ['Podsumuj najnowszy raport klimatyczny IPCC', 'raport klimatyczny IPCC'],
    ['Streść mi najnowsze wiadomości o NATO', 'NATO'],
    ['Streść raport NIK', 'raport NIK'],
    ['Omów stopy procentowe EBC', 'stopy procentowe EBC'],
    ['Omów wyniki finansowe firm technologicznych z tego tygodnia', 'wyniki finansowe firm technologicznych'],
    ['Podsumuj dzisiejsze ogłoszenie banku centralnego', 'ogłoszenie banku centralnego'],
  ])('%s → %s', (question, subject) => {
    expect(derivePolishRetrievalQuery(question)).toBe(subject);
    expect(deriveGenericNewsQuery(question)).toBe(subject);
  });

  it('the natural Polish "Co się teraz dzieje na X?" order routes to X', () => {
    expect(derivePolishRetrievalQuery('Co się teraz dzieje na Bliskim Wschodzie?')).toBe('Bliskim Wschodzie');
    expect(derivePolishRetrievalQuery('Co się dzieje w Sudanie?')).toBe('Sudanie');
    /* The pre-existing order is unchanged. */
    expect(derivePolishRetrievalQuery('Co dzieje się teraz w Polsce?')).toBe('Polsce');
  });
});

describe('never a command where there is none', () => {
  it.each([
    'Summary of the Paris Agreement',
    'Recap of the match',
    'Why did talks break down in Geneva?',
    'What did the summary say about wages?',
    'The latest iPhone summary',
  ])('"%s" is left to the pre-existing rules', (question) => {
    expect(extractSummaryFrameSubject(question)).toBeUndefined();
  });

  it('"today" and "latest" inside an ordinary topic are never stripped', () => {
    expect(deriveGenericNewsQuery('What is the latest iPhone')).toBe('What is the latest iPhone');
    expect(deriveGenericNewsQuery('Today show ratings')).toBe('Today show ratings');
    expect(deriveGenericNewsQuery('Tell me about the latest Mars rover')).toBe('latest Mars rover');
  });
});

describe('existing safety properties are unchanged', () => {
  it('length: a bare verb or a subject no shorter than the question is not used', () => {
    expect(deriveGenericNewsQuery('Summarize')).toBe('Summarize');
    expect(extractSummaryFrameSubject('Summarize')).toBeUndefined();
    expect(extractSummaryFrameSubject("Summarize today's")).toBeUndefined();
  });

  it('punctuation: the derived subject is still made provider-safe', () => {
    const subject = deriveGenericNewsQuery('Summarize the "Fed" decision!!');
    expect(makeProviderSafeNewsQuery(subject)).toBe('Fed decision');
  });

  it('bounded fallback: the fallback rule is untouched', () => {
    expect(deriveFallbackNewsQuery('central bank announcement')).toBeUndefined();
    expect(deriveFallbackNewsQuery('the latest news on NATO')).toBe('NATO');
  });

  it('the pre-existing frames still win for their own shapes', () => {
    expect(deriveGenericNewsQuery("What's happening in the Middle East right now?")).toBe('Middle East');
    expect(deriveGenericNewsQuery('Tell me about NATO')).toBe('NATO');
  });
});
