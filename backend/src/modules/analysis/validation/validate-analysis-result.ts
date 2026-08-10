import type {
  AgreementPoint,
  AnalysisEntities,
  AnalysisMode,
  AnalysisSourceRef,
  ConfidenceInfo,
  ConfidenceLevel,
  DifferenceItem,
  DifferencePosition,
  NewsArticle,
  NewsAnalysisResult,
  SourcedClaim,
  TimelineEvent,
  UncertaintyItem,
} from '@globalnews-ai/shared';
import { buildEvidenceReferences } from '../prompt/build-analysis-prompt.util';

export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AnalysisValidationError(`Expected "${field}" to be an object.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Milestone #31 — the single trust boundary for citations. Resolves a
 * candidate's model-supplied "evidenceIds" (request-local S1/S2/...
 * aliases — see build-analysis-prompt.util.ts) against the exact
 * evidence map built from the same bounded article set this request
 * actually supplied to the provider, and returns ONLY the real,
 * canonical article IDs those aliases stand for.
 *
 * This is the sole point where an S-label ever becomes a trusted
 * article ID — nothing downstream of this function ever sees or stores
 * an S-label. Unknown, fabricated, malformed, out-of-scope (e.g. a real
 * article ID, a URL, or any string that isn't a currently-valid alias
 * for THIS request), or duplicate evidenceIds are silently dropped
 * rather than trusted, mirroring the pre-M31 groundedIds() behavior for
 * real article IDs. An entry with zero valid evidenceIds after
 * resolution is not grounded and is dropped by the caller, exactly as
 * before.
 */
function resolveEvidenceIds(candidate: unknown, evidenceMap: Map<string, string>): string[] {
  if (!isStringArray(candidate)) return [];
  const resolved: string[] = [];
  for (const evidenceId of candidate) {
    const articleId = evidenceMap.get(evidenceId);
    if (articleId && !resolved.includes(articleId)) {
      resolved.push(articleId);
    }
  }
  return resolved;
}

function validateSourcedClaims(
  candidate: unknown,
  evidenceMap: Map<string, string>,
  field: string,
): SourcedClaim[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError(`Expected "${field}" to be an array.`);
  }

  const result: SourcedClaim[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, field);
    if (!isNonEmptyString(obj.claim)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, evidenceMap);
    // A key fact with zero valid supporting sources is not a
    // grounded fact — drop it rather than let it appear as one.
    if (sourceArticleIds.length === 0) continue;
    result.push({ claim: obj.claim, sourceArticleIds });
  }
  return result;
}

function validateAgreements(candidate: unknown, evidenceMap: Map<string, string>): AgreementPoint[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "agreements" to be an array.');
  }
  const result: AgreementPoint[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'agreements[]');
    if (!isNonEmptyString(obj.point)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, evidenceMap);
    if (sourceArticleIds.length === 0) continue;
    result.push({ point: obj.point, sourceArticleIds });
  }
  return result;
}

function validatePositions(candidate: unknown, evidenceMap: Map<string, string>): DifferencePosition[] {
  if (!Array.isArray(candidate)) return [];
  const result: DifferencePosition[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'differences[].positions[]');
    if (!isNonEmptyString(obj.description)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, evidenceMap);
    if (sourceArticleIds.length === 0) continue;
    result.push({ description: obj.description, sourceArticleIds });
  }
  return result;
}

function validateDifferences(candidate: unknown, evidenceMap: Map<string, string>): DifferenceItem[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "differences" to be an array.');
  }
  const result: DifferenceItem[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'differences[]');
    if (!isNonEmptyString(obj.topic)) continue;
    const positions = validatePositions(obj.positions, evidenceMap);
    if (positions.length === 0) continue;
    result.push({ topic: obj.topic, positions });
  }
  return result;
}

function validateTimeline(candidate: unknown, evidenceMap: Map<string, string>): TimelineEvent[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "timeline" to be an array.');
  }
  const result: TimelineEvent[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'timeline[]');
    if (!isNonEmptyString(obj.event)) continue;
    const timestamp = isNonEmptyString(obj.timestamp) ? obj.timestamp : undefined;
    if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, evidenceMap);
    if (sourceArticleIds.length === 0) continue;
    result.push({ timestamp, event: obj.event, sourceArticleIds });
  }
  return result;
}

/**
 * Milestone #31 — grounded insufficient-evidence items. Unlike the
 * other sections, a zero-length sourceArticleIds is allowed to survive
 * (a general uncertainty not tied to any specific supplied article is
 * still meaningful — e.g. "no outlet reports the cause"), so this is
 * NOT dropped merely for having no resolved evidence, only for having
 * no description.
 */
function validateUncertainties(candidate: unknown, evidenceMap: Map<string, string>): UncertaintyItem[] {
  if (!Array.isArray(candidate)) return [];
  const result: UncertaintyItem[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'uncertainties[]');
    if (!isNonEmptyString(obj.description)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, evidenceMap);
    result.push({ description: obj.description, sourceArticleIds });
  }
  return result;
}

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['low', 'medium', 'high'];

function validateConfidence(candidate: unknown): ConfidenceInfo {
  const obj = requireObject(candidate, 'confidence');
  const level = obj.level;
  if (!isString(level) || !CONFIDENCE_LEVELS.includes(level as ConfidenceLevel)) {
    throw new AnalysisValidationError('"confidence.level" must be one of low, medium, high.');
  }
  const score = typeof obj.score === 'number' && Number.isFinite(obj.score) ? obj.score : 0;
  const explanation = isNonEmptyString(obj.explanation) ? obj.explanation : 'No explanation provided.';
  return {
    level: level as ConfidenceLevel,
    score: Math.max(0, Math.min(100, Math.round(score))),
    explanation,
  };
}

function validateEntities(candidate: unknown): AnalysisEntities {
  const obj = requireObject(candidate, 'entities');
  const list = (value: unknown): string[] => (isStringArray(value) ? value : []);
  return {
    countries: list(obj.countries),
    locations: list(obj.locations),
    people: list(obj.people),
    organizations: list(obj.organizations),
    topics: list(obj.topics),
  };
}

/**
 * Validates and sanitizes a candidate analysis object from any
 * AnalysisProvider. Throws AnalysisValidationError for fundamentally
 * broken shapes (missing required strings, invalid confidence enum,
 * non-array sections) — this is the ONLY condition that produces
 * AnalysisService's "validation-rejected" provenance status (Milestone
 * #30). Ungrounded individual entries (claims/agreements/positions/
 * timeline events whose evidenceIds don't resolve to a real supplied
 * article) are silently dropped rather than causing a full rejection,
 * since a partially-grounded analysis is still useful and "drop the
 * unsupported bit" is exactly what grounding requires — even when every
 * entry in every section ends up dropped and the result is a
 * successful analysis with empty grounded sections. Milestone #31 does
 * not change or broaden this: citation failures never escalate to
 * validation-rejected on their own (see CTO Decision 1).
 *
 * Milestone #31 — every sourceArticleIds value returned here is a REAL
 * NewsArticle.id, resolved from the model's request-local evidenceIds
 * (S1/S2/...) via resolveEvidenceIds(). The evidence map is built fresh
 * from context.articles on every call using the same deterministic
 * assignment (buildEvidenceReferences) used to build the AI prompt for
 * this same array — see build-analysis-prompt.util.ts. No S-label is
 * ever stored on the returned NewsAnalysisResult.
 */
export function validateAnalysisResult(
  candidate: unknown,
  context: { query: string; articles: NewsArticle[]; analysisMode: AnalysisMode },
): NewsAnalysisResult {
  const obj = requireObject(candidate, 'analysis');

  const evidenceMap = new Map(
    buildEvidenceReferences(context.articles).map((ref) => [ref.evidenceId, ref.articleId]),
  );

  if (!isNonEmptyString(obj.headline)) {
    throw new AnalysisValidationError('Missing or empty "headline".');
  }
  if (!isNonEmptyString(obj.summary)) {
    throw new AnalysisValidationError('Missing or empty "summary".');
  }

  const keyFacts = validateSourcedClaims(obj.keyFacts, evidenceMap, 'keyFacts');
  const agreements = validateAgreements(obj.agreements, evidenceMap);
  const differences = validateDifferences(obj.differences, evidenceMap);
  const unknowns = isStringArray(obj.unknowns) ? obj.unknowns.filter(isNonEmptyString) : [];
  const uncertainties = validateUncertainties(obj.uncertainties, evidenceMap);
  const timeline = validateTimeline(obj.timeline, evidenceMap);
  const confidence = validateConfidence(obj.confidence);
  const entities = validateEntities(obj.entities);

  const sources: AnalysisSourceRef[] = context.articles.map((article) => ({
    articleId: article.id,
    publisher: article.sourceName,
    title: article.title,
    url: article.url,
    publishedAt: article.publishedAt,
  }));

  return {
    query: context.query,
    headline: obj.headline,
    summary: obj.summary,
    keyFacts,
    agreements,
    differences,
    unknowns,
    uncertainties,
    timeline,
    confidence,
    entities,
    sources,
    generatedAt: new Date().toISOString(),
    analysisMode: context.analysisMode,
  };
}
