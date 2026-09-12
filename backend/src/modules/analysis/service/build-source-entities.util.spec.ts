import { buildSourceEntities } from './build-source-entities.util';
import type { NewsArticle } from '@globalnews-ai/shared';

function makeArticle(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: '',
    summary: '',
    url: 'https://example.com',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  } as NewsArticle;
}

describe('buildSourceEntities', () => {
  it('returns an empty organizations array for an empty article list', () => {
    expect(buildSourceEntities([])).toEqual({ organizations: [] });
  });

  it('aggregates the same organization mentioned via different surface forms across multiple articles', () => {
    const articles = [
      makeArticle({
        id: 'a1',
        title: 'UN Security Council meets',
        summary: 'The council convened.',
      }),
      makeArticle({
        id: 'a2',
        title: 'United Nations calls for ceasefire',
        summary: 'Officials confirmed talks.',
      }),
    ];

    const result = buildSourceEntities(articles);

    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0].canonical).toBe('United Nations');
    expect(result.organizations[0].matchedFrom).toEqual(
      expect.arrayContaining(['UN', 'United Nations']),
    );
    expect(result.organizations[0].articleIds).toEqual(expect.arrayContaining(['a1', 'a2']));
    expect(result.organizations[0].articleIds).toHaveLength(2);
  });

  it('does not duplicate an article ID for an organization mentioned multiple times in one article', () => {
    const articles = [
      makeArticle({
        id: 'a1',
        title: 'UN and United Nations officials meet',
        summary: 'The UN reiterated its position; United Nations staff remain on site.',
      }),
    ];

    const result = buildSourceEntities(articles);

    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0].articleIds).toEqual(['a1']);
  });

  it('keeps unrelated organizations as separate entries, not merged', () => {
    const articles = [
      makeArticle({
        id: 'a1',
        title: 'NATO statement',
        summary: 'NATO addressed security concerns.',
      }),
      makeArticle({ id: 'a2', title: 'OPEC statement', summary: 'OPEC discussed oil output.' }),
    ];

    const result = buildSourceEntities(articles);

    const canonicals = result.organizations.map((org) => org.canonical);
    expect(canonicals).toEqual(expect.arrayContaining(['NATO', 'OPEC']));
    expect(result.organizations.find((org) => org.canonical === 'NATO')?.articleIds).toEqual([
      'a1',
    ]);
    expect(result.organizations.find((org) => org.canonical === 'OPEC')?.articleIds).toEqual([
      'a2',
    ]);
  });

  it('an article with no organizations contributes nothing', () => {
    const articles = [
      makeArticle({
        id: 'a1',
        title: 'Kenya and Uganda sign trade deal',
        summary: 'Regional trade grows.',
      }),
    ];

    expect(buildSourceEntities(articles)).toEqual({ organizations: [] });
  });

  it('never emits an articleId for an article outside the supplied array (grounding invariant)', () => {
    // Only a1 is supplied — a2's organization mention (had it been
    // supplied) must never leak in, since buildSourceEntities only
    // ever looks at what it is given.
    const supplied = [
      makeArticle({ id: 'a1', title: 'NATO statement', summary: 'NATO spoke today.' }),
    ];

    const result = buildSourceEntities(supplied);
    const suppliedIds = new Set(supplied.map((article) => article.id));

    for (const org of result.organizations) {
      for (const articleId of org.articleIds) {
        expect(suppliedIds.has(articleId)).toBe(true);
      }
    }
  });
});
