import type { NewsCategory } from '@globalnews-ai/shared';

/**
 * Deterministic fallback classifier for providers that do not supply a
 * useful category.
 *
 * The classifier scores every supported category using the article title
 * and summary. Scoring all categories is more reliable than returning the
 * first keyword match because one article can contain terms from several
 * subject areas.
 */

interface CategoryRule {
  category: NewsCategory;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'politics',
    keywords: [
      'election',
      'senate',
      'congress',
      'parliament',
      'president',
      'prime minister',
      'minister',
      'government',
      'administration',
      'campaign',
      'ballot',
      'referendum',
      'lawmaker',
      'legislation',
      'policy',
      'diplomatic',
      'diplomacy',
      'peace talks',
      'peace effort',
      'peace agreement',
      'negotiation',
      'negotiations',
      'ceasefire',
      'sanction',
      'sanctions',
      'ambassador',
      'brokered',
      'united nations',
      'security council',
      'armed forces',
      'paramilitary',
      'civil war',
      'proxy war',
      'military',
      'army',
      'drone strike',
      'conflict',
    ],
  },
  {
    category: 'business',
    keywords: [
      'stock',
      'market',
      'economy',
      'economic',
      'inflation',
      'trade deal',
      'trade agreement',
      'bank',
      'finance',
      'financial',
      'earnings',
      'ipo',
      'merger',
      'acquisition',
      'startup funding',
      'shares',
      'investment',
      'investor',
      'oil price',
      'currency',
      'recession',
      'employment',
      'unemployment',
    ],
  },
  {
    category: 'technology',
    keywords: [
      'technology',
      'software',
      'application',
      'artificial intelligence',
      'machine learning',
      'openai',
      'chip',
      'semiconductor',
      'cybersecurity',
      'cyber attack',
      'computer',
      'smartphone',
      'robot',
      'digital platform',
      'data center',
      'cloud computing',
      'social media',
    ],
  },
  {
    category: 'science',
    keywords: [
      'research',
      'study finds',
      'scientist',
      'scientists',
      'space',
      'nasa',
      'climate',
      'discovery',
      'physics',
      'biology',
      'astronomy',
      'researchers',
      'laboratory',
      'experiment',
      'species',
      'environmental study',
    ],
  },
  {
    category: 'health',
    keywords: [
      'health',
      'medical',
      'disease',
      'virus',
      'hospital',
      'doctor',
      'doctors',
      'vaccine',
      'covid',
      'mental health',
      'wellness',
      'outbreak',
      'humanitarian',
      'red cross',
      'aid workers',
      'food shortage',
      'famine',
      'malnutrition',
      'cholera',
      'medicine',
      'patients',
      'public health',
      'humanitarian needs',
      'humanitarian crisis',
    ],
  },
  {
    category: 'sports',
    keywords: [
      'match',
      'tournament',
      'championship',
      'league',
      'football',
      'soccer',
      'basketball',
      'olympic',
      'coach',
      'athlete',
      'world cup',
      'tennis',
      'cricket',
      'formula one',
      'grand prix',
      'goal',
      'season',
      'player',
    ],
  },
  {
    category: 'entertainment',
    keywords: [
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
      'television',
      'singer',
      'director',
      'festival',
    ],
  },
];

export interface ClassifiableArticle {
  title: string;
  summary?: string;
}

function normalizeText(value: string): string {
  return ` ${value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword).trim();

    if (!normalizedKeyword) {
      return score;
    }

    return text.includes(` ${normalizedKeyword} `) ? score + 1 : score;
  }, 0);
}

/**
 * Classifies an article into one primary NewsCategory.
 *
 * Explicit category hints remain authoritative because they represent a
 * provider request made for that exact category. Otherwise all categories
 * are scored against the article title and summary.
 */
export function classifyCategory(
  article: ClassifiableArticle,
  categoryHint?: NewsCategory,
): NewsCategory {
  if (categoryHint) {
    return categoryHint;
  }

  const title = normalizeText(article.title);
  const summary = normalizeText(article.summary ?? '');

  let bestCategory: NewsCategory = 'world';
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    // Title matches are more important than summary matches.
    const titleScore = countKeywordMatches(title, rule.keywords) * 2;
    const summaryScore = countKeywordMatches(summary, rule.keywords);
    const totalScore = titleScore + summaryScore;

    if (totalScore > bestScore) {
      bestCategory = rule.category;
      bestScore = totalScore;
    }
  }

  return bestCategory;
}