import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';

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

const BASE_SYSTEM_PROMPT = `You are a careful news analyst working for GlobalNews AI.

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
- For "context": provide at most 4 evidence-grounded background facts
  needed to understand the current development — historical,
  institutional, or geographic context. Only include background that is
  actually contained in the supplied evidence above; never draw on
  general knowledge beyond it. Each entry follows the exact same
  evidenceIds/evidenceBasis rules as keyFacts. Return an empty array if
  the evidence does not establish any useful background beyond the
  immediate facts already covered elsewhere.
- For "relevance": provide at most 3 evidence-grounded claims explaining
  why this development matters. Do not exaggerate importance. Do not
  infer political, economic, social, security, or geographic
  consequences unless the supplied evidence itself states them. Each
  entry follows the exact same evidenceIds/evidenceBasis rules as
  keyFacts. Return an empty array if a meaningful relevance claim cannot
  be grounded in the supplied evidence.
- For "affectedParties": identify up to 6 people, organizations,
  countries, regions, or groups the supplied evidence EXPLICITLY
  describes as affected, and state the effect on each using only what
  the evidence states — never inferred. For each entry, set "partyType"
  to the single best-fitting category (person, organization, country,
  region, group, or other). Return an empty array if the evidence does
  not identify specific affected parties.
- For "immediateImpacts": list up to 4 direct, already-occurring
  effects the supplied evidence explicitly states — never a
  plausible-sounding consequence you are inferring. Each entry follows
  the exact same evidenceIds/evidenceBasis rules as keyFacts. Return an
  empty array if the evidence does not state any direct effect.
- For "spilloverImplications": list up to 4 wider or secondary effects
  EXPLICITLY discussed in the supplied evidence — never your own
  extrapolation of what might plausibly follow. Each entry follows the
  exact same evidenceIds/evidenceBasis rules as keyFacts. Return an
  empty array if the evidence does not discuss any wider effect.
- For "significance": provide an evidence-grounded judgment of this
  development's magnitude/consequence — level ("minor", "moderate",
  "major", or "critical") plus up to 2 grounded rationale entries. This
  is an assessment of event magnitude/consequence ONLY — never a proxy
  for source trust, your own confidence, evidence sufficiency,
  emotional tone, topic category, or general importance inferred from
  world knowledge. Base the level ONLY on objective signals actually
  present in the supplied evidence: casualty or injury counts,
  displacement/evacuation figures, documented financial/economic
  magnitude, geographic scope, the number or scale of affected
  people/groups/institutions, official emergency/disaster
  declarations, major institutional/legal/policy consequences, or
  explicit source characterization of scale where grounded in concrete
  facts. Do NOT infer severity merely because reporting uses dramatic
  language such as "crisis", "catastrophic", "historic", "shocking",
  or "devastating" — those words alone are never sufficient evidence.
  "critical" requires EITHER (A) an explicit authoritative designation
  of exceptional severity supported by the supplied evidence, OR (B)
  multiple independent objective high-severity indicators together
  (for example, a very large casualty/displacement magnitude PLUS
  major geographic/institutional/economic consequences) — one isolated
  signal is generally not enough to justify "critical". When the
  evidence is ambiguous between two levels, choose the lower defensible
  level. Each rationale entry follows the exact same
  evidenceIds/evidenceBasis rules as keyFacts. Return "significance":
  null (the JSON null literal, not an object) when the supplied
  evidence does not support a defensible level judgment — never
  default to "minor" or guess.
- For keyFacts, agreements, differences (each position), and timeline
  entries, you may optionally include "evidenceBasis": an object with
  "evidenceId" (one of the exact evidenceId values you already cited for
  that entry) and "excerpt" (a short excerpt, a sentence or less, copied
  verbatim from that evidence's own text above — do not paraphrase, do
  not combine wording from multiple articles, do not invent text). Omit
  "evidenceBasis" entirely if you cannot quote a genuine short excerpt
  that directly appears in the cited evidence's text.
`;

/**
 * Milestone #40 (authoritative-context correction) — the exact,
 * deterministic X/Y pair the model must use for relational direction
 * classification, when the current request matched Milestone #37's
 * relational pattern set. This is the SAME object AnalysisService
 * already builds from deriveRelationalSearchQueries()'s output
 * (relationalQuery.x/relationalQuery.y) — this module does not parse,
 * derive, or reinterpret X/Y itself; it only renders whatever it's
 * given into the prompt. There is exactly one source of truth for
 * what X and Y are: deriveRelationalSearchQueries().
 */
export interface RelationalPromptContext {
  x: string;
  y: string;
}

/**
 * Milestone #40 (authoritative-context correction) — appended to
 * BASE_SYSTEM_PROMPT to produce the final system prompt. Two mutually
 * exclusive branches:
 *
 * - relationalContext present: explicitly states the EXACT X and Y
 *   values (verbatim, never reinterpreted) and defines
 *   requested-direction/reverse-direction strictly in terms of that
 *   pair — the model is never asked to independently infer X/Y from
 *   the question text, closing the "two independent interpretations"
 *   gap the CTO identified.
 * - relationalContext absent: explicitly tells the model this is NOT
 *   an M40 relational request and relationalEvidenceAssessments must
 *   stay empty — this is a prompt-level instruction only; the actual
 *   safety guarantee is enforced independently and unconditionally by
 *   validateAnalysisResult() (see Step 8's fail-closed rule), which
 *   never trusts prompt obedience alone.
 */
export function buildRelationalPromptSection(
  relationalContext: RelationalPromptContext | undefined,
): string {
  if (!relationalContext) {
    return `- This is NOT a Milestone #40 relational request — the question did
  not match a supported relational pattern. Do not populate
  "relationalEvidenceAssessments"; leave it as an empty array, and leave
  every entry's "relationshipAssessmentIds" as null. Do not attempt to
  classify any relationship direction for this request.
- Output must be valid JSON matching the provided schema exactly. Do not
  include commentary outside the JSON.`;
  }

  const { x, y } = relationalContext;
  return `- RELATIONAL CONTEXT: X = "${x}", Y = "${y}". These are the EXACT,
  authoritative concepts for this request — do not infer, replace, or
  reinterpret them using synonyms or your own reading of the question;
  use exactly these two values. Populate "relationalEvidenceAssessments"
  with specific excerpts you found in the evidence above that bear on the
  relationship between X and Y. Each entry needs a unique "assessmentId"
  you invent for this response only (e.g. "R1", "R2", ...), the
  "evidenceId" of the article the excerpt is from, the "excerpt" itself
  (copied verbatim, a sentence or less, exactly like evidenceBasis above —
  never invented or combined from multiple articles), and a "direction":
  "requested-direction" if the excerpt supports or discusses the
  relationship in the order X affecting Y (i.e. "${x}" affecting "${y}"),
  "reverse-direction" if the excerpt supports it in the opposite order
  (i.e. "${y}" affecting "${x}"), "bidirectional" if the excerpt supports
  both directions at once, "association-only" if the excerpt merely
  discusses both X and Y without describing a relationship between them,
  "unclear" if you genuinely cannot tell, or "non-substantive" if the
  shared wording is incidental (e.g. part of an organization's name
  rather than substantive content). A single article may reasonably
  produce more than one assessment if it discusses the relationship in
  more than one place or more than one way — this is expected, not an
  error. Then, on any keyFacts, agreements, differences positions, or
  timeline entry whose claim text is actually supported by one or more of
  these assessments, include "relationshipAssessmentIds": the
  assessmentId(s) that specific entry relies on. Never mark an entry as
  relying on an assessment that isn't about an article that entry itself
  already cited in "evidenceIds". If you found no genuine relational
  evidence, leave "relationalEvidenceAssessments" as an empty array and
  every entry's "relationshipAssessmentIds" as null. Never state or imply
  that a relationship is causally proven — you are only reporting what
  the evidence says, not establishing that one thing caused another.
- Output must be valid JSON matching the provided schema exactly. Do not
  include commentary outside the JSON.`;
}

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
  relationalContext?: RelationalPromptContext,
  responseLanguage: LanguageCode = 'en',
): { system: string; user: string } {
  const normalized = normalizeArticlesForPrompt(articles, maxChars);
  return {
    system:
      BASE_SYSTEM_PROMPT +
      buildRelationalPromptSection(relationalContext) +
      buildResponseLanguageInstruction(responseLanguage),
    user: buildAnalysisUserPrompt(query, normalized),
  };
}

/**
 * Milestone #47 — the ONLY prompt change required to support a
 * non-English response, reusing the SAME single existing analysis
 * call (zero additional OpenAI calls). Maps a LanguageCode to a stable
 * English language name — never hard-codes "Polish" specifically, so
 * every LanguageCode already has defined behavior here even though
 * only 'en'/'pl' are wired into AnalysisService as of this milestone.
 *
 * Deliberately instructs the model to translate ONLY prose fields and
 * explicitly NOT touch structured/machine-readable fields (article
 * IDs, evidenceId values, citation identifiers, enum values) — this is
 * a prompt-level reinforcement of what the EXISTING, unmodified
 * validation pipeline (validate-analysis-result.ts) already enforces
 * structurally regardless of what the model actually does: a
 * fabricated or altered ID/enum would already be rejected by that
 * unchanged machinery, so this instruction is a quality aid, not the
 * sole safety mechanism.
 *
 * Returns an empty string for 'en' — the base system prompt's existing
 * behavior is already English, so no additional instruction is needed
 * and none is added, preserving byte-for-byte prior prompt behavior
 * for every English request.
 */
export function buildResponseLanguageInstruction(language: LanguageCode): string {
  if (language === 'en') return '';

  const languageName = RESPONSE_LANGUAGE_NAMES[language];

  return `\n\nRespond in ${languageName}. All prose fields (headline, summary, claim text, agreement/difference descriptions, uncertainty text, explanations, entity labels, etc.) must be written in ${languageName}. Do NOT translate, alter, or localize: article IDs, evidenceId values, citation identifiers, or any enum/machine-readable field value (e.g. direction, sufficiency, confidence level tokens) — those must remain exactly as specified by the schema.`;
}

const RESPONSE_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  pl: 'Polish',
  sw: 'Swahili',
  fr: 'French',
  es: 'Spanish',
  ar: 'Arabic',
  rw: 'Kinyarwanda',
};

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

  /**
   * Milestone #40 — model-facing relational-evidence-assessment shape.
   * `assessmentId` is a request-local, model-facing label (e.g. "R1",
   * distinct from and never confused with the request-local "S1"-style
   * evidenceId aliases) — it exists only to let a claim reference which
   * specific assessment(s) it relies on within THIS same response; it
   * is never trusted as a stable ID and never survives validation. Uses
   * the same request-local "evidenceId" field as everywhere else in
   * this schema — resolve-relational-evidence-assessment.util.ts is the
   * only place either ID is ever resolved/discarded.
   */
  const relationalEvidenceAssessmentSchema = {
    type: 'object',
    properties: {
      assessmentId: { type: 'string' },
      evidenceId: { type: 'string' },
      excerpt: { type: 'string' },
      direction: {
        type: 'string',
        enum: [
          'requested-direction',
          'reverse-direction',
          'bidirectional',
          'association-only',
          'unclear',
          'non-substantive',
        ],
      },
    },
    required: ['assessmentId', 'evidenceId', 'excerpt', 'direction'],
    additionalProperties: false,
  };

  /**
   * Milestone #40 — nullable array of request-local assessmentId
   * strings a claim/agreement/position/timeline entry relies on. Null
   * (not an empty array) when the entry has no relational grounding —
   * an empty array vs. null both mean "none" at validation time, but
   * null is the natural "not applicable" value here, consistent with
   * evidenceBasisSchema's own nullable-object convention above.
   */
  const relationshipAssessmentIdsSchema = {
    type: ['array', 'null'],
    items: { type: 'string' },
  };

  const sourcedClaim = {
    type: 'object',
    properties: {
      claim: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
      relationshipAssessmentIds: relationshipAssessmentIdsSchema,
    },
    required: ['claim', 'evidenceIds', 'evidenceBasis', 'relationshipAssessmentIds'],
    additionalProperties: false,
  };

  /**
   * Milestone #62 Phase 2 — same evidence-grounding fields as
   * sourcedClaim (evidenceIds/evidenceBasis), but with "party"/
   * "partyType"/"effect" in place of a single "claim" string, since
   * affectedParties genuinely needs the who/how distinction — see
   * AffectedParty's own doc comment in shared/src/analysis.ts.
   */
  const affectedParty = {
    type: 'object',
    properties: {
      party: { type: 'string' },
      partyType: {
        type: 'string',
        enum: ['person', 'organization', 'country', 'region', 'group', 'other'],
      },
      effect: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
    },
    required: ['party', 'partyType', 'effect', 'evidenceIds', 'evidenceBasis'],
    additionalProperties: false,
  };

  /**
   * Milestone #62 Phase 3 — nullable object, following the exact same
   * strict-mode convention as evidenceBasisSchema above: under
   * `strict: true`/`additionalProperties: false` the schema cannot
   * express "may be omitted", so the model must emit `null` explicitly
   * when the evidence does not support a defensible significance
   * judgment, rather than the property being left out.
   */
  const significanceSchema = {
    type: ['object', 'null'],
    properties: {
      level: { type: 'string', enum: ['minor', 'moderate', 'major', 'critical'] },
      rationale: { type: 'array', items: sourcedClaim },
    },
    required: ['level', 'rationale'],
    additionalProperties: false,
  };

  const positionSchema = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
      evidenceBasis: evidenceBasisSchema,
      relationshipAssessmentIds: relationshipAssessmentIdsSchema,
    },
    required: ['description', 'evidenceIds', 'evidenceBasis', 'relationshipAssessmentIds'],
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
        /** Milestone #62 Phase 1 — reuses the exact sourcedClaim shape, no new schema family. */
        context: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 1 — reuses the exact sourcedClaim shape, no new schema family. */
        relevance: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 2 — dedicated affectedParty shape (party/partyType/effect), not sourcedClaim. */
        affectedParties: { type: 'array', items: affectedParty },
        /** Milestone #62 Phase 2 — reuses the exact sourcedClaim shape, no new schema family. */
        immediateImpacts: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 2 — reuses the exact sourcedClaim shape, no new schema family. */
        spilloverImplications: { type: 'array', items: sourcedClaim },
        /** Milestone #62 Phase 3 — nullable object; see significanceSchema's own doc comment above. */
        significance: significanceSchema,
        agreements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              point: { type: 'string' },
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceBasis: evidenceBasisSchema,
              relationshipAssessmentIds: relationshipAssessmentIdsSchema,
            },
            required: ['point', 'evidenceIds', 'evidenceBasis', 'relationshipAssessmentIds'],
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
        relationalEvidenceAssessments: {
          type: 'array',
          items: relationalEvidenceAssessmentSchema,
        },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              event: { type: 'string' },
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceBasis: evidenceBasisSchema,
              relationshipAssessmentIds: relationshipAssessmentIdsSchema,
            },
            required: [
              'timestamp',
              'event',
              'evidenceIds',
              'evidenceBasis',
              'relationshipAssessmentIds',
            ],
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
        'context',
        'relevance',
        'affectedParties',
        'immediateImpacts',
        'spilloverImplications',
        'significance',
        'agreements',
        'differences',
        'unknowns',
        'uncertainties',
        'relationalEvidenceAssessments',
        'timeline',
        'confidence',
        'entities',
      ],
      additionalProperties: false,
    },
  };
}
