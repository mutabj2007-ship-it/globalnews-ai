import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * Milestone #31 — a request-local, AI-facing alias for one article in
 * the final bounded evidence set (e.g. "S1"), paired with the real
 * canonical NewsArticle.id it stands for.
 *
 * This alias exists ONLY inside the prompt/output round trip with the
 * AI provider — it is never persisted, cached, or exposed on
 * AnalysisApiResponse. The trusted, canonical `articleId` is what
 * ultimately appears in a validated NewsAnalysisResult's
 * sourceArticleIds fields; `evidenceId` never does.
 */
export interface EvidenceReference {
  evidenceId: string;
  articleId: string;
}

/**
 * Deterministically assigns S1, S2, S3... to `articles` in array order.
 *
 * The caller MUST pass the exact final, deduplicated, maxArticles-bounded
 * article array — the same array supplied to the AI provider and used as
 * AnalysisApiResponse.articles — so that the AI-facing alias and every
 * other party resolving it (the runtime validator, other providers)
 * agree on the same S-label for the same article without needing to
 * share any state beyond "the same array, in the same order". This
 * function performs no deduplication or bounding itself.
 */
export function buildEvidenceReferences(articles: NewsArticle[]): EvidenceReference[] {
  return articles.map((article, index) => ({
    evidenceId: `S${index + 1}`,
    articleId: article.id,
  }));
}

/**
 * Milestone #32 — the single, deterministic normalization applied on
 * BOTH sides of an evidence-basis excerpt comparison (the model's
 * claimed excerpt, and the exact truncated evidence text the model was
 * shown for that evidenceId — see normalizeArticlesForPrompt). Kept
 * deliberately conservative and exact-substring-only, per CTO
 * authorization: no fuzzy/Levenshtein/embedding matching.
 *
 * Policy (documented, not silently loosened):
 * 1. Unicode NFKC normalization (e.g. so a precomposed vs. decomposed
 *    accented character compares equal).
 * 2. Typographic quotes/dashes normalized to their ASCII equivalents
 *    (curly quotes, en/em dashes) — models frequently "smarten"
 *    punctuation when quoting, and the source text may use either form.
 * 3. All whitespace runs (including newlines/tabs) collapsed to a
 *    single space, then trimmed.
 * 4. Case-INsensitive comparison (lowercased) — chosen because the
 *    model may reproduce a sentence-initial capital differently than
 *    the source's mid-sentence casing after our own title+summary
 *    concatenation; this is a deliberate, documented policy choice,
 *    not progressive loosening. Case sensitivity is NOT relaxed for
 *    anything else (no fuzzy matching of any kind).
 */
export function normalizeExcerptText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface NormalizedArticleForPrompt {
  evidenceId: string;
  title: string;
  summary: string;
  sourceName: string;
  publishedAt: string;
}

/**
 * Truncates and strips each article down to what the model actually
 * needs, and replaces the real article ID with its request-local
 * evidenceId — the model is never shown a canonical article ID,
 * publisher-verified URL, or any other trusted metadata it could
 * later try to echo back as if it were authoritative.
 */
export function normalizeArticlesForPrompt(
  articles: NewsArticle[],
  maxChars: number,
): NormalizedArticleForPrompt[] {
  return buildEvidenceReferences(articles).map(({ evidenceId }, index) => {
    const article = articles[index];
    const combined = `${article.title}. ${article.summary}`.trim();
    return {
      evidenceId,
      title: article.title,
      summary: combined.length > maxChars ? `${combined.slice(0, maxChars)}\u2026` : combined,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
    };
  });
}

/**
 * Milestone #32 — the exact truncated evidence text keyed by
 * evidenceId, i.e. precisely what normalizeArticlesForPrompt computed
 * as `summary` (the truncated `title. summary` combination actually
 * shown to the model for that evidenceId), run through
 * normalizeExcerptText() once so callers can do a plain substring
 * check against the model's normalized excerpt.
 *
 * This is the SOLE source of truth for "what evidence text did the
 * model actually see" — it must be built with the same `articles`
 * array and the same `maxArticleChars` value used to build the actual
 * prompt (see AnalysisConfig.maxArticleChars / buildAnalysisMessages),
 * or the comparison would validate against text the model was never
 * shown.
 */
export function buildNormalizedEvidenceTextMap(
  articles: NewsArticle[],
  maxChars: number,
): Map<string, string> {
  return new Map(
    normalizeArticlesForPrompt(articles, maxChars).map((a) => [
      a.evidenceId,
      normalizeExcerptText(a.summary),
    ]),
  );
}

const SYSTEM_PROMPT = `You are a careful news analyst working for GlobalNews AI.

You will be given a user's question and a numbered list of news articles,
each with a request-local evidence ID (S1, S2, S3, ...). These evidence
IDs are the ONLY way you may refer to a source. Your job is to produce a
structured, evidence-grounded analysis of ONLY those articles.

Strict rules:
- Use only the supplied articles. Do not use outside knowledge, do not
  search the web, and do not invent facts, quotations, publishers, or URLs.
- Every entry in keyFacts, agreements, differences (each position),
  timeline, and uncertainties MUST include the evidenceIds of the
  articles that support it, using ONLY the exact evidenceId values shown
  (e.g. "S1", "S2"). Never invent a new evidence ID, never cite a real
  article ID, a URL, a publisher name, or anything other than a supplied
  evidenceId value. Never state something as a fact without a supporting
  evidenceId.
- Clearly distinguish observed facts from interpretation. If something is
  your inference rather than something explicitly reported, say so or omit
  it from keyFacts.
- Do not assume that multiple articles are independent confirmation if
  they read like syndicated copies of the same wire report — note this in
  "differences" or "uncertainties" instead of treating it as strong
  agreement.
- Where the supplied evidence does not establish a conclusion, or reports
  conflict, or something remains unconfirmed, add an entry to
  "uncertainties" describing the gap, citing the relevant evidenceIds when
  the gap concerns specific articles (an empty evidenceIds array is fine
  for a general gap). Also reflect this in the confidence score.
- Avoid political persuasion, advocacy, or loaded language of any kind.
- Avoid sensational or exaggerated language; use a neutral, precise tone.
- Preserve genuinely important differences between sources rather than
  smoothing them into a single narrative.
- If you are not confident about something, list it in "unknowns" and/or
  "uncertainties" instead of guessing.
- For keyFacts, agreements, differences (each position), and timeline
  entries, you may optionally include "evidenceBasis": an object with
  "evidenceId" (one of the exact evidenceId values you already cited for
  that entry) and "excerpt" (a short excerpt, a sentence or less, copied
  verbatim from that evidence's own text above — do not paraphrase, do
  not combine wording from multiple articles, do not invent text). Omit
  "evidenceBasis" entirely if you cannot quote a genuine short excerpt
  that directly appears in the cited evidence's text.
- Output must be valid JSON matching the provided schema exactly. Do not
  include commentary outside the JSON.`;

export function buildAnalysisUserPrompt(
  query: string,
  articles: NormalizedArticleForPrompt[],
): string {
  const articleBlocks = articles
    .map(
      (article, index) =>
        `${index + 1}. [evidenceId: ${article.evidenceId}] "${article.title}" \u2014 ${article.sourceName} (${article.publishedAt})\n${article.summary}`,
    )
    .join('\n\n');

  return `User question: "${query}"

Evidence (cite these exact evidenceId values in "evidenceIds" fields — never invent new ones, never cite anything else):

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
 *
 * Milestone #31: the model-facing field is "evidenceIds" (request-local
 * S1/S2/... aliases only) everywhere a source needs citing. The
 * validated NewsAnalysisResult that comes out of validateAnalysisResult
 * still exposes "sourceArticleIds" containing REAL article IDs — that
 * translation happens entirely in the validator, never here.
 */
export function buildAnalysisJsonSchema(): Record<string, unknown> {
  /**
   * Milestone #32 — model-facing evidence-basis shape. Nullable +
   * listed in `required` per OpenAI strict-mode structured-output
   * convention for an optional field (the schema itself cannot express
   * "may be omitted" under `strict: true`/`additionalProperties: false`
   * — the model must emit `null` instead of leaving it out). Uses the
   * SAME request-local "evidenceId" field name as the rest of this
   * schema; validate-analysis-result.ts is the only place this ever
   * gets resolved to a real articleId, exactly like every other
   * evidenceIds field here.
   */
  const evidenceBasisSchema = {
    type: ['object', 'null'],
    properties: {
      evidenceId: { type: 'string' },
      excerpt: { type: 'string' },
    },
    required: ['evidenceId', 'excerpt'],
    additionalProperties: false,
  };

  const sourcedClaim = {
    type: 'object',
    properties: {
      claim: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
    },
    required: ['claim', 'evidenceIds', 'evidenceBasis'],
    additionalProperties: false,
  };

  const positionSchema = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
    },
    required: ['description', 'evidenceIds', 'evidenceBasis'],
    additionalProperties: false,
  };

  const uncertaintySchema = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['description', 'evidenceIds'],
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
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceBasis: evidenceBasisSchema,
            },
            required: ['point', 'evidenceIds', 'evidenceBasis'],
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
        uncertainties: { type: 'array', items: uncertaintySchema },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              event: { type: 'string' },
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceBasis: evidenceBasisSchema,
            },
            required: ['timestamp', 'event', 'evidenceIds', 'evidenceBasis'],
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
        'uncertainties',
        'timeline',
        'confidence',
        'entities',
      ],
      additionalProperties: false,
    },
  };
}
