import type { NewsArticle } from '@globalnews-ai/shared';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

function normalizeWord(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.length > 4 && word.endsWith('ed')) {
    return word.slice(0, -2);
  }

  if (word.length > 4 && word.endsWith('s')) {
    return word.slice(0, -1);
  }

  return word;
}

function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word))
    .map(normalizeWord);

  return new Set(words);
}

function calculateTitleOverlap(firstTitle: string, secondTitle: string): number {
  const first = titleTokens(firstTitle);
  const second = titleTokens(secondTitle);

  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  let sharedTokens = 0;

  for (const token of first) {
    if (second.has(token)) {
      sharedTokens += 1;
    }
  }

  return sharedTokens / Math.min(first.size, second.size);
}

export function areLikelyDuplicateArticles(
  first: Pick<NewsArticle, 'title'>,
  second: Pick<NewsArticle, 'title'>,
): boolean {
  return calculateTitleOverlap(first.title, second.title) >= 0.72;
}

/**
 * Preserves the original order, keeping the first and therefore
 * highest-ranked article from each likely duplicate story.
 */
export function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const uniqueArticles: NewsArticle[] = [];

  for (const article of articles) {
    const duplicateAlreadyExists = uniqueArticles.some((existing) =>
      areLikelyDuplicateArticles(existing, article),
    );

    if (!duplicateAlreadyExists) {
      uniqueArticles.push(article);
    }
  }

  return uniqueArticles;
}
