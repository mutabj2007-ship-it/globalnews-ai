import type { NewsArticle } from '@globalnews-ai/shared';

export interface NormalizedArticleForPrompt {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  publishedAt: string;
}

/** Truncates and strips each article down to what the model actually needs. */
export function normalizeArticlesForPrompt(
  articles: NewsArticle[],
  maxChars: number,
): NormalizedArticleForPrompt[] {
  return articles.map((article) => {
    const combined = `${article.title}. ${article.summary}`.trim();
    return {
      id: article.id,
      title: article.title,
      summary: combined.length > maxChars ? `${combined.slice(0, maxChars)}\u2026` : combined,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
    };
  });
}

const SYSTEM_PROMPT = `You are a careful news analyst working for GlobalNews AI.

You will be given a user's question and a numbered list of news articles,
each with a unique article ID. Your job is to produce a structured,
evidence-grounded analysis of ONLY those articles.

Strict rules:
- Use only the supplied articles. Do not use outside knowledge, do not
  search the web, and do not invent facts, quotations, publishers, or URLs.
- Every entry in keyFacts, agreements, differences (each position), and
  timeline MUST include the sourceArticleIds of the articles that support
  it. Never state something as a fact without a supporting article ID.
- Clearly distinguish observed facts from interpretation. If something is
  your inference rather than something explicitly reported, say so or omit
  it from keyFacts.
- Do not assume that multiple articles are independent confirmation if
  they read like syndicated copies of the same wire report — note this in
  "differences" or "unknowns" instead of treating it as strong agreement.
- Mention uncertainty explicitly where the articles are unclear, partial,
  or conflicting, and reflect that in the confidence score.
- Avoid political persuasion, advocacy, or loaded language of any kind.
- Avoid sensational or exaggerated language; use a neutral, precise tone.
- Preserve genuinely important differences between sources rather than
  smoothing them into a single narrative.
- If you are not confident about something, list it in "unknowns" instead
  of guessing.
- Output must be valid JSON matching the provided schema exactly. Do not
  include commentary outside the JSON.`;

export function buildAnalysisUserPrompt(
  query: string,
  articles: NormalizedArticleForPrompt[],
): string {
  const articleBlocks = articles
    .map(
      (article, index) =>
        `${index + 1}. [articleId: ${article.id}] "${article.title}" \u2014 ${article.sourceName} (${article.publishedAt})\n${article.summary}`,
    )
    .join('\n\n');

  return `User question: "${query}"

Articles (cite these exact articleId values in sourceArticleIds):

${articleBlocks}

Produce the structured analysis now.`;
}

export function buildAnalysisMessages(
  query: string,
  articles: NewsArticle[],
  maxChars: number,
): { system: string; user: string } {
  const normalized = normalizeArticlesForPrompt(articles, maxChars);
  return {
    system: SYSTEM_PROMPT,
    user: buildAnalysisUserPrompt(query, normalized),
  };
}

/**
 * JSON schema handed to the OpenAI provider's structured-output mode.
 * Kept here (not inline in the provider) so the schema, the prompt, and
 * the runtime validator all describe the same shape from one source of
 * truth conceptually — the provider just forwards this schema, and
 * validate-analysis-result.ts is the actual runtime gate.
 */
export function buildAnalysisJsonSchema(): Record<string, unknown> {
  const sourcedClaim = {
    type: 'object',
    properties: {
      claim: { type: 'string' },
      sourceArticleIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['claim', 'sourceArticleIds'],
    additionalProperties: false,
  };

  const positionSchema = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      sourceArticleIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['description', 'sourceArticleIds'],
    additionalProperties: false,
  };

  return {
    name: 'news_analysis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        headline: { type: 'string' },
        summary: { type: 'string' },
        keyFacts: { type: 'array', items: sourcedClaim },
        agreements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              sourceArticleIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['point', 'sourceArticleIds'],
            additionalProperties: false,
          },
        },
        differences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              positions: { type: 'array', items: positionSchema },
            },
            required: ['topic', 'positions'],
            additionalProperties: false,
          },
        },
        unknowns: { type: 'array', items: { type: 'string' } },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              event: { type: 'string' },
              sourceArticleIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['timestamp', 'event', 'sourceArticleIds'],
            additionalProperties: false,
          },
        },
        confidence: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['low', 'medium', 'high'] },
            score: { type: 'number' },
            explanation: { type: 'string' },
          },
          required: ['level', 'score', 'explanation'],
          additionalProperties: false,
        },
        entities: {
          type: 'object',
          properties: {
            countries: { type: 'array', items: { type: 'string' } },
            locations: { type: 'array', items: { type: 'string' } },
            people: { type: 'array', items: { type: 'string' } },
            organizations: { type: 'array', items: { type: 'string' } },
            topics: { type: 'array', items: { type: 'string' } },
          },
          required: ['countries', 'locations', 'people', 'organizations', 'topics'],
          additionalProperties: false,
        },
      },
      required: [
        'query',
        'headline',
        'summary',
        'keyFacts',
        'agreements',
        'differences',
        'unknowns',
        'timeline',
        'confidence',
        'entities',
      ],
      additionalProperties: false,
    },
  };
}
