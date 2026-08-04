import type { NewsCategory } from '@globalnews-ai/shared';

/**
 * Deterministic, keyword-based fallback classifier.
 *
 * Some providers (GNews's `/search` and `/top-headlines` without a
 * category filter) don't tell us which category an article belongs to.
 * Rather than defaulting every such article to "world", this makes a
 * best-effort guess from the article's own text.
 *
 * This is intentionally a single pure function with no provider
 * knowledge, so it can be swapped for a real AI classifier later by
 * changing only this file — every provider that calls it keeps working
 * unchanged.
 */

const KEYWORD_MAP: Array<[NewsCategory, string[]]> = [
  [
    'politics',
    [
      'election',
      'senate',
      'congress',
      'parliament',
      'president',
      'prime minister',
      'minister',
      'campaign',
      'ballot',
      'referendum',
      'lawmaker',
      'legislation',
    ],
  ],
  [
    'business',
    [
      'stock',
      'market',
      'economy',
      'economic',
      'inflation',
      'trade deal',
      'bank',
      'finance',
      'financial',
      'earnings',
      'ipo',
      'merger',
      'acquisition',
      'startup funding',
      'shares',
    ],
  ],
  [
    'technology',
    [
      'technology',
      ' tech ',
      'software',
      ' app ',
      'artificial intelligence',
      ' ai ',
      'chip',
      'semiconductor',
      'startup',
      'cybersecurity',
      'computer',
      'smartphone',
      'robot',
    ],
  ],
  [
    'science',
    [
      'research',
      'study finds',
      'scientist',
      'space',
      'nasa',
      'climate',
      'discovery',
      'physics',
      'biology',
      'astronomy',
      'researchers',
    ],
  ],
  [
    'health',
    [
      'health',
      'medical',
      'disease',
      'virus',
      'hospital',
      'doctor',
      'vaccine',
      'covid',
      'mental health',
      'wellness',
      'outbreak',
    ],
  ],
  [
    'sports',
    [
      'match',
      'tournament',
      'championship',
      'league',
      'football',
      'soccer',
      'basketball',
      'olympic',
      'coach',
      ' score ',
      'athlete',
      'world cup',
    ],
  ],
  [
    'entertainment',
    [
      'movie',
      'film',
      'celebrity',
      'music',
      'album',
      'tv show',
      'box office',
      'actor',
      'actress',
      'hollywood',
      'concert',
      'streaming series',
    ],
  ],
];

export interface ClassifiableArticle {
  title: string;
  summary?: string;
}

/**
 * Classifies an article into a NewsCategory.
 *
 * If `categoryHint` is provided (e.g. the category a provider was
 * explicitly asked for), it's trusted as-is. Otherwise this scans the
 * title and summary for keywords and falls back to "world" if nothing
 * matches.
 */
export function classifyCategory(
  article: ClassifiableArticle,
  categoryHint?: NewsCategory,
): NewsCategory {
  if (categoryHint) return categoryHint;

  const haystack = ` ${article.title} ${article.summary ?? ''} `.toLowerCase();

  for (const [category, keywords] of KEYWORD_MAP) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category;
    }
  }

  return 'world';
}
