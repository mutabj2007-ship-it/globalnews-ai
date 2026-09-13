import type { NewsArticle } from '@globalnews-ai/shared';
import { areLikelyDuplicateArticles, deduplicateArticles } from './deduplicate-articles.util';

function article(id: string, title: string): NewsArticle {
  return {
    id,
    title,
    summary: '',
    url: `https://example.com/${id}`,
    imageUrl: undefined,
    sourceId: 'test-source',
    sourceName: 'Test Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-05T06:00:00Z',
  };
}

describe('areLikelyDuplicateArticles', () => {
  it('recognizes differently worded reports about the same event', () => {
    const first = article(
      '1',
      '35 killed after Sudan army launches drone strike on Darfur civil court',
    );

    const second = article('2', 'Sudan army drone attack on Darfur court kills 35');

    expect(areLikelyDuplicateArticles(first, second)).toBe(true);
  });

  it('does not merge different Sudan stories', () => {
    const first = article('1', 'Sudan army drone attack on Darfur court kills 35');

    const second = article('2', 'Sudan peace negotiations encounter new obstacles');

    expect(areLikelyDuplicateArticles(first, second)).toBe(false);
  });
});

describe('deduplicateArticles', () => {
  it('keeps the first article from a duplicate story group', () => {
    const first = article(
      'preferred',
      '35 killed after Sudan army launches drone strike on Darfur civil court',
    );

    const duplicate = article('duplicate', 'Sudan army drone attack on Darfur court kills 35');

    const different = article(
      'different',
      'Red Cross appeals for humanitarian support across Sudan',
    );

    const result = deduplicateArticles([first, duplicate, different]);

    expect(result.map((item) => item.id)).toEqual(['preferred', 'different']);
  });

  it('preserves order when all stories are different', () => {
    const result = deduplicateArticles([
      article('1', 'Sudan peace talks resume'),
      article('2', 'Refugees return home from Egypt'),
      article('3', 'Humanitarian needs deepen across Sudan'),
    ]);

    expect(result.map((item) => item.id)).toEqual(['1', '2', '3']);
  });
});
