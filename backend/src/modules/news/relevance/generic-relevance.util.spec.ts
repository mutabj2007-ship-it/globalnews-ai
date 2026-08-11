import type { NewsArticle } from '@globalnews-ai/shared';
import { scoreGenericRelevance } from './generic-relevance.util';

function article(overrides: Partial<Pick<NewsArticle, 'title' | 'summary' | 'category'>>) {
  return {
    title: 'Untitled',
    summary: '',
    category: 'world' as NewsArticle['category'],
    ...overrides,
  };
}

describe('scoreGenericRelevance (Milestone #36)', () => {
  it('1. cybersecurity: title + summary corroborate -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Sens. Schiff and Klobuchar unveil new cybersecurity bill',
        summary: 'The bipartisan cybersecurity bill aims to protect infrastructure.',
      }),
      'cybersecurity',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.corroborationCount).toBeGreaterThanOrEqual(2);
  });

  it('2. single-word title-only match -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({ title: 'Dark Energy May Explain the Expansion of the Universe', summary: 'Scientists discuss cosmology.' }),
      'energy',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('3. single-word summary-only match -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({ title: 'Afghanistan crisis deepens', summary: 'The climate of instability continues to worsen.' }),
      'climate',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('4. single-word summary repeated (summaryMatch + summaryRepeatMatch) -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Global outlook',
        summary: 'Energy prices are rising. Analysts expect energy costs to remain high through the year.',
      }),
      'energy',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.corroborationCount).toBe(2);
    expect(result.reasons).toContain('summary match');
    expect(result.reasons).toContain('summary repeated');
  });

  it('5. category + summary (e.g. technology) -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Firms unveil new devices',
        summary: 'The technology sector saw major announcements this week.',
        category: 'technology',
      }),
      'technology',
    );
    expect(result.isRelevant).toBe(true);
    expect(result.reasons).toContain('category alignment');
  });

  it('6. category only -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({ title: 'Weekly roundup', summary: 'A summary of the week in review.', category: 'technology' }),
      'technology',
    );
    expect(result.isRelevant).toBe(false);
    expect(result.corroborationCount).toBe(1);
  });

  it('7. climate incidental single mention -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Afghanistan crisis deepens as winter approaches',
        summary: 'Aid workers describe the harsh climate as one of many challenges facing displaced families.',
      }),
      'climate',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('8. agriculture title + summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Kerala will push organic farming in a big way: Agriculture Minister',
        summary: 'The state agriculture department announced new subsidies for organic agriculture.',
      }),
      'agriculture',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('9. OpenAI title + summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'OpenAI announces new model release',
        summary: 'OpenAI said the new model improves reasoning capabilities.',
      }),
      'OpenAI',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('10. Middle East whole phrase in title -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Middle East flights: Air Canada, Air France and Scoot extend suspensions',
        summary: 'Several carriers extended flight suspensions.',
      }),
      'Middle East',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('11. 2-3 word whole phrase only in summary -> KEEP', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Officials meet to discuss policy',
        summary: 'The talks focused heavily on quantum computing research funding.',
      }),
      'quantum computing',
    );
    expect(result.isRelevant).toBe(true);
  });

  it('12. 2-3 word partial-token overlap but no whole phrase -> REJECT', () => {
    const result = scoreGenericRelevance(
      article({
        title: 'Quantum leap in battery research',
        summary: 'Engineers used advanced computing clusters to simulate battery chemistry.',
      }),
      'quantum computing',
    );
    expect(result.isRelevant).toBe(false);
  });

  it('13. 4+ word complete phrase -> KEEP', () => {
    const phrase = 'How is the Iran conflict affecting oil prices';
    const result = scoreGenericRelevance(
      article({
        title: 'Analysis: how is the Iran conflict affecting oil prices this week',
        summary: 'Markets react to tensions.',
      }),
      phrase,
    );
    expect(result.isRelevant).toBe(true);
  });

  it('14. 4+ word partial overlap -> REJECT', () => {
    const phrase = 'How is the Iran conflict affecting oil prices';
    const result = scoreGenericRelevance(
      article({
        title: 'Oil prices rise amid Iran tensions',
        summary: 'Analysts discuss conflict in the region.',
      }),
      phrase,
    );
    expect(result.isRelevant).toBe(false);
  });

  it('15. never admits an empty/invalid search phrase accidentally', () => {
    const result = scoreGenericRelevance(article({ title: 'Anything', summary: 'Anything at all' }), '   ');
    expect(result.isRelevant).toBe(false);
  });

  it('no individual signal alone may admit a single-word result (explicit corroboration-count guard)', () => {
    // Title match alone (the exact case the CTO's correction targeted).
    const titleOnly = scoreGenericRelevance(
      article({ title: 'Dark energy dominates the cosmos', summary: 'No further discussion.' }),
      'energy',
    );
    expect(titleOnly.corroborationCount).toBe(1);
    expect(titleOnly.isRelevant).toBe(false);
  });
});
